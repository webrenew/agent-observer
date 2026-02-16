import { logRendererEvent } from '../../lib/diagnostics'
import type {
  LoadedPluginInstance,
  PluginCommandDefinition,
  PluginHookDefinition,
  PluginHookEvent,
  PluginHookHandler,
  PluginModule,
  PluginPromptTransformerDefinition,
  RawDiscoveredPlugin,
  RegisterPluginFunction,
  RendererPluginApi,
  RuntimeDiscoveredPlugin,
} from './contracts'
import { resolveRendererEntryPath } from './discovery'
import {
  asRecord,
  runDisposer,
  toErrorMessage,
  toFileModuleSpecifier,
} from './helpers'

export interface PluginLoaderRegistrationApi {
  registerHookFromDefinition: <E extends PluginHookEvent>(
    event: E | PluginHookDefinition<E>,
    handler?: PluginHookHandler<E>,
    options?: { pluginId?: string; order?: number }
  ) => () => void
  registerCommand: (
    command: PluginCommandDefinition,
    options?: { pluginId?: string }
  ) => () => void
  registerPromptTransformer: (
    transformer: PluginPromptTransformerDefinition,
    options?: { pluginId?: string; order?: number }
  ) => () => void
}

export interface PluginLoader {
  reconcileLoadedPlugins: (
    plugins: RawDiscoveredPlugin[],
    homeDir: string
  ) => Promise<void>
  toRuntimePlugin: (plugin: RawDiscoveredPlugin) => RuntimeDiscoveredPlugin
}

export function createPluginLoader(registrations: PluginLoaderRegistrationApi): PluginLoader {
  const loadedPluginInstances = new Map<string, LoadedPluginInstance>()
  const pluginLoadErrors = new Map<string, string>()

  const loadPluginModule = async (
    plugin: RawDiscoveredPlugin,
    entryPath: string
  ): Promise<LoadedPluginInstance> => {
    const stat = await window.electronAPI.fs.stat(entryPath)
    if (!stat.isFile) {
      throw new Error(`Renderer entry is not a file: ${entryPath}`)
    }

    const moduleSpecifier = toFileModuleSpecifier(entryPath, stat.modified)
    const moduleExports = await import(/* @vite-ignore */ moduleSpecifier) as PluginModule
    const registerCandidate = typeof moduleExports.default === 'function'
      ? moduleExports.default
      : moduleExports.register
    if (typeof registerCandidate !== 'function') {
      throw new Error('Plugin module must export default function register(api) or named register(api)')
    }

    const hookDisposers: Array<() => void> = []
    const registerHookFromPlugin = <E extends PluginHookEvent>(
      event: E | PluginHookDefinition<E>,
      handler?: PluginHookHandler<E>,
      options?: { order?: number }
    ): (() => void) => {
      const dispose = registrations.registerHookFromDefinition(event, handler, {
        pluginId: plugin.id,
        order: options?.order,
      })
      hookDisposers.push(dispose)
      return () => {
        const index = hookDisposers.indexOf(dispose)
        if (index >= 0) hookDisposers.splice(index, 1)
        runDisposer(dispose, 'hook_unregister', plugin.id)
      }
    }

    const commandDisposers: Array<() => void> = []
    const registerCommandFromPlugin = (command: PluginCommandDefinition): (() => void) => {
      const dispose = registrations.registerCommand(command, { pluginId: plugin.id })
      commandDisposers.push(dispose)
      return () => {
        const index = commandDisposers.indexOf(dispose)
        if (index >= 0) commandDisposers.splice(index, 1)
        runDisposer(dispose, 'command_unregister', plugin.id)
      }
    }

    const promptTransformDisposers: Array<() => void> = []
    const registerPromptTransformerFromPlugin = (
      transformer: PluginPromptTransformerDefinition,
      options?: { order?: number }
    ): (() => void) => {
      const dispose = registrations.registerPromptTransformer(transformer, {
        pluginId: plugin.id,
        order: options?.order,
      })
      promptTransformDisposers.push(dispose)
      return () => {
        const index = promptTransformDisposers.indexOf(dispose)
        if (index >= 0) promptTransformDisposers.splice(index, 1)
        runDisposer(dispose, 'prompt_transform_unregister', plugin.id)
      }
    }

    const api: RendererPluginApi = {
      registerHook: registerHookFromPlugin,
      on: registerHookFromPlugin,
      registerCommand: registerCommandFromPlugin,
      registerPromptTransformer: registerPromptTransformerFromPlugin,
      log: (level, event, payload) => {
        logRendererEvent(level, `plugin.${plugin.id}.${event}`, payload)
      },
      plugin,
    }

    const pluginCleanupCandidates: Array<() => void> = []
    const register = registerCandidate as RegisterPluginFunction
    const registrationResult = await register(api)
    if (typeof registrationResult === 'function') {
      pluginCleanupCandidates.push(registrationResult as () => void)
    } else {
      const registrationRecord = asRecord(registrationResult)
      const disposeMaybe = registrationRecord?.dispose
      if (typeof disposeMaybe === 'function') {
        pluginCleanupCandidates.push(disposeMaybe as () => void)
      }
    }

    const dispose = (): void => {
      while (pluginCleanupCandidates.length > 0) {
        const candidate = pluginCleanupCandidates.pop()
        runDisposer(candidate, 'plugin_unregister', plugin.id)
      }
      while (commandDisposers.length > 0) {
        const commandDispose = commandDisposers.pop()
        runDisposer(commandDispose, 'command_unregister', plugin.id)
      }
      while (promptTransformDisposers.length > 0) {
        const promptTransformDispose = promptTransformDisposers.pop()
        runDisposer(promptTransformDispose, 'prompt_transform_unregister', plugin.id)
      }
      while (hookDisposers.length > 0) {
        const hookDispose = hookDisposers.pop()
        runDisposer(hookDispose, 'hook_unregister', plugin.id)
      }
    }

    return { entryPath, dispose }
  }

  const reconcileLoadedPlugins = async (
    plugins: RawDiscoveredPlugin[],
    homeDir: string
  ): Promise<void> => {
    const desiredEntryPaths = new Map<string, string | null>()
    for (const plugin of plugins) {
      desiredEntryPaths.set(plugin.manifestPath, await resolveRendererEntryPath(plugin, homeDir))
    }

    for (const [manifestPath, instance] of loadedPluginInstances) {
      const desiredEntryPath = desiredEntryPaths.get(manifestPath)
      if (!desiredEntryPath || desiredEntryPath !== instance.entryPath) {
        runDisposer(instance.dispose, 'plugin_reload', manifestPath)
        loadedPluginInstances.delete(manifestPath)
      }
    }

    for (const manifestPath of Array.from(pluginLoadErrors.keys())) {
      if (!desiredEntryPaths.has(manifestPath)) {
        pluginLoadErrors.delete(manifestPath)
      }
    }

    for (const plugin of plugins) {
      const entryPath = desiredEntryPaths.get(plugin.manifestPath) ?? null
      if (!entryPath) {
        pluginLoadErrors.delete(plugin.manifestPath)
        continue
      }
      if (loadedPluginInstances.has(plugin.manifestPath)) {
        pluginLoadErrors.delete(plugin.manifestPath)
        continue
      }

      try {
        const instance = await loadPluginModule(plugin, entryPath)
        loadedPluginInstances.set(plugin.manifestPath, instance)
        pluginLoadErrors.delete(plugin.manifestPath)
        logRendererEvent('info', 'plugin.runtime.loaded', {
          pluginId: plugin.id,
          manifestPath: plugin.manifestPath,
          entryPath,
        })
      } catch (err) {
        const message = toErrorMessage(err)
        pluginLoadErrors.set(plugin.manifestPath, message)
        logRendererEvent('warn', 'plugin.runtime.load_failed', {
          pluginId: plugin.id,
          manifestPath: plugin.manifestPath,
          entryPath,
          error: message,
        })
      }
    }
  }

  const toRuntimePlugin = (plugin: RawDiscoveredPlugin): RuntimeDiscoveredPlugin => {
    if (!plugin.rendererEntry) {
      return {
        ...plugin,
        loadState: 'skipped',
        loadError: null,
      }
    }
    if (loadedPluginInstances.has(plugin.manifestPath)) {
      return {
        ...plugin,
        loadState: 'loaded',
        loadError: null,
      }
    }
    return {
      ...plugin,
      loadState: 'failed',
      loadError: pluginLoadErrors.get(plugin.manifestPath) ?? 'Renderer entry failed to load',
    }
  }

  return {
    reconcileLoadedPlugins,
    toRuntimePlugin,
  }
}

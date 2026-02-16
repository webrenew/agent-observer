import type {
  PluginHookEvent,
  PluginHookEventPayloadMap,
  PluginHookHandler,
} from '../types'
import { logRendererEvent } from '../lib/diagnostics'
import { registerDiagnosticsHooks } from './builtins/diagnosticsHooks'
import { createPluginCatalogStore } from './runtime/catalog-store'
import type {
  PluginCatalogSnapshot,
  PluginCommandContext,
  PluginCommandDefinition,
  PluginCommandExecutionResult,
  PluginCommandSummary,
  PluginPromptTransformApplyResult,
  PluginPromptTransformContext,
  PluginPromptTransformerDefinition,
} from './runtime/contracts'
import {
  collectPluginDirsFromProfiles as collectPluginDirsFromProfilesImpl,
  discoverPlugins,
} from './runtime/discovery'
import { toErrorMessage } from './runtime/helpers'
import { createPluginLoader } from './runtime/loader'
import { createPluginRegistries } from './runtime/registries'

export type {
  PluginCatalogSnapshot,
  PluginCommandContext,
  PluginCommandDefinition,
  PluginCommandExecutionResult,
  PluginCommandSummary,
  PluginHookDefinition,
  PluginPromptTransformApplyResult,
  PluginPromptTransformContext,
  PluginPromptTransformerDefinition,
  RuntimeDiscoveredPlugin,
} from './runtime/contracts'

const catalogStore = createPluginCatalogStore()
const registries = createPluginRegistries()

function refreshSnapshotCommands(): void {
  catalogStore.updateCommands(registries.getRegisteredCommands())
}

export function registerPluginCommand(
  command: PluginCommandDefinition,
  options?: { pluginId?: string }
): () => void {
  const dispose = registries.registerCommand(command, options)
  refreshSnapshotCommands()
  return () => {
    dispose()
    refreshSnapshotCommands()
  }
}

export function registerPluginPromptTransformer(
  transformer: PluginPromptTransformerDefinition,
  options?: { pluginId?: string; order?: number }
): () => void {
  return registries.registerPromptTransformer(transformer, options)
}

const pluginLoader = createPluginLoader({
  registerHookFromDefinition: registries.registerHookFromDefinition,
  registerCommand: registerPluginCommand,
  registerPromptTransformer: registerPluginPromptTransformer,
})

let runtimeInitialized = false

async function syncPluginCatalogFromSettings(): Promise<PluginCatalogSnapshot | null> {
  try {
    const settings = await window.electronAPI.settings.get()
    return await syncPluginCatalogFromProfiles(settings.claudeProfiles)
  } catch (err) {
    logRendererEvent('warn', 'plugin.catalog.settings_sync_failed', {
      error: toErrorMessage(err),
    })
    return null
  }
}

export function getRegisteredPromptTransformerCount(): number {
  return registries.getPromptTransformerCount()
}

export function getRegisteredPluginCommands(): PluginCommandSummary[] {
  return registries.getRegisteredCommands()
}

export async function invokePluginCommand(
  commandName: string,
  context: PluginCommandContext
): Promise<PluginCommandExecutionResult> {
  return registries.invokeCommand(commandName, context)
}

export async function applyPluginPromptTransforms(
  context: PluginPromptTransformContext
): Promise<PluginPromptTransformApplyResult> {
  return registries.applyPromptTransforms(context)
}

export function getPluginCatalogSnapshot(): PluginCatalogSnapshot {
  return catalogStore.getSnapshot()
}

export function subscribePluginCatalog(listener: () => void): () => void {
  return catalogStore.subscribe(listener)
}

export function collectPluginDirsFromProfiles(config: Parameters<typeof collectPluginDirsFromProfilesImpl>[0]): string[] {
  return collectPluginDirsFromProfilesImpl(config)
}

export async function syncPluginCatalog(pluginDirs: string[]): Promise<PluginCatalogSnapshot> {
  if (!window.electronAPI?.fs) {
    return getPluginCatalogSnapshot()
  }

  const discovery = await discoverPlugins(pluginDirs)
  if (catalogStore.matchesSignature(discovery.signature)) {
    return getPluginCatalogSnapshot()
  }

  await pluginLoader.reconcileLoadedPlugins(discovery.plugins, discovery.homeDir)

  const runtimePlugins = discovery.plugins.map((plugin) => pluginLoader.toRuntimePlugin(plugin))
  const loadWarnings = runtimePlugins
    .filter((plugin) => plugin.loadState === 'failed' && plugin.loadError)
    .map((plugin) => `${plugin.name}: ${plugin.loadError}`)

  const snapshot: PluginCatalogSnapshot = {
    directories: discovery.scannedDirectories,
    plugins: runtimePlugins,
    commands: getRegisteredPluginCommands(),
    warnings: [...discovery.warnings, ...loadWarnings],
    syncedAt: Date.now(),
  }

  catalogStore.setSignature(discovery.signature)
  catalogStore.updateSnapshot(snapshot)

  logRendererEvent('info', 'plugin.catalog.synced', {
    requestedDirectories: discovery.normalizedDirs.length,
    scannedDirectories: discovery.scannedDirectories.length,
    discoveredPlugins: discovery.plugins.length,
    loadedPlugins: runtimePlugins.filter((plugin) => plugin.loadState === 'loaded').length,
    registeredCommands: snapshot.commands.length,
    warnings: snapshot.warnings.length,
  })

  return snapshot
}

export async function syncPluginCatalogFromProfiles(
  config: Parameters<typeof collectPluginDirsFromProfilesImpl>[0]
): Promise<PluginCatalogSnapshot> {
  return syncPluginCatalog(collectPluginDirsFromProfilesImpl(config))
}

export function registerPluginHook<E extends PluginHookEvent>(
  event: E,
  handler: PluginHookHandler<E>,
  options?: { pluginId?: string; order?: number }
): () => void {
  return registries.registerHook(event, handler, options)
}

export async function emitPluginHook<E extends PluginHookEvent>(
  event: E,
  payload: PluginHookEventPayloadMap[E]
): Promise<void> {
  await registries.emitHook(event, payload)
}

function registerBuiltinCommands(): void {
  registerPluginCommand(
    {
      name: 'plugins',
      description: 'List loaded renderer plugins and commands.',
      execute: async (context) => {
        const firstArg = context.args[0]?.toLowerCase()
        if (firstArg === 'reload' || firstArg === 'rescan') {
          await syncPluginCatalogFromSettings()
        }
        const snapshot = getPluginCatalogSnapshot()
        const loaded = snapshot.plugins.filter((plugin) => plugin.loadState === 'loaded')
        const commandNames = getRegisteredPluginCommands().map((command) => `/${command.name}`)
        const pluginList = loaded.length > 0
          ? loaded.map((plugin) => plugin.name).join(', ')
          : 'none'
        const commands = commandNames.length > 0
          ? commandNames.join(', ')
          : 'none'
        const transformerCount = getRegisteredPromptTransformerCount()
        const reloadHint = 'Tip: use /plugins reload or /plugins-reload after editing plugin code.'
        return `Plugins loaded: ${pluginList}\nCommands: ${commands}\nPrompt transformers: ${transformerCount}\n${reloadHint}`
      },
    },
    { pluginId: 'builtin.runtime' }
  )
  registerPluginCommand(
    {
      name: 'plugins-reload',
      description: 'Rescan plugin dirs and reload renderer plugin entries.',
      execute: async () => {
        const snapshot = await syncPluginCatalogFromSettings()
        const current = snapshot ?? getPluginCatalogSnapshot()
        const loadedCount = current.plugins.filter((plugin) => plugin.loadState === 'loaded').length
        return `Reloaded plugins. Loaded ${loadedCount}/${current.plugins.length}. Warnings: ${current.warnings.length}.`
      },
    },
    { pluginId: 'builtin.runtime' }
  )
}

export function initializePluginRuntime(): void {
  if (runtimeInitialized) return
  runtimeInitialized = true

  registerDiagnosticsHooks(registerPluginHook)
  registerBuiltinCommands()
  void syncPluginCatalogFromSettings()
  logRendererEvent('info', 'plugin.runtime.initialized', {
    registeredEvents: registries.getHookRegistrationSummary(),
    registeredCommands: getRegisteredPluginCommands().map((entry) => entry.name),
    promptTransformers: getRegisteredPromptTransformerCount(),
  })
}

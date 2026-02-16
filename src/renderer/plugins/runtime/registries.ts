import { logRendererEvent } from '../../lib/diagnostics'
import type {
  HooksByEvent,
  PluginCommandContext,
  PluginCommandDefinition,
  PluginCommandExecutionResult,
  PluginCommandSummary,
  PluginHookDefinition,
  PluginHookEvent,
  PluginHookEventPayloadMap,
  PluginHookHandler,
  PluginPromptTransformApplyResult,
  PluginPromptTransformContext,
  PluginPromptTransformerDefinition,
  RegisteredHook,
  RegisteredPluginCommand,
  RegisteredPromptTransformer,
} from './contracts'
import {
  asFiniteNumber,
  asRecord,
  asString,
  normalizeCommandExecutionOutput,
  normalizeCommandName,
  normalizePromptTransformOutput,
  toErrorMessage,
} from './helpers'
import { PLUGIN_HOOK_EVENTS } from './contracts'

function createHooksByEvent(): HooksByEvent {
  return {
    before_agent_start: [],
    agent_end: [],
    session_start: [],
    session_end: [],
    message_received: [],
    message_sending: [],
    message_sent: [],
    before_tool_call: [],
    after_tool_call: [],
    tool_result_persist: [],
  }
}

export interface PluginRegistries {
  registerHook: <E extends PluginHookEvent>(
    event: E,
    handler: PluginHookHandler<E>,
    options?: { pluginId?: string; order?: number }
  ) => () => void
  registerHookFromDefinition: <E extends PluginHookEvent>(
    event: E | PluginHookDefinition<E>,
    handler?: PluginHookHandler<E>,
    options?: { pluginId?: string; order?: number }
  ) => () => void
  emitHook: <E extends PluginHookEvent>(
    event: E,
    payload: PluginHookEventPayloadMap[E]
  ) => Promise<void>
  registerCommand: (
    command: PluginCommandDefinition,
    options?: { pluginId?: string }
  ) => () => void
  invokeCommand: (
    commandName: string,
    context: PluginCommandContext
  ) => Promise<PluginCommandExecutionResult>
  getRegisteredCommands: () => PluginCommandSummary[]
  registerPromptTransformer: (
    transformer: PluginPromptTransformerDefinition,
    options?: { pluginId?: string; order?: number }
  ) => () => void
  applyPromptTransforms: (
    context: PluginPromptTransformContext
  ) => Promise<PluginPromptTransformApplyResult>
  getPromptTransformerCount: () => number
  getHookRegistrationSummary: () => string[]
}

export function createPluginRegistries(): PluginRegistries {
  const hooksByEvent = createHooksByEvent()
  const hookEvents = new Set<PluginHookEvent>(PLUGIN_HOOK_EVENTS)
  const pluginCommandsByName = new Map<string, RegisteredPluginCommand>()
  const promptTransformers: RegisteredPromptTransformer[] = []
  let hookCounter = 0
  let commandCounter = 0
  let promptTransformerCounter = 0

  const isPluginHookEvent = (value: string): value is PluginHookEvent => {
    return hookEvents.has(value as PluginHookEvent)
  }

  const normalizeHookRegistration = <E extends PluginHookEvent>(
    event: E | PluginHookDefinition<E>,
    handler?: PluginHookHandler<E>,
    options?: { order?: number }
  ): { event: E; handler: PluginHookHandler<E>; order?: number } => {
    if (typeof event === 'string') {
      if (typeof handler !== 'function') {
        throw new Error(`Hook "${event}" requires a handler function`)
      }
      return {
        event,
        handler,
        order: options?.order,
      }
    }

    const registration = asRecord(event as unknown)
    if (!registration) {
      throw new Error('Hook registration must be a string event or object definition')
    }

    const rawEvent = asString(registration.event)
    if (!rawEvent || !isPluginHookEvent(rawEvent)) {
      throw new Error(`Unsupported hook event: ${String(registration.event)}`)
    }

    if (typeof registration.handler !== 'function') {
      throw new Error(`Hook "${rawEvent}" requires a handler function`)
    }

    return {
      event: rawEvent as E,
      handler: registration.handler as PluginHookHandler<E>,
      order: asFiniteNumber(registration.order) ?? options?.order,
    }
  }

  const getHooksForEvent = <E extends PluginHookEvent>(event: E): RegisteredHook<E>[] => {
    return hooksByEvent[event]
  }

  const registerHook = <E extends PluginHookEvent>(
    event: E,
    handler: PluginHookHandler<E>,
    options?: { pluginId?: string; order?: number }
  ): (() => void) => {
    if (!isPluginHookEvent(String(event))) {
      throw new Error(`Unsupported hook event: ${String(event)}`)
    }
    const hook: RegisteredHook<E> = {
      id: `hook-${++hookCounter}`,
      event,
      pluginId: options?.pluginId ?? 'anonymous',
      order: options?.order ?? 100,
      handler,
    }
    const hooks = getHooksForEvent(event)
    hooks.push(hook)
    hooks.sort((a, b) => a.order - b.order)

    return () => {
      const current = getHooksForEvent(event)
      const index = current.findIndex((entry) => entry.id === hook.id)
      if (index >= 0) {
        current.splice(index, 1)
      }
    }
  }

  const registerHookFromDefinition = <E extends PluginHookEvent>(
    event: E | PluginHookDefinition<E>,
    handler?: PluginHookHandler<E>,
    options?: { pluginId?: string; order?: number }
  ): (() => void) => {
    const normalized = normalizeHookRegistration(event, handler, options)
    return registerHook(normalized.event, normalized.handler, {
      pluginId: options?.pluginId,
      order: normalized.order,
    })
  }

  const emitHook = async <E extends PluginHookEvent>(
    event: E,
    payload: PluginHookEventPayloadMap[E]
  ): Promise<void> => {
    const hooks = getHooksForEvent(event)
    if (hooks.length === 0) return

    for (const hook of hooks) {
      try {
        await hook.handler(payload)
      } catch (err) {
        logRendererEvent('error', 'plugin.hook.failed', {
          event,
          hookId: hook.id,
          pluginId: hook.pluginId,
          error: toErrorMessage(err),
        })
      }
    }
  }

  const registerCommand = (
    command: PluginCommandDefinition,
    options?: { pluginId?: string }
  ): (() => void) => {
    const normalizedName = normalizeCommandName(command.name)
    if (!normalizedName) {
      throw new Error(`Invalid plugin command name: ${command.name}`)
    }

    const registered: RegisteredPluginCommand = {
      id: `command-${++commandCounter}`,
      name: normalizedName,
      pluginId: options?.pluginId ?? 'anonymous',
      description: asString(command.description) ?? null,
      execute: command.execute,
    }

    const existing = pluginCommandsByName.get(normalizedName)
    if (existing && existing.id !== registered.id) {
      logRendererEvent('warn', 'plugin.command.replaced', {
        commandName: normalizedName,
        replacedPluginId: existing.pluginId,
        pluginId: registered.pluginId,
      })
    }

    pluginCommandsByName.set(normalizedName, registered)

    return () => {
      const current = pluginCommandsByName.get(normalizedName)
      if (!current || current.id !== registered.id) return
      pluginCommandsByName.delete(normalizedName)
    }
  }

  const invokeCommand = async (
    commandName: string,
    context: PluginCommandContext
  ): Promise<PluginCommandExecutionResult> => {
    const normalizedName = normalizeCommandName(commandName)
    if (!normalizedName) {
      return {
        handled: false,
        commandName: commandName.trim(),
        pluginId: null,
        message: null,
        isError: false,
      }
    }

    const command = pluginCommandsByName.get(normalizedName)
    if (!command) {
      return {
        handled: false,
        commandName: normalizedName,
        pluginId: null,
        message: null,
        isError: false,
      }
    }

    try {
      const output = await command.execute(context)
      const normalizedOutput = normalizeCommandExecutionOutput(output)
      logRendererEvent('info', 'plugin.command.executed', {
        pluginId: command.pluginId,
        commandName: normalizedName,
        hasMessage: Boolean(normalizedOutput.message),
        isError: normalizedOutput.isError,
      })
      return {
        handled: true,
        commandName: normalizedName,
        pluginId: command.pluginId,
        message: normalizedOutput.message,
        isError: normalizedOutput.isError,
      }
    } catch (err) {
      const errorMessage = toErrorMessage(err)
      logRendererEvent('warn', 'plugin.command.failed', {
        pluginId: command.pluginId,
        commandName: normalizedName,
        error: errorMessage,
      })
      return {
        handled: true,
        commandName: normalizedName,
        pluginId: command.pluginId,
        message: errorMessage,
        isError: true,
      }
    }
  }

  const getRegisteredCommands = (): PluginCommandSummary[] => {
    return Array.from(pluginCommandsByName.values())
      .map((command) => ({
        name: command.name,
        pluginId: command.pluginId,
        description: command.description,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }

  const registerPromptTransformer = (
    transformer: PluginPromptTransformerDefinition,
    options?: { pluginId?: string; order?: number }
  ): (() => void) => {
    const entry: RegisteredPromptTransformer = {
      id: `prompt-transformer-${++promptTransformerCounter}`,
      pluginId: options?.pluginId ?? 'anonymous',
      order: options?.order ?? 100,
      transform: transformer.transform,
    }
    promptTransformers.push(entry)
    promptTransformers.sort((a, b) => a.order - b.order)

    return () => {
      const index = promptTransformers.findIndex((candidate) => candidate.id === entry.id)
      if (index >= 0) {
        promptTransformers.splice(index, 1)
      }
    }
  }

  const applyPromptTransforms = async (
    context: PluginPromptTransformContext
  ): Promise<PluginPromptTransformApplyResult> => {
    if (promptTransformers.length === 0) {
      return {
        prompt: context.prompt,
        transformed: false,
        canceled: false,
        errorMessage: null,
      }
    }

    let currentPrompt = context.prompt
    let transformed = false

    for (const transformer of promptTransformers) {
      try {
        const output = await transformer.transform({
          ...context,
          prompt: currentPrompt,
        })
        const normalizedOutput = normalizePromptTransformOutput(output)
        if (typeof normalizedOutput.nextPrompt === 'string') {
          if (normalizedOutput.nextPrompt !== currentPrompt) {
            transformed = true
          }
          currentPrompt = normalizedOutput.nextPrompt
        }
        if (normalizedOutput.cancel) {
          return {
            prompt: currentPrompt,
            transformed,
            canceled: true,
            errorMessage: normalizedOutput.errorMessage
              ?? `Prompt canceled by plugin ${transformer.pluginId}`,
          }
        }
      } catch (err) {
        logRendererEvent('warn', 'plugin.prompt_transform.failed', {
          pluginId: transformer.pluginId,
          transformerId: transformer.id,
          error: toErrorMessage(err),
        })
      }
    }

    return {
      prompt: currentPrompt,
      transformed,
      canceled: false,
      errorMessage: null,
    }
  }

  return {
    registerHook,
    registerHookFromDefinition,
    emitHook,
    registerCommand,
    invokeCommand,
    getRegisteredCommands,
    registerPromptTransformer,
    applyPromptTransforms,
    getPromptTransformerCount: () => promptTransformers.length,
    getHookRegistrationSummary: () => {
      return PLUGIN_HOOK_EVENTS.map((event) => `${event}:${hooksByEvent[event].length}`)
    },
  }
}

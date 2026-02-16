import type {
  ClaudeProfilesConfig,
  PluginHookEvent,
  PluginHookEventPayloadMap,
  PluginHookHandler,
} from '../../types'

export type { ClaudeProfilesConfig, PluginHookEvent, PluginHookEventPayloadMap, PluginHookHandler }

export const PLUGIN_HOOK_EVENTS: PluginHookEvent[] = [
  'before_agent_start',
  'agent_end',
  'session_start',
  'session_end',
  'message_received',
  'message_sending',
  'message_sent',
  'before_tool_call',
  'after_tool_call',
  'tool_result_persist',
]

export interface RegisteredHook<E extends PluginHookEvent = PluginHookEvent> {
  id: string
  event: E
  pluginId: string
  order: number
  handler: PluginHookHandler<E>
}

export interface RegisteredPluginCommand {
  id: string
  name: string
  pluginId: string
  description: string | null
  execute: PluginCommandDefinition['execute']
}

export interface RegisteredPromptTransformer {
  id: string
  pluginId: string
  order: number
  transform: PluginPromptTransformerDefinition['transform']
}

export type HooksByEvent = {
  [E in PluginHookEvent]: RegisteredHook<E>[]
}

export type PluginLoadState = 'loaded' | 'failed' | 'skipped'

export interface RawDiscoveredPlugin {
  id: string
  name: string
  version: string
  description: string | null
  rootDir: string
  manifestPath: string
  source: 'agent-observer.plugin.json' | 'openclaw.plugin.json' | 'package.json'
  rendererEntry: string | null
}

export interface RuntimeDiscoveredPlugin extends RawDiscoveredPlugin {
  loadState: PluginLoadState
  loadError: string | null
}

export interface PluginCommandContext {
  chatSessionId: string
  workspaceDirectory: string | null
  agentId: string | null
  rawMessage: string
  argsRaw: string
  args: string[]
  attachmentNames: string[]
  mentionPaths: string[]
}

export interface PluginCommandDefinition {
  name: string
  description?: string
  execute: (
    context: PluginCommandContext
  ) =>
    | void
    | string
    | { message?: string; isError?: boolean; error?: string }
    | Promise<void | string | { message?: string; isError?: boolean; error?: string }>
}

export interface PluginCommandSummary {
  name: string
  pluginId: string
  description: string | null
}

export interface PluginCommandExecutionResult {
  handled: boolean
  commandName: string
  pluginId: string | null
  message: string | null
  isError: boolean
}

export interface PluginPromptTransformContext {
  chatSessionId: string
  workspaceDirectory: string | null
  agentId: string | null
  rawMessage: string
  prompt: string
  mentionCount: number
  attachmentCount: number
}

export interface PluginPromptTransformerDefinition {
  transform: (
    context: PluginPromptTransformContext
  ) =>
    | void
    | string
    | { prompt?: string; cancel?: boolean; error?: string }
    | Promise<void | string | { prompt?: string; cancel?: boolean; error?: string }>
}

export interface PluginPromptTransformApplyResult {
  prompt: string
  transformed: boolean
  canceled: boolean
  errorMessage: string | null
}

export interface PluginHookDefinition<E extends PluginHookEvent = PluginHookEvent> {
  event: E
  handler: PluginHookHandler<E>
  order?: number
}

export interface PluginCatalogSnapshot {
  directories: string[]
  plugins: RuntimeDiscoveredPlugin[]
  commands: PluginCommandSummary[]
  warnings: string[]
  syncedAt: number
}

export interface LoadedPluginInstance {
  entryPath: string
  dispose: () => void
}

export interface PluginModule {
  default?: unknown
  register?: unknown
}

export interface RendererPluginApi {
  registerHook: <E extends PluginHookEvent>(
    event: E | PluginHookDefinition<E>,
    handler?: PluginHookHandler<E>,
    options?: { order?: number }
  ) => () => void
  on: <E extends PluginHookEvent>(
    event: E,
    handler: PluginHookHandler<E>,
    options?: { order?: number }
  ) => () => void
  registerCommand: (
    command: PluginCommandDefinition
  ) => () => void
  registerPromptTransformer: (
    transformer: PluginPromptTransformerDefinition,
    options?: { order?: number }
  ) => () => void
  log: (level: 'info' | 'warn' | 'error', event: string, payload?: Record<string, unknown>) => void
  plugin: RawDiscoveredPlugin
}

export type RegisterPluginFunction = (api: RendererPluginApi) => unknown | Promise<unknown>

export interface PluginDiscoveryResult {
  normalizedDirs: string[]
  scannedDirectories: string[]
  plugins: RawDiscoveredPlugin[]
  warnings: string[]
  homeDir: string
  signature: string
}

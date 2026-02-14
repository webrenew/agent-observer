import type {
  PluginHookEvent,
  PluginHookEventPayloadMap,
  PluginHookHandler,
} from '../types'
import { logRendererEvent } from '../lib/diagnostics'
import { registerDiagnosticsHooks } from './builtins/diagnosticsHooks'

interface RegisteredHook<E extends PluginHookEvent = PluginHookEvent> {
  id: string
  event: E
  pluginId: string
  order: number
  handler: PluginHookHandler<E>
}

type HooksByEvent = {
  [E in PluginHookEvent]: RegisteredHook<E>[]
}

const hooksByEvent: HooksByEvent = {
  session_start: [],
  session_end: [],
  message_received: [],
  message_sent: [],
  before_tool_call: [],
  after_tool_call: [],
}
let hookCounter = 0
let runtimeInitialized = false

function getHooksForEvent<E extends PluginHookEvent>(event: E): RegisteredHook<E>[] {
  return hooksByEvent[event]
}

export function registerPluginHook<E extends PluginHookEvent>(
  event: E,
  handler: PluginHookHandler<E>,
  options?: { pluginId?: string; order?: number }
): () => void {
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

export async function emitPluginHook<E extends PluginHookEvent>(
  event: E,
  payload: PluginHookEventPayloadMap[E]
): Promise<void> {
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
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

export function initializePluginRuntime(): void {
  if (runtimeInitialized) return
  runtimeInitialized = true

  registerDiagnosticsHooks(registerPluginHook)
  logRendererEvent('info', 'plugin.runtime.initialized', {
    registeredEvents: Object.entries(hooksByEvent).map(([event, hooks]) => `${event}:${hooks.length}`),
  })
}

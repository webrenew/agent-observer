import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { createInterface, Interface as ReadlineInterface } from 'readline'
import path from 'path'
import fs from 'fs'

// ── Types (mirrored from renderer, kept lightweight for main process) ──

interface ClaudeSessionOptions {
  prompt: string
  model?: string
  systemPrompt?: string
  allowedTools?: string[]
  workingDirectory?: string
}

interface ClaudeEvent {
  sessionId: string
  type: string
  data: Record<string, unknown>
}

interface ActiveSession {
  process: ChildProcess
  readline: ReadlineInterface
  sessionId: string
}

// ── State ──────────────────────────────────────────────────────────────

const activeSessions = new Map<string, ActiveSession>()
let sessionCounter = 0

// ── Helpers ────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `chat-${++sessionCounter}-${Date.now()}`
}

function emitEvent(win: BrowserWindow, event: ClaudeEvent): void {
  if (!win.isDestroyed()) {
    win.webContents.send('claude:event', event)
  }
}

/**
 * Parse a single JSONL line from the Claude CLI stream-json output.
 * Returns a simplified ClaudeEvent.data or null if unparseable.
 */
function parseStreamLine(
  sessionId: string,
  line: string
): ClaudeEvent | null {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>

    // system.init event
    if (obj.type === 'system' && obj.subtype === 'init') {
      return {
        sessionId,
        type: 'init',
        data: { session_id: (obj.session_id as string) ?? sessionId },
      }
    }

    // result event (final)
    if (obj.type === 'result') {
      return {
        sessionId,
        type: 'result',
        data: {
          result: (obj.result as string) ?? '',
          is_error: obj.is_error as boolean | undefined,
          error: obj.error as string | undefined,
          usage: obj.usage as Record<string, unknown> | undefined,
          session_id: (obj.session_id as string) ?? sessionId,
        },
      }
    }

    // assistant / user message with content blocks
    if (obj.type === 'assistant' || obj.type === 'user') {
      const message = (obj.message ?? obj) as Record<string, unknown>
      const contentBlocks = (message.content ?? []) as Array<Record<string, unknown>>

      // Return the last meaningful content block as an event
      for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
          return {
            sessionId,
            type: 'tool_use',
            data: {
              id: block.id as string,
              name: block.name as string,
              input: (block.input ?? {}) as Record<string, unknown>,
            },
          }
        }

        if (block.type === 'tool_result') {
          const content = typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content ?? '')
          return {
            sessionId,
            type: 'tool_result',
            data: {
              tool_use_id: block.tool_use_id as string,
              content,
              is_error: block.is_error as boolean | undefined,
            },
          }
        }

        if (block.type === 'thinking') {
          return {
            sessionId,
            type: 'thinking',
            data: { thinking: (block.thinking as string) ?? '' },
          }
        }

        if (block.type === 'text') {
          return {
            sessionId,
            type: 'text',
            data: { text: (block.text as string) ?? '' },
          }
        }
      }
    }

    // Fallback: if it has a content_block with type info
    if (obj.content_block) {
      const block = obj.content_block as Record<string, unknown>
      if (block.type === 'text') {
        return {
          sessionId,
          type: 'text',
          data: { text: (block.text as string) ?? '' },
        }
      }
    }

    return null
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[claude-session] Failed to parse JSONL line: ${message}`)
    return null
  }
}

// ── Session Management ─────────────────────────────────────────────────

function startSession(
  win: BrowserWindow,
  options: ClaudeSessionOptions
): string {
  const sessionId = generateSessionId()

  const args: string[] = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
  ]

  if (options.model) {
    args.push('--model', options.model)
  }

  if (options.systemPrompt) {
    args.push('--append-system-prompt', options.systemPrompt)
  }

  if (options.allowedTools && options.allowedTools.length > 0) {
    args.push('--allowedTools', ...options.allowedTools)
  }

  // Separator before the prompt
  args.push('--', options.prompt)

  // Validate and resolve working directory
  const home = process.env.HOME ?? process.cwd()
  const rawCwd = options.workingDirectory ?? home
  const cwd = path.resolve(rawCwd)

  // Ensure directory exists to avoid ENOENT on spawn
  try {
    const stat = fs.statSync(cwd)
    if (!stat.isDirectory()) {
      throw new Error(`Working directory is not a directory: ${cwd}`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[claude-session] Invalid working directory: ${message}`)
    throw new Error(`Invalid working directory: ${message}`)
  }

  let proc: ChildProcess
  try {
    proc = spawn('claude', args, {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[claude-session] Failed to spawn claude CLI: ${message}`)
    emitEvent(win, {
      sessionId,
      type: 'error',
      data: { message: `Failed to spawn claude CLI: ${message}` },
    })
    throw new Error(`Failed to spawn claude CLI: ${message}`)
  }

  const rl = createInterface({ input: proc.stdout! })

  const session: ActiveSession = { process: proc, readline: rl, sessionId }
  activeSessions.set(sessionId, session)

  // Parse each JSONL line from stdout
  rl.on('line', (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return

    const event = parseStreamLine(sessionId, trimmed)
    if (event) {
      emitEvent(win, event)
    }
  })

  // Capture stderr for error reporting
  let stderrBuffer = ''
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString()
  })

  proc.on('error', (err: Error) => {
    console.error(`[claude-session] Process error for ${sessionId}: ${err.message}`)
    emitEvent(win, {
      sessionId,
      type: 'error',
      data: { message: `Process error: ${err.message}` },
    })
    activeSessions.delete(sessionId)
  })

  proc.on('exit', (code: number | null, signal: string | null) => {
    rl.close()

    // If we didn't already send a result event, send one now
    if (code !== 0 && stderrBuffer.trim()) {
      emitEvent(win, {
        sessionId,
        type: 'error',
        data: {
          message: `Claude exited with code ${code ?? 'null'} (${signal ?? 'no signal'}): ${stderrBuffer.trim().slice(0, 500)}`,
        },
      })
    }

    // Always send a result event so the UI knows the session ended
    emitEvent(win, {
      sessionId,
      type: 'result',
      data: {
        result: '',
        is_error: code !== 0,
        session_id: sessionId,
      },
    })

    activeSessions.delete(sessionId)
  })

  return sessionId
}

function stopSession(sessionId: string): void {
  const session = activeSessions.get(sessionId)
  if (!session) return

  // Force kill after 5s if SIGTERM doesn't work
  const forceKillTimer = setTimeout(() => {
    try {
      session.process.kill('SIGKILL')
    } catch {
      // Process already dead — expected
    }
  }, 5000)

  // Register exit handler BEFORE sending kill signal to avoid race
  session.process.once('exit', () => {
    clearTimeout(forceKillTimer)
  })

  try {
    session.readline.close()
    session.process.kill('SIGTERM')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[claude-session] Failed to stop session ${sessionId}: ${message}`)
    clearTimeout(forceKillTimer)
  }

  activeSessions.delete(sessionId)
}

// ── IPC Setup ──────────────────────────────────────────────────────────

let handlersRegistered = false

export function setupClaudeSessionHandlers(mainWindow: BrowserWindow): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('claude:start', (_event, options: unknown) => {
    // Validate input shape
    if (!options || typeof options !== 'object') {
      throw new Error('claude:start requires an options object')
    }
    const opts = options as Record<string, unknown>
    if (typeof opts.prompt !== 'string' || !opts.prompt.trim()) {
      throw new Error('claude:start requires a non-empty prompt string')
    }
    const validated: ClaudeSessionOptions = {
      prompt: opts.prompt,
      model: typeof opts.model === 'string' ? opts.model : undefined,
      systemPrompt: typeof opts.systemPrompt === 'string' ? opts.systemPrompt : undefined,
      allowedTools: Array.isArray(opts.allowedTools) ? opts.allowedTools.filter((t): t is string => typeof t === 'string') : undefined,
      workingDirectory: typeof opts.workingDirectory === 'string' ? opts.workingDirectory : undefined,
    }
    const sessionId = startSession(mainWindow, validated)
    return { sessionId }
  })

  ipcMain.handle('claude:stop', (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') {
      throw new Error('claude:stop requires a sessionId string')
    }
    stopSession(sessionId)
  })
}

export function cleanupClaudeSessions(): void {
  for (const [id] of activeSessions) {
    stopSession(id)
  }
}

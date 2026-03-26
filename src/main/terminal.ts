import { ipcMain, BrowserWindow } from 'electron'
import os from 'os'
import { getSettings, isValidShell, isValidDirectory } from './settings'

// node-pty is a native module — require at runtime to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty = require('node-pty')

/** Detected agent kind — null means no agent is running */
type AgentKind = 'claude' | 'codex' | null

interface PtySession {
  pty: ReturnType<typeof pty.spawn>
  pollTimer: ReturnType<typeof setInterval> | null
  wasAgentRunning: boolean
  detectedAgentKind: AgentKind
  outputDetectedKind: AgentKind
}

const sessions = new Map<string, PtySession>()
let idCounter = 0
let mainWindow: BrowserWindow | null = null
let handlersRegistered = false

// Process name patterns for detecting AI coding agents
const AGENT_PROCESS_PATTERNS: Array<{ kind: NonNullable<AgentKind>; re: RegExp }> = [
  { kind: 'claude', re: /\bclaude\b/i },
  { kind: 'codex', re: /\bcodex\b/i },
]

// Output-based detection patterns, keyed by agent kind
const AGENT_OUTPUT_PATTERNS: Array<{ kind: NonNullable<AgentKind>; patterns: RegExp[] }> = [
  {
    kind: 'claude',
    patterns: [
      /claude(?:\s+code)?.*v?\d+\.\d+/i,        // version banner
      /╭─+╮/,                                     // box-drawing TUI border
      /\bTips:/,                                   // tips section
      /\bType \/help/i,                            // help hint
      /\bclaude>\s*$/m,                            // prompt
      /\bHuman:\s*$/m,                             // REPL prompt variant
      /\bClaude Code\b/i,                          // product name in output
    ],
  },
  {
    kind: 'codex',
    patterns: [
      /\bcodex\b.*v?\d+\.\d+/i,                   // version banner
      /\bOpenAI Codex\b/i,                         // product name
      /\bcodex>\s*$/m,                             // prompt
    ],
  },
]

function getDefaultShell(): string {
  if (process.platform === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/zsh'
}

function sendToMainWindow(channel: string, ...args: unknown[]): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, ...args)
}

export function setupTerminalHandlers(window: BrowserWindow): void {
  mainWindow = window

  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('terminal:create', (_event, options?: { cols?: number; rows?: number; cwd?: string }) => {
    const id = `term-${++idCounter}`
    const settings = getSettings()

    const customShell = settings.general.customShell
    const shell = settings.general.shell === 'custom' && customShell && isValidShell(customShell)
      ? customShell
      : getDefaultShell()

    const customDir = settings.general.customDirectory
    const settingsCwd = settings.general.startingDirectory === 'custom' && customDir && isValidDirectory(customDir)
      ? customDir
      : os.homedir()
    const requestedCwd = options?.cwd
    const cwd = requestedCwd && isValidDirectory(requestedCwd)
      ? requestedCwd
      : settingsCwd

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options?.cols ?? 80,
      rows: options?.rows ?? 24,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' }
    })

    const session: PtySession = {
      pty: ptyProcess,
      pollTimer: null,
      wasAgentRunning: false,
      detectedAgentKind: null,
      outputDetectedKind: null
    }

    // Rolling buffer for output-based detection
    let outputBuffer = ''
    const OUTPUT_BUFFER_MAX = 2000

    // Forward data from PTY to renderer + scan for Claude patterns
    ptyProcess.onData((data: string) => {
      sendToMainWindow('terminal:data', id, data)

      // Output-based agent detection (supplements process name polling)
      if (!session.outputDetectedKind) {
        outputBuffer += data
        if (outputBuffer.length > OUTPUT_BUFFER_MAX) {
          outputBuffer = outputBuffer.slice(-OUTPUT_BUFFER_MAX)
        }

        for (const { kind, patterns } of AGENT_OUTPUT_PATTERNS) {
          if (patterns.some((re) => re.test(outputBuffer))) {
            session.outputDetectedKind = kind
            outputBuffer = '' // free memory

            if (!session.wasAgentRunning) {
              session.wasAgentRunning = true
              session.detectedAgentKind = kind
              sendToMainWindow('terminal:claude-status', id, true, kind)
            }
            break
          }
        }
      }
    })

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      sendToMainWindow('terminal:exit', id, exitCode, signal)
      if (session.pollTimer) clearInterval(session.pollTimer)
      sessions.delete(id)
    })

    // Poll foreground process name every 1s
    session.pollTimer = setInterval(() => {
      const s = sessions.get(id)
      if (!s) return

      try {
        const processName: string = s.pty.process

        // Check process name against all known agent patterns
        let processKind: AgentKind = null
        for (const { kind, re } of AGENT_PROCESS_PATTERNS) {
          if (re.test(processName)) {
            processKind = kind
            break
          }
        }

        // Combine: process name OR output detection
        const agentKind = processKind ?? s.outputDetectedKind
        const isAgentRunning = agentKind !== null

        if (isAgentRunning !== s.wasAgentRunning) {
          s.wasAgentRunning = isAgentRunning
          s.detectedAgentKind = agentKind

          // When agent exits, reset output detection for next run
          if (!isAgentRunning) {
            s.outputDetectedKind = null
            outputBuffer = ''
          }

          sendToMainWindow('terminal:claude-status', id, isAgentRunning, agentKind)
        }
      } catch {
        // Process may have exited between check — ignore
      }
    }, 1000)

    sessions.set(id, session)

    return { id, cwd }
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    sessions.get(id)?.pty.write(data)
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    try {
      sessions.get(id)?.pty.resize(cols, rows)
    } catch {
      // Resize can throw if process already exited
    }
  })

  ipcMain.handle('terminal:kill', (_event, id: string) => {
    const session = sessions.get(id)
    if (!session) return
    if (session.pollTimer) clearInterval(session.pollTimer)
    try {
      session.pty.kill()
    } catch {
      // Already dead
    }
    sessions.delete(id)
  })
}

export function cleanupTerminals(): void {
  for (const [id, session] of sessions) {
    if (session.pollTimer) clearInterval(session.pollTimer)
    try {
      session.pty.kill()
    } catch {
      // ignore
    }
    sessions.delete(id)
  }
}

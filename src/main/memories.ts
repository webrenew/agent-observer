import { ipcMain } from 'electron'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'path'
import fs from 'fs'
import os from 'os'

// ── Types ──────────────────────────────────────────────────────────────

interface MemoryEntry {
  id: string
  content: string
  type: string
  tags: string[]
  category: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface AddChatMessageOptions {
  content: string
  role: string
  scopeId: string
  scopeName: string
  workspacePath: string
}

interface ChatHistoryEntry {
  id: string
  content: string
  role: string
  timestamp: string
  category: string
}

// ── State ──────────────────────────────────────────────────────────────

let mcpClient: Client | null = null
let transport: StdioClientTransport | null = null
let isConnected = false
let handlersRegistered = false

// ── Binary Resolution ──────────────────────────────────────────────────

function resolveMemoriesBinary(): string | null {
  const home = os.homedir()

  // Check bundled in Electron resources (packaged app)
  const resourcesPath = process.resourcesPath
  if (resourcesPath) {
    const bundled = path.join(resourcesPath, 'node_modules', '@memories.sh', 'cli', 'dist', 'index.js')
    if (fs.existsSync(bundled)) {
      console.log(`[memories] Found bundled memories at: ${bundled}`)
      return bundled
    }
  }

  // Check local node_modules (dev mode)
  const localBin = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'memories')
  if (fs.existsSync(localBin)) {
    console.log(`[memories] Found local memories binary at: ${localBin}`)
    return localBin
  }

  // Check node_modules dist directly (dev mode fallback)
  const localDist = path.join(__dirname, '..', '..', 'node_modules', '@memories.sh', 'cli', 'dist', 'index.js')
  if (fs.existsSync(localDist)) {
    console.log(`[memories] Found local memories dist at: ${localDist}`)
    return localDist
  }

  // Common global install locations
  const candidates = [
    path.join(home, '.local', 'bin', 'memories'),
    path.join(home, '.bun', 'bin', 'memories'),
    path.join(home, '.npm-global', 'bin', 'memories'),
    path.join(home, 'bin', 'memories'),
    '/usr/local/bin/memories',
    '/opt/homebrew/bin/memories',
  ]

  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      console.log(`[memories] Found memories binary at: ${candidate}`)
      return candidate
    } catch {
      // Not found — continue
    }
  }

  console.warn('[memories] Could not find memories binary — chat persistence disabled')
  return null
}

// ── MCP Client Lifecycle ───────────────────────────────────────────────

function getDataDir(): string {
  const dir = path.join(os.homedir(), '.agent-observer', 'memories')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function startMcpServer(): Promise<void> {
  const binaryPath = resolveMemoriesBinary()
  if (!binaryPath) return

  const dataDir = getDataDir()

  // Determine if it's a .js file (needs node) or a binary
  const isJsFile = binaryPath.endsWith('.js')
  const command = isJsFile ? process.execPath ?? 'node' : binaryPath
  const args = isJsFile ? [binaryPath, 'serve'] : ['serve']

  const enhancedEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      enhancedEnv[key] = value
    }
  }
  enhancedEnv['MEMORIES_DATA_DIR'] = dataDir

  try {
    transport = new StdioClientTransport({
      command,
      args,
      env: enhancedEnv,
      stderr: 'pipe',
    })

    mcpClient = new Client({
      name: 'agent-observer',
      version: '1.0.0',
    })

    await mcpClient.connect(transport)
    isConnected = true
    console.log(`[memories] MCP server started (data: ${dataDir})`)

    // Log stderr for debugging
    const stderrStream = transport.stderr
    if (stderrStream) {
      stderrStream.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim()
        if (text) console.log(`[memories:stderr] ${text}`)
      })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[memories] Failed to start MCP server: ${message}`)
    isConnected = false
    mcpClient = null
    transport = null
  }
}

async function stopMcpServer(): Promise<void> {
  if (mcpClient) {
    try {
      await mcpClient.close()
    } catch {
      // Ignore close errors
    }
  }
  mcpClient = null
  transport = null
  isConnected = false
  console.log('[memories] MCP server stopped')
}

// ── MCP Tool Helpers ───────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!mcpClient || !isConnected) {
    throw new Error('Memories MCP server not connected')
  }
  const result = await mcpClient.callTool({ name, arguments: args })
  // Extract text content from MCP response
  if (result.content && Array.isArray(result.content)) {
    const textBlock = result.content.find(
      (c: Record<string, unknown>) => c.type === 'text'
    ) as { text: string } | undefined
    if (textBlock?.text) {
      try {
        return JSON.parse(textBlock.text)
      } catch {
        return textBlock.text
      }
    }
  }
  return result
}

// ── IPC Handlers ───────────────────────────────────────────────────────

export function setupMemoriesHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  // Start MCP server in background
  startMcpServer().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[memories] Background start failed: ${message}`)
  })

  ipcMain.handle('memories:isReady', () => {
    return isConnected
  })

  ipcMain.handle(
    'memories:addChatMessage',
    async (_event, options: unknown) => {
      if (!isConnected) return

      const opts = options as AddChatMessageOptions
      if (!opts.content || !opts.role) return

      const timestamp = new Date().toISOString()

      try {
        await callTool('add_memory', {
          content: opts.content,
          type: 'note',
          category: opts.scopeName || 'default',
          tags: ['chat', opts.scopeId || 'default'],
          metadata: {
            workspacePath: opts.workspacePath || '',
            timestamp,
            role: opts.role,
          },
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[memories] Failed to add chat message: ${message}`)
      }
    }
  )

  ipcMain.handle(
    'memories:getChatHistory',
    async (_event, scopeId: unknown, limit?: unknown) => {
      if (!isConnected) return []

      const tag = typeof scopeId === 'string' ? scopeId : 'default'
      const maxResults = typeof limit === 'number' ? limit : 50

      try {
        const result = await callTool('list_memories', {
          tags: ['chat', tag],
          types: ['note'],
          limit: maxResults,
        })

        if (!Array.isArray(result)) return []

        return (result as MemoryEntry[])
          .filter((m) => m.metadata && typeof m.metadata === 'object')
          .map((m): ChatHistoryEntry => ({
            id: m.id,
            content: m.content,
            role: (m.metadata?.role as string) ?? 'user',
            timestamp: (m.metadata?.timestamp as string) ?? m.createdAt,
            category: m.category ?? 'default',
          }))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[memories] Failed to get chat history: ${message}`)
        return []
      }
    }
  )
}

export async function cleanupMemories(): Promise<void> {
  await stopMcpServer()
}

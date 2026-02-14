import { app, BrowserWindow, shell, ipcMain } from 'electron'
import path from 'path'
import { setupTerminalHandlers, cleanupTerminals } from './terminal'
import { setupSettingsHandlers, createApplicationMenu } from './settings'
import { setupClaudeSessionHandlers, cleanupClaudeSessions } from './claude-session'
import { setupFilesystemHandlers } from './filesystem'
import { setupLspHandlers, cleanupLspServers } from './lsp-manager'
import { setupMemoriesHandlers, cleanupMemories } from './memories'
import { setupAgentNamerHandlers } from './agent-namer'

// Strip Claude session env vars so embedded terminals can launch Claude Code
for (const key of Object.keys(process.env)) {
  if (key.startsWith('CLAUDE')) delete process.env[key]
}

// Track popped-out chat windows: sessionId → BrowserWindow
const chatWindows = new Map<string, BrowserWindow>()

function createChatWindow(sessionId: string, mainWindow: BrowserWindow): BrowserWindow {
  const chatWin = new BrowserWindow({
    width: 600,
    height: 700,
    minWidth: 400,
    minHeight: 400,
    title: 'Chat — Agent Office',
    backgroundColor: '#0E0E0D',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  chatWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    // Dev: Vite dev server — load chat-window.html with query param
    const baseUrl = process.env['ELECTRON_RENDERER_URL']
    chatWin.loadURL(`${baseUrl}/chat-window.html?sessionId=${encodeURIComponent(sessionId)}`)
  } else {
    // Production: load from built files
    chatWin.loadFile(
      path.join(__dirname, '../renderer/chat-window.html'),
      { search: `sessionId=${encodeURIComponent(sessionId)}` }
    )
  }

  chatWindows.set(sessionId, chatWin)

  chatWin.on('closed', () => {
    chatWindows.delete(sessionId)
    // Notify main window the session was returned
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:returned', sessionId)
    }
  })

  return chatWin
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null
  let chatPopoutHandlerRegistered = false

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  function setupChatPopoutHandler(): void {
    if (chatPopoutHandlerRegistered) return
    chatPopoutHandlerRegistered = true

    ipcMain.handle('chat:popout', (_event, sessionId: unknown) => {
      if (typeof sessionId !== 'string' || !mainWindow) return
      // Don't create duplicate windows
      if (chatWindows.has(sessionId)) {
        chatWindows.get(sessionId)?.focus()
        return
      }
      createChatWindow(sessionId, mainWindow)
    })
  }

  function createWindow(): void {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      title: 'Agent Office',
      backgroundColor: '#1a1a2e',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    setupTerminalHandlers(mainWindow)
    setupClaudeSessionHandlers(mainWindow)
    setupSettingsHandlers()
    setupFilesystemHandlers(mainWindow)
    setupLspHandlers(mainWindow)
    setupMemoriesHandlers()
    setupAgentNamerHandlers(mainWindow)
    createApplicationMenu(mainWindow)
    setupChatPopoutHandler()

    if (process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }
  }

  app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('before-quit', () => {
    // Close all popped-out chat windows first
    for (const [, win] of chatWindows) {
      if (!win.isDestroyed()) win.close()
    }
    chatWindows.clear()

    cleanupTerminals()
    cleanupClaudeSessions()
    cleanupLspServers()
    cleanupMemories().catch(() => {})
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

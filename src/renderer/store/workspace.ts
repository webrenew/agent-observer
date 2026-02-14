/**
 * Workspace store — tracks the currently opened folder and recent folders.
 *
 * All file-related panels (Explorer, Search, Editor) read from this store
 * to know which directory to operate in.
 */

import { create } from 'zustand'
import { useAgentStore } from './agents'

const MAX_RECENT = 10
const RECENT_KEY = 'agent-space:recentFolders'

interface WorkspaceStore {
  /** Currently open folder path, or null if none */
  rootPath: string | null

  /** Recently opened folders (most recent first) */
  recentFolders: string[]

  /** Open a folder — sets rootPath and adds to recent list */
  openFolder: (path: string) => void

  /** Close the current folder */
  closeFolder: () => void

  /** Remove a path from the recent list */
  removeRecent: (path: string) => void

  /** Clear all recent folders */
  clearRecent: () => void
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

function saveRecent(folders: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(folders.slice(0, MAX_RECENT)))
  } catch (err) {
    console.error('[workspace] Failed to save recent folders:', err)
  }
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  rootPath: null,
  recentFolders: loadRecent(),

  openFolder: (path: string) => {
    const { recentFolders } = get()
    const updated = [path, ...recentFolders.filter((f) => f !== path)].slice(0, MAX_RECENT)
    saveRecent(updated)
    set({ rootPath: path, recentFolders: updated })

    // Keep chat sessions scoped to workspace before the first message,
    // unless the user explicitly chose a custom directory for that chat.
    const { chatSessions, updateChatSession } = useAgentStore.getState()
    for (const session of chatSessions) {
      if (session.agentId) continue
      if (session.directoryMode === 'custom') continue
      if (session.workingDirectory === path && session.directoryMode === 'workspace') continue
      updateChatSession(session.id, {
        workingDirectory: path,
        directoryMode: 'workspace',
      })
    }
  },

  closeFolder: () => {
    set({ rootPath: null })

    const { chatSessions, updateChatSession } = useAgentStore.getState()
    for (const session of chatSessions) {
      if (session.agentId) continue
      if (session.directoryMode === 'custom') continue
      if (session.workingDirectory === null) continue
      updateChatSession(session.id, { workingDirectory: null })
    }
  },

  removeRecent: (path: string) => {
    const { recentFolders } = get()
    const updated = recentFolders.filter((f) => f !== path)
    saveRecent(updated)
    set({ recentFolders: updated })
  },

  clearRecent: () => {
    saveRecent([])
    set({ recentFolders: [] })
  },
}))

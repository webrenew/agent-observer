import type { PluginCatalogSnapshot, PluginCommandSummary } from './contracts'

function createInitialSnapshot(): PluginCatalogSnapshot {
  return {
    directories: [],
    plugins: [],
    commands: [],
    warnings: [],
    syncedAt: 0,
  }
}

export interface PluginCatalogStore {
  getSnapshot: () => PluginCatalogSnapshot
  subscribe: (listener: () => void) => () => void
  updateSnapshot: (next: PluginCatalogSnapshot) => void
  updateCommands: (commands: PluginCommandSummary[]) => void
  matchesSignature: (signature: string) => boolean
  setSignature: (signature: string) => void
}

export function createPluginCatalogStore(): PluginCatalogStore {
  const listeners = new Set<() => void>()
  let snapshot = createInitialSnapshot()
  let lastSignature = ''

  const updateSnapshot = (next: PluginCatalogSnapshot): void => {
    snapshot = next
    for (const listener of listeners) {
      try {
        listener()
      } catch (err) {
        console.error('[plugins] listener failure:', err)
      }
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    updateSnapshot,
    updateCommands: (commands) => {
      if (snapshot.syncedAt === 0) return
      updateSnapshot({
        ...snapshot,
        commands,
        syncedAt: Date.now(),
      })
    },
    matchesSignature: (signature) => signature === lastSignature,
    setSignature: (signature) => {
      lastSignature = signature
    },
  }
}

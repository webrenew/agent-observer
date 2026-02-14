import {
  useState,
  useCallback,
  useRef,
  useEffect,
  Fragment,
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { RowDivider } from './RowDivider'
import { ColDivider } from './ColDivider'
import {
  type PanelId,
  type Layout,
  type DropZone,
  ALL_PANELS,
  PANEL_LABELS,
  PANEL_MIN_HEIGHT,
  DEFAULT_LAYOUT,
  getDropZone,
  deepCloneLayout,
  removePanelFromLayout,
  insertPanelAtDropZone,
  clampDropZone,
  findAllPanelsInLayout,
} from './layout-engine'
import { ChatPanelWrapper } from './panels/ChatPanelWrapper'
import { TerminalPanelWrapper } from './panels/TerminalPanelWrapper'
import { useAgentStore } from '../../store/agents'
import { useSettingsStore } from '../../store/settings'
import { useWorkspaceStore } from '../../store/workspace'
import {
  useHotkeys,
  type HotkeyBinding,
  SHORTCUTS,
  PANEL_SHORTCUT_ORDER,
  formatShortcut,
} from '../../hooks/useHotkeys'

/** Shortcut label per panel, e.g. "⌘1" */
const PANEL_SHORTCUT_LABELS: Partial<Record<PanelId, string>> = {
  ...Object.fromEntries(
    PANEL_SHORTCUT_ORDER.map((id, idx) => [id, formatShortcut({ key: String(idx + 1), metaOrCtrl: true })])
  ),
  fileSearch: SHORTCUTS.fileSearch.label,
  fileExplorer: SHORTCUTS.fileExplorer.label,
}
const WORKSPACE_LAYOUT_STATE_KEY = 'agent-observer:workspaceLayoutState'

// ── File open dispatcher ─────────────────────────────────────────────

function dispatchFileOpen(filePath: string): void {
  window.dispatchEvent(new CustomEvent('file:open', { detail: filePath }))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPanelId(value: unknown): value is PanelId {
  return typeof value === 'string' && ALL_PANELS.includes(value as PanelId)
}

function normalizePanelSlot(value: unknown): PanelId | PanelId[] | null {
  if (isPanelId(value)) return value
  if (!Array.isArray(value)) return null

  const normalized = Array.from(new Set(value.filter(isPanelId)))
  if (normalized.length === 0) return null
  return normalized.length === 1 ? normalized[0] : normalized
}

function normalizeLayout(value: unknown): Layout | null {
  if (!Array.isArray(value)) return null

  const columns: Layout = []
  for (const col of value) {
    if (!isObject(col) || !Array.isArray(col.rows)) continue

    const rows = []
    for (const row of col.rows) {
      if (!isObject(row) || !Array.isArray(row.slots)) continue
      const slots = row.slots
        .map(normalizePanelSlot)
        .filter((slot): slot is PanelId | PanelId[] => slot !== null)

      if (slots.length === 0) continue

      let slotWidths = Array.isArray(row.slotWidths)
        ? row.slotWidths
          .map((w) => (typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 0))
          .slice(0, slots.length)
        : []

      if (slotWidths.length !== slots.length || slotWidths.some((w) => w <= 0)) {
        slotWidths = Array.from({ length: slots.length }, () => 1 / slots.length)
      } else {
        const total = slotWidths.reduce((sum, width) => sum + width, 0)
        slotWidths = total > 0
          ? slotWidths.map((width) => width / total)
          : Array.from({ length: slots.length }, () => 1 / slots.length)
      }

      const rawHeight = typeof row.height === 'number' && Number.isFinite(row.height) ? row.height : -1
      const height = rawHeight === -1 ? -1 : Math.max(PANEL_MIN_HEIGHT, rawHeight)
      rows.push({ slots, slotWidths, height })
    }

    if (rows.length === 0) continue
    const width = typeof col.width === 'number' && Number.isFinite(col.width) && col.width > 0 ? col.width : 1
    columns.push({ width, rows })
  }

  if (columns.length === 0) return null
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0)
  if (totalWidth <= 0) return null

  return columns.map((col) => ({ ...col, width: col.width / totalWidth }))
}

function normalizeActiveTabs(value: unknown): Record<string, PanelId> {
  if (!isObject(value)) return {}
  const activeTabs: Record<string, PanelId> = {}
  for (const [slotKey, panelId] of Object.entries(value)) {
    if (isPanelId(panelId)) {
      activeTabs[slotKey] = panelId
    }
  }
  return activeTabs
}

function ensurePanelVisible(layout: Layout, panelId: PanelId): Layout {
  if (findAllPanelsInLayout(layout).has(panelId)) return layout

  const next = deepCloneLayout(layout)
  if (next.length === 0) {
    return [{ width: 1, rows: [{ slots: [panelId], slotWidths: [1], height: -1 }] }]
  }

  if (panelId === 'fileSearch') {
    for (const col of next) {
      for (const row of col.rows) {
        for (let slotIndex = 0; slotIndex < row.slots.length; slotIndex++) {
          const slot = row.slots[slotIndex]
          if (Array.isArray(slot)) {
            if (slot.includes('fileExplorer')) {
              if (!slot.includes('fileSearch')) slot.push('fileSearch')
              return next
            }
          } else if (slot === 'fileExplorer') {
            row.slots[slotIndex] = ['fileExplorer', 'fileSearch']
            return next
          }
        }
      }
    }
  }

  const firstColumn = next[0]
  if (!firstColumn || firstColumn.rows.length === 0) {
    if (firstColumn) {
      firstColumn.rows.push({ slots: [panelId], slotWidths: [1], height: -1 })
      return next
    }
    return [{ width: 1, rows: [{ slots: [panelId], slotWidths: [1], height: -1 }] }]
  }

  const firstRow = firstColumn.rows[0]
  const firstSlot = firstRow.slots[0]
  if (firstSlot === undefined) {
    firstRow.slots = [panelId]
    firstRow.slotWidths = [1]
    return next
  }

  if (Array.isArray(firstSlot)) {
    if (!firstSlot.includes(panelId)) firstSlot.push(panelId)
  } else if (firstSlot !== panelId) {
    firstRow.slots[0] = [firstSlot, panelId]
  }

  return next
}

function loadPersistedWorkspaceLayoutState(): {
  layout: Layout
  activeTabs: Record<string, PanelId>
} {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_STATE_KEY)
    if (!raw) return { layout: DEFAULT_LAYOUT, activeTabs: {} }
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed)) return { layout: DEFAULT_LAYOUT, activeTabs: {} }

    let layout = normalizeLayout(parsed.layout) ?? DEFAULT_LAYOUT
    layout = ensurePanelVisible(layout, 'fileSearch')

    const activeTabs = normalizeActiveTabs(parsed.activeTabs)
    for (const panelId of new Set(Object.values(activeTabs))) {
      layout = ensurePanelVisible(layout, panelId)
    }

    return { layout, activeTabs }
  } catch {
    return { layout: DEFAULT_LAYOUT, activeTabs: {} }
  }
}

function savePersistedWorkspaceLayoutState(
  layout: Layout,
  activeTabs: Record<string, PanelId>
): void {
  try {
    localStorage.setItem(
      WORKSPACE_LAYOUT_STATE_KEY,
      JSON.stringify({ layout, activeTabs })
    )
  } catch (err) {
    console.error('[WorkspaceLayout] Failed to persist layout state:', err)
  }
}

const hydratedWorkspaceLayoutState = loadPersistedWorkspaceLayoutState()

const LazyScenePanel = lazy(async () => {
  const mod = await import('./panels/ScenePanel')
  return { default: mod.ScenePanel }
})

const LazyActivityPanel = lazy(async () => {
  const mod = await import('./panels/ActivityPanel')
  return { default: mod.ActivityPanel }
})

const LazyAgentsPanel = lazy(async () => {
  const mod = await import('./panels/AgentsPanel')
  return { default: mod.AgentsPanel }
})

const LazyRecentMemoriesPanel = lazy(async () => {
  const mod = await import('./panels/RecentMemoriesPanel')
  return { default: mod.RecentMemoriesPanel }
})

const LazyTokensPanel = lazy(async () => {
  const mod = await import('./panels/TokensPanel')
  return { default: mod.TokensPanel }
})

const LazyFileExplorerPanel = lazy(async () => {
  const mod = await import('./panels/FileExplorerPanel')
  return { default: mod.FileExplorerPanel }
})

const LazyFileSearchPanel = lazy(async () => {
  const mod = await import('./panels/FileSearchPanel')
  return { default: mod.FileSearchPanel }
})

const LazyFileEditorPanel = lazy(async () => {
  const mod = await import('./panels/FileEditorPanel')
  return { default: mod.FileEditorPanel }
})

function FileExplorerWrapper() {
  return <LazyFileExplorerPanel onOpenFile={dispatchFileOpen} />
}

function FileSearchWrapper() {
  return <LazyFileSearchPanel onOpenFile={dispatchFileOpen} />
}

// ── Panel Registry ──────────────────────────────────────────────────

type PanelComponent = ComponentType | LazyExoticComponent<ComponentType>

const PANEL_COMPONENTS: Record<PanelId, PanelComponent> = {
  chat: ChatPanelWrapper,
  terminal: TerminalPanelWrapper,
  tokens: LazyTokensPanel,
  scene3d: LazyScenePanel,
  activity: LazyActivityPanel,
  agents: LazyAgentsPanel,
  recentMemories: LazyRecentMemoriesPanel,
  fileExplorer: FileExplorerWrapper,
  fileSearch: FileSearchWrapper,
  filePreview: LazyFileEditorPanel,
}

function PanelLoading({ panelId }: { panelId: PanelId }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#595653',
        fontSize: 12,
        letterSpacing: 0.5,
      }}
    >
      Loading {PANEL_LABELS[panelId]}...
    </div>
  )
}

function SlotPanelContent({
  panels,
  activePanel,
}: {
  panels: PanelId[]
  activePanel: PanelId
}) {
  const [mountedPanels, setMountedPanels] = useState<PanelId[]>(() => [activePanel])
  const panelsKey = panels.join('|')

  useEffect(() => {
    setMountedPanels((prev) => {
      const allowed = new Set(panels)
      const filtered = prev.filter((pid) => allowed.has(pid))
      return filtered.includes(activePanel) ? filtered : [...filtered, activePanel]
    })
  }, [activePanel, panelsKey])

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      {mountedPanels.map((pid) => {
        const Comp = PANEL_COMPONENTS[pid]
        return (
          <div
            key={pid}
            style={{
              display: pid === activePanel ? 'flex' : 'none',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <Suspense fallback={<PanelLoading panelId={pid} />}>
              <Comp />
            </Suspense>
          </div>
        )
      })}
    </div>
  )
}

// ── Top Nav ─────────────────────────────────────────────────────────

function TopNav({
  visiblePanels,
  onTogglePanel,
  onOpenFolder,
  onFocusFileSearch,
  onFocusFileExplorer,
  onNewTerminal,
  onCloseActivePanel,
  onFocusChatInput,
  onResetLayout,
}: {
  visiblePanels: Set<PanelId>
  onTogglePanel: (id: PanelId) => void
  onOpenFolder: () => void
  onFocusFileSearch: () => void
  onFocusFileExplorer: () => void
  onNewTerminal: () => void
  onCloseActivePanel: () => void
  onFocusChatInput: () => void
  onResetLayout: () => void
}) {
  const agentCount = useAgentStore((s) => s.agents.length)
  const eventCount = useAgentStore((s) => s.events.length)
  const openSettings = useSettingsStore((s) => s.openSettings)
  const openHelp = useSettingsStore((s) => s.openHelp)
  const workspaceRoot = useWorkspaceStore((s) => s.rootPath)
  const recentFolders = useWorkspaceStore((s) => s.recentFolders)
  const openWorkspaceFolder = useWorkspaceStore((s) => s.openFolder)
  const closeWorkspaceFolder = useWorkspaceStore((s) => s.closeFolder)
  const workspaceName = workspaceRoot?.split('/').pop() ?? null
  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const modLabel = isMac ? 'Cmd' : 'Ctrl'
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  )
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'view' | null>(null)
  const menuRootRef = useRef<HTMLDivElement>(null)
  const recentMenuItems = recentFolders.slice(0, 6)

  const closeMenus = useCallback(() => {
    setOpenMenu(null)
  }, [])

  const toggleMenu = useCallback((menu: 'file' | 'edit' | 'view') => {
    setOpenMenu((current) => (current === menu ? null : menu))
  }, [])

  const runMenuAction = useCallback((action: () => void | Promise<void>) => {
    closeMenus()
    try {
      const result = action()
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        void (result as Promise<unknown>).catch((err) => {
          console.error('[TopNav] Menu action failed:', err)
        })
      }
    } catch (err) {
      console.error('[TopNav] Menu action failed:', err)
    }
  }, [closeMenus])

  const runEditCommand = useCallback((command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll') => {
    const active = document.activeElement

    if (command === 'selectAll') {
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        active.focus()
        active.select()
        closeMenus()
        return
      }
      if (active instanceof HTMLElement && active.isContentEditable) {
        const selection = window.getSelection()
        if (selection) {
          const range = document.createRange()
          range.selectNodeContents(active)
          selection.removeAllRanges()
          selection.addRange(range)
          closeMenus()
          return
        }
      }
    }

    try {
      document.execCommand(command)
    } catch (err) {
      console.error(`[TopNav] Edit command "${command}" failed:`, err)
    }

    closeMenus()
  }, [closeMenus])

  useEffect(() => {
    const tick = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }))
    }, 60_000)
    return () => clearInterval(tick)
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRootRef.current && !menuRootRef.current.contains(e.target as Node)) {
        closeMenus()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu, closeMenus])

  useEffect(() => {
    if (!openMenu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenus()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [openMenu, closeMenus])

  return (
    <header
      className="glass-panel"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 36, padding: '0 16px',
        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
        borderBottom: '1px solid rgba(89, 86, 83, 0.2)', flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 16, letterSpacing: 1 }}>&#x2B22;</span>
        {workspaceName && (
          <span style={{ color: '#9A9692', fontSize: 12, fontWeight: 500 }}>{workspaceName}</span>
        )}
        <span style={{ color: '#595653', fontSize: 'inherit' }}>|</span>
        <nav ref={menuRootRef} style={{ display: 'flex', gap: 14, position: 'relative' }}>
          {openMenu && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
              onClick={closeMenus}
            />
          )}

          <div style={{ position: 'relative', zIndex: 9999 }}>
            <span
              className="nav-item"
              onClick={() => toggleMenu('file')}
              style={{ color: '#74747C', fontSize: 'inherit' }}
            >
              File
            </span>
            {openMenu === 'file' && (
              <>
                <div
                  style={{
                    position: 'absolute', top: 30, left: -8, zIndex: 9999,
                    minWidth: 190, padding: '4px 0', borderRadius: 6,
                    background: '#1A1A19', border: '1px solid rgba(89,86,83,0.3)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    onClick={() => runMenuAction(onOpenFolder)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>Open Folder...</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.openFolder.label}
                    </span>
                  </div>

                  {recentMenuItems.length > 0 && (
                    <>
                      <div style={{ height: 1, margin: '4px 6px', background: 'rgba(89,86,83,0.25)' }} />
                      <div style={{ padding: '2px 12px 4px', color: '#595653', fontSize: 10, letterSpacing: 0.6 }}>
                        RECENT
                      </div>
                    </>
                  )}
                  {recentMenuItems.map((folderPath) => (
                    <div
                      key={folderPath}
                      onClick={() => runMenuAction(() => openWorkspaceFolder(folderPath))}
                      className="hover-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                      }}
                      title={folderPath}
                    >
                      <span style={{ color: '#9A9692', flex: 1 }}>
                        {folderPath.split('/').filter(Boolean).pop() ?? folderPath}
                      </span>
                      <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                        recent
                      </span>
                    </div>
                  ))}

                  <div style={{ height: 1, margin: '4px 6px', background: 'rgba(89,86,83,0.25)' }} />
                  <div
                    onClick={() => runMenuAction(onFocusFileSearch)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>Search Files</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.fileSearch.label}
                    </span>
                  </div>
                  <div
                    onClick={() => runMenuAction(onFocusFileExplorer)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>File Explorer</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.fileExplorer.label}
                    </span>
                  </div>
                  <div
                    onClick={() => runMenuAction(onNewTerminal)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>New Terminal</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.newTerminal.label}
                    </span>
                  </div>
                  <div
                    onClick={() => runMenuAction(onCloseActivePanel)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>Close Active Panel</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.closePanel.label}
                    </span>
                  </div>
                  {workspaceRoot && (
                    <div
                      onClick={() => runMenuAction(closeWorkspaceFolder)}
                      className="hover-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      <span style={{ color: '#9A9692', flex: 1 }}>Close Folder</span>
                    </div>
                  )}
                  <div style={{ height: 1, margin: '4px 6px', background: 'rgba(89,86,83,0.25)' }} />
                  <div
                    onClick={() => runMenuAction(openSettings)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>Settings...</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.openSettings.label}
                    </span>
                  </div>
                  <div
                    onClick={() => runMenuAction(openHelp)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>Help</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.openHelp.label}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ position: 'relative', zIndex: 9999 }}>
            <span
              className="nav-item"
              onClick={() => toggleMenu('edit')}
              style={{ color: '#74747C', fontSize: 'inherit' }}
            >
              Edit
            </span>
            {openMenu === 'edit' && (
              <>
                <div
                  style={{
                    position: 'absolute', top: 30, left: -8, zIndex: 9999,
                    minWidth: 190, padding: '4px 0', borderRadius: 6,
                    background: '#1A1A19', border: '1px solid rgba(89,86,83,0.3)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                  }}
                >
                  {[
                    { label: 'Undo', shortcut: `${modLabel}+Z`, cmd: 'undo' as const },
                    { label: 'Redo', shortcut: `${modLabel}+Shift+Z`, cmd: 'redo' as const },
                  ].map((item) => (
                    <div
                      key={item.label}
                      onClick={() => runEditCommand(item.cmd)}
                      className="hover-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      <span style={{ color: '#9A9692', flex: 1 }}>{item.label}</span>
                      <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>{item.shortcut}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, margin: '4px 6px', background: 'rgba(89,86,83,0.25)' }} />
                  {[
                    { label: 'Cut', shortcut: `${modLabel}+X`, cmd: 'cut' as const },
                    { label: 'Copy', shortcut: `${modLabel}+C`, cmd: 'copy' as const },
                    { label: 'Paste', shortcut: `${modLabel}+V`, cmd: 'paste' as const },
                    { label: 'Select All', shortcut: `${modLabel}+A`, cmd: 'selectAll' as const },
                  ].map((item) => (
                    <div
                      key={item.label}
                      onClick={() => runEditCommand(item.cmd)}
                      className="hover-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      <span style={{ color: '#9A9692', flex: 1 }}>{item.label}</span>
                      <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>{item.shortcut}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, margin: '4px 6px', background: 'rgba(89,86,83,0.25)' }} />
                  <div
                    onClick={() => runMenuAction(onFocusChatInput)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>Focus Chat Input</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.focusChatInput.label}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* View dropdown */}
          <div style={{ position: 'relative', zIndex: 9999 }}>
            <span
              className="nav-item"
              onClick={() => toggleMenu('view')}
              style={{ color: '#74747C', fontSize: 'inherit' }}
            >
              View
            </span>
            {openMenu === 'view' && (
              <>
                <div
                  style={{
                    position: 'absolute', top: 30, left: -8, zIndex: 9999,
                    minWidth: 190, padding: '4px 0', borderRadius: 6,
                    background: '#1A1A19', border: '1px solid rgba(89,86,83,0.3)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                  }}
                >
                  {ALL_PANELS.map((id) => (
                    <div
                      key={id}
                      onClick={() => runMenuAction(() => onTogglePanel(id))}
                      className="hover-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      <span style={{ color: visiblePanels.has(id) ? '#548C5A' : '#595653', fontWeight: 600, width: 14 }}>
                        {visiblePanels.has(id) ? '✓' : ''}
                      </span>
                      <span style={{ color: '#9A9692', flex: 1 }}>{PANEL_LABELS[id]}</span>
                      <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                        {PANEL_SHORTCUT_LABELS[id]}
                      </span>
                    </div>
                  ))}
                  <div style={{ height: 1, margin: '4px 6px', background: 'rgba(89,86,83,0.25)' }} />
                  <div
                    onClick={() => runMenuAction(onResetLayout)}
                    className="hover-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#9A9692', flex: 1 }}>Reset Layout</span>
                    <span style={{ color: '#595653', fontSize: 10, fontWeight: 500 }}>
                      {SHORTCUTS.resetLayout.label}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
          <span className="nav-item" onClick={openSettings} style={{ color: '#74747C', fontSize: 'inherit' }} title={`Settings (${SHORTCUTS.openSettings.label})`}>
            Settings
          </span>
          <span className="nav-item" onClick={openHelp} style={{ color: '#74747C', fontSize: 'inherit' }} title={`Help (${SHORTCUTS.openHelp.label})`}>
            Help
          </span>
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#74747C', fontSize: 'inherit' }}>
        <span className="glow-amber" style={{ color: '#9A9692' }}>agent-observer</span>
        <span style={{ color: '#595653' }}>|</span>
        <span><strong style={{ color: '#9A9692' }}>{agentCount}</strong> agents</span>
        <span style={{ color: '#595653' }}>|</span>
        <span><strong style={{ color: '#9A9692' }}>{eventCount}</strong> events</span>
        <span style={{ color: '#595653' }}>|</span>
        <span style={{ color: '#9A9692' }}>{timeStr}</span>
      </div>
    </header>
  )
}

// ── Slot Tab Bar ────────────────────────────────────────────────────

function SlotTabBar({
  panels,
  activeTab,
  onSelect,
  onHide,
  onHideSlot,
  onDragStart,
}: {
  panels: PanelId[]
  activeTab: PanelId
  onSelect: (id: PanelId) => void
  onHide: (id: PanelId) => void
  onHideSlot: () => void
  onDragStart: (e: React.DragEvent, id: PanelId) => void
}) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid rgba(89,86,83,0.2)', flexShrink: 0, minHeight: 30 }}>
      {panels.map((id) => (
        <div
          key={id}
          draggable
          onDragStart={(e) => onDragStart(e, id)}
          onClick={() => onSelect(id)}
          className="slot-tab"
          style={{
            padding: '6px 12px', fontSize: 12, fontWeight: 600, letterSpacing: 1, cursor: 'pointer',
            color: id === activeTab ? '#548C5A' : '#595653',
            borderBottom: id === activeTab ? '2px solid #548C5A' : '2px solid transparent',
            textShadow: id === activeTab ? '0 0 8px rgba(84,140,90,0.4)' : 'none',
            display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none',
          }}
        >
          {PANEL_LABELS[id]}
          <span
            className="tab-close"
            onClick={(e) => { e.stopPropagation(); onHide(id) }}
          >
            ×
          </span>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <button
        onClick={onHideSlot}
        className="slot-hide-btn"
        title="Hide section"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <circle cx="5" cy="5" r="4" />
        </svg>
      </button>
    </div>
  )
}

// ── Drop Overlay ────────────────────────────────────────────────────

function DropOverlay({
  zone, colIdx, rowIdx, slotIdx,
}: {
  zone: DropZone | null; colIdx: number; rowIdx: number; slotIdx: number
}) {
  if (!zone || zone.columnIndex !== colIdx || zone.rowIndex !== rowIdx || zone.slotIndex !== slotIdx) return null
  if (zone.position === 'center') return <div className="drop-indicator-center" />
  const base: React.CSSProperties = { position: 'absolute', zIndex: 20, pointerEvents: 'none' }
  if (zone.position === 'top') return <div className="drop-indicator-h" style={{ ...base, top: 0, left: 0, right: 0 }} />
  if (zone.position === 'bottom') return <div className="drop-indicator-h" style={{ ...base, bottom: 0, left: 0, right: 0 }} />
  if (zone.position === 'left') return <div className="drop-indicator-v" style={{ ...base, top: 0, bottom: 0, left: 0 }} />
  if (zone.position === 'right') return <div className="drop-indicator-v" style={{ ...base, top: 0, bottom: 0, right: 0 }} />
  return null
}

// ── Main Layout ─────────────────────────────────────────────────────

export function WorkspaceLayout() {
  const [layout, setLayout] = useState<Layout>(() => hydratedWorkspaceLayoutState.layout)
  const [draggedPanel, setDraggedPanel] = useState<PanelId | null>(null)
  const [dropZone, setDropZone] = useState<DropZone | null>(null)
  const [activeTabs, setActiveTabs] = useState<Record<string, PanelId>>(
    () => hydratedWorkspaceLayoutState.activeTabs
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const visiblePanels = findAllPanelsInLayout(layout)

  // ── Active tab helpers ──────────────────────────────────────────
  const getActiveTab = useCallback(
    (panels: PanelId[], key: string): PanelId => {
      const stored = activeTabs[key]
      return stored && panels.includes(stored) ? stored : panels[0]
    },
    [activeTabs]
  )

  const setActiveTab = useCallback((key: string, panelId: PanelId) => {
    setActiveTabs((prev) => ({ ...prev, [key]: panelId }))
  }, [])

  // ── Column resize ──────────────────────────────────────────────
  const handleColumnResize = useCallback((divIdx: number, deltaX: number) => {
    setLayout((prev) => {
      const next = deepCloneLayout(prev)
      const cw = containerRef.current?.clientWidth ?? 1000
      const dr = deltaX / cw
      const left = next[divIdx].width + dr
      const right = next[divIdx + 1].width - dr
      if (left < 0.15 || right < 0.15) return prev
      next[divIdx].width = left
      next[divIdx + 1].width = right
      return next
    })
  }, [])

  // ── Row resize ─────────────────────────────────────────────────
  const handleRowResize = useCallback((colIdx: number, divIdx: number, deltaY: number) => {
    // Capture DOM measurement before setState to avoid querying inside the callback
    const colEl = containerRef.current?.querySelector<HTMLElement>(`[data-col="${colIdx}"]`)
    const colHeight = colEl?.clientHeight ?? 0

    setLayout((prev) => {
      const next = deepCloneLayout(prev)
      const col = next[colIdx]
      let topH = col.rows[divIdx].height
      let bottomH = col.rows[divIdx + 1].height

      // Resolve flex rows (-1) to actual pixel height from DOM
      if (topH === -1 || bottomH === -1) {
        if (!colHeight) return prev
        const dividerCount = col.rows.length - 1
        const dividerH = 5 // matches CSS .panel-divider height
        const fixedTotal = col.rows.reduce((sum, r) => sum + (r.height === -1 ? 0 : r.height), 0)
        const flexHeight = Math.max(PANEL_MIN_HEIGHT, colHeight - fixedTotal - dividerCount * dividerH)

        const flexCount = col.rows.filter((r) => r.height === -1).length
        if (flexCount === 0) return prev
        const perFlex = Math.max(PANEL_MIN_HEIGHT, flexHeight / flexCount)

        // Convert all flex rows to fixed pixel heights
        for (const row of col.rows) {
          if (row.height === -1) row.height = perFlex
        }
        topH = col.rows[divIdx].height
        bottomH = col.rows[divIdx + 1].height
      }

      const newTop = topH + deltaY
      const newBottom = bottomH - deltaY
      if (newTop < PANEL_MIN_HEIGHT || newBottom < PANEL_MIN_HEIGHT) return prev
      col.rows[divIdx].height = newTop
      col.rows[divIdx + 1].height = newBottom
      return next
    })
  }, [])

  // ── Slot resize ────────────────────────────────────────────────
  const handleSlotResize = useCallback((colIdx: number, rowIdx: number, divIdx: number, deltaX: number) => {
    setLayout((prev) => {
      const next = deepCloneLayout(prev)
      const row = next[colIdx].rows[rowIdx]
      const cw = containerRef.current?.clientWidth ?? 1000
      const colW = cw * next[colIdx].width
      const dr = deltaX / colW
      const left = row.slotWidths[divIdx] + dr
      const right = row.slotWidths[divIdx + 1] - dr
      if (left < 0.15 || right < 0.15) return prev
      row.slotWidths[divIdx] = left
      row.slotWidths[divIdx + 1] = right
      return next
    })
  }, [])

  // ── Drag handlers ──────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, panelId: PanelId) => {
    setDraggedPanel(panelId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', panelId)
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.4'
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, colIdx: number, rowIdx: number, slotIdx: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropZone(getDropZone(e, colIdx, rowIdx, slotIdx))
    },
    []
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!draggedPanel || !dropZone) return
      const cleaned = removePanelFromLayout(layout, draggedPanel)
      if (cleaned.length === 0) {
        // Edge case: dragging the last panel — just put it back
        setLayout(DEFAULT_LAYOUT)
        setDraggedPanel(null)
        setDropZone(null)
        return
      }
      const clamped = clampDropZone(cleaned, dropZone)
      const newLayout = insertPanelAtDropZone(cleaned, draggedPanel, clamped)
      setLayout(newLayout)
      setDraggedPanel(null)
      setDropZone(null)
    },
    [draggedPanel, dropZone, layout]
  )

  // ── Hide / Show ────────────────────────────────────────────────
  const handleHidePanel = useCallback((panelId: PanelId) => {
    setLayout((prev) => {
      const next = removePanelFromLayout(prev, panelId)
      return next.length > 0 ? next : prev // don't allow hiding the last panel
    })
  }, [])

  const handleHideSlot = useCallback((panels: PanelId[]) => {
    setLayout((prev) => {
      let next = deepCloneLayout(prev)
      for (const pid of panels) {
        const result = removePanelFromLayout(next, pid)
        if (result.length > 0) next = result
        else break // don't remove the very last panel
      }
      return next
    })
  }, [])

  const handleTogglePanel = useCallback((panelId: PanelId) => {
    if (visiblePanels.has(panelId)) {
      handleHidePanel(panelId)
    } else {
      // Re-show: add to the first column's first slot as a stack member
      setLayout((prev) => {
        const result = deepCloneLayout(prev)
        if (result.length === 0) {
          return [{ width: 1, rows: [{ slots: [panelId], slotWidths: [1], height: -1 }] }]
        }
        const firstRow = result[0].rows[0]
        if (!firstRow) {
          result[0].rows.push({ slots: [panelId], slotWidths: [1], height: -1 })
        } else {
          const slot = firstRow.slots[0]
          if (Array.isArray(slot)) {
            slot.push(panelId)
          } else if (slot !== undefined) {
            firstRow.slots[0] = [slot, panelId]
          }
        }
        // Auto-select the newly shown panel
        setActiveTabs((tabs) => ({ ...tabs, ['0-0-0']: panelId }))
        return result
      })
    }
  }, [visiblePanels, handleHidePanel])

  // ── Focus a panel by ID ───────────────────────────────────────
  const focusPanel = useCallback((panelId: PanelId) => {
    // If the panel isn't visible, show it first
    if (!findAllPanelsInLayout(layout).has(panelId)) {
      handleTogglePanel(panelId) // re-shows it
      return
    }
    // Find the slot key containing this panel and activate its tab
    for (let ci = 0; ci < layout.length; ci++) {
      for (let ri = 0; ri < layout[ci].rows.length; ri++) {
        const row = layout[ci].rows[ri]
        for (let si = 0; si < row.slots.length; si++) {
          const slot = row.slots[si]
          const panels = Array.isArray(slot) ? slot : [slot]
          if (panels.includes(panelId)) {
            setActiveTabs((prev) => ({ ...prev, [`${ci}-${ri}-${si}`]: panelId }))
            return
          }
        }
      }
    }
  }, [layout, handleTogglePanel])

  // ── Keyboard shortcuts ────────────────────────────────────────
  const openSettings = useSettingsStore((s) => s.openSettings)
  const openHelp = useSettingsStore((s) => s.openHelp)
  const openFolder = useWorkspaceStore((s) => s.openFolder)

  useEffect(() => {
    savePersistedWorkspaceLayoutState(layout, activeTabs)
  }, [layout, activeTabs])

  const triggerNewTerminal = useCallback(() => {
    window.dispatchEvent(new CustomEvent('hotkey:newTerminal'))
  }, [])

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT)
    setActiveTabs({})
  }, [])

  const closeActivePanel = useCallback(() => {
    for (const panelId of Object.values(activeTabs)) {
      if (findAllPanelsInLayout(layout).has(panelId)) {
        handleHidePanel(panelId)
        return
      }
    }
  }, [activeTabs, layout, handleHidePanel])

  const focusChatInput = useCallback(() => {
    focusPanel('chat')
    setTimeout(() => {
      const input = document.querySelector<HTMLTextAreaElement>('[data-chat-input]')
      if (input) input.focus()
    }, 50)
  }, [focusPanel])

  const openFolderFromDialog = useCallback(() => {
    void (async () => {
      try {
        const selected = await window.electronAPI.fs.openFolderDialog()
        if (selected) useWorkspaceStore.getState().openFolder(selected)
      } catch (err) {
        console.error('[WorkspaceLayout] Open folder failed:', err)
      }
    })()
  }, [])

  const focusFileSearch = useCallback(() => {
    focusPanel('fileSearch')
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('[data-file-search-input]')
      if (input) input.focus()
    }, 50)
  }, [focusPanel])

  const focusFileExplorer = useCallback(() => {
    focusPanel('fileExplorer')
  }, [focusPanel])

  const hotkeyBindings: HotkeyBinding[] = [
    // Cmd+1 through Cmd+8: focus panels
    ...PANEL_SHORTCUT_ORDER.map((panelId, idx) => {
      const shortcutKey = `focus${panelId.charAt(0).toUpperCase() + panelId.slice(1)}` as keyof typeof SHORTCUTS
      const def = SHORTCUTS[shortcutKey] ?? {
        hotkey: { key: String(idx + 1), metaOrCtrl: true },
        label: `⌘${idx + 1}`,
      }
      return {
        hotkey: def.hotkey,
        label: def.label,
        description: def.description,
        handler: () => focusPanel(panelId as PanelId),
      }
    }),

    // Cmd+, — open settings
    {
      ...SHORTCUTS.openSettings,
      handler: () => openSettings(),
    },

    // F1 — open help
    {
      ...SHORTCUTS.openHelp,
      handler: () => openHelp(),
    },

    // Cmd+Shift+N — new terminal (IPC)
    {
      ...SHORTCUTS.newTerminal,
      handler: triggerNewTerminal,
    },

    // Cmd+Shift+R — reset layout
    {
      ...SHORTCUTS.resetLayout,
      handler: resetLayout,
    },

    // Cmd+W — close/hide active panel (whatever is in the focused slot)
    {
      ...SHORTCUTS.closePanel,
      handler: closeActivePanel,
    },

    // Cmd+/ — focus chat input
    {
      ...SHORTCUTS.focusChatInput,
      handler: focusChatInput,
    },

    // Cmd+O — open folder
    {
      ...SHORTCUTS.openFolder,
      handler: openFolderFromDialog,
    },

    // Cmd+P — file search
    {
      ...SHORTCUTS.fileSearch,
      handler: focusFileSearch,
    },

    // Cmd+Shift+E — file explorer
    {
      ...SHORTCUTS.fileExplorer,
      handler: focusFileExplorer,
    },

    // Escape — close menus, deselect agent
    {
      ...SHORTCUTS.escape,
      handler: () => {
        // Close settings if open
        const settingsStore = useSettingsStore.getState()
        if (settingsStore.isOpen) {
          settingsStore.closeSettings()
          return
        }
        if (settingsStore.isHelpOpen) {
          settingsStore.closeHelp()
          return
        }
        // Deselect agent in 3D scene
        const agentStore = useAgentStore.getState()
        if (agentStore.selectedAgentId) {
          agentStore.selectAgent(null)
        }
      },
    },
  ]

  useHotkeys(hotkeyBindings)

  // Handle menu-driven "Open Folder" even when Explorer panel is not mounted.
  useEffect(() => {
    const api = window.electronAPI?.fs
    if (!api?.onOpenFolder) return
    return api.onOpenFolder((folderPath: string) => {
      openFolder(folderPath)
    })
  }, [openFolder])

  // ── Electron menu IPC listeners ───────────────────────────────
  useEffect(() => {
    const api = window.electronAPI?.settings
    if (!api) return

    const unsubs: Array<() => void> = []

    if (api.onNewTerminal) {
      unsubs.push(api.onNewTerminal(() => {
        triggerNewTerminal()
      }))
    }

    if (api.onFocusChat) {
      unsubs.push(api.onFocusChat(() => {
        focusChatInput()
      }))
    }

    if (api.onResetLayout) {
      unsubs.push(api.onResetLayout(() => {
        resetLayout()
      }))
    }

    if (api.onFocusPanel) {
      unsubs.push(api.onFocusPanel((panelId: string) => {
        focusPanel(panelId as PanelId)
      }))
    }

    return () => { unsubs.forEach((fn) => fn()) }
  }, [focusPanel, focusChatInput, resetLayout, triggerNewTerminal])

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0E0E0D', paddingRight: 8 }}>
      <TopNav
        visiblePanels={visiblePanels}
        onTogglePanel={handleTogglePanel}
        onOpenFolder={openFolderFromDialog}
        onFocusFileSearch={focusFileSearch}
        onFocusFileExplorer={focusFileExplorer}
        onNewTerminal={triggerNewTerminal}
        onCloseActivePanel={closeActivePanel}
        onFocusChatInput={focusChatInput}
        onResetLayout={resetLayout}
      />

      <div ref={containerRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {layout.map((col, colIdx) => (
          <Fragment key={colIdx}>
            <div data-col={colIdx} style={{ flex: `0 0 ${col.width * 100}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {col.rows.map((row, rowIdx) => {
                const isFlex = row.height === -1

                return (
                  <Fragment key={rowIdx}>
                    <div
                      style={{
                        display: 'flex',
                        ...(isFlex
                          ? { flex: '1 1 0', minHeight: PANEL_MIN_HEIGHT }
                          : { height: row.height, flexShrink: 0 }),
                        /* no border — RowDivider handles visual separation on hover */
                      }}
                    >
                      {row.slots.map((slot, slotIdx) => {
                        const panels = Array.isArray(slot) ? slot : [slot]
                        const slotKey = `${colIdx}-${rowIdx}-${slotIdx}`
                        const activePanel = getActiveTab(panels, slotKey)

                        return (
                          <Fragment key={slotKey}>
                            <div
                              onDragOver={(e) => handleDragOver(e, colIdx, rowIdx, slotIdx)}
                              onDrop={handleDrop}
                              style={{
                                flex: `0 0 ${(row.slotWidths[slotIdx] ?? 1 / row.slots.length) * 100}%`,
                                display: 'flex', flexDirection: 'column',
                                overflow: 'hidden', position: 'relative', height: '100%',
                              }}
                            >
                              <SlotTabBar
                                panels={panels}
                                activeTab={activePanel}
                                onSelect={(id) => setActiveTab(slotKey, id)}
                                onHide={handleHidePanel}
                                onHideSlot={() => handleHideSlot(panels)}
                                onDragStart={handleDragStart}
                              />
                              <SlotPanelContent key={slotKey} panels={panels} activePanel={activePanel} />
                              <DropOverlay zone={dropZone} colIdx={colIdx} rowIdx={rowIdx} slotIdx={slotIdx} />
                            </div>
                            {slotIdx < row.slots.length - 1 && (
                              <ColDivider onDrag={(dx) => handleSlotResize(colIdx, rowIdx, slotIdx, dx)} />
                            )}
                          </Fragment>
                        )
                      })}
                    </div>
                    {rowIdx < col.rows.length - 1 && (
                      <RowDivider onDrag={(dy) => handleRowResize(colIdx, rowIdx, dy)} />
                    )}
                  </Fragment>
                )
              })}
            </div>
            {colIdx < layout.length - 1 && (
              <ColDivider onDrag={(dx) => handleColumnResize(colIdx, dx)} />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

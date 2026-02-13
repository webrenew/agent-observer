import { useState, useCallback, useRef, useEffect, type ComponentType } from 'react'
import { RowDivider } from './RowDivider'
import { ColDivider } from './ColDivider'
import {
  type PanelId,
  type LayoutRow,
  type DropZone,
  PANEL_MIN_HEIGHT,
  DEFAULT_LAYOUT,
  DEFAULT_WIDTH_RATIOS,
  getDropZone,
  computeWidthRatios,
  removePanelFromLayout,
  insertPanelAtDropZone,
} from './layout-engine'
import { ScenePanel } from './panels/ScenePanel'
import { ChatPanelWrapper } from './panels/ChatPanelWrapper'
import { TerminalPanelWrapper } from './panels/TerminalPanelWrapper'
import { ActivityPanel } from './panels/ActivityPanel'
import { AgentsPanel } from './panels/AgentsPanel'
import { MemoryGraphPanel } from './panels/MemoryGraphPanel'
import { RecentMemoriesPanel } from './panels/RecentMemoriesPanel'
import { TokensPanel } from './panels/TokensPanel'
import { useAgentStore } from '../../store/agents'

// ── Panel Registry ─────────────────────────────────────────────────

const PANEL_COMPONENTS: Record<PanelId, ComponentType> = {
  scene3d: ScenePanel,
  activity: ActivityPanel,
  memoryGraph: MemoryGraphPanel,
  agents: AgentsPanel,
  recentMemories: RecentMemoriesPanel,
  terminal: TerminalPanelWrapper,
  tokens: TokensPanel,
}

// ── Top Nav Bar ────────────────────────────────────────────────────

function TopNav() {
  const agentCount = useAgentStore((s) => s.agents.length)
  const eventCount = useAgentStore((s) => s.events.length)
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  )

  useEffect(() => {
    const tick = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }))
    }, 60_000)
    return () => clearInterval(tick)
  }, [])

  return (
    <header
      className="glass-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 36,
        padding: '0 16px',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: '1px solid rgba(89, 86, 83, 0.2)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 16, letterSpacing: 1 }}>&#x2B22;</span>
        <span style={{ color: '#595653', fontSize: 13 }}>|</span>
        <nav style={{ display: 'flex', gap: 14 }}>
          {['Office', 'Chat', 'Terminal', 'Tokens'].map((item) => (
            <span key={item} className="nav-item" style={{ color: '#74747C', fontSize: 13 }}>
              {item}
            </span>
          ))}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#74747C', fontSize: 13 }}>
        <span className="glow-amber" style={{ color: '#9A9692' }}>agent-space</span>
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

// ── Chat Left Panel ────────────────────────────────────────────────

function ChatLeftPanel() {
  const [activeTab, setActiveTab] = useState('CHAT')
  const tabs = ['CHAT', 'TERMINAL', 'TOKENS']

  return (
    <div
      style={{
        flex: '0 0 55%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(89, 86, 83, 0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid rgba(89, 86, 83, 0.2)',
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="nav-item"
            style={{
              background: 'transparent',
              border: 'none',
              color: activeTab === tab ? '#548C5A' : '#595653',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: 1,
              borderBottom: activeTab === tab ? '2px solid #548C5A' : '2px solid transparent',
              textShadow: activeTab === tab ? '0 0 8px rgba(84, 140, 90, 0.4)' : 'none',
            }}
          >
            {tab}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div
          className="pulse-amber"
          style={{
            width: 10,
            height: 10,
            background: '#d4a040',
            borderRadius: '50%',
            alignSelf: 'center',
            marginRight: 12,
          }}
        />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: activeTab === 'CHAT' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <ChatPanelWrapper />
        </div>
        <div style={{ display: activeTab === 'TERMINAL' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <TerminalPanelWrapper />
        </div>
        <div style={{ display: activeTab === 'TOKENS' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <TokensPanel />
        </div>
      </div>
    </div>
  )
}

// ── Right Panel: Tiling Layout ─────────────────────────────────────

function RightTilingPanel() {
  const [layout, setLayout] = useState<LayoutRow[]>(DEFAULT_LAYOUT)
  const [widthRatios, setWidthRatios] = useState<Record<string, number[]>>(DEFAULT_WIDTH_RATIOS)
  const [draggedPanel, setDraggedPanel] = useState<PanelId | null>(null)
  const [dropZone, setDropZone] = useState<DropZone | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Row resize
  const handleRowResize = useCallback((dividerIndex: number, deltaY: number) => {
    setLayout((prev) => {
      const next = [...prev]
      const topH = next[dividerIndex].height + deltaY
      const bottomH = next[dividerIndex + 1].height - deltaY
      if (topH < PANEL_MIN_HEIGHT || bottomH < PANEL_MIN_HEIGHT) return prev
      next[dividerIndex] = { ...next[dividerIndex], height: topH }
      next[dividerIndex + 1] = { ...next[dividerIndex + 1], height: bottomH }
      return next
    })
  }, [])

  // Column resize
  const handleColResize = useCallback((rowIndex: number, colDividerIndex: number, deltaX: number) => {
    setWidthRatios((prev) => {
      const key = String(rowIndex)
      const ratios = [...(prev[key] ?? [])]
      if (colDividerIndex >= ratios.length - 1) return prev

      const containerWidth = containerRef.current?.clientWidth ?? 600
      const deltaRatio = deltaX / containerWidth
      const left = ratios[colDividerIndex] + deltaRatio
      const right = ratios[colDividerIndex + 1] - deltaRatio
      if (left < 0.15 || right < 0.15) return prev

      ratios[colDividerIndex] = left
      ratios[colDividerIndex + 1] = right
      return { ...prev, [key]: ratios }
    })
  }, [])

  // Drag start
  const handlePanelDragStart = useCallback((e: React.DragEvent, panelId: PanelId) => {
    setDraggedPanel(panelId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', panelId)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4'
    }
  }, [])

  // Drag end
  const handlePanelDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    setDraggedPanel(null)
    setDropZone(null)
  }, [])

  // Drag over
  const handlePanelDragOver = useCallback((e: React.DragEvent, rowIndex: number, panelCount: number, panelIndex?: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const zone = getDropZone(e, rowIndex, panelCount, panelIndex)
    setDropZone(zone)
  }, [])

  // Drop
  const handlePanelDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedPanel || !dropZone) return

    const cleaned = removePanelFromLayout(layout, draggedPanel)

    // Adjust target row index if source row was removed
    let targetRowIndex = Math.min(dropZone.rowIndex, cleaned.length - 1)

    const newLayout = insertPanelAtDropZone(cleaned, draggedPanel, {
      ...dropZone,
      rowIndex: targetRowIndex,
    })
    const newRatios = computeWidthRatios(newLayout, widthRatios)
    setLayout(newLayout)
    setWidthRatios(newRatios)
    setDraggedPanel(null)
    setDropZone(null)
  }, [draggedPanel, dropZone, layout, widthRatios])

  // Drop indicator rendering
  const renderDropIndicator = (rowIndex: number, position: 'top' | 'bottom' | 'left' | 'right', panelIndex?: number) => {
    if (!dropZone || !draggedPanel) return null
    if (dropZone.rowIndex !== rowIndex || dropZone.position !== position) return null
    if ((position === 'left' || position === 'right') && dropZone.panelIndex !== panelIndex) return null

    if (position === 'top' || position === 'bottom') {
      return <div className="drop-indicator-h" />
    }
    return <div className="drop-indicator-v" />
  }

  return (
    <div
      ref={containerRef}
      className="right-panel-container"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'auto',
      }}
    >
      {layout.map((row, rowIndex) => {
        const ratios = widthRatios[String(rowIndex)] ?? row.panels.map(() => 1 / row.panels.length)

        return (
          <div key={row.panels.join('-')}>
            {renderDropIndicator(rowIndex, 'top')}

            <div
              style={{
                display: 'flex',
                height: row.height,
                flexShrink: 0,
                borderBottom: '1px solid rgba(89, 86, 83, 0.2)',
              }}
            >
              {row.panels.map((panelId, panelIndex) => {
                const PanelComponent = PANEL_COMPONENTS[panelId]
                const isBeingDragged = draggedPanel === panelId

                return (
                  <div key={panelId} style={{ display: 'flex', flex: `0 0 ${(ratios[panelIndex] ?? (1 / row.panels.length)) * 100}%`, minWidth: 0 }}>
                    {panelIndex === 0 && renderDropIndicator(rowIndex, 'left', panelIndex)}

                    <div
                      draggable
                      onDragStart={(e) => handlePanelDragStart(e, panelId)}
                      onDragEnd={handlePanelDragEnd}
                      onDragOver={(e) => handlePanelDragOver(e, rowIndex, row.panels.length, panelIndex)}
                      onDrop={handlePanelDrop}
                      className={`right-panel-section ${isBeingDragged ? 'dragging' : ''}`}
                      style={{
                        flex: 1,
                        overflow: 'auto',
                        position: 'relative',
                      }}
                    >
                      <div className="drag-handle">
                        <span className="drag-handle-dots">&#x2801;&#x2801;</span>
                      </div>
                      <PanelComponent />
                    </div>

                    {renderDropIndicator(rowIndex, 'right', panelIndex)}

                    {panelIndex < row.panels.length - 1 && (
                      <ColDivider
                        onDrag={(deltaX) => handleColResize(rowIndex, panelIndex, deltaX)}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {renderDropIndicator(rowIndex, 'bottom')}

            {rowIndex < layout.length - 1 && (
              <RowDivider onDrag={(deltaY) => handleRowResize(rowIndex, deltaY)} />
            )}
          </div>
        )
      })}

      {/* Empty spacer — absorbs remaining height so panels don't stretch */}
      <div
        style={{
          flex: '1 1 0',
          minHeight: 0,
          borderTop: '1px solid rgba(89, 86, 83, 0.15)',
          background: 'transparent',
        }}
      />
    </div>
  )
}

// ── Main Layout ────────────────────────────────────────────────────

export function WorkspaceLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0E0E0D' }}>
      <TopNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ChatLeftPanel />
        <RightTilingPanel />
      </div>
    </div>
  )
}

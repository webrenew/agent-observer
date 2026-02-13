import { useState, useCallback, useRef, type ReactNode, type ComponentType } from 'react'
import { RowDivider } from './RowDivider'
import { ColDivider } from './ColDivider'
import {
  type PanelId,
  type LayoutRow,
  type DropZone,
  PANEL_LABELS,
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
import { TokensPanel } from './panels/TokensPanel'

// ── Panel Registry ─────────────────────────────────────────────────

const PANEL_COMPONENTS: Record<PanelId, ComponentType> = {
  scene3d: ScenePanel,
  chat: ChatPanelWrapper,
  terminal: TerminalPanelWrapper,
  activity: ActivityPanel,
  agents: AgentsPanel,
  memoryGraph: MemoryGraphPanel,
  tokens: TokensPanel,
}

// ── Workspace Layout Component ─────────────────────────────────────

export function WorkspaceLayout() {
  const [layout, setLayout] = useState<LayoutRow[]>(DEFAULT_LAYOUT)
  const [widthRatios, setWidthRatios] = useState<Record<string, number[]>>(DEFAULT_WIDTH_RATIOS)
  const [draggedPanel, setDraggedPanel] = useState<PanelId | null>(null)
  const [dropTarget, setDropTarget] = useState<DropZone | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Row Height Resize ────────────────────────────────────────────

  const handleRowResize = useCallback(
    (rowIndex: number, deltaY: number) => {
      setLayout((prev) => {
        const updated = [...prev]
        const above = updated[rowIndex]
        const below = updated[rowIndex + 1]
        if (!above || !below) return prev

        const newAboveH = above.height + deltaY
        const newBelowH = below.height - deltaY

        if (newAboveH < PANEL_MIN_HEIGHT || newBelowH < PANEL_MIN_HEIGHT) return prev

        updated[rowIndex] = { ...above, height: newAboveH }
        updated[rowIndex + 1] = { ...below, height: newBelowH }
        return updated
      })
    },
    []
  )

  // ── Column Width Resize ──────────────────────────────────────────

  const handleColResize = useCallback(
    (rowIndex: number, colIndex: number, deltaX: number) => {
      setWidthRatios((prev) => {
        const key = String(rowIndex)
        const ratios = prev[key]
        if (!ratios || colIndex >= ratios.length - 1) return prev

        const container = containerRef.current
        if (!container) return prev
        const totalWidth = container.clientWidth

        const pxDelta = deltaX / totalWidth
        const newLeft = ratios[colIndex] + pxDelta
        const newRight = ratios[colIndex + 1] - pxDelta

        if (newLeft < 0.15 || newRight < 0.15) return prev

        const updated = [...ratios]
        updated[colIndex] = newLeft
        updated[colIndex + 1] = newRight
        return { ...prev, [key]: updated }
      })
    },
    []
  )

  // ── Drag & Drop ──────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (panelId: PanelId) => (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', panelId)
      e.dataTransfer.effectAllowed = 'move'
      setDraggedPanel(panelId)
    },
    []
  )

  const handleDragOver = useCallback(
    (rowIndex: number, panelCount: number, panelIndex?: number) =>
      (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const zone = getDropZone(e, rowIndex, panelCount, panelIndex)
        setDropTarget(zone)
      },
    []
  )

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback(
    (rowIndex: number, panelCount: number, panelIndex?: number) =>
      (e: React.DragEvent) => {
        e.preventDefault()
        const panelId = e.dataTransfer.getData('text/plain') as PanelId
        if (!panelId || !PANEL_COMPONENTS[panelId]) return

        const zone = getDropZone(e, rowIndex, panelCount, panelIndex)

        // Compute new layout first, then update both states outside updaters
        const cleaned = removePanelFromLayout(layout, panelId)
        const newLayout = insertPanelAtDropZone(cleaned, panelId, zone)
        const newRatios = computeWidthRatios(newLayout, widthRatios)
        setLayout(newLayout)
        setWidthRatios(newRatios)

        setDraggedPanel(null)
        setDropTarget(null)
      },
    [layout, widthRatios]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedPanel(null)
    setDropTarget(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────────

  const totalHeight = layout.reduce((sum, r) => sum + r.height, 0)

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-full h-full overflow-hidden"
      style={{ background: '#0e0e14' }}
      onDragOver={(e) => e.preventDefault()}
    >
      {layout.map((row, rowIndex) => {
        const heightPct = `${(row.height / totalHeight) * 100}%`
        const ratios = widthRatios[String(rowIndex)] ?? row.panels.map(() => 1 / row.panels.length)
        const showDropTop = dropTarget?.rowIndex === rowIndex && dropTarget.position === 'top'
        const showDropBottom = dropTarget?.rowIndex === rowIndex && dropTarget.position === 'bottom'

        return (
          <div key={`row-${rowIndex}`} style={{ height: heightPct }} className="flex flex-col shrink-0">
            {/* Top drop indicator */}
            {showDropTop && <div className="ws-drop-indicator-h" />}

            <div className="flex flex-1 min-h-0">
              {row.panels.map((panelId, colIndex) => {
                const PanelComponent = PANEL_COMPONENTS[panelId]
                const isDragging = draggedPanel === panelId
                const showDropLeft = dropTarget?.rowIndex === rowIndex && dropTarget.position === 'left' && dropTarget.panelIndex === colIndex
                const showDropRight = dropTarget?.rowIndex === rowIndex && dropTarget.position === 'right' && dropTarget.panelIndex === colIndex

                return (
                  <div
                    key={panelId}
                    className="flex min-w-0"
                    style={{ width: `${ratios[colIndex] * 100}%` }}
                  >
                    {/* Left drop indicator */}
                    {showDropLeft && <div className="ws-drop-indicator-v" />}

                    {/* Column divider (before this panel, after first) */}
                    {colIndex > 0 && (
                      <ColDivider
                        onDrag={(dx) => handleColResize(rowIndex, colIndex - 1, dx)}
                      />
                    )}

                    {/* Panel */}
                    <div
                      className={`ws-panel-section flex-1 flex flex-col min-w-0 overflow-hidden rounded ${
                        isDragging ? 'ws-dragging' : ''
                      }`}
                      onDragOver={handleDragOver(rowIndex, row.panels.length, colIndex)}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop(rowIndex, row.panels.length, colIndex)}
                    >
                      {/* Panel header / drag handle */}
                      <div
                        className="ws-panel-header"
                        draggable
                        onDragStart={handleDragStart(panelId)}
                        onDragEnd={handleDragEnd}
                      >
                        <span>{PANEL_LABELS[panelId]}</span>
                        <span className="ws-drag-handle">⠿</span>
                      </div>

                      {/* Panel content */}
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <PanelComponent />
                      </div>
                    </div>

                    {/* Right drop indicator */}
                    {showDropRight && <div className="ws-drop-indicator-v" />}
                  </div>
                )
              })}
            </div>

            {/* Bottom drop indicator */}
            {showDropBottom && <div className="ws-drop-indicator-h" />}

            {/* Row divider (between rows, not after last) */}
            {rowIndex < layout.length - 1 && (
              <RowDivider onDrag={(dy) => handleRowResize(rowIndex, dy)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

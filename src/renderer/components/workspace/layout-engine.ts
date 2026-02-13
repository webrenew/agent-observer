// ── Panel and Layout Types ─────────────────────────────────────────

export type PanelId =
  | 'scene3d'
  | 'chat'
  | 'terminal'
  | 'activity'
  | 'agents'
  | 'memoryGraph'
  | 'tokens'

export interface LayoutRow {
  panels: PanelId[]
  height: number
}

export interface DropZone {
  rowIndex: number
  position: 'top' | 'bottom' | 'left' | 'right'
  panelIndex?: number
}

export const PANEL_MIN_HEIGHT = 80

export const PANEL_LABELS: Record<PanelId, string> = {
  scene3d: '3D Scene',
  chat: 'Chat',
  terminal: 'Terminal',
  activity: 'Activity',
  agents: 'Agents',
  memoryGraph: 'Memory Graph',
  tokens: 'Tokens',
}

// ── Default Layout ─────────────────────────────────────────────────

export const DEFAULT_LAYOUT: LayoutRow[] = [
  { panels: ['scene3d', 'activity'], height: 320 },
  { panels: ['chat', 'agents'], height: 260 },
  { panels: ['terminal'], height: 260 },
]

export const DEFAULT_WIDTH_RATIOS: Record<string, number[]> = {
  '0': [0.6, 0.4],
  '1': [0.6, 0.4],
  '2': [1],
}

// ── Drop Zone Detection ────────────────────────────────────────────

export function getDropZone(
  e: React.DragEvent,
  rowIndex: number,
  panelCount: number,
  panelIndex?: number
): DropZone {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const relX = (e.clientX - rect.left) / rect.width
  const relY = (e.clientY - rect.top) / rect.height

  if (relX < 0.3 && panelCount < 3) {
    return { rowIndex, position: 'left', panelIndex: panelIndex ?? 0 }
  }
  if (relX > 0.7 && panelCount < 3) {
    return { rowIndex, position: 'right', panelIndex: panelIndex ?? panelCount - 1 }
  }
  if (relY < 0.5) {
    return { rowIndex, position: 'top' }
  }
  return { rowIndex, position: 'bottom' }
}

// ── Layout Mutation Helpers ────────────────────────────────────────

/** Compute even width ratios for a layout after structural changes */
export function computeWidthRatios(
  newLayout: LayoutRow[],
  existing: Record<string, number[]>
): Record<string, number[]> {
  const result: Record<string, number[]> = {}
  for (let i = 0; i < newLayout.length; i++) {
    const key = String(i)
    const row = newLayout[i]
    const prev = existing[key]
    if (prev && prev.length === row.panels.length) {
      result[key] = prev
    } else {
      result[key] = row.panels.map(() => 1 / row.panels.length)
    }
  }
  return result
}

/** Remove a panel from the layout, clean empty rows, return the new layout */
export function removePanelFromLayout(layout: LayoutRow[], panelId: PanelId): LayoutRow[] {
  const updated = layout.map((row) => ({
    ...row,
    panels: row.panels.filter((p) => p !== panelId),
  }))
  return updated.filter((row) => row.panels.length > 0)
}

/** Insert a panel into the layout at a drop zone */
export function insertPanelAtDropZone(
  layout: LayoutRow[],
  panelId: PanelId,
  zone: DropZone
): LayoutRow[] {
  const result = layout.map((r) => ({ ...r, panels: [...r.panels] }))
  let targetRow = Math.min(zone.rowIndex, result.length - 1)

  if (zone.position === 'left' || zone.position === 'right') {
    const row = result[targetRow]
    if (row) {
      const insertAt = zone.position === 'left'
        ? (zone.panelIndex ?? 0)
        : (zone.panelIndex ?? row.panels.length - 1) + 1
      row.panels.splice(insertAt, 0, panelId)
    }
  } else if (zone.position === 'top') {
    result.splice(targetRow, 0, { panels: [panelId], height: 200 })
  } else {
    result.splice(targetRow + 1, 0, { panels: [panelId], height: 200 })
  }

  return result
}

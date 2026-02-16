export interface PanelRegistryEntry {
  id: PanelId
  label: string
  menuLabel: string
  focusShortcutOrder?: number
}

export type PanelId =
  | 'chat'
  | 'terminal'
  | 'tokens'
  | 'scene3d'
  | 'activity'
  | 'agents'
  | 'recentMemories'
  | 'fileExplorer'
  | 'fileSearch'
  | 'filePreview'

export const PANEL_REGISTRY: readonly PanelRegistryEntry[] = [
  { id: 'chat', label: 'CHAT', menuLabel: 'Chat', focusShortcutOrder: 1 },
  { id: 'terminal', label: 'TERMINAL', menuLabel: 'Terminal', focusShortcutOrder: 2 },
  { id: 'tokens', label: 'TOKENS', menuLabel: 'Tokens', focusShortcutOrder: 3 },
  { id: 'scene3d', label: 'OFFICE', menuLabel: 'Office', focusShortcutOrder: 4 },
  { id: 'activity', label: 'ACTIVITY', menuLabel: 'Activity', focusShortcutOrder: 5 },
  { id: 'agents', label: 'AGENTS', menuLabel: 'Agents', focusShortcutOrder: 6 },
  { id: 'recentMemories', label: 'RECENT', menuLabel: 'Recent', focusShortcutOrder: 7 },
  { id: 'fileExplorer', label: 'EXPLORER', menuLabel: 'File Explorer' },
  { id: 'fileSearch', label: 'SEARCH', menuLabel: 'Search Files' },
  { id: 'filePreview', label: 'EDITOR', menuLabel: 'Editor' },
]

export const ALL_PANELS: PanelId[] = PANEL_REGISTRY.map((panel) => panel.id)

export const PANEL_LABELS: Record<PanelId, string> = Object.fromEntries(
  PANEL_REGISTRY.map((panel) => [panel.id, panel.label])
) as Record<PanelId, string>

export const PANEL_MENU_LABELS: Record<PanelId, string> = Object.fromEntries(
  PANEL_REGISTRY.map((panel) => [panel.id, panel.menuLabel])
) as Record<PanelId, string>

export const PANEL_SHORTCUT_ORDER: PanelId[] = PANEL_REGISTRY
  .filter((panel) => typeof panel.focusShortcutOrder === 'number')
  .sort((a, b) => (a.focusShortcutOrder ?? 999) - (b.focusShortcutOrder ?? 999))
  .map((panel) => panel.id)

export type PanelFocusChannel = `menu:focusPanel:${PanelId}`

export const PANEL_FOCUS_CHANNELS: PanelFocusChannel[] = ALL_PANELS
  .map((panelId) => `menu:focusPanel:${panelId}` as PanelFocusChannel)

const PANEL_SET = new Set<PanelId>(ALL_PANELS)

export function isPanelId(value: unknown): value is PanelId {
  return typeof value === 'string' && PANEL_SET.has(value as PanelId)
}

export function panelFocusChannel(panelId: PanelId): PanelFocusChannel {
  return `menu:focusPanel:${panelId}`
}

export function panelIdFromFocusChannel(channel: string): PanelId | null {
  const panelId = channel.split(':').pop() ?? ''
  return isPanelId(panelId) ? panelId : null
}

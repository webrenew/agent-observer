import { useEffect, useRef } from 'react'
import {
  type PanelId,
  PANEL_MENU_LABELS,
  PANEL_SHORTCUT_ORDER as PANEL_SHORTCUT_ORDER_FROM_REGISTRY,
} from '../../shared/panel-registry'

/**
 * Keyboard shortcut descriptor.
 *
 * `key` is the `KeyboardEvent.key` value (case-insensitive comparison).
 * Modifiers: `meta` = Cmd/Win, `ctrl`, `alt`, `shift`.
 * Use `metaOrCtrl` for cross-platform Cmd+key (Mac) / Ctrl+key (other).
 */
export interface Hotkey {
  key: string
  meta?: boolean
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  /** When true, uses Cmd on Mac, Ctrl on Windows/Linux */
  metaOrCtrl?: boolean
}

export interface HotkeyBinding {
  hotkey: Hotkey
  handler: () => void
  /** Human-readable label, e.g. "⌘1" — used for UI hints */
  label: string
  /** Description for accessibility / help screen */
  description?: string
}

const IS_MAC = navigator.platform.toUpperCase().includes('MAC')

function matches(e: KeyboardEvent, hk: Hotkey): boolean {
  const wantMeta = hk.meta ?? (hk.metaOrCtrl && IS_MAC) ?? false
  const wantCtrl = hk.ctrl ?? (hk.metaOrCtrl && !IS_MAC) ?? false
  const wantAlt = hk.alt ?? false
  const wantShift = hk.shift ?? false

  if (e.metaKey !== wantMeta) return false
  if (e.ctrlKey !== wantCtrl) return false
  if (e.altKey !== wantAlt) return false
  if (e.shiftKey !== wantShift) return false

  return e.key.toLowerCase() === hk.key.toLowerCase()
}

/**
 * Registers a set of keyboard shortcuts on `document`.
 * Bindings can change between renders — the latest array is always used.
 *
 * Shortcuts are NOT fired when the active element is an <input>, <textarea>,
 * or contentEditable node (unless the shortcut uses a modifier key).
 */
export function useHotkeys(bindings: HotkeyBinding[]): void {
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const active = document.activeElement
      const isEditable =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)

      for (const binding of bindingsRef.current) {
        if (matches(e, binding.hotkey)) {
          // Allow modifier shortcuts even in editable fields
          const hasModifier =
            binding.hotkey.meta ||
            binding.hotkey.ctrl ||
            binding.hotkey.alt ||
            binding.hotkey.metaOrCtrl

          if (isEditable && !hasModifier) continue

          e.preventDefault()
          e.stopPropagation()
          try {
            binding.handler()
          } catch (err) {
            console.error(`[useHotkeys] Handler for "${binding.label}" threw:`, err)
          }
          return
        }
      }
    }

    document.addEventListener('keydown', handler, true) // capture phase
    return () => document.removeEventListener('keydown', handler, true)
  }, [])
}

// ── Shortcut label helpers ─────────────────────────────────────────

const MOD = IS_MAC ? '⌘' : 'Ctrl+'
const ALT = IS_MAC ? '⌥' : 'Alt+'
const SHIFT = IS_MAC ? '⇧' : 'Shift+'

export function formatShortcut(hk: Hotkey): string {
  const parts: string[] = []
  if (hk.metaOrCtrl) parts.push(MOD)
  else if (hk.meta) parts.push(MOD)
  if (hk.ctrl && !hk.metaOrCtrl) parts.push('Ctrl+')
  if (hk.alt) parts.push(ALT)
  if (hk.shift) parts.push(SHIFT)

  const keyLabel = hk.key.length === 1 ? hk.key.toUpperCase() : hk.key
  parts.push(keyLabel)
  return parts.join('')
}

function buildPanelShortcut(panelId: PanelId, index: number) {
  const key = String(index + 1)
  return {
    hotkey: { key, metaOrCtrl: true },
    label: `${MOD}${key}`,
    description: `Focus ${PANEL_MENU_LABELS[panelId]}`,
  }
}

export const PANEL_SHORTCUT_ORDER = [...PANEL_SHORTCUT_ORDER_FROM_REGISTRY]

export const PANEL_SHORTCUTS: Record<PanelId, {
  hotkey: Hotkey
  label: string
  description: string
}> = Object.fromEntries(
  PANEL_SHORTCUT_ORDER.map((panelId, index) => [panelId, buildPanelShortcut(panelId, index)])
) as Record<PanelId, {
  hotkey: Hotkey
  label: string
  description: string
}>

// ── Pre-built shortcut definitions ─────────────────────────────────

export const SHORTCUTS = {
  // Panel switching (Cmd+1–8)
  focusChat:        PANEL_SHORTCUTS.chat,
  focusTerminal:    PANEL_SHORTCUTS.terminal,
  focusTokens:      PANEL_SHORTCUTS.tokens,
  focusOffice:      PANEL_SHORTCUTS.scene3d,
  focusActivity:    PANEL_SHORTCUTS.activity,
  focusAgents:      PANEL_SHORTCUTS.agents,
  focusRecent:      PANEL_SHORTCUTS.recentMemories,

  // Actions
  newTerminal:      { hotkey: { key: 'n', metaOrCtrl: true, shift: true }, label: `${MOD}${SHIFT}N`, description: 'New Terminal' },
  openSettings:     { hotkey: { key: ',', metaOrCtrl: true }, label: `${MOD},`, description: 'Open Settings' },
  openHelp:         { hotkey: { key: 'F1' }, label: 'F1', description: 'Open Help' },
  toggleSidebar:    { hotkey: { key: 'b', metaOrCtrl: true }, label: `${MOD}B`, description: 'Toggle Right Column' },
  resetLayout:      { hotkey: { key: 'r', metaOrCtrl: true, shift: true }, label: `${MOD}${SHIFT}R`, description: 'Reset Layout' },
  closePanel:       { hotkey: { key: 'w', metaOrCtrl: true }, label: `${MOD}W`, description: 'Close Active Panel' },
  toggleFullscreen: { hotkey: { key: 'Enter', metaOrCtrl: true, shift: true }, label: `${MOD}${SHIFT}Enter`, description: 'Toggle Fullscreen' },
  focusChatInput:   { hotkey: { key: '/', metaOrCtrl: true }, label: `${MOD}/`, description: 'Focus Chat Input' },
  openFolder:       { hotkey: { key: 'o', metaOrCtrl: true }, label: `${MOD}O`, description: 'Open Folder' },
  fileSearch:       { hotkey: { key: 'p', metaOrCtrl: true }, label: `${MOD}P`, description: 'Search Files' },
  fileExplorer:     { hotkey: { key: 'e', metaOrCtrl: true, shift: true }, label: `${MOD}${SHIFT}E`, description: 'File Explorer' },
  escape:           { hotkey: { key: 'Escape' }, label: 'Esc', description: 'Close Menus / Deselect' },
} as const

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAgentStore } from '../../../store/agents'
import { useSettingsStore } from '../../../store/settings'
import { TerminalTab } from '../../TerminalTab'
import { matchScope } from '../../../lib/scopeMatcher'
import { preloadSounds } from '../../../lib/soundPlayer'

// Preload sounds once
preloadSounds()

let terminalCounter = 0

/**
 * Stripped-down terminal panel for the workspace layout.
 * Only manages terminal tabs + xterm instances. Chat, Events, and
 * Tokens are now separate workspace panels.
 */
export function TerminalPanelWrapper() {
  const terminals = useAgentStore((s) => s.terminals)
  const activeTerminalId = useAgentStore((s) => s.activeTerminalId)
  const setActiveTerminal = useAgentStore((s) => s.setActiveTerminal)
  const addTerminal = useAgentStore((s) => s.addTerminal)
  const removeTerminal = useAgentStore((s) => s.removeTerminal)
  const removeAgent = useAgentStore((s) => s.removeAgent)
  const updateTerminal = useAgentStore((s) => s.updateTerminal)

  const [contextMenu, setContextMenu] = useState<{ terminalId: string; x: number; y: number } | null>(null)

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  const handleCreateTerminal = useCallback(async () => {
    try {
      const { id, cwd } = await window.electronAPI.terminal.create({ cols: 80, rows: 24 })
      terminalCounter++

      const { scopes } = useSettingsStore.getState().settings
      const matched = matchScope(cwd, scopes)

      addTerminal({
        id,
        label: `Terminal ${terminalCounter}`,
        isClaudeRunning: false,
        scopeId: matched?.id ?? null,
        cwd,
      })

      // Clean up on process exit
      const unsub = window.electronAPI.terminal.onExit((exitId) => {
        if (exitId === id) {
          removeAgent(id)
          removeTerminal(id)
          unsub()
        }
      })
    } catch (err) {
      console.error('Failed to create terminal:', err)
    }
  }, [addTerminal, removeTerminal, removeAgent])

  const handleCloseTerminal = useCallback(
    async (terminalId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await window.electronAPI.terminal.kill(terminalId)
      } catch (err) {
        console.error('Failed to kill terminal:', err)
      }
      removeAgent(terminalId)
      removeTerminal(terminalId)
    },
    [removeTerminal, removeAgent]
  )

  const getScopeColor = useCallback((terminalId: string) => {
    const term = terminals.find((t) => t.id === terminalId)
    if (!term?.scopeId) return 'transparent'
    const { scopes, defaultScope } = useSettingsStore.getState().settings
    const scope = scopes.find((s) => s.id === term.scopeId)
    return scope?.color ?? defaultScope.color
  }, [terminals])

  const handleTabContextMenu = useCallback((e: React.MouseEvent, terminalId: string) => {
    e.preventDefault()
    setContextMenu({ terminalId, x: e.clientX, y: e.clientY })
  }, [])

  const handleChangeScopeFromMenu = useCallback((terminalId: string, scopeId: string | null) => {
    updateTerminal(terminalId, { scopeId })
    setContextMenu(null)
  }, [updateTerminal])

  const handleAutoDetectScope = useCallback((terminalId: string) => {
    const term = terminals.find((t) => t.id === terminalId)
    if (!term?.cwd) {
      handleChangeScopeFromMenu(terminalId, null)
      return
    }
    const { scopes } = useSettingsStore.getState().settings
    const matched = matchScope(term.cwd, scopes)
    handleChangeScopeFromMenu(terminalId, matched?.id ?? null)
  }, [terminals, handleChangeScopeFromMenu])

  return (
    <div className="flex flex-col h-full w-full">
      {/* Tab bar */}
      <div className="flex items-center h-7 border-b border-white/5 px-1 gap-0.5 shrink-0">
        {terminals.map((term) => {
          const scopeColor = getScopeColor(term.id)
          const isActiveTab = activeTerminalId === term.id
          return (
            <button
              key={term.id}
              onClick={() => setActiveTerminal(term.id)}
              onContextMenu={(e) => handleTabContextMenu(e, term.id)}
              className={`flex items-center gap-1.5 px-2 h-6 rounded text-xs transition-colors ${
                isActiveTab ? 'bg-white/8 text-gray-300' : 'text-gray-600 hover:text-gray-400 hover:bg-white/4'
              }`}
              style={{
                borderLeft: isActiveTab ? `2px solid ${scopeColor}` : undefined,
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  term.isClaudeRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
                }`}
              />
              <span className="truncate max-w-[80px]">{term.label}</span>
              <span
                onClick={(e) => handleCloseTerminal(term.id, e)}
                className="ml-0.5 text-gray-600 hover:text-red-400 rounded transition-colors text-[10px]"
              >
                ×
              </span>
            </button>
          )
        })}

        {/* New terminal button */}
        <button
          onClick={handleCreateTerminal}
          className="flex items-center justify-center w-6 h-6 text-gray-600 hover:text-green-400 hover:bg-green-400/10 rounded transition-colors text-sm"
          title="New Terminal"
        >
          +
        </button>
      </div>

      {/* Context menu for scope switching */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#0e0e14] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Change Scope
          </div>
          <button
            onClick={() => handleAutoDetectScope(contextMenu.terminalId)}
            className="w-full px-3 py-1.5 text-xs text-left text-gray-400 hover:bg-white/5 transition-colors"
          >
            Auto-detect
          </button>
          <button
            onClick={() => handleChangeScopeFromMenu(contextMenu.terminalId, null)}
            className="w-full px-3 py-1.5 text-xs text-left text-gray-400 hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            None
          </button>
          {useSettingsStore.getState().settings.scopes.map((scope) => (
            <button
              key={scope.id}
              onClick={() => handleChangeScopeFromMenu(contextMenu.terminalId, scope.id)}
              className="w-full px-3 py-1.5 text-xs text-left text-gray-400 hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: scope.color }} />
              {scope.name}
            </button>
          ))}
        </div>
      )}

      {/* Terminal content */}
      <div className="flex-1 relative overflow-hidden">
        {terminals.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            Click <span className="text-green-400 mx-1 font-bold">+</span> to open a terminal
          </div>
        ) : (
          terminals.map((term) => (
            <TerminalTab
              key={term.id}
              terminalId={term.id}
              isActive={activeTerminalId === term.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

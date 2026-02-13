import { useRef, useEffect } from 'react'
import { useAgentStore } from '../../../store/agents'
import type { AgentEventType } from '../../../types'

const EVENT_BADGES: Record<AgentEventType, { label: string; bg: string; fg: string }> = {
  spawn:         { label: 'SPAWN',  bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
  exit:          { label: 'EXIT',   bg: 'rgba(251,146,60,0.15)',  fg: '#fb923c' },
  status_change: { label: 'STATE',  bg: 'rgba(96,165,250,0.15)',  fg: '#60a5fa' },
  file_write:    { label: 'FILE',   bg: 'rgba(167,139,250,0.15)', fg: '#a78bfa' },
  tool_call:     { label: 'TOOL',   bg: 'rgba(34,211,238,0.15)',  fg: '#22d3ee' },
  commit:        { label: 'GIT',    bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
  push:          { label: 'PUSH',   bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
  test_pass:     { label: 'PASS',   bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
  test_fail:     { label: 'FAIL',   bg: 'rgba(248,113,113,0.15)', fg: '#f87171' },
  build_pass:    { label: 'BUILD',  bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
  build_fail:    { label: 'BUILD',  bg: 'rgba(248,113,113,0.15)', fg: '#f87171' },
  error:         { label: 'ERR',    bg: 'rgba(248,113,113,0.15)', fg: '#f87171' },
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function ActivityPanel() {
  const events = useAgentStore((s) => s.events)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [events.length])

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {events.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-xs">
            No activity yet. Start a terminal or chat session.
          </div>
        )}
        {events.map((evt) => {
          const badge = EVENT_BADGES[evt.type] ?? { label: evt.type.toUpperCase(), bg: 'rgba(89,86,83,0.15)', fg: '#595653' }
          return (
            <div key={evt.id} className="ws-hover-row flex items-start gap-2 text-xs">
              <span className="text-gray-600 shrink-0 tabular-nums" style={{ fontSize: 10 }}>
                {formatTime(evt.timestamp)}
              </span>
              <span
                className="ws-badge shrink-0"
                style={{ background: badge.bg, color: badge.fg }}
              >
                {badge.label}
              </span>
              <span className="text-gray-400 truncate flex-1" title={evt.description}>
                {evt.description}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

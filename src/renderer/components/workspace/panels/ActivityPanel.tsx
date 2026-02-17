import { useRef, useEffect, useMemo } from 'react'
import { useAgentStore } from '../../../store/agents'
import { CollapsibleSection } from '../CollapsibleSection'
import { Sparkline } from '../Sparkline'
import type { AgentEventType } from '../../../types'

const BADGE_STYLES: Record<string, { label: string; color: string }> = {
  spawn: { label: 'MAIN', color: '#d4a040' },
  exit: { label: 'EXIT', color: '#74747C' },
  status_change: { label: 'STATE', color: '#d4a040' },
  file_write: { label: 'FILE', color: '#4C89D9' },
  tool_call: { label: 'TOOL', color: '#4C89D9' },
  commit: { label: 'GIT', color: '#d4a040' },
  push: { label: 'GIT', color: '#d4a040' },
  test_pass: { label: 'TEST', color: '#548C5A' },
  test_fail: { label: 'TEST', color: '#c45050' },
  build_pass: { label: 'BUILD', color: '#548C5A' },
  build_fail: { label: 'BUILD', color: '#c45050' },
  error: { label: 'ERROR', color: '#c45050' },
}

function firstToolToken(description: string): string {
  const token = description
    .trim()
    .split(/[\s:(]+/, 1)[0]
    ?.toLowerCase() ?? ''
  return token
}

function resolveToolBadge(description: string): { label: string; color: string } {
  const tool = firstToolToken(description)
  // CRON is reserved for scheduled recurring tasks.
  if (tool === 'cron' || tool === 'schedule' || tool === 'scheduler') {
    return { label: 'CRON', color: '#548C5A' }
  }
  if (tool === 'glob') {
    return { label: 'GLOB', color: '#4C89D9' }
  }
  if (tool === 'grep') {
    return { label: 'GREP', color: '#4C89D9' }
  }
  if (tool === 'read') {
    return { label: 'READ', color: '#4C89D9' }
  }
  if (tool === 'todowrite') {
    return { label: 'TODO', color: '#4C89D9' }
  }
  return BADGE_STYLES.tool_call
}

function resolveBadge(type: AgentEventType, description: string): { label: string; color: string } {
  if (type === 'tool_call') return resolveToolBadge(description)
  return BADGE_STYLES[type] ?? { label: 'EVENT', color: '#595653' }
}

/** Generate a deterministic sparkline from a string hash */
function sparkFromString(s: string): number[] {
  if (!s.length) return [1, 2, 3, 4, 5, 6, 7]
  const result: number[] = []
  for (let i = 0; i < 7; i++) {
    const code = s.charCodeAt(i % s.length) || 42
    result.push(((code * (i + 1)) % 9) + 1)
  }
  return result
}

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export function ActivityPanel() {
  const events = useAgentStore((s) => s.events)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Show most recent first; store already caps overall history size.
  const displayEvents = useMemo(() => [...events].reverse(), [events])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = 0
  }, [events.length])

  return (
    <CollapsibleSection title="ACTIVITY" fill>
      <div
        ref={scrollRef}
        style={{
          padding: '0 16px 10px',
          overflowY: 'auto',
          overflowX: 'hidden',
          height: '100%',
          minHeight: 0,
        }}
      >
        {displayEvents.length === 0 && (
          <div style={{ color: '#595653', fontSize: 12, padding: '8px 0' }}>
            No activity yet
          </div>
        )}
        {displayEvents.map((evt) => {
          const badge = resolveBadge(evt.type, evt.description)
          const spark = sparkFromString(evt.description)
          return (
            <div
              key={evt.id}
              className="hover-row tooltip-wrapper"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span
                  style={{
                    background: badge.color,
                    color: '#0E0E0D',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 3,
                    letterSpacing: 0.5,
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  {badge.label}
                </span>
                <span
                  style={{
                    color: '#9A9692',
                    fontSize: 'inherit',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {evt.description}
                </span>
                <span className="tooltip-text">{evt.description}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <Sparkline data={spark} color={badge.color} />
                <span style={{ color: '#595653', fontSize: 12 }}>{formatTimeAgo(evt.timestamp)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}

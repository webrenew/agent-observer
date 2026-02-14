import { useMemo } from 'react'
import { useAgentStore } from '../../../store/agents'
import { CollapsibleSection } from '../CollapsibleSection'

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

/** Map event type to dot color — older events get green accent, newer get neutral */
function dotColor(index: number): string {
  return index < 5 ? '#9A9692' : '#548C5A'
}

export function RecentMemoriesPanel() {
  const events = useAgentStore((s) => s.events)

  const displayItems = useMemo(
    () => [...events].reverse().slice(0, 12),
    [events]
  )

  return (
    <CollapsibleSection title="RECENT MEMORIES">
      <div style={{ padding: '0 16px 10px' }}>
        {displayItems.length === 0 && (
          <div style={{ color: '#595653', fontSize: 12, padding: '8px 0' }}>
            No recent memories
          </div>
        )}
        {displayItems.map((evt, i) => (
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
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: dotColor(i),
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
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
            <span style={{ color: '#595653', fontSize: 12, flexShrink: 0 }}>
              {formatTimeAgo(evt.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}

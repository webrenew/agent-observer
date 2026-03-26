import { useMemo } from 'react'
import { useRunHistoryStore } from '../store/runHistory'
import { useWorkspaceStore } from '../store/workspace'
import { deriveDailyDigest } from '../lib/soloDevCockpit'

export function SoloOperatorPanel({ onClose }: { onClose?: () => void }) {
  const runs = useRunHistoryStore((s) => s.runs)
  const officeFocusMode = useRunHistoryStore((s) => s.officeFocusMode)
  const setOfficeFocusMode = useRunHistoryStore((s) => s.setOfficeFocusMode)
  const workspaceRoot = useWorkspaceStore((s) => s.rootPath)

  const digest = useMemo(() => {
    return deriveDailyDigest(runs, { workspaceDirectory: workspaceRoot ?? null })
  }, [runs, workspaceRoot])

  const focusOptions: Array<{ id: typeof officeFocusMode; label: string }> = [
    { id: 'follow-active', label: 'Follow active' },
    { id: 'show-errors', label: 'Errors only' },
    { id: 'changed-files', label: 'Changed files' },
  ]

  return (
    <div
      className="glass-panel"
      style={{
        width: 300,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(17,18,17,0.9), rgba(10,10,10,0.85))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            OFFICE CONTROL
          </div>
          <div style={{ marginTop: 6, color: '#ECE7DE', fontSize: 16, fontWeight: 700 }}>
            Daily operator digest
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: '1px solid rgba(89,86,83,0.25)',
              background: 'transparent',
              color: '#74747C',
              fontSize: 14,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Close digest"
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {focusOptions.map((option) => {
          const active = option.id === officeFocusMode
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setOfficeFocusMode(option.id)}
              style={{
                border: active ? '1px solid rgba(84,140,90,0.45)' : '1px solid rgba(89,86,83,0.2)',
                background: active ? 'rgba(84,140,90,0.12)' : 'rgba(12,12,11,0.42)',
                color: active ? '#D9E6DA' : '#8F8B87',
                borderRadius: 999,
                padding: '6px 9px',
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        <DigestStat label="Runs today" value={digest.totalRuns} color="#ECE7DE" />
        <DigestStat label="Succeeded" value={digest.successRuns} color="#548C5A" />
        <DigestStat label="Failed" value={digest.failedRuns} color="#c45050" />
        <DigestStat label="Running" value={digest.runningRuns} color="#4C89D9" />
        <DigestStat label="Input" value={formatCompactNumber(digest.inputTokens)} color="#ECE7DE" />
        <DigestStat label="Output" value={formatCompactNumber(digest.outputTokens)} color="#ECE7DE" />
      </div>

      <div
        style={{
          padding: '10px 11px',
          borderRadius: 10,
          border: '1px solid rgba(89,86,83,0.18)',
          background: 'rgba(12,12,11,0.52)',
        }}
      >
        <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
          TOP CHANGED FILES
        </div>
        {digest.topChangedFiles.length > 0 ? (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {digest.topChangedFiles.map((entry) => (
              <div key={entry.path} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    color: '#9A9692',
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={entry.path}
                >
                  {entry.path}
                </span>
                <span style={{ color: '#7D9B82', fontSize: 11, fontWeight: 700 }}>{entry.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 8, color: '#8F8B87', fontSize: 11 }}>
            No changed-file activity recorded today.
          </div>
        )}
      </div>

      <div style={{ color: '#8F8B87', fontSize: 11 }}>
        Token cost today: <span style={{ color: '#E4D0A3', fontWeight: 700 }}>${digest.estimatedCostUsd.toFixed(3)}</span>
      </div>
    </div>
  )
}

function DigestStat({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div
      style={{
        padding: '9px 10px',
        borderRadius: 10,
        border: '1px solid rgba(89,86,83,0.18)',
        background: 'rgba(12,12,11,0.52)',
      }}
    >
      <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ marginTop: 4, color, fontSize: 16, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  )
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

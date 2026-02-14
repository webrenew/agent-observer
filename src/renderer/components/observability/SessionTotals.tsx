import type { Agent } from '../../types'
import { useSettingsStore } from '../../store/settings'
import { calculateTotalCost } from '../../lib/costEngine'

interface Props {
  agents: Agent[]
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: '#74747C', fontWeight: 600, letterSpacing: 1 }}>{label}</span>
      <span style={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 'inherit', color: color ?? '#9A9692' }}>
        {value}
      </span>
    </div>
  )
}

export function SessionTotals({ agents }: Props) {
  const subscription = useSettingsStore((s) => s.settings.subscription)

  const totalIn = agents.reduce((s, a) => s + a.tokens_input, 0)
  const totalOut = agents.reduce((s, a) => s + a.tokens_output, 0)

  const allModelTokens: Record<string, { input: number; output: number }> = {}
  for (const agent of agents) {
    for (const [model, t] of Object.entries(agent.sessionStats.tokensByModel)) {
      const prev = allModelTokens[model] ?? { input: 0, output: 0 }
      allModelTokens[model] = { input: prev.input + t.input, output: prev.output + t.output }
    }
  }

  const cost = Object.keys(allModelTokens).length > 0
    ? calculateTotalCost(allModelTokens)
    : (totalIn * 3 + totalOut * 15) / 1_000_000

  const isMax = subscription?.type === 'max_5x' || subscription?.type === 'max_20x'

  return (
    <div
      style={{
        borderTop: '1px solid rgba(89,86,83,0.2)', padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 20, fontSize: 'inherit',
        background: 'rgba(14,14,13,0.6)', flexShrink: 0,
      }}
    >
      <Stat label="TOTAL IN" value={formatTokens(totalIn)} />
      <Stat label="TOTAL OUT" value={formatTokens(totalOut)} />

      {isMax && cost > 0 ? (
        <>
          <Stat label="SAVED" value={`$${cost.toFixed(3)}`} color="#548C5A" />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
            <span
              className="glow-green"
              style={{ background: '#1a3a1a', color: '#548C5A', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3 }}
            >
              Claude Max
            </span>
            <span style={{ color: '#548C5A' }}>Saved ~${cost.toFixed(2)} this session</span>
          </div>
        </>
      ) : (
        <Stat label="EST. COST" value={`$${cost.toFixed(3)}`} color="#d4a040" />
      )}
    </div>
  )
}

import { calculateCost, shortModelName } from '../../lib/costEngine'

interface Props {
  tokensByModel: Record<string, { input: number; output: number }>
}

export function CostBreakdown({ tokensByModel }: Props) {
  const entries = Object.entries(tokensByModel)
  if (entries.length === 0) {
    return (
      <div className="glass-panel" style={{ borderRadius: 6, padding: 14, color: '#595653', fontSize: 'inherit' }}>
        No token data yet
      </div>
    )
  }

  let totalCost = 0
  const rows = entries.map(([model, tokens]) => {
    const cost = calculateCost(model, tokens.input, tokens.output)
    totalCost += cost
    return { model, ...tokens, cost }
  })

  return (
    <div className="glass-panel" style={{ borderRadius: 6, padding: 14 }}>
      <div style={{ fontSize: 10, color: '#74747C', fontWeight: 600, letterSpacing: 1, marginBottom: 10 }}>
        COST BREAKDOWN
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row) => (
          <div key={row.model} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'inherit' }}>
            <span style={{ color: '#74747C', fontFamily: 'inherit', fontSize: 12 }}>{shortModelName(row.model)}</span>
            <span style={{ color: '#d4a040', fontFamily: 'inherit' }}>${row.cost.toFixed(4)}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(89,86,83,0.2)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#74747C', fontSize: 'inherit' }}>Total</span>
        <span className="glow-amber" style={{ color: '#d4a040', fontFamily: 'inherit', fontWeight: 600 }}>${totalCost.toFixed(4)}</span>
      </div>
    </div>
  )
}

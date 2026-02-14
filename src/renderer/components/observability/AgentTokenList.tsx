import type { Agent, AgentStatus } from '../../types'

interface Props {
  agents: Agent[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function statusColor(status: AgentStatus): string {
  switch (status) {
    case 'streaming': return '#d4a040'
    case 'thinking': return '#c87830'
    case 'tool_calling': return '#d4a040'
    case 'error': return '#c45050'
    case 'done': return '#548C5A'
    case 'waiting': return '#74747C'
    default: return '#595653'
  }
}

export function AgentTokenList({ agents, selectedId, onSelect }: Props) {
  const maxTokens = Math.max(...agents.map((a) => a.tokens_input + a.tokens_output), 1)

  return (
    <div style={{ width: 220, borderRight: '1px solid rgba(89,86,83,0.2)', overflowY: 'auto' }}>
      <div style={{ padding: '10px 14px', fontSize: 11, color: '#74747C', fontWeight: 600, letterSpacing: 1 }}>
        AGENTS ({agents.length})
      </div>
      {agents.map((agent) => {
        const total = agent.tokens_input + agent.tokens_output
        const pct = (total / maxTokens) * 100
        const isSelected = agent.id === selectedId

        return (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className="hover-row"
            style={{
              width: '100%', textAlign: 'left', padding: '8px 14px',
              borderBottom: '1px solid rgba(89,86,83,0.15)', cursor: 'pointer',
              background: isSelected ? 'rgba(89,86,83,0.15)' : 'transparent',
              border: 'none', fontFamily: 'inherit', display: 'block',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 'inherit', fontWeight: 500, color: '#9A9692', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agent.name}
              </span>
              <span
                style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusColor(agent.status), flexShrink: 0 }}
              />
            </div>
            <div style={{ height: 4, background: 'rgba(89,86,83,0.2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#d4a040', borderRadius: 2, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: '#595653', marginTop: 4, fontFamily: 'inherit' }}>
              {formatTokens(total)} tokens
            </div>
          </button>
        )
      })}
    </div>
  )
}

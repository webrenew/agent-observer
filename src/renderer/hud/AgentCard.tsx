import { useAgentStore } from '../store/agents'
import { AGENT_COLORS, STATUS_LABELS } from '../types'
import { calculateCost } from '../lib/costEngine'

export function AgentCard() {
  const selectedId = useAgentStore((s) => s.selectedAgentId)
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === selectedId))
  const selectAgent = useAgentStore((s) => s.selectAgent)

  if (!agent) return null

  const color = AGENT_COLORS[agent.agent_type]
  const uptime = Math.floor((Date.now() - agent.started_at) / 1000)
  const uptimeStr =
    uptime >= 3600
      ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
      : uptime >= 60
        ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
        : `${uptime}s`

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute', left: 16, bottom: 16, width: 300,
        borderRadius: 10, padding: 14, pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
            <h3 style={{ fontWeight: 600, fontSize: 15, color: '#9A9692', margin: 0 }}>{agent.name}</h3>
          </div>
          <span style={{ fontSize: 10, color: '#74747C', fontWeight: 600, letterSpacing: 1 }}>
            {agent.agent_type}
          </span>
        </div>
        <button
          onClick={() => selectAgent(null)}
          style={{ background: 'transparent', border: 'none', color: '#595653', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}
        >
          x
        </button>
      </div>

      <div
        style={{
          display: 'inline-flex', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500,
          marginBottom: 10,
          backgroundColor: statusColor(agent.status) + '22',
          color: statusColor(agent.status),
        }}
      >
        {STATUS_LABELS[agent.status]}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'inherit' }}>
        <Row label="Task" value={agent.currentTask} />
        <Row label="Model" value={agent.model} />
        <Row label="Tokens In" value={agent.tokens_input.toLocaleString()} />
        <Row label="Tokens Out" value={agent.tokens_output.toLocaleString()} />
        <Row label="Files Modified" value={String(agent.files_modified)} />
        <Row label="Uptime" value={uptimeStr} />
        <Row
          label="Est. Cost"
          value={`$${Object.entries(agent.sessionStats?.tokensByModel ?? {}).reduce(
            (sum, [model, t]) => sum + calculateCost(model, t.input, t.output),
            0
          ).toFixed(4)}`}
        />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#74747C' }}>{label}</span>
      <span style={{ fontFamily: 'inherit', color: '#9A9692', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )
}

function statusColor(status: string): string {
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

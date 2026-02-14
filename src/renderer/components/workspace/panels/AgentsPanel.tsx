import { useAgentStore } from '../../../store/agents'
import { CollapsibleSection } from '../CollapsibleSection'
import type { Agent } from '../../../types'

function formatUptime(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m${s.toString().padStart(2, '0')}s`
}

function AgentRow({ agent }: { agent: Agent }) {
  const isActive = agent.status !== 'done' && agent.status !== 'idle'

  return (
    <div
      className="hover-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        gap: 12,
        fontSize: 'inherit',
      }}
    >
      <span style={{ color: '#9A9692', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {agent.name}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          className={isActive ? 'pulse-dot' : ''}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isActive ? '#548C5A' : '#595653',
            display: 'inline-block',
          }}
        />
        <span style={{ color: '#74747C' }}>{isActive ? 'run' : 'idle'}</span>
      </span>
      <span style={{ color: '#74747C' }}>{formatUptime(agent.started_at)}</span>
      <span style={{ color: '#74747C' }}>{agent.model || 'default'}</span>
    </div>
  )
}

export function AgentsPanel() {
  const agents = useAgentStore((s) => s.agents)

  return (
    <CollapsibleSection title="AGENTS">
      <div style={{ padding: '0 16px 10px' }}>
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto',
            gap: 12,
            padding: '4px 0',
            color: '#595653',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          <span>AGENT</span>
          <span>STATUS</span>
          <span>TIME</span>
          <span>MODEL</span>
        </div>
        {agents.length === 0 && (
          <div style={{ color: '#595653', fontSize: 12, padding: '8px 0' }}>
            No agents running
          </div>
        )}
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </div>
    </CollapsibleSection>
  )
}

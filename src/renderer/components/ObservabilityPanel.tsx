import { useState } from 'react'
import { useAgentsByTokenUsage } from '../store/selectors'
import { AgentTokenList } from './observability/AgentTokenList'
import { AgentTokenDetail } from './observability/AgentTokenDetail'
import { SessionTotals } from './observability/SessionTotals'

export function ObservabilityPanel() {
  const agents = useAgentsByTokenUsage()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = agents.find((a) => a.id === selectedId) ?? agents[0] ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0E0E0D', color: '#9A9692' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AgentTokenList
          agents={agents}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
        />
        {selected ? (
          <AgentTokenDetail agent={selected} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#595653', fontSize: 'inherit' }}>
            No active agents
          </div>
        )}
      </div>
      <SessionTotals agents={agents} />
    </div>
  )
}

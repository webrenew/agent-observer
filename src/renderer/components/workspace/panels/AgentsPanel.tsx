import { useAgentStore } from '../../../store/agents'
import { AGENT_COLORS, STATUS_LABELS } from '../../../types'
import type { Agent } from '../../../types'

function formatUptime(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function AgentRow({ agent }: { agent: Agent }) {
  const selectAgent = useAgentStore((s) => s.selectAgent)
  const selectedId = useAgentStore((s) => s.selectedAgentId)
  const isSelected = selectedId === agent.id
  const color = AGENT_COLORS[agent.agent_type]
  const isActive = agent.status !== 'done' && agent.status !== 'idle'

  return (
    <button
      type="button"
      onClick={() => selectAgent(agent.id)}
      className={`ws-hover-row flex items-center gap-3 w-full text-left text-xs transition-colors ${
        isSelected ? 'bg-white/5' : ''
      }`}
    >
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'ws-pulse-dot' : ''}`}
        style={{ background: isActive ? '#4ade80' : '#595653' }}
      />

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-300 font-medium truncate">{agent.name}</span>
          <span
            className="ws-badge"
            style={{ background: `${color}20`, color }}
          >
            {agent.agent_type.toUpperCase()}
          </span>
        </div>
        <div className="text-gray-600 truncate" style={{ fontSize: 10 }}>
          {STATUS_LABELS[agent.status]} · {agent.model || 'unknown'} · {formatUptime(agent.started_at)}
        </div>
      </div>

      {/* Tokens */}
      <div className="text-right shrink-0">
        <div className="text-gray-500 tabular-nums">
          {formatTokens(agent.tokens_input + agent.tokens_output)}
        </div>
        <div className="text-gray-600" style={{ fontSize: 10 }}>tokens</div>
      </div>
    </button>
  )
}

export function AgentsPanel() {
  const agents = useAgentStore((s) => s.agents)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {agents.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-xs">
            No agents running. Start one in the Chat or Terminal panel.
          </div>
        )}
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </div>
      {agents.length > 0 && (
        <div className="border-t border-white/5 px-3 py-2 text-xs text-gray-600 flex justify-between">
          <span>{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
          <span>{agents.filter((a) => a.status !== 'done' && a.status !== 'idle').length} active</span>
        </div>
      )}
    </div>
  )
}

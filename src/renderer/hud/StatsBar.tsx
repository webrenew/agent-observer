import { useAgentStore } from '../store/agents'
import { useSettingsStore } from '../store/settings'
import { calculateTotalCost } from '../lib/costEngine'
import { useWorkspaceIntelligenceStore } from '../store/workspaceIntelligence'

export function StatsBar() {
  const agents = useAgentStore((s) => s.agents)
  const subscription = useSettingsStore((s) => s.settings.subscription)
  const latestReward = useWorkspaceIntelligenceStore((s) => s.rewards[s.rewards.length - 1] ?? null)
  const primaryAgents = agents.filter((a) => !a.isSubagent)

  const activeCount = primaryAgents.filter(
    (a) => a.status !== 'idle' && a.status !== 'done'
  ).length
  const totalTokensIn = primaryAgents.reduce((s, a) => s + a.tokens_input, 0)
  const totalTokensOut = primaryAgents.reduce((s, a) => s + a.tokens_output, 0)
  const totalFiles = primaryAgents.reduce((s, a) => s + a.files_modified, 0)

  const allModelTokens = primaryAgents.reduce<Record<string, { input: number; output: number }>>(
    (acc, a) => {
      for (const [model, t] of Object.entries(a.sessionStats?.tokensByModel ?? {})) {
        const prev = acc[model] ?? { input: 0, output: 0 }
        acc[model] = { input: prev.input + t.input, output: prev.output + t.output }
      }
      return acc
    },
    {}
  )
  const cost = Object.keys(allModelTokens).length > 0
    ? calculateTotalCost(allModelTokens)
    : (totalTokensIn * 3 + totalTokensOut * 15) / 1_000_000

  const isMax = subscription?.type === 'max_5x' || subscription?.type === 'max_20x'

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex', alignItems: 'center', gap: 20, padding: '6px 16px',
        borderRadius: '0 0 8px 8px', borderTop: 'none', fontSize: 'inherit',
      }}
    >
      <Stat label="Active" value={activeCount} color="#548C5A" />
      <Stat label="Tokens In" value={formatNum(totalTokensIn)} />
      <Stat label="Tokens Out" value={formatNum(totalTokensOut)} />
      <Stat label="Files" value={totalFiles} />
      <Stat
        label="Context"
        value={latestReward ? latestReward.contextFiles : 0}
        color="#4C89D9"
      />
      <Stat
        label="Reward"
        value={latestReward ? latestReward.rewardScore : '--'}
        color={
          latestReward
            ? latestReward.rewardScore >= 75
              ? '#548C5A'
              : latestReward.rewardScore >= 45
                ? '#d4a040'
                : '#c45050'
            : '#595653'
        }
      />

      {isMax && cost > 0 ? (
        <>
          <Stat label="Saved" value={`$${cost.toFixed(3)}`} color="#548C5A" />
          <span
            style={{
              padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
              background: '#1a3a1a', color: '#548C5A',
            }}
          >
            Max
          </span>
        </>
      ) : (
        <Stat label="Est. Cost" value={`$${cost.toFixed(3)}`} color="#d4a040" />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  color
}: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#74747C', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>{label}</span>
      <span style={{ fontFamily: 'inherit', fontWeight: 600, color: color ?? '#9A9692' }}>
        {value}
      </span>
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

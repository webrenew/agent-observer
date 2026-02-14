import { useMemo } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Room } from './Room'
import { Lighting } from './Lighting'
import { Desk } from './Desk'
import { AgentCharacter } from './AgentCharacter'
import { OfficeCat } from './OfficeCat'
import { useAgentStore } from '../store/agents'
import { useWorkspaceStore } from '../store/workspace'
import { useWorkspaceIntelligenceStore } from '../store/workspaceIntelligence'
import { OfficeSignals } from './OfficeSignals'

const COLS = 2
const X_SPACING = 3.0
const Z_SPACING = 3.5
const X_OFFSET = -1.0
const Z_OFFSET = -2.0

function computeDeskPosition(index: number): [number, number, number] {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return [X_OFFSET + col * X_SPACING, 0, Z_OFFSET + row * Z_SPACING]
}

export function Office() {
  const agents = useAgentStore((s) => s.agents)
  const chatSessions = useAgentStore((s) => s.chatSessions)
  const activeChatSessionId = useAgentStore((s) => s.activeChatSessionId)
  const workspaceRoot = useWorkspaceStore((s) => s.rootPath)
  const snapshots = useWorkspaceIntelligenceStore((s) => s.snapshots)
  const rewards = useWorkspaceIntelligenceStore((s) => s.rewards)

  // Show only primary chat/terminal agents in Office.
  const deskAgents = useMemo(() => agents.filter((a) => !a.isSubagent), [agents])

  const activeWorkspaceDirectory = useMemo(() => {
    const activeChat = chatSessions.find((session) => session.id === activeChatSessionId) ?? null
    return activeChat?.workingDirectory ?? workspaceRoot ?? null
  }, [activeChatSessionId, chatSessions, workspaceRoot])

  const scopedRewards = useMemo(() => {
    if (!activeWorkspaceDirectory) return rewards
    return rewards.filter((reward) => reward.workspaceDirectory === activeWorkspaceDirectory)
  }, [activeWorkspaceDirectory, rewards])

  const latestReward = scopedRewards[scopedRewards.length - 1] ?? null
  const recentRewards = scopedRewards.slice(-10)
  const successCount = recentRewards.filter((reward) => reward.status === 'success').length
  const successRate = recentRewards.length > 0 ? successCount / recentRewards.length : 0
  const activeSnapshot = activeWorkspaceDirectory ? snapshots[activeWorkspaceDirectory] : undefined
  const contextCoverage = latestReward
    ? latestReward.contextScore
    : Math.min(1, (activeSnapshot?.keyFiles.length ?? 0) / 8)
  const contextFiles = latestReward?.contextFiles ?? activeSnapshot?.keyFiles.length ?? 0
  const dirtyFiles = activeSnapshot?.gitDirtyFiles ?? 0

  // Only show desks for active desk agents — no empty desks
  const maxIndex = deskAgents.length > 0 ? Math.max(...deskAgents.map((a) => a.deskIndex)) : -1
  const deskCount = deskAgents.length > 0 ? Math.max(deskAgents.length, maxIndex + 1) : 0

  const deskSlots = useMemo(() => {
    return Array.from({ length: deskCount }, (_, i) => ({
      index: i,
      position: computeDeskPosition(i)
    }))
  }, [deskCount])

  return (
    <>
      <Lighting />
      <Room />

      {deskSlots.map(({ index, position }) => {
        const agent = deskAgents.find((a) => a.deskIndex === index)
        return (
          <group key={index}>
            <Desk
              position={position}
              status={agent?.status ?? 'idle'}
              tokensUsed={(agent?.tokens_input ?? 0) + (agent?.tokens_output ?? 0)}
            />
            {agent && <AgentCharacter agent={agent} position={position} />}
          </group>
        )
      })}

      <OfficeCat />

      {/* Filing cabinet near back wall */}
      <mesh position={[4.5, 0.5, -5.5]} castShadow>
        <boxGeometry args={[0.8, 1, 0.5]} />
        <meshStandardMaterial color="#6b7280" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[4.5, 0.25, -5.25]}>
        <boxGeometry args={[0.6, 0.08, 0.02]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[4.5, 0.75, -5.25]}>
        <boxGeometry args={[0.6, 0.08, 0.02]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>

      {/* Water cooler */}
      <group position={[-5.5, 0, 3]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[0.3, 0.8, 0.3]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.3, 8]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.7} />
        </mesh>
      </group>

      {/* Whiteboard on back wall */}
      <mesh position={[3, 2.8, -6.85]}>
        <boxGeometry args={[2.5, 1.5, 0.05]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[3, 2.8, -6.82]}>
        <boxGeometry args={[2.3, 1.3, 0.02]} />
        <meshStandardMaterial color="#fff" />
      </mesh>

      <OfficeSignals
        contextCoverage={contextCoverage}
        rewardScore={latestReward?.rewardScore ?? null}
        successRate={successRate}
        contextFiles={contextFiles}
        dirtyFiles={dirtyFiles}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 1, 0]}
      />
    </>
  )
}

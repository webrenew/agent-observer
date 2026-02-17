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
import { PizzaParty } from './effects/PizzaParty'

const COLS = 2
const X_SPACING = 3.0
const Z_SPACING = 3.5
const X_OFFSET = -1.0
const Z_OFFSET = -2.0
const DESK_FACING_Y = Math.PI
const PARTY_CENTER: [number, number, number] = [4.2, 0, 2.2]
const PARTY_RADIUS = 1.25
const SNACK_BAR_POSITION: [number, number, number] = [6.35, 0, 4.55]

function computeDeskPosition(index: number): [number, number, number] {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return [X_OFFSET + col * X_SPACING, 0, Z_OFFSET + row * Z_SPACING]
}

function computePartySeatPosition(index: number, total: number): [number, number, number] {
  const count = Math.max(3, total)
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return [
    PARTY_CENTER[0] + Math.cos(angle) * PARTY_RADIUS,
    0,
    PARTY_CENTER[2] + Math.sin(angle) * PARTY_RADIUS,
  ]
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
  const partyAgents = useMemo(
    () => deskAgents
      .filter((agent) => agent.activeCelebration === 'pizza_party')
      .sort((a, b) => a.deskIndex - b.deskIndex),
    [deskAgents]
  )
  const partySeatByAgentId = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    for (let index = 0; index < partyAgents.length; index += 1) {
      map.set(
        partyAgents[index].id,
        computePartySeatPosition(index, partyAgents.length)
      )
    }
    return map
  }, [partyAgents])
  const partyWaveKey = partyAgents.reduce(
    (latest, agent) => Math.max(latest, agent.celebrationStartedAt ?? 0),
    0
  )

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
            {agent && (
              <AgentCharacter
                agent={agent}
                position={position}
                facingY={DESK_FACING_Y}
                partySeatPosition={partySeatByAgentId.get(agent.id) ?? null}
                partyLookAtPosition={PARTY_CENTER}
              />
            )}
          </group>
        )
      })}

      {partyAgents.length > 0 && (
        <group>
          {/* Pizza table where agents gather during a party */}
          <mesh position={[PARTY_CENTER[0], 0.72, PARTY_CENTER[2]]} castShadow receiveShadow>
            <cylinderGeometry args={[0.95, 0.95, 0.06, 24]} />
            <meshStandardMaterial color="#6b4a35" roughness={0.55} />
          </mesh>
          <mesh position={[PARTY_CENTER[0], 0.38, PARTY_CENTER[2]]} castShadow>
            <cylinderGeometry args={[0.11, 0.16, 0.72, 10]} />
            <meshStandardMaterial color="#4a3728" />
          </mesh>
          <mesh position={[PARTY_CENTER[0], 0.02, PARTY_CENTER[2]]}>
            <cylinderGeometry args={[0.45, 0.45, 0.04, 14]} />
            <meshStandardMaterial color="#4a3728" />
          </mesh>

          {/* Party spread */}
          <mesh position={[PARTY_CENTER[0] - 0.2, 0.77, PARTY_CENTER[2] - 0.06]} castShadow>
            <boxGeometry args={[0.46, 0.035, 0.46]} />
            <meshStandardMaterial color="#c87830" roughness={0.8} />
          </mesh>
          <mesh position={[PARTY_CENTER[0] + 0.16, 0.79, PARTY_CENTER[2] + 0.03]} castShadow>
            <cylinderGeometry args={[0.19, 0.19, 0.02, 24]} />
            <meshStandardMaterial color="#f4d03f" roughness={0.58} />
          </mesh>
          {Array.from({ length: 6 }, (_, index) => {
            const angle = (index / 6) * Math.PI * 2
            return (
              <mesh
                key={`party-slice-${index}`}
                position={[
                  PARTY_CENTER[0] + 0.16 + Math.cos(angle) * 0.09,
                  0.805,
                  PARTY_CENTER[2] + 0.03 + Math.sin(angle) * 0.09,
                ]}
                rotation={[0, -angle, 0]}
              >
                <boxGeometry args={[0.075, 0.008, 0.03]} />
                <meshStandardMaterial color="#c45050" />
              </mesh>
            )
          })}

          {/* Party accent lights */}
          <pointLight
            position={[PARTY_CENTER[0] - 1.1, 2.4, PARTY_CENTER[2] - 0.7]}
            color="#fbbf24"
            intensity={0.45}
            distance={5.2}
          />
          <pointLight
            position={[PARTY_CENTER[0] + 1.2, 2.2, PARTY_CENTER[2] + 0.8]}
            color="#fb7185"
            intensity={0.32}
            distance={4.8}
          />

          <PizzaParty
            key={`pizza-party-${partyWaveKey}`}
            position={[PARTY_CENTER[0], -0.55, PARTY_CENTER[2]]}
            onComplete={() => undefined}
          />
        </group>
      )}

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

      {/* Snack bar station */}
      <group position={SNACK_BAR_POSITION}>
        {/* Counter + backsplash */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.64, 0.9, 2.2]} />
          <meshStandardMaterial color="#7d6245" roughness={0.72} />
        </mesh>
        <mesh position={[-0.05, 0.93, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.76, 0.06, 2.24]} />
          <meshStandardMaterial color="#d8c1a2" roughness={0.42} />
        </mesh>
        <mesh position={[0.29, 1.23, 0]} receiveShadow>
          <boxGeometry args={[0.06, 0.54, 2.04]} />
          <meshStandardMaterial color="#efe4d4" roughness={0.65} />
        </mesh>

        {/* Drink dispenser */}
        <group position={[-0.16, 0.96, -0.7]}>
          <mesh position={[0, 0.18, 0]} castShadow>
            <boxGeometry args={[0.24, 0.34, 0.22]} />
            <meshStandardMaterial color="#d1d5db" roughness={0.42} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.41, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.18, 14]} />
            <meshStandardMaterial color="#60a5fa" transparent opacity={0.72} />
          </mesh>
          <mesh position={[-0.13, 0.16, -0.05]} castShadow>
            <boxGeometry args={[0.08, 0.02, 0.03]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-0.13, 0.16, 0.05]} castShadow>
            <boxGeometry args={[0.08, 0.02, 0.03]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-0.16, 0.07, 0]} receiveShadow>
            <boxGeometry args={[0.1, 0.02, 0.12]} />
            <meshStandardMaterial color="#6b7280" />
          </mesh>
        </group>

        {/* Fruit bowl */}
        <group position={[-0.18, 0.97, 0.04]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.13, 0.09, 0.05, 20]} />
            <meshStandardMaterial color="#a16207" roughness={0.65} />
          </mesh>
          {[
            [-0.05, 0.06, -0.02, '#ef4444'],
            [0.03, 0.06, 0.01, '#22c55e'],
            [0, 0.06, -0.06, '#f59e0b'],
            [0.06, 0.06, -0.05, '#f97316'],
          ].map(([x, y, z, color], index) => (
            <mesh key={`fruit-${index}`} position={[x as number, y as number, z as number]} castShadow>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial color={color as string} roughness={0.5} />
            </mesh>
          ))}
        </group>

        {/* Mug row */}
        {[-0.72, -0.54, -0.36].map((z, index) => (
          <group key={`snack-mug-${index}`} position={[-0.19, 0.98, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.042, 0.038, 0.08, 12]} />
              <meshStandardMaterial color={index === 1 ? '#b91c1c' : '#cbd5e1'} />
            </mesh>
            <mesh position={[-0.045, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.018, 0.006, 8, 12, Math.PI]} />
              <meshStandardMaterial color="#9ca3af" />
            </mesh>
          </group>
        ))}

        {/* Plate stack */}
        <group position={[-0.17, 0.965, 0.38]}>
          {Array.from({ length: 4 }, (_, index) => (
            <mesh key={`plate-${index}`} position={[0, index * 0.01, 0]} receiveShadow>
              <cylinderGeometry args={[0.1, 0.1, 0.008, 20]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.58} />
            </mesh>
          ))}
        </group>

        {/* Chips bowl + bag */}
        <group position={[-0.2, 0.97, -0.32]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.11, 0.08, 0.05, 18]} />
            <meshStandardMaterial color="#78350f" roughness={0.68} />
          </mesh>
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index / 8) * Math.PI * 2
            return (
              <mesh
                key={`chip-${index}`}
                position={[Math.cos(angle) * 0.05, 0.05, Math.sin(angle) * 0.05]}
                rotation={[0, angle, 0]}
              >
                <boxGeometry args={[0.03, 0.005, 0.016]} />
                <meshStandardMaterial color="#facc15" />
              </mesh>
            )
          })}
        </group>
        <group position={[-0.1, 1.03, -0.1]} rotation={[0, -0.24, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.11, 0.2, 0.06]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.35} />
          </mesh>
          <mesh position={[-0.056, 0, 0.018]}>
            <boxGeometry args={[0.002, 0.16, 0.022]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
        </group>
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

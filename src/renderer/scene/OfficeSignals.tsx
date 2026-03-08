import type { OfficeFocusMode, RunStatus } from '../../shared/run-history'

interface OfficeSignalsProps {
  contextCoverage: number
  rewardScore: number | null
  successRate: number
  contextFiles: number
  dirtyFiles: number
  focusMode: OfficeFocusMode
  activeAgents: number
  failedRunsToday: number
  changedFilesToday: number
  latestRunStatus: RunStatus | null
}

function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function metricColor(value: number): string {
  if (value >= 0.75) return '#548C5A'
  if (value >= 0.45) return '#d4a040'
  return '#c45050'
}

export function OfficeSignals({
  contextCoverage,
  rewardScore,
  successRate,
  contextFiles,
  dirtyFiles,
  focusMode,
  activeAgents,
  failedRunsToday,
  changedFilesToday,
  latestRunStatus,
}: OfficeSignalsProps) {
  const contextLevel = clamp(contextCoverage)
  const rewardLevel = rewardScore == null ? 0 : clamp(rewardScore / 100)
  const successLevel = clamp(successRate)
  const rewardColor = latestRunStatus === 'error'
    ? '#c45050'
    : latestRunStatus === 'success'
      ? '#548C5A'
      : rewardScore == null
        ? '#74747C'
        : metricColor(rewardLevel)
  const dirtyRatio = clamp(dirtyFiles / 24)
  const contextStacks = Math.max(1, Math.min(6, contextFiles))
  const focusColor = focusMode === 'show-errors'
    ? '#c45050'
    : focusMode === 'changed-files'
      ? '#4C89D9'
      : '#548C5A'

  return (
    <>
      {/* Office scoreboard: context, reward, and consistency bars */}
      <group position={[3.1, 2.3, -6.64]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.7, 1, 0.06]} />
          <meshStandardMaterial color="#f5f1e8" />
        </mesh>
        <mesh position={[0, 0.42, 0.04]}>
          <boxGeometry args={[1.5, 0.07, 0.02]} />
          <meshStandardMaterial color="#d4d0c8" />
        </mesh>

        {[
          { x: -0.45, level: contextLevel, color: metricColor(contextLevel) },
          { x: 0, level: rewardLevel, color: metricColor(rewardLevel) },
          { x: 0.45, level: successLevel, color: metricColor(successLevel) },
        ].map((bar, index) => {
          const height = 0.12 + bar.level * 0.66
          return (
            <mesh key={index} position={[bar.x, -0.34 + height / 2, 0.06]}>
              <boxGeometry args={[0.24, height, 0.03]} />
              <meshStandardMaterial color={bar.color} emissive={bar.color} emissiveIntensity={0.35} />
            </mesh>
          )
        })}
      </group>

      {/* Reward beacon above whiteboard */}
      <mesh position={[4.6, 3.35, -6.7]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial
          color={rewardColor}
          emissive={rewardColor}
          emissiveIntensity={rewardScore == null ? 0.2 : 0.9}
        />
      </mesh>

      {/* Context crates near filing cabinet */}
      <group position={[4.6, 0, -5.95]}>
        {Array.from({ length: contextStacks }, (_, index) => {
          const row = Math.floor(index / 3)
          const col = index % 3
          return (
            <mesh
              key={index}
              position={[-0.22 + col * 0.22, 0.1 + row * 0.2, 0]}
              castShadow
            >
              <boxGeometry args={[0.18, 0.18, 0.18]} />
              <meshStandardMaterial color="#c9b89a" />
            </mesh>
          )
        })}
        {dirtyFiles > 0 && (
          <mesh position={[0.42, 0.1 + dirtyRatio * 0.6, 0]}>
            <boxGeometry args={[0.08, 0.2 + dirtyRatio * 0.6, 0.08]} />
            <meshStandardMaterial color="#c45050" emissive="#c45050" emissiveIntensity={0.35} />
          </mesh>
        )}
      </group>

      <group position={[-4.35, 2.15, -6.55]}>
        {[activeAgents, failedRunsToday, changedFilesToday].map((value, index) => (
          <group key={index} position={[index * 0.42, 0, 0]}>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.32, 18]} />
              <meshStandardMaterial color="#1F1F1C" />
            </mesh>
            <mesh position={[0, 0.16 + clamp(value / 6) * 0.28, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.12 + clamp(value / 6) * 0.56, 18]} />
              <meshStandardMaterial color={index === 1 ? '#c45050' : index === 2 ? '#4C89D9' : focusColor} emissive={index === 1 ? '#c45050' : index === 2 ? '#4C89D9' : focusColor} emissiveIntensity={0.28} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  )
}

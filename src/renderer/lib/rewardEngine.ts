import type { ChatRunReward } from '../types'

export interface RunRewardInput {
  chatSessionId: string
  workspaceDirectory: string
  status: ChatRunReward['status']
  durationMs: number
  tokenDeltaInput: number
  tokenDeltaOutput: number
  contextFiles: number
  toolCalls: number
  fileWrites: number
  unresolvedMentions: number
  yoloMode: boolean
}

function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function computeOutcomeScore(status: ChatRunReward['status']): number {
  if (status === 'success') return 1
  if (status === 'stopped') return 0.45
  return 0
}

function computeEfficiencyScore(totalTokens: number, durationMs: number): number {
  const tokenFloor = 12_000
  const tokenCeiling = 240_000
  let score: number
  if (totalTokens <= tokenFloor) {
    score = 1
  } else if (totalTokens >= tokenCeiling) {
    score = 0.15
  } else {
    const ratio = (totalTokens - tokenFloor) / (tokenCeiling - tokenFloor)
    score = 1 - ratio * 0.85
  }

  if (durationMs > 180_000) score -= 0.15
  else if (durationMs > 120_000) score -= 0.08
  else if (durationMs > 75_000) score -= 0.04

  return clamp(score)
}

function computeSafetyScore(status: ChatRunReward['status'], yoloMode: boolean): number {
  let score = yoloMode ? 0.62 : 1
  if (status === 'error') score -= 0.2
  return clamp(score)
}

function computeContextScore(contextFiles: number, unresolvedMentions: number, fileWrites: number): number {
  let score = 0
  score += clamp(contextFiles / 8) * 0.7
  if (unresolvedMentions === 0) score += 0.15
  if (fileWrites > 0) score += 0.15
  return clamp(score)
}

export function computeRunReward(input: RunRewardInput): Omit<ChatRunReward, 'id' | 'timestamp'> {
  const totalTokens = Math.max(0, input.tokenDeltaInput + input.tokenDeltaOutput)
  const durationMs = Math.max(0, input.durationMs)
  const outcomeScore = computeOutcomeScore(input.status)
  const efficiencyScore = computeEfficiencyScore(totalTokens, durationMs)
  const safetyScore = computeSafetyScore(input.status, input.yoloMode)
  const contextScore = computeContextScore(input.contextFiles, input.unresolvedMentions, input.fileWrites)
  const rewardScore = Math.round(
    (outcomeScore * 0.45 + efficiencyScore * 0.2 + safetyScore * 0.2 + contextScore * 0.15) * 100
  )

  const notes: string[] = []
  if (input.status === 'error') notes.push('Run ended with an error')
  if (input.status === 'stopped') notes.push('Run was stopped before completion')
  if (input.yoloMode) notes.push('YOLO mode reduced safety score')
  if (input.contextFiles > 0) notes.push(`Used ${input.contextFiles} context files`)
  if (input.unresolvedMentions > 0) notes.push(`${input.unresolvedMentions} @mentions unresolved`)
  if (totalTokens > 140_000) notes.push('High token spend')

  return {
    chatSessionId: input.chatSessionId,
    workspaceDirectory: input.workspaceDirectory,
    status: input.status,
    durationMs,
    rewardScore,
    outcomeScore,
    efficiencyScore,
    safetyScore,
    contextScore,
    tokenDeltaInput: input.tokenDeltaInput,
    tokenDeltaOutput: input.tokenDeltaOutput,
    contextFiles: input.contextFiles,
    toolCalls: input.toolCalls,
    fileWrites: input.fileWrites,
    unresolvedMentions: input.unresolvedMentions,
    yoloMode: input.yoloMode,
    notes,
  }
}

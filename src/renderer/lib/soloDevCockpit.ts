import type { Agent, ChatMessage, SchedulerTaskInput } from '../types'
import {
  BUILT_IN_AUTOMATIONS,
  STARTER_JOBS,
  type BuiltInAutomationId,
  type OfficeFocusMode,
  type RunRecord,
  type StarterJobId,
  type StarterJobTemplate,
} from '../../shared/run-history'

const ACTIVE_AGENT_STATUSES = new Set(['thinking', 'streaming', 'tool_calling', 'waiting'])
const FILE_INPUT_KEYS = new Set([
  'file_path',
  'path',
  'paths',
  'target_file',
  'target_files',
  'notebook_path',
  'cwd',
])
const FILE_TOOL_NAMES = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

function normalizeFileCandidate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('-')) return null
  const normalized = trimmed.replace(/\\/g, '/')
  if (!normalized.includes('/')) {
    if (!/\.[A-Za-z0-9]{1,8}$/.test(normalized)) return null
  }
  return normalized
}

function collectPathsFromUnknown(value: unknown, depth = 0): string[] {
  if (depth > 3) return []
  if (typeof value === 'string') {
    const normalized = normalizeFileCandidate(value)
    return normalized ? [normalized] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectPathsFromUnknown(entry, depth + 1))
  }
  if (typeof value !== 'object' || value === null) return []

  const paths: string[] = []
  for (const [key, entry] of Object.entries(value)) {
    if (!FILE_INPUT_KEYS.has(key) && !key.endsWith('_path') && !key.endsWith('_paths')) continue
    paths.push(...collectPathsFromUnknown(entry, depth + 1))
  }
  return paths
}

export function extractChangedFilesFromMessages(messages: readonly ChatMessage[]): string[] {
  const seen = new Set<string>()
  const files: string[] = []

  for (const message of messages) {
    if (!message.toolName || !FILE_TOOL_NAMES.has(message.toolName)) continue
    for (const path of collectPathsFromUnknown(message.toolInput)) {
      if (seen.has(path)) continue
      seen.add(path)
      files.push(path)
      if (files.length >= 24) return files
    }
  }

  return files
}

export function extractLastErrorFromMessages(messages: readonly ChatMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === 'error' && message.content.trim().length > 0) {
      return message.content.trim()
    }
  }
  return null
}

export function findStarterJobTemplate(jobId: StarterJobId): StarterJobTemplate | null {
  return STARTER_JOBS.find((job) => job.id === jobId) ?? null
}

export function buildForkPrompt(run: RunRecord): string {
  const lines = [
    `Fork a fresh run from the previous context below.`,
    `Previous run: ${run.title}`,
    `Source: ${run.source}`,
    `Status: ${run.status}`,
  ]
  if (run.lastError) lines.push(`Last error: ${run.lastError}`)
  if (run.changedFiles.length > 0) {
    lines.push(`Changed files: ${run.changedFiles.slice(0, 8).join(', ')}`)
  }
  lines.push('', '[Original prompt]', run.prompt, '')
  lines.push(
    'Re-state the current repository state, preserve only the relevant context, and continue in a fresh conversation without assuming unfinished work is already complete.'
  )
  return lines.join('\n')
}

export function findLastResumableRun(
  runs: readonly RunRecord[],
  workspaceDirectory?: string | null
): RunRecord | null {
  return runs.find((run) => {
    if (!run.resumable || !run.conversationId) return false
    if (run.source !== 'chat') return false
    if (workspaceDirectory && run.workspaceDirectory !== workspaceDirectory) return false
    return true
  }) ?? null
}

export function filterAgentsForOfficeFocus(
  agents: readonly Agent[],
  focusMode: OfficeFocusMode,
  selectedAgentId: string | null
): Agent[] {
  const visible = agents.filter((agent) => {
    if (selectedAgentId && agent.id === selectedAgentId) return true
    if (focusMode === 'show-errors') return agent.status === 'error'
    if (focusMode === 'changed-files') return agent.files_modified > 0
    return ACTIVE_AGENT_STATUSES.has(agent.status)
  })

  if (visible.length > 0) return visible
  if (selectedAgentId) {
    const selected = agents.find((agent) => agent.id === selectedAgentId)
    return selected ? [selected] : []
  }
  return focusMode === 'follow-active' ? [...agents] : []
}

export interface DailyDigest {
  totalRuns: number
  successRuns: number
  failedRuns: number
  stoppedRuns: number
  runningRuns: number
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  topChangedFiles: Array<{ path: string; count: number }>
}

export function deriveDailyDigest(
  runs: readonly RunRecord[],
  options?: { workspaceDirectory?: string | null; now?: number }
): DailyDigest {
  const now = options?.now ?? Date.now()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayStart = today.getTime()

  const todaysRuns = runs.filter((run) => {
    if (run.startedAt < todayStart) return false
    if (options?.workspaceDirectory && run.workspaceDirectory !== options.workspaceDirectory) {
      return false
    }
    return true
  })

  const changedFileCounts = new Map<string, number>()
  let inputTokens = 0
  let outputTokens = 0
  let estimatedCostUsd = 0

  for (const run of todaysRuns) {
    for (const file of run.changedFiles) {
      changedFileCounts.set(file, (changedFileCounts.get(file) ?? 0) + 1)
    }
    inputTokens += run.costSummary?.inputTokens ?? 0
    outputTokens += run.costSummary?.outputTokens ?? 0
    estimatedCostUsd += run.costSummary?.estimatedCostUsd ?? 0
  }

  return {
    totalRuns: todaysRuns.length,
    successRuns: todaysRuns.filter((run) => run.status === 'success').length,
    failedRuns: todaysRuns.filter((run) => run.status === 'error').length,
    stoppedRuns: todaysRuns.filter((run) => run.status === 'stopped').length,
    runningRuns: todaysRuns.filter((run) => run.status === 'running').length,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    topChangedFiles: Array.from(changedFileCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count })),
  }
}

export function buildAutomationDraft(
  automationId: BuiltInAutomationId,
  workspaceDirectory: string,
  yoloMode: boolean
): SchedulerTaskInput {
  const template = BUILT_IN_AUTOMATIONS.find((entry) => entry.id === automationId)
  if (!template) {
    throw new Error(`Unknown automation template: ${automationId}`)
  }
  return {
    name: template.name,
    cron: template.cron,
    prompt: template.prompt,
    workingDirectory: workspaceDirectory,
    enabled: true,
    yoloMode,
  }
}

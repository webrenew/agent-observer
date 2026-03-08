export type RunSource = 'chat' | 'scheduler' | 'todoRunner'
export type RunStatus = 'running' | 'success' | 'error' | 'stopped'
export type RunTrigger = 'manual' | 'cron' | 'auto'
export type OfficeFocusMode = 'follow-active' | 'show-errors' | 'changed-files'

export type StarterJobId =
  | 'investigate-failing-tests'
  | 'review-current-diff'
  | 'ship-small-fix'
  | 'summarize-repo-status'

export type BuiltInAutomationId = 'morning-repo-sweep' | 'end-of-day-summary'

export interface RunToolSummary {
  totalCalls: number
  fileWrites: number
  lastToolName: string | null
}

export interface RunCostSummary {
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number | null
}

export interface RunRecord {
  id: string
  source: RunSource
  status: RunStatus
  trigger: RunTrigger
  title: string
  prompt: string
  workspaceDirectory: string | null
  chatSessionId: string | null
  conversationId: string | null
  claudeSessionId: string | null
  schedulerTaskId: string | null
  schedulerTaskName: string | null
  todoRunnerJobId: string | null
  todoRunnerJobName: string | null
  todoItemText: string | null
  starterJobId: StarterJobId | null
  forkedFromRunId: string | null
  createdAt: number
  updatedAt: number
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  waitingForInput: boolean
  blocked: boolean
  lastError: string | null
  lastToolName: string | null
  changedFiles: string[]
  notes: string[]
  rewardScore: number | null
  contextFiles: number | null
  unresolvedMentions: number | null
  toolSummary: RunToolSummary | null
  costSummary: RunCostSummary | null
  resumable: boolean
}

export interface RunRecordCreateInput {
  id?: string
  source: RunSource
  status?: RunStatus
  trigger: RunTrigger
  title: string
  prompt: string
  workspaceDirectory?: string | null
  chatSessionId?: string | null
  conversationId?: string | null
  claudeSessionId?: string | null
  schedulerTaskId?: string | null
  schedulerTaskName?: string | null
  todoRunnerJobId?: string | null
  todoRunnerJobName?: string | null
  todoItemText?: string | null
  starterJobId?: StarterJobId | null
  forkedFromRunId?: string | null
  createdAt?: number
  startedAt?: number
  waitingForInput?: boolean
  blocked?: boolean
  lastError?: string | null
  lastToolName?: string | null
  changedFiles?: string[]
  notes?: string[]
  rewardScore?: number | null
  contextFiles?: number | null
  unresolvedMentions?: number | null
  toolSummary?: RunToolSummary | null
  costSummary?: RunCostSummary | null
  resumable?: boolean
}

export interface RunRecordUpdateInput {
  status?: RunStatus
  title?: string
  prompt?: string
  workspaceDirectory?: string | null
  chatSessionId?: string | null
  conversationId?: string | null
  claudeSessionId?: string | null
  schedulerTaskId?: string | null
  schedulerTaskName?: string | null
  todoRunnerJobId?: string | null
  todoRunnerJobName?: string | null
  todoItemText?: string | null
  starterJobId?: StarterJobId | null
  forkedFromRunId?: string | null
  updatedAt?: number
  endedAt?: number | null
  durationMs?: number | null
  waitingForInput?: boolean
  blocked?: boolean
  lastError?: string | null
  lastToolName?: string | null
  changedFiles?: string[]
  notes?: string[]
  rewardScore?: number | null
  contextFiles?: number | null
  unresolvedMentions?: number | null
  toolSummary?: RunToolSummary | null
  costSummary?: RunCostSummary | null
  resumable?: boolean
}

export interface RunHistoryListOptions {
  limit?: number
  workspaceDirectory?: string | null
}

export interface StarterJobTemplate {
  id: StarterJobId
  title: string
  eyebrow: string
  description: string
  prompt: string
}

export interface BuiltInAutomationTemplate {
  id: BuiltInAutomationId
  name: string
  description: string
  cron: string
  prompt: string
}

export const STARTER_JOBS: StarterJobTemplate[] = [
  {
    id: 'investigate-failing-tests',
    eyebrow: 'Debug',
    title: 'Investigate failing tests',
    description: 'Find the red path, explain the failure, and propose the smallest safe fix.',
    prompt: 'Investigate the current failing tests in this repository. Reproduce the failure, explain the root cause, identify the impacted files, and propose or implement the smallest safe fix. If tests are already green, explain the current test health and point out the next most likely failure source.'
  },
  {
    id: 'review-current-diff',
    eyebrow: 'Review',
    title: 'Review current diff',
    description: 'Summarize what changed, flag real risks, and tell me what to ship or fix.',
    prompt: 'Review the current working tree and branch diff like a senior engineer. Summarize what changed, identify behavioral regressions or risky assumptions, call out missing tests, and tell me the top next actions before shipping.'
  },
  {
    id: 'ship-small-fix',
    eyebrow: 'Ship',
    title: 'Ship a small fix',
    description: 'Pick one high-value small issue, implement it, and verify the result.',
    prompt: 'Inspect this repository and choose one concrete, high-value small fix that can reasonably be completed now. Implement it end to end, run the most relevant verification, and summarize the user-visible impact and any remaining risk.'
  },
  {
    id: 'summarize-repo-status',
    eyebrow: 'Status',
    title: 'Summarize repo status',
    description: 'Give me the shortest high-signal read on where this repo stands today.',
    prompt: 'Summarize the current repository status for a solo engineer. Cover branch state, recent local changes, likely priorities, visible risks, and the most useful next action to take in this workspace.'
  },
]

export const BUILT_IN_AUTOMATIONS: BuiltInAutomationTemplate[] = [
  {
    id: 'morning-repo-sweep',
    name: 'Morning repo sweep',
    description: 'Run a concise morning check of repo health, recent changes, and likely blockers.',
    cron: '0 9 * * 1-5',
    prompt: 'Perform a morning repository sweep. Check branch state, test/build health if cheaply available, recent diffs, open risk areas, and produce a concise operator summary with the top next action.'
  },
  {
    id: 'end-of-day-summary',
    name: 'End-of-day summary',
    description: 'Capture what changed, what failed, and what should happen next before signing off.',
    cron: '0 17 * * 1-5',
    prompt: 'Produce an end-of-day repository summary. Capture what changed today, what succeeded, what failed, what remains risky, and the clearest starting point for the next session.'
  },
]

import { expect, test } from '@playwright/test'
import type { Agent, ChatMessage } from '../../src/renderer/types'
import {
  buildAutomationDraft,
  deriveDailyDigest,
  extractChangedFilesFromMessages,
  filterAgentsForOfficeFocus,
  findLastResumableRun,
} from '../../src/renderer/lib/soloDevCockpit'
import type { RunRecord } from '../../src/shared/run-history'

function createAgent(overrides: Partial<Agent>): Agent {
  return {
    id: overrides.id ?? 'agent-1',
    name: overrides.name ?? 'Agent',
    agent_type: overrides.agent_type ?? 'chat',
    status: overrides.status ?? 'idle',
    currentTask: overrides.currentTask ?? 'task',
    model: overrides.model ?? 'claude-sonnet-4',
    tokens_input: overrides.tokens_input ?? 0,
    tokens_output: overrides.tokens_output ?? 0,
    files_modified: overrides.files_modified ?? 0,
    started_at: overrides.started_at ?? Date.now(),
    deskIndex: overrides.deskIndex ?? 0,
    terminalId: overrides.terminalId ?? 'term-1',
    isClaudeRunning: overrides.isClaudeRunning ?? true,
    appearance: overrides.appearance ?? {
      shirtColor: '#4fa3f7',
      hairColor: '#1a1a2e',
      hairStyle: 'short',
      skinTone: '#ffdbb4',
      pantsColor: '#4a5568',
      gender: 'masculine',
    },
    commitCount: overrides.commitCount ?? 0,
    activeCelebration: overrides.activeCelebration ?? null,
    celebrationStartedAt: overrides.celebrationStartedAt ?? null,
    sessionStats: overrides.sessionStats ?? {
      tokenHistory: [],
      peakInputRate: 0,
      peakOutputRate: 0,
      tokensByModel: {},
    },
  }
}

function createRun(overrides: Partial<RunRecord>): RunRecord {
  const now = Date.now()
  return {
    id: overrides.id ?? 'run-1',
    source: overrides.source ?? 'chat',
    status: overrides.status ?? 'success',
    trigger: overrides.trigger ?? 'manual',
    title: overrides.title ?? 'Run title',
    prompt: overrides.prompt ?? 'prompt',
    workspaceDirectory: overrides.workspaceDirectory ?? '/repo',
    chatSessionId: overrides.chatSessionId ?? 'chat-1',
    conversationId: overrides.conversationId ?? 'conv-1',
    claudeSessionId: overrides.claudeSessionId ?? 'session-1',
    schedulerTaskId: overrides.schedulerTaskId ?? null,
    schedulerTaskName: overrides.schedulerTaskName ?? null,
    todoRunnerJobId: overrides.todoRunnerJobId ?? null,
    todoRunnerJobName: overrides.todoRunnerJobName ?? null,
    todoItemText: overrides.todoItemText ?? null,
    starterJobId: overrides.starterJobId ?? null,
    forkedFromRunId: overrides.forkedFromRunId ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    startedAt: overrides.startedAt ?? now,
    endedAt: overrides.endedAt ?? now,
    durationMs: overrides.durationMs ?? 5_000,
    waitingForInput: overrides.waitingForInput ?? false,
    blocked: overrides.blocked ?? false,
    lastError: overrides.lastError ?? null,
    lastToolName: overrides.lastToolName ?? null,
    changedFiles: overrides.changedFiles ?? [],
    notes: overrides.notes ?? [],
    rewardScore: overrides.rewardScore ?? null,
    contextFiles: overrides.contextFiles ?? null,
    unresolvedMentions: overrides.unresolvedMentions ?? null,
    toolSummary: overrides.toolSummary ?? null,
    costSummary: overrides.costSummary ?? null,
    resumable: overrides.resumable ?? true,
  }
}

test('extractChangedFilesFromMessages collects unique file-tool targets', () => {
  const messages: ChatMessage[] = [
    {
      id: 'm1',
      role: 'assistant',
      content: '',
      timestamp: 1,
      toolName: 'Write',
      toolInput: { file_path: 'src/main.ts' },
    },
    {
      id: 'm2',
      role: 'assistant',
      content: '',
      timestamp: 2,
      toolName: 'Edit',
      toolInput: { path: 'src/main.ts', extra: 'ignored' },
    },
    {
      id: 'm3',
      role: 'assistant',
      content: '',
      timestamp: 3,
      toolName: 'MultiEdit',
      toolInput: { paths: ['src/renderer/App.tsx', 'src/shared/electron-api.ts'] },
    },
  ]

  expect(extractChangedFilesFromMessages(messages)).toEqual([
    'src/main.ts',
    'src/renderer/App.tsx',
    'src/shared/electron-api.ts',
  ])
})

test('filterAgentsForOfficeFocus preserves selected agent while filtering', () => {
  const agents = [
    createAgent({ id: 'idle', status: 'idle' }),
    createAgent({ id: 'active', status: 'thinking' }),
    createAgent({ id: 'broken', status: 'error' }),
    createAgent({ id: 'files', status: 'done', files_modified: 3 }),
  ]

  expect(filterAgentsForOfficeFocus(agents, 'follow-active', null).map((agent) => agent.id)).toEqual(['active'])
  expect(filterAgentsForOfficeFocus(agents, 'show-errors', 'idle').map((agent) => agent.id)).toEqual(['idle', 'broken'])
  expect(filterAgentsForOfficeFocus(agents, 'changed-files', null).map((agent) => agent.id)).toEqual(['files'])
})

test('deriveDailyDigest summarizes todays runs and changed files', () => {
  const now = new Date('2026-03-08T15:00:00.000Z').getTime()
  const runs = [
    createRun({
      id: 'r1',
      startedAt: new Date('2026-03-08T13:00:00.000Z').getTime(),
      updatedAt: new Date('2026-03-08T13:10:00.000Z').getTime(),
      status: 'success',
      changedFiles: ['src/main.ts', 'src/renderer/App.tsx'],
      costSummary: { inputTokens: 100, outputTokens: 200, estimatedCostUsd: 0.12 },
    }),
    createRun({
      id: 'r2',
      startedAt: new Date('2026-03-08T14:00:00.000Z').getTime(),
      updatedAt: new Date('2026-03-08T14:02:00.000Z').getTime(),
      status: 'error',
      changedFiles: ['src/main.ts'],
      costSummary: { inputTokens: 50, outputTokens: 80, estimatedCostUsd: 0.04 },
    }),
    createRun({
      id: 'yesterday',
      startedAt: new Date('2026-03-07T14:00:00.000Z').getTime(),
      updatedAt: new Date('2026-03-07T14:05:00.000Z').getTime(),
      status: 'success',
      changedFiles: ['ignored.ts'],
    }),
  ]

  const digest = deriveDailyDigest(runs, { workspaceDirectory: '/repo', now })
  expect(digest.totalRuns).toBe(2)
  expect(digest.successRuns).toBe(1)
  expect(digest.failedRuns).toBe(1)
  expect(digest.inputTokens).toBe(150)
  expect(digest.outputTokens).toBe(280)
  expect(digest.estimatedCostUsd).toBeCloseTo(0.16, 5)
  expect(digest.topChangedFiles[0]).toEqual({ path: 'src/main.ts', count: 2 })
})

test('findLastResumableRun prefers latest chat run with conversation context', () => {
  const runs = [
    createRun({ id: 'scheduler', source: 'scheduler', conversationId: null, resumable: false }),
    createRun({
      id: 'chat-latest',
      source: 'chat',
      updatedAt: 200,
      conversationId: 'conv-2',
      resumable: true,
      workspaceDirectory: '/repo',
    }),
    createRun({
      id: 'chat-other',
      source: 'chat',
      updatedAt: 100,
      conversationId: 'conv-1',
      resumable: true,
      workspaceDirectory: '/other',
    }),
  ]

  expect(findLastResumableRun(runs, '/repo')?.id).toBe('chat-latest')
})

test('buildAutomationDraft maps built-in automations to scheduler input', () => {
  const draft = buildAutomationDraft('morning-repo-sweep', '/repo', true)
  expect(draft).toMatchObject({
    name: 'Morning repo sweep',
    cron: '0 9 * * 1-5',
    workingDirectory: '/repo',
    enabled: true,
    yoloMode: true,
  })
})

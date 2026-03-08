import { BrowserWindow, ipcMain } from 'electron'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { writeFileAtomicSync } from './atomic-write'
import { logMainError, logMainEvent } from './diagnostics'
import { IPC_CHANNELS } from '../shared/electron-api'
import type {
  RunHistoryListOptions,
  RunRecord,
  RunRecordCreateInput,
  RunRecordUpdateInput,
  RunStatus,
} from '../shared/run-history'

const RUN_HISTORY_DIR = path.join(os.homedir(), '.agent-observer')
const RUN_HISTORY_FILE = path.join(RUN_HISTORY_DIR, 'run-history.json')
const MAX_RUN_RECORDS = 400

let handlersRegistered = false
let runHistoryCache: RunRecord[] | null = null

function ensureRunHistoryDir(): void {
  if (!fs.existsSync(RUN_HISTORY_DIR)) {
    fs.mkdirSync(RUN_HISTORY_DIR, { recursive: true })
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeStringArray(value: unknown, maxItems = 24): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const values: string[] = []
  for (const candidate of value) {
    const normalized = normalizeString(candidate)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    values.push(normalized)
    if (values.length >= maxItems) break
  }
  return values
}

function normalizeFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeStatus(value: unknown): RunStatus {
  return value === 'success' || value === 'error' || value === 'stopped' ? value : 'running'
}

function nextRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

function normalizeRunRecord(value: unknown): RunRecord | null {
  if (!isObject(value)) return null

  const id = normalizeString(value.id)
  const title = normalizeString(value.title)
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : ''
  const source = value.source === 'scheduler' || value.source === 'todoRunner' ? value.source : 'chat'
  const trigger = value.trigger === 'cron' || value.trigger === 'auto' ? value.trigger : 'manual'
  const createdAt = normalizeFiniteNumber(value.createdAt) ?? Date.now()
  const startedAt = normalizeFiniteNumber(value.startedAt) ?? createdAt
  const updatedAt = normalizeFiniteNumber(value.updatedAt) ?? startedAt

  if (!id || !title || !prompt) return null

  return {
    id,
    source,
    status: normalizeStatus(value.status),
    trigger,
    title,
    prompt,
    workspaceDirectory: normalizeString(value.workspaceDirectory),
    chatSessionId: normalizeString(value.chatSessionId),
    conversationId: normalizeString(value.conversationId),
    claudeSessionId: normalizeString(value.claudeSessionId),
    schedulerTaskId: normalizeString(value.schedulerTaskId),
    schedulerTaskName: normalizeString(value.schedulerTaskName),
    todoRunnerJobId: normalizeString(value.todoRunnerJobId),
    todoRunnerJobName: normalizeString(value.todoRunnerJobName),
    todoItemText: normalizeString(value.todoItemText),
    starterJobId: normalizeString(value.starterJobId) as RunRecord['starterJobId'],
    forkedFromRunId: normalizeString(value.forkedFromRunId),
    createdAt,
    updatedAt,
    startedAt,
    endedAt: normalizeFiniteNumber(value.endedAt),
    durationMs: normalizeFiniteNumber(value.durationMs),
    waitingForInput: value.waitingForInput === true,
    blocked: value.blocked === true,
    lastError: normalizeString(value.lastError),
    lastToolName: normalizeString(value.lastToolName),
    changedFiles: normalizeStringArray(value.changedFiles, 24),
    notes: normalizeStringArray(value.notes, 24),
    rewardScore: normalizeFiniteNumber(value.rewardScore),
    contextFiles: normalizeFiniteNumber(value.contextFiles),
    unresolvedMentions: normalizeFiniteNumber(value.unresolvedMentions),
    toolSummary: isObject(value.toolSummary)
      ? {
        totalCalls: normalizeFiniteNumber(value.toolSummary.totalCalls) ?? 0,
        fileWrites: normalizeFiniteNumber(value.toolSummary.fileWrites) ?? 0,
        lastToolName: normalizeString(value.toolSummary.lastToolName),
      }
      : null,
    costSummary: isObject(value.costSummary)
      ? {
        inputTokens: normalizeFiniteNumber(value.costSummary.inputTokens) ?? 0,
        outputTokens: normalizeFiniteNumber(value.costSummary.outputTokens) ?? 0,
        estimatedCostUsd: normalizeFiniteNumber(value.costSummary.estimatedCostUsd),
      }
      : null,
    resumable: value.resumable !== false,
  }
}

function normalizeRunHistory(records: unknown[]): RunRecord[] {
  const normalized = records
    .map((value) => normalizeRunRecord(value))
    .filter((value): value is RunRecord => Boolean(value))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_RUN_RECORDS)

  let needsWrite = false
  for (const record of normalized) {
    if (record.status === 'running') {
      record.status = 'stopped'
      record.blocked = false
      record.waitingForInput = false
      record.lastError = record.lastError ?? 'App restarted before this run completed.'
      record.endedAt = record.endedAt ?? record.updatedAt
      record.durationMs = record.durationMs ?? Math.max(0, record.updatedAt - record.startedAt)
      record.updatedAt = Date.now()
      needsWrite = true
    }
  }

  if (needsWrite) {
    persistRunHistory(normalized)
  }

  return normalized
}

function readRunHistoryFromDisk(): RunRecord[] {
  ensureRunHistoryDir()
  if (!fs.existsSync(RUN_HISTORY_FILE)) return []

  try {
    const raw = fs.readFileSync(RUN_HISTORY_FILE, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return normalizeRunHistory(parsed)
  } catch (error) {
    logMainError('run_history.read_failed', error)
    return []
  }
}

function persistRunHistory(records: RunRecord[]): void {
  ensureRunHistoryDir()
  writeFileAtomicSync(RUN_HISTORY_FILE, JSON.stringify(records.slice(0, MAX_RUN_RECORDS), null, 2))
}

function getRunHistoryCache(): RunRecord[] {
  if (runHistoryCache) return runHistoryCache
  runHistoryCache = readRunHistoryFromDisk()
  return runHistoryCache
}

function saveRunHistory(records: RunRecord[]): void {
  const normalized = records
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_RUN_RECORDS)
  runHistoryCache = normalized
  persistRunHistory(normalized)
}

function broadcastRunHistoryUpdate(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.runHistory.updated)
    }
  }
}

function toRunRecord(input: RunRecordCreateInput): RunRecord {
  const now = input.createdAt ?? Date.now()
  const startedAt = input.startedAt ?? now
  return {
    id: input.id ?? nextRunId(),
    source: input.source,
    status: input.status ?? 'running',
    trigger: input.trigger,
    title: input.title.trim(),
    prompt: input.prompt.trim(),
    workspaceDirectory: input.workspaceDirectory ?? null,
    chatSessionId: input.chatSessionId ?? null,
    conversationId: input.conversationId ?? null,
    claudeSessionId: input.claudeSessionId ?? null,
    schedulerTaskId: input.schedulerTaskId ?? null,
    schedulerTaskName: input.schedulerTaskName ?? null,
    todoRunnerJobId: input.todoRunnerJobId ?? null,
    todoRunnerJobName: input.todoRunnerJobName ?? null,
    todoItemText: input.todoItemText ?? null,
    starterJobId: input.starterJobId ?? null,
    forkedFromRunId: input.forkedFromRunId ?? null,
    createdAt: now,
    updatedAt: now,
    startedAt,
    endedAt: null,
    durationMs: null,
    waitingForInput: input.waitingForInput === true,
    blocked: input.blocked === true,
    lastError: input.lastError ?? null,
    lastToolName: input.lastToolName ?? null,
    changedFiles: [...(input.changedFiles ?? [])],
    notes: [...(input.notes ?? [])],
    rewardScore: input.rewardScore ?? null,
    contextFiles: input.contextFiles ?? null,
    unresolvedMentions: input.unresolvedMentions ?? null,
    toolSummary: input.toolSummary ?? null,
    costSummary: input.costSummary ?? null,
    resumable: input.resumable !== false,
  }
}

export function listRunRecords(options?: RunHistoryListOptions): RunRecord[] {
  const records = getRunHistoryCache()
  const filtered = options?.workspaceDirectory
    ? records.filter((record) => record.workspaceDirectory === options.workspaceDirectory)
    : records

  if (!options?.limit || options.limit <= 0) {
    return filtered.map((record) => ({ ...record }))
  }
  return filtered.slice(0, options.limit).map((record) => ({ ...record }))
}

export function getRunRecord(runId: string): RunRecord | null {
  const record = getRunHistoryCache().find((entry) => entry.id === runId) ?? null
  return record ? { ...record } : null
}

export function createRunRecord(input: RunRecordCreateInput): RunRecord {
  const record = toRunRecord(input)
  const nextRecords = [record, ...getRunHistoryCache().filter((entry) => entry.id !== record.id)]
  saveRunHistory(nextRecords)
  broadcastRunHistoryUpdate()
  return { ...record }
}

export function updateRunRecord(runId: string, patch: RunRecordUpdateInput): RunRecord {
  const now = patch.updatedAt ?? Date.now()
  const nextRecords = getRunHistoryCache().map((record) => {
    if (record.id !== runId) return record
    const nextRecord: RunRecord = {
      ...record,
      ...patch,
      updatedAt: now,
      changedFiles: patch.changedFiles ? [...patch.changedFiles] : record.changedFiles,
      notes: patch.notes ? [...patch.notes] : record.notes,
    }
    if (nextRecord.status !== 'running' && nextRecord.endedAt == null) {
      nextRecord.endedAt = now
    }
    if (nextRecord.endedAt != null && nextRecord.durationMs == null) {
      nextRecord.durationMs = Math.max(0, nextRecord.endedAt - nextRecord.startedAt)
    }
    return nextRecord
  })

  const updated = nextRecords.find((record) => record.id === runId)
  if (!updated) {
    throw new Error(`Run not found: ${runId}`)
  }

  saveRunHistory(nextRecords)
  broadcastRunHistoryUpdate()
  return { ...updated }
}

export function upsertRunRecord(input: RunRecordCreateInput | (RunRecordUpdateInput & { id: string })): RunRecord {
  if (typeof input.id === 'string' && getRunHistoryCache().some((record) => record.id === input.id)) {
    return updateRunRecord(input.id, input)
  }
  if (
    !('source' in input)
    || !('trigger' in input)
    || !('title' in input)
    || !('prompt' in input)
  ) {
    throw new Error('runHistory:upsert cannot create a run without source, trigger, title, and prompt')
  }
  return createRunRecord(input)
}

export function snapshotWorkspaceChangedFiles(workspaceDirectory: string | null, limit = 12): string[] {
  if (!workspaceDirectory) return []
  try {
    const output = execFileSync(
      'git',
      ['status', '--short', '--untracked-files=all'],
      {
        cwd: workspaceDirectory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    )
    const files = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 3)
      .map((line) => line.slice(3))
      .map((line) => {
        const renameParts = line.split(' -> ')
        return renameParts[renameParts.length - 1].trim()
      })
    return normalizeStringArray(files, limit)
  } catch {
    return []
  }
}

export function setupRunHistoryHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle(IPC_CHANNELS.runHistory.list, (_event, options?: RunHistoryListOptions) => {
    return listRunRecords(options)
  })

  ipcMain.handle(IPC_CHANNELS.runHistory.get, (_event, runId: unknown) => {
    if (typeof runId !== 'string' || !runId.trim()) {
      throw new Error('runHistory:get requires a non-empty run id')
    }
    return getRunRecord(runId.trim())
  })

  ipcMain.handle(IPC_CHANNELS.runHistory.upsert, (_event, input: unknown) => {
    if (!isObject(input)) {
      throw new Error('runHistory:upsert requires an object payload')
    }
    return upsertRunRecord(input as unknown as RunRecordCreateInput & { id?: string })
  })
}

export function cleanupRunHistory(): void {
  if (!runHistoryCache) return
  try {
    saveRunHistory(runHistoryCache)
  } catch (error) {
    logMainError('run_history.cleanup_failed', error)
  }
}

export function logRunHistoryWrite(source: string, record: RunRecord): void {
  logMainEvent('run_history.write', {
    source,
    runId: record.id,
    runSource: record.source,
    status: record.status,
    workspaceDirectory: record.workspaceDirectory,
  })
}

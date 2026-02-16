import { app } from 'electron'
import { createHash, randomUUID } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { logMainError, logMainEvent } from './diagnostics'
import { getSettings } from './settings'
import { recordTelemetryEvent } from './telemetry'

const INSTALL_BEACON_STATE_DIR = path.join(os.homedir(), '.agent-observer')
const INSTALL_BEACON_STATE_FILE = path.join(INSTALL_BEACON_STATE_DIR, 'install-beacon.json')
const INSTALL_BEACON_URL_ENV = 'AGENT_OBSERVER_INSTALL_BEACON_URL'
const INSTALL_BEACON_TIMEOUT_MS = 7_000
const INSTALL_BEACON_INITIAL_BACKOFF_MS = 5 * 60 * 1_000
const INSTALL_BEACON_MAX_BACKOFF_MS = 24 * 60 * 60 * 1_000
const INSTALL_BEACON_MAX_ATTEMPTS = 5

interface InstallBeaconAttemptState {
  attempts: number
  sentAt: string | null
  nextRetryAt: string | null
  lastError: string | null
  appVersion: string | null
}

interface InstallBeaconState {
  installationId: string
  firstSeenAt: string
  beacon: InstallBeaconAttemptState
}

interface InstallBeaconPayload {
  installation_id_hash: string
  app_version: string
  first_seen_at: string
}

export interface SendInstallBeaconOptions {
  beaconUrl?: string | null
  stateFilePath?: string
  appVersion?: string
  timeoutMs?: number
  maxAttempts?: number
  nowMs?: number
  fetchImpl?: typeof fetch
  telemetryEnabled?: boolean
}

interface NormalizedStateResult {
  state: InstallBeaconState
  changed: boolean
}

function safeParseIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

function resolveNowMs(nowMs?: number): number {
  if (typeof nowMs === 'number' && Number.isFinite(nowMs) && nowMs > 0) {
    return Math.floor(nowMs)
  }
  return Date.now()
}

function defaultBeaconState(): InstallBeaconAttemptState {
  return {
    attempts: 0,
    sentAt: null,
    nextRetryAt: null,
    lastError: null,
    appVersion: null,
  }
}

function normalizeState(raw: unknown, nowIso: string): NormalizedStateResult {
  const candidate = raw && typeof raw === 'object'
    ? raw as {
      installationId?: unknown
      firstSeenAt?: unknown
      beacon?: {
        attempts?: unknown
        sentAt?: unknown
        nextRetryAt?: unknown
        lastError?: unknown
        appVersion?: unknown
      }
    }
    : {}

  const fallback = defaultBeaconState()
  const attemptsCandidate = Number(candidate.beacon?.attempts)
  const attempts = Number.isFinite(attemptsCandidate)
    ? Math.max(0, Math.floor(attemptsCandidate))
    : fallback.attempts
  const sentAt = safeParseIsoTimestamp(candidate.beacon?.sentAt) ?? fallback.sentAt
  const nextRetryAt = safeParseIsoTimestamp(candidate.beacon?.nextRetryAt) ?? fallback.nextRetryAt
  const lastError = typeof candidate.beacon?.lastError === 'string'
    ? candidate.beacon.lastError
    : fallback.lastError
  const appVersion = typeof candidate.beacon?.appVersion === 'string'
    ? candidate.beacon.appVersion
    : fallback.appVersion

  const state: InstallBeaconState = {
    installationId:
      typeof candidate.installationId === 'string' && candidate.installationId.trim().length > 0
        ? candidate.installationId
        : randomUUID(),
    firstSeenAt: safeParseIsoTimestamp(candidate.firstSeenAt) ?? nowIso,
    beacon: {
      attempts,
      sentAt,
      nextRetryAt,
      lastError,
      appVersion,
    },
  }

  const changed = JSON.stringify(raw) !== JSON.stringify(state)
  return { state, changed }
}

function readInstallBeaconState(stateFilePath: string, nowIso: string): NormalizedStateResult {
  try {
    if (!fs.existsSync(stateFilePath)) {
      return normalizeState({}, nowIso)
    }
    const raw = fs.readFileSync(stateFilePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return normalizeState(parsed, nowIso)
  } catch (err) {
    logMainError('install_beacon.state_read_failed', err, { stateFilePath })
    return normalizeState({}, nowIso)
  }
}

function writeInstallBeaconState(stateFilePath: string, state: InstallBeaconState): void {
  try {
    fs.mkdirSync(path.dirname(stateFilePath), { recursive: true })
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    logMainError('install_beacon.state_write_failed', err, { stateFilePath })
  }
}

function resolveTelemetryEnabled(explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit
  try {
    const setting = getSettings().telemetry?.installBeaconEnabled
    return typeof setting === 'boolean' ? setting : true
  } catch {
    return true
  }
}

function resolveInstallBeaconUrl(override?: string | null): string | null {
  const raw = (typeof override === 'string' ? override : process.env[INSTALL_BEACON_URL_ENV]) ?? ''
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function normalizeBeaconError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'install beacon request timed out'
  }
  if (err instanceof Error) return err.message
  return String(err)
}

export function __testOnlyHashInstallationId(installationId: string): string {
  return createHash('sha256').update(installationId).digest('hex')
}

export function __testOnlyResolveInstallBeaconRetryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(attempt))
  const multiplier = 2 ** (safeAttempt - 1)
  return Math.min(
    INSTALL_BEACON_MAX_BACKOFF_MS,
    INSTALL_BEACON_INITIAL_BACKOFF_MS * multiplier
  )
}

function shouldAttemptBeaconSend(
  state: InstallBeaconState,
  nowMs: number,
  maxAttempts: number
): { shouldAttempt: boolean; reason: string } {
  if (state.beacon.sentAt) {
    return { shouldAttempt: false, reason: 'already_sent' }
  }
  if (state.beacon.attempts >= maxAttempts) {
    return { shouldAttempt: false, reason: 'attempts_exhausted' }
  }
  if (state.beacon.nextRetryAt) {
    const nextRetryMs = Date.parse(state.beacon.nextRetryAt)
    if (Number.isFinite(nextRetryMs) && nowMs < nextRetryMs) {
      return { shouldAttempt: false, reason: 'backoff_active' }
    }
  }
  return { shouldAttempt: true, reason: 'ready' }
}

async function sendBeaconRequest(options: {
  fetchImpl: typeof fetch
  url: string
  payload: InstallBeaconPayload
  timeoutMs: number
}): Promise<void> {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), options.timeoutMs)

  try {
    const response = await options.fetchImpl(options.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': `install-beacon:${options.payload.installation_id_hash}`,
        'User-Agent': `agent-observer/${options.payload.app_version}`,
      },
      body: JSON.stringify(options.payload),
      signal: controller.signal,
    })

    // 409 conflict is treated as successful idempotency on server.
    if (!response.ok && response.status !== 409) {
      throw new Error(`Install beacon failed with status ${response.status}`)
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}

export async function sendInstallBeaconOnLaunch(
  options: SendInstallBeaconOptions = {}
): Promise<void> {
  const nowMs = resolveNowMs(options.nowMs)
  const nowIso = new Date(nowMs).toISOString()
  const stateFilePath = options.stateFilePath ?? INSTALL_BEACON_STATE_FILE
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? INSTALL_BEACON_MAX_ATTEMPTS))
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? INSTALL_BEACON_TIMEOUT_MS))
  const fetchImpl = options.fetchImpl ?? fetch
  const appVersion = options.appVersion ?? app.getVersion()

  const loaded = readInstallBeaconState(stateFilePath, nowIso)
  if (loaded.changed) {
    writeInstallBeaconState(stateFilePath, loaded.state)
  }

  if (!resolveTelemetryEnabled(options.telemetryEnabled)) {
    logMainEvent('install_beacon.skipped', { reason: 'telemetry_opt_out' })
    return
  }

  const beaconUrl = resolveInstallBeaconUrl(options.beaconUrl)
  if (!beaconUrl) {
    logMainEvent('install_beacon.skipped', { reason: 'missing_or_invalid_url' }, 'warn')
    return
  }

  const gate = shouldAttemptBeaconSend(loaded.state, nowMs, maxAttempts)
  if (!gate.shouldAttempt) {
    logMainEvent('install_beacon.skipped', { reason: gate.reason })
    return
  }

  const payload: InstallBeaconPayload = {
    installation_id_hash: __testOnlyHashInstallationId(loaded.state.installationId),
    app_version: appVersion,
    first_seen_at: loaded.state.firstSeenAt,
  }

  const attempt = loaded.state.beacon.attempts + 1
  try {
    await sendBeaconRequest({
      fetchImpl,
      url: beaconUrl,
      payload,
      timeoutMs,
    })

    const nextState: InstallBeaconState = {
      ...loaded.state,
      beacon: {
        ...loaded.state.beacon,
        attempts: attempt,
        sentAt: nowIso,
        nextRetryAt: null,
        lastError: null,
        appVersion,
      },
    }
    writeInstallBeaconState(stateFilePath, nextState)
    recordTelemetryEvent('install_beacon.sent', { attempt, appVersion })
  } catch (err) {
    const errorMessage = normalizeBeaconError(err)
    const nextRetryAt =
      attempt >= maxAttempts
        ? null
        : new Date(nowMs + __testOnlyResolveInstallBeaconRetryDelayMs(attempt)).toISOString()
    const nextState: InstallBeaconState = {
      ...loaded.state,
      beacon: {
        ...loaded.state.beacon,
        attempts: attempt,
        sentAt: null,
        nextRetryAt,
        lastError: errorMessage,
        appVersion,
      },
    }
    writeInstallBeaconState(stateFilePath, nextState)

    logMainEvent('install_beacon.send_failed', {
      attempt,
      maxAttempts,
      nextRetryAt,
      error: errorMessage,
    }, 'warn')
    recordTelemetryEvent('install_beacon.failed', {
      attempt,
      maxAttempts,
      nextRetryAt,
      error: errorMessage,
    })
  }
}


import fs from 'fs'
import os from 'os'
import path from 'path'
import { expect, test } from '@playwright/test'
import {
  __testOnlyHashInstallationId,
  __testOnlyResolveInstallBeaconRetryDelayMs,
  sendInstallBeaconOnLaunch,
} from '../../src/main/install-beacon'

interface InstallBeaconStateSnapshot {
  installationId: string
  firstSeenAt: string
  beacon: {
    attempts: number
    sentAt: string | null
    nextRetryAt: string | null
    lastError: string | null
    appVersion: string | null
  }
}

function readStateSnapshot(stateFilePath: string): InstallBeaconStateSnapshot {
  return JSON.parse(fs.readFileSync(stateFilePath, 'utf-8')) as InstallBeaconStateSnapshot
}

test('install beacon sends once per installation id and persists sent state', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-observer-install-beacon-'))
  const stateFilePath = path.join(tempDir, 'install-beacon.json')
  const nowMs = 1_735_620_000_000
  const sentBodies: Array<Record<string, unknown>> = []

  try {
    const fetchImpl: typeof fetch = async (_input, init) => {
      sentBodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
      return new Response(null, { status: 202 })
    }

    await sendInstallBeaconOnLaunch({
      beaconUrl: 'https://example.com/install-beacon',
      telemetryEnabled: true,
      appVersion: '1.2.3',
      stateFilePath,
      nowMs,
      fetchImpl,
    })

    await sendInstallBeaconOnLaunch({
      beaconUrl: 'https://example.com/install-beacon',
      telemetryEnabled: true,
      appVersion: '1.2.3',
      stateFilePath,
      nowMs: nowMs + 5_000,
      fetchImpl,
    })

    expect(sentBodies).toHaveLength(1)
    const snapshot = readStateSnapshot(stateFilePath)
    expect(snapshot.beacon.sentAt).toBe(new Date(nowMs).toISOString())
    expect(snapshot.beacon.attempts).toBe(1)
    expect(snapshot.firstSeenAt).toBe(new Date(nowMs).toISOString())

    const body = sentBodies[0] ?? {}
    expect(body.app_version).toBe('1.2.3')
    expect(body.first_seen_at).toBe(snapshot.firstSeenAt)
    expect(body.installation_id_hash).toBe(__testOnlyHashInstallationId(snapshot.installationId))
    expect(String(body.installation_id_hash ?? '')).toHaveLength(64)
    expect(JSON.stringify(body)).not.toContain(snapshot.installationId)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('install beacon respects telemetry opt-out while still generating local installation id', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-observer-install-beacon-optout-'))
  const stateFilePath = path.join(tempDir, 'install-beacon.json')
  let fetchCalls = 0

  try {
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1
      return new Response(null, { status: 200 })
    }

    await sendInstallBeaconOnLaunch({
      beaconUrl: 'https://example.com/install-beacon',
      telemetryEnabled: false,
      appVersion: '1.2.3',
      stateFilePath,
      nowMs: 1_735_620_100_000,
      fetchImpl,
    })

    expect(fetchCalls).toBe(0)
    expect(fs.existsSync(stateFilePath)).toBe(true)
    const snapshot = readStateSnapshot(stateFilePath)
    expect(snapshot.installationId.length).toBeGreaterThan(0)
    expect(snapshot.beacon.sentAt).toBeNull()
    expect(snapshot.beacon.attempts).toBe(0)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('install beacon retries with bounded backoff and stops at max attempts', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-observer-install-beacon-retry-'))
  const stateFilePath = path.join(tempDir, 'install-beacon.json')
  const firstNowMs = 1_735_620_200_000
  let fetchCalls = 0

  try {
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1
      throw new Error('network down')
    }

    await sendInstallBeaconOnLaunch({
      beaconUrl: 'https://example.com/install-beacon',
      telemetryEnabled: true,
      appVersion: '1.2.3',
      stateFilePath,
      nowMs: firstNowMs,
      maxAttempts: 3,
      fetchImpl,
    })

    const afterFirst = readStateSnapshot(stateFilePath)
    expect(fetchCalls).toBe(1)
    expect(afterFirst.beacon.attempts).toBe(1)
    expect(afterFirst.beacon.nextRetryAt).toBe(
      new Date(firstNowMs + __testOnlyResolveInstallBeaconRetryDelayMs(1)).toISOString()
    )

    await sendInstallBeaconOnLaunch({
      beaconUrl: 'https://example.com/install-beacon',
      telemetryEnabled: true,
      appVersion: '1.2.3',
      stateFilePath,
      nowMs: firstNowMs + 1_000,
      maxAttempts: 3,
      fetchImpl,
    })
    expect(fetchCalls).toBe(1)

    const secondNowMs = Date.parse(afterFirst.beacon.nextRetryAt ?? '') + 1
    await sendInstallBeaconOnLaunch({
      beaconUrl: 'https://example.com/install-beacon',
      telemetryEnabled: true,
      appVersion: '1.2.3',
      stateFilePath,
      nowMs: secondNowMs,
      maxAttempts: 3,
      fetchImpl,
    })

    const afterSecond = readStateSnapshot(stateFilePath)
    expect(fetchCalls).toBe(2)
    expect(afterSecond.beacon.attempts).toBe(2)
    expect(afterSecond.beacon.nextRetryAt).toBe(
      new Date(secondNowMs + __testOnlyResolveInstallBeaconRetryDelayMs(2)).toISOString()
    )

    const thirdNowMs = Date.parse(afterSecond.beacon.nextRetryAt ?? '') + 1
    await sendInstallBeaconOnLaunch({
      beaconUrl: 'https://example.com/install-beacon',
      telemetryEnabled: true,
      appVersion: '1.2.3',
      stateFilePath,
      nowMs: thirdNowMs,
      maxAttempts: 3,
      fetchImpl,
    })

    const afterThird = readStateSnapshot(stateFilePath)
    expect(fetchCalls).toBe(3)
    expect(afterThird.beacon.attempts).toBe(3)
    expect(afterThird.beacon.nextRetryAt).toBeNull()

    await sendInstallBeaconOnLaunch({
      beaconUrl: 'https://example.com/install-beacon',
      telemetryEnabled: true,
      appVersion: '1.2.3',
      stateFilePath,
      nowMs: thirdNowMs + 60_000,
      maxAttempts: 3,
      fetchImpl,
    })
    expect(fetchCalls).toBe(3)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

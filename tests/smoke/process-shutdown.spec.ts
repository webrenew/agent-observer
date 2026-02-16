import { spawn, type ChildProcess } from 'child_process'
import { once } from 'events'
import { expect, test } from '@playwright/test'
import { terminateManagedProcess } from '../../src/main/process-runner'

async function forceKillIfRunning(childProcess: ChildProcess): Promise<void> {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) return
  try {
    childProcess.kill('SIGKILL')
  } catch {
    // Process may already be gone.
  }
  try {
    await once(childProcess, 'exit')
  } catch {
    // Ignore post-kill wait failures in test cleanup.
  }
}

test('termination helper is a no-op for already exited processes', async () => {
  const childProcess = spawn(process.execPath, ['-e', 'process.exit(0)'], {
    stdio: 'ignore',
  })
  await once(childProcess, 'exit')

  const result = await terminateManagedProcess({
    process: childProcess,
    sigtermTimeoutMs: 100,
  })

  expect(result.escalatedToSigkill).toBe(false)
  expect(result.timedOut).toBe(false)
})

test('termination helper shuts down process via SIGTERM before escalation deadline', async () => {
  const childProcess = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
  })

  try {
    const result = await terminateManagedProcess({
      process: childProcess,
      sigtermTimeoutMs: 1_000,
      sigkillTimeoutMs: 500,
    })

    expect(result.escalatedToSigkill).toBe(false)
    expect(result.timedOut).toBe(false)
    expect(result.exitCode === 0 || result.signalCode === 'SIGTERM').toBe(true)
  } finally {
    await forceKillIfRunning(childProcess)
  }
})

test('termination helper escalates to SIGKILL after SIGTERM deadline', async () => {
  const childProcess = spawn(
    process.execPath,
    ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'],
    {
      stdio: 'ignore',
    }
  )

  try {
    // Give the child time to install its SIGTERM handler deterministically.
    await new Promise((resolve) => setTimeout(resolve, 100))

    const result = await terminateManagedProcess({
      process: childProcess,
      sigtermTimeoutMs: 200,
      sigkillTimeoutMs: 1_000,
    })

    expect(result.escalatedToSigkill).toBe(true)
    expect(result.timedOut).toBe(false)
    expect(result.signalCode).toBe('SIGKILL')
  } finally {
    await forceKillIfRunning(childProcess)
  }
})

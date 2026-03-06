import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { expect, test, _electron as electron, type Page, type ElectronApplication } from '@playwright/test'

async function finishOnboardingIfPresent(page: Page): Promise<void> {
  const finishOnboardingButton = page.getByRole('button', { name: 'Finish setup' })
  if (await finishOnboardingButton.count()) {
    await finishOnboardingButton.first().click()
  }
  await expect(page.locator('.slot-tab', { hasText: 'CHAT' }).first()).toBeVisible()
}

async function waitForAdditionalWindow(
  electronApp: ElectronApplication,
  existingWindows: Page[],
  expectedCount: number
): Promise<Page> {
  await expect
    .poll(async () => (await electronApp.windows()).length)
    .toBe(expectedCount)

  const updatedWindows = await electronApp.windows()
  const nextWindow = updatedWindows.find((candidate) => !existingWindows.includes(candidate))
  expect(nextWindow).toBeDefined()
  return nextWindow as Page
}

test('desktop smoke flows: main window can be recovered from popout-only state and popout returns route to the replacement window', async () => {
  const tempUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-observer-userdata-'))
  const tempHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-observer-home-'))

  const electronApp = await electron.launch({
    cwd: process.cwd(),
    args: ['.'],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      AGENT_SPACE_USER_DATA_DIR: tempUserDataDir,
      HOME: tempHomeDir,
      USERPROFILE: tempHomeDir,
    },
  })

  try {
    let mainWindow = await electronApp.firstWindow()
    await mainWindow.waitForLoadState('domcontentloaded')
    await finishOnboardingIfPresent(mainWindow)

    const firstSessionId = `smoke-popout-return-${Date.now()}`
    await mainWindow.evaluate(async (sessionId) => {
      await window.electronAPI.chat.popout(sessionId)
    }, firstSessionId)

    const firstPopout = await waitForAdditionalWindow(electronApp, [mainWindow], 2)
    await firstPopout.waitForLoadState('domcontentloaded')

    await mainWindow.close()
    await expect
      .poll(async () => (await electronApp.windows()).length)
      .toBe(1)

    const windowsBeforeActivate = await electronApp.windows()
    await electronApp.evaluate(({ app }) => {
      app.emit('activate')
    })
    mainWindow = await waitForAdditionalWindow(electronApp, windowsBeforeActivate, 2)
    await mainWindow.waitForLoadState('domcontentloaded')
    await finishOnboardingIfPresent(mainWindow)

    await mainWindow.evaluate(() => {
      const globalWindow = window as typeof window & {
        __returnedSessions?: string[]
        __unsubscribeReturned?: () => void
      }
      globalWindow.__returnedSessions = []
      globalWindow.__unsubscribeReturned?.()
      globalWindow.__unsubscribeReturned = window.electronAPI.chat.onReturned((sessionId) => {
        globalWindow.__returnedSessions?.push(sessionId)
      })
    })

    await firstPopout.close()
    await expect
      .poll(async () => {
        return await mainWindow.evaluate((sessionId) => {
          const globalWindow = window as typeof window & { __returnedSessions?: string[] }
          return globalWindow.__returnedSessions?.includes(sessionId) ?? false
        }, firstSessionId)
      })
      .toBe(true)

    const secondSessionId = `${firstSessionId}-second`
    await mainWindow.evaluate(async (sessionId) => {
      await window.electronAPI.chat.popout(sessionId)
    }, secondSessionId)

    const secondPopout = await waitForAdditionalWindow(electronApp, [mainWindow], 2)
    await secondPopout.waitForLoadState('domcontentloaded')

    await mainWindow.close()
    await expect
      .poll(async () => (await electronApp.windows()).length)
      .toBe(1)

    const windowsBeforeSecondInstance = await electronApp.windows()
    await electronApp.evaluate(({ app }) => {
      app.emit('second-instance')
    })
    mainWindow = await waitForAdditionalWindow(electronApp, windowsBeforeSecondInstance, 2)
    await mainWindow.waitForLoadState('domcontentloaded')
    await finishOnboardingIfPresent(mainWindow)

    await secondPopout.close()
  } finally {
    await electronApp.close()
    await fs.rm(tempUserDataDir, { recursive: true, force: true }).catch(() => {})
    await fs.rm(tempHomeDir, { recursive: true, force: true }).catch(() => {})
  }
})

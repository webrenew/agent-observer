import { expect, test } from '@playwright/test'
import {
  __testOnlyCanDispatchPendingCronRun,
  __testOnlyShouldRequeuePendingCronRun,
} from '../../src/main/scheduler'

test('scheduler dispatch gating blocks dispatch while shutting down', () => {
  expect(__testOnlyCanDispatchPendingCronRun(false, false, false)).toBe(true)
  expect(__testOnlyCanDispatchPendingCronRun(true, false, false)).toBe(false)
  expect(__testOnlyCanDispatchPendingCronRun(false, true, false)).toBe(false)
  expect(__testOnlyCanDispatchPendingCronRun(false, false, true)).toBe(false)
})

test('scheduler pending run requeue skips during shutdown', () => {
  expect(__testOnlyShouldRequeuePendingCronRun(false, false)).toBe(true)
  expect(__testOnlyShouldRequeuePendingCronRun(false, true)).toBe(false)
  expect(__testOnlyShouldRequeuePendingCronRun(true, false)).toBe(false)
  expect(__testOnlyShouldRequeuePendingCronRun(true, true)).toBe(false)
})

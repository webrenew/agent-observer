import { expect, test } from '@playwright/test'
import {
  __testOnlyPruneSchedulerMinuteLedgerEntries,
  __testOnlyShouldEnqueuePendingCronMinute,
} from '../../src/main/scheduler'

test('scheduler minute ledger pruning keeps newest active entries in retention window', () => {
  const now = 1_700_000_000_000
  const oneMinute = 60_000

  const pruned = __testOnlyPruneSchedulerMinuteLedgerEntries(
    [
      { taskId: 'task-a', minuteKey: '2026-2-16-10-00', recordedAtMs: now - (120 * oneMinute) },
      { taskId: 'task-a', minuteKey: '2026-2-16-11-59', recordedAtMs: now - (1 * oneMinute) },
      { taskId: 'task-b', minuteKey: '2026-2-16-11-45', recordedAtMs: now - (15 * oneMinute) },
      { taskId: 'task-c', minuteKey: '2026-2-16-11-50', recordedAtMs: now - (10 * oneMinute) },
    ],
    now,
    60,
    ['task-a', 'task-b']
  )

  expect(pruned.keptEntries).toEqual([
    { taskId: 'task-a', minuteKey: '2026-2-16-11-59', recordedAtMs: now - (1 * oneMinute) },
    { taskId: 'task-b', minuteKey: '2026-2-16-11-45', recordedAtMs: now - (15 * oneMinute) },
  ])
  expect(pruned.droppedEntries).toEqual([
    { taskId: 'task-c', minuteKey: '2026-2-16-11-50', recordedAtMs: now - (10 * oneMinute) },
    { taskId: 'task-a', minuteKey: '2026-2-16-10-00', recordedAtMs: now - (120 * oneMinute) },
  ])
})

test('scheduler minute enqueue dedupe only skips exact already-processed minute', () => {
  const lastRunMinuteKey = '2026-2-16-10-05'
  const pendingMinuteKeys = ['2026-2-16-10-06']

  expect(__testOnlyShouldEnqueuePendingCronMinute(lastRunMinuteKey, pendingMinuteKeys, '2026-2-16-10-05')).toBe(false)
  expect(__testOnlyShouldEnqueuePendingCronMinute(lastRunMinuteKey, pendingMinuteKeys, '2026-2-16-10-06')).toBe(false)
  expect(__testOnlyShouldEnqueuePendingCronMinute(lastRunMinuteKey, pendingMinuteKeys, '2026-2-16-10-04')).toBe(true)
  expect(__testOnlyShouldEnqueuePendingCronMinute(lastRunMinuteKey, pendingMinuteKeys, '2026-2-16-10-07')).toBe(true)
})

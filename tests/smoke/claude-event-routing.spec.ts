import { expect, test } from '@playwright/test'
import { __testOnlyResolveClaudeEventTargetIds } from '../../src/main/claude-session'

test('routes claude events to owning window when no extra observers are registered', () => {
  const targets = __testOnlyResolveClaudeEventTargetIds(42, [])
  expect(targets).toEqual([42])
})

test('routes claude events to owner plus observers without duplicate ids', () => {
  const targets = __testOnlyResolveClaudeEventTargetIds(42, [42, 43, 44, 43])
  expect(targets).toEqual([42, 43, 44])
})

test('supports observer-only delivery for externally observed sessions', () => {
  const targets = __testOnlyResolveClaudeEventTargetIds(null, [77, 78])
  expect(targets).toEqual([77, 78])
})

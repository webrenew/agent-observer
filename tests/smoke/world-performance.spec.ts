import { expect, test } from "@playwright/test";
import { resolveWorldTierConfig } from "../../web/src/lib/world-tier-config";
import {
  WORLD_ENTITY_HARD_CAPS,
  WORLD_FRAME_BUDGET,
  clampWorldEntityCaps,
} from "../../web/src/lib/world-performance";

test("hard caps clamp untrusted scene cap payloads", () => {
  const clamped = clampWorldEntityCaps({
    maxAgents: 10_000,
    maxDesks: 10_000,
    maxOfficeProps: 10_000,
    maxOfficePlants: 10_000,
    maxExteriorProps: 10_000,
  });

  expect(clamped).toEqual(WORLD_ENTITY_HARD_CAPS);
});

test("high install counts stay bounded by configured hard caps", () => {
  const tier = resolveWorldTierConfig(1_000_000);

  expect(tier.caps.maxAgents).toBeLessThanOrEqual(WORLD_ENTITY_HARD_CAPS.maxAgents);
  expect(tier.caps.maxDesks).toBeLessThanOrEqual(WORLD_ENTITY_HARD_CAPS.maxDesks);
  expect(tier.caps.maxOfficeProps).toBeLessThanOrEqual(WORLD_ENTITY_HARD_CAPS.maxOfficeProps);
  expect(tier.caps.maxOfficePlants).toBeLessThanOrEqual(WORLD_ENTITY_HARD_CAPS.maxOfficePlants);
  expect(tier.caps.maxExteriorProps).toBeLessThanOrEqual(WORLD_ENTITY_HARD_CAPS.maxExteriorProps);
});

test("frame-time budgets are explicit and internally consistent", () => {
  expect(WORLD_FRAME_BUDGET.targetFps).toBe(60);
  expect(WORLD_FRAME_BUDGET.minFps).toBeLessThan(WORLD_FRAME_BUDGET.targetFps);
  expect(WORLD_FRAME_BUDGET.maxFrameTimeMs).toBeLessThanOrEqual(22);
  expect(WORLD_FRAME_BUDGET.p95FrameTimeMs).toBeLessThan(
    WORLD_FRAME_BUDGET.maxFrameTimeMs
  );
});

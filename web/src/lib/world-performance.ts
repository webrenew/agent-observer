import {
  resolveWorldTierConfig,
  type WorldTierEntityCaps,
} from "@/lib/world-tier-config";

const BASE_WORLD_CAPS = resolveWorldTierConfig(0).caps;
const MAX_WORLD_TIER_CAPS = resolveWorldTierConfig(Number.MAX_SAFE_INTEGER).caps;

export const WORLD_ENTITY_HARD_CAPS: Readonly<WorldTierEntityCaps> = Object.freeze({
  ...MAX_WORLD_TIER_CAPS,
});

export interface WorldFrameBudget {
  targetFps: number;
  minFps: number;
  maxFrameTimeMs: number;
  p95FrameTimeMs: number;
}

export const WORLD_FRAME_BUDGET: Readonly<WorldFrameBudget> = Object.freeze({
  targetFps: 60,
  minFps: 45,
  maxFrameTimeMs: 22,
  p95FrameTimeMs: 18,
});

export interface NonCriticalCullDistanceBudget {
  officePlantsBase: number;
  officePlantsDetail: number;
  officePlantsRich: number;
  exteriorTier3: number;
  exteriorTier4: number;
}

export const NON_CRITICAL_CULL_DISTANCE: Readonly<NonCriticalCullDistanceBudget> =
  Object.freeze({
    officePlantsBase: 12,
    officePlantsDetail: 16,
    officePlantsRich: 20,
    exteriorTier3: 17,
    exteriorTier4: 26,
  });

function clampCap(value: number, floor: number, ceiling: number): number {
  if (!Number.isFinite(value)) return floor;
  return Math.max(floor, Math.min(ceiling, Math.floor(value)));
}

export function clampWorldEntityCaps(caps: WorldTierEntityCaps): WorldTierEntityCaps {
  return {
    maxAgents: clampCap(
      caps.maxAgents,
      BASE_WORLD_CAPS.maxAgents,
      WORLD_ENTITY_HARD_CAPS.maxAgents
    ),
    maxDesks: clampCap(
      caps.maxDesks,
      BASE_WORLD_CAPS.maxDesks,
      WORLD_ENTITY_HARD_CAPS.maxDesks
    ),
    maxOfficeProps: clampCap(
      caps.maxOfficeProps,
      BASE_WORLD_CAPS.maxOfficeProps,
      WORLD_ENTITY_HARD_CAPS.maxOfficeProps
    ),
    maxOfficePlants: clampCap(
      caps.maxOfficePlants,
      BASE_WORLD_CAPS.maxOfficePlants,
      WORLD_ENTITY_HARD_CAPS.maxOfficePlants
    ),
    maxExteriorProps: clampCap(
      caps.maxExteriorProps,
      BASE_WORLD_CAPS.maxExteriorProps,
      WORLD_ENTITY_HARD_CAPS.maxExteriorProps
    ),
  };
}

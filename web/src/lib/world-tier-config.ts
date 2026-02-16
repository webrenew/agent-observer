export const WORLD_TIER_CONFIG_VERSION = "tiers-v1";

export interface WorldUnlockFlags {
  agentsAndDesks: boolean;
  officeDetail: boolean;
  exteriorPark: boolean;
  blueSky: boolean;
  worldRichness: boolean;
}

export interface WorldTierEntityCaps {
  maxAgents: number;
  maxDesks: number;
  maxOfficeProps: number;
  maxOfficePlants: number;
  maxExteriorProps: number;
}

export interface WorldTierConfig {
  level: number;
  key: string;
  minInstallCount: number;
  unlocks: WorldUnlockFlags;
  caps: WorldTierEntityCaps;
}

export interface ResolvedWorldTierConfig extends WorldTierConfig {
  nextInstallCount: number | null;
}

export const WORLD_TIER_CONFIG: readonly WorldTierConfig[] = [
  {
    level: 0,
    key: "base",
    minInstallCount: 0,
    unlocks: {
      agentsAndDesks: false,
      officeDetail: false,
      exteriorPark: false,
      blueSky: false,
      worldRichness: false,
    },
    caps: {
      maxAgents: 4,
      maxDesks: 4,
      maxOfficeProps: 6,
      maxOfficePlants: 10,
      maxExteriorProps: 0,
    },
  },
  {
    level: 1,
    key: "tier_1_density",
    minInstallCount: 25,
    unlocks: {
      agentsAndDesks: true,
      officeDetail: false,
      exteriorPark: false,
      blueSky: false,
      worldRichness: false,
    },
    caps: {
      maxAgents: 8,
      maxDesks: 8,
      maxOfficeProps: 8,
      maxOfficePlants: 12,
      maxExteriorProps: 0,
    },
  },
  {
    level: 2,
    key: "tier_2_office_detail",
    minInstallCount: 100,
    unlocks: {
      agentsAndDesks: true,
      officeDetail: true,
      exteriorPark: false,
      blueSky: false,
      worldRichness: false,
    },
    caps: {
      maxAgents: 10,
      maxDesks: 10,
      maxOfficeProps: 12,
      maxOfficePlants: 16,
      maxExteriorProps: 0,
    },
  },
  {
    level: 3,
    key: "tier_3_exterior",
    minInstallCount: 250,
    unlocks: {
      agentsAndDesks: true,
      officeDetail: true,
      exteriorPark: true,
      blueSky: true,
      worldRichness: false,
    },
    caps: {
      maxAgents: 12,
      maxDesks: 12,
      maxOfficeProps: 16,
      maxOfficePlants: 20,
      maxExteriorProps: 10,
    },
  },
  {
    level: 4,
    key: "tier_4_world_richness",
    minInstallCount: 500,
    unlocks: {
      agentsAndDesks: true,
      officeDetail: true,
      exteriorPark: true,
      blueSky: true,
      worldRichness: true,
    },
    caps: {
      maxAgents: 14,
      maxDesks: 14,
      maxOfficeProps: 20,
      maxOfficePlants: 24,
      maxExteriorProps: 16,
    },
  },
];

export function normalizeInstallCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function resolveWorldTierConfig(installCount: number): ResolvedWorldTierConfig {
  const normalizedCount = normalizeInstallCount(installCount);
  let tierIndex = 0;

  for (let index = 1; index < WORLD_TIER_CONFIG.length; index += 1) {
    const candidate = WORLD_TIER_CONFIG[index];
    if (normalizedCount >= candidate.minInstallCount) {
      tierIndex = index;
      continue;
    }
    break;
  }

  const current = WORLD_TIER_CONFIG[tierIndex];
  const next = WORLD_TIER_CONFIG[tierIndex + 1];
  return {
    ...current,
    unlocks: { ...current.unlocks },
    caps: { ...current.caps },
    nextInstallCount: next?.minInstallCount ?? null,
  };
}

import type { PrototypeInstallCountSnapshot } from "@/lib/install-count-core";
import {
  WORLD_TIER_CONFIG_VERSION,
  normalizeInstallCount,
  resolveWorldTierConfig,
  type WorldTierEntityCaps,
  type WorldUnlockFlags,
} from "@/lib/world-tier-config";

export const WORLD_STATE_SCHEMA_VERSION = "2026-02-16.world-state.v1";

export type WorldInstallSourceKind = "prototype" | "production";
export type WorldInstallSourceName =
  | "github_release_assets"
  | "install_beacon_aggregate";

export interface WorldInstallSignal {
  count: number;
  checkedAt: string;
  sourceKind: WorldInstallSourceKind;
  sourceName: WorldInstallSourceName;
  sourceDetail: string;
}

export interface ResolveWorldInstallSignalOptions {
  preferredSource?: WorldInstallSourceKind;
  productionInstallCount?: number | null;
  checkedAt?: string;
}

export interface WorldTierState {
  level: number;
  key: string;
  minInstallCount: number;
  nextInstallCount: number | null;
}

export interface WorldStatePayload {
  schemaVersion: string;
  generatedAt: string;
  installCount: number;
  tier: WorldTierState;
  unlocks: WorldUnlockFlags;
  caps: WorldTierEntityCaps;
  installSource: {
    kind: WorldInstallSourceKind;
    name: WorldInstallSourceName;
    detail: string;
  };
  versions: {
    worldState: string;
    tierConfig: string;
  };
}

export function resolveTierForInstallCount(installCount: number): WorldTierState {
  const tier = resolveWorldTierConfig(installCount);
  return {
    level: tier.level,
    key: tier.key,
    minInstallCount: tier.minInstallCount,
    nextInstallCount: tier.nextInstallCount,
  };
}

export function resolveWorldInstallSignal(
  prototypeSnapshot: PrototypeInstallCountSnapshot,
  options: ResolveWorldInstallSignalOptions = {}
): WorldInstallSignal {
  const preferredSource = options.preferredSource ?? "prototype";
  const productionInstallCount =
    typeof options.productionInstallCount === "number" &&
    Number.isFinite(options.productionInstallCount) &&
    options.productionInstallCount >= 0
      ? Math.floor(options.productionInstallCount)
      : null;

  if (preferredSource === "production" && productionInstallCount !== null) {
    return {
      count: productionInstallCount,
      checkedAt: options.checkedAt ?? new Date().toISOString(),
      sourceKind: "production",
      sourceName: "install_beacon_aggregate",
      sourceDetail: "aggregated_unique_installations",
    };
  }

  return {
    count: normalizeInstallCount(prototypeSnapshot.installCount),
    checkedAt: prototypeSnapshot.checkedAt,
    sourceKind: "prototype",
    sourceName: "github_release_assets",
    sourceDetail: prototypeSnapshot.source,
  };
}

export function buildWorldStatePayload(signal: WorldInstallSignal): WorldStatePayload {
  const installCount = normalizeInstallCount(signal.count);
  const tier = resolveWorldTierConfig(installCount);

  return {
    schemaVersion: WORLD_STATE_SCHEMA_VERSION,
    generatedAt: signal.checkedAt,
    installCount,
    tier: {
      level: tier.level,
      key: tier.key,
      minInstallCount: tier.minInstallCount,
      nextInstallCount: tier.nextInstallCount,
    },
    unlocks: { ...tier.unlocks },
    caps: { ...tier.caps },
    installSource: {
      kind: signal.sourceKind,
      name: signal.sourceName,
      detail: signal.sourceDetail,
    },
    versions: {
      worldState: WORLD_STATE_SCHEMA_VERSION,
      tierConfig: WORLD_TIER_CONFIG_VERSION,
    },
  };
}

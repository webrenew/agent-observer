import type { WorldTierEntityCaps, WorldUnlockFlags } from "@/lib/world-tier-config";

export interface ResolveExteriorVisibilityOptions {
  unlocks: WorldUnlockFlags;
  caps: WorldTierEntityCaps;
  totalExteriorPropSlots: number;
}

export interface ExteriorVisibility {
  showExteriorPark: boolean;
  showBlueSky: boolean;
  richEnvironment: boolean;
  visibleExteriorPropCount: number;
}

export function resolveExteriorVisibility(
  options: ResolveExteriorVisibilityOptions
): ExteriorVisibility {
  const showExteriorPark = options.unlocks.exteriorPark;
  const showBlueSky = options.unlocks.blueSky;
  const richEnvironment = options.unlocks.worldRichness;

  const visibleExteriorPropCount = showExteriorPark
    ? Math.max(
        0,
        Math.min(
          options.totalExteriorPropSlots,
          Math.floor(options.caps.maxExteriorProps)
        )
      )
    : 0;

  return {
    showExteriorPark,
    showBlueSky,
    richEnvironment,
    visibleExteriorPropCount,
  };
}

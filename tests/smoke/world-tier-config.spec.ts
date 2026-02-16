import { expect, test } from "@playwright/test";
import {
  WORLD_TIER_CONFIG,
  resolveWorldTierConfig,
} from "../../web/src/lib/world-tier-config";

test("tier config resolves thresholds deterministically", () => {
  expect(resolveWorldTierConfig(0).key).toBe("base");
  expect(resolveWorldTierConfig(24).key).toBe("base");
  expect(resolveWorldTierConfig(25).key).toBe("tier_1_density");
  expect(resolveWorldTierConfig(100).key).toBe("tier_2_office_detail");
  expect(resolveWorldTierConfig(250).key).toBe("tier_3_exterior");
  expect(resolveWorldTierConfig(500).key).toBe("tier_4_world_richness");
  expect(resolveWorldTierConfig(99999).nextInstallCount).toBeNull();
});

test("tier config enforces monotonic caps for performance guardrails", () => {
  let previous = WORLD_TIER_CONFIG[0];

  for (const tier of WORLD_TIER_CONFIG.slice(1)) {
    expect(tier.minInstallCount).toBeGreaterThan(previous.minInstallCount);
    expect(tier.caps.maxAgents).toBeGreaterThanOrEqual(previous.caps.maxAgents);
    expect(tier.caps.maxDesks).toBeGreaterThanOrEqual(previous.caps.maxDesks);
    expect(tier.caps.maxOfficeProps).toBeGreaterThanOrEqual(previous.caps.maxOfficeProps);
    expect(tier.caps.maxOfficePlants).toBeGreaterThanOrEqual(previous.caps.maxOfficePlants);
    expect(tier.caps.maxExteriorProps).toBeGreaterThanOrEqual(previous.caps.maxExteriorProps);
    previous = tier;
  }
});

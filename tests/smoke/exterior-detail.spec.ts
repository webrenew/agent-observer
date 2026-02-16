import { expect, test } from "@playwright/test";
import { resolveExteriorVisibility } from "../../web/src/lib/exterior-detail";
import { resolveWorldTierConfig } from "../../web/src/lib/world-tier-config";

test("tier 2 keeps exterior layer disabled", () => {
  const tier2 = resolveWorldTierConfig(100);
  const visibility = resolveExteriorVisibility({
    unlocks: tier2.unlocks,
    caps: tier2.caps,
    totalExteriorPropSlots: 16,
  });

  expect(visibility).toEqual({
    showExteriorPark: false,
    showBlueSky: false,
    richEnvironment: false,
    visibleExteriorPropCount: 0,
  });
});

test("tier 3 enables park and sky with capped exterior props", () => {
  const tier3 = resolveWorldTierConfig(250);
  const visibility = resolveExteriorVisibility({
    unlocks: tier3.unlocks,
    caps: tier3.caps,
    totalExteriorPropSlots: 16,
  });

  expect(visibility).toEqual({
    showExteriorPark: true,
    showBlueSky: true,
    richEnvironment: false,
    visibleExteriorPropCount: 10,
  });
});

test("tier 4 unlocks richer exterior variation", () => {
  const tier4 = resolveWorldTierConfig(500);
  const visibility = resolveExteriorVisibility({
    unlocks: tier4.unlocks,
    caps: tier4.caps,
    totalExteriorPropSlots: 16,
  });

  expect(visibility).toEqual({
    showExteriorPark: true,
    showBlueSky: true,
    richEnvironment: true,
    visibleExteriorPropCount: 16,
  });
});

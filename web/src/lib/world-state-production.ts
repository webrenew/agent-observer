import { getInstallBeaconAggregateCount } from "@/lib/install-beacon-store";

export async function resolveProductionInstallCountFromAggregate(
  fallbackCount: number | null
): Promise<number | null> {
  try {
    const aggregate = await getInstallBeaconAggregateCount();
    if (Number.isFinite(aggregate) && aggregate >= 0) {
      return Math.floor(aggregate);
    }
  } catch (error) {
    console.warn("Failed to resolve install beacon aggregate count", error);
  }
  return fallbackCount;
}

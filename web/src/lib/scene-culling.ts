export interface PositionedSceneItem {
  position: [number, number, number];
}

export interface ResolveDistanceCulledItemsOptions<T extends PositionedSceneItem> {
  items: readonly T[];
  maxVisibleCount: number;
  focalPoint: [number, number, number];
  maxDistance: number;
}

function resolveDistanceSquared(
  from: [number, number, number],
  to: [number, number, number]
): number {
  const dx = from[0] - to[0];
  const dy = from[1] - to[1];
  const dz = from[2] - to[2];
  return dx * dx + dy * dy + dz * dz;
}

export function resolveDistanceCulledItems<T extends PositionedSceneItem>(
  options: ResolveDistanceCulledItemsOptions<T>
): T[] {
  const safeVisibleCount = Number.isFinite(options.maxVisibleCount)
    ? Math.max(0, Math.floor(options.maxVisibleCount))
    : 0;
  if (safeVisibleCount === 0 || options.items.length === 0) return [];

  const safeDistance = Number.isFinite(options.maxDistance)
    ? Math.max(0, options.maxDistance)
    : Number.POSITIVE_INFINITY;
  const maxDistanceSquared = safeDistance * safeDistance;

  const withinDistance = options.items.filter(
    (item) =>
      resolveDistanceSquared(item.position, options.focalPoint) <=
      maxDistanceSquared
  );

  // Never hide every item in a class due to a strict culling threshold.
  const source = withinDistance.length > 0 ? withinDistance : options.items;
  return source.slice(0, safeVisibleCount);
}

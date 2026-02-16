const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_SOURCE_IP = 30;
const RATE_LIMIT_MAX_PER_INSTALLATION = 6;
const BUCKET_RETENTION_WINDOWS = 3;

interface RateBucket {
  windowStartMs: number;
  count: number;
}

interface RateLimitMap {
  sourceIpBuckets: Map<string, RateBucket>;
  installationBuckets: Map<string, RateBucket>;
}

export interface InstallBeaconRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  reason: "source_ip" | "installation_id_hash" | "allowed";
}

const rateLimitState: RateLimitMap = {
  sourceIpBuckets: new Map(),
  installationBuckets: new Map(),
};

function pruneBuckets(map: Map<string, RateBucket>, nowMs: number): void {
  const pruneBefore = nowMs - RATE_LIMIT_WINDOW_MS * BUCKET_RETENTION_WINDOWS;
  for (const [key, bucket] of map.entries()) {
    if (bucket.windowStartMs < pruneBefore) {
      map.delete(key);
    }
  }
}

function consumeBucket(
  map: Map<string, RateBucket>,
  key: string,
  nowMs: number,
  maxWithinWindow: number
): { allowed: boolean; retryAfterSeconds: number } {
  const bucket = map.get(key);
  if (!bucket || nowMs - bucket.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    map.set(key, { windowStartMs: nowMs, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxWithinWindow) {
    const retryAfterMs = Math.max(0, bucket.windowStartMs + RATE_LIMIT_WINDOW_MS - nowMs);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1_000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function checkInstallBeaconRateLimit(options: {
  sourceIp: string;
  installationIdHash: string;
  nowMs?: number;
}): InstallBeaconRateLimitResult {
  const nowMs = options.nowMs ?? Date.now();

  pruneBuckets(rateLimitState.sourceIpBuckets, nowMs);
  pruneBuckets(rateLimitState.installationBuckets, nowMs);

  const sourceIpCheck = consumeBucket(
    rateLimitState.sourceIpBuckets,
    options.sourceIp,
    nowMs,
    RATE_LIMIT_MAX_PER_SOURCE_IP
  );
  if (!sourceIpCheck.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: sourceIpCheck.retryAfterSeconds,
      reason: "source_ip",
    };
  }

  const installationCheck = consumeBucket(
    rateLimitState.installationBuckets,
    options.installationIdHash,
    nowMs,
    RATE_LIMIT_MAX_PER_INSTALLATION
  );
  if (!installationCheck.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: installationCheck.retryAfterSeconds,
      reason: "installation_id_hash",
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    reason: "allowed",
  };
}

export function __testOnlyResetInstallBeaconRateLimit(): void {
  rateLimitState.sourceIpBuckets.clear();
  rateLimitState.installationBuckets.clear();
}

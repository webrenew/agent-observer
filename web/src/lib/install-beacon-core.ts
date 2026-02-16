export const INSTALL_BEACON_SCHEMA_VERSION = "2026-02-16.install-beacon.v1";
export const INSTALL_BEACON_HASH_HEX_LENGTH = 64;

const HASH_PATTERN = new RegExp(`^[a-fA-F0-9]{${INSTALL_BEACON_HASH_HEX_LENGTH}}$`);
const APP_VERSION_MAX_LENGTH = 64;

export interface InstallBeaconEventInput {
  installationIdHash: string;
  appVersion: string;
  firstSeenAt: string;
}

export type InstallBeaconParseResult =
  | { ok: true; value: InstallBeaconEventInput }
  | { ok: false; error: string };

function parseIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function parseInstallBeaconRequestBody(input: unknown): InstallBeaconParseResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Beacon payload must be a JSON object" };
  }

  const payload = input as {
    installation_id_hash?: unknown;
    app_version?: unknown;
    first_seen_at?: unknown;
  };

  const installationIdHash =
    typeof payload.installation_id_hash === "string"
      ? payload.installation_id_hash.trim().toLowerCase()
      : "";
  if (!HASH_PATTERN.test(installationIdHash)) {
    return {
      ok: false,
      error: `installation_id_hash must be a ${INSTALL_BEACON_HASH_HEX_LENGTH}-char hex string`,
    };
  }

  const appVersion =
    typeof payload.app_version === "string" ? payload.app_version.trim() : "";
  if (appVersion.length === 0 || appVersion.length > APP_VERSION_MAX_LENGTH) {
    return { ok: false, error: "app_version must be a non-empty string <= 64 chars" };
  }

  const firstSeenAt = parseIsoTimestamp(payload.first_seen_at);
  if (!firstSeenAt) {
    return { ok: false, error: "first_seen_at must be an ISO-8601 timestamp" };
  }

  return {
    ok: true,
    value: {
      installationIdHash,
      appVersion,
      firstSeenAt,
    },
  };
}

export function resolveInstallBeaconSourceIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

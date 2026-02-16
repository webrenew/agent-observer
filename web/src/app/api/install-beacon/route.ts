import { NextRequest, NextResponse } from "next/server";
import {
  INSTALL_BEACON_SCHEMA_VERSION,
  parseInstallBeaconRequestBody,
  resolveInstallBeaconSourceIp,
} from "@/lib/install-beacon-core";
import { checkInstallBeaconRateLimit } from "@/lib/install-beacon-rate-limit";
import { ingestInstallBeaconEvent } from "@/lib/install-beacon-store";

const CACHE_CONTROL_NO_STORE = "no-store";

export async function POST(request: NextRequest): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    const response = NextResponse.json(
      { error: "Beacon payload must be valid JSON" },
      { status: 400 }
    );
    response.headers.set("Cache-Control", CACHE_CONTROL_NO_STORE);
    return response;
  }

  const parsed = parseInstallBeaconRequestBody(rawBody);
  if (!parsed.ok) {
    const response = NextResponse.json({ error: parsed.error }, { status: 400 });
    response.headers.set("Cache-Control", CACHE_CONTROL_NO_STORE);
    return response;
  }

  const sourceIp = resolveInstallBeaconSourceIp(request.headers);
  const rateLimit = checkInstallBeaconRateLimit({
    sourceIp,
    installationIdHash: parsed.value.installationIdHash,
  });
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      {
        error: `Rate limit exceeded for ${rateLimit.reason}`,
      },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    response.headers.set("Cache-Control", CACHE_CONTROL_NO_STORE);
    return response;
  }

  const ingestResult = await ingestInstallBeaconEvent(parsed.value);
  const response = NextResponse.json(
    {
      accepted: true,
      duplicate: ingestResult.duplicate,
      uniqueInstallCount: ingestResult.uniqueInstallCount,
      aggregatedAt: ingestResult.updatedAt,
      schemaVersion: INSTALL_BEACON_SCHEMA_VERSION,
    },
    { status: 202 }
  );
  response.headers.set("Cache-Control", CACHE_CONTROL_NO_STORE);
  return response;
}

import fs from "fs";
import os from "os";
import path from "path";
import { expect, test } from "@playwright/test";
import {
  parseInstallBeaconRequestBody,
} from "../../web/src/lib/install-beacon-core";
import {
  __testOnlyResetInstallBeaconRateLimit,
  checkInstallBeaconRateLimit,
} from "../../web/src/lib/install-beacon-rate-limit";
import {
  __testOnlyResetInstallBeaconStoreCache,
  getInstallBeaconAggregateSnapshot,
  ingestInstallBeaconEvent,
} from "../../web/src/lib/install-beacon-store";
import { resolveProductionInstallCountFromAggregate } from "../../web/src/lib/world-state-production";

test("install beacon payload validation enforces schema and hash format", () => {
  const valid = parseInstallBeaconRequestBody({
    installation_id_hash: "a".repeat(64),
    app_version: "1.2.3",
    first_seen_at: "2026-02-16T00:00:00.000Z",
  });
  expect(valid.ok).toBe(true);

  const invalidHash = parseInstallBeaconRequestBody({
    installation_id_hash: "not-a-hash",
    app_version: "1.2.3",
    first_seen_at: "2026-02-16T00:00:00.000Z",
  });
  expect(invalidHash.ok).toBe(false);

  const invalidTimestamp = parseInstallBeaconRequestBody({
    installation_id_hash: "b".repeat(64),
    app_version: "1.2.3",
    first_seen_at: "not-a-date",
  });
  expect(invalidTimestamp.ok).toBe(false);
});

test("install beacon ingest dedupes by installation hash and aggregates unique installs", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-observer-install-beacon-store-"));
  const stateFilePath = path.join(tempDir, "store.json");
  __testOnlyResetInstallBeaconStoreCache();

  try {
    const first = await ingestInstallBeaconEvent(
      {
        installationIdHash: "1".repeat(64),
        appVersion: "1.2.0",
        firstSeenAt: "2026-02-16T00:00:00.000Z",
      },
      { stateFilePath, nowIso: "2026-02-16T00:01:00.000Z" }
    );
    expect(first.duplicate).toBe(false);
    expect(first.uniqueInstallCount).toBe(1);

    const duplicate = await ingestInstallBeaconEvent(
      {
        installationIdHash: "1".repeat(64),
        appVersion: "1.2.1",
        firstSeenAt: "2026-02-16T00:00:00.000Z",
      },
      { stateFilePath, nowIso: "2026-02-16T00:02:00.000Z" }
    );
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.uniqueInstallCount).toBe(1);

    const second = await ingestInstallBeaconEvent(
      {
        installationIdHash: "2".repeat(64),
        appVersion: "1.2.1",
        firstSeenAt: "2026-02-16T00:03:00.000Z",
      },
      { stateFilePath, nowIso: "2026-02-16T00:03:00.000Z" }
    );
    expect(second.duplicate).toBe(false);
    expect(second.uniqueInstallCount).toBe(2);

    const snapshot = await getInstallBeaconAggregateSnapshot({ stateFilePath });
    expect(snapshot.uniqueInstallCount).toBe(2);
  } finally {
    __testOnlyResetInstallBeaconStoreCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("install beacon rate limiter applies per-install and per-source caps", () => {
  __testOnlyResetInstallBeaconRateLimit();
  const nowMs = 1_735_620_000_000;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = checkInstallBeaconRateLimit({
      sourceIp: "127.0.0.1",
      installationIdHash: "a".repeat(64),
      nowMs,
    });
    expect(result.allowed).toBe(true);
  }

  const blockedByInstall = checkInstallBeaconRateLimit({
    sourceIp: "127.0.0.1",
    installationIdHash: "a".repeat(64),
    nowMs,
  });
  expect(blockedByInstall.allowed).toBe(false);
  expect(blockedByInstall.reason).toBe("installation_id_hash");

  __testOnlyResetInstallBeaconRateLimit();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = checkInstallBeaconRateLimit({
      sourceIp: "127.0.0.1",
      installationIdHash: `${String(attempt).padStart(2, "0")}${"b".repeat(62)}`,
      nowMs,
    });
    expect(result.allowed).toBe(true);
  }
  const blockedByIp = checkInstallBeaconRateLimit({
    sourceIp: "127.0.0.1",
    installationIdHash: "c".repeat(64),
    nowMs,
  });
  expect(blockedByIp.allowed).toBe(false);
  expect(blockedByIp.reason).toBe("source_ip");
});

test("world-state production resolver prefers install beacon aggregate over fallback env count", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-observer-install-beacon-world-state-"));
  const stateFilePath = path.join(tempDir, "store.json");
  const previousStorePath = process.env.AGENT_OBSERVER_INSTALL_BEACON_STORE_FILE;
  process.env.AGENT_OBSERVER_INSTALL_BEACON_STORE_FILE = stateFilePath;
  __testOnlyResetInstallBeaconStoreCache();

  try {
    await ingestInstallBeaconEvent(
      {
        installationIdHash: "d".repeat(64),
        appVersion: "1.2.0",
        firstSeenAt: "2026-02-16T00:00:00.000Z",
      },
      { stateFilePath, nowIso: "2026-02-16T00:00:30.000Z" }
    );
    await ingestInstallBeaconEvent(
      {
        installationIdHash: "e".repeat(64),
        appVersion: "1.2.0",
        firstSeenAt: "2026-02-16T00:01:00.000Z",
      },
      { stateFilePath, nowIso: "2026-02-16T00:01:10.000Z" }
    );

    const productionCount = await resolveProductionInstallCountFromAggregate(500);
    expect(productionCount).toBe(2);
  } finally {
    if (typeof previousStorePath === "string") {
      process.env.AGENT_OBSERVER_INSTALL_BEACON_STORE_FILE = previousStorePath;
    } else {
      delete process.env.AGENT_OBSERVER_INSTALL_BEACON_STORE_FILE;
    }
    __testOnlyResetInstallBeaconStoreCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

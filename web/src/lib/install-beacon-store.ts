import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  INSTALL_BEACON_SCHEMA_VERSION,
  type InstallBeaconEventInput,
} from "@/lib/install-beacon-core";

const INSTALL_BEACON_STORE_FILE_ENV = "AGENT_OBSERVER_INSTALL_BEACON_STORE_FILE";
const DEFAULT_INSTALL_BEACON_STORE_FILE = path.join(
  os.tmpdir(),
  "agent-observer-install-beacon-store.json"
);

interface InstallBeaconInstallationRecord {
  firstSeenAt: string;
  firstReceivedAt: string;
  lastReceivedAt: string;
  lastAppVersion: string;
}

interface InstallBeaconStoreState {
  schemaVersion: string;
  updatedAt: string;
  installations: Record<string, InstallBeaconInstallationRecord>;
}

export interface InstallBeaconIngestResult {
  duplicate: boolean;
  uniqueInstallCount: number;
  updatedAt: string;
}

export interface InstallBeaconStoreSnapshot {
  uniqueInstallCount: number;
  updatedAt: string;
}

interface InstallBeaconStoreOptions {
  stateFilePath?: string;
  nowIso?: string;
}

const storeByPath = new Map<string, InstallBeaconStoreState>();
let storeWriteQueue: Promise<void> = Promise.resolve();

function resolveStoreFilePath(override?: string): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromEnv = process.env[INSTALL_BEACON_STORE_FILE_ENV]?.trim();
  return fromEnv && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_INSTALL_BEACON_STORE_FILE;
}

function createEmptyStore(nowIso: string): InstallBeaconStoreState {
  return {
    schemaVersion: INSTALL_BEACON_SCHEMA_VERSION,
    updatedAt: nowIso,
    installations: {},
  };
}

function normalizeIso(value: unknown, fallbackIso: string): string {
  if (typeof value !== "string") return fallbackIso;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallbackIso;
  return new Date(parsed).toISOString();
}

function normalizeStore(raw: unknown, nowIso: string): InstallBeaconStoreState {
  const candidate =
    raw && typeof raw === "object"
      ? (raw as {
          schemaVersion?: unknown;
          updatedAt?: unknown;
          installations?: Record<string, unknown>;
        })
      : {};

  const installations: Record<string, InstallBeaconInstallationRecord> = {};
  const rawInstallations = candidate.installations ?? {};
  if (rawInstallations && typeof rawInstallations === "object") {
    for (const [installationIdHash, record] of Object.entries(rawInstallations)) {
      if (typeof installationIdHash !== "string" || installationIdHash.length === 0) continue;
      if (!record || typeof record !== "object") continue;
      const typedRecord = record as {
        firstSeenAt?: unknown;
        firstReceivedAt?: unknown;
        lastReceivedAt?: unknown;
        lastAppVersion?: unknown;
      };
      const firstSeenAt = normalizeIso(typedRecord.firstSeenAt, nowIso);
      installations[installationIdHash] = {
        firstSeenAt,
        firstReceivedAt: normalizeIso(typedRecord.firstReceivedAt, firstSeenAt),
        lastReceivedAt: normalizeIso(typedRecord.lastReceivedAt, firstSeenAt),
        lastAppVersion:
          typeof typedRecord.lastAppVersion === "string"
            ? typedRecord.lastAppVersion
            : "unknown",
      };
    }
  }

  return {
    schemaVersion:
      typeof candidate.schemaVersion === "string"
        ? candidate.schemaVersion
        : INSTALL_BEACON_SCHEMA_VERSION,
    updatedAt: normalizeIso(candidate.updatedAt, nowIso),
    installations,
  };
}

async function loadStore(stateFilePath: string, nowIso: string): Promise<InstallBeaconStoreState> {
  const cached = storeByPath.get(stateFilePath);
  if (cached) return cached;

  let store = createEmptyStore(nowIso);
  try {
    if (fs.existsSync(stateFilePath)) {
      const raw = await fs.promises.readFile(stateFilePath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      store = normalizeStore(parsed, nowIso);
    }
  } catch (error) {
    console.warn("Failed to read install beacon store, using empty state", error);
  }

  storeByPath.set(stateFilePath, store);
  return store;
}

function queueStoreWrite(task: () => Promise<void>): Promise<void> {
  const queuedTask = storeWriteQueue.then(task, task);
  storeWriteQueue = queuedTask.catch(() => undefined);
  return queuedTask;
}

async function persistStore(
  stateFilePath: string,
  store: InstallBeaconStoreState
): Promise<void> {
  await queueStoreWrite(async () => {
    await fs.promises.mkdir(path.dirname(stateFilePath), { recursive: true });
    await fs.promises.writeFile(
      stateFilePath,
      JSON.stringify(store, null, 2),
      "utf-8"
    );
  });
}

export async function ingestInstallBeaconEvent(
  input: InstallBeaconEventInput,
  options: InstallBeaconStoreOptions = {}
): Promise<InstallBeaconIngestResult> {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const stateFilePath = resolveStoreFilePath(options.stateFilePath);
  const store = await loadStore(stateFilePath, nowIso);

  const existing = store.installations[input.installationIdHash];
  if (existing) {
    existing.lastReceivedAt = nowIso;
    existing.lastAppVersion = input.appVersion;
    if (Date.parse(input.firstSeenAt) < Date.parse(existing.firstSeenAt)) {
      existing.firstSeenAt = input.firstSeenAt;
    }
  } else {
    store.installations[input.installationIdHash] = {
      firstSeenAt: input.firstSeenAt,
      firstReceivedAt: nowIso,
      lastReceivedAt: nowIso,
      lastAppVersion: input.appVersion,
    };
  }

  store.schemaVersion = INSTALL_BEACON_SCHEMA_VERSION;
  store.updatedAt = nowIso;
  await persistStore(stateFilePath, store);

  return {
    duplicate: Boolean(existing),
    uniqueInstallCount: Object.keys(store.installations).length,
    updatedAt: store.updatedAt,
  };
}

export async function getInstallBeaconAggregateSnapshot(
  options: InstallBeaconStoreOptions = {}
): Promise<InstallBeaconStoreSnapshot> {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const stateFilePath = resolveStoreFilePath(options.stateFilePath);
  const store = await loadStore(stateFilePath, nowIso);

  return {
    uniqueInstallCount: Object.keys(store.installations).length,
    updatedAt: store.updatedAt,
  };
}

export async function getInstallBeaconAggregateCount(
  options: InstallBeaconStoreOptions = {}
): Promise<number> {
  const snapshot = await getInstallBeaconAggregateSnapshot(options);
  return snapshot.uniqueInstallCount;
}

export function __testOnlyResetInstallBeaconStoreCache(): void {
  storeByPath.clear();
  storeWriteQueue = Promise.resolve();
}

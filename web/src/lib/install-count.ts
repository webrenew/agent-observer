import "server-only";

import { unstable_cache } from "next/cache";
import {
  AGENT_SPACE_RELEASES_COUNT_API_URL,
  type GitHubReleaseSummary,
} from "@/lib/downloads";
import {
  computePrototypeInstallCountSnapshot,
  resolvePrototypeInstallCountFallback,
  type PrototypeInstallCountSnapshot,
} from "@/lib/install-count-core";

const DAILY_REVALIDATE_SECONDS = 24 * 60 * 60;
const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_USER_AGENT = "agent-observer-web-install-count";

let lastKnownInstallCountSnapshot: PrototypeInstallCountSnapshot | null = null;

async function fetchReleaseSummaries(): Promise<GitHubReleaseSummary[]> {
  const response = await fetch(AGENT_SPACE_RELEASES_COUNT_API_URL, {
    headers: {
      Accept: GITHUB_ACCEPT,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": GITHUB_USER_AGENT,
    },
    next: { revalidate: DAILY_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Install count release fetch failed: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Install count release fetch returned non-array payload");
  }

  return payload as GitHubReleaseSummary[];
}

async function fetchPrototypeInstallCountSnapshot(): Promise<PrototypeInstallCountSnapshot> {
  const releases = await fetchReleaseSummaries();
  const snapshot = computePrototypeInstallCountSnapshot(releases);

  if (snapshot.installerAssetCount === 0) {
    throw new Error("Install count release payload missing installer assets");
  }

  return snapshot;
}

const getDailyCachedPrototypeInstallCountSnapshot = unstable_cache(
  async (): Promise<PrototypeInstallCountSnapshot> => fetchPrototypeInstallCountSnapshot(),
  ["prototype-install-count-v1"],
  { revalidate: DAILY_REVALIDATE_SECONDS }
);

export async function getPrototypeInstallCountSnapshot(): Promise<PrototypeInstallCountSnapshot> {
  try {
    const snapshot = await getDailyCachedPrototypeInstallCountSnapshot();
    lastKnownInstallCountSnapshot = snapshot;
    return snapshot;
  } catch (error: unknown) {
    console.warn("Failed to resolve prototype install count snapshot", error);
    return resolvePrototypeInstallCountFallback(lastKnownInstallCountSnapshot);
  }
}

export type { PrototypeInstallCountSnapshot } from "@/lib/install-count-core";

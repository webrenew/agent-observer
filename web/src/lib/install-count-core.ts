import { isMacInstallerAsset, type GitHubReleaseSummary } from "@/lib/downloads";

export type PrototypeInstallCountSource =
  | "github_release_assets"
  | "fallback_last_known"
  | "fallback_zero";

export interface PrototypeInstallCountSnapshot {
  installCount: number;
  releaseCount: number;
  installerAssetCount: number;
  checkedAt: string;
  source: PrototypeInstallCountSource;
}

const ZERO_INSTALL_COUNT_SNAPSHOT: Omit<PrototypeInstallCountSnapshot, "checkedAt"> = {
  installCount: 0,
  releaseCount: 0,
  installerAssetCount: 0,
  source: "fallback_zero",
};

function normalizeDownloadCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function computePrototypeInstallCountSnapshot(
  releases: GitHubReleaseSummary[],
  checkedAt = new Date().toISOString()
): PrototypeInstallCountSnapshot {
  let installCount = 0;
  let releaseCount = 0;
  let installerAssetCount = 0;

  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    releaseCount += 1;

    const assets = Array.isArray(release.assets) ? release.assets : [];
    for (const asset of assets) {
      if (!isMacInstallerAsset(asset)) continue;
      installerAssetCount += 1;
      installCount += normalizeDownloadCount(asset.download_count);
    }
  }

  return {
    installCount,
    releaseCount,
    installerAssetCount,
    checkedAt,
    source: "github_release_assets",
  };
}

export function resolvePrototypeInstallCountFallback(
  lastKnownSnapshot: PrototypeInstallCountSnapshot | null,
  checkedAt = new Date().toISOString()
): PrototypeInstallCountSnapshot {
  if (lastKnownSnapshot) {
    return {
      ...lastKnownSnapshot,
      checkedAt,
      source: "fallback_last_known",
    };
  }

  return {
    ...ZERO_INSTALL_COUNT_SNAPSHOT,
    checkedAt,
  };
}

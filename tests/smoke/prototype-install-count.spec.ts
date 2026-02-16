import { expect, test } from "@playwright/test";
import type { GitHubReleaseSummary } from "../../web/src/lib/downloads";
import {
  computePrototypeInstallCountSnapshot,
  resolvePrototypeInstallCountFallback,
  type PrototypeInstallCountSnapshot,
} from "../../web/src/lib/install-count-core";

test("prototype install count sums stable mac installer download counts", () => {
  const releases: GitHubReleaseSummary[] = [
    {
      draft: false,
      prerelease: false,
      assets: [
        {
          name: "agent-observer-1.2.0-arm64.dmg",
          browser_download_url: "https://example.com/v1.2.0-arm64.dmg",
          content_type: "application/x-apple-diskimage",
          download_count: 37,
        },
        {
          name: "agent-observer-1.2.0.zip",
          browser_download_url: "https://example.com/v1.2.0.zip",
          content_type: "application/zip",
          download_count: 99,
        },
      ],
    },
    {
      draft: false,
      prerelease: false,
      assets: [
        {
          name: "agent-observer-1.1.0-arm64.dmg",
          browser_download_url: "https://example.com/v1.1.0-arm64.dmg",
          content_type: "application/x-apple-diskimage",
          download_count: 12.9,
        },
      ],
    },
    {
      draft: false,
      prerelease: true,
      assets: [
        {
          name: "agent-observer-1.3.0-rc1-arm64.dmg",
          browser_download_url: "https://example.com/v1.3.0-rc1-arm64.dmg",
          content_type: "application/x-apple-diskimage",
          download_count: 999,
        },
      ],
    },
  ];

  const snapshot = computePrototypeInstallCountSnapshot(
    releases,
    "2026-02-16T00:00:00.000Z"
  );

  expect(snapshot).toEqual({
    installCount: 49,
    releaseCount: 2,
    installerAssetCount: 2,
    checkedAt: "2026-02-16T00:00:00.000Z",
    source: "github_release_assets",
  });
});

test("fallback reuses the last known snapshot when present", () => {
  const lastKnown: PrototypeInstallCountSnapshot = {
    installCount: 84,
    releaseCount: 4,
    installerAssetCount: 4,
    checkedAt: "2026-02-15T00:00:00.000Z",
    source: "github_release_assets",
  };

  const fallback = resolvePrototypeInstallCountFallback(
    lastKnown,
    "2026-02-16T00:00:00.000Z"
  );

  expect(fallback).toEqual({
    installCount: 84,
    releaseCount: 4,
    installerAssetCount: 4,
    checkedAt: "2026-02-16T00:00:00.000Z",
    source: "fallback_last_known",
  });
});

test("fallback returns zero snapshot when no last known value exists", () => {
  const fallback = resolvePrototypeInstallCountFallback(
    null,
    "2026-02-16T00:00:00.000Z"
  );

  expect(fallback).toEqual({
    installCount: 0,
    releaseCount: 0,
    installerAssetCount: 0,
    checkedAt: "2026-02-16T00:00:00.000Z",
    source: "fallback_zero",
  });
});

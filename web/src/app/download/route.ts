import { NextResponse } from "next/server";
import {
  AGENT_SPACE_RELEASES_API_URL,
  AGENT_SPACE_RELEASES_LIST_API_URL,
  AGENT_SPACE_RELEASES_URL,
  resolveLatestInstallerFromReleases,
  resolveLatestInstallerAssetUrl,
  type GitHubReleaseSummary,
  type GitHubLatestRelease,
} from "@/lib/downloads";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";
const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_USER_AGENT = "agent-observer-web-download";

async function resolveInstallerUrl(): Promise<string> {
  let fallbackReleaseUrl = AGENT_SPACE_RELEASES_URL;

  try {
    const latestReleaseResponse = await fetch(AGENT_SPACE_RELEASES_API_URL, {
      headers: {
        Accept: GITHUB_ACCEPT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": GITHUB_USER_AGENT,
      },
      next: { revalidate: 300 },
    });

    if (!latestReleaseResponse.ok) return fallbackReleaseUrl;

    const latestRelease = (await latestReleaseResponse.json()) as GitHubLatestRelease;
    const latestAssets = Array.isArray(latestRelease.assets) ? latestRelease.assets : [];
    const latestInstallerUrl = resolveLatestInstallerAssetUrl(latestAssets);
    if (latestInstallerUrl) return latestInstallerUrl;

    const latestReleaseUrl =
      typeof latestRelease.html_url === "string" && latestRelease.html_url.startsWith("http")
        ? latestRelease.html_url
        : AGENT_SPACE_RELEASES_URL;
    fallbackReleaseUrl = latestReleaseUrl;

    const releaseListResponse = await fetch(AGENT_SPACE_RELEASES_LIST_API_URL, {
      headers: {
        Accept: GITHUB_ACCEPT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": GITHUB_USER_AGENT,
      },
      next: { revalidate: 300 },
    });

    if (!releaseListResponse.ok) return latestReleaseUrl;

    const releases = (await releaseListResponse.json()) as GitHubReleaseSummary[];
    const installerUrl = resolveLatestInstallerFromReleases(
      Array.isArray(releases) ? releases : []
    );
    return installerUrl ?? latestReleaseUrl;
  } catch (error: unknown) {
    console.error("Failed to resolve installer URL", error);
    return fallbackReleaseUrl;
  }
}

export async function GET(): Promise<Response> {
  const installerUrl = await resolveInstallerUrl();
  const response = NextResponse.redirect(installerUrl, { status: 302 });
  response.headers.set("Cache-Control", CACHE_CONTROL);
  return response;
}

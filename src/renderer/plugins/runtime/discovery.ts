import type { ClaudeProfilesConfig } from '../../types'
import type {
  PluginDiscoveryResult,
  RawDiscoveredPlugin,
} from './contracts'
import {
  asRecord,
  asString,
  asStringArray,
  dedupePreserveOrder,
  getPathBaseName,
  isAbsolutePath,
  joinPath,
  replaceTildePrefix,
} from './helpers'

const IGNORED_CHILD_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.pnpm-store',
  '.yarn',
  '.cache',
])

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const file = await window.electronAPI.fs.readFile(filePath)
    const parsed = JSON.parse(file.content) as unknown
    return asRecord(parsed)
  } catch {
    return null
  }
}

function readManifestMetadata(
  raw: Record<string, unknown>,
  fallbackName: string
): { id: string; name: string; version: string; description: string | null; rendererEntry: string | null } {
  const name = asString(raw.name) ?? fallbackName
  const version = asString(raw.version) ?? '0.0.0'
  const description = asString(raw.description)
  const rendererEntry = asString(raw.rendererEntry)
    ?? asString(raw.entry)
    ?? asString(raw.main)
    ?? null
  return {
    id: asString(raw.id) ?? name,
    name,
    version,
    description,
    rendererEntry,
  }
}

async function detectPluginAtRoot(rootDir: string): Promise<RawDiscoveredPlugin | null> {
  const fallbackName = getPathBaseName(rootDir)

  const agentSpaceManifestPath = joinPath(rootDir, 'agent-observer.plugin.json')
  const agentSpaceManifest = await readJsonFile(agentSpaceManifestPath)
  if (agentSpaceManifest) {
    const metadata = readManifestMetadata(agentSpaceManifest, fallbackName)
    return {
      ...metadata,
      rootDir,
      manifestPath: agentSpaceManifestPath,
      source: 'agent-observer.plugin.json',
    }
  }

  const openClawManifestPath = joinPath(rootDir, 'openclaw.plugin.json')
  const openClawManifest = await readJsonFile(openClawManifestPath)
  if (openClawManifest) {
    const metadata = readManifestMetadata(openClawManifest, fallbackName)
    return {
      ...metadata,
      rootDir,
      manifestPath: openClawManifestPath,
      source: 'openclaw.plugin.json',
    }
  }

  const packagePath = joinPath(rootDir, 'package.json')
  const packageJson = await readJsonFile(packagePath)
  if (!packageJson) return null

  const openClawConfig = asRecord(packageJson.openclaw)
  const agentSpaceConfig = asRecord(packageJson.agentSpace)
  const extensionEntries = asStringArray(openClawConfig?.extensions)
  const packageKeywords = asStringArray(packageJson.keywords)
  const hasPluginKeyword = packageKeywords.some((keyword) =>
    keyword === 'openclaw-plugin' || keyword === 'agent-observer-plugin'
  )
  const metadata = readManifestMetadata(packageJson, fallbackName)
  const rendererEntryFromConfig = asString(agentSpaceConfig?.rendererEntry)
    ?? asString(openClawConfig?.rendererEntry)
    ?? extensionEntries[0]
    ?? null

  if (!hasPluginKeyword && extensionEntries.length === 0 && !rendererEntryFromConfig) {
    return null
  }

  return {
    ...metadata,
    rendererEntry: rendererEntryFromConfig ?? metadata.rendererEntry,
    rootDir,
    manifestPath: packagePath,
    source: 'package.json',
  }
}

async function listCandidatePluginRoots(directory: string): Promise<string[]> {
  const roots = [directory]
  try {
    const entries = await window.electronAPI.fs.readDir(directory)
    for (const entry of entries) {
      if (!entry.isDirectory) continue
      if (entry.name.startsWith('.')) continue
      if (IGNORED_CHILD_DIRS.has(entry.name)) continue
      roots.push(entry.path)
      if (roots.length >= 80) break
    }
  } catch {
    // Keep root-only scan if we fail to enumerate children.
  }
  return roots
}

export async function resolveRendererEntryPath(
  plugin: RawDiscoveredPlugin,
  homeDir: string
): Promise<string | null> {
  if (!plugin.rendererEntry) return null
  const expanded = replaceTildePrefix(plugin.rendererEntry, homeDir)
  return isAbsolutePath(expanded) ? expanded : joinPath(plugin.rootDir, expanded)
}

export function collectPluginDirsFromProfiles(config: ClaudeProfilesConfig | undefined): string[] {
  if (!config) return []
  return dedupePreserveOrder(
    config.profiles.flatMap((profile) => profile.pluginDirs.map((path) => path.trim()))
  )
}

export async function discoverPlugins(pluginDirs: string[]): Promise<PluginDiscoveryResult> {
  if (!window.electronAPI?.fs) {
    return {
      normalizedDirs: [],
      scannedDirectories: [],
      plugins: [],
      warnings: [],
      homeDir: '',
      signature: '',
    }
  }

  const normalizedInputDirs = dedupePreserveOrder(pluginDirs)
  const homeDir = await window.electronAPI.fs.homeDir()
  const normalizedDirs = dedupePreserveOrder(
    normalizedInputDirs.map((dir) => replaceTildePrefix(dir, homeDir))
  )
  const signature = normalizedDirs.join('::')

  const warnings: string[] = []
  const pluginsByManifest = new Map<string, RawDiscoveredPlugin>()
  const scannedDirectories: string[] = []

  for (const directory of normalizedDirs) {
    try {
      const stat = await window.electronAPI.fs.stat(directory)
      if (!stat.isDirectory) {
        warnings.push(`Plugin dir is not a directory: ${directory}`)
        continue
      }
    } catch {
      warnings.push(`Plugin dir not found: ${directory}`)
      continue
    }

    scannedDirectories.push(directory)
    const roots = await listCandidatePluginRoots(directory)
    for (const rootDir of roots) {
      const discovered = await detectPluginAtRoot(rootDir)
      if (!discovered) continue
      const dedupeKey = discovered.manifestPath
      if (!pluginsByManifest.has(dedupeKey)) {
        pluginsByManifest.set(dedupeKey, discovered)
      }
    }
  }

  const plugins = Array.from(pluginsByManifest.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

  return {
    normalizedDirs,
    scannedDirectories,
    plugins,
    warnings,
    homeDir,
    signature,
  }
}

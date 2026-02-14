import { ipcMain } from 'electron'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

interface WorkspaceContextSnapshot {
  directory: string
  generatedAt: number
  gitBranch: string | null
  gitDirtyFiles: number
  topLevelDirectories: string[]
  topLevelFiles: string[]
  keyFiles: string[]
  npmScripts: string[]
  techHints: string[]
  readmeSnippet: string | null
}

const KNOWN_KEY_FILES = [
  'README.md',
  'README.MD',
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
  'bun.lockb',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'Dockerfile',
  '.env.example',
]

function runGit(directory: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', directory, ...args], {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

function readPackageJson(directory: string): Record<string, unknown> | null {
  const packageJsonPath = path.join(directory, 'package.json')
  if (!fs.existsSync(packageJsonPath)) return null

  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function listTopLevel(directory: string): { directories: string[]; files: string[] } {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })

    const directories: string[] = []
    const files: string[] = []

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (directories.length < 16) directories.push(entry.name)
      } else {
        if (files.length < 16) files.push(entry.name)
      }
      if (directories.length >= 16 && files.length >= 16) break
    }

    return { directories, files }
  } catch {
    return { directories: [], files: [] }
  }
}

function detectTechHints(directory: string, packageJson: Record<string, unknown> | null): string[] {
  const hints = new Set<string>()
  if (packageJson) {
    hints.add('node')
    const deps = {
      ...((packageJson.dependencies as Record<string, unknown> | undefined) ?? {}),
      ...((packageJson.devDependencies as Record<string, unknown> | undefined) ?? {}),
    }
    const depNames = Object.keys(deps)
    if (depNames.some((dep) => dep === 'react' || dep.startsWith('@types/react'))) hints.add('react')
    if (depNames.some((dep) => dep === 'next')) hints.add('nextjs')
    if (depNames.some((dep) => dep === 'vite' || dep.startsWith('vite'))) hints.add('vite')
    if (depNames.some((dep) => dep === 'typescript' || dep.startsWith('@typescript-eslint/'))) hints.add('typescript')
    if (depNames.some((dep) => dep.includes('electron'))) hints.add('electron')
  }

  if (fs.existsSync(path.join(directory, 'pyproject.toml')) || fs.existsSync(path.join(directory, 'requirements.txt'))) {
    hints.add('python')
  }
  if (fs.existsSync(path.join(directory, 'go.mod'))) hints.add('go')
  if (fs.existsSync(path.join(directory, 'Cargo.toml'))) hints.add('rust')
  if (fs.existsSync(path.join(directory, 'Dockerfile'))) hints.add('docker')

  return Array.from(hints).slice(0, 8)
}

function readReadmeSnippet(directory: string): string | null {
  const readmeCandidates = ['README.md', 'README.MD', 'readme.md']
  for (const candidate of readmeCandidates) {
    const readmePath = path.join(directory, candidate)
    if (!fs.existsSync(readmePath)) continue
    try {
      const content = fs.readFileSync(readmePath, 'utf-8')
      const compact = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8)
        .join(' ')
      if (!compact) continue
      return compact.slice(0, 320)
    } catch {
      continue
    }
  }
  return null
}

function buildWorkspaceSnapshot(directory: string): WorkspaceContextSnapshot {
  const packageJson = readPackageJson(directory)
  const gitBranch = runGit(directory, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const gitStatus = runGit(directory, ['status', '--porcelain']) ?? ''
  const gitDirtyFiles = gitStatus
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .length

  const { directories, files } = listTopLevel(directory)
  const keyFiles = KNOWN_KEY_FILES.filter((name) => fs.existsSync(path.join(directory, name))).slice(0, 12)
  const scriptsRecord = (packageJson?.scripts as Record<string, unknown> | undefined) ?? {}
  const npmScripts = Object.keys(scriptsRecord).slice(0, 12)
  const techHints = detectTechHints(directory, packageJson)

  return {
    directory,
    generatedAt: Date.now(),
    gitBranch,
    gitDirtyFiles,
    topLevelDirectories: directories,
    topLevelFiles: files,
    keyFiles,
    npmScripts,
    techHints,
    readmeSnippet: readReadmeSnippet(directory),
  }
}

let handlersRegistered = false
export function setupWorkspaceContextHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('context:getWorkspaceSnapshot', (_event, directory: string) => {
    if (typeof directory !== 'string' || directory.trim().length === 0) {
      throw new Error('Directory is required')
    }

    const resolvedDirectory = path.resolve(directory.trim())
    let stat: fs.Stats
    try {
      stat = fs.statSync(resolvedDirectory)
    } catch {
      throw new Error(`Directory does not exist: ${resolvedDirectory}`)
    }
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${resolvedDirectory}`)
    }

    return buildWorkspaceSnapshot(resolvedDirectory)
  })
}

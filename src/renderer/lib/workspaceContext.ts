import type { WorkspaceContextSnapshot } from '../types'

function joinOrNone(values: string[], max = 8): string {
  if (values.length === 0) return 'none'
  return values.slice(0, max).join(', ')
}

export function buildWorkspaceContextPrompt(snapshot: WorkspaceContextSnapshot): string {
  const lines: string[] = [
    '[Workspace context snapshot]',
    `directory: ${snapshot.directory}`,
    `git_branch: ${snapshot.gitBranch ?? 'none'}`,
    `git_dirty_files: ${snapshot.gitDirtyFiles}`,
    `tech_hints: ${joinOrNone(snapshot.techHints, 8)}`,
    `key_files: ${joinOrNone(snapshot.keyFiles, 12)}`,
    `top_level_directories: ${joinOrNone(snapshot.topLevelDirectories, 12)}`,
    `top_level_files: ${joinOrNone(snapshot.topLevelFiles, 12)}`,
  ]

  if (snapshot.npmScripts.length > 0) {
    lines.push(`npm_scripts: ${joinOrNone(snapshot.npmScripts, 12)}`)
  }
  if (snapshot.readmeSnippet) {
    lines.push(`readme_summary: ${snapshot.readmeSnippet}`)
  }

  lines.push('Use this context to stay grounded in the current workspace structure and tooling.')
  return lines.join('\n')
}

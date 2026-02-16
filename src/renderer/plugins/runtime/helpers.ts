import { logRendererEvent } from '../../lib/diagnostics'

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null
  return value as Record<string, unknown>
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry))
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    next.push(trimmed)
  }
  return next
}

export function getPathBaseName(targetPath: string): string {
  const normalized = targetPath.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? targetPath
}

export function joinPath(base: string, name: string): string {
  if (base.endsWith('/') || base.endsWith('\\')) return `${base}${name}`
  return `${base}/${name}`
}

export function isAbsolutePath(input: string): boolean {
  return input.startsWith('/')
    || /^[a-zA-Z]:[\\/]/.test(input)
    || input.startsWith('\\\\')
}

export function replaceTildePrefix(rawPath: string, homeDir: string): string {
  if (rawPath === '~') return homeDir
  if (rawPath.startsWith('~/') || rawPath.startsWith('~\\')) {
    return `${homeDir}${rawPath.slice(1)}`
  }
  return rawPath
}

export function toFileModuleSpecifier(filePath: string, versionTag?: number): string {
  const normalized = filePath.replace(/\\/g, '/')
  const base = /^[a-zA-Z]:\//.test(normalized)
    ? `file:///${normalized}`
    : `file://${normalized}`
  const encoded = encodeURI(base)
  if (!versionTag || !Number.isFinite(versionTag)) return encoded
  return `${encoded}?v=${Math.floor(versionTag)}`
}

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function runDisposer(
  disposer: (() => void) | null | undefined,
  context: string,
  pluginId?: string
): void {
  if (!disposer) return
  try {
    disposer()
  } catch (err) {
    logRendererEvent('warn', 'plugin.runtime.dispose_failed', {
      context,
      pluginId,
      error: toErrorMessage(err),
    })
  }
}

export function normalizeCommandName(rawName: string): string | null {
  const trimmed = rawName.trim()
  if (!trimmed) return null
  const withoutPrefix = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
  const normalized = withoutPrefix.trim().toLowerCase()
  if (!normalized) return null
  if (!/^[a-z0-9._-]+$/.test(normalized)) return null
  return normalized
}

export function normalizeCommandExecutionOutput(
  output: unknown
): { message: string | null; isError: boolean } {
  if (output === null || output === undefined) {
    return { message: null, isError: false }
  }
  if (typeof output === 'string') {
    const message = output.trim()
    return { message: message || null, isError: false }
  }
  const record = asRecord(output)
  if (record) {
    const messageFromMessage = asString(record.message)
    const messageFromError = asString(record.error)
    const isError = record.isError === true || Boolean(messageFromError)
    if (messageFromMessage) {
      return { message: messageFromMessage, isError }
    }
    if (messageFromError) {
      return { message: messageFromError, isError: true }
    }
  }
  try {
    return { message: JSON.stringify(output), isError: false }
  } catch {
    return { message: String(output), isError: false }
  }
}

export function normalizePromptTransformOutput(
  output: unknown
): { nextPrompt: string | null; cancel: boolean; errorMessage: string | null } {
  if (output === null || output === undefined) {
    return { nextPrompt: null, cancel: false, errorMessage: null }
  }
  if (typeof output === 'string') {
    return { nextPrompt: output, cancel: false, errorMessage: null }
  }
  const record = asRecord(output)
  if (!record) {
    return { nextPrompt: null, cancel: false, errorMessage: null }
  }
  return {
    nextPrompt: asString(record.prompt),
    cancel: record.cancel === true,
    errorMessage: asString(record.error),
  }
}

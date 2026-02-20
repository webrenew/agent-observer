import { useCallback, useEffect, useState } from 'react'
import type { AppSettings } from '../types'
import { useSettingsStore } from '../store/settings'
import { useWorkspaceStore } from '../store/workspace'

const ONBOARDING_DONE_KEY = 'agent-observer:onboarding:v1'

interface ClaudeCheckState {
  status: 'idle' | 'checking' | 'ok' | 'error'
  binaryPath: string | null
  version: string | null
  error: string | null
}

function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === 'done'
  } catch {
    return true
  }
}

function markOnboardingComplete(): void {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, 'done')
  } catch {
    // Ignore storage failures; onboarding can still be dismissed for this run.
  }
}

export function FirstRunOnboarding() {
  const settings = useSettingsStore((s) => s.settings)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const workspaceRoot = useWorkspaceStore((s) => s.rootPath)

  const [open, setOpen] = useState<boolean>(() => !isOnboardingComplete())
  const [claudeCheck, setClaudeCheck] = useState<ClaudeCheckState>({
    status: 'idle',
    binaryPath: null,
    version: null,
    error: null,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const persistSettings = useCallback(
    async (next: AppSettings) => {
      setIsSaving(true)
      setSaveError(null)
      setSettings(next)
      try {
        await window.electronAPI.settings.set(next)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setSaveError(message)
      } finally {
        setIsSaving(false)
      }
    },
    [setSettings]
  )

  const runClaudeCheck = useCallback(async () => {
    setClaudeCheck((prev) => ({ ...prev, status: 'checking', error: null }))
    try {
      const result = await window.electronAPI.claude.isAvailable()
      setClaudeCheck({
        status: result.available ? 'ok' : 'error',
        binaryPath: result.binaryPath,
        version: result.version,
        error: result.available ? null : result.error ?? 'Claude CLI not found',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setClaudeCheck({
        status: 'error',
        binaryPath: null,
        version: null,
        error: message,
      })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void runClaudeCheck()
  }, [open, runClaudeCheck])

  const togglePermissionMode = useCallback(() => {
    void persistSettings({
      ...settings,
      yoloMode: !settings.yoloMode,
    })
  }, [persistSettings, settings])

  const useHomeAsDefault = useCallback(() => {
    void persistSettings({
      ...settings,
      general: {
        ...settings.general,
        startingDirectory: 'home',
        customDirectory: '',
      },
    })
  }, [persistSettings, settings])

  const setCustomDefaultDirectory = useCallback(
    (dir: string) => {
      void persistSettings({
        ...settings,
        general: {
          ...settings.general,
          startingDirectory: 'custom',
          customDirectory: dir,
        },
      })
    },
    [persistSettings, settings]
  )

  const pickDefaultDirectory = useCallback(async () => {
    const selected = await window.electronAPI.settings.selectDirectory()
    if (selected) setCustomDefaultDirectory(selected)
  }, [setCustomDefaultDirectory])

  const completeOnboarding = useCallback(() => {
    markOnboardingComplete()
    setOpen(false)
  }, [])

  if (!open) return null

  const workspaceDefaultLabel = settings.general.startingDirectory === 'custom'
    ? settings.general.customDirectory || 'Custom path (not set)'
    : 'Home directory'

  const permissionLabel = settings.yoloMode ? 'YOLO (dangerous)' : 'Standard (safe)'
  const claudeStatusLabel = claudeCheck.status === 'ok'
    ? 'Ready'
    : claudeCheck.status === 'checking'
      ? 'Checking...'
      : claudeCheck.status === 'error'
        ? 'Missing'
        : 'Not checked'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: 720,
          maxWidth: '92vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: 12,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, color: '#9A9692' }}>First-Run Setup</h2>
          <p style={{ margin: '6px 0 0', color: '#74747C', fontSize: 12 }}>
            Verify Claude CLI, permission mode, and workspace defaults before starting.
          </p>
        </div>

        <div style={{ border: `1px solid ${claudeCheck.status === 'error' ? 'rgba(196,80,80,0.35)' : 'rgba(89,86,83,0.25)'}`, borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ color: '#9A9692', fontSize: 13, fontWeight: 600 }}>Claude Code CLI</div>
              {claudeCheck.status === 'ok' && (
                <>
                  <div style={{ color: '#548C5A', fontSize: 11 }}>
                    Installed at {claudeCheck.binaryPath}
                  </div>
                  {claudeCheck.version && (
                    <div style={{ color: '#595653', fontSize: 11 }}>
                      Version: {claudeCheck.version}
                    </div>
                  )}
                </>
              )}
              {claudeCheck.status === 'checking' && (
                <div style={{ color: '#74747C', fontSize: 11 }}>Checking...</div>
              )}
              {claudeCheck.status === 'idle' && (
                <div style={{ color: '#74747C', fontSize: 11 }}>Not checked yet</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  color: claudeCheck.status === 'ok' ? '#548C5A' : claudeCheck.status === 'error' ? '#c45050' : '#74747C',
                  fontWeight: 600,
                }}
              >
                {claudeStatusLabel}
              </span>
              <button
                onClick={() => void runClaudeCheck()}
                disabled={claudeCheck.status === 'checking'}
                style={{
                  border: '1px solid rgba(89,86,83,0.35)',
                  background: 'transparent',
                  borderRadius: 6,
                  color: '#9A9692',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  padding: '4px 10px',
                  cursor: claudeCheck.status === 'checking' ? 'default' : 'pointer',
                }}
              >
                Re-check
              </button>
            </div>
          </div>

          {claudeCheck.status === 'error' && (
            <div style={{ marginTop: 10, padding: 10, background: 'rgba(196,80,80,0.08)', borderRadius: 6 }}>
              <div style={{ color: '#d6d2cd', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Claude Code is required
              </div>
              <div style={{ color: '#9A9692', fontSize: 11, lineHeight: 1.5 }}>
                Agent Observer needs Claude Code (the CLI) to run AI agents. Install it, then click Re-check above.
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#74747C', fontSize: 10, fontWeight: 600, minWidth: 14 }}>1.</span>
                  <code
                    style={{
                      flex: 1,
                      background: 'rgba(10,12,11,0.6)',
                      border: '1px solid rgba(89,86,83,0.25)',
                      borderRadius: 4,
                      padding: '5px 8px',
                      fontSize: 11,
                      color: '#d6d2cd',
                      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                      userSelect: 'all',
                    }}
                  >
                    npm install -g @anthropic-ai/claude-code
                  </code>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#74747C', fontSize: 10, fontWeight: 600, minWidth: 14 }}>2.</span>
                  <span style={{ color: '#9A9692', fontSize: 11 }}>
                    Run <code style={{ color: '#d6d2cd', fontFamily: 'Menlo, Monaco, "Courier New", monospace', fontSize: 10 }}>claude</code> once in your terminal to authenticate
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <a
                  href="https://docs.anthropic.com/en/docs/claude-code/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#548C5A',
                    fontSize: 11,
                    textDecoration: 'none',
                  }}
                >
                  View full install guide →
                </a>
              </div>
            </div>
          )}
        </div>

        <div style={{ border: '1px solid rgba(89,86,83,0.25)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ color: '#9A9692', fontSize: 13, fontWeight: 600 }}>Permissions mode</div>
              <div style={{ color: '#595653', fontSize: 11 }}>{permissionLabel}</div>
            </div>
            <button
              onClick={togglePermissionMode}
              disabled={isSaving}
              style={{
                border: '1px solid rgba(89,86,83,0.35)',
                background: settings.yoloMode ? 'rgba(196,80,80,0.12)' : 'transparent',
                borderRadius: 6,
                color: settings.yoloMode ? '#c45050' : '#9A9692',
                fontSize: 11,
                fontFamily: 'inherit',
                padding: '4px 10px',
                cursor: isSaving ? 'default' : 'pointer',
              }}
            >
              Toggle
            </button>
          </div>
        </div>

        <div style={{ border: '1px solid rgba(89,86,83,0.25)', borderRadius: 8, padding: 12 }}>
          <div style={{ color: '#9A9692', fontSize: 13, fontWeight: 600 }}>Workspace defaults</div>
          <div style={{ color: '#595653', fontSize: 11, marginTop: 2 }}>{workspaceDefaultLabel}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={useHomeAsDefault}
              disabled={isSaving}
              style={{
                border: '1px solid rgba(89,86,83,0.35)',
                background: 'transparent',
                borderRadius: 6,
                color: '#9A9692',
                fontSize: 11,
                fontFamily: 'inherit',
                padding: '4px 10px',
                cursor: isSaving ? 'default' : 'pointer',
              }}
            >
              Use Home
            </button>
            <button
              onClick={() => void pickDefaultDirectory()}
              disabled={isSaving}
              style={{
                border: '1px solid rgba(89,86,83,0.35)',
                background: 'transparent',
                borderRadius: 6,
                color: '#9A9692',
                fontSize: 11,
                fontFamily: 'inherit',
                padding: '4px 10px',
                cursor: isSaving ? 'default' : 'pointer',
              }}
            >
              Pick Folder
            </button>
            <button
              onClick={() => workspaceRoot && setCustomDefaultDirectory(workspaceRoot)}
              disabled={isSaving || !workspaceRoot}
              style={{
                border: '1px solid rgba(84,140,90,0.35)',
                background: workspaceRoot ? 'rgba(84,140,90,0.1)' : 'transparent',
                borderRadius: 6,
                color: workspaceRoot ? '#548C5A' : '#595653',
                fontSize: 11,
                fontFamily: 'inherit',
                padding: '4px 10px',
                cursor: isSaving || !workspaceRoot ? 'default' : 'pointer',
              }}
            >
              Use Current Workspace
            </button>
          </div>
        </div>

        {saveError && (
          <div style={{ color: '#c45050', fontSize: 11 }}>
            Failed to save onboarding settings: {saveError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={completeOnboarding}
            style={{
              border: 'none',
              background: '#548C5A',
              borderRadius: 6,
              color: '#0E0E0D',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              padding: '7px 14px',
              cursor: 'pointer',
            }}
          >
            Finish setup
          </button>
        </div>
      </div>
    </div>
  )
}

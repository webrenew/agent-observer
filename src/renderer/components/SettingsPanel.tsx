import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore, saveSettings } from '../store/settings'
import type { AppSettings, CursorStyle, SubscriptionType, Scope, TerminalThemeName } from '../types'
import { DEFAULT_SETTINGS, SUBSCRIPTION_OPTIONS } from '../types'
import { THEME_NAMES, THEME_LABELS, getTheme } from '../lib/terminalThemes'

type Tab = 'general' | 'appearance' | 'terminal' | 'scopes' | 'subscription'

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'scopes', label: 'Scopes' },
  { id: 'subscription', label: 'Plan' }
]

const FONT_OPTIONS = [
  'Menlo, Monaco, "Courier New", monospace',
  '"SF Mono", Menlo, monospace',
  '"JetBrains Mono", monospace',
  '"Fira Code", monospace',
  '"Source Code Pro", monospace',
  '"IBM Plex Mono", monospace',
  'Consolas, monospace'
]

const FONT_LABELS: Record<string, string> = {
  'Menlo, Monaco, "Courier New", monospace': 'Menlo',
  '"SF Mono", Menlo, monospace': 'SF Mono',
  '"JetBrains Mono", monospace': 'JetBrains Mono',
  '"Fira Code", monospace': 'Fira Code',
  '"Source Code Pro", monospace': 'Source Code Pro',
  '"IBM Plex Mono", monospace': 'IBM Plex Mono',
  'Consolas, monospace': 'Consolas'
}

const CURSOR_STYLES: { value: CursorStyle; label: string }[] = [
  { value: 'block', label: 'Block' },
  { value: 'underline', label: 'Underline' },
  { value: 'bar', label: 'Bar' }
]

const SCOPE_COLOR_PRESETS = [
  '#4ade80', '#60a5fa', '#a78bfa', '#f87171', '#fbbf24',
  '#22d3ee', '#e879f9', '#fb923c', '#34d399', '#f472b6',
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: checked ? '#548C5A' : 'rgba(89,86,83,0.3)', transition: 'background 0.2s ease',
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#9A9692',
          transition: 'left 0.2s ease',
        }}
      />
    </button>
  )
}

function Select({
  value,
  options,
  labels,
  onChange
}: {
  value: string
  options: string[]
  labels?: Record<string, string>
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
        borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#9A9692',
        outline: 'none', fontFamily: 'inherit', minWidth: 160,
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} style={{ background: '#0E0E0D' }}>
          {labels?.[opt] ?? opt}
        </option>
      ))}
    </select>
  )
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange
}: {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const parsed = Number(e.target.value)
        if (!isNaN(parsed) && parsed >= (min ?? 0) && parsed <= (max ?? Infinity)) {
          onChange(parsed)
        }
      }}
      style={{
        background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
        borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#9A9692',
        outline: 'none', fontFamily: 'inherit', width: 80,
      }}
    />
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: 13, color: '#9A9692' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: '#74747C', marginBottom: 8 }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}

export function SettingsPanel() {
  const isOpen = useSettingsStore((s) => s.isOpen)
  const currentSettings = useSettingsStore((s) => s.settings)
  const closeSettings = useSettingsStore((s) => s.closeSettings)
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [draft, setDraft] = useState<AppSettings>(currentSettings)

  // Sync draft when modal opens
  useEffect(() => {
    if (isOpen) setDraft(currentSettings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, closeSettings])

  const updateGeneral = useCallback(
    (updates: Partial<AppSettings['general']>) => {
      setDraft((d) => ({ ...d, general: { ...d.general, ...updates } }))
    },
    []
  )

  const updateAppearance = useCallback(
    (updates: Partial<AppSettings['appearance']>) => {
      setDraft((d) => ({ ...d, appearance: { ...d.appearance, ...updates } }))
    },
    []
  )

  const updateTerminal = useCallback(
    (updates: Partial<AppSettings['terminal']>) => {
      setDraft((d) => ({ ...d, terminal: { ...d.terminal, ...updates } }))
    },
    []
  )

  const updateScopes = useCallback(
    (scopes: Scope[]) => {
      setDraft((d) => ({ ...d, scopes }))
    },
    []
  )

  const addScope = useCallback(() => {
    const id = `scope-${Date.now()}`
    const newScope: Scope = {
      id,
      name: 'New Scope',
      color: SCOPE_COLOR_PRESETS[draft.scopes.length % SCOPE_COLOR_PRESETS.length],
      directories: [],
      soundEvents: {},
    }
    setDraft((d) => ({ ...d, scopes: [...d.scopes, newScope] }))
  }, [draft.scopes.length])

  const removeScope = useCallback((scopeId: string) => {
    setDraft((d) => ({ ...d, scopes: d.scopes.filter((s) => s.id !== scopeId) }))
  }, [])

  const updateScope = useCallback((scopeId: string, updates: Partial<Scope>) => {
    setDraft((d) => ({
      ...d,
      scopes: d.scopes.map((s) => (s.id === scopeId ? { ...s, ...updates } : s)),
    }))
  }, [])

  const addDirectoryToScope = useCallback(async (scopeId: string) => {
    const dir = await window.electronAPI.settings.selectDirectory()
    if (!dir) return
    setDraft((d) => ({
      ...d,
      scopes: d.scopes.map((s) =>
        s.id === scopeId ? { ...s, directories: [...s.directories, dir] } : s
      ),
    }))
  }, [])

  const removeDirectoryFromScope = useCallback((scopeId: string, dirIndex: number) => {
    setDraft((d) => ({
      ...d,
      scopes: d.scopes.map((s) =>
        s.id === scopeId
          ? { ...s, directories: s.directories.filter((_, i) => i !== dirIndex) }
          : s
      ),
    }))
  }, [])

  const handleBrowse = useCallback(async () => {
    const dir = await window.electronAPI.settings.selectDirectory()
    if (dir) updateGeneral({ customDirectory: dir })
  }, [updateGeneral])

  const handleSave = useCallback(() => {
    saveSettings(draft)
  }, [draft])

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_SETTINGS)
  }, [])

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={closeSettings} />

      {/* Panel */}
      <div
        className="glass-panel"
        style={{
          position: 'relative', width: 600, maxHeight: '80vh',
          borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#9A9692', margin: 0 }}>Settings</h2>
          <button
            onClick={closeSettings}
            style={{ background: 'transparent', border: 'none', color: '#595653', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            &times;
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, padding: '0 18px', marginTop: 10, borderBottom: '1px solid rgba(89,86,83,0.2)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="nav-item"
              style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
                background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                color: activeTab === tab.id ? '#548C5A' : '#595653',
                borderBottom: activeTab === tab.id ? '2px solid #548C5A' : '2px solid transparent',
                textShadow: activeTab === tab.id ? '0 0 8px rgba(84,140,90,0.4)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', minHeight: 0 }}>
          {activeTab === 'general' && (
            <>
              <Section title="STARTING DIRECTORY">
                <Row label="Open new terminals in">
                  <Select
                    value={draft.general.startingDirectory}
                    options={['home', 'custom']}
                    labels={{ home: 'Home Directory', custom: 'Custom Path' }}
                    onChange={(v) => updateGeneral({ startingDirectory: v as 'home' | 'custom' })}
                  />
                </Row>
                {draft.general.startingDirectory === 'custom' && (
                  <Row label="Custom path">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        value={draft.general.customDirectory}
                        onChange={(e) => updateGeneral({ customDirectory: e.target.value })}
                        placeholder="/path/to/directory"
                        style={{
                          background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
                          borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#9A9692',
                          outline: 'none', fontFamily: 'inherit', width: 180,
                        }}
                      />
                      <button
                        onClick={handleBrowse}
                        style={{
                          padding: '5px 10px', fontSize: 12, fontWeight: 500,
                          background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
                          borderRadius: 6, color: '#9A9692', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Browse...
                      </button>
                    </div>
                  </Row>
                )}
              </Section>
              <Section title="SHELL">
                <Row label="Shell program">
                  <Select
                    value={draft.general.shell}
                    options={['default', 'custom']}
                    labels={{ default: 'Login Shell', custom: 'Custom' }}
                    onChange={(v) => updateGeneral({ shell: v as 'default' | 'custom' })}
                  />
                </Row>
                {draft.general.shell === 'custom' && (
                  <Row label="Custom shell">
                    <input
                      type="text"
                      value={draft.general.customShell}
                      onChange={(e) => updateGeneral({ customShell: e.target.value })}
                      placeholder="/bin/zsh"
                      style={{
                        background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
                        borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#9A9692',
                        outline: 'none', fontFamily: 'inherit', width: 180,
                      }}
                    />
                  </Row>
                )}
              </Section>
              <Section title="DIAGNOSTICS">
                <Row label="Crash & health telemetry">
                  <Toggle
                    checked={draft.telemetry.enabled}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, telemetry: { ...d.telemetry, enabled: v } }))
                    }
                  />
                </Row>
                <div style={{ fontSize: 11, color: '#595653', lineHeight: 1.5 }}>
                  Stores local crash and startup diagnostics in <code>~/.agent-space/telemetry.ndjson</code>.
                </div>
              </Section>
            </>
          )}

          {activeTab === 'appearance' && (
            <>
              <Section title="THEME">
                <Row label="Theme">
                  <Select
                    value={draft.appearance.terminalTheme}
                    options={THEME_NAMES as unknown as string[]}
                    labels={THEME_LABELS as unknown as Record<string, string>}
                    onChange={(v) => updateAppearance({ terminalTheme: v as TerminalThemeName })}
                  />
                </Row>
                <div style={{ display: 'flex', gap: 5, padding: '8px 0' }}>
                  {(() => {
                    const t = getTheme(draft.appearance.terminalTheme)
                    return [t.background, t.foreground, t.red, t.green, t.blue, t.yellow, t.magenta, t.cyan].map((c, i) => (
                      <span key={i} style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: c as string }} />
                    ))
                  })()}
                </div>
              </Section>
              <Section title="FONT">
                <Row label="Font family">
                  <Select
                    value={draft.appearance.fontFamily}
                    options={FONT_OPTIONS}
                    labels={FONT_LABELS}
                    onChange={(v) => updateAppearance({ fontFamily: v })}
                  />
                </Row>
                <Row label="Font size">
                  <NumberInput
                    value={draft.appearance.fontSize}
                    min={8}
                    max={32}
                    step={1}
                    onChange={(v) => updateAppearance({ fontSize: v })}
                  />
                </Row>
              </Section>
              <Section title="CURSOR">
                <Row label="Cursor style">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {CURSOR_STYLES.map((cs) => (
                      <button
                        key={cs.value}
                        onClick={() => updateAppearance({ cursorStyle: cs.value })}
                        style={{
                          padding: '4px 10px', fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
                          fontFamily: 'inherit', transition: 'all 0.2s ease',
                          background: draft.appearance.cursorStyle === cs.value ? 'rgba(84,140,90,0.2)' : 'rgba(89,86,83,0.1)',
                          border: `1px solid ${draft.appearance.cursorStyle === cs.value ? 'rgba(84,140,90,0.5)' : 'rgba(89,86,83,0.3)'}`,
                          color: draft.appearance.cursorStyle === cs.value ? '#548C5A' : '#74747C',
                        }}
                      >
                        {cs.label}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Cursor blink">
                  <Toggle
                    checked={draft.appearance.cursorBlink}
                    onChange={(v) => updateAppearance({ cursorBlink: v })}
                  />
                </Row>
              </Section>
            </>
          )}

          {activeTab === 'terminal' && (
            <>
              <Section title="SCROLLBACK">
                <Row label="Scrollback lines">
                  <NumberInput
                    value={draft.terminal.scrollbackLines}
                    min={100}
                    max={100000}
                    step={500}
                    onChange={(v) => updateTerminal({ scrollbackLines: v })}
                  />
                </Row>
              </Section>
              <Section title="BEHAVIOR">
                <Row label="Copy on select">
                  <Toggle
                    checked={draft.terminal.copyOnSelect}
                    onChange={(v) => updateTerminal({ copyOnSelect: v })}
                  />
                </Row>
                <Row label="Option as Meta key">
                  <Toggle
                    checked={draft.terminal.optionAsMeta}
                    onChange={(v) => updateTerminal({ optionAsMeta: v })}
                  />
                </Row>
              </Section>
              <Section title="BELL">
                <Row label="Visual bell">
                  <Toggle
                    checked={draft.terminal.visualBell}
                    onChange={(v) => updateTerminal({ visualBell: v })}
                  />
                </Row>
                <Row label="Audible bell">
                  <Toggle
                    checked={draft.terminal.audibleBell}
                    onChange={(v) => updateTerminal({ audibleBell: v })}
                  />
                </Row>
              </Section>
            </>
          )}

          {activeTab === 'scopes' && (
            <>
              <Section title="CHAT COMPLETION DING">
                <Row label="Play system ding">
                  <Toggle
                    checked={draft.soundsEnabled}
                    onChange={(v) => setDraft((d) => ({ ...d, soundsEnabled: v }))}
                  />
                </Row>
              </Section>

              <Section title="SCOPES">
                {draft.scopes.length === 0 && (
                  <div style={{ fontSize: 12, color: '#595653', padding: '10px 0' }}>
                    No scopes configured. Add a scope to group terminals by project.
                  </div>
                )}
                {draft.scopes.map((scope) => (
                  <div key={scope.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(89,86,83,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type="text"
                        value={scope.name}
                        onChange={(e) => updateScope(scope.id, { name: e.target.value })}
                        style={{
                          flex: 1, background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
                          borderRadius: 6, padding: '4px 8px', fontSize: 13, color: '#9A9692',
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                      <input
                        type="text"
                        value={scope.color}
                        onChange={(e) => updateScope(scope.id, { color: e.target.value })}
                        placeholder="#hex"
                        style={{
                          width: 72, background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
                          borderRadius: 6, padding: '4px 8px', fontSize: 13, color: '#9A9692',
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                      <span style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: scope.color }} />
                      <button
                        onClick={() => removeScope(scope.id)}
                        style={{
                          background: 'transparent', border: 'none', color: '#595653', fontSize: 12,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    {/* Color presets */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      {SCOPE_COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateScope(scope.id, { color })}
                          style={{
                            width: 16, height: 16, borderRadius: '50%', backgroundColor: color, cursor: 'pointer',
                            border: scope.color === color ? '2px solid #9A9692' : '2px solid transparent',
                            transform: scope.color === color ? 'scale(1.25)' : 'scale(1)',
                            transition: 'all 0.15s ease',
                          }}
                        />
                      ))}
                    </div>

                    {/* Directories */}
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: '#74747C', marginBottom: 4, marginTop: 10 }}>
                      DIRECTORIES
                    </div>
                    {scope.directories.length === 0 && (
                      <div style={{ fontSize: 12, color: '#595653', marginBottom: 4 }}>No directories</div>
                    )}
                    {scope.directories.map((dir, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#74747C', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{dir}</span>
                        <button
                          onClick={() => removeDirectoryFromScope(scope.id, i)}
                          style={{ background: 'transparent', border: 'none', color: '#595653', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addDirectoryToScope(scope.id)}
                      style={{ background: 'transparent', border: 'none', color: '#548C5A', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
                    >
                      + Add directory
                    </button>

                  </div>
                ))}

                <button
                  onClick={addScope}
                  style={{
                    marginTop: 8, padding: '5px 12px', fontSize: 12, fontWeight: 500,
                    background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
                    borderRadius: 6, color: '#9A9692', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  + Add Scope
                </button>
              </Section>

              <Section title="DEFAULT SCOPE">
                <Row label="Color for unmatched terminals">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      value={draft.defaultScope.color}
                      onChange={(e) => setDraft((d) => ({ ...d, defaultScope: { ...d.defaultScope, color: e.target.value } }))}
                      style={{
                        width: 72, background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
                        borderRadius: 6, padding: '4px 8px', fontSize: 13, color: '#9A9692',
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <span style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: draft.defaultScope.color }} />
                  </div>
                </Row>
              </Section>
            </>
          )}

          {activeTab === 'subscription' && (
            <>
              <Section title="SUBSCRIPTION PLAN">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                  {(Object.entries(SUBSCRIPTION_OPTIONS) as [SubscriptionType, { label: string; monthlyCost: number }][]).map(([key, opt]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
                      <input
                        type="radio"
                        name="subscription"
                        value={key}
                        checked={draft.subscription.type === key}
                        onChange={() =>
                          setDraft((d) => ({
                            ...d,
                            subscription: { type: key, monthlyCost: opt.monthlyCost }
                          }))
                        }
                        style={{ accentColor: '#548C5A' }}
                      />
                      <span style={{ fontSize: 13, color: '#9A9692' }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </Section>
              <Section title="ABOUT">
                <div style={{ fontSize: 12, color: '#595653', padding: '8px 0', lineHeight: 1.6 }}>
                  <p style={{ margin: '4px 0' }}>Subscription plan affects cost display in StatsBar and Observability panel.</p>
                  <p style={{ margin: '4px 0' }}>Claude Max users see estimated savings instead of API costs.</p>
                </div>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px', borderTop: '1px solid rgba(89,86,83,0.2)',
        }}>
          <button
            onClick={handleReset}
            style={{ background: 'transparent', border: 'none', color: '#595653', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Reset to Defaults
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={closeSettings}
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: 500,
                background: 'rgba(89,86,83,0.15)', border: '1px solid rgba(89,86,83,0.3)',
                borderRadius: 6, color: '#9A9692', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="glow-green"
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: 600,
                background: '#548C5A', border: 'none',
                borderRadius: 6, color: '#0E0E0D', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

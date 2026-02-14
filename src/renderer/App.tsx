import { useEffect } from 'react'
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout'
import { SettingsPanel } from './components/SettingsPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSettingsStore, loadSettings } from './store/settings'

export function App() {
  const openSettings = useSettingsStore((s) => s.openSettings)
  const fontFamily = useSettingsStore((s) => s.settings.appearance.fontFamily)
  const fontSize = useSettingsStore((s) => s.settings.appearance.fontSize)

  useEffect(() => {
    loadSettings()
    const unsub = window.electronAPI.settings.onOpenSettings(() => {
      openSettings()
    })
    return unsub
  }, [openSettings])

  // Sync appearance settings to CSS custom properties so all UI inherits them
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--app-font-family', fontFamily)
    root.style.setProperty('--app-font-size', `${fontSize}px`)
  }, [fontFamily, fontSize])

  return (
    <div className="w-full h-full">
      <ErrorBoundary fallbackLabel="WorkspaceLayout">
        <WorkspaceLayout />
      </ErrorBoundary>
      <SettingsPanel />
    </div>
  )
}

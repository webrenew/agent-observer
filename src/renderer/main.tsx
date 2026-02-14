import './app.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { setupGlobalRendererDiagnostics } from './lib/diagnostics'
import { initializePluginRuntime } from './plugins/runtime'

setupGlobalRendererDiagnostics('main-window')
initializePluginRuntime()

const root = document.getElementById('root')!
createRoot(root).render(<App />)

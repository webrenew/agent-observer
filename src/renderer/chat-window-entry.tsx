import './app.css'
import { createRoot } from 'react-dom/client'
import { ChatPanel } from './components/chat/ChatPanel'
import { setupGlobalRendererDiagnostics } from './lib/diagnostics'

/**
 * Lightweight entry point for popped-out chat windows.
 * Reads the sessionId from the URL search params.
 */
export function ChatWindowApp() {
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get('sessionId') ?? `popout-${Date.now()}`

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ChatPanel chatSessionId={sessionId} />
    </div>
  )
}

setupGlobalRendererDiagnostics('chat-popout')

const root = document.getElementById('root')!
createRoot(root).render(<ChatWindowApp />)

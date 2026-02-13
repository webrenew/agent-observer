import { ChatPanel } from '../../chat/ChatPanel'

/**
 * Thin wrapper so the ChatPanel can live in the workspace tiling system.
 * No additional logic needed — ChatPanel manages its own state.
 */
export function ChatPanelWrapper() {
  return (
    <div className="w-full h-full overflow-hidden">
      <ChatPanel />
    </div>
  )
}

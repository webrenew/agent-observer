import { useState } from 'react'
import type { ChatMessage as ChatMessageType } from '../../types'

interface Props {
  message: ChatMessageType
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ToolCallCard({ message }: { message: ChatMessageType }) {
  const [expanded, setExpanded] = useState(false)

  const toolLabel = message.toolName ?? 'Tool'
  const isError = message.isError === true

  return (
    <div className={`rounded-lg border ${isError ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-white/5'} overflow-hidden`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <span className={`text-xs font-mono font-semibold ${isError ? 'text-red-400' : 'text-amber-400'}`}>
          {toolLabel}
        </span>
        <span className="text-white/30 text-xs ml-auto">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="border-t border-white/10 px-3 py-2">
          {message.toolInput && (
            <div className="mb-2">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Input</div>
              <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {JSON.stringify(message.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {message.content && (
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                {message.role === 'tool' ? 'Result' : 'Output'}
              </div>
              <pre className={`text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto ${isError ? 'text-red-300' : 'text-white/60'}`}>
                {message.content.slice(0, 2000)}
                {message.content.length > 2000 ? '\n... (truncated)' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ChatMessageBubble({ message }: Props) {
  // Tool calls get a special card
  if (message.role === 'tool' || (message.role === 'assistant' && message.toolName)) {
    return (
      <div className="px-4 py-1">
        <ToolCallCard message={message} />
      </div>
    )
  }

  // Thinking gets a subtle indicator
  if (message.role === 'thinking') {
    return (
      <div className="px-4 py-1">
        <div className="flex items-center gap-2 text-xs text-purple-300/60 italic">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400/40 animate-pulse" />
          <span className="max-w-md truncate">{message.content || 'Thinking...'}</span>
        </div>
      </div>
    )
  }

  // Error messages
  if (message.role === 'error') {
    return (
      <div className="px-4 py-1">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-300 text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  const isUser = message.role === 'user'

  return (
    <div className={`px-4 py-1.5 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600/80 text-white rounded-br-sm'
            : 'bg-white/8 text-white/90 rounded-bl-sm border border-white/10'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div className={`text-[10px] mt-1 ${isUser ? 'text-blue-200/50' : 'text-white/25'}`}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}

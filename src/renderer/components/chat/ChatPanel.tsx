import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, ClaudeEvent } from '../../types'
import { randomAppearance } from '../../types'
import { useAgentStore } from '../../store/agents'
import { ChatMessageBubble } from './ChatMessage'
import { ChatInput } from './ChatInput'

type SessionStatus = 'idle' | 'running' | 'done' | 'error'

let chatMessageCounter = 0
let chatAgentCounter = 0

function nextMessageId(): string {
  return `msg-${++chatMessageCounter}`
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus>('idle')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const agentIdRef = useRef<string | null>(null)

  const addAgent = useAgentStore((s) => s.addAgent)
  const removeAgent = useAgentStore((s) => s.removeAgent)
  const updateAgent = useAgentStore((s) => s.updateAgent)
  const getNextDeskIndex = useAgentStore((s) => s.getNextDeskIndex)
  const addEvent = useAgentStore((s) => s.addEvent)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle incoming Claude events
  useEffect(() => {
    const unsub = window.electronAPI.claude.onEvent((event: ClaudeEvent) => {
      if (sessionId && event.sessionId !== sessionId) return

      const agentId = agentIdRef.current

      switch (event.type) {
        case 'init': {
          // Session started successfully
          if (agentId) {
            updateAgent(agentId, { status: 'thinking' })
          }
          break
        }

        case 'text': {
          const data = event.data as { text: string }
          if (!data.text) break

          setMessages((prev) => {
            // Merge consecutive assistant text messages
            const last = prev[prev.length - 1]
            if (last && last.role === 'assistant' && !last.toolName) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + data.text },
              ]
            }
            return [
              ...prev,
              {
                id: nextMessageId(),
                role: 'assistant',
                content: data.text,
                timestamp: Date.now(),
              },
            ]
          })

          if (agentId) {
            updateAgent(agentId, { status: 'streaming' })
          }
          break
        }

        case 'thinking': {
          const data = event.data as { thinking: string }
          setMessages((prev) => {
            // Replace existing thinking message
            const withoutThinking = prev.filter((m) => m.role !== 'thinking')
            return [
              ...withoutThinking,
              {
                id: nextMessageId(),
                role: 'thinking',
                content: data.thinking?.slice(0, 200) ?? 'Thinking...',
                timestamp: Date.now(),
              },
            ]
          })

          if (agentId) {
            updateAgent(agentId, { status: 'thinking' })
          }
          break
        }

        case 'tool_use': {
          const data = event.data as { id: string; name: string; input: Record<string, unknown> }
          setMessages((prev) => [
            ...prev.filter((m) => m.role !== 'thinking'),
            {
              id: nextMessageId(),
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              toolName: data.name,
              toolInput: data.input,
              toolUseId: data.id,
            },
          ])

          if (agentId) {
            updateAgent(agentId, { status: 'tool_calling', currentTask: data.name })
            addEvent({
              agentId,
              agentName: `Chat ${chatAgentCounter}`,
              type: 'tool_call',
              description: `${data.name}`,
            })

            // Track file modifications
            const fileTools = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']
            if (fileTools.includes(data.name)) {
              const current = useAgentStore.getState().agents.find((a) => a.id === agentId)
              if (current) {
                updateAgent(agentId, { files_modified: current.files_modified + 1 })
              }
            }
          }
          break
        }

        case 'tool_result': {
          const data = event.data as { tool_use_id: string; content: string; is_error?: boolean }
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId(),
              role: 'tool',
              content: data.content,
              timestamp: Date.now(),
              toolUseId: data.tool_use_id,
              isError: data.is_error,
            },
          ])

          if (agentId) {
            updateAgent(agentId, { status: 'streaming' })
          }
          break
        }

        case 'result': {
          const data = event.data as { result: string; is_error?: boolean; error?: string; usage?: Record<string, unknown> }

          // Remove any lingering thinking messages
          setMessages((prev) => prev.filter((m) => m.role !== 'thinking'))

          if (data.is_error && data.error) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextMessageId(),
                role: 'error',
                content: data.error ?? 'Unknown error',
                timestamp: Date.now(),
              },
            ])
            setStatus('error')
          } else {
            setStatus('done')
          }

          if (agentId) {
            updateAgent(agentId, {
              status: data.is_error ? 'error' : 'done',
              isClaudeRunning: false,
            })
          }

          setSessionId(null)
          break
        }

        case 'error': {
          const data = event.data as { message: string }
          setMessages((prev) => [
            ...prev.filter((m) => m.role !== 'thinking'),
            {
              id: nextMessageId(),
              role: 'error',
              content: data.message,
              timestamp: Date.now(),
            },
          ])
          setStatus('error')

          if (agentId) {
            updateAgent(agentId, { status: 'error', isClaudeRunning: false })
          }
          setSessionId(null)
          break
        }
      }
    })

    return unsub
  }, [sessionId, updateAgent, addEvent])

  const handleSend = useCallback(
    async (message: string, files?: File[]) => {
      // Build the prompt with file context
      let prompt = message
      if (files && files.length > 0) {
        const fileContents: string[] = []
        for (const file of files) {
          try {
            const text = await file.text()
            fileContents.push(`\n--- File: ${file.name} ---\n${text}\n--- End: ${file.name} ---`)
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error(`Failed to read file ${file.name}: ${errMsg}`)
          }
        }
        if (fileContents.length > 0) {
          prompt = `${message}\n\nAttached files:${fileContents.join('\n')}`
        }
      }

      // Add user message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'user',
          content: message,
          timestamp: Date.now(),
        },
      ])

      setStatus('running')

      // Spawn a 3D agent
      const agentId = `chat-agent-${++chatAgentCounter}`
      agentIdRef.current = agentId
      const deskIndex = getNextDeskIndex()

      addAgent({
        id: agentId,
        name: `Chat ${chatAgentCounter}`,
        agent_type: 'chat',
        status: 'thinking',
        currentTask: message.slice(0, 60),
        model: '',
        tokens_input: 0,
        tokens_output: 0,
        files_modified: 0,
        started_at: Date.now(),
        deskIndex,
        terminalId: agentId, // Use agent ID as terminal ID for chat agents
        isClaudeRunning: true,
        appearance: randomAppearance(),
        commitCount: 0,
        activeCelebration: null,
        celebrationStartedAt: null,
        sessionStats: {
          tokenHistory: [],
          peakInputRate: 0,
          peakOutputRate: 0,
          tokensByModel: {},
        },
      })

      addEvent({
        agentId,
        agentName: `Chat ${chatAgentCounter}`,
        type: 'spawn',
        description: 'Chat session started',
      })

      try {
        const result = await window.electronAPI.claude.start({ prompt })
        setSessionId(result.sessionId)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`Failed to start Claude session: ${errMsg}`)
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: 'error',
            content: `Failed to start Claude: ${errMsg}`,
            timestamp: Date.now(),
          },
        ])
        setStatus('error')
        removeAgent(agentId)
      }
    },
    [addAgent, removeAgent, getNextDeskIndex, addEvent]
  )

  const handleStop = useCallback(async () => {
    if (!sessionId) return
    try {
      await window.electronAPI.claude.stop(sessionId)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`Failed to stop Claude session: ${errMsg}`)
    }
    setStatus('done')
    setSessionId(null)

    if (agentIdRef.current) {
      updateAgent(agentIdRef.current, { status: 'done', isClaudeRunning: false })
    }
  }, [sessionId, updateAgent])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setSessionId(null)
    setStatus('idle')
    agentIdRef.current = null
  }, [])

  const isRunning = status === 'running'

  return (
    <div className="flex flex-col h-full bg-[#16162a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">Chat</span>
          {status !== 'idle' && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                isRunning
                  ? 'bg-blue-500/20 text-blue-300'
                  : status === 'done'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-red-500/20 text-red-300'
              }`}
            >
              {isRunning ? 'Running' : status === 'done' ? 'Done' : 'Error'}
            </span>
          )}
        </div>
        {messages.length > 0 && !isRunning && (
          <button
            onClick={handleNewChat}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            New Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2">
            <div className="text-2xl">💬</div>
            <div className="text-sm">Ask Claude anything</div>
            <div className="text-xs text-white/20">
              Powered by Claude Code CLI
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
            {isRunning && messages[messages.length - 1]?.role !== 'thinking' && (
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span>Claude is working...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isRunning={isRunning}
        onStop={handleStop}
      />
    </div>
  )
}

import { useCallback, useRef, useState } from 'react'

interface Props {
  onSend: (message: string, files?: File[]) => void
  isRunning: boolean
  onStop: () => void
}

export function ChatInput({ onSend, isRunning, onStop }: Props) {
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed && attachedFiles.length === 0) return

    onSend(trimmed, attachedFiles.length > 0 ? attachedFiles : undefined)
    setInput('')
    setAttachedFiles([])

    // Re-focus the textarea
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [input, attachedFiles, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!isRunning) {
          handleSend()
        }
      }
    },
    [handleSend, isRunning]
  )

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setAttachedFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }, [])

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const hasContent = input.trim().length > 0 || attachedFiles.length > 0

  return (
    <div
      className="glass-panel"
      style={{
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        padding: '10px 16px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, paddingLeft: 18 }}>
          {attachedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(89, 86, 83, 0.15)',
                borderRadius: 3,
                padding: '2px 8px',
                fontSize: 12,
                color: '#9A9692',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {file.name}
              </span>
              <button
                onClick={() => removeFile(i)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#595653',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
        {/* File attach / play icon */}
        {isRunning ? (
          <button
            onClick={onStop}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#c45050',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              paddingTop: 4,
              padding: '4px 2px 0 0',
            }}
            title="Stop (kill session)"
          >
            &#9632;
          </button>
        ) : (
          <button
            onClick={handleFileSelect}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#595653',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              paddingTop: 4,
              padding: '4px 2px 0 0',
            }}
            title="Attach file"
          >
            ⛶
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          data-chat-input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? 'Claude is working...' : 'Message ...'}
          disabled={isRunning}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#9A9692',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'none',
            lineHeight: 1.5,
            minHeight: 24,
            maxHeight: 120,
            opacity: isRunning ? 0.4 : 1,
          }}
          rows={1}
          onInput={(e) => {
            const target = e.currentTarget
            target.style.height = 'auto'
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`
          }}
        />

        {/* Send button */}
        <button
          onClick={isRunning ? onStop : handleSend}
          disabled={!isRunning && !hasContent}
          style={{
            background: 'transparent',
            border: 'none',
            color: isRunning ? '#c45050' : hasContent ? '#548C5A' : '#74747C',
            cursor: hasContent || isRunning ? 'pointer' : 'default',
            fontSize: 16,
            fontFamily: 'inherit',
            transition: 'color 0.2s ease, text-shadow 0.2s ease',
            textShadow: hasContent ? '0 0 8px rgba(84, 140, 90, 0.4)' : 'none',
            paddingBottom: 4,
            opacity: !isRunning && !hasContent ? 0.4 : 1,
          }}
          title={isRunning ? 'Stop' : 'Send (Enter)'}
        >
          {isRunning ? '■' : '▶'}
        </button>
      </div>

      <div style={{ color: '#595653', fontSize: 10, marginTop: 6, textAlign: 'center', opacity: 0.4 }}>
        Enter send &middot; Shift+Enter newline
      </div>
    </div>
  )
}

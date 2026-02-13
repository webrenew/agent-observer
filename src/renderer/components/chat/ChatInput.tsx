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
    // Reset the input so the same file can be picked again
    e.target.value = ''
  }, [])

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="border-t border-white/10 bg-[#12122a] px-3 py-2.5">
      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {attachedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 bg-white/10 rounded-md px-2 py-1 text-xs text-white/70"
            >
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-white/40 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attach button */}
        <button
          onClick={handleFileSelect}
          disabled={isRunning}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors disabled:opacity-30"
          title="Attach file"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 10V12.667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.667 14H3.333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.667V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.333 5.333L8 2L4.667 5.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 2V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? 'Claude is working...' : 'Ask Claude anything...'}
          disabled={isRunning}
          rows={1}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-blue-500/50 disabled:opacity-50 min-h-[36px] max-h-[120px]"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.currentTarget
            target.style.height = 'auto'
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`
          }}
        />

        {/* Send / Stop button */}
        {isRunning ? (
          <button
            onClick={onStop}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            title="Stop"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="10" height="10" rx="1.5" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() && attachedFiles.length === 0}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send (Enter)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 1.5L6.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12.5 1.5L8.5 12.5L6.5 7.5L1.5 5.5L12.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

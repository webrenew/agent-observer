import { useEffect } from 'react'
import { useAgentStore } from '../store/agents'

export function ToastStack() {
  const toasts = useAgentStore((s) => s.toasts)
  const removeToast = useAgentStore((s) => s.removeToast)

  return (
    <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} type={toast.type} onRemove={removeToast} />
      ))}
    </div>
  )
}

function borderForType(type: 'info' | 'error' | 'success'): string {
  switch (type) {
    case 'error': return '1px solid rgba(196,80,80,0.4)'
    case 'success': return '1px solid rgba(84,140,90,0.4)'
    default: return '1px solid rgba(212,160,64,0.4)'
  }
}

function iconColorForType(type: 'info' | 'error' | 'success'): string {
  switch (type) {
    case 'error': return '#c45050'
    case 'success': return '#548C5A'
    default: return '#d4a040'
  }
}

function ToastItem({
  id,
  message,
  type,
  onRemove
}: {
  id: string
  message: string
  type: 'info' | 'error' | 'success'
  onRemove: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), 4000)
    return () => clearTimeout(timer)
  }, [id, onRemove])

  return (
    <div
      className="glass-panel animate-in"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        borderRadius: 8, border: borderForType(type), fontSize: 'inherit', minWidth: 240,
      }}
    >
      <span style={{ fontSize: 12, color: iconColorForType(type) }}>
        {type === 'error' ? '!' : type === 'success' ? '+' : '>'}
      </span>
      <span style={{ color: '#9A9692' }}>{message}</span>
    </div>
  )
}

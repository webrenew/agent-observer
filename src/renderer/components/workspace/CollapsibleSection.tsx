import { useState, type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  /** When true, the section fills its parent height and children flex-grow */
  fill?: boolean
}

export function CollapsibleSection({ title, children, defaultOpen = true, fill = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div style={fill ? { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } : undefined}>
      <div
        className="section-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '10px 16px 6px',
          color: '#74747C',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 1,
          flexShrink: 0,
        }}
      >
        <span className={`section-chevron ${isOpen ? '' : 'collapsed'}`}>&#9660;</span>
        {title}
      </div>
      <div
        className={`section-content ${isOpen ? '' : 'collapsed'}`}
        style={fill && isOpen ? { flex: 1, minHeight: 0, overflow: 'hidden', maxHeight: 'none' } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

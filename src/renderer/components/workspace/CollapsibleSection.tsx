import { useState, type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export function CollapsibleSection({ title, children, defaultOpen = true }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <div
        className="section-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '10px 16px 6px',
          color: '#74747C',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        <span className={`section-chevron ${isOpen ? '' : 'collapsed'}`}>&#9660;</span>
        {title}
      </div>
      <div className={`section-content ${isOpen ? '' : 'collapsed'}`}>
        {children}
      </div>
    </div>
  )
}

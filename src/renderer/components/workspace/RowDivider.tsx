import { useCallback, useRef } from 'react'

interface Props {
  onDrag: (deltaY: number) => void
}

export function RowDivider({ onDrag }: Props) {
  const isDragging = useRef(false)
  const lastY = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      lastY.current = e.clientY
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const delta = ev.clientY - lastY.current
        lastY.current = ev.clientY
        onDrag(delta)
      }
      const handleMouseUp = () => {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [onDrag]
  )

  return (
    <div onMouseDown={handleMouseDown} className="panel-divider">
      <div className="panel-divider-line" />
    </div>
  )
}

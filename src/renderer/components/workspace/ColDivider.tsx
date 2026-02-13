import { useCallback, useRef } from 'react'

interface Props {
  onDrag: (deltaX: number) => void
}

export function ColDivider({ onDrag }: Props) {
  const isDragging = useRef(false)
  const lastX = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      lastX.current = e.clientX
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const delta = ev.clientX - lastX.current
        lastX.current = ev.clientX
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
    <div onMouseDown={handleMouseDown} className="col-divider">
      <div className="col-divider-line" />
    </div>
  )
}

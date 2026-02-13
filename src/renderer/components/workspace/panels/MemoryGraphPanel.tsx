import { useRef, useEffect, useCallback } from 'react'
import { CollapsibleSection } from '../CollapsibleSection'

interface GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
  baseAlpha: number
}

const NODE_COLORS = ['#d4a040', '#c87830', '#548C5A', '#3a6a3a', '#e8c060', '#b86820']
const NODE_COUNT = 120

export function MemoryGraphPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const animRef = useRef<number>(0)

  const initNodes = useCallback((w: number, h: number): GraphNode[] => {
    const nodes: GraphNode[] = []
    for (let i = 0; i < NODE_COUNT; i++) {
      const cx = w * (0.2 + Math.random() * 0.6)
      const cy = h * (0.15 + Math.random() * 0.7)
      nodes.push({
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: 1 + Math.random() * 2.5,
        color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
        baseAlpha: 0.7 + Math.random() * 0.3,
      })
    }
    return nodes
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    nodesRef.current = initNodes(w, h)

    let time = 0
    const animate = () => {
      time += 0.016
      ctx.clearRect(0, 0, w, h)
      const nodes = nodesRef.current

      // Update positions with sine/cos drift
      for (const node of nodes) {
        node.x += node.vx + Math.sin(time * 0.5 + node.y * 0.01) * 0.05
        node.y += node.vy + Math.cos(time * 0.3 + node.x * 0.01) * 0.05
        if (node.x < 10 || node.x > w - 10) node.vx *= -1
        if (node.y < 10 || node.y > h - 10) node.vy *= -1
        node.x = Math.max(5, Math.min(w - 5, node.x))
        node.y = Math.max(5, Math.min(h - 5, node.y))
      }

      // Draw distance-based edges
      ctx.lineWidth = 0.3
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 45) {
            const alpha = 0.15 - dist / 450
            ctx.strokeStyle = `rgba(200, 160, 80, ${alpha})`
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw nodes with breathing alpha
      for (const node of nodes) {
        const breathe = Math.sin(time * 1.2 + node.x * 0.05) * 0.15
        ctx.fillStyle = node.color
        ctx.globalAlpha = Math.max(0.3, Math.min(1, node.baseAlpha + breathe))
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      animRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [initNodes])

  return (
    <CollapsibleSection title="MEMORY GRAPH">
      <div style={{ padding: '0 16px 10px', height: 'calc(100% - 36px)' }}>
        <canvas
          ref={canvasRef}
          width={300}
          height={200}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </CollapsibleSection>
  )
}

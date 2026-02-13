import { useRef, useEffect, useCallback } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
}

interface Edge {
  from: number
  to: number
  alpha: number
}

const NODE_COLORS = ['#4ade80', '#22d3ee', '#a78bfa', '#fb923c', '#f87171', '#60a5fa']
const NODE_COUNT = 18
const EDGE_COUNT = 24

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function createNodes(w: number, h: number): Node[] {
  return Array.from({ length: NODE_COUNT }, () => ({
    x: randomFloat(30, w - 30),
    y: randomFloat(30, h - 30),
    vx: randomFloat(-0.3, 0.3),
    vy: randomFloat(-0.3, 0.3),
    radius: randomFloat(2, 5),
    color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
    alpha: randomFloat(0.3, 0.8),
  }))
}

function createEdges(): Edge[] {
  const edges: Edge[] = []
  for (let i = 0; i < EDGE_COUNT; i++) {
    const from = Math.floor(Math.random() * NODE_COUNT)
    let to = Math.floor(Math.random() * NODE_COUNT)
    while (to === from) to = Math.floor(Math.random() * NODE_COUNT)
    edges.push({ from, to, alpha: randomFloat(0.05, 0.15) })
  }
  return edges
}

export function MemoryGraphPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const animRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const nodes = nodesRef.current
    const edges = edgesRef.current

    // Update positions
    for (const node of nodes) {
      node.x += node.vx
      node.y += node.vy

      if (node.x < 10 || node.x > w - 10) node.vx *= -1
      if (node.y < 10 || node.y > h - 10) node.vy *= -1

      node.x = Math.max(10, Math.min(w - 10, node.x))
      node.y = Math.max(10, Math.min(h - 10, node.y))
    }

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Draw edges
    for (const edge of edges) {
      const a = nodes[edge.from]
      const b = nodes[edge.to]
      if (!a || !b) continue

      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = `rgba(89, 86, 83, ${edge.alpha})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Draw nodes
    for (const node of nodes) {
      // Glow
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius * 3, 0, Math.PI * 2)
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 3)
      gradient.addColorStop(0, node.color + '30')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fill()

      // Core
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = node.color
      ctx.globalAlpha = node.alpha
      ctx.fill()
      ctx.globalAlpha = 1
    }

    animRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        canvas.width = width * window.devicePixelRatio
        canvas.height = height * window.devicePixelRatio
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
        nodesRef.current = createNodes(width, height)
        edgesRef.current = createEdges()
      }
    })

    resizeObserver.observe(canvas.parentElement ?? canvas)
    animRef.current = requestAnimationFrame(draw)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(animRef.current)
    }
  }, [draw])

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  )
}

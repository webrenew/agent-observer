import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Office } from '../../../scene/Office'
import { HUD } from '../../../hud/HUD'
import { useAgentStore } from '../../../store/agents'
import { CollapsibleSection } from '../CollapsibleSection'
import { logRendererEvent } from '../../../lib/diagnostics'

/**
 * Wraps the existing R3F Canvas + Office scene + HUD overlay.
 * Uses `fill` mode so the canvas stretches when the row is resized.
 */
export function ScenePanel() {
  const selectAgent = useAgentStore((s) => s.selectAgent)
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const [webglContextLost, setWebglContextLost] = useState(false)

  useEffect(() => {
    const canvas = canvasElement
    if (!canvas) return

    const onContextLost = (event: Event) => {
      event.preventDefault()
      setWebglContextLost(true)
      logRendererEvent('error', 'renderer.webgl_context_lost')
    }
    const onContextRestored = () => {
      setWebglContextLost(false)
      logRendererEvent('info', 'renderer.webgl_context_restored')
    }

    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
    }
  }, [canvasElement])

  return (
    <CollapsibleSection title="OFFICE" fill>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Canvas
          shadows
          camera={{
            position: [8, 7, 8],
            fov: 45,
            near: 0.1,
            far: 200,
          }}
          onCreated={({ gl }) => {
            setCanvasElement(gl.domElement)
          }}
          onPointerMissed={() => selectAgent(null)}
        >
          <Office />
        </Canvas>
        {webglContextLost ? (
          <div
            style={{
              position: 'absolute',
              inset: 8,
              borderRadius: 6,
              background: 'rgba(14,14,13,0.85)',
              border: '1px solid rgba(196,80,80,0.4)',
              color: '#c45050',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 12,
              pointerEvents: 'none',
            }}
          >
            Graphics context reset in progress. If this persists, reopen the app.
          </div>
        ) : null}
        <HUD />
      </div>
    </CollapsibleSection>
  )
}

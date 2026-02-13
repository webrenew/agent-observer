import { Canvas } from '@react-three/fiber'
import { Office } from '../../../scene/Office'
import { HUD } from '../../../hud/HUD'
import { useAgentStore } from '../../../store/agents'

/**
 * Wraps the existing R3F Canvas + Office scene + HUD overlay.
 * The Canvas must stay mounted to preserve WebGL context, so the
 * WorkspaceLayout should use CSS `display:none` rather than unmounting.
 */
export function ScenePanel() {
  const selectAgent = useAgentStore((s) => s.selectAgent)

  return (
    <div className="relative w-full h-full" style={{ minHeight: 120 }}>
      <Canvas
        shadows
        camera={{
          position: [8, 7, 8],
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        onPointerMissed={() => selectAgent(null)}
      >
        <Office />
      </Canvas>
      <HUD />
    </div>
  )
}

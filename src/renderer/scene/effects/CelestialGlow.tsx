import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { AdditiveBlending, MathUtils } from 'three'

interface CelestialGlowProps {
  targetRef: React.RefObject<{ position: { x: number; y: number; z: number } } | null>
  color: string
  visibility: number
  outerScale: number
  innerScale: number
}

export function CelestialGlow({
  targetRef,
  color,
  visibility,
  outerScale,
  innerScale,
}: CelestialGlowProps) {
  const outerRef = useRef<Mesh>(null)
  const innerRef = useRef<Mesh>(null)

  useFrame(({ camera }) => {
    const target = targetRef.current
    if (!target) return

    const pos = target.position
    const fadeOpacity = MathUtils.clamp(visibility, 0, 1)

    if (outerRef.current) {
      outerRef.current.position.set(pos.x, pos.y, pos.z)
      outerRef.current.quaternion.copy(camera.quaternion)
      outerRef.current.scale.setScalar(outerScale)
      const mat = outerRef.current.material
      if ('opacity' in mat) {
        ;(mat as { opacity: number }).opacity = fadeOpacity * 0.25
      }
      outerRef.current.visible = fadeOpacity > 0.01
    }

    if (innerRef.current) {
      innerRef.current.position.set(pos.x, pos.y, pos.z)
      innerRef.current.quaternion.copy(camera.quaternion)
      innerRef.current.scale.setScalar(innerScale)
      const mat = innerRef.current.material
      if ('opacity' in mat) {
        ;(mat as { opacity: number }).opacity = fadeOpacity * 0.4
      }
      innerRef.current.visible = fadeOpacity > 0.01
    }
  })

  return (
    <>
      <mesh ref={outerRef}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.25}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={innerRef}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { InstancedMesh } from 'three'
import { Object3D, Color, MathUtils } from 'three'

const STAR_COUNT = 300
const SKY_RADIUS = 80
const dummy = new Object3D()
const tmpColor = new Color()

interface StarData {
  theta: number
  phi: number
  baseScale: number
  twinkleSpeed: number
  twinklePhase: number
}

export function StarField({ daylight }: { daylight: number }) {
  const meshRef = useRef<InstancedMesh>(null)

  const stars = useMemo<StarData[]>(() => {
    return Array.from({ length: STAR_COUNT }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.random() * Math.PI * 0.45, // upper hemisphere only
      baseScale: 0.08 + Math.random() * 0.12,
      twinkleSpeed: 2 + Math.random() * 4,
      twinklePhase: Math.random() * Math.PI * 2,
    }))
  }, [])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return

    // Fade out when daylight >= 0.3
    const visibility = MathUtils.clamp(1 - daylight / 0.3, 0, 1)
    if (visibility <= 0.001) {
      mesh.visible = false
      return
    }
    mesh.visible = true

    const t = clock.getElapsedTime()

    for (let i = 0; i < STAR_COUNT; i++) {
      const star = stars[i]
      const twinkle = 0.5 + 0.5 * Math.sin(t * star.twinkleSpeed + star.twinklePhase)
      const scale = star.baseScale * twinkle * visibility

      // Spherical to cartesian (upper hemisphere)
      const sinPhi = Math.sin(star.phi)
      dummy.position.set(
        SKY_RADIUS * sinPhi * Math.cos(star.theta),
        SKY_RADIUS * Math.cos(star.phi),
        SKY_RADIUS * sinPhi * Math.sin(star.theta)
      )

      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      const brightness = 0.7 + 0.3 * twinkle
      tmpColor.setRGB(brightness, brightness, brightness * 0.95)
      mesh.setColorAt(i, tmpColor)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, STAR_COUNT]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} />
    </instancedMesh>
  )
}

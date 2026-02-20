import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { InstancedMesh } from 'three'
import { Object3D, Color, MathUtils } from 'three'
import type { CelebrationType } from '../types'

const PARTICLE_COUNT = 40
const CELEBRATION_DURATION_SECONDS: Record<CelebrationType, number> = {
  confetti: 4,
  rocket: 3,
  sparkles: 2.5,
  explosion: 2,
  trophy: 3,
  pizza_party: 4.2,
  floppy_rain: 3.8,
  dialup_wave: 3.4,
  fax_blast: 3.2,
  dance_party: 5,
}

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  color: Color
  sx: number
  sy: number
  sz: number
}

function makeParticles(type: CelebrationType): Particle[] {
  const confettiColors = [
    '#facc15', '#4ade80', '#a78bfa', '#fb923c', '#f87171',
    '#22d3ee', '#e879f9', '#34d399',
  ]
  const errorColors = ['#ef4444', '#f97316', '#fbbf24']
  const pizzaColors = ['#fbbf24', '#f59e0b', '#c45050', '#f97316']
  const floppyColors = ['#1f3b8c', '#303f9f', '#223a5f', '#111827']
  const dialupColors = ['#22d3ee', '#a78bfa', '#f472b6']
  const faxColors = ['#f8fafc', '#d4f4dd', '#e2e8f0']

  let colors = confettiColors
  let spread = 2.5
  let upForce = 4
  let sx = 0.05
  let sy = 0.05
  let sz = 0.05
  let originSpread = 0.3
  let originY = 1.5
  let originYJitter = 0.5

  if (type === 'explosion') {
    colors = errorColors
    spread = 1.7
    upForce = 2
    sx = 0.06
    sy = 0.06
    sz = 0.06
  } else if (type === 'pizza_party') {
    colors = pizzaColors
    spread = 1.3
    upForce = 3.2
    sx = 0.08
    sy = 0.035
    sz = 0.08
  } else if (type === 'floppy_rain') {
    colors = floppyColors
    spread = 0.8
    upForce = 2.2
    sx = 0.08
    sy = 0.08
    sz = 0.02
  } else if (type === 'dialup_wave') {
    colors = dialupColors
    spread = 1.1
    upForce = 2.8
    sx = 0.045
    sy = 0.045
    sz = 0.045
  } else if (type === 'fax_blast') {
    colors = faxColors
    spread = 1.6
    upForce = 3
    sx = 0.035
    sy = 0.06
    sz = 0.01
  } else if (type === 'dance_party') {
    colors = ['#f472b6', '#c084fc', '#818cf8', '#22d3ee', '#facc15', '#fb923c']
    spread = 2.0
    upForce = 3.8
    sx = 0.04
    sy = 0.04
    sz = 0.04
  } else if (type === 'sparkles') {
    colors = ['#fef08a', '#facc15', '#fde68a', '#f59e0b', '#f8fafc']
    spread = 0.9
    upForce = 2.6
    sx = 0.025
    sy = 0.025
    sz = 0.025
    originSpread = 0.45
    originY = 1.6
    originYJitter = 0.25
  } else if (type === 'rocket') {
    colors = ['#e2e8f0', '#93c5fd', '#60a5fa', '#bfdbfe']
    spread = 0.45
    upForce = 6.2
    sx = 0.03
    sy = 0.08
    sz = 0.03
    originSpread = 0.16
    originY = 1.2
    originYJitter = 0.2
  } else if (type === 'trophy') {
    colors = ['#facc15', '#fbbf24', '#f59e0b', '#fef3c7']
    spread = 0.7
    upForce = 2.9
    sx = 0.055
    sy = 0.085
    sz = 0.055
    originSpread = 0.24
    originY = 1.35
    originYJitter = 0.2
  }

  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: (Math.random() - 0.5) * originSpread,
    y: originY + Math.random() * originYJitter,
    z: (Math.random() - 0.5) * originSpread,
    vx: (Math.random() - 0.5) * spread,
    vy: Math.random() * upForce + 1,
    vz: (Math.random() - 0.5) * spread,
    color: new Color(colors[Math.floor(Math.random() * colors.length)]),
    sx: sx + Math.random() * 0.03,
    sy: sy + Math.random() * 0.03,
    sz: sz + Math.random() * 0.02,
  }))
}

interface CelebrationEffectProps {
  type: CelebrationType
  startedAt: number
  position: [number, number, number]
}

export function CelebrationEffect({
  type,
  startedAt,
  position,
}: CelebrationEffectProps) {
  const meshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const particles = useMemo(() => makeParticles(type), [type])
  const duration = CELEBRATION_DURATION_SECONDS[type]

  useFrame(() => {
    if (!meshRef.current) return
    const elapsed = (Date.now() - startedAt) / 1000
    if (elapsed > duration) {
      meshRef.current.visible = false
      return
    }

    const progress = elapsed / duration
    const gravity = type === 'rocket' ? -4 : type === 'trophy' ? -4.8 : -6

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i]
      const t = elapsed

      dummy.position.set(
        p.x + p.vx * t,
        p.y + p.vy * t + 0.5 * gravity * t * t,
        p.z + p.vz * t
      )

      const fade = MathUtils.lerp(1, 0, Math.max(0, progress - 0.5) * 2)
      const twinkle = type === 'sparkles'
        ? 0.75 + Math.abs(Math.sin(t * 18 + i * 0.6)) * 0.7
        : 1
      dummy.scale.set(p.sx * fade * twinkle, p.sy * fade * twinkle, p.sz * fade * twinkle)
      dummy.rotation.set(t * 3 + i, t * 2 + i * 0.5, t + i * 0.3)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
      meshRef.current.setColorAt(i, p.color)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

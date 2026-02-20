import { useRef, useMemo } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import type { Mesh, ShaderMaterial } from 'three'
import { AdditiveBlending, Color, MathUtils } from 'three'

const RadialGlowMaterial = shaderMaterial(
  { uColor: new Color('#FFD080'), uOpacity: 0.25 },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      float dist = length(vUv - 0.5) * 2.0;
      float alpha = smoothstep(1.0, 0.0, dist);
      alpha *= alpha;
      gl_FragColor = vec4(uColor, alpha * uOpacity);
    }
  `
)
extend({ RadialGlowMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    radialGlowMaterial: ThreeElements['shaderMaterial']
  }
}

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
  const outerMatRef = useRef<ShaderMaterial>(null)
  const innerMatRef = useRef<ShaderMaterial>(null)
  const glowColor = useMemo(() => new Color(color), [color])

  useFrame(({ camera }) => {
    const target = targetRef.current
    if (!target) return

    const pos = target.position
    const fadeOpacity = MathUtils.clamp(visibility, 0, 1)

    if (outerRef.current) {
      outerRef.current.position.set(pos.x, pos.y, pos.z)
      outerRef.current.quaternion.copy(camera.quaternion)
      outerRef.current.scale.setScalar(outerScale)
      outerRef.current.visible = fadeOpacity > 0.01
    }
    if (outerMatRef.current) {
      outerMatRef.current.uniforms.uOpacity.value = fadeOpacity * 0.35
      outerMatRef.current.uniforms.uColor.value.copy(glowColor)
    }

    if (innerRef.current) {
      innerRef.current.position.set(pos.x, pos.y, pos.z)
      innerRef.current.quaternion.copy(camera.quaternion)
      innerRef.current.scale.setScalar(innerScale)
      innerRef.current.visible = fadeOpacity > 0.01
    }
    if (innerMatRef.current) {
      innerMatRef.current.uniforms.uOpacity.value = fadeOpacity * 0.55
      innerMatRef.current.uniforms.uColor.value.copy(glowColor)
    }
  })

  return (
    <>
      <mesh ref={outerRef}>
        <planeGeometry args={[1, 1]} />
        <radialGlowMaterial
          ref={outerMatRef}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={innerRef}>
        <planeGeometry args={[1, 1]} />
        <radialGlowMaterial
          ref={innerMatRef}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

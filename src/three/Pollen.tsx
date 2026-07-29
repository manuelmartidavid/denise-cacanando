import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { frame } from '~/scroll/store'

type Props = {
  count: number
  frozen: boolean
}

/**
 * Pollen / petal points — always on, additive.
 * Density halves over cream grounds and drops to 25% on compact layouts; the
 * count arrives as a prop so the caller owns that decision.
 */
export const Pollen = ({ count, frozen }: Props) => {
  const points = useRef<THREE.Points>(null)

  const { positions, drift } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const drift = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8
      drift[i] = 0.15 + Math.random() * 0.5
    }
    return { positions, drift }
  }, [count])

  useFrame((_, delta) => {
    const mesh = points.current
    if (!mesh || frozen) return

    const attr = mesh.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array

    for (let i = 0; i < count; i++) {
      const y = i * 3 + 1
      arr[y]! -= drift[i]! * delta
      if (arr[y]! < -7) arr[y] = 7
    }
    attr.needsUpdate = true

    // Scroll nudges the whole field sideways — pollen carried by the same
    // current the flock rides.
    mesh.position.x = frame.progress * -3
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        color="#b8873f"
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

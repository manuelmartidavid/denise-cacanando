import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { frame } from '~/scroll/store'

type Props = {
  count: number
  frozen: boolean
}

/**
 * `THREE.Color` cannot parse `oklch`, so the one token this system uses is
 * converted once. Keep the token name — if `index.css` changes it must be
 * recomputed by hand. Invariant 8; `Butterflies.tsx` does the same for its two.
 */
const OCHRE = '#c9884c' // --color-ochre, oklch(0.68 0.11 62)

/** World units of z the field spans, centred on the z = 0 plane. */
const DEPTH = 8

/** How far the field slides left across the document — see `useFrame` below. */
const SLIDE_X = 3

/**
 * Pollen / petal points — always on, additive.
 * Density halves over cream grounds and drops to 25% on compact layouts; the
 * count arrives as a prop so the caller owns that decision.
 */
export const Pollen = ({ count, frozen }: Props) => {
  const points = useRef<THREE.Points>(null)
  const viewport = useThree((s) => s.viewport)

  /**
   * Scatter across the camera's actual frustum rather than a fixed box.
   * `viewport` reports the visible extent in world units at the z = 0 plane, so
   * these follow the aspect ratio instead of assuming one: about 13.3 x 8.3 at
   * 1440x900, 14.7 x 8.3 at 16:9.
   *
   * The 22 x 14 box this replaces was unrelated to the camera — it left roughly
   * a third of the field outside the frame at every width, and it is also the
   * number `Butterflies.tsx`'s spec was wrongly authored against (see its
   * `RADIUS_WIDE` docstring). Density here is a look decision of Denise's, made
   * through `count`; the box quietly discounting it was not.
   *
   * The frustum is a pyramid, so its cross-section grows with distance from the
   * camera: each particle spreads across the extent at its own z rather than a
   * shared slice, which is what keeps the near and far edges equally covered.
   *
   * `SLIDE_X` of extra material on the right pays for the leftward slide below.
   * The old box was wide enough to absorb it by accident; a frustum-sized one is
   * not, and without the allowance the right edge empties out by the end of the
   * document.
   *
   * A resize re-scatters the field, as a count change already did. Deliberate:
   * it is the only way the width can follow a new aspect, and a reshuffle of
   * faint additive dots behind the page costs less than carrying normalised
   * coordinates through the drift.
   */
  const { positions, drift, limits } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const drift = new Float32Array(count)
    const limits = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const z = (Math.random() - 0.5) * DEPTH
      const spread = (viewport.distance - z) / viewport.distance
      const halfW = (viewport.width * spread) / 2
      const halfH = (viewport.height * spread) / 2

      positions[i * 3] = -halfW + Math.random() * (halfW * 2 + SLIDE_X)
      positions[i * 3 + 1] = (Math.random() - 0.5) * halfH * 2
      positions[i * 3 + 2] = z
      drift[i] = 0.15 + Math.random() * 0.5
      limits[i] = halfH
    }

    return { positions, drift, limits }
  }, [count, viewport.width, viewport.height, viewport.distance])

  useFrame((_, delta) => {
    const mesh = points.current
    if (!mesh || frozen) return

    const attr = mesh.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array

    for (let i = 0; i < count; i++) {
      const y = i * 3 + 1
      arr[y]! -= drift[i]! * delta
      // Respawn at the top of this particle's own slice of the frustum.
      if (arr[y]! < -limits[i]!) arr[y] = limits[i]!
    }
    attr.needsUpdate = true

    // Scroll nudges the whole field sideways — pollen carried by the same
    // current the flock rides.
    mesh.position.x = frame.progress * -SLIDE_X
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        color={OCHRE}
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

import { Canvas } from '@react-three/fiber'
import { Pollen } from './Pollen'
import { useCompactLayout, useReducedMotion } from '~/scroll/useReducedMotion'

const FULL_POLLEN = 4000

/**
 * One fixed full-viewport canvas behind the DOM. Three systems share a scroll
 * uniform: pollen (here), the instanced butterfly flock, and the centre-slot
 * ripple plane.
 *
 * SCAFFOLD: only pollen exists so far. The flock (~1,200 instances, wing phase
 * in the vertex shader, one attractor per scene) and the centre slot come next.
 *
 * Deliberately NOT here: the orbitable ovoid. Ring thumbs are flat crops; the
 * 3D egg is mounted only on the Ovalese detail route. That split is what keeps
 * the gallery cheap.
 */
export const Stage = () => {
  const reduced = useReducedMotion()
  const compact = useCompactLayout()

  // Compact drops the butterfly system entirely and keeps pollen at 25%.
  const pollenCount = compact ? Math.round(FULL_POLLEN * 0.25) : FULL_POLLEN

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        frameloop={reduced ? 'demand' : 'always'}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 10], fov: 45 }}
      >
        <Pollen count={pollenCount} frozen={reduced} />
        {/* <Butterflies count={compact ? 0 : 1200} frozen={reduced} /> */}
        {/* <CentreSlot /> */}
      </Canvas>
    </div>
  )
}

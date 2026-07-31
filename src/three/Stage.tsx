import { memo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Pollen } from './Pollen'
import { Butterflies } from './Butterflies'
import { useCompactLayout, useReducedMotion } from '~/scroll/useReducedMotion'

const FULL_POLLEN = 4000
const FULL_FLOCK = 1200

/**
 * One fixed full-viewport canvas behind the DOM. Three systems share a scroll
 * uniform: pollen (here), the instanced butterfly flock, and the centre-slot
 * ripple plane.
 *
 * SCAFFOLD: pollen and the flock exist; the centre slot does not. It is DOM for
 * now and cross-fades on snap — see sections/ring/CentreSlot.tsx, which holds
 * the seam the ripple/displacement shader replaces.
 *
 * Deliberately NOT here: the orbitable ovoid. Ring thumbs are flat crops; the
 * 3D egg is mounted only on the Ovalese detail route. That split is what keeps
 * the gallery cheap.
 *
 * Memoised because it takes no props: ScrollPage re-renders on every label
 * change, and without this the canvas subtree reconciled along with it several
 * times per scene for no possible difference in output. Its own two media-query
 * subscriptions still re-render it when they actually change.
 */
export const Stage = memo(() => {
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
        {!compact && <Butterflies count={FULL_FLOCK} frozen={reduced} />}
        {/* <CentreSlot /> */}
      </Canvas>
    </div>
  )
})

Stage.displayName = 'Stage'

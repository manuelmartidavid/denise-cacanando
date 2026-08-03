import { memo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Petals } from './Petals'
import { Butterflies } from './Butterflies'
import { useCompactLayout, useReducedMotion } from '~/scroll/useReducedMotion'

/**
 * Down from the 500 the points field carried. 500 petals is a blizzard: that
 * count was affordable because each particle was a 3.5cm dot, and a petal
 * covers far more screen than that. The rewrite landed on 130; Denise took it
 * to 60 by eye, alongside a matching cut to the per-instance scales in
 * `Petals.tsx`.
 */
const FULL_PETALS = 60
const FULL_FLOCK = 10

/**
 * One fixed full-viewport canvas behind the DOM. Three systems share a scroll
 * uniform: the petal field (here), the instanced butterfly flock, and the
 * centre-slot ripple plane.
 *
 * SCAFFOLD: petals and the flock exist; the centre slot does not. It is DOM for
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

  // Compact drops the butterfly system entirely and keeps petals at 25%.
  const petalCount = compact ? Math.round(FULL_PETALS * 0.25) : FULL_PETALS

  return (
    // z-[1]: above GroundLayer's section grounds (z-0), below <main> (z-10).
    <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        frameloop={reduced ? 'demand' : 'always'}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 10], fov: 45 }}
      >
        <Petals count={petalCount} frozen={reduced} />
        {!compact && <Butterflies count={FULL_FLOCK} frozen={reduced} />}
        {/* <CentreSlot /> */}
      </Canvas>
    </div>
  )
})

Stage.displayName = 'Stage'

import type { CSSProperties } from 'react'

/**
 * The seed: the Dial's own dashed guide circle, contracted to a mark that
 * survives the gap between g1 and g2.
 *
 * It lives here rather than in either section because every section clips to
 * its own pane (invariant 10) and both neighbours are mid-scroll exactly when
 * the seed must be visible — anything section-owned is clipped away at the one
 * moment it matters.
 *
 * `left: 62% / top: 52%` is not a new constant: it is where `Dial` puts its
 * ring centre, and a pinned section's box is the viewport, so these coincide
 * with both rings' centres with nothing to measure.
 *
 * z-[2]: above the r3f canvas (z-1), below `main` (z-10), so the flock can pass
 * in front of it and the incoming scene's title is never covered.
 */
const SEED_PX = 24

export const SeedLayer = () => (
  <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden="true">
    <div
      className="absolute rounded-full border border-dashed border-cream/14"
      data-seed
      style={
        {
          left: '62%',
          top: '52%',
          width: SEED_PX,
          height: SEED_PX,
          // Per-frame plumbing, which invariant 13 keeps as inline style.
          transform: 'translate(-50%, -50%) scale(calc(0.4 + 0.6 * var(--seed, 0)))',
          opacity: 'var(--seed, 0)',
        } as CSSProperties
      }
    />
  </div>
)

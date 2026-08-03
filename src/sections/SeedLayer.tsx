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
 * z-[2]: above the r3f canvas (z-1), below `main` (z-10), so the incoming
 * scene's title is never covered. Note this puts the seed *in front of* the
 * flock, not behind it — an earlier version of this comment claimed the
 * opposite. Being in front is not enough on its own: a dashed hairline at 14%
 * over a dense cloud still reads as nothing, which is what the glow is for.
 *
 * `shadow-glow-seed` is Marti's ruling on that collision, paired with a looser
 * `RADIUS_TIGHT` in `Butterflies.tsx`. The glow is local to this mark; the
 * radius is not — see its docstring.
 *
 * **What the glow actually bought, shot at the boundary:** the mark's *position*
 * now reads through the flock, but it reads as a dark disc inside a warm rim,
 * not as a dashed circle. `border-cream/14` is a 14%-alpha hairline on a 24px
 * ring, which is below the threshold of legibility at that size, and a
 * `box-shadow` paints outside the border-box only — so the interior stays
 * background-dark and the halo silhouettes it. If the *dashed* character is
 * load-bearing rather than the mark merely being locatable, the border alpha is
 * the thing to raise, not the glow. Not changed here: the ruling was for a glow,
 * and the dash weight is a separate call nobody has made yet.
 */
const SEED_PX = 24

export const SeedLayer = () => (
  <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden="true">
    <div
      className="shadow-glow-seed absolute rounded-full border border-dashed border-cream/14"
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

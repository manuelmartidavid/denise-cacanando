/**
 * The between-scene "collapse to a seed" transition — README §179, and
 * `docs/superpowers/specs/2026-08-03-collapse-to-seed-design.md`.
 *
 * Pure, and deliberately separate from `~/three/flock`: that module owns the
 * boundary geometry the flock and this share, while everything here is about
 * the seed alone. Keeping the shaping constant on this side is what lets the
 * transition's feel be tuned without moving the butterflies.
 */

import { boundaryAt, clamp01, halfWidthAt, smoothstep, type Span } from '~/three/flock'
import { LABELS, type GalleryLabel } from './scenes'

/**
 * The one seam that collapses, declared here as g1|g2. A second boundary
 * between g2 and g3 — both dials now — is a matter of generalising this
 * declaration, and would need its own collapse treatment designed first.
 */
export const SEED_SEAM = { out: 'g1', in: 'g2' } as const

/** Position in `LABELS`, never a hardcoded index (invariant 4). */
export const SEED_SEAM_INDEX = LABELS.indexOf(SEED_SEAM.out)

export type SeamRole = 'out' | 'in'

/** Which side of the seam a scene is on, if any. `g4` gets `undefined`. */
export const seamRole = (label: GalleryLabel): SeamRole | undefined =>
  label === SEED_SEAM.out ? 'out' : label === SEED_SEAM.in ? 'in' : undefined

/**
 * How much of the band the seed spends at full presence.
 *
 * `gather` is a smoothstep hump: it touches 1 at the midpoint and immediately
 * falls away, so driving the seed from it directly would show the seed for a
 * single instant. Dividing by this and clamping flattens the top, giving a
 * genuine plateau — the seed *holds* across the gap, which is the whole point
 * of it being one object rather than a collapse and a bloom.
 *
 * A look decision. Tune in a browser.
 */
export const SEED_PLATEAU = 0.55

/** The seed's presence, 0 outside the band and 1 across the plateau. */
export const seedPresence = (seam: number): number =>
  clamp01((1 - Math.abs(seam)) / SEED_PLATEAU)

/**
 * The same seam, renormalised so that its zero spans the *unpinned* gap rather
 * than falling on the boundary — the scalar the two rings collapse against.
 *
 * **Why this exists, and why it is not just `seamAt`.** A ring is `absolute` at
 * 52% of its own section; the seed is `fixed` at 52% of the viewport. Those
 * coincide only while GSAP has that section pinned. `seamAt` reaches 0 at the
 * boundary, which for the `g1 -> g2` seam is 450px *past* g1's pin release — so
 * driving the collapse from it left a half-collapsed ring drifting up the screen
 * while a fully-bright seed stayed put, ~137px apart. Measured on the fixture,
 * not reasoned about after the fact.
 *
 * So: the outgoing ring finishes collapsing exactly as its pin releases, and the
 * incoming ring does not begin opening until its own pin takes hold. Between
 * those two moments neither ring is pinned, neither is on screen, and the seed
 * carries the transition alone. **That is the whole point — the handoff from
 * section-owned to layer-owned now happens while the ring is still pinned, which
 * is the only time the two marks are guaranteed to be in the same place.**
 *
 * The cost, and it was accepted knowingly: the collapse is compressed into a
 * shorter run of scroll, so it happens faster than the band would suggest. The
 * alternative on the table was to accept the drift and stop claiming the handoff
 * is invisible.
 *
 * **The flock is untouched by this.** It still reads `flockAt` off the shared
 * `boundaryAt` / `halfWidthAt`, and so does `--seam` and therefore the seed's own
 * presence. Only the rings' collapse is remapped, and it is remapped *from* the
 * same band edges — `bandStart` and `bandEnd` here are the flock's, so the
 * transition still begins and ends exactly where the migration does.
 *
 * Shape matches `seamAt`: `smoothstep` of the normalised distance, so both ramps
 * leave their endpoints with zero slope and neither ring starts or stops moving
 * with a visible corner.
 */
export const seamPinnedAt = (spans: Span[], p: number, seam: number): number => {
  if (spans.length < 2 || seam < 0 || seam > spans.length - 2) return 1

  const b = boundaryAt(spans, seam)
  const w = halfWidthAt(spans, seam)
  if (w <= 0) return p < b ? -1 : 1

  const bandStart = b - w
  const bandEnd = b + w
  // The outgoing scene's pin release and the incoming scene's pin start. For a
  // pinned scene a span *is* its pin, so these are exactly the two moments the
  // rings stop and start being co-located with the seed.
  const outEnd = spans[seam]!.to
  const inStart = spans[seam + 1]!.from

  if (p <= bandStart) return -1
  if (p >= bandEnd) return 1

  // Degenerate geometry is possible in principle — an unpinned pair is
  // contiguous, so `outEnd === inStart` and the plateau has zero length. That is
  // continuous, not a special case: both branches give 0 at that point.
  if (p < outEnd) {
    const run = outEnd - bandStart
    return run > 0 ? -smoothstep(clamp01((outEnd - p) / run)) : 0
  }
  if (p <= inStart) return 0
  const run = bandEnd - inStart
  return run > 0 ? smoothstep(clamp01((p - inStart) / run)) : 1
}

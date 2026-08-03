/**
 * The between-scene "collapse to a seed" transition — README §179, and
 * `docs/superpowers/specs/2026-08-03-collapse-to-seed-design.md`.
 *
 * Pure, and deliberately separate from `~/three/flock`: that module owns the
 * boundary geometry the flock and this share, while everything here is about
 * the seed alone. Keeping the shaping constant on this side is what lets the
 * transition's feel be tuned without moving the butterflies.
 */

import { clamp01 } from '~/three/flock'
import { LABELS, type GalleryLabel } from './scenes'

/**
 * The one seam that collapses. Ring-to-ring only: g3 is the Murals track, not
 * a ring, so the two seams touching it keep the plain scroll-away. Adding a
 * boundary later is a matter of generalising this declaration — but the track
 * would still need its own collapse treatment designed first.
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
 * A look decision. Tune in a browser; likely wants Denise's eye.
 */
export const SEED_PLATEAU = 0.55

/** The seed's presence, 0 outside the band and 1 across the plateau. */
export const seedPresence = (seam: number): number =>
  clamp01((1 - Math.abs(seam)) / SEED_PLATEAU)

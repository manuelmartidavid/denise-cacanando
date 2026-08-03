/**
 * Flock geometry — pure. No three.js, no React, and deliberately no import of
 * `~/scroll/timeline`: that module registers GSAP at import time and this file
 * has to stay loadable in Vitest's node environment (invariant 6). The live
 * read of label offsets therefore stops in `Butterflies.tsx`.
 *
 * README §175 specifies GSAP MotionPath here. It is not used — see
 * `docs/superpowers/specs/2026-07-31-butterfly-flock-design.md` §2.
 */

import { LABELS, type Label } from '~/scroll/scenes'

export type Vec3 = [number, number, number]

/** `at` is whole-document scroll progress, 0–1. `target` is canvas world space. */
export type Waypoint = { at: number; target: Vec3 }

export type FlockState = {
  target: Vec3
  /** 0 at a waypoint (thinned residue), 1 mid-gap (dense migrating cloud). */
  gather: number
  /** 0 until the final leg, 1 at the end. Damps drift and wing flap. */
  settle: number
}

const ORIGIN: Vec3 = [0, 0, 0]

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/**
 * Where the flock is heading, and how tightly, at a given scroll progress.
 *
 * `gather` is `sin(pi * t)` across each leg, which is what makes it exactly 0 at
 * both ends of every leg — so the seam between two legs is continuous by
 * construction rather than by a matching pair of hand-tuned endpoints.
 *
 * The returned `target` is read-only: on the clamped and single-waypoint fast
 * paths it is the module-level `ORIGIN` or a caller-owned `ATTRACTORS` entry
 * returned by reference, not a copy. Only the interpolating path allocates a
 * fresh array. Nothing today mutates `state.target`, but a caller that did
 * would silently corrupt `ATTRACTORS`.
 */
export const flockAt = (waypoints: Waypoint[], progress: number): FlockState => {
  if (waypoints.length === 0) return { target: ORIGIN, gather: 0, settle: 0 }

  const first = waypoints[0]!
  if (waypoints.length === 1) return { target: first.target, gather: 0, settle: 0 }

  const last = waypoints[waypoints.length - 1]!
  const p = clamp01(progress)

  if (p <= first.at) return { target: first.target, gather: 0, settle: 0 }
  // Past the last waypoint the flock has landed and holds — README §148.
  if (p >= last.at) return { target: last.target, gather: 0, settle: 1 }

  let i = 0
  while (i < waypoints.length - 2 && waypoints[i + 1]!.at <= p) i++

  const a = waypoints[i]!
  const b = waypoints[i + 1]!
  const span = b.at - a.at
  const t = span > 0 ? (p - a.at) / span : 0

  return {
    target: lerp3(a.target, b.target, t),
    gather: Math.sin(Math.PI * t),
    settle: i === waypoints.length - 2 ? t : 0,
  }
}

/**
 * One attractor per timeline label, in canvas world space. The camera sits at
 * z:10 / fov:45, so the visible frame at the z = 0 plane is about **13.3 wide x
 * 8.28 tall** (half-extents ~6.63 x 4.14). `Butterflies.tsx`'s
 * `instanceAttributes` derives from the same measurement.
 *
 * This docstring said 13.1 and ~6.55 until the petals rewrite. The height was
 * always right; the width was slightly under, and `Butterflies.tsx` had already
 * been corrected — leaving the two files disagreeing about the same frustum.
 * The 22 x 14 box both once contrasted against was the old points field's own
 * hardcoded constant rather than a measurement, and neither it nor that file
 * exists any more.
 *
 * These live here rather than in `index.css` for the reason invariant 7 gives
 * for scene geometry: the motion rule computes with them, and CSS cannot.
 *
 * Sources: hero idles low-left, entering from the crop's edge (README §109);
 * about crosses the cream (§119); the gallery attractors sit outside the ring
 * (§131); contact is where the flock lands and stops (§148).
 *
 * At the tuned `RADIUS_WIDE` (`Butterflies.tsx`), the `gather: 0` dispersal
 * ellipsoid's semi-axes are far larger than this frame's half-extents, so the
 * frame lies wholly inside it for all seven attractors and the resting
 * residue reads as near-uniform dust rather than a placement biased toward
 * the attractor. At this radius these coordinates function as **travel
 * endpoints** — they set the path the dense mid-leg cloud (`gather: 1`, the
 * midpoint between two attractors) sweeps along — and do not themselves
 * produce a visible per-scene placement. Revisit once the canvas is actually
 * visible (defect (a) currently occludes it).
 */
export const ATTRACTORS: Record<Label, Vec3> = {
  hero: [-8, -4.2, -1],
  about: [4.5, 1.2, 0],
  g1: [-7, 3, -2],
  g2: [7, -2.4, -1],
  g3: [-6.2, -3, 0],
  g4: [6.4, 3.2, -2],
  contact: [0, -5, 0],
}

/**
 * Label offsets in document px -> waypoints in progress space.
 *
 * Offsets arrive in `LABELS` order and are recomputed on every
 * `ScrollTrigger.refresh()`, so nothing here is cached and the known-good
 * baseline offsets are never embedded (invariant 4).
 *
 * A partial set returns nothing rather than a shortened path: before the first
 * refresh some labels are unregistered, and interpolating across the gap would
 * fly the flock along a route that is wrong rather than merely absent.
 */
export const waypointsFrom = (
  offsets: ReadonlyArray<number | undefined>,
  scrollable: number,
): Waypoint[] => {
  if (scrollable <= 0 || offsets.length !== LABELS.length) return []

  const out: Waypoint[] = []
  for (let i = 0; i < LABELS.length; i++) {
    const offset = offsets[i]
    if (offset === undefined) return []
    out.push({ at: clamp01(offset / scrollable), target: ATTRACTORS[LABELS[i]!] })
  }
  return out
}

/**
 * Flock geometry — pure. No three.js, no React, and deliberately no import of
 * `~/scroll/timeline`: that module registers GSAP at import time and this file
 * has to stay loadable in Vitest's node environment (invariant 6). The live
 * read of label offsets therefore stops in `Butterflies.tsx`.
 *
 * README §175 specifies GSAP MotionPath here. It is not used — see
 * `docs/superpowers/specs/2026-07-31-butterfly-flock-design.md` §2.
 */

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

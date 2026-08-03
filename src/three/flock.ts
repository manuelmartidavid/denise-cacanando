/**
 * Flock geometry — pure. No three.js, no React, and deliberately no import of
 * `~/scroll/timeline`: that module registers GSAP at import time and this file
 * has to stay loadable in Vitest's node environment (invariant 6). The live
 * read of label spans therefore stops in `Butterflies.tsx`.
 *
 * README §175 specifies GSAP MotionPath here. It is not used — see
 * `docs/superpowers/specs/2026-07-31-butterfly-flock-design.md` §2.
 */

import { LABELS, type Label } from '~/scroll/scenes'

export type Vec3 = [number, number, number]

/**
 * One scene's occupancy of the document, in whole-document progress. A scene is
 * a **range**, not a point: a pinned gallery scene holds its label offset still
 * for `pinLengthPx(scene.length, innerHeight)` of scroll, and treating that as
 * an instant is what used to park the densest cloud on the centred piece.
 */
export type Span = {
  from: number
  to: number
  target: Vec3
  /** The flock's presence while this scene is on screen — see `HOLD`. */
  hold: number
}

/** What a label contributes to a span, in document px. */
export type LabelBounds = { start: number; end: number }

export type FlockState = {
  target: Vec3
  /** 0 through a scene (thinned residue), 1 at a seam (dense migrating cloud). */
  gather: number
  /** 0 until the final band, 1 at the end. Damps drift and wing flap. */
  settle: number
  /** How much of the flock is drawn at all. 0 means nothing is on screen. */
  presence: number
}

const ORIGIN: Vec3 = [0, 0, 0]

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/** Hermite ease, 0 at u=0 and 1 at u=1 with zero slope at both ends. */
const smoothstep = (u: number): number => u * u * (3 - 2 * u)

/**
 * Where two scenes meet: the midpoint of one span's end and the next span's
 * start.
 *
 * The midpoint rather than either endpoint, because the two kinds of seam on
 * this page have different shapes. Hero ends exactly where About begins, so
 * there the midpoint IS the shared edge. But a pinned scene's trigger ends when
 * its pin releases, and the next section's trigger does not start until that
 * section reaches the top — one whole viewport later, while the released scene
 * scrolls away. That is a genuine gap, and the midpoint sits in the middle of
 * it, which is exactly where the migration should peak.
 */
export const boundaryAt = (spans: Span[], i: number): number => (spans[i]!.to + spans[i + 1]!.from) / 2

/**
 * Half-width of the transition band around boundary `i`, in whole-document
 * progress: `BAND`, but never more than half the distance to the neighbouring
 * boundary on either side.
 *
 * The clamp is what makes continuity structural rather than lucky. Hero and
 * About are one viewport each — about 0.06 of a 15660px document — which is
 * narrower than a full 0.10-wide band, so an unclamped band around their seam
 * would overlap the next one. Where two bands overlap, the "nearest boundary"
 * that drives `target` and `hold` flips from one to the other mid-span and both
 * jump: measured at ~0.2 on the Hero/About seam, which the flock's velocity EMA
 * turns into a visible lurch. Clamped, adjacent bands can at worst meet at a
 * point where both have `gather === 0`, so they agree there by construction.
 *
 * The outermost two bands are clamped against the ends of the document for the
 * same reason. `flockAt` short-circuits below `spans[0].from` and above
 * `spans[n-1].to`, holding the end attractor; a band that reached past either
 * would still be mid-ramp when that short-circuit took over and would jump to
 * the held value. Contact makes this real rather than theoretical: its section
 * starts a quarter-viewport from the bottom, so the last band would otherwise
 * end past maxScroll and presence would step ~0.13 on the document's final
 * pixel.
 *
 * `BAND` therefore reads as the band's *maximum* half-width. On every gallery
 * seam — the ones this whole change exists for — the spans are long and the
 * clamp does nothing.
 */
export const halfWidthAt = (spans: Span[], i: number): number => {
  const b = boundaryAt(spans, i)
  let w = BAND
  w = Math.min(w, i > 0 ? (b - boundaryAt(spans, i - 1)) / 2 : b - spans[0]!.from)
  w = Math.min(
    w,
    i < spans.length - 2 ? (boundaryAt(spans, i + 1) - b) / 2 : spans[spans.length - 1]!.to - b,
  )
  return w
}

/**
 * Index of the boundary nearest `p`. A linear scan over six seams, once a
 * frame. Returns a number rather than a record deliberately: `flockAt` runs
 * every frame and its contract is that only a point genuinely inside a band
 * allocates.
 */
export const nearestSeamIndex = (spans: Span[], p: number): number => {
  let nearest = 0
  let distance = Infinity
  for (let i = 0; i < spans.length - 1; i++) {
    const d = Math.abs(p - boundaryAt(spans, i))
    if (d < distance) {
      distance = d
      nearest = i
    }
  }
  return nearest
}

/**
 * The gather ramp for one boundary: 1 at the seam, falling to exactly 0 with
 * zero slope at `b ± halfWidthAt(i)`, and 0 beyond.
 *
 * This is 0 for any `p` outside band `i` by its own construction: the
 * `u >= 1` branch below returns 0 whenever `|p - boundaryAt(i)| >= w`,
 * whatever `w` actually is — it needs no help from `halfWidthAt`'s clamping.
 * That is why `seamAt` needs no nearest-boundary check. There is a test
 * pinning that.
 */
export const gatherAt = (spans: Span[], p: number, i: number): number => {
  const w = halfWidthAt(spans, i)
  if (w <= 0) return 0
  const u = Math.abs(p - boundaryAt(spans, i)) / w
  return u >= 1 ? 0 : 1 - smoothstep(u)
}

/**
 * One seam as a signed scalar: -1 at the band's entry edge, 0 exactly at the
 * boundary, +1 at the exit edge, saturated at ±1 across the rest of the
 * document.
 *
 * Signed rather than a bare magnitude because `gather` is symmetric about the
 * boundary, and a consumer on the outgoing side needs to distinguish "not there
 * yet" from "already past" — otherwise the outgoing ring blooms open again as
 * it scrolls away.
 *
 * No nearest-boundary check: `gatherAt` already returns 0 for any `p` with
 * `|p - boundaryAt(seam)| >= halfWidthAt(seam)`, by its own branch — true for
 * any half-width, not something that depends on `halfWidthAt`'s clamping.
 * There is a test pinning that.
 */
export const seamAt = (spans: Span[], p: number, seam: number): number => {
  if (spans.length < 2 || seam < 0 || seam > spans.length - 2) return 1
  const sign = p < boundaryAt(spans, seam) ? -1 : 1
  return sign * (1 - gatherAt(spans, p, seam))
}

/**
 * Where the flock is heading, how tightly, and how much of it is drawn at all.
 *
 * The shape of this is one hump per **seam** rather than one arc per leg.
 * `gather` is `1 - smoothstep(|p - b| / w)` for the nearest boundary `b`: 1 at
 * the seam, falling to exactly 0 at `b ± w` with zero slope, and 0 everywhere
 * else. Since that is monotone in the distance to `b`, taking the nearest
 * boundary and taking the max over all boundaries are the same thing.
 *
 * `presence = max(hold, gather)` is what makes the whole function continuous
 * without a single hand-tuned endpoint: `gather` reaches exactly 0 at both band
 * edges, so presence meets the span's own `hold` there from both sides.
 *
 * Everything a band drives — `target`, `hold`, `settle` — is driven by the same
 * clamped `t`, which saturates at 0 and 1 outside the band. That is why there is
 * no separate "inside a band" branch: outside it, `t` has already clamped to
 * whichever span contains `p`, and the lerps collapse to that span's own values.
 *
 * The returned `target` is read-only: on the fast paths and wherever `t`
 * saturates it is the module-level `ORIGIN` or a caller-owned `ATTRACTORS` entry
 * returned by reference, not a copy. Only a point actually inside a band
 * allocates — which, now that the gallery is gated off, is a small minority of
 * the document. Nothing today mutates `state.target`, but a caller that did
 * would silently corrupt `ATTRACTORS`.
 */
export const flockAt = (spans: Span[], progress: number): FlockState => {
  if (spans.length === 0) return { target: ORIGIN, gather: 0, settle: 0, presence: 0 }

  const first = spans[0]!
  if (spans.length === 1)
    return { target: first.target, gather: 0, settle: 0, presence: first.hold }

  const last = spans[spans.length - 1]!
  const p = clamp01(progress)

  if (p <= first.from) return { target: first.target, gather: 0, settle: 0, presence: first.hold }
  // Past the last span the flock has landed and holds — README §148.
  if (p >= last.to) return { target: last.target, gather: 0, settle: 1, presence: last.hold }

  const nearest = nearestSeamIndex(spans, p)
  const a = spans[nearest]!
  const b = spans[nearest + 1]!
  const w = halfWidthAt(spans, nearest)
  const distance = Math.abs(p - boundaryAt(spans, nearest))

  // w <= 0 is a degenerate zero-width band (no room to ramp): step instead of
  // dividing by zero. Exactly on the boundary (distance 0) still reads as the
  // outgoing span (t=0); anywhere else already belongs to the incoming one
  // (t=1) — a single-pixel jump rather than NaN.
  const t = w > 0 ? clamp01((p - (boundaryAt(spans, nearest) - w)) / (2 * w)) : distance > 0 ? 1 : 0
  const gather = gatherAt(spans, p, nearest)

  const lastBoundary = spans.length - 2
  const settleW = halfWidthAt(spans, lastBoundary)
  const settleFrom = boundaryAt(spans, lastBoundary) - settleW
  const settle = settleW > 0 ? clamp01((p - settleFrom) / (2 * settleW)) : p >= settleFrom ? 1 : 0

  return {
    // Reference, not a copy, wherever the band has saturated — see the docstring.
    target: t <= 0 ? a.target : t >= 1 ? b.target : lerp3(a.target, b.target, t),
    gather,
    settle,
    presence: Math.max(a.hold + (b.hold - a.hold) * t, gather),
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
 * At the settled `RADIUS_WIDE` of 16 (`Butterflies.tsx`), the `gather: 0`
 * dispersal ellipsoid's semi-axes are still far larger than this frame's
 * half-extents — 16 against 6.63 horizontally, and 16 x 0.62 against 4.14
 * vertically — so the frame lies wholly inside it for all seven attractors and
 * samples the core of a much larger cloud. **The placement is therefore not
 * biased toward the attractor**, which is the part of this paragraph that has
 * always been true and is the reason it exists.
 *
 * **What was false here until phase 4, and is worth knowing was false:** it
 * called that residue "near-uniform dust". That was counted at 1,200 instances
 * and never re-measured through two cuts. At the chosen 28 it is not dust and
 * cannot be — the expected count in frame is about **7 at the foot and 8 in
 * about** (Monte Carlo; see `RADIUS_WIDE`'s docstring in `Butterflies.tsx` for
 * the table and the method), which is a handful of legible creatures rather
 * than a dusting. The distribution argument survived the recount; the word
 * describing what it looks like did not.
 *
 * At this radius these coordinates still function mainly as **travel
 * endpoints** — they set the path the dense cloud sweeps along as it crosses a
 * seam, where `gather` is 1 and the target is the midpoint of two adjacent
 * attractors — rather than producing a per-scene placement you could point at.
 * The one place the attractor itself reads is `contact`, whose `[0, -5, 0]`
 * pulls the landed flock low and left, sometimes clipping instances on the
 * bottom edge. That is visible in the comparison Denise chose from, so it is
 * approved rather than merely unnoticed.
 *
 * The four gallery attractors now only ever show themselves at the edges of
 * their own bands: `HOLD` gates the flock to nothing through the core of each
 * gallery scene, so a `gather: 0` residue is something only hero, about and
 * contact still have.
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
 * The flock's presence while a scene is on screen, 0–1.
 *
 * A look decision, not a derived quantity, so it lives in a table beside
 * `ATTRACTORS` where it can be tuned without reading the maths above. The gating
 * this whole module exists for is the four zeros: while a ring or the mural
 * track is parked on a piece, nothing flies over it.
 *
 * Sources: hero idles low-left, entering from the crop's edge (README §109);
 * about is two or three marks crossing the cream (§119); contact is where the
 * flock lands and stops (§148).
 */
export const HOLD: Record<Label, number> = {
  hero: 1,
  about: 0.45,
  g1: 0,
  g2: 0,
  g3: 0,
  g4: 0,
  contact: 1,
}

/**
 * Maximum half-width of a transition band, in whole-document progress — the one
 * number that says how much of the page the migration occupies.
 *
 * At 0.05 a band is 0.10 of the document, or about 1500px of a 15660px page.
 * That comfortably spans the ~900px a released pin takes to scroll away, so the
 * swell covers the whole gap between two gallery scenes and still returns to 0
 * inside each scene's core. Raising it eats into the scenes; lowering it below
 * ~0.031 would open a dead stretch mid-gap where the flock is neither held nor
 * gathered. See `halfWidthAt` for why this is a maximum rather than the width.
 */
export const BAND = 0.05

/**
 * Label bounds in document px -> spans in progress space.
 *
 * Bounds arrive in `LABELS` order and are recomputed on every
 * `ScrollTrigger.refresh()`, so nothing here is cached and the known-good
 * baseline offsets are never embedded (invariant 4).
 *
 * A partial set returns nothing rather than a shortened path: before the first
 * refresh some labels are unregistered, and interpolating across the gap would
 * fly the flock along a route that is wrong rather than merely absent.
 */
export const spansFrom = (
  bounds: ReadonlyArray<LabelBounds | undefined>,
  scrollable: number,
): Span[] => {
  if (scrollable <= 0 || bounds.length !== LABELS.length) return []

  const out: Span[] = []
  for (let i = 0; i < LABELS.length; i++) {
    const bound = bounds[i]
    if (bound === undefined) return []
    const label = LABELS[i]!
    out.push({
      from: clamp01(bound.start / scrollable),
      // Contact's trigger genuinely ends past maxScroll — it is the last section
      // and its 'bottom top' is unreachable — so this clamp is load-bearing.
      to: clamp01(bound.end / scrollable),
      target: ATTRACTORS[label],
      hold: HOLD[label],
    })
  }
  return out
}

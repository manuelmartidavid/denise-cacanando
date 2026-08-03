/**
 * Ring geometry for the Pollen Dial.
 *
 * Pure functions only — no React, no DOM, no GSAP. The scroll timeline supplies
 * a progress and these turn it into a rotation, an index, and the pieces sitting
 * on the orbit. Keeping this separate is what makes the pin-free snap list
 * possible: the list reuses the index model without computing a coordinate.
 *
 * THE MODEL: the ring is N orbit seats plus one centre slot, and the orbit is a
 * WINDOW onto the category — not a seat per piece. The design of record draws
 * eight seats at 45° for a 24-piece category, with the focused piece on a
 * separate centre plate (Ovalese Site - Pollen Dial.dc.html:122-131). The
 * focused piece is NEVER on the orbit.
 *
 * Positioning is CSS, not arithmetic: the ring carries --r and each seat
 * counter-rotates off it, so no coordinate helper is needed here.
 */

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/** Angular gap between neighbouring seats. Artworks 45°, Ovalese/Merch 60°. */
export const seatStep = (seats: number): number => (seats > 0 ? 360 / seats : 0)

/**
 * Ring rotation in degrees at scroll progress p. One seat-step per piece, so a
 * 24-piece scene turns 1035° (2.9 turns) and a 7-piece scene turns exactly once.
 */
export const rotationAtProgress = (p: number, count: number, seats: number): number =>
  p * Math.max(0, count - 1) * seatStep(seats)

/** Focused piece at progress p. Piece 0 at p=0, piece n-1 at p=1. */
export const indexAtProgress = (p: number, count: number): number =>
  count <= 0 ? 0 : clamp(Math.round(p * (count - 1)), 0, count - 1)

/** The progress at which `index` is focused — the snap stops. */
export const progressAtIndex = (index: number, count: number): number =>
  count > 1 ? clamp(index, 0, count - 1) / (count - 1) : 0

/** Nearest snap stop. Idempotent, so re-running a settled snap is a no-op. */
export const snapProgress = (p: number, count: number): number =>
  progressAtIndex(indexAtProgress(p, count), count)

/**
 * Seats actually on the orbit, which is not always the number a scene declares.
 * The centre holds one piece, so the orbit is capped at count - 1: a merch ring
 * filtered down to a single earring must not repeat that piece around the orbit.
 *
 * The seat spacing and the ring's rotation both read this rather than the
 * declared count, and they have to agree. Stepping a jackets-filtered ring by
 * the declared 60° leaves its four thumbs spanning 240° of an otherwise empty
 * circle; stepping it by 360/4 spreads them evenly, and the rotation has to
 * advance by that same step or the ring visibly under-turns per piece.
 */
export const orbitSeats = (seats: number, count: number): number =>
  Math.min(Math.max(0, seats), Math.max(0, count - 1))

/** Piece indices occupying the orbit seats, forward from the focus. */
export const seatContent = (activeIndex: number, seats: number, count: number): number[] =>
  Array.from({ length: orbitSeats(seats, count) }, (_, i) => (activeIndex + 1 + i) % count)

/**
 * Radius, in the ring wrapper's own untransformed px, that contains everything
 * drawn inside it at rest — the outer guide circle and the thumbs at the far
 * edge of the orbit, whichever reaches further.
 *
 * `Dial` clips to this so a collapsing ring stops hit-testing rather than
 * merely becoming very small. The wrapper has no intrinsic size (every child is
 * absolutely positioned and centred on it), so a percentage radius would
 * resolve against a 0x0 box and clip everything away — it has to be px.
 *
 * **The thumb term is the half-DIAGONAL, and that is the whole point of this
 * function.** A thumb counter-rotates to stay upright, so it is an axis-aligned
 * rectangle centred on the orbit, and its farthest point from the ring centre is
 * a *corner*: `orbit + hypot(w, h) / 2`, reached when that corner lines up
 * radially. Sizing it with `max(w, h) / 2` measures to an edge midpoint instead
 * and cut ~31px off the outer corner of every diagonal Merchandise thumb —
 * Merchandise being the one category whose thumbs are square, and therefore the
 * only one where the loss was visible at all. The bound is exact for a square
 * and merely generous for a rounded one, which costs nothing.
 *
 * `CLIP_MARGIN` is why the thumb term is not left as that bare supremum. Being
 * the exact supremum means a corner can sit *precisely* on the boundary, and one
 * does: Artworks has 8 seats, so a thumb lands at exactly 45deg and measured
 * 0.00px of clearance in a browser. That is invisible only because those thumbs
 * are round and nothing is painted in the corner — a square slot there would
 * ride a subpixel edge with nothing in hand. The margin is free: it applies at
 * rest and scales away with everything else as the ring collapses.
 */
const CLIP_MARGIN = 2

export const ringClipRadius = (
  guide: number,
  orbit: number,
  thumbW: number,
  thumbH: number,
): number => Math.max(guide / 2, orbit + Math.hypot(thumbW, thumbH) / 2) + CLIP_MARGIN

/** 0–1 across the category, for the `07 / 24` progress row and its track dot. */
export const trackProgress = (index: number, count: number): number =>
  count > 1 ? index / (count - 1) : 0

import { aspectOf, type Piece } from '~/data'

/**
 * Pure geometry for the Artworks floating field.
 *
 * No React, no DOM, no GSAP. The scroll timeline supplies a fractional piece
 * index — `fractionalIndexAt`, the same scalar a dial's rotation is derived
 * from — and this turns it into a fixed scatter plus the two numbers the strip
 * pans between.
 *
 * THE MODEL: the field is a wide strip holding every piece at a fixed position.
 * Scrolling pans the strip horizontally, off that one fractional index, but
 * the placement is a 2D scatter rather than a row, which is what stops the
 * field reading as just another ring.
 *
 * DETERMINISM IS A REQUIREMENT. Placement looks random and is not: every value
 * comes from `hash(index, salt)`. `Math.random()` would reshuffle the gallery on
 * every mount — including the remount when a visitor returns from a detail
 * route — so the piece they just clicked would be somewhere else when they came
 * back. The same seed also makes the layout testable.
 */

/** The frame the constants below were tuned against. */
const BASE_W = 1440
const BASE_H = 900

const BASE_PITCH = 340
const BASE_AREA = 315 * 315

/**
 * Vertical lanes, cycled by index. Consecutive pieces land in different bands,
 * which is what stops a plain jitter from stacking two neighbours — the failure
 * a single random y falls into roughly a third of the time at this pitch.
 */
const LANES = [-158, 52, -64, 148]

const Y_JITTER = 26
const X_JITTER = 60

/** Nearer pieces are larger, and drift slightly faster. */
const DEPTH_MIN = 0.62
const DEPTH_MAX = 1.32

/**
 * How much of the depth difference reaches the pan.
 *
 * Deliberately small. Parallax proportional to the FULL pan distance grows with
 * the length of the scene: at k = 0.25 across 24 pieces the extreme-depth pieces
 * end up ~600px away from where the uniform pan puts them, which tears the strip
 * apart at the far end and reopens the whitespace this module works to close.
 * At 0.06 the worst piece deviates by about 145px, which `panBounds` can absorb
 * exactly rather than approximately.
 */
const PARALLAX_K = 0.06

const YAW_MAX = 18
const ROLL_MAX = 3

/** Clear space left at the strip's two ends when fully panned. */
const EDGE_INSET = 44

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/**
 * Deterministic value in [0, 1) from an index and a salt.
 *
 * A hash rather than a seeded sequence, so each property is independent of how
 * many came before it: adding a new one later cannot shift every existing piece,
 * which a shared PRNG cursor would.
 */
const hash = (index: number, salt: number): number => {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const signed = (index: number, salt: number): number => hash(index, salt) * 2 - 1

export type FieldMetrics = {
  /** Horizontal advance per piece. */
  pitch: number
  /** Area each piece is scaled to occupy, px². */
  area: number
  /** Multiplier on the vertical lanes. */
  laneScale: number
}

/**
 * Metrics for a viewport.
 *
 * Gaps are responsive because a pitch fixed in px is a different composition on
 * every screen: 340 puts six pieces in a 1440 frame and four in a 1024 one,
 * which is the sparse, gappy version of this scene. Scaling the pitch with width
 * keeps roughly the same number of pieces in view at any size.
 *
 * Area follows the SMALLER of the two viewport ratios, because a piece has to
 * fit vertically as well: scaling it off width alone puts a tall portrait
 * through the floor of a short window.
 */
export const metricsFor = (viewportW: number, viewportH: number): FieldMetrics => {
  const scale = clamp(Math.min(viewportW / BASE_W, viewportH / BASE_H), 0.7, 1.3)
  return {
    pitch: clamp((viewportW / BASE_W) * BASE_PITCH, 250, 430),
    // Area is two-dimensional, so it takes the square of a linear scale.
    area: BASE_AREA * scale * scale,
    laneScale: clamp(viewportH / BASE_H, 0.7, 1.25),
  }
}

export type FieldPiece = {
  piece: Piece
  index: number
  /** Strip coordinates, px, measured from the strip's origin. */
  x: number
  /** Offset from the section's vertical centre, px. */
  y: number
  width: number
  height: number
  /** 0.62–1.32. Larger reads nearer. */
  depth: number
  /** Multiplier applied to the pan. 1 at depth 1. */
  parallax: number
  yaw: number
  roll: number
}

/**
 * Size a piece to the shared area at its own aspect.
 *
 * An unparseable size falls back to square rather than throwing — the field must
 * degrade to a plate, never to a crash, and merch-style sizes reach this the
 * moment anyone points the field at another category.
 */
export const sizeFor = (aspect: number | null, area: number = BASE_AREA) => {
  const a = aspect !== null && Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const height = Math.sqrt(area / a)
  return { width: height * a, height }
}

export const layoutField = (
  pieces: Piece[],
  metrics: FieldMetrics = metricsFor(BASE_W, BASE_H),
): FieldPiece[] =>
  pieces.map((piece, index) => {
    const depth = DEPTH_MIN + hash(index, 1) * (DEPTH_MAX - DEPTH_MIN)
    const base = sizeFor(aspectOf(piece.size), metrics.area)
    return {
      piece,
      index,
      x: index * metrics.pitch + signed(index, 2) * X_JITTER,
      y: (LANES[index % LANES.length]! + signed(index, 3) * Y_JITTER) * metrics.laneScale,
      width: base.width * depth,
      height: base.height * depth,
      depth,
      parallax: 1 + (depth - 1) * PARALLAX_K,
      yaw: signed(index, 4) * YAW_MAX,
      roll: signed(index, 5) * ROLL_MAX,
    }
  })

export type PanBounds = {
  /** Strip translation at `at = 0`. */
  start: number
  /** Added per unit of `at`. */
  step: number
}

/**
 * The two numbers the strip pans between.
 *
 * The naive mapping centres the focused piece, which means at either end half
 * the frame is empty paper — the first piece sits mid-screen with nothing to its
 * left, and the last with nothing to its right. Instead the pan is solved so the
 * leftmost piece starts just inside the left edge and the rightmost finishes just
 * inside the right one. The field fills the frame throughout.
 *
 * Each piece constrains the answer through its own `parallax`, so the bounds are
 * a min/max over the whole set rather than a formula on the extremes: whichever
 * piece binds, binds. That is what makes the inset exact rather than a guess
 * with margin thrown at it.
 */
export const panBounds = (laid: FieldPiece[], viewportW: number): PanBounds => {
  if (laid.length === 0) return { start: 0, step: 0 }

  // start·parallax ≥ INSET − left  for every piece.
  const start = Math.max(
    ...laid.map((i) => (EDGE_INSET - (i.x - i.width / 2)) / i.parallax),
  )
  if (laid.length === 1) return { start, step: 0 }

  // end·parallax ≤ (W − INSET) − right  for every piece.
  const end = Math.min(
    ...laid.map((i) => (viewportW - EDGE_INSET - (i.x + i.width / 2)) / i.parallax),
  )
  // Never pan backwards: a strip narrower than the viewport simply holds still.
  return { start, step: Math.min(0, end - start) / (laid.length - 1) }
}

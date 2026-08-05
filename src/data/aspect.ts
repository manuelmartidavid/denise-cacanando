/**
 * Piece aspect, read off the `size` string.
 *
 * The dimensions are the only place the real shape of a work is recorded, so
 * the layout reads them rather than carrying a second hand-maintained field
 * that could disagree with them. `91 × 122 cm` is portrait, `132 × 102 cm` is
 * landscape, `13.8 × 4 m` is a very wide wall. Merch sizes like
 * `One of one — M` carry no dimensions at all and return null — a legitimate
 * answer, not a failure; callers fall back to their category's fixed slot.
 *
 * Unit is deliberately ignored. An aspect is a ratio, and no comparison ever
 * crosses units because each category is measured in one throughout.
 */

export type Orientation = 'portrait' | 'landscape' | 'square'

/** Anything closer to square than this reads as square rather than as a lean. */
const SQUARE_TOLERANCE = 0.04

/**
 * `W × H` with either the multiplication sign or a plain `x`, decimals allowed
 * either side. Unanchored, so `15.5 × 21 cm` and `38 × 42 cm` both parse and a
 * string carrying no pair returns null.
 */
const DIMENSIONS = /(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/

/** Width ÷ height, or null when the size string carries no dimensions. */
export const aspectOf = (size: string): number | null => {
  const match = DIMENSIONS.exec(size)
  if (!match) return null
  const w = Number(match[1])
  const h = Number(match[2])
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null
  return w / h
}

export const orientationOf = (size: string): Orientation | null => {
  const aspect = aspectOf(size)
  if (aspect === null) return null
  if (Math.abs(aspect - 1) <= SQUARE_TOLERANCE) return 'square'
  return aspect > 1 ? 'landscape' : 'portrait'
}

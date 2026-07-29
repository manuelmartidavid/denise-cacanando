/**
 * Ring geometry for the Pollen Dial.
 *
 * Pure functions only — no React, no DOM, no GSAP. The scroll timeline supplies
 * a rotation in degrees and these turn it into positions and indices. Keeping
 * this separate is what makes the reduced-motion snap-list fallback possible:
 * the list reuses `indexAtFocus` without ever computing a coordinate.
 *
 * Convention: degrees, clockwise, and FOCUS_ANGLE is the seat on the orbit
 * where a thumb counts as focused. -90° is twelve o'clock in screen space
 * (y grows downward).
 */

export const FOCUS_ANGLE = -90

const rad = (deg: number) => (deg * Math.PI) / 180

/** Angular gap between neighbouring thumbs. */
export const step = (count: number): number => (count > 0 ? 360 / count : 0)

/**
 * Where thumb `index` sits, given the ring's current rotation.
 * At rotation = index * step, that thumb lands exactly on FOCUS_ANGLE.
 */
export const thumbAngle = (index: number, count: number, rotation: number): number =>
  FOCUS_ANGLE + index * step(count) - rotation

/** Cartesian offset from the ring centre, in px. */
export const polar = (angle: number, radius: number): { x: number; y: number } => ({
  x: Math.cos(rad(angle)) * radius,
  y: Math.sin(rad(angle)) * radius,
})

/** Position of thumb `index` relative to the ring centre. */
export const thumbPosition = (
  index: number,
  count: number,
  rotation: number,
  radius: number,
): { x: number; y: number } => polar(thumbAngle(index, count, rotation), radius)

/**
 * Thumbs counter-rotate by −rotation so crops stay upright as the ring turns.
 * A thumb's own transform is translate(position) then rotate(this).
 */
export const counterRotation = (rotation: number): number => -rotation

/** Normalises any angle into [0, 360). */
export const normalize = (deg: number): number => ((deg % 360) + 360) % 360

/**
 * Signed shortest path from one angle to another, in (-180, 180].
 * Used when a clicked thumb rotates to centre — it must take the short way
 * round, not spin most of a turn to get somewhere adjacent.
 */
export const shortestDelta = (from: number, to: number): number => {
  const d = normalize(to - from)
  return d > 180 ? d - 360 : d
}

/** Rotation that seats `index` at the focus position. */
export const rotationForIndex = (index: number, count: number): number => index * step(count)

/** Which thumb is nearest the focus seat at this rotation. Always in [0, count). */
export const indexAtFocus = (rotation: number, count: number): number => {
  if (count <= 0) return 0
  const s = step(count)
  return ((Math.round(rotation / s) % count) + count) % count
}

/** Rotation snapped to the nearest whole thumb — the `snap: 1/n` target. */
export const snapRotation = (rotation: number, count: number): number =>
  Math.round(rotation / step(count)) * step(count)

/**
 * Scroll progress (0–1) → rotation. One full turn per scene by default, so the
 * last piece arrives exactly as the pin releases.
 */
export const progressToRotation = (progress: number, count: number, turns = 1): number =>
  progress * 360 * turns * (count > 0 ? 1 : 0)

/**
 * The thumbs worth rendering. Artworks shows 8 of 24 at once; anything further
 * round the orbit is off-frame, so we cull instead of mounting 24 nodes.
 * Returns indices ordered by distance from focus, nearest first.
 */
export const visibleThumbs = (count: number, rotation: number, max: number): number[] => {
  if (count <= 0) return []
  if (count <= max) return Array.from({ length: count }, (_, i) => i)

  const focus = indexAtFocus(rotation, count)
  const out: number[] = [focus]
  for (let offset = 1; out.length < max; offset++) {
    out.push((focus + offset) % count)
    if (out.length < max) out.push(((focus - offset) % count + count) % count)
  }
  return out
}

/** 0–1 across the category, for the `07 / 24` progress row and its track dot. */
export const trackProgress = (index: number, count: number): number =>
  count > 1 ? index / (count - 1) : 0

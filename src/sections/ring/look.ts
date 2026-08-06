import type { CategoryId } from '~/data'

export type RingLook = {
  /** Centre-plate and thumb silhouette. */
  slot: 'circle' | 'ovoid' | 'square'
  slotW: number
  slotH: number
  thumbW: number
  thumbH: number
}

/**
 * Slot and thumb geometry per category — README "Spacing & geometry".
 *
 * Murals is landscape on purpose: the walls are wide, and an upright crop
 * would misrepresent them. The values are Marti's (ruled 2026-08-06) and are
 * browser-tunable by him only. Artworks is zeroed: it is the floating field
 * (`sections/field`), not a ring — the entry stays so the record is total
 * over CategoryId, not because anything reads it.
 */
export const RING_LOOK: Record<CategoryId, RingLook> = {
  artworks: { slot: 'square', slotW: 0, slotH: 0, thumbW: 0, thumbH: 0 }, // field scene, unused
  ovalese: { slot: 'ovoid', slotW: 248, slotH: 312, thumbW: 98, thumbH: 124 },
  merch: { slot: 'square', slotW: 250, slotH: 250, thumbW: 150, thumbH: 150 },
  murals: { slot: 'square', slotW: 340, slotH: 227, thumbW: 150, thumbH: 100 },
}

export const SHAPE_CLASS: Record<RingLook['slot'], string> = {
  circle: 'rounded-full',
  ovoid: 'ovoid',
  square: '',
}

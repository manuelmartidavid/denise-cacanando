import type { CategoryId } from '~/data'

export type RingLook = {
  /** Centre-plate silhouette. */
  slot: 'circle' | 'ovoid' | 'square'
  slotW: number
  slotH: number
  thumbW: number
  thumbH: number
}

/** Slot and thumb geometry per category — README "Spacing & geometry". */
export const RING_LOOK: Record<CategoryId, RingLook> = {
  artworks: { slot: 'circle', slotW: 280, slotH: 280, thumbW: 112, thumbH: 112 },
  ovalese: { slot: 'ovoid', slotW: 248, slotH: 312, thumbW: 98, thumbH: 124 },
  merch: { slot: 'square', slotW: 250, slotH: 250, thumbW: 150, thumbH: 150 },
  murals: { slot: 'square', slotW: 0, slotH: 0, thumbW: 0, thumbH: 0 }, // track scene, unused
}

export const SHAPE_CLASS: Record<RingLook['slot'], string> = {
  circle: 'rounded-full',
  ovoid: 'ovoid',
  square: '',
}

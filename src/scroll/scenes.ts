import { categories } from '~/data'
import type { CategoryId, MerchKind, Piece } from '~/data'
import { getScrollState } from './store'

/** The seven labels on the master timeline, in scroll order. */
export const LABELS = ['hero', 'about', 'g1', 'g2', 'g3', 'g4', 'contact'] as const
export type Label = (typeof LABELS)[number]

/** The four rail diamonds. Gallery is one rail stop covering g1–g4. */
export const RAIL_STOPS = [
  { n: '01', label: 'Hero', target: 'hero' },
  { n: '02', label: 'About', target: 'about' },
  { n: '03', label: 'Gallery', target: 'g1' },
  { n: '04', label: 'Contact', target: 'contact' },
] as const satisfies ReadonlyArray<{ n: string; label: string; target: Label }>

/** Index of the Gallery diamond in RAIL_STOPS — the fallback for g2–g4. */
const GALLERY_STOP = 2

/**
 * Which rail stop a label lights. The four gallery scenes share one diamond, so
 * g2–g4 are not themselves rail targets and fall through to the Gallery stop.
 *
 * Lives here rather than in the rail because two presentations consume it — the
 * desktop side rail and the mobile bottom ticker — and a second copy would be a
 * second thing to keep in step with RAIL_STOPS.
 */
export const stopIndexFor = (label: Label): number => {
  const direct = RAIL_STOPS.findIndex((stop) => stop.target === label)
  return direct >= 0 ? direct : GALLERY_STOP
}

/** How a scene declares itself. What actually renders may fall back — see scroll/presentation.ts. */
export type Presentation = 'dial' | 'track'

export type GalleryLabel = Extract<Label, 'g1' | 'g2' | 'g3' | 'g4'>

export type GalleryScene = {
  label: GalleryLabel
  category: CategoryId
  /** `dial` rotates and pins; `track` unrolls into an x-translate. Murals break pattern. */
  presentation: Presentation
  /** Orbit seats — NOT the piece count. The orbit is a window onto the category. */
  seats: number
  /** Pin length in vh. Proportional to piece count — see README timeline spec. */
  length: number
  /** Ground colour. Merchandise flips to cream so product reads as product. */
  ground: 'dark' | 'cream'
  /** Outer guide circle, px. 0 in `track` mode. */
  guide: number
  /** Thumb orbit radius, px. 0 in `track` mode. */
  orbit: number
}

export const GALLERY_SCENES: GalleryScene[] = [
  { label: 'g1', category: 'artworks', presentation: 'dial', seats: 8, length: 320, ground: 'dark', guide: 660, orbit: 326 },
  { label: 'g2', category: 'ovalese', presentation: 'dial', seats: 6, length: 220, ground: 'dark', guide: 640, orbit: 326 },
  { label: 'g3', category: 'murals', presentation: 'track', seats: 0, length: 240, ground: 'dark', guide: 0, orbit: 0 },
  { label: 'g4', category: 'merch', presentation: 'dial', seats: 6, length: 260, ground: 'cream', guide: 600, orbit: 296 },
]

export const sceneByLabel = (label: Label): GalleryScene | undefined =>
  GALLERY_SCENES.find((s) => s.label === label)

/** Piece count for a scene, read from the data — never hardcoded. */
export const sceneCount = (scene: GalleryScene): number =>
  categories.find((c) => c.id === scene.category)?.pieces.length ?? 0

/**
 * The pieces in play for a scene under a given filter — pure, so the whole
 * filtering rule can be tested without touching the live store.
 *
 * Selecting a merch chip re-blooms a smaller ring, so this is not a constant,
 * and every index in the ring addresses THIS list. Returning the filtered
 * pieces rather than slicing the full category is what keeps a filtered ring
 * showing five jackets instead of the first five products.
 */
export const piecesFor = (scene: GalleryScene, filter: MerchKind | null): Piece[] => {
  const pieces = categories.find((c) => c.id === scene.category)?.pieces ?? []
  if (scene.category !== 'merch') return pieces
  return filter ? pieces.filter((p) => p.kind === filter) : pieces
}

/**
 * The same, reading the live filter. The impurity is deliberately confined to
 * this one line: `piecesFor` above is a pure function of its arguments and is
 * what the tests exercise, so they never have to mutate module-global state and
 * cannot leak a filter into each other.
 */
export const activePieces = (scene: GalleryScene): Piece[] =>
  piecesFor(scene, getScrollState().merchFilter)

/** How many pieces are in play. The timeline's rotation mapping reads this. */
export const activeCount = (scene: GalleryScene): number => activePieces(scene).length

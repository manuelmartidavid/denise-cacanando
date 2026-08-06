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
export type Presentation = 'dial' | 'field'

export type GalleryLabel = Extract<Label, 'g1' | 'g2' | 'g3' | 'g4'>

export type GalleryScene = {
  label: GalleryLabel
  category: CategoryId
  /**
   * `dial` rotates and pins, `field` pans a 2D scatter. Three of the four
   * scenes are dials again — what varies the middle pair now is the seed
   * choreography (Ovalese collapses to the seed, Murals blooms from it), and
   * the Artworks field breaks the repetition at the top of the run.
   */
  presentation: Presentation
  /** Orbit seats — NOT the piece count. The orbit is a window onto the category. */
  seats: number
  /** Pin length in vh. Proportional to piece count — see README timeline spec. */
  length: number
  /** Ground colour. Merchandise flips to cream so product reads as product. */
  ground: 'dark' | 'cream'
  /** Outer guide circle, px. 0 in `field` mode. */
  guide: number
  /** Dashed inner guide circle, px. 0 in `field` mode. */
  dash: number
  /** Thumb orbit radius, px. 0 in `field` mode. */
  orbit: number
}

/**
 * Artworks carries no ring geometry: seats, guides and orbit are 0 because the
 * field has none of them. Its placement lives in `lib/field.ts`, which is pure
 * and tested there.
 *
 * It is also the second cream ground. That breaks the dark/cream alternation
 * the four scenes used to have — Marti's call, and the right one: the paintings
 * are the thing being looked at, and on paper they read as objects rather than
 * as slides on black.
 */
export const GALLERY_SCENES: GalleryScene[] = [
  { label: 'g1', category: 'artworks', presentation: 'field', seats: 0, length: 320, ground: 'cream', guide: 0, dash: 0, orbit: 0 },
  { label: 'g2', category: 'ovalese', presentation: 'dial', seats: 6, length: 220, ground: 'dark', guide: 640, dash: 460, orbit: 326 },
  { label: 'g3', category: 'murals', presentation: 'dial', seats: 6, length: 220, ground: 'dark', guide: 640, dash: 460, orbit: 326 },
  { label: 'g4', category: 'merch', presentation: 'dial', seats: 6, length: 260, ground: 'cream', guide: 600, dash: 460, orbit: 296 },
]

export const sceneByLabel = (label: Label): GalleryScene | undefined =>
  GALLERY_SCENES.find((s) => s.label === label)

export type Tone = 'dark' | 'cream'

/**
 * Ground tone per label. Gallery scenes declare theirs (`scene.ground`); the
 * three fixed sections are declared here. This is the single source both
 * `GroundLayer` and the parallax boundary intensities read — the two must
 * never disagree about what colour a boundary joins.
 */
export const toneFor = (label: Label): Tone => {
  const scene = sceneByLabel(label)
  if (scene) return scene.ground
  return label === 'about' ? 'cream' : 'dark'
}

/**
 * The timeline label a category lives at, for the category list's jump links.
 *
 * Derived rather than declared: a second table mapping `artworks → g1` would be
 * one more thing to keep in step with GALLERY_SCENES, and the two disagreeing
 * would send a visitor to the wrong scene.
 */
export const labelForCategory = (category: CategoryId): GalleryLabel | undefined =>
  GALLERY_SCENES.find((s) => s.category === category)?.label

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

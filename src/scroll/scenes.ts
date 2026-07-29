import { categories } from '~/data'
import type { CategoryId } from '~/data'

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

export type GalleryScene = {
  label: Extract<Label, 'g1' | 'g2' | 'g3' | 'g4'>
  category: CategoryId
  /** Pin length in vh. Proportional to piece count — see README timeline spec. */
  length: number
  /** `ring` rotates; `track` unrolls into an x-translate. Murals break pattern. */
  mode: 'ring' | 'track'
  /** Ground colour. Merchandise flips to cream so product reads as product. */
  ground: 'dark' | 'cream'
  /** Outer guide circle, px. Unused in `track` mode. */
  guide: number
  /** Thumb orbit radius, px. Unused in `track` mode. */
  orbit: number
  /** How many thumbs are mounted at once. */
  visible: number
}

export const GALLERY_SCENES: GalleryScene[] = [
  {
    label: 'g1',
    category: 'artworks',
    length: 320,
    mode: 'ring',
    ground: 'dark',
    guide: 660,
    orbit: 326,
    visible: 8,
  },
  {
    label: 'g2',
    category: 'ovalese',
    length: 220,
    mode: 'ring',
    ground: 'dark',
    guide: 640,
    orbit: 326,
    visible: 6,
  },
  {
    label: 'g3',
    category: 'murals',
    length: 240,
    mode: 'track',
    ground: 'dark',
    guide: 0,
    orbit: 0,
    visible: 3,
  },
  {
    label: 'g4',
    category: 'merch',
    length: 260,
    mode: 'ring',
    ground: 'cream',
    guide: 600,
    orbit: 296,
    visible: 6,
  },
]

export const sceneByLabel = (label: Label): GalleryScene | undefined =>
  GALLERY_SCENES.find((s) => s.label === label)

/** Piece count for a scene, read from the data — never hardcoded. */
export const sceneCount = (scene: GalleryScene): number =>
  categories.find((c) => c.id === scene.category)?.pieces.length ?? 0

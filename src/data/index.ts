import { artworks } from './artworks'
import { ovalese } from './ovalese'
import { murals } from './murals'
import { merch } from './merch'
import type { Category, CategoryId, Piece } from './types'

export * from './types'
export * from './aspect'
export { artworks, ovalese, murals, merch }

/**
 * Scene order matches the scroll timeline: g1 · g2 · g3 · g4.
 * Views read `pieces.length` from here — counts are never hardcoded in a view.
 */
export const categories: Category[] = [
  {
    id: 'artworks',
    path: 'artworks',
    label: 'Artworks',
    sceneLabel: 'Scene 01 — Artworks',
    pieces: artworks,
  },
  {
    id: 'ovalese',
    path: 'ovalese',
    label: 'Ovalese',
    sceneLabel: 'Scene 02 — Ovalese',
    pieces: ovalese,
  },
  {
    id: 'murals',
    path: 'murals',
    label: 'Murals',
    sceneLabel: 'Scene 03 — Murals',
    pieces: murals,
  },
  {
    id: 'merch',
    path: 'merchandise',
    label: 'Merchandise',
    sceneLabel: 'Scene 04 — Merchandise',
    pieces: merch,
  },
]

export const categoryById = (id: CategoryId): Category | undefined =>
  categories.find((c) => c.id === id)

/** Resolves the `:category` URL segment (`merchandise` → the `merch` record). */
export const categoryByPath = (path: string): Category | undefined =>
  categories.find((c) => c.path === path)

export type Resolved = {
  category: Category
  piece: Piece
  index: number
  prev: Piece | null
  next: Piece | null
}

/**
 * Resolves `/:category/:slug` to a record plus its neighbours.
 * prev/next are index ± 1 within the category — they do not wrap, so the ends
 * of a category read as ends rather than looping the visitor silently.
 */
export const resolvePiece = (
  categoryPath: string | undefined,
  slug: string | undefined,
): Resolved | null => {
  if (!categoryPath || !slug) return null
  const category = categoryByPath(categoryPath)
  if (!category) return null

  const index = category.pieces.findIndex((p) => p.slug === slug)
  if (index === -1) return null

  return {
    category,
    piece: category.pieces[index]!,
    index,
    prev: category.pieces[index - 1] ?? null,
    next: category.pieces[index + 1] ?? null,
  }
}

/** Total across every category — 50 pieces. */
export const totalPieces = categories.reduce((n, c) => n + c.pieces.length, 0)

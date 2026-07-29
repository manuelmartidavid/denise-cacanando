export type Status = 'available' | 'sold' | 'commission' | 'showcase'

export type ImageRole = 'primary' | 'detail' | 'context' | 'angle'

export type MerchKind = 'jackets' | 'bags' | 'shirts' | 'earrings'

export type MuralLocation = 'bgc' | 'layaw'

export type PieceImage = {
  src: string
  alt: string
  role: ImageRole
}

export type Piece = {
  slug: string
  title: string
  medium: string
  size: string
  year: number
  status: Status
  images: PieceImage[]
  /** Denise's copy. COPY SLOT — absent until she writes it. */
  body?: string
  /** merch only */
  kind?: MerchKind
  /** murals only */
  location?: MuralLocation
}

export type CategoryId = 'artworks' | 'ovalese' | 'murals' | 'merch'

export type Category = {
  id: CategoryId
  /** URL segment. `merch` is `/merchandise/:slug` in the address bar. */
  path: string
  /** Display name in the scene title block. */
  label: string
  /** Scene label above the title, e.g. `SCENE 01 — ARTWORKS`. */
  sceneLabel: string
  pieces: Piece[]
}

/**
 * No imagery has been delivered. Every `src` below points here so the
 * placeholder renderer can key off it and draw the striped plate with its
 * mono label. Delete this once real files land in /public/img.
 */
export const PLACEHOLDER = '__placeholder__'

export const ph = (alt: string, role: ImageRole = 'primary'): PieceImage => ({
  src: PLACEHOLDER,
  alt,
  role,
})

import { ph, type Piece, type PieceImage } from './types'

/** 8 shots per egg → one 2K map. Loaded on demand, Ovalese leaf only. */
const angles = (title: string): PieceImage[] =>
  Array.from({ length: 8 }, (_, i) =>
    ph(`${title} — angle ${String(i + 1).padStart(2, '0')} of 08`, 'angle'),
  )

/**
 * 7 painted ostrich eggs — count confirmed by the client.
 * Titles, media, dimensions and years are INVENTED PLACEHOLDERS.
 */
export const ovalese: Piece[] = [
  {
    slug: 'first-shell',
    title: 'First Shell',
    medium: 'Acrylic on ostrich eggshell',
    size: '15 × 21 cm',
    year: 2025,
    status: 'available',
    images: [ph('First Shell — primary crop for the ring'), ...angles('First Shell')],
  },
  {
    slug: 'monarch-vessel',
    title: 'Monarch Vessel',
    medium: 'Acrylic and gold leaf on ostrich eggshell',
    size: '15 × 21 cm',
    year: 2025,
    status: 'available',
    images: [ph('Monarch Vessel — primary crop for the ring'), ...angles('Monarch Vessel')],
  },
  {
    slug: 'sampaguita-shell',
    title: 'Sampaguita Shell',
    medium: 'Acrylic on ostrich eggshell',
    size: '15 × 21 cm',
    year: 2024,
    status: 'sold',
    images: [ph('Sampaguita Shell — primary crop for the ring'), ...angles('Sampaguita Shell')],
  },
  {
    slug: 'dusk-ovoid',
    title: 'Dusk Ovoid',
    medium: 'Acrylic and ink on ostrich eggshell',
    size: '15 × 21 cm',
    year: 2024,
    status: 'sold',
    images: [ph('Dusk Ovoid — primary crop for the ring'), ...angles('Dusk Ovoid')],
  },
  {
    slug: 'pollen-egg',
    title: 'Pollen Egg',
    medium: 'Acrylic on ostrich eggshell',
    size: '15 × 21 cm',
    year: 2024,
    status: 'commission',
    images: [ph('Pollen Egg — primary crop for the ring'), ...angles('Pollen Egg')],
  },
  {
    slug: 'the-nesting-hour',
    title: 'The Nesting Hour',
    medium: 'Acrylic and pastel on ostrich eggshell',
    size: '15 × 21 cm',
    year: 2023,
    status: 'sold',
    images: [ph('The Nesting Hour — primary crop for the ring'), ...angles('The Nesting Hour')],
  },
  {
    slug: 'wingcase',
    title: 'Wingcase',
    medium: 'Acrylic on ostrich eggshell',
    size: '15 × 21 cm',
    year: 2023,
    status: 'available',
    images: [ph('Wingcase — primary crop for the ring'), ...angles('Wingcase')],
  },
]

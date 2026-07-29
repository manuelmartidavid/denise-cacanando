import { ph, type Piece } from './types'

/**
 * 7 walls — count confirmed: BGC 4, Layaw Makati 3.
 * Names, dimensions and years are INVENTED PLACEHOLDERS.
 *
 * Every wall is a DOSSIER, never a faked panorama: one context shot at the
 * widest angle available, plus two detail crops. Two detail crops per wall is
 * the minimum the layout accepts — see "Mural reshoot list" in README.md.
 */
export const murals: Piece[] = [
  {
    slug: 'bonifacio-garden',
    title: 'Bonifacio Garden',
    medium: 'Acrylic on concrete',
    size: '14 × 4 m',
    year: 2025,
    status: 'showcase',
    location: 'bgc',
    images: [
      ph('Bonifacio Garden — context shot, widest angle available', 'context'),
      ph('Bonifacio Garden — detail crop 01', 'detail'),
      ph('Bonifacio Garden — detail crop 02', 'detail'),
    ],
  },
  {
    slug: 'high-street-butterflies',
    title: 'High Street Butterflies',
    medium: 'Acrylic on concrete',
    size: '9 × 3.5 m',
    year: 2025,
    status: 'showcase',
    location: 'bgc',
    images: [
      ph('High Street Butterflies — context shot, widest angle available', 'context'),
      ph('High Street Butterflies — detail crop 01', 'detail'),
      ph('High Street Butterflies — detail crop 02', 'detail'),
    ],
  },
  {
    slug: 'the-underpass',
    title: 'The Underpass',
    medium: 'Acrylic and spray on concrete',
    size: '22 × 3 m',
    year: 2024,
    status: 'showcase',
    location: 'bgc',
    images: [
      ph('The Underpass — context shot, widest angle available', 'context'),
      ph('The Underpass — detail crop 01', 'detail'),
      ph('The Underpass — detail crop 02', 'detail'),
    ],
  },
  {
    slug: 'courtyard-wall',
    title: 'Courtyard Wall',
    medium: 'Acrylic on plaster',
    size: '11 × 5 m',
    year: 2024,
    status: 'showcase',
    location: 'bgc',
    images: [
      ph('Courtyard Wall — context shot, widest angle available', 'context'),
      ph('Courtyard Wall — detail crop 01', 'detail'),
      ph('Courtyard Wall — detail crop 02', 'detail'),
    ],
  },
  {
    slug: 'layaw-facade',
    title: 'Layaw Facade',
    medium: 'Acrylic on concrete',
    size: '16 × 6 m',
    year: 2024,
    status: 'showcase',
    location: 'layaw',
    images: [
      ph('Layaw Facade — context shot, widest angle available', 'context'),
      ph('Layaw Facade — detail crop 01', 'detail'),
      ph('Layaw Facade — detail crop 02', 'detail'),
    ],
  },
  {
    slug: 'stairwell-bloom',
    title: 'Stairwell Bloom',
    medium: 'Acrylic on plaster',
    size: '6 × 8 m',
    year: 2023,
    status: 'showcase',
    location: 'layaw',
    images: [
      ph('Stairwell Bloom — context shot, widest angle available', 'context'),
      ph('Stairwell Bloom — detail crop 01', 'detail'),
      ph('Stairwell Bloom — detail crop 02', 'detail'),
    ],
  },
  {
    slug: 'back-lot',
    title: 'Back Lot',
    medium: 'Acrylic and spray on concrete',
    size: '18 × 4 m',
    year: 2023,
    status: 'showcase',
    location: 'layaw',
    images: [
      ph('Back Lot — context shot, widest angle available', 'context'),
      ph('Back Lot — detail crop 01', 'detail'),
      ph('Back Lot — detail crop 02', 'detail'),
    ],
  },
]

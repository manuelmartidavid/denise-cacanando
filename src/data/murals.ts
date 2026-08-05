import { ph, type Piece } from './types'

/**
 * 7 walls — count confirmed: BGC 4, Layaw Makati 3.
 * Names, dimensions and years are INVENTED PLACEHOLDERS. *
 * Years, sizes and statuses are deliberately IRREGULAR — clumped years, odd
 * centimetres, runs of the same status. An earlier pass had them alternating
 * available/sold down a tidy year-by-year descent with every dimension rounded
 * to ten, which is the shape invented data takes and never the shape a real
 * inventory has. Do not "tidy" them back.
 *
 * Walls are grouped by chapter, not by date, so the years do not descend down
 * the list. That is the point — the track is a geography, not a timeline.
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
    size: '13.8 × 4 m',
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
    size: '9.2 × 3.4 m',
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
    size: '21.5 × 2.9 m',
    year: 2023,
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
    size: '11 × 5.2 m',
    year: 2022,
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
    size: '16.4 × 6 m',
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
    size: '5.8 × 8.1 m',
    year: 2024,
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
    size: '18 × 3.9 m',
    year: 2021,
    status: 'showcase',
    location: 'layaw',
    images: [
      ph('Back Lot — context shot, widest angle available', 'context'),
      ph('Back Lot — detail crop 01', 'detail'),
      ph('Back Lot — detail crop 02', 'detail'),
    ],
  },
]

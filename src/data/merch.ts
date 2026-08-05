import { ph, type Piece } from './types'

/**
 * 12 items — count confirmed: jackets 5, bags 4, shirts 2, earrings 1.
 * Names, materials, dimensions and years are INVENTED PLACEHOLDERS. *
 * Years, sizes and statuses are deliberately IRREGULAR — clumped years, odd
 * centimetres, runs of the same status. An earlier pass had them alternating
 * available/sold down a tidy year-by-year descent with every dimension rounded
 * to ten, which is the shape invented data takes and never the shape a real
 * inventory has. Do not "tidy" them back.
 *
 * Showcase only. There is no cart — every item links to enquire.
 */
export const merch: Piece[] = [
  {
    slug: 'butterfly-jacket',
    title: 'Butterfly Jacket',
    medium: 'Hand-painted denim',
    size: 'One of one — M',
    year: 2025,
    status: 'available',
    kind: 'jackets',
    images: [ph('Butterfly Jacket — product shot on flat ground')],
  },
  {
    slug: 'garden-jacket',
    title: 'Garden Jacket',
    medium: 'Hand-painted denim',
    size: 'One of one — L',
    year: 2025,
    status: 'sold',
    kind: 'jackets',
    images: [ph('Garden Jacket — product shot on flat ground')],
  },
  {
    slug: 'moth-jacket',
    title: 'Moth Jacket',
    medium: 'Hand-painted canvas',
    size: 'One of one — S',
    year: 2024,
    status: 'sold',
    kind: 'jackets',
    images: [ph('Moth Jacket — product shot on flat ground')],
  },
  {
    slug: 'sampaguita-jacket',
    title: 'Sampaguita Jacket',
    medium: 'Hand-painted denim',
    size: 'One of one — M',
    year: 2024,
    status: 'sold',
    kind: 'jackets',
    images: [ph('Sampaguita Jacket — product shot on flat ground')],
  },
  {
    slug: 'pollen-jacket',
    title: 'Pollen Jacket',
    medium: 'Hand-painted denim',
    size: 'One of one — L',
    year: 2023,
    status: 'sold',
    kind: 'jackets',
    images: [ph('Pollen Jacket — product shot on flat ground')],
  },
  {
    slug: 'lantana-tote',
    title: 'Lantana Tote',
    medium: 'Hand-painted cotton canvas',
    size: '37 × 41 cm',
    year: 2025,
    status: 'available',
    kind: 'bags',
    images: [ph('Lantana Tote — product shot on flat ground')],
  },
  {
    slug: 'chrysalis-tote',
    title: 'Chrysalis Tote',
    medium: 'Hand-painted cotton canvas',
    size: '37 × 41 cm',
    year: 2025,
    status: 'available',
    kind: 'bags',
    images: [ph('Chrysalis Tote — product shot on flat ground')],
  },
  {
    slug: 'shell-pouch',
    title: 'Shell Pouch',
    medium: 'Hand-painted canvas',
    size: '21 × 14.5 cm',
    year: 2024,
    status: 'sold',
    kind: 'bags',
    images: [ph('Shell Pouch — product shot on flat ground')],
  },
  {
    slug: 'field-bag',
    title: 'Field Bag',
    medium: 'Hand-painted canvas',
    size: '29 × 33 cm',
    year: 2023,
    status: 'sold',
    kind: 'bags',
    images: [ph('Field Bag — product shot on flat ground')],
  },
  {
    slug: 'swallowtail-shirt',
    title: 'Swallowtail Shirt',
    medium: 'Hand-painted cotton',
    size: 'One of one — M',
    year: 2025,
    status: 'available',
    kind: 'shirts',
    images: [ph('Swallowtail Shirt — product shot on flat ground')],
  },
  {
    slug: 'gumamela-shirt',
    title: 'Gumamela Shirt',
    medium: 'Hand-painted cotton',
    size: 'One of one — S',
    year: 2024,
    status: 'sold',
    kind: 'shirts',
    images: [ph('Gumamela Shirt — product shot on flat ground')],
  },
  {
    slug: 'wing-earrings',
    title: 'Wing Earrings',
    medium: 'Hand-painted polymer and brass',
    size: '3.5 × 2 cm',
    year: 2025,
    status: 'available',
    kind: 'earrings',
    images: [ph('Wing Earrings — product shot on flat ground')],
  },
]

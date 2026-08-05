import { describe, expect, it } from 'vitest'
import { aspectOf, orientationOf } from './aspect'
import { artworks, merch, murals, ovalese } from './index'

describe('aspectOf', () => {
  it('reads width ÷ height off a centimetre size', () => {
    expect(aspectOf('91 × 122 cm')).toBeCloseTo(91 / 122)
    expect(aspectOf('132 × 102 cm')).toBeCloseTo(132 / 102)
  })

  it('reads metres the same way — the unit is not part of a ratio', () => {
    expect(aspectOf('13.8 × 4 m')).toBeCloseTo(3.45)
  })

  it('accepts decimals on either side', () => {
    expect(aspectOf('29.7 × 21 cm')).toBeCloseTo(29.7 / 21)
    expect(aspectOf('21 × 14.5 cm')).toBeCloseTo(21 / 14.5)
  })

  it('accepts a plain x as well as the multiplication sign', () => {
    expect(aspectOf('40 x 50 cm')).toBeCloseTo(0.8)
  })

  it('returns null for a size that carries no dimensions', () => {
    expect(aspectOf('One of one — M')).toBeNull()
    expect(aspectOf('')).toBeNull()
  })

  it('returns null rather than Infinity or NaN on a degenerate pair', () => {
    expect(aspectOf('0 × 50 cm')).toBeNull()
    expect(aspectOf('50 × 0 cm')).toBeNull()
  })
})

describe('orientationOf', () => {
  it('classifies the three cases', () => {
    expect(orientationOf('91 × 122 cm')).toBe('portrait')
    expect(orientationOf('132 × 102 cm')).toBe('landscape')
    expect(orientationOf('100 × 100 cm')).toBe('square')
  })

  it('treats near-square as square, so a 2cm difference is not a lean', () => {
    expect(orientationOf('100 × 102 cm')).toBe('square')
    expect(orientationOf('100 × 120 cm')).toBe('portrait')
  })

  it('is null where there is nothing to classify', () => {
    expect(orientationOf('One of one — L')).toBeNull()
  })
})

describe('the shipped inventory', () => {
  it('gives every artwork a parseable size, since the plate is sized from it', () => {
    for (const p of artworks) {
      expect(aspectOf(p.size), `${p.slug} would fall back to the square plate`).not.toBeNull()
    }
  })

  it('spans all three orientations, so the aspect plate is exercised', () => {
    const seen = new Set(artworks.map((p) => orientationOf(p.size)))
    expect(seen).toEqual(new Set(['portrait', 'landscape', 'square']))
  })

  it('carries a wide and a tall extreme rather than clustering near square', () => {
    const aspects = artworks.map((p) => aspectOf(p.size)!)
    expect(Math.max(...aspects)).toBeGreaterThanOrEqual(1.8)
    expect(Math.min(...aspects)).toBeLessThanOrEqual(0.78)
  })

  it('reads the eggs and the walls too', () => {
    for (const p of [...ovalese, ...murals]) expect(aspectOf(p.size)).not.toBeNull()
  })

  it('leaves garment-sized merch unparsed, which is the fallback path', () => {
    expect(merch.some((p) => aspectOf(p.size) === null)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { murals, ph, type Piece } from '~/data'
import {
  bendDegrees,
  chaptersOf,
  DOSSIER_W,
  MAX_BEND,
  TRACK_GAP,
  TRACK_PITCH,
  trackAt,
  trackGutter,
} from './track'

/** A wall stripped to the fields chaptersOf reads. */
const wall = (slug: string, location: Piece['location']): Piece => ({
  slug,
  title: slug,
  medium: 'Acrylic on concrete',
  size: '10 × 3 m',
  year: 2025,
  status: 'showcase',
  location,
  images: [ph(`${slug} — context`, 'context')],
})

describe('track geometry', () => {
  it('spaces walls by the dossier width plus the gap', () => {
    expect(TRACK_PITCH).toBe(DOSSIER_W + TRACK_GAP)
    expect(TRACK_PITCH).toBe(840)
  })

  it('centres the row so the first and last wall can both reach the middle', () => {
    expect(trackGutter()).toBe('calc(50% - 408px)')
  })
})

describe('trackAt', () => {
  it('puts wall 0 at p=0 and wall n-1 at p=1', () => {
    expect(trackAt(0, 7)).toBe(0)
    expect(trackAt(1, 7)).toBe(6)
  })

  it('is linear in between', () => {
    expect(trackAt(0.5, 7)).toBeCloseTo(3, 10)
  })

  it('pins a single-wall category at 0 for every progress', () => {
    expect(trackAt(0, 1)).toBe(0)
    expect(trackAt(0.5, 1)).toBe(0)
    expect(trackAt(1, 1)).toBe(0)
  })

  it('never goes negative on an empty category', () => {
    expect(trackAt(1, 0)).toBe(0)
  })
})

describe('bendDegrees', () => {
  it('leaves the centred wall flat', () => {
    expect(bendDegrees(3, 3)).toBe(0)
  })

  it('reaches the full bend at exactly one pitch either side', () => {
    expect(bendDegrees(4, 3)).toBe(MAX_BEND)
    expect(bendDegrees(2, 3)).toBe(-MAX_BEND)
  })

  it('holds at the clamp beyond one pitch instead of winding up', () => {
    expect(bendDegrees(9, 3)).toBe(MAX_BEND)
    expect(bendDegrees(-4, 3)).toBe(-MAX_BEND)
  })

  it('is antisymmetric about the centre', () => {
    expect(bendDegrees(3.5, 3)).toBe(-bendDegrees(2.5, 3))
  })
})

describe('chaptersOf', () => {
  it('splits the real walls BGC 4 / Layaw 3', () => {
    expect(chaptersOf(murals)).toEqual([
      { id: 'bgc', label: 'BGC', count: 4, firstIndex: 0 },
      { id: 'layaw', label: 'Layaw, Makati', count: 3, firstIndex: 4 },
    ])
  })

  it('counts correctly when locations are interleaved, ordering by first appearance', () => {
    const interleaved = [
      wall('a', 'layaw'),
      wall('b', 'bgc'),
      wall('c', 'layaw'),
    ]
    expect(chaptersOf(interleaved)).toEqual([
      { id: 'layaw', label: 'Layaw, Makati', count: 2, firstIndex: 0 },
      { id: 'bgc', label: 'BGC', count: 1, firstIndex: 1 },
    ])
  })

  it('returns nothing for an empty category', () => {
    expect(chaptersOf([])).toEqual([])
  })

  it('ignores pieces with no location rather than inventing a chapter', () => {
    expect(chaptersOf([wall('x', undefined)])).toEqual([])
  })
})

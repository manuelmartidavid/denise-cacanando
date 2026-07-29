import { describe, expect, it } from 'vitest'
import { GALLERY_SCENES, LABELS, activeCount, activePieces, sceneByLabel } from './scenes'
import { setMerchFilter } from './store'

describe('GALLERY_SCENES', () => {
  it('declares one scene per gallery label, in scroll order', () => {
    expect(GALLERY_SCENES.map((s) => s.label)).toEqual(['g1', 'g2', 'g3', 'g4'])
  })

  it('uses labels that exist on the master timeline', () => {
    for (const s of GALLERY_SCENES) expect(LABELS).toContain(s.label)
  })

  it('covers every category exactly once', () => {
    const ids = GALLERY_SCENES.map((s) => s.category)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every dial scene enough pieces to fill its orbit without repeating', () => {
    // The centre holds one piece and the orbit is a window onto the rest,
    // so count - 1 must cover every seat.
    for (const s of GALLERY_SCENES.filter((x) => x.presentation === 'dial')) {
      expect(s.seats).toBeGreaterThan(0)
      expect(activeCount(s) - 1).toBeGreaterThanOrEqual(s.seats)
    }
  })

  it('pins every scene for a positive length, proportional to piece count', () => {
    for (const s of GALLERY_SCENES) expect(s.length).toBeGreaterThan(0)
    expect(sceneByLabel('g1')!.length).toBe(320)
    expect(sceneByLabel('g2')!.length).toBe(220)
    expect(sceneByLabel('g3')!.length).toBe(240)
    expect(sceneByLabel('g4')!.length).toBe(260)
  })

  it('gives the dial scenes an orbit and the track scene none', () => {
    for (const s of GALLERY_SCENES) {
      if (s.presentation === 'dial') expect(s.orbit).toBeGreaterThan(0)
      else expect(s.orbit).toBe(0)
    }
  })
})

describe('activeCount', () => {
  it('reads the full category when nothing is filtered', () => {
    setMerchFilter(null)
    expect(activeCount(sceneByLabel('g1')!)).toBe(24)
    expect(activeCount(sceneByLabel('g2')!)).toBe(7)
    expect(activeCount(sceneByLabel('g4')!)).toBe(12)
  })

  it('narrows to the filtered kind on the merch scene only', () => {
    setMerchFilter('jackets')
    expect(activeCount(sceneByLabel('g4')!)).toBe(5)
    expect(activeCount(sceneByLabel('g1')!)).toBe(24) // filter is merch-only
    setMerchFilter('earrings')
    expect(activeCount(sceneByLabel('g4')!)).toBe(1)
    setMerchFilter(null)
  })
})

describe('activePieces', () => {
  it('returns the pieces themselves, not just how many', () => {
    setMerchFilter(null)
    expect(activePieces(sceneByLabel('g2')!).map((p) => p.slug)).toHaveLength(7)
  })

  it('returns the filtered pieces — indices must address the ring the user sees', () => {
    // The ring indexes into THIS list. Slicing the unfiltered category instead
    // would show the first five merch pieces rather than the five jackets.
    setMerchFilter('jackets')
    const pieces = activePieces(sceneByLabel('g4')!)
    expect(pieces).toHaveLength(5)
    expect(pieces.every((p) => p.kind === 'jackets')).toBe(true)
    setMerchFilter(null)
  })

  it('agrees with activeCount', () => {
    for (const scene of GALLERY_SCENES) {
      expect(activePieces(scene)).toHaveLength(activeCount(scene))
    }
  })
})

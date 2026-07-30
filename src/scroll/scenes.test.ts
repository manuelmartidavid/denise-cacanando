import { afterEach, describe, expect, it } from 'vitest'
import {
  GALLERY_SCENES,
  LABELS,
  activeCount,
  activePieces,
  piecesFor,
  sceneByLabel,
} from './scenes'
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
    // so count - 1 must cover every seat. Asked of the unfiltered category
    // explicitly rather than through the live store, so no other test's filter
    // can change what this one is asserting.
    for (const s of GALLERY_SCENES.filter((x) => x.presentation === 'dial')) {
      expect(s.seats).toBeGreaterThan(0)
      expect(piecesFor(s, null).length - 1).toBeGreaterThanOrEqual(s.seats)
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

// The filtering rule itself, exercised as a pure function. Nothing here touches
// the live store, so these cannot leak a filter into each other or into any
// other suite — the cascade that an afterEach would only paper over.
describe('piecesFor', () => {
  it('reads the full category when nothing is filtered', () => {
    expect(piecesFor(sceneByLabel('g1')!, null)).toHaveLength(24)
    expect(piecesFor(sceneByLabel('g2')!, null)).toHaveLength(7)
    expect(piecesFor(sceneByLabel('g4')!, null)).toHaveLength(12)
  })

  it('narrows to the filtered kind on the merch scene', () => {
    expect(piecesFor(sceneByLabel('g4')!, 'jackets')).toHaveLength(5)
    expect(piecesFor(sceneByLabel('g4')!, 'earrings')).toHaveLength(1)
  })

  it('ignores the filter on every non-merch scene', () => {
    expect(piecesFor(sceneByLabel('g1')!, 'jackets')).toHaveLength(24)
    expect(piecesFor(sceneByLabel('g2')!, 'jackets')).toHaveLength(7)
    expect(piecesFor(sceneByLabel('g3')!, 'jackets')).toHaveLength(7)
  })

  it('returns the filtered pieces — indices must address the ring the user sees', () => {
    // The ring indexes into THIS list. Slicing the unfiltered category instead
    // would show the first five merch pieces rather than the five jackets.
    const pieces = piecesFor(sceneByLabel('g4')!, 'jackets')
    expect(pieces.every((p) => p.kind === 'jackets')).toBe(true)
  })

  it('is a pure function of its arguments', () => {
    const scene = sceneByLabel('g4')!
    expect(piecesFor(scene, 'jackets')).toEqual(piecesFor(scene, 'jackets'))
    expect(piecesFor(scene, null)).not.toEqual(piecesFor(scene, 'jackets'))
  })
})

// The thin wrapper: that it reads the live filter at all. Restores the store
// afterwards because it is the one place here that touches it.
describe('activePieces', () => {
  afterEach(() => setMerchFilter(null))

  it('reads the live filter', () => {
    const g4 = sceneByLabel('g4')!
    setMerchFilter(null)
    expect(activePieces(g4)).toHaveLength(12)
    setMerchFilter('jackets')
    expect(activePieces(g4)).toHaveLength(5)
  })

  it('agrees with activeCount', () => {
    for (const scene of GALLERY_SCENES) {
      expect(activePieces(scene)).toHaveLength(activeCount(scene))
    }
  })
})

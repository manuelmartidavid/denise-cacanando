import { describe, expect, it } from 'vitest'
import {
  indexAtProgress,
  progressAtIndex,
  rotationAtProgress,
  seatContent,
  seatStep,
  snapProgress,
  trackProgress,
} from './ring'

// The seat/piece pairings we actually ship. See src/scroll/scenes.ts.
const ARTWORKS = { count: 24, seats: 8 }
const OVALESE = { count: 7, seats: 6 }
const MERCH = { count: 12, seats: 6 }

describe('seatStep', () => {
  it('divides the circle by the seats, not by the piece count', () => {
    expect(seatStep(8)).toBe(45)
    expect(seatStep(6)).toBe(60)
  })

  it('does not divide by zero', () => {
    expect(seatStep(0)).toBe(0)
  })
})

describe('rotationAtProgress', () => {
  it('starts unrotated', () => {
    expect(rotationAtProgress(0, 24, 8)).toBe(0)
  })

  it('matches the totals in the design spec', () => {
    expect(rotationAtProgress(1, ARTWORKS.count, ARTWORKS.seats)).toBe(1035)
    expect(rotationAtProgress(1, OVALESE.count, OVALESE.seats)).toBe(360)
    expect(rotationAtProgress(1, MERCH.count, MERCH.seats)).toBe(660)
  })

  it('advances exactly one seat per piece', () => {
    expect(rotationAtProgress(progressAtIndex(1, 24), 24, 8)).toBeCloseTo(45)
    expect(rotationAtProgress(progressAtIndex(1, 7), 7, 6)).toBeCloseTo(60)
  })

  it('is monotonic across the scene', () => {
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const r = rotationAtProgress(i / 20, 24, 8)
      expect(r).toBeGreaterThan(prev)
      prev = r
    }
  })

  it('does not rotate a single-piece category', () => {
    expect(rotationAtProgress(1, 1, 6)).toBe(0)
  })
})

describe('indexAtProgress', () => {
  it('hits the first and last piece exactly at the endpoints', () => {
    for (const { count } of [ARTWORKS, OVALESE, MERCH]) {
      expect(indexAtProgress(0, count)).toBe(0)
      expect(indexAtProgress(1, count)).toBe(count - 1)
    }
  })

  it('round-trips with progressAtIndex for every piece we ship', () => {
    for (const { count } of [ARTWORKS, OVALESE, MERCH]) {
      for (let i = 0; i < count; i++) {
        expect(indexAtProgress(progressAtIndex(i, count), count)).toBe(i)
      }
    }
  })

  it('clamps rather than running off either end', () => {
    expect(indexAtProgress(-0.5, 24)).toBe(0)
    expect(indexAtProgress(1.5, 24)).toBe(23)
  })

  it('handles an empty category', () => {
    expect(indexAtProgress(0.5, 0)).toBe(0)
  })
})

describe('snapProgress', () => {
  it('lands on a stop', () => {
    expect(snapProgress(0.5, 7)).toBeCloseTo(progressAtIndex(3, 7))
  })

  it('is idempotent', () => {
    for (const p of [0, 0.13, 0.5, 0.77, 1]) {
      const once = snapProgress(p, 24)
      expect(snapProgress(once, 24)).toBeCloseTo(once)
    }
  })

  it('is a no-op on a single-piece category', () => {
    expect(snapProgress(0.4, 1)).toBe(0)
  })
})

describe('seatContent', () => {
  it('fills every seat forward from the focus', () => {
    expect(seatContent(0, 8, 24)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('wraps past the end of the category', () => {
    expect(seatContent(22, 8, 24)).toEqual([23, 0, 1, 2, 3, 4, 5, 6])
  })

  it('never shows the focused piece on the orbit', () => {
    for (let i = 0; i < 24; i++) {
      expect(seatContent(i, 8, 24)).not.toContain(i)
    }
  })

  it('shows all seven eggs at once — six on the orbit plus the centre', () => {
    const orbit = seatContent(0, 6, 7)
    expect(orbit).toHaveLength(6)
    expect(new Set([...orbit, 0]).size).toBe(7)
  })

  it('caps at count - 1 so a filtered ring never repeats a piece', () => {
    expect(seatContent(0, 6, 1)).toEqual([]) // earrings: the centre only
    expect(seatContent(0, 6, 3)).toEqual([1, 2])
  })

  it('handles an empty category', () => {
    expect(seatContent(0, 6, 0)).toEqual([])
  })
})

describe('trackProgress', () => {
  it('runs 0 to 1 across the category', () => {
    expect(trackProgress(0, 24)).toBe(0)
    expect(trackProgress(23, 24)).toBe(1)
  })

  it('does not divide by zero on a single-piece category', () => {
    expect(trackProgress(0, 1)).toBe(0)
  })
})

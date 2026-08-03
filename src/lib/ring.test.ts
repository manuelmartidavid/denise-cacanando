import { describe, expect, it } from 'vitest'
import {
  indexAtProgress,
  orbitSeats,
  progressAtIndex,
  ringClipRadius,
  rotationAtProgress,
  seatContent,
  seatStep,
  snapProgress,
  trackProgress,
} from './ring'
import { GALLERY_SCENES } from '~/scroll/scenes'
import { RING_LOOK } from '~/sections/ring/look'

/**
 * The farthest any part of a thumb reaches from the ring centre, derived by
 * sweeping seat angles rather than by reusing `ringClipRadius`'s formula.
 *
 * Thumbs counter-rotate to stay upright, so each is an axis-aligned rectangle
 * whose centre sits on the orbit. Sweeping the angle and taking every corner is
 * an independent derivation — if it restated the implementation it could not
 * catch the implementation being wrong, which is exactly how this bug shipped.
 */
const farthestCorner = (orbit: number, w: number, h: number): number => {
  let max = 0
  for (let k = 0; k < 3600; k++) {
    const a = (k / 3600) * Math.PI * 2
    const cx = orbit * Math.cos(a)
    const cy = orbit * Math.sin(a)
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        max = Math.max(max, Math.hypot(cx + (sx * w) / 2, cy + (sy * h) / 2))
      }
    }
  }
  return max
}

describe('ringClipRadius', () => {
  const dials = GALLERY_SCENES.filter((s) => s.presentation === 'dial')

  it('covers every thumb corner on every dial scene', () => {
    expect(dials.length).toBeGreaterThan(0)
    for (const scene of dials) {
      const look = RING_LOOK[scene.category]
      const reach = farthestCorner(scene.orbit, look.thumbW, look.thumbH)
      expect(ringClipRadius(scene.guide, scene.orbit, look.thumbW, look.thumbH)).toBeGreaterThanOrEqual(
        reach,
      )
    }
  })

  it('covers the outer guide circle', () => {
    for (const scene of dials) {
      const look = RING_LOOK[scene.category]
      expect(ringClipRadius(scene.guide, scene.orbit, look.thumbW, look.thumbH)).toBeGreaterThanOrEqual(
        scene.guide / 2,
      )
    }
  })

  /**
   * The regression this function exists for. A square thumb's corner sits at the
   * half-DIAGONAL, not the half-width: sizing the clip with `max(w, h) / 2` cut
   * ~31px off the outer corner of every diagonal Merchandise thumb, which is the
   * one category whose thumbs are square and so the only one where it showed.
   */
  it('reaches the half-diagonal, not the half-width, for a square thumb', () => {
    expect(ringClipRadius(600, 296, 150, 150)).toBeGreaterThanOrEqual(296 + Math.hypot(150, 150) / 2)
    expect(ringClipRadius(600, 296, 150, 150)).toBeGreaterThan(296 + 150 / 2)
  })
})

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

describe('orbitSeats', () => {
  it('uses the declared seats when the category is big enough', () => {
    expect(orbitSeats(ARTWORKS.seats, ARTWORKS.count)).toBe(8)
    expect(orbitSeats(OVALESE.seats, OVALESE.count)).toBe(6)
    expect(orbitSeats(MERCH.seats, MERCH.count)).toBe(6)
  })

  it('caps at count - 1 so the focused piece is never repeated on the orbit', () => {
    expect(orbitSeats(6, 5)).toBe(4) // merch filtered to jackets
    expect(orbitSeats(6, 1)).toBe(0) // filtered to the single earring
  })

  it('never goes negative on an empty category', () => {
    expect(orbitSeats(6, 0)).toBe(0)
  })

  it('spreads a filtered ring around the full circle rather than an arc', () => {
    // Four jackets stepped by the declared 60° span 240° and leave the rest of
    // the circle empty; stepped by orbitSeats they sit 90° apart and close it.
    expect(seatStep(orbitSeats(6, 5))).toBe(90)
    expect(seatStep(orbitSeats(6, 5)) * orbitSeats(6, 5)).toBe(360)
  })

  it('agrees with the number of seats seatContent actually fills', () => {
    for (const [seats, count] of [
      [8, 24],
      [6, 7],
      [6, 12],
      [6, 5],
      [6, 1],
      [6, 0],
    ] as const) {
      expect(seatContent(0, seats, count)).toHaveLength(orbitSeats(seats, count))
    }
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

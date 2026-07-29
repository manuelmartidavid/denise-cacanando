import { describe, expect, it } from 'vitest'
import {
  FOCUS_ANGLE,
  counterRotation,
  indexAtFocus,
  normalize,
  polar,
  progressToRotation,
  rotationForIndex,
  shortestDelta,
  snapRotation,
  step,
  thumbAngle,
  trackProgress,
  visibleThumbs,
} from './ring'

describe('step', () => {
  it('divides the circle by the count', () => {
    expect(step(24)).toBe(15)
    expect(step(7)).toBeCloseTo(51.4285714)
    expect(step(12)).toBe(30)
  })

  it('does not divide by zero on an empty category', () => {
    expect(step(0)).toBe(0)
  })
})

describe('thumbAngle', () => {
  it('seats index 0 at the focus angle when unrotated', () => {
    expect(thumbAngle(0, 24, 0)).toBe(FOCUS_ANGLE)
  })

  it('seats index n at focus once rotated by n steps', () => {
    for (const i of [1, 5, 23]) {
      expect(thumbAngle(i, 24, rotationForIndex(i, 24))).toBeCloseTo(FOCUS_ANGLE)
    }
  })

  it('spaces neighbours by exactly one step', () => {
    expect(thumbAngle(1, 12, 0) - thumbAngle(0, 12, 0)).toBeCloseTo(30)
  })
})

describe('polar', () => {
  it('puts the focus angle at twelve o clock in screen space', () => {
    const { x, y } = polar(FOCUS_ANGLE, 326)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(-326) // y grows downward, so above centre is negative
  })

  it('stays on the orbit radius at any angle', () => {
    for (const a of [0, 37, 128, 271, 359]) {
      const { x, y } = polar(a, 296)
      expect(Math.hypot(x, y)).toBeCloseTo(296)
    }
  })
})

describe('counterRotation', () => {
  it('cancels the ring rotation so crops stay upright', () => {
    expect(counterRotation(137) + 137).toBe(0)
  })
})

describe('normalize', () => {
  it('folds any angle into [0, 360)', () => {
    expect(normalize(0)).toBe(0)
    expect(normalize(360)).toBe(0)
    expect(normalize(-90)).toBe(270)
    expect(normalize(-450)).toBe(270)
    expect(normalize(725)).toBe(5)
  })
})

describe('shortestDelta', () => {
  it('takes the short way round', () => {
    expect(shortestDelta(350, 10)).toBe(20)
    expect(shortestDelta(10, 350)).toBe(-20)
  })

  it('never returns a detour longer than half a turn', () => {
    for (const [from, to] of [
      [0, 179],
      [0, 181],
      [90, 300],
      [15, 200],
    ]) {
      expect(Math.abs(shortestDelta(from!, to!))).toBeLessThanOrEqual(180)
    }
  })
})

describe('indexAtFocus', () => {
  it('round-trips with rotationForIndex for every count we ship', () => {
    for (const count of [24, 7, 7, 12]) {
      for (let i = 0; i < count; i++) {
        expect(indexAtFocus(rotationForIndex(i, count), count)).toBe(i)
      }
    }
  })

  it('wraps past a full turn instead of running off the end', () => {
    expect(indexAtFocus(360, 24)).toBe(0)
    expect(indexAtFocus(375, 24)).toBe(1)
  })

  it('stays in range for negative rotation', () => {
    const i = indexAtFocus(-15, 24)
    expect(i).toBe(23)
    expect(i).toBeGreaterThanOrEqual(0)
  })
})

describe('snapRotation', () => {
  it('lands on a whole thumb', () => {
    expect(snapRotation(17, 24)).toBe(15)
    expect(snapRotation(23, 24)).toBe(30)
  })

  it('is a no-op on an already-snapped rotation', () => {
    expect(snapRotation(45, 24)).toBe(45)
  })
})

describe('progressToRotation', () => {
  it('turns once across a scene', () => {
    expect(progressToRotation(0, 24)).toBe(0)
    expect(progressToRotation(0.5, 24)).toBe(180)
    expect(progressToRotation(1, 24)).toBe(360)
  })
})

describe('visibleThumbs', () => {
  it('shows eight of twenty-four, focus first', () => {
    const v = visibleThumbs(24, 0, 8)
    expect(v).toHaveLength(8)
    expect(v[0]).toBe(0)
  })

  it('returns every thumb when the ring is smaller than the window', () => {
    expect(visibleThumbs(7, 0, 8)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('never repeats an index', () => {
    const v = visibleThumbs(24, 135, 8)
    expect(new Set(v).size).toBe(v.length)
  })

  it('wraps around zero without going negative', () => {
    const v = visibleThumbs(24, 0, 8)
    expect(v.every((i) => i >= 0 && i < 24)).toBe(true)
    expect(v).toContain(23)
  })

  it('handles an empty category', () => {
    expect(visibleThumbs(0, 0, 8)).toEqual([])
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

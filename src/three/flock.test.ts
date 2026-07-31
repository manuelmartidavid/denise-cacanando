import { describe, expect, it } from 'vitest'
import { flockAt, type Waypoint } from './flock'

/** Four waypoints is enough to exercise interior seams and the final leg. */
const WPS: Waypoint[] = [
  { at: 0, target: [-8, -4, -1] },
  { at: 0.2, target: [4, 1, 0] },
  { at: 0.5, target: [-7, 3, -2] },
  { at: 0.9, target: [0, -5, 0] },
]

describe('flockAt', () => {
  it('returns a waypoint own target at that waypoint at', () => {
    expect(flockAt(WPS, 0).target).toEqual([-8, -4, -1])
    expect(flockAt(WPS, 0.2).target).toEqual([4, 1, 0])
    expect(flockAt(WPS, 0.5).target).toEqual([-7, 3, -2])
    expect(flockAt(WPS, 0.9).target).toEqual([0, -5, 0])
  })

  it('gathers to 0 at every waypoint and peaks at 1 mid-gap', () => {
    for (const w of WPS) expect(flockAt(WPS, w.at).gather).toBeCloseTo(0, 6)
    expect(flockAt(WPS, 0.1).gather).toBeCloseTo(1, 6)
    expect(flockAt(WPS, 0.35).gather).toBeCloseTo(1, 6)
    expect(flockAt(WPS, 0.7).gather).toBeCloseTo(1, 6)
  })

  it('is continuous across the whole sweep, including at seams', () => {
    const STEP = 0.001
    let prev = flockAt(WPS, 0)
    for (let p = STEP; p <= 1; p += STEP) {
      const next = flockAt(WPS, p)
      for (let axis = 0; axis < 3; axis++) {
        expect(Math.abs(next.target[axis]! - prev.target[axis]!)).toBeLessThan(0.5)
      }
      expect(Math.abs(next.gather - prev.gather)).toBeLessThan(0.05)
      expect(Math.abs(next.settle - prev.settle)).toBeLessThan(0.05)
      prev = next
    }
  })

  it('clamps outside 0..1 rather than extrapolating', () => {
    expect(flockAt(WPS, -0.5).target).toEqual([-8, -4, -1])
    expect(flockAt(WPS, 1.5).target).toEqual([0, -5, 0])
    for (const p of [-0.5, 0, 0.42, 1, 1.5]) {
      const s = flockAt(WPS, p)
      expect(Number.isFinite(s.gather)).toBe(true)
      expect(Number.isFinite(s.settle)).toBe(true)
      expect(s.target.every(Number.isFinite)).toBe(true)
    }
  })

  it('settles only across the final leg', () => {
    expect(flockAt(WPS, 0.1).settle).toBe(0)
    expect(flockAt(WPS, 0.49).settle).toBe(0)
    expect(flockAt(WPS, 0.5).settle).toBe(0)
    expect(flockAt(WPS, 0.7).settle).toBeCloseTo(0.5, 6)
    expect(flockAt(WPS, 1).settle).toBe(1)
  })

  it('degrades safely on empty and single-waypoint lists', () => {
    // getLabelOffset returns undefined until the first refresh, so a short list
    // is a real mount-time state.
    expect(flockAt([], 0.5)).toEqual({ target: [0, 0, 0], gather: 0, settle: 0 })
    const one: Waypoint[] = [{ at: 0.3, target: [1, 2, 3] }]
    expect(flockAt(one, 0.9)).toEqual({ target: [1, 2, 3], gather: 0, settle: 0 })
  })
})

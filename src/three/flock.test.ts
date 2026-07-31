import { describe, expect, it } from 'vitest'
import { ATTRACTORS, flockAt, waypointsFrom, type Waypoint } from './flock'
import { LABELS } from '~/scroll/scenes'

/** Four waypoints is enough to exercise interior seams and the final leg. */
const WPS: Waypoint[] = [
  { at: 0, target: [-8, -4, -1] },
  { at: 0.2, target: [4, 1, 0] },
  { at: 0.5, target: [-7, 3, -2] },
  { at: 0.9, target: [0, -5, 0] },
]

describe('flockAt', () => {
  it("returns a waypoint's own target at its own 'at'", () => {
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
        expect(Math.abs(next.target[axis]! - prev.target[axis]!)).toBeLessThan(0.1)
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

  it('does not extrapolate across a non-monotonic waypoint list', () => {
    const bad: Waypoint[] = [
      { at: 0, target: [0, 0, 0] },
      { at: 0.6, target: [1, 1, 1] },
      { at: 0.3, target: [2, 2, 2] }, // out of order — defect (c) produces this
      { at: 0.9, target: [3, 3, 3] },
    ]
    for (const p of [0.1, 0.35, 0.5, 0.7, 0.85]) {
      const s = flockAt(bad, p)
      expect(s.gather).toBeGreaterThanOrEqual(0)
      expect(s.gather).toBeLessThanOrEqual(1)
      expect(s.settle).toBeGreaterThanOrEqual(0)
      expect(s.settle).toBeLessThanOrEqual(1)
      expect(s.target.every(Number.isFinite)).toBe(true)
    }
  })
})

describe('waypointsFrom', () => {
  const SEVEN = [0, 900, 1800, 5580, 8460, 11520, 14400]

  it('normalises every label offset against the scrollable height', () => {
    const wps = waypointsFrom(SEVEN, 15660)
    expect(wps).toHaveLength(7)
    expect(wps[0]!.at).toBe(0)
    expect(wps[3]!.at).toBeCloseTo(5580 / 15660, 6)
    expect(wps[6]!.at).toBeCloseTo(14400 / 15660, 6)
  })

  it('pairs each offset with its label attractor, in label order', () => {
    const wps = waypointsFrom(SEVEN, 15660)
    for (let i = 0; i < LABELS.length; i++) {
      expect(wps[i]!.target).toEqual(ATTRACTORS[LABELS[i]!])
    }
  })

  it('has one attractor per timeline label', () => {
    // README §184 says "one per scene", but the flock also has specified
    // behaviour at hero (§109) and contact (§148). Seven, not four.
    expect(Object.keys(ATTRACTORS).sort()).toEqual([...LABELS].sort())
  })

  it('returns nothing until every label has registered', () => {
    const partial = [0, 900, undefined, 5580, 8460, 11520, 14400]
    expect(waypointsFrom(partial, 15660)).toEqual([])
    expect(waypointsFrom([0, 900], 15660)).toEqual([])
    expect(waypointsFrom([], 15660)).toEqual([])
  })

  it('returns nothing when the document is not yet scrollable', () => {
    expect(waypointsFrom(SEVEN, 0)).toEqual([])
    expect(waypointsFrom(SEVEN, -1)).toEqual([])
  })

  it('clamps an offset that exceeds the scrollable height', () => {
    const wps = waypointsFrom(SEVEN, 10000)
    expect(wps[6]!.at).toBe(1)
  })
})

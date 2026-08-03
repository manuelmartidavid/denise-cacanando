import { describe, expect, it } from 'vitest'
import {
  FALL_MEAN,
  FALL_SWING,
  fallAt,
  fallDisplacement,
  gustAt,
  gustIntegral,
  phaseAt,
  swayAt,
  swayDisplacement,
  windAt,
  windDisplacement,
  wrap,
} from './flutter'

/**
 * The petal field is placed analytically in the vertex shader, so every
 * displacement has to be an exact antiderivative of the velocity it claims to
 * integrate. A wrong one still animates smoothly — it just animates the wrong
 * motion — so eyeballing the page cannot catch it. Central differences can.
 */
const derivative = (f: (t: number) => number, t: number, h = 1e-5): number =>
  (f(t + h) - f(t - h)) / (2 * h)

/** A spread of instances covering the per-instance ranges the component uses. */
const INSTANCES = [
  { swayFreq: 0.8, amp: 0.35, fall: 0.28, seed: 0 },
  { swayFreq: 1.1, amp: 0.55, fall: 0.4, seed: 1.7 },
  { swayFreq: 1.6, amp: 0.8, fall: 0.55, seed: 4.9 },
  { swayFreq: 1.35, amp: 0.62, fall: 0.33, seed: 6.1 },
]

const TIMES = [0, 0.3, 1, 2.5, 7, 13.7, 31, 60, 145.25]

describe('gust envelope', () => {
  it('is never negative and is quiet for most of its cycle', () => {
    let quiet = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      const g = gustAt((i / N) * 200)
      expect(g).toBeGreaterThanOrEqual(0)
      if (g < 0.05) quiet++
    }
    // max(0, sin)^3 is zero for half the cycle and near zero for much of the
    // rest: "long quiet spells, occasional soft pushes".
    expect(quiet / N).toBeGreaterThan(0.6)
  })

  it('never exceeds 1', () => {
    for (let i = 0; i < 2000; i++) expect(gustAt((i / 2000) * 200)).toBeLessThanOrEqual(1)
  })
})

describe('gustIntegral', () => {
  it('is zero at t = 0', () => {
    expect(gustIntegral(0)).toBeCloseTo(0, 10)
  })

  it('differentiates back to the gust envelope', () => {
    for (const t of TIMES) {
      expect(derivative((x) => gustIntegral(x), t)).toBeCloseTo(gustAt(t), 6)
    }
  })

  it('never decreases, since the envelope it integrates is never negative', () => {
    let prev = gustIntegral(0)
    for (let i = 1; i <= 4000; i++) {
      const next = gustIntegral((i / 4000) * 300)
      expect(next).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = next
    }
  })

  it('is continuous across the half-cycle seams where the clamp bites', () => {
    // Seams sit where sin(GUST_RATE*t + GUST_PHASE) crosses zero.
    const STEP = 0.01
    let prev = gustIntegral(0)
    for (let t = STEP; t <= 300; t += STEP) {
      const next = gustIntegral(t)
      expect(Math.abs(next - prev)).toBeLessThan(0.02)
      prev = next
    }
  })
})

describe('wind', () => {
  it('displacement is zero at t = 0 for any seed', () => {
    for (const seed of [0, 1.7, 4.9, 6.1]) {
      expect(windDisplacement(0, seed)).toBeCloseTo(0, 10)
    }
  })

  it('differentiates back to the wind speed', () => {
    for (const seed of [0, 1.7, 4.9]) {
      for (const t of TIMES) {
        expect(derivative((x) => windDisplacement(x, seed), t)).toBeCloseTo(windAt(t, seed), 5)
      }
    }
  })

  it('scales linearly with breeze', () => {
    for (const t of [3, 19, 74]) {
      expect(windDisplacement(t, 2.2, 2)).toBeCloseTo(windDisplacement(t, 2.2, 1) * 2, 8)
    }
  })

  it('carries petals in one direction overall — the breeze has a mean', () => {
    // Steady 0.32 plus a strictly non-negative gust term: net drift is positive
    // however the slow swell happens to land.
    expect(windDisplacement(120, 3.3)).toBeGreaterThan(0)
    expect(windDisplacement(240, 3.3)).toBeGreaterThan(windDisplacement(120, 3.3))
  })
})

describe('sway', () => {
  it('displacement is zero at t = 0', () => {
    for (const p of INSTANCES) {
      expect(swayDisplacement(0, p.swayFreq, p.seed, p.amp)).toBeCloseTo(0, 10)
    }
  })

  it('differentiates back to the sway speed', () => {
    for (const p of INSTANCES) {
      for (const t of TIMES) {
        expect(derivative((x) => swayDisplacement(x, p.swayFreq, p.seed, p.amp), t)).toBeCloseTo(
          swayAt(t, p.swayFreq, p.seed, p.amp),
          5,
        )
      }
    }
  })

  it('stays within its amplitude either side of the start', () => {
    for (const p of INSTANCES) {
      for (let i = 0; i <= 2000; i++) {
        const d = swayDisplacement((i / 2000) * 60, p.swayFreq, p.seed, p.amp)
        expect(Math.abs(d)).toBeLessThanOrEqual(2 * p.amp + 1e-9)
      }
    }
  })
})

describe('fall coupled to the sway', () => {
  it('displacement is zero at t = 0', () => {
    for (const p of INSTANCES) {
      expect(fallDisplacement(0, p.swayFreq, p.seed, p.fall)).toBeCloseTo(0, 10)
    }
  })

  it('differentiates back to the fall speed', () => {
    for (const p of INSTANCES) {
      for (const t of TIMES) {
        expect(derivative((x) => fallDisplacement(x, p.swayFreq, p.seed, p.fall), t)).toBeCloseTo(
          fallAt(t, p.swayFreq, p.seed, p.fall),
          5,
        )
      }
    }
  })

  it('the double-angle rewrite matches the form the spec states', () => {
    // FALL_MEAN + FALL_SWING*cos(2ph) must equal 0.35 + 0.65*cos^2(ph).
    for (const p of INSTANCES) {
      for (const t of TIMES) {
        const ph = phaseAt(t, p.swayFreq, p.seed)
        const cph = Math.cos(ph)
        expect(FALL_MEAN + FALL_SWING * Math.cos(2 * ph)).toBeCloseTo(0.35 + 0.65 * cph * cph, 10)
      }
    }
  })

  it('always descends, and never rises', () => {
    for (const p of INSTANCES) {
      for (let i = 0; i <= 3000; i++) {
        expect(fallAt((i / 3000) * 90, p.swayFreq, p.seed, p.fall)).toBeLessThan(0)
      }
    }
  })

  it('drops fastest mid-swing and nearly hangs at the extremes', () => {
    // This coupling IS the effect; if it inverts, petals hang mid-slip and
    // plummet at the edges, which reads as a glitch rather than a flutter.
    const { swayFreq, seed, fall } = INSTANCES[1]!
    // Mid-swing: cos(ph) = +/-1. Extreme: cos(ph) = 0.
    const tMid = (0 - seed) / swayFreq + 2 * (Math.PI / swayFreq)
    const tEdge = (Math.PI / 2 - seed) / swayFreq + 2 * (Math.PI / swayFreq)
    const mid = Math.abs(fallAt(tMid, swayFreq, seed, fall))
    const edge = Math.abs(fallAt(tEdge, swayFreq, seed, fall))
    expect(mid).toBeCloseTo(fall * 1.0, 6)
    expect(edge).toBeCloseTo(fall * 0.35, 6)
    expect(mid / edge).toBeCloseTo(1 / 0.35, 4)
  })
})

describe('wrap', () => {
  it('keeps any value inside the band', () => {
    for (const half of [3, 8.83, 5.54]) {
      for (let i = 0; i < 4000; i++) {
        const v = (i / 4000) * 400 - 200
        const w = wrap(v, half)
        expect(w).toBeGreaterThanOrEqual(-half - 1e-9)
        expect(w).toBeLessThanOrEqual(half + 1e-9)
      }
    }
  })

  it('handles negative coordinates — the trap in translating GLSL mod to JS', () => {
    // A naive `(v + half) % span - half` returns +half-ish here instead of
    // wrapping, because JS `%` keeps the dividend's sign.
    expect(wrap(-9, 8.83)).toBeCloseTo(8.66, 6)
    expect(wrap(-100, 8.83)).toBeGreaterThanOrEqual(-8.83)
    expect(wrap(-100, 8.83)).toBeLessThanOrEqual(8.83)
  })

  it('is the identity inside the band', () => {
    for (const v of [-8, -3.2, 0, 1.5, 8]) expect(wrap(v, 8.83)).toBeCloseTo(v, 9)
  })

  it('is periodic, so a petal leaving one edge arrives at the other', () => {
    for (const v of [-4.4, 0, 2.7, 7.9]) {
      expect(wrap(v + 2 * 8.83, 8.83)).toBeCloseTo(wrap(v, 8.83), 6)
      expect(wrap(v - 4 * 8.83, 8.83)).toBeCloseTo(wrap(v, 8.83), 6)
    }
  })
})

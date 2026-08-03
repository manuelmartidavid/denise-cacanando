import { describe, expect, it } from 'vitest'
import {
  ATTRACTORS,
  BAND,
  HOLD,
  flockAt,
  spansFrom,
  boundaryAt,
  halfWidthAt,
  nearestSeamIndex,
  gatherAt,
  seamAt,
  type Span,
} from './flock'
import { LABELS } from '~/scroll/scenes'

/**
 * What the seven triggers actually register at a 1440x900 viewport, read back
 * out of the live page rather than derived — `getLabelSpan` for each label with
 * the dev server running. Do not "correct" these by hand.
 *
 * Note what this shows about the pinned scenes: g1's pin ENDS at 4680 but g2's
 * section does not start until 5580. The 900px between them is g1 unpinning and
 * scrolling away — a real, one-viewport gap, not the zero-length seam the
 * unpinned sections have. Both shapes have to work, which is why a boundary is
 * the midpoint between two spans rather than either span's own endpoint.
 *
 * Contact's 14535 is the other thing worth not guessing at: `'top 25%'` puts
 * the boundary a quarter of a viewport DOWN from the top, 14760 - 225, and its
 * `'bottom top'` end is past maxScroll and unreachable. An earlier version of
 * this fixture guessed 14085 and, being wrong in the safe direction, hid a
 * genuine discontinuity at the last pixel of the document.
 */
const BOUNDS = [
  { start: 0, end: 900 }, //          hero,  unpinned, seam with about
  { start: 900, end: 1800 }, //       about, unpinned, seam with g1
  { start: 1800, end: 4680 }, //      g1,    320vh pin
  { start: 5580, end: 7560 }, //      g2,    220vh pin
  { start: 8460, end: 10620 }, //     g3,    240vh pin
  { start: 11520, end: 13860 }, //    g4,    260vh pin
  { start: 14535, end: 15660 }, //    contact, 'top 25%', end past maxScroll
]

const SCROLLABLE = 14760

const SPANS = spansFrom(BOUNDS, SCROLLABLE)

/** g1–g4 are indices 2–5 of `LABELS`. */
const GALLERY = [2, 3, 4, 5]

/**
 * Where the flock is allowed to swell: the midpoint between one span's end and
 * the next span's start. Stated here independently of the implementation, since
 * it is the contract the bands are built on.
 */
const boundaries = (spans: Span[]): number[] =>
  spans.slice(0, -1).map((s, i) => (s.to + spans[i + 1]!.from) / 2)

/** The part of a span more than BAND from either of its boundaries. */
const coreOf = (i: number): [number, number] => {
  const bs = boundaries(SPANS)
  const span = SPANS[i]!
  const lo = i > 0 ? Math.max(span.from, bs[i - 1]! + BAND) : span.from
  const hi = i < SPANS.length - 1 ? Math.min(span.to, bs[i]! - BAND) : span.to
  return [lo, hi]
}

const sample = ([lo, hi]: [number, number], n: number): number[] =>
  Array.from({ length: n }, (_, k) => lo + ((hi - lo) * k) / (n - 1))

describe('spansFrom', () => {
  it('normalises each label bound against the scrollable height', () => {
    expect(SPANS).toHaveLength(7)
    expect(SPANS[0]!.from).toBe(0)
    expect(SPANS[2]!.from).toBeCloseTo(1800 / SCROLLABLE, 6)
    expect(SPANS[2]!.to).toBeCloseTo(4680 / SCROLLABLE, 6)
  })

  it('pairs each span with its label attractor and hold, in label order', () => {
    for (let i = 0; i < LABELS.length; i++) {
      const label = LABELS[i]!
      expect(SPANS[i]!.target).toEqual(ATTRACTORS[label])
      expect(SPANS[i]!.hold).toBe(HOLD[label])
    }
  })

  it('has one attractor and one hold per timeline label', () => {
    expect(Object.keys(ATTRACTORS).sort()).toEqual([...LABELS].sort())
    expect(Object.keys(HOLD).sort()).toEqual([...LABELS].sort())
  })

  it('clamps a bound that runs past the scrollable height', () => {
    // Contact's trigger genuinely ends past maxScroll — its section is the last
    // one and 'bottom top' is unreachable.
    expect(SPANS[6]!.to).toBe(1)
  })

  it('returns nothing until every label has registered', () => {
    const partial = BOUNDS.map((b, i) => (i === 3 ? undefined : b))
    expect(spansFrom(partial, SCROLLABLE)).toEqual([])
    expect(spansFrom(BOUNDS.slice(0, 2), SCROLLABLE)).toEqual([])
    expect(spansFrom([], SCROLLABLE)).toEqual([])
    // Longer than LABELS is just as wrong as shorter.
    expect(spansFrom([...BOUNDS, { start: 0, end: 1 }], SCROLLABLE)).toEqual([])
  })

  it('returns nothing when the document is not yet scrollable', () => {
    expect(spansFrom(BOUNDS, 0)).toEqual([])
    expect(spansFrom(BOUNDS, -1)).toEqual([])
  })
})

describe('flockAt gather', () => {
  it('is 0 through the core of every gallery span', () => {
    for (const i of GALLERY) {
      const core = coreOf(i)
      expect(core[1]).toBeGreaterThan(core[0])
      for (const p of sample(core, 10)) {
        expect(flockAt(SPANS, p).gather).toBeCloseTo(0, 9)
      }
    }
  })

  it('is 1 at every span boundary', () => {
    for (const b of boundaries(SPANS)) {
      expect(flockAt(SPANS, b).gather).toBeCloseTo(1, 9)
    }
  })

  it('is 0 exactly BAND either side of a boundary with room for a full band', () => {
    // Only the gallery boundaries. Hero and About are one viewport each — about
    // 0.06 of the document — which is narrower than the 0.10-wide band, so their
    // two bands are squeezed and reach 0 sooner than BAND. That is the clamp
    // doing its job, not a failure; the seam-continuity test below is what pins
    // the squeezed case down.
    for (const b of boundaries(SPANS).slice(2)) {
      expect(flockAt(SPANS, b - BAND).gather).toBeCloseTo(0, 9)
      expect(flockAt(SPANS, b + BAND).gather).toBeCloseTo(0, 9)
    }
  })

  it('never leaves 0..1', () => {
    for (let p = 0; p <= 1; p += 0.001) {
      const g = flockAt(SPANS, p).gather
      expect(g).toBeGreaterThanOrEqual(0)
      expect(g).toBeLessThanOrEqual(1)
    }
  })
})

describe('flockAt presence', () => {
  it('is 0 through the core of every gallery span', () => {
    for (const i of GALLERY) {
      for (const p of sample(coreOf(i), 10)) {
        expect(flockAt(SPANS, p).presence).toBe(0)
      }
    }
  })

  it('is 1 through the hero span and at the foot of the document', () => {
    for (const p of sample(coreOf(0), 4)) expect(flockAt(SPANS, p).presence).toBeCloseTo(1, 9)
    // Contact has no BAND-wide core: only 225px of it is reachable before
    // maxScroll, so its band is clamped to close exactly at the last pixel.
    // That is the one point where the flock has fully landed — README §148.
    expect(flockAt(SPANS, 1).presence).toBeCloseTo(1, 9)
  })

  it("reaches about's own hold at the midpoint of a squeezed span", () => {
    // About is narrower than a full band, so it has no BAND-wide core at all —
    // its two clamped bands meet exactly at its midpoint. That single point is
    // where gather returns to 0 and presence sits on HOLD.about, which is what
    // keeps the squeezed case continuous instead of jumping between two bands.
    const mid = (SPANS[1]!.from + SPANS[1]!.to) / 2
    expect(flockAt(SPANS, mid).gather).toBeCloseTo(0, 9)
    expect(flockAt(SPANS, mid).presence).toBeCloseTo(HOLD.about, 9)
  })

  it('swells to 1 in the gap between two gallery pins', () => {
    // Both holds are 0 there, so presence is gather alone — this is the whole
    // point of the change.
    for (const b of boundaries(SPANS).slice(2, 5)) {
      expect(flockAt(SPANS, b).presence).toBeCloseTo(1, 9)
    }
  })

  it('never leaves 0..1', () => {
    for (let p = -0.2; p <= 1.2; p += 0.001) {
      const s = flockAt(SPANS, p)
      expect(s.presence).toBeGreaterThanOrEqual(0)
      expect(s.presence).toBeLessThanOrEqual(1)
    }
  })
})

describe('flockAt continuity', () => {
  it('never jumps presence, gather or target across any seam', () => {
    // Stepped as k/STEPS rather than by accumulating 1e-4, so the sweep lands on
    // exactly 1.0. That last sample is load-bearing: p >= last.to is a
    // short-circuit, and an accumulated loop drifts just short of it and never
    // compares the band against the value the short-circuit holds.
    const STEPS = 10_000
    let prev = flockAt(SPANS, 0)
    for (let k = 1; k <= STEPS; k++) {
      const next = flockAt(SPANS, k / STEPS)
      expect(Math.abs(next.presence - prev.presence)).toBeLessThan(0.01)
      expect(Math.abs(next.gather - prev.gather)).toBeLessThan(0.01)
      expect(Math.abs(next.settle - prev.settle)).toBeLessThan(0.01)
      for (let axis = 0; axis < 3; axis++) {
        expect(Math.abs(next.target[axis]! - prev.target[axis]!)).toBeLessThan(0.05)
      }
      prev = next
    }
  })
})

describe('flockAt target', () => {
  it("is the containing span's own attractor through its core", () => {
    for (const i of GALLERY) {
      const want = ATTRACTORS[LABELS[i]!]
      for (const p of sample(coreOf(i), 5)) {
        const got = flockAt(SPANS, p).target
        // Close, not identical: at the exact edge of a core the band's `t` lands
        // a few ulps short of 1 and takes the lerp rather than the by-reference
        // path. Same attractor to 15 digits.
        for (let axis = 0; axis < 3; axis++) expect(got[axis]).toBeCloseTo(want[axis]!, 9)
      }
    }
  })

  it('is halfway between two attractors at their shared boundary', () => {
    const bs = boundaries(SPANS)
    const a = ATTRACTORS.g1
    const b = ATTRACTORS.g2
    const mid = flockAt(SPANS, bs[2]!).target
    for (let axis = 0; axis < 3; axis++) {
      expect(mid[axis]).toBeCloseTo((a[axis]! + b[axis]!) / 2, 6)
    }
  })

  it('clamps outside 0..1 rather than extrapolating', () => {
    expect(flockAt(SPANS, -0.5).target).toEqual(ATTRACTORS.hero)
    expect(flockAt(SPANS, 1.5).target).toEqual(ATTRACTORS.contact)
    expect(flockAt(SPANS, -0.5).presence).toBe(HOLD.hero)
    expect(flockAt(SPANS, 1.5).presence).toBe(HOLD.contact)
  })
})

describe('flockAt settle', () => {
  it('is 0 until the final band and 1 at the end of the document', () => {
    expect(flockAt(SPANS, 0.2).settle).toBe(0)
    expect(flockAt(SPANS, 0.6).settle).toBe(0)
    expect(flockAt(SPANS, 1).settle).toBe(1)
    expect(flockAt(SPANS, 1.5).settle).toBe(1)
  })

  it('ramps monotonically to 1 across the final band', () => {
    // Stated without the band's width: the last band is clamped to close at the
    // end of the document (Contact starts 225px from the bottom), so it is
    // narrower than BAND here and hardcoding ±BAND would assert the old shape.
    const bs = boundaries(SPANS)
    const last = bs[bs.length - 1]!
    expect(flockAt(SPANS, last).settle).toBeCloseTo(0.5, 9)

    let prev = -1
    for (let k = 0; k <= 1000; k++) {
      const settle = flockAt(SPANS, last + (k / 1000) * (1 - last)).settle
      expect(settle).toBeGreaterThanOrEqual(prev)
      prev = settle
    }
    expect(prev).toBeCloseTo(1, 9)
  })
})

describe('flockAt degenerate input', () => {
  it('degrades safely on empty and single-span lists', () => {
    // getLabelSpan returns undefined until the first refresh, so a short list is
    // a real mount-time state.
    expect(flockAt([], 0.5)).toEqual({ target: [0, 0, 0], gather: 0, settle: 0, presence: 0 })
    const one: Span[] = [{ from: 0.3, to: 0.4, target: [1, 2, 3], hold: 0.5 }]
    expect(flockAt(one, 0.9)).toEqual({ target: [1, 2, 3], gather: 0, settle: 0, presence: 0.5 })
  })

  it('produces finite numbers across a zero-length span', () => {
    // The trailing section can genuinely register start === end.
    const degenerate: Span[] = [
      { from: 0, to: 0.5, target: [-8, -4, -1], hold: 1 },
      { from: 0.5, to: 0.5, target: [4, 1, 0], hold: 0 },
      { from: 0.5, to: 1, target: [0, -5, 0], hold: 1 },
    ]
    for (let p = -0.1; p <= 1.1; p += 0.005) {
      const s = flockAt(degenerate, p)
      expect(Number.isFinite(s.gather)).toBe(true)
      expect(Number.isFinite(s.settle)).toBe(true)
      expect(Number.isFinite(s.presence)).toBe(true)
      expect(s.target.every(Number.isFinite)).toBe(true)
    }
  })

  it('produces finite numbers across a span shorter than the band', () => {
    const tight: Span[] = [
      { from: 0, to: 0.48, target: [-8, -4, -1], hold: 1 },
      { from: 0.48, to: 0.5, target: [4, 1, 0], hold: 0 }, // 0.02 wide, BAND is 0.05
      { from: 0.5, to: 1, target: [0, -5, 0], hold: 1 },
    ]
    for (let p = 0; p <= 1; p += 0.005) {
      const s = flockAt(tight, p)
      expect(Number.isFinite(s.gather)).toBe(true)
      expect(Number.isFinite(s.presence)).toBe(true)
      expect(s.gather).toBeLessThanOrEqual(1)
      expect(s.presence).toBeLessThanOrEqual(1)
      expect(s.target.every(Number.isFinite)).toBe(true)
    }
  })

  it('does not extrapolate across a non-monotonic span list', () => {
    const bad: Span[] = [
      { from: 0, to: 0.2, target: [0, 0, 0], hold: 1 },
      { from: 0.6, to: 0.7, target: [1, 1, 1], hold: 0 },
      { from: 0.3, to: 0.4, target: [2, 2, 2], hold: 1 }, // out of order
      { from: 0.9, to: 1, target: [3, 3, 3], hold: 1 },
    ]
    for (const p of [0.1, 0.35, 0.5, 0.7, 0.85]) {
      const s = flockAt(bad, p)
      expect(s.gather).toBeGreaterThanOrEqual(0)
      expect(s.gather).toBeLessThanOrEqual(1)
      expect(s.presence).toBeGreaterThanOrEqual(0)
      expect(s.presence).toBeLessThanOrEqual(1)
      expect(s.settle).toBeGreaterThanOrEqual(0)
      expect(s.settle).toBeLessThanOrEqual(1)
      expect(s.target.every(Number.isFinite)).toBe(true)
    }
  })
})

describe('nearestSeamIndex', () => {
  it('picks the boundary the point is closest to', () => {
    const spans = SPANS
    expect(nearestSeamIndex(spans, boundaryAt(spans, 0))).toBe(0)
    expect(nearestSeamIndex(spans, boundaryAt(spans, 2))).toBe(2)
    expect(nearestSeamIndex(spans, boundaryAt(spans, 5))).toBe(5)
  })

  it('never returns an index without a following span', () => {
    const spans = SPANS
    for (let k = 0; k <= 200; k++) {
      const i = nearestSeamIndex(spans, k / 200)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThanOrEqual(spans.length - 2)
    }
  })
})

describe('gatherAt', () => {
  it('is 1 at the boundary', () => {
    const spans = SPANS
    expect(gatherAt(spans, boundaryAt(spans, 2), 2)).toBeCloseTo(1, 10)
  })

  it('is 0 outside its own band, for every boundary', () => {
    // Load-bearing: `seamAt` relies on this instead of a nearest-seam scan.
    const spans = SPANS
    for (let i = 0; i <= spans.length - 2; i++) {
      for (let k = 0; k <= 2000; k++) {
        const p = k / 2000
        const inBand = Math.abs(p - boundaryAt(spans, i)) < halfWidthAt(spans, i)
        if (!inBand) expect(gatherAt(spans, p, i)).toBe(0)
      }
    }
  })
})

describe('seamAt', () => {
  const SEAM = 2 // g1|g2 in the fixture

  it('is 0 exactly at the boundary', () => {
    expect(seamAt(SPANS, boundaryAt(SPANS, SEAM), SEAM)).toBeCloseTo(0, 10)
  })

  it('is -1 before the band and +1 after it', () => {
    const b = boundaryAt(SPANS, SEAM)
    const w = halfWidthAt(SPANS, SEAM)
    expect(seamAt(SPANS, b - w, SEAM)).toBeCloseTo(-1, 10)
    expect(seamAt(SPANS, b + w, SEAM)).toBeCloseTo(1, 10)
    expect(seamAt(SPANS, 0, SEAM)).toBeCloseTo(-1, 10)
    expect(seamAt(SPANS, 1, SEAM)).toBeCloseTo(1, 10)
  })

  it('changes sign only at the boundary', () => {
    const b = boundaryAt(SPANS, SEAM)
    for (let k = 0; k <= 4000; k++) {
      const p = k / 4000
      const s = seamAt(SPANS, p, SEAM)
      if (p < b) expect(s).toBeLessThanOrEqual(0)
      if (p > b) expect(s).toBeGreaterThanOrEqual(0)
    }
  })

  it('is continuous across the whole document', () => {
    // Stepped as k / STEPS, never accumulated: an accumulating loop drifts
    // short of 1.0 and never exercises the endpoint.
    const STEPS = 20000
    let prev = seamAt(SPANS, 0, SEAM)
    for (let k = 1; k <= STEPS; k++) {
      const s = seamAt(SPANS, k / STEPS, SEAM)
      expect(Math.abs(s - prev)).toBeLessThan(0.01)
      prev = s
    }
  })

  it('steps rather than returning NaN on a zero-width band', () => {
    const degenerate: Span[] = [
      { from: 0, to: 0.5, target: [0, 0, 0], hold: 1 },
      { from: 0.5, to: 0.5, target: [0, 0, 0], hold: 1 },
      { from: 0.5, to: 1, target: [0, 0, 0], hold: 1 },
    ]
    for (let k = 0; k <= 100; k++) {
      expect(Number.isNaN(seamAt(degenerate, k / 100, 1))).toBe(false)
    }
  })
})

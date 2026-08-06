import { describe, expect, it } from 'vitest'
import { boundaryAt, halfWidthAt, seamAt, type Span } from '~/three/flock'
import { LABELS } from './scenes'
import {
  SEED_SEAM,
  SEED_SEAM_INDEX,
  SEED_PLATEAU,
  seamPinnedAt,
  seamRole,
  seedPresence,
} from './seed'

/**
 * 1440x900 geometry as measured 2026-08-04, in progress units — historical:
 * read off the live page when the seam was g1|g2 and g3 was the 240vh track.
 * Still a valid fixture for the index-generic maths (`seamPinnedAt` is tested
 * at SEAM = 2 regardless of where the live seam sits), and kept because it was
 * measured rather than derived — the discipline flock.test.ts's BOUNDS keeps.
 * The live seam is now g2|g3; its browser measurements live in HANDOFF.md.
 */
const S = (from: number, to: number): Span => ({
  from: from / 14760,
  to: to / 14760,
  target: [0, 0, 0],
  hold: 0,
})
const SPANS: Span[] = [
  S(0, 900),
  S(900, 1800),
  S(1800, 4680),
  S(5580, 7560),
  S(8460, 10620),
  S(11520, 13860),
  S(14535, 15660),
]
const SEAM = 2
const px = (v: number) => v / 14760

describe('the seed seam', () => {
  it('names two labels that exist, in document order', () => {
    const out = LABELS.indexOf(SEED_SEAM.out)
    const inn = LABELS.indexOf(SEED_SEAM.in)
    expect(out).toBeGreaterThanOrEqual(0)
    expect(inn).toBe(out + 1)
  })

  it('indexes the seam by position, not by a hardcoded number', () => {
    expect(SEED_SEAM_INDEX).toBe(LABELS.indexOf(SEED_SEAM.out))
  })

  it('assigns a role to the two participants and nobody else', () => {
    expect(seamRole(SEED_SEAM.out)).toBe('out')
    expect(seamRole(SEED_SEAM.in)).toBe('in')
    expect(seamRole('g1')).toBeUndefined()
    expect(seamRole('g4')).toBeUndefined()
  })
})

describe('seedPresence', () => {
  it('is 0 at both band edges and 1 at the seam', () => {
    expect(seedPresence(-1)).toBe(0)
    expect(seedPresence(1)).toBe(0)
    expect(seedPresence(0)).toBe(1)
  })

  it('holds at 1 across a plateau rather than peaking at a point', () => {
    // The whole reason the constant exists: a bare 1 - |seam| would touch 1
    // for a single sample and read as a flicker, not a seed that persists.
    expect(seedPresence(0.2)).toBe(1)
    expect(seedPresence(-0.2)).toBe(1)
  })

  it('ramps linearly between the plateau edge and the band edge, not a step', () => {
    // A step function — e.g. `|seam| < 0.45 ? 1 : 0` — satisfies every
    // assertion above: 0 at both edges, 1 at the seam, 1 across ±0.2, and
    // always in 0..1. It would also reintroduce the pop SEED_PLATEAU exists
    // to remove, because nothing between the plateau and the band edge would
    // fade — the seed would simply vanish. Pin the actual ramp shape instead.
    expect(seedPresence(0.775)).toBeCloseTo((1 - 0.775) / SEED_PLATEAU, 6)
    expect(seedPresence(-0.775)).toBeCloseTo((1 - 0.775) / SEED_PLATEAU, 6)
    expect(seedPresence(0.6)).toBeCloseTo((1 - 0.6) / SEED_PLATEAU, 6)
  })

  it('never leaves 0..1', () => {
    for (let k = -200; k <= 200; k++) {
      const v = seedPresence(k / 100)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('seamPinnedAt', () => {
  it('reaches 0 exactly at the outgoing pin release, not at the boundary', () => {
    // The defect this function exists for. `seamAt` hits 0 at the boundary
    // (5130), 450px after g1's pin releases (4680) — and across those 450px the
    // ring is unpinned, so it travels up the screen while the seed does not.
    expect(seamPinnedAt(SPANS, px(4680), SEAM)).toBeCloseTo(0, 10)
    expect(seamAt(SPANS, px(4680), SEAM)).not.toBeCloseTo(0, 2)
  })

  it('holds at 0 across the whole unpinned gap', () => {
    // Neither ring is on screen here, so both stay collapsed and the seed
    // carries the transition alone.
    for (let p = 4680; p <= 5580; p += 30) {
      expect(seamPinnedAt(SPANS, px(p), SEAM)).toBe(0)
    }
  })

  it('does not begin opening the incoming ring before its pin takes hold', () => {
    expect(seamPinnedAt(SPANS, px(5579), SEAM)).toBe(0)
    expect(seamPinnedAt(SPANS, px(5581), SEAM)).toBeGreaterThan(0)
  })

  it('still starts and ends exactly where the flock band does', () => {
    // The remap must not decouple the transition's extent from the migration's
    // — only its interior. Same band edges, from the same shared helpers.
    const b = boundaryAt(SPANS, SEAM)
    const w = halfWidthAt(SPANS, SEAM)
    expect(seamPinnedAt(SPANS, b - w, SEAM)).toBe(-1)
    expect(seamPinnedAt(SPANS, b + w, SEAM)).toBe(1)
    expect(seamPinnedAt(SPANS, b - w * 1.5, SEAM)).toBe(-1)
    expect(seamPinnedAt(SPANS, b + w * 1.5, SEAM)).toBe(1)
  })

  it('is monotonic and continuous across the entire band', () => {
    // Continuity is the property the whole signed-scalar design rests on: a
    // step anywhere here is a visible jump in the ring's scale.
    const b = boundaryAt(SPANS, SEAM)
    const w = halfWidthAt(SPANS, SEAM)
    let previous = seamPinnedAt(SPANS, b - w * 1.2, SEAM)
    let worst = 0
    const STEPS = 4000
    for (let k = 0; k <= STEPS; k++) {
      // k / STEPS, never an accumulating add — an accumulator drifts short of
      // the far edge and never samples the saturating branch.
      const p = b - w * 1.2 + (k / STEPS) * (w * 2.4)
      const v = seamPinnedAt(SPANS, p, SEAM)
      expect(v).toBeGreaterThanOrEqual(previous - 1e-12)
      worst = Math.max(worst, Math.abs(v - previous))
      previous = v
    }
    expect(worst).toBeLessThan(0.01)
  })

  it('leaves both rings open when the seam index is out of range', () => {
    // Same contract as `seamAt`: +1 means the incoming ring reads open, and the
    // outgoing ring is not on this seam at all.
    expect(seamPinnedAt(SPANS, 0.3, -1)).toBe(1)
    expect(seamPinnedAt(SPANS, 0.3, SPANS.length)).toBe(1)
    expect(seamPinnedAt([], 0.3, 0)).toBe(1)
  })

  it('stays in -1..1 everywhere in the document', () => {
    for (let k = 0; k <= 1000; k++) {
      const v = seamPinnedAt(SPANS, k / 1000, SEAM)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('is continuous when the two spans are contiguous and the plateau vanishes', () => {
    // hero -> about are unpinned and share an edge, so `outEnd === inStart`.
    // Both branches must agree at that point rather than one of them owning it.
    const b = boundaryAt(SPANS, 0)
    const w = halfWidthAt(SPANS, 0)
    const at = SPANS[0]!.to
    expect(seamPinnedAt(SPANS, at, 0)).toBeCloseTo(0, 10)
    for (let k = -3; k <= 3; k++) {
      const v = seamPinnedAt(SPANS, at + k * (w / 500), 0)
      expect(Math.abs(v)).toBeLessThan(0.05)
    }
    expect(seamPinnedAt(SPANS, b - w, 0)).toBe(-1)
    expect(seamPinnedAt(SPANS, b + w, 0)).toBe(1)
  })
})

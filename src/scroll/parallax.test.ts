import { describe, expect, it } from 'vitest'
import { CALM, easePar, edgeIntensities, parAt, rawParAt } from './parallax'
import { LABELS, toneFor } from './scenes'

describe('edgeIntensities', () => {
  it('gives the full gesture across a tone flip and CALM across a match', () => {
    const [hero, about, g1, g2, g3, g4, contact] = edgeIntensities([
      'dark', 'cream', 'cream', 'dark', 'dark', 'cream', 'dark',
    ])
    expect(hero).toEqual({ enter: 1, exit: 1 }) // enter edge never seen; exit flips to cream
    expect(about).toEqual({ enter: 1, exit: CALM }) // in loud from hero, out quiet into g1
    expect(g1).toEqual({ enter: CALM, exit: 1 })
    expect(g2).toEqual({ enter: 1, exit: CALM })
    expect(g3).toEqual({ enter: CALM, exit: 1 })
    expect(g4).toEqual({ enter: 1, exit: 1 })
    expect(contact).toEqual({ enter: 1, exit: 1 }) // exit edge never seen
  })

  it('derives from the live declarations without a hand-kept list', () => {
    // The spine above is today's; this guards the derivation against reorders.
    expect(edgeIntensities(LABELS.map(toneFor))).toHaveLength(LABELS.length)
  })
})

describe('rawParAt', () => {
  const H = 800

  it('ramps -1 to 0 across one viewport of entry', () => {
    expect(rawParAt(1200, 2000, 2000, H)).toBe(-1)
    expect(rawParAt(1600, 2000, 2000, H)).toBe(-0.5)
    expect(rawParAt(2000, 2000, 2000, H)).toBe(0)
  })

  it('clamps below the entry ramp', () => {
    expect(rawParAt(0, 2000, 2000, H)).toBe(-1)
  })

  it('holds 0 across a pinned run', () => {
    expect(rawParAt(2500, 2000, 4000, H)).toBe(0)
    expect(rawParAt(4000, 2000, 4000, H)).toBe(0)
  })

  it('ramps 0 to 1 across one viewport of exit, then clamps', () => {
    expect(rawParAt(4400, 2000, 4000, H)).toBe(0.5)
    expect(rawParAt(4800, 2000, 4000, H)).toBe(1)
    expect(rawParAt(9000, 2000, 4000, H)).toBe(1)
  })

  it('degenerates cleanly when holdEnd equals top (unpinned section)', () => {
    expect(rawParAt(1999, 2000, 2000, H)).toBeCloseTo(-1 / 800)
    expect(rawParAt(2001, 2000, 2000, H)).toBeCloseTo(1 / 800)
  })

  it('guards a zero viewport', () => {
    expect(rawParAt(500, 2000, 2000, 0)).toBe(0)
  })
})

describe('easePar', () => {
  it('preserves sign and endpoints', () => {
    expect(easePar(-1)).toBe(-1)
    expect(easePar(0)).toBe(0)
    expect(easePar(1)).toBe(1)
    expect(easePar(-0.5)).toBe(-0.25)
    expect(easePar(0.5)).toBe(0.25)
  })

  it('has near-zero slope at the seat', () => {
    // quadratic: the step from 0 to 0.01 moves the output by 0.0001, not 0.01
    expect(Math.abs(easePar(0.01))).toBeLessThan(0.001)
  })
})

describe('parAt', () => {
  const H = 800
  const geo = { top: 2000, holdEnd: 4000, enter: 1, exit: CALM }

  it('scales the entering ramp by the enter edge and the exit by the exit edge', () => {
    expect(parAt(1600, geo, H)).toBe(-0.25) // eased -0.5² × enter 1
    expect(parAt(4400, geo, H)).toBeCloseTo(0.25 * CALM)
  })

  it('is continuous across both joins', () => {
    // sweep the whole life in 10px steps; no step may jump more than the
    // steepest slope of the eased ramp (2/H per px × intensity, ~0.025 here)
    let prev = parAt(1100, geo, H)
    for (let s = 1110; s <= 4900; s += 10) {
      const v = parAt(s, geo, H)
      expect(Math.abs(v - prev)).toBeLessThan(0.03)
      prev = v
    }
  })
})

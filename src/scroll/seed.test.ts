import { describe, expect, it } from 'vitest'
import { LABELS } from './scenes'
import { SEED_SEAM, SEED_SEAM_INDEX, SEED_PLATEAU, seamRole, seedPresence } from './seed'

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

import { describe, expect, it } from 'vitest'
import { LABELS } from './scenes'
import { SEED_SEAM, SEED_SEAM_INDEX, seamRole, seedPresence } from './seed'

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

  it('never leaves 0..1', () => {
    for (let k = -200; k <= 200; k++) {
      const v = seedPresence(k / 100)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

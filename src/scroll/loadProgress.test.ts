import { describe, expect, it } from 'vitest'
import { advance, MIN_DURATION } from './loadProgress'

const AFTER = MIN_DURATION + 1

describe('advance', () => {
  it('moves toward the target without reaching past it', () => {
    const next = advance(0, 0.4, 16, AFTER)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThanOrEqual(0.4)
  })

  it('never goes backwards when the target drops', () => {
    expect(advance(0.6, 0.2, 16, AFTER)).toBe(0.6)
  })

  it('holds short of 1 until the minimum duration has passed', () => {
    let written = 0
    for (let i = 0; i < 200; i++) written = advance(written, 1, 16, 100)
    expect(written).toBeLessThan(1)
    expect(written).toBeGreaterThan(0.9)
  })

  it('reaches exactly 1 once the target is 1 and the floor has passed', () => {
    let written = 0
    for (let i = 0; i < 200; i++) written = advance(written, 1, 16, AFTER)
    expect(written).toBe(1)
  })

  it('is frame-rate independent', () => {
    const oneBigStep = advance(0, 1, 32, AFTER)
    const twoSmallSteps = advance(advance(0, 1, 16, AFTER), 1, 16, AFTER)
    expect(Math.abs(oneBigStep - twoSmallSteps)).toBeLessThan(0.01)
  })

  it('clamps a nonsense target into range', () => {
    expect(advance(0, 5, 16, AFTER)).toBeLessThanOrEqual(1)
    expect(advance(0, -5, 16, AFTER)).toBe(0)
  })
})

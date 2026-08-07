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

  // Named for what it asserts, not for the defect it was written against: the
  // monotonic clamp masks an epsilon snap that fires on a dropping target
  // structurally, so no test can tell the two versions apart. The contract
  // below — a falling target never drags `written` with it — is real, and it
  // is the one worth pinning.
  it('holds steady when the target drops, and snaps onto a target already within epsilon', () => {
    // Decreasing target should hold written steady, not snap downward
    let written = 0.6
    const firstFrame = advance(written, 0.2, 16, AFTER)
    expect(firstFrame).toBe(0.6)

    const secondFrame = advance(firstFrame, 0.2, 16, AFTER)
    expect(secondFrame).toBe(0.6)

    // Target just under written but outside epsilon should not drag it down
    written = 0.5
    const smallDropTarget = advance(written, 0.499, 16, AFTER)
    expect(smallDropTarget).toBe(0.5)

    // But a target inside epsilon that we're chasing toward should snap
    written = 0.001
    const towardEpsilon = advance(written, 0.0011, 16, AFTER)
    expect(towardEpsilon).toBe(0.0011)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import {
  beginReveal,
  finishReveal,
  forceComplete,
  getPhase,
  load,
  reportLoad,
  reportModelFraction,
  resetLoadingForTest,
  WEIGHTS,
} from './loading'

beforeEach(() => resetLoadingForTest())

describe('milestone accounting', () => {
  it('weighs the three milestones to exactly 1', () => {
    expect(WEIGHTS.chunk + WEIGHTS.model + WEIGHTS.frame).toBeCloseTo(1)
  })

  it('accumulates target as milestones land', () => {
    reportLoad('chunk')
    expect(load.target).toBeCloseTo(0.4)
    reportLoad('model')
    expect(load.target).toBeCloseTo(0.8)
    reportLoad('frame')
    expect(load.target).toBe(1)
  })

  it('is idempotent and order-independent', () => {
    reportLoad('frame')
    reportLoad('frame')
    expect(load.target).toBeCloseTo(0.2)
    reportLoad('chunk')
    reportLoad('model')
    expect(load.target).toBe(1)
  })

  it('fills the model band continuously', () => {
    reportLoad('chunk')
    reportModelFraction(0.5)
    expect(load.target).toBeCloseTo(0.6)
    reportLoad('model')
    expect(load.target).toBeCloseTo(0.8)
  })

  it('never lets the model fraction pull the target back down', () => {
    reportModelFraction(0.9)
    const high = load.target
    reportModelFraction(0.1)
    expect(load.target).toBe(high)
  })

  it('forceComplete finishes regardless of milestones', () => {
    forceComplete()
    expect(load.target).toBe(1)
  })
})

describe('phase', () => {
  it('starts at loading when the loader plays', () => {
    expect(getPhase()).toBe('loading')
  })

  it('advances one way only', () => {
    beginReveal()
    expect(getPhase()).toBe('revealing')
    beginReveal()
    expect(getPhase()).toBe('revealing')
    finishReveal()
    expect(getPhase()).toBe('done')
  })

  it('cannot be walked backwards', () => {
    finishReveal()
    beginReveal()
    expect(getPhase()).toBe('done')
  })
})

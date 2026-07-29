import { describe, expect, it } from 'vitest'
import { SNAP_EPSILON, needsSnap, pinLengthPx, scrollAtProgress } from './timelineMath'
import { progressAtIndex } from '~/lib/ring'

describe('pinLengthPx', () => {
  it('converts a vh pin length against the viewport', () => {
    expect(pinLengthPx(320, 900)).toBe(2880)
    expect(pinLengthPx(220, 1000)).toBe(2200)
  })

  it('collapses to nothing on a zero-height viewport', () => {
    expect(pinLengthPx(320, 0)).toBe(0)
  })
})

describe('scrollAtProgress', () => {
  it('maps progress onto the trigger range', () => {
    expect(scrollAtProgress(1000, 3880, 0)).toBe(1000)
    expect(scrollAtProgress(1000, 3880, 1)).toBe(3880)
    expect(scrollAtProgress(1000, 3880, 0.5)).toBe(2440)
  })
})

describe('needsSnap', () => {
  it('is false when already sitting on a stop', () => {
    expect(needsSnap(progressAtIndex(7, 24), 24)).toBe(false)
    expect(needsSnap(0, 24)).toBe(false)
    expect(needsSnap(1, 24)).toBe(false)
  })

  it('is true between stops', () => {
    expect(needsSnap(0.4, 7)).toBe(true)
  })

  it('tolerates float drift within epsilon', () => {
    expect(needsSnap(progressAtIndex(7, 24) + SNAP_EPSILON / 2, 24)).toBe(false)
  })

  it('never asks a single-piece category to snap', () => {
    expect(needsSnap(0.4, 1)).toBe(false)
  })
})

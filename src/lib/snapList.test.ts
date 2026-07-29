import { describe, expect, it } from 'vitest'
import { SNAP_ITEM_WIDTH, nearestIndex, snapListGutter } from './snapList'

describe('snapListGutter', () => {
  it('is symmetric, half the item width on each side', () => {
    expect(snapListGutter(250)).toBe('calc(50% - 125px)')
  })

  it('defaults to the shared item width constant', () => {
    expect(snapListGutter()).toBe(`calc(50% - ${SNAP_ITEM_WIDTH / 2}px)`)
  })
})

describe('nearestIndex', () => {
  it('picks the closest centre', () => {
    expect(nearestIndex(100, [0, 100, 300])).toBe(1)
  })

  it('keeps the earliest match on an exact tie', () => {
    expect(nearestIndex(50, [0, 100])).toBe(0)
  })

  it('defaults to 0 with no centres', () => {
    expect(nearestIndex(500, [])).toBe(0)
  })

  it('never selects a null item, which reports a centre of Infinity', () => {
    const centres = [Infinity, 40, Infinity]
    expect(nearestIndex(42, centres)).toBe(1)
  })

  // The bug the symmetric gutter fixes: 24 items, 250px wide, 18px gaps, on a
  // 1440px viewport with a `calc(50% - 125px)` gutter on both sides. At
  // maxScroll the last item's centre must land exactly on the viewport
  // midpoint — with the old asymmetric `pl-6` gutter it fell short and the
  // 21st item won instead, leaving the tail unreachable.
  describe('fully scrolled right, symmetric gutter', () => {
    const itemWidth = 250
    const gap = 18
    const clientWidth = 1440
    const count = 24
    const gutter = clientWidth / 2 - itemWidth / 2 // matches snapListGutter(250) at this viewport
    const centres = Array.from(
      { length: count },
      (_, i) => gutter + i * (itemWidth + gap) + itemWidth / 2,
    )
    const contentWidth = count * itemWidth + (count - 1) * gap
    const scrollWidth = contentWidth + gutter * 2
    const maxScroll = scrollWidth - clientWidth

    it('selects the first item at scrollLeft 0', () => {
      const mid = 0 + clientWidth / 2
      expect(nearestIndex(mid, centres)).toBe(0)
    })

    it('selects the last item once scrolled fully right', () => {
      const mid = maxScroll + clientWidth / 2
      expect(nearestIndex(mid, centres)).toBe(count - 1)
    })
  })
})

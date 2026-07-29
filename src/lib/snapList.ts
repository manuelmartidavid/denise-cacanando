/**
 * Pure geometry for the pin-free snap list — no DOM, so the nearest-item
 * search that drives activeIndex can be exercised without a browser.
 *
 * The item width is shared between the centring gutter and the card markup
 * so the two can never drift apart into an asymmetric layout again.
 */

/** The fixed card width baked into SnapList's markup. */
export const SNAP_ITEM_WIDTH = 250

/**
 * Symmetric centring gutter: half the item width on each side, so the first
 * and last cards can both reach the viewport's centre, not just the ones with
 * a full item's width of neighbours on either side.
 */
export const snapListGutter = (itemWidth: number = SNAP_ITEM_WIDTH): string =>
  `calc(50% - ${itemWidth / 2}px)`

/**
 * Which item centre sits nearest the viewport midpoint. Ties keep the
 * earliest match, same as the scroll-snap settle it tracks never straddling
 * two stops at once.
 */
export const nearestIndex = (mid: number, centres: number[]): number => {
  let best = 0
  let bestDistance = Infinity
  centres.forEach((centre, i) => {
    const d = Math.abs(centre - mid)
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  })
  return best
}

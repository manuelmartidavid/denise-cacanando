import { describe, expect, it } from 'vitest'
import { layoutField, metricsFor, panBounds, sizeFor } from './field'
import { artworks, aspectOf, type Piece } from '~/data'

const W = 1440
const H = 900
const metrics = metricsFor(W, H)
const laid = layoutField(artworks, metrics)
const pan = panBounds(laid, W)

/** Where a piece's box sits horizontally at pan index `at`. */
const spanAt = (item: (typeof laid)[number], at: number) => {
  const p = (pan.start + pan.step * at) * item.parallax
  return { left: item.x + p - item.width / 2, right: item.x + p + item.width / 2 }
}

describe('sizeFor', () => {
  it('gives every aspect the same area, so a landscape and a portrait weigh the same', () => {
    const area = (a: number) => {
      const { width, height } = sizeFor(a, 90000)
      return width * height
    }
    for (const a of [0.5, 0.73, 1.34, 2, 3.45]) expect(area(a), `aspect ${a}`).toBeCloseTo(90000, 6)
  })

  it('preserves the aspect', () => {
    for (const a of [0.73, 1, 2]) {
      const { width, height } = sizeFor(a, 90000)
      expect(width / height).toBeCloseTo(a, 6)
    }
  })

  it('falls back to square on an unparseable size rather than throwing', () => {
    const { width, height } = sizeFor(null)
    expect(width).toBeCloseTo(height)
    expect(Number.isFinite(width)).toBe(true)
  })
})

describe('metricsFor', () => {
  it('keeps roughly the same number of pieces in view at any width', () => {
    const inView = (w: number, h: number) => w / metricsFor(w, h).pitch
    const counts = [
      inView(1280, 800),
      inView(1440, 900),
      inView(1680, 1050),
      inView(1920, 1080),
    ]
    for (const n of counts) {
      expect(n).toBeGreaterThan(3.4)
      expect(n).toBeLessThan(5.2)
    }
  })

  it('clamps the pitch rather than running away on an ultrawide', () => {
    expect(metricsFor(3840, 1600).pitch).toBeLessThanOrEqual(430)
    expect(metricsFor(900, 700).pitch).toBeGreaterThanOrEqual(250)
  })

  it('sizes off the smaller ratio, so a short window does not overflow vertically', () => {
    // Wide but short: area must follow the height, not the width.
    expect(metricsFor(1920, 700).area).toBeLessThan(metricsFor(1920, 1200).area)
  })

  it('scales area as the square of a linear scale', () => {
    const a = metricsFor(1440, 900).area
    const b = metricsFor(720, 450).area
    // 0.5 linear clamps at 0.7, so compare against the clamp rather than 0.25.
    expect(b / a).toBeCloseTo(0.7 * 0.7, 5)
  })
})

describe('layoutField', () => {
  it('places every piece', () => {
    expect(laid).toHaveLength(artworks.length)
  })

  it('is deterministic — the same list lays out identically twice', () => {
    expect(layoutField(artworks, metrics)).toEqual(laid)
  })

  it('advances one pitch per piece, jitter aside', () => {
    for (const item of laid) {
      expect(Math.abs(item.x - item.index * metrics.pitch), item.piece.slug).toBeLessThanOrEqual(60)
    }
  })

  it('never stacks two neighbours in the same lane', () => {
    for (let i = 1; i < laid.length; i++) {
      expect(Math.abs(laid[i]!.y - laid[i - 1]!.y), `${i - 1} → ${i}`).toBeGreaterThan(30)
    }
  })

  it('sizes each piece at its own aspect', () => {
    for (const item of laid) {
      expect(item.width / item.height, item.piece.slug).toBeCloseTo(aspectOf(item.piece.size)!, 5)
    }
  })

  it('keeps every piece inside the frame vertically', () => {
    for (const item of laid) {
      expect(H / 2 + item.y - item.height / 2, `${item.piece.slug} top`).toBeGreaterThan(0)
      expect(H / 2 + item.y + item.height / 2, `${item.piece.slug} bottom`).toBeLessThan(H)
    }
  })

  it('varies depth, yaw and roll rather than emitting a flat grid', () => {
    const distinct = (xs: number[]) => new Set(xs.map((n) => n.toFixed(3))).size
    expect(distinct(laid.map((i) => i.depth))).toBeGreaterThan(artworks.length / 2)
    expect(distinct(laid.map((i) => i.yaw))).toBeGreaterThan(artworks.length / 2)
    expect(laid.some((i) => i.roll > 0)).toBe(true)
    expect(laid.some((i) => i.roll < 0)).toBe(true)
  })

  it('keeps depth and parallax inside their declared bands', () => {
    for (const item of laid) {
      expect(item.depth).toBeGreaterThanOrEqual(0.62)
      expect(item.depth).toBeLessThanOrEqual(1.32)
      // Parallax is a small deviation from a uniform pan, never a multiplier
      // large enough to tear the strip apart at the far end.
      expect(Math.abs(item.parallax - 1)).toBeLessThan(0.03)
    }
  })

  it('does not depend on the pieces being artworks', () => {
    const odd: Piece[] = [
      { slug: 'a', title: 'A', medium: 'm', size: 'One of one — M', year: 2025, status: 'available', images: [] },
    ]
    const out = layoutField(odd, metrics)
    expect(out).toHaveLength(1)
    expect(out[0]!.width).toBeCloseTo(out[0]!.height)
  })
})

describe('panBounds — the ends of the scene', () => {
  it('opens with the leftmost piece just inside the left edge', () => {
    const left = Math.min(...laid.map((i) => spanAt(i, 0).left))
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left).toBeLessThan(60)
  })

  it('closes with the rightmost piece just inside the right edge', () => {
    const last = laid.length - 1
    const right = Math.max(...laid.map((i) => spanAt(i, last).right))
    expect(right).toBeLessThanOrEqual(W)
    expect(right).toBeGreaterThan(W - 60)
  })

  it('leaves no half-empty frame at either end', () => {
    const last = laid.length - 1
    // At the start nothing should be hanging off the left; at the end nothing
    // off the right. Either would be the whitespace this exists to close.
    expect(Math.min(...laid.map((i) => spanAt(i, 0).left))).toBeGreaterThanOrEqual(0)
    expect(Math.max(...laid.map((i) => spanAt(i, last).right))).toBeLessThanOrEqual(W)
  })

  it('fills the frame throughout, not only at the two ends', () => {
    for (let at = 0; at <= laid.length - 1; at += 0.5) {
      const covered = laid.some((i) => {
        const { left, right } = spanAt(i, at)
        return right > W * 0.25 && left < W * 0.75
      })
      expect(covered, `nothing across the middle at at=${at}`).toBe(true)
    }
  })

  it('pans left as the index advances', () => {
    expect(pan.step).toBeLessThan(0)
  })

  it('holds still rather than panning backwards when the strip fits the frame', () => {
    const few = layoutField(artworks.slice(0, 2), metrics)
    expect(panBounds(few, 4000).step).toBeLessThanOrEqual(0)
  })

  it('survives an empty or single-piece category', () => {
    expect(panBounds([], W)).toEqual({ start: 0, step: 0 })
    expect(panBounds(layoutField(artworks.slice(0, 1), metrics), W).step).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  artworks,
  categories,
  categoryByPath,
  merch,
  murals,
  ovalese,
  resolvePiece,
  totalPieces,
} from './index'
import type { Piece } from './types'

const all: Piece[] = categories.flatMap((c) => c.pieces)

/**
 * Counts are the one thing the client has confirmed. If these fail, either the
 * data drifted or the brief changed — check with Denise before editing them.
 */
describe('confirmed counts', () => {
  it('ships 24 / 7 / 7 / 12', () => {
    expect(artworks).toHaveLength(24)
    expect(ovalese).toHaveLength(7)
    expect(murals).toHaveLength(7)
    expect(merch).toHaveLength(12)
  })

  it('totals 50 pieces', () => {
    expect(totalPieces).toBe(50)
  })

  it('splits murals BGC 4 / Layaw 3', () => {
    expect(murals.filter((m) => m.location === 'bgc')).toHaveLength(4)
    expect(murals.filter((m) => m.location === 'layaw')).toHaveLength(3)
  })

  it('splits merch jackets 5 / bags 4 / shirts 2 / earrings 1', () => {
    const by = (k: string) => merch.filter((m) => m.kind === k).length
    expect(by('jackets')).toBe(5)
    expect(by('bags')).toBe(4)
    expect(by('shirts')).toBe(2)
    expect(by('earrings')).toBe(1)
  })
})

describe('record integrity', () => {
  it('gives every piece a URL-safe slug', () => {
    for (const p of all) {
      expect(p.slug, `"${p.title}" has a slug that would break its route`).toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
      )
    }
  })

  it('keeps slugs unique within a category', () => {
    for (const c of categories) {
      const slugs = c.pieces.map((p) => p.slug)
      expect(new Set(slugs).size, `duplicate slug in ${c.id}`).toBe(slugs.length)
    }
  })

  it('fills in every required field', () => {
    for (const p of all) {
      expect(p.title.length, `${p.slug} has no title`).toBeGreaterThan(0)
      expect(p.medium.length, `${p.slug} has no medium`).toBeGreaterThan(0)
      expect(p.size.length, `${p.slug} has no size`).toBeGreaterThan(0)
      expect(p.year, `${p.slug} has an implausible year`).toBeGreaterThan(2000)
      expect(p.images.length, `${p.slug} has no images`).toBeGreaterThan(0)
    }
  })

  it('describes every image, since the alt text is the placeholder label too', () => {
    for (const p of all) {
      for (const img of p.images) {
        expect(img.alt.length, `${p.slug} has an unlabelled image`).toBeGreaterThan(0)
      }
    }
  })
})

describe('category shape', () => {
  it('carries 8 angle shots per egg for the 2K map', () => {
    for (const egg of ovalese) {
      expect(egg.images.filter((i) => i.role === 'angle'), `${egg.slug}`).toHaveLength(8)
    }
  })

  it('gives every wall a context shot and at least two detail crops', () => {
    for (const wall of murals) {
      expect(wall.images.filter((i) => i.role === 'context'), `${wall.slug}`).toHaveLength(1)
      expect(
        wall.images.filter((i) => i.role === 'detail').length,
        `${wall.slug} is below the two-detail-crop minimum`,
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('tags every merch item with a filter kind', () => {
    for (const m of merch) expect(m.kind, `${m.slug} would vanish from the chips`).toBeDefined()
  })

  it('tags every mural with a chapter', () => {
    for (const m of murals) expect(m.location, `${m.slug} belongs to no chapter`).toBeDefined()
  })
})

describe('routing', () => {
  it('resolves merchandise by its URL segment, not its id', () => {
    expect(categoryByPath('merchandise')?.id).toBe('merch')
    expect(categoryByPath('merch')).toBeUndefined()
  })

  it('resolves a piece with its neighbours', () => {
    const r = resolvePiece('artworks', 'hour-before-closing')
    expect(r?.index).toBe(1)
    expect(r?.prev?.slug).toBe('floral-bouquet')
    expect(r?.next?.slug).toBe('sampaguita-study')
  })

  it('does not wrap at the ends of a category', () => {
    expect(resolvePiece('ovalese', 'first-shell')?.prev).toBeNull()
    expect(resolvePiece('ovalese', 'wingcase')?.next).toBeNull()
  })

  it('returns null for anything unknown', () => {
    expect(resolvePiece('artworks', 'nope')).toBeNull()
    expect(resolvePiece('nope', 'floral-bouquet')).toBeNull()
    expect(resolvePiece(undefined, undefined)).toBeNull()
  })

  it('resolves every piece from its own category path', () => {
    for (const c of categories) {
      for (const p of c.pieces) {
        expect(resolvePiece(c.path, p.slug)?.piece.slug, `${c.path}/${p.slug}`).toBe(p.slug)
      }
    }
  })
})

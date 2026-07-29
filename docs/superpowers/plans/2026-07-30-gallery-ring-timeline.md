# Gallery Ring + Scroll Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the master scroll timeline and the rotating gallery ring, so all four gallery scenes pin, rotate, snap to pieces, and fall back to a pin-free snap list under reduced motion or below 900px.

**Architecture:** One pure index model (`lib/ring.ts`) drives two presentations — a pinned rotating dial and a pin-free horizontal list. `scroll/timeline.ts` is the sole owner of GSAP: it creates one ScrollTrigger per section, writes rotation to a mutable frame object, and publishes `activeIndex` to React only when the rounded index changes. Rotation reaches the DOM as a single CSS custom property per frame.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind v4, GSAP ScrollTrigger, Lenis, Vitest, react-router 8.

**Design spec:** `docs/superpowers/specs/2026-07-30-gallery-ring-timeline-design.md`

## Global Constraints

- **The invariant:** rotation never enters React state; `activeIndex` never enters the frame loop. `src/scroll/store.ts` documents this split — hold to it.
- **GSAP lives in exactly one module:** `src/scroll/timeline.ts`. No component imports `gsap` or `ScrollTrigger`.
- **Counts are never hardcoded in a view.** Read from `data`, via `activeCount(scene)`.
- Import alias is `~` → `src/` (`vite.config.ts:11`).
- Vitest runs `environment: 'node'`, `include: ['src/**/*.test.ts']` (`vite.config.ts:14-17`). **Only `.test.ts` files run, and there is no DOM.** Every test in this plan is a pure-function test. Do not add jsdom or component tests — the presentations are verified in the browser.
- Design tokens live in `src/styles/index.css` under `@theme`. Use the token utilities (`ph-dark`, `ph-focus`, `ovoid`, `apparatus`, `text-caption`, `tracking-caption`, …). Never hardcode a hex that already has a token.
- Hairlines are always 1px, never 2px. Mono labels are always uppercase and letter-spaced.
- Placeholder imagery: every piece renders `<Placeholder label={...} />` — no `<img>` anywhere, no imagery exists.
- Commit after every task. Conventional prefixes: `feat:`, `test:`, `refactor:`, `fix:`.

---

### Task 1: Rewrite `lib/ring.ts` to the seats model

The current module models the ring as `360 / count` — 24 pieces means seats every 15°. The design of record draws **eight seats at 45°** with the focused piece on a separate centre plate (`Ovalese Site - Pollen Dial.dc.html:122-131`). At 15° spacing, 112px thumbs on a 326px orbit overlap. Thirteen exports encode the wrong model and are deleted.

**Files:**
- Modify: `src/lib/ring.ts` (full rewrite, 102 lines → ~55)
- Test: `src/lib/ring.test.ts` (full rewrite, 171 lines)

**Interfaces:**
- Consumes: nothing.
- Produces: `seatStep(seats: number): number`, `rotationAtProgress(p: number, count: number, seats: number): number`, `indexAtProgress(p: number, count: number): number`, `progressAtIndex(index: number, count: number): number`, `snapProgress(p: number, count: number): number`, `seatContent(activeIndex: number, seats: number, count: number): number[]`, `trackProgress(index: number, count: number): number`.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `src/lib/ring.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  indexAtProgress,
  progressAtIndex,
  rotationAtProgress,
  seatContent,
  seatStep,
  snapProgress,
  trackProgress,
} from './ring'

// The seat/piece pairings we actually ship. See src/scroll/scenes.ts.
const ARTWORKS = { count: 24, seats: 8 }
const OVALESE = { count: 7, seats: 6 }
const MERCH = { count: 12, seats: 6 }

describe('seatStep', () => {
  it('divides the circle by the seats, not by the piece count', () => {
    expect(seatStep(8)).toBe(45)
    expect(seatStep(6)).toBe(60)
  })

  it('does not divide by zero', () => {
    expect(seatStep(0)).toBe(0)
  })
})

describe('rotationAtProgress', () => {
  it('starts unrotated', () => {
    expect(rotationAtProgress(0, 24, 8)).toBe(0)
  })

  it('matches the totals in the design spec', () => {
    expect(rotationAtProgress(1, ARTWORKS.count, ARTWORKS.seats)).toBe(1035)
    expect(rotationAtProgress(1, OVALESE.count, OVALESE.seats)).toBe(360)
    expect(rotationAtProgress(1, MERCH.count, MERCH.seats)).toBe(660)
  })

  it('advances exactly one seat per piece', () => {
    expect(rotationAtProgress(progressAtIndex(1, 24), 24, 8)).toBeCloseTo(45)
    expect(rotationAtProgress(progressAtIndex(1, 7), 7, 6)).toBeCloseTo(60)
  })

  it('is monotonic across the scene', () => {
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const r = rotationAtProgress(i / 20, 24, 8)
      expect(r).toBeGreaterThan(prev)
      prev = r
    }
  })

  it('does not rotate a single-piece category', () => {
    expect(rotationAtProgress(1, 1, 6)).toBe(0)
  })
})

describe('indexAtProgress', () => {
  it('hits the first and last piece exactly at the endpoints', () => {
    for (const { count } of [ARTWORKS, OVALESE, MERCH]) {
      expect(indexAtProgress(0, count)).toBe(0)
      expect(indexAtProgress(1, count)).toBe(count - 1)
    }
  })

  it('round-trips with progressAtIndex for every piece we ship', () => {
    for (const { count } of [ARTWORKS, OVALESE, MERCH]) {
      for (let i = 0; i < count; i++) {
        expect(indexAtProgress(progressAtIndex(i, count), count)).toBe(i)
      }
    }
  })

  it('clamps rather than running off either end', () => {
    expect(indexAtProgress(-0.5, 24)).toBe(0)
    expect(indexAtProgress(1.5, 24)).toBe(23)
  })

  it('handles an empty category', () => {
    expect(indexAtProgress(0.5, 0)).toBe(0)
  })
})

describe('snapProgress', () => {
  it('lands on a stop', () => {
    expect(snapProgress(0.5, 7)).toBeCloseTo(progressAtIndex(3, 7))
  })

  it('is idempotent', () => {
    for (const p of [0, 0.13, 0.5, 0.77, 1]) {
      const once = snapProgress(p, 24)
      expect(snapProgress(once, 24)).toBeCloseTo(once)
    }
  })

  it('is a no-op on a single-piece category', () => {
    expect(snapProgress(0.4, 1)).toBe(0)
  })
})

describe('seatContent', () => {
  it('fills every seat forward from the focus', () => {
    expect(seatContent(0, 8, 24)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('wraps past the end of the category', () => {
    expect(seatContent(22, 8, 24)).toEqual([23, 0, 1, 2, 3, 4, 5, 6])
  })

  it('never shows the focused piece on the orbit', () => {
    for (let i = 0; i < 24; i++) {
      expect(seatContent(i, 8, 24)).not.toContain(i)
    }
  })

  it('shows all seven eggs at once — six on the orbit plus the centre', () => {
    const orbit = seatContent(0, 6, 7)
    expect(orbit).toHaveLength(6)
    expect(new Set([...orbit, 0]).size).toBe(7)
  })

  it('caps at count - 1 so a filtered ring never repeats a piece', () => {
    expect(seatContent(0, 6, 1)).toEqual([]) // earrings: the centre only
    expect(seatContent(0, 6, 3)).toEqual([1, 2])
  })

  it('handles an empty category', () => {
    expect(seatContent(0, 6, 0)).toEqual([])
  })
})

describe('trackProgress', () => {
  it('runs 0 to 1 across the category', () => {
    expect(trackProgress(0, 24)).toBe(0)
    expect(trackProgress(23, 24)).toBe(1)
  })

  it('does not divide by zero on a single-piece category', () => {
    expect(trackProgress(0, 1)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/ring.test.ts`
Expected: FAIL — `seatStep`, `rotationAtProgress`, `indexAtProgress`, `progressAtIndex`, `snapProgress`, `seatContent` are not exported by `./ring`.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/lib/ring.ts`:

```ts
/**
 * Ring geometry for the Pollen Dial.
 *
 * Pure functions only — no React, no DOM, no GSAP. The scroll timeline supplies
 * a progress and these turn it into a rotation, an index, and the pieces sitting
 * on the orbit. Keeping this separate is what makes the pin-free snap list
 * possible: the list reuses the index model without computing a coordinate.
 *
 * THE MODEL: the ring is N orbit seats plus one centre slot, and the orbit is a
 * WINDOW onto the category — not a seat per piece. The design of record draws
 * eight seats at 45° for a 24-piece category, with the focused piece on a
 * separate centre plate (Ovalese Site - Pollen Dial.dc.html:122-131). The
 * focused piece is NEVER on the orbit.
 *
 * Positioning is CSS, not arithmetic: the ring carries --r and each seat
 * counter-rotates off it, so no coordinate helper is needed here.
 */

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/** Angular gap between neighbouring seats. Artworks 45°, Ovalese/Merch 60°. */
export const seatStep = (seats: number): number => (seats > 0 ? 360 / seats : 0)

/**
 * Ring rotation in degrees at scroll progress p. One seat-step per piece, so a
 * 24-piece scene turns 1035° (2.9 turns) and a 7-piece scene turns exactly once.
 */
export const rotationAtProgress = (p: number, count: number, seats: number): number =>
  p * Math.max(0, count - 1) * seatStep(seats)

/** Focused piece at progress p. Piece 0 at p=0, piece n-1 at p=1. */
export const indexAtProgress = (p: number, count: number): number =>
  count <= 0 ? 0 : clamp(Math.round(p * (count - 1)), 0, count - 1)

/** The progress at which `index` is focused — the snap stops. */
export const progressAtIndex = (index: number, count: number): number =>
  count > 1 ? clamp(index, 0, count - 1) / (count - 1) : 0

/** Nearest snap stop. Idempotent, so re-running a settled snap is a no-op. */
export const snapProgress = (p: number, count: number): number =>
  progressAtIndex(indexAtProgress(p, count), count)

/**
 * Piece indices occupying the orbit seats, forward from the focus.
 *
 * Length is min(seats, count - 1): the centre holds one piece, and a merch ring
 * filtered down to a single earring must not repeat that piece around the orbit.
 */
export const seatContent = (activeIndex: number, seats: number, count: number): number[] => {
  const n = Math.min(Math.max(0, seats), Math.max(0, count - 1))
  return Array.from({ length: n }, (_, i) => (activeIndex + 1 + i) % count)
}

/** 0–1 across the category, for the `07 / 24` progress row and its track dot. */
export const trackProgress = (index: number, count: number): number =>
  count > 1 ? index / (count - 1) : 0
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/ring.test.ts`
Expected: PASS — all suites green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ring.ts src/lib/ring.test.ts
git commit -m "refactor: model the ring as seats plus a centre slot, not one seat per piece"
```

---

### Task 2: Add `presentation` and `seats` to the scene declarations

Making the presentation a per-scene declaration is what lets you later swap the dial for the list as a data change instead of a retrofit — the two presentations have different scroll contracts, and the timeline reads pin behaviour from this field.

**Files:**
- Modify: `src/scroll/scenes.ts`
- Create: `src/scroll/scenes.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `type Presentation = 'dial' | 'track'`; `type GalleryLabel = 'g1' | 'g2' | 'g3' | 'g4'`; `GalleryScene` gains `presentation: Presentation` and `seats: number` and loses `visible`; `activePieces(scene: GalleryScene): Piece[]`; `activeCount(scene: GalleryScene): number`.

- [ ] **Step 1: Write the failing test**

Create `src/scroll/scenes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { GALLERY_SCENES, LABELS, activeCount, activePieces, sceneByLabel } from './scenes'
import { setMerchFilter } from './store'

describe('GALLERY_SCENES', () => {
  it('declares one scene per gallery label, in scroll order', () => {
    expect(GALLERY_SCENES.map((s) => s.label)).toEqual(['g1', 'g2', 'g3', 'g4'])
  })

  it('uses labels that exist on the master timeline', () => {
    for (const s of GALLERY_SCENES) expect(LABELS).toContain(s.label)
  })

  it('covers every category exactly once', () => {
    const ids = GALLERY_SCENES.map((s) => s.category)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every dial scene enough pieces to fill its orbit without repeating', () => {
    // The centre holds one piece and the orbit is a window onto the rest,
    // so count - 1 must cover every seat.
    for (const s of GALLERY_SCENES.filter((x) => x.presentation === 'dial')) {
      expect(s.seats).toBeGreaterThan(0)
      expect(activeCount(s) - 1).toBeGreaterThanOrEqual(s.seats)
    }
  })

  it('pins every scene for a positive length, proportional to piece count', () => {
    for (const s of GALLERY_SCENES) expect(s.length).toBeGreaterThan(0)
    expect(sceneByLabel('g1')!.length).toBe(320)
    expect(sceneByLabel('g2')!.length).toBe(220)
    expect(sceneByLabel('g3')!.length).toBe(240)
    expect(sceneByLabel('g4')!.length).toBe(260)
  })

  it('gives the dial scenes an orbit and the track scene none', () => {
    for (const s of GALLERY_SCENES) {
      if (s.presentation === 'dial') expect(s.orbit).toBeGreaterThan(0)
      else expect(s.orbit).toBe(0)
    }
  })
})

describe('activeCount', () => {
  it('reads the full category when nothing is filtered', () => {
    setMerchFilter(null)
    expect(activeCount(sceneByLabel('g1')!)).toBe(24)
    expect(activeCount(sceneByLabel('g2')!)).toBe(7)
    expect(activeCount(sceneByLabel('g4')!)).toBe(12)
  })

  it('narrows to the filtered kind on the merch scene only', () => {
    setMerchFilter('jackets')
    expect(activeCount(sceneByLabel('g4')!)).toBe(5)
    expect(activeCount(sceneByLabel('g1')!)).toBe(24) // filter is merch-only
    setMerchFilter('earrings')
    expect(activeCount(sceneByLabel('g4')!)).toBe(1)
    setMerchFilter(null)
  })
})

describe('activePieces', () => {
  it('returns the pieces themselves, not just how many', () => {
    setMerchFilter(null)
    expect(activePieces(sceneByLabel('g2')!).map((p) => p.slug)).toHaveLength(7)
  })

  it('returns the filtered pieces — indices must address the ring the user sees', () => {
    // The ring indexes into THIS list. Slicing the unfiltered category instead
    // would show the first five merch pieces rather than the five jackets.
    setMerchFilter('jackets')
    const pieces = activePieces(sceneByLabel('g4')!)
    expect(pieces).toHaveLength(5)
    expect(pieces.every((p) => p.kind === 'jackets')).toBe(true)
    setMerchFilter(null)
  })

  it('agrees with activeCount', () => {
    for (const scene of GALLERY_SCENES) {
      expect(activePieces(scene)).toHaveLength(activeCount(scene))
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scroll/scenes.test.ts`
Expected: FAIL — `activeCount` is not exported by `./scenes`, and `presentation` does not exist on the scene objects.

- [ ] **Step 3: Write the implementation**

In `src/scroll/scenes.ts`, replace the `GalleryScene` type and the `GALLERY_SCENES` array, and add `activeCount`. Keep `LABELS`, `RAIL_STOPS`, `sceneByLabel` and `sceneCount` as they are.

```ts
import { categories } from '~/data'
import type { CategoryId } from '~/data'
import { getScrollState } from './store'

/** How a scene declares itself. What actually renders may fall back — see scroll/presentation.ts. */
export type Presentation = 'dial' | 'track'

export type GalleryLabel = Extract<Label, 'g1' | 'g2' | 'g3' | 'g4'>

export type GalleryScene = {
  label: GalleryLabel
  category: CategoryId
  /** `dial` rotates and pins; `track` unrolls into an x-translate. Murals break pattern. */
  presentation: Presentation
  /** Orbit seats — NOT the piece count. The orbit is a window onto the category. */
  seats: number
  /** Pin length in vh. Proportional to piece count — see README timeline spec. */
  length: number
  /** Ground colour. Merchandise flips to cream so product reads as product. */
  ground: 'dark' | 'cream'
  /** Outer guide circle, px. 0 in `track` mode. */
  guide: number
  /** Thumb orbit radius, px. 0 in `track` mode. */
  orbit: number
}

export const GALLERY_SCENES: GalleryScene[] = [
  { label: 'g1', category: 'artworks', presentation: 'dial', seats: 8, length: 320, ground: 'dark', guide: 660, orbit: 326 },
  { label: 'g2', category: 'ovalese', presentation: 'dial', seats: 6, length: 220, ground: 'dark', guide: 640, orbit: 326 },
  { label: 'g3', category: 'murals', presentation: 'track', seats: 0, length: 240, ground: 'dark', guide: 0, orbit: 0 },
  { label: 'g4', category: 'merch', presentation: 'dial', seats: 6, length: 260, ground: 'cream', guide: 600, orbit: 296 },
]
```

Then add below `sceneCount`:

```ts
/**
 * The pieces actually in play. Selecting a merch chip re-blooms a smaller ring,
 * so this is not a constant — and every index in the ring addresses THIS list.
 * Reading the filtered pieces rather than slicing the full category is what
 * keeps a filtered ring showing five jackets instead of the first five products.
 */
export const activePieces = (scene: GalleryScene): Piece[] => {
  const pieces = categories.find((c) => c.id === scene.category)?.pieces ?? []
  if (scene.category !== 'merch') return pieces
  const filter = getScrollState().merchFilter
  return filter ? pieces.filter((p) => p.kind === filter) : pieces
}

/** How many pieces are in play. The timeline's rotation mapping reads this. */
export const activeCount = (scene: GalleryScene): number => activePieces(scene).length
```

The `Piece` type comes from the same import as `CategoryId`:

```ts
import type { CategoryId, Piece } from '~/data'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/scroll/scenes.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix the one existing consumer**

`src/sections/GalleryScene.tsx:98` reads `scene.orbit` inside a string and `scene.mode`. Change `scene.mode === 'ring'` to `scene.presentation === 'dial'` in all three places it appears (lines ~61, ~97, ~124). This file is rewritten in Task 10; this step only keeps the build green.

Run: `npm run typecheck`
Expected: PASS — no references to `mode` or `visible` remain.

- [ ] **Step 6: Commit**

```bash
git add src/scroll/scenes.ts src/scroll/scenes.test.ts src/sections/GalleryScene.tsx
git commit -m "feat: declare presentation and orbit seats per gallery scene"
```

---

### Task 3: Resolve which presentation actually renders

**Files:**
- Create: `src/scroll/presentation.ts`
- Create: `src/scroll/presentation.test.ts`
- Create: `src/scroll/usePresentation.ts`

**Interfaces:**
- Consumes: `Presentation` from `~/scroll/scenes` (Task 2).
- Produces: `type Rendered = 'dial' | 'list' | 'track'`; `resolvePresentation(declared: Presentation, reduced: boolean, compact: boolean): Rendered`; `usePresentation(declared: Presentation): Rendered`.

Two distinct unions on purpose: `Presentation` is what a scene *declares*, `Rendered` is what actually renders.

- [ ] **Step 1: Write the failing test**

Create `src/scroll/presentation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolvePresentation } from './presentation'

describe('resolvePresentation', () => {
  it('renders the dial when motion is allowed and there is room', () => {
    expect(resolvePresentation('dial', false, false)).toBe('dial')
  })

  it('falls back to the pin-free list under reduced motion', () => {
    expect(resolvePresentation('dial', true, false)).toBe('list')
  })

  it('falls back to the pin-free list below 900px', () => {
    expect(resolvePresentation('dial', false, true)).toBe('list')
  })

  it('falls back once, not twice, when both apply', () => {
    expect(resolvePresentation('dial', true, true)).toBe('list')
  })

  it('leaves a track scene alone — its fallback belongs to the Murals spec', () => {
    expect(resolvePresentation('track', true, true)).toBe('track')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scroll/presentation.test.ts`
Expected: FAIL — cannot find module `./presentation`.

- [ ] **Step 3: Write the implementation**

Create `src/scroll/presentation.ts`:

```ts
import type { Presentation } from './scenes'

/** What actually renders, as opposed to what the scene declares. */
export type Rendered = 'dial' | 'list' | 'track'

/**
 * A `track` scene always resolves to `track` — the Murals x-translate track and
 * its fallback belong to a separate spec.
 *
 * A `dial` scene falls back to the pin-free list under reduced motion or below
 * 900px. Both routes reach every piece and carry the same links: nothing
 * structural is lost, which is the requirement, not a nicety.
 */
export const resolvePresentation = (
  declared: Presentation,
  reduced: boolean,
  compact: boolean,
): Rendered => {
  if (declared === 'track') return 'track'
  return reduced || compact ? 'list' : 'dial'
}
```

Create `src/scroll/usePresentation.ts`:

```ts
import { useCompactLayout, useReducedMotion } from './useReducedMotion'
import { resolvePresentation, type Rendered } from './presentation'
import type { Presentation } from './scenes'

/** Thin hook wrapper — the decision itself is pure and tested in presentation.test.ts. */
export const usePresentation = (declared: Presentation): Rendered =>
  resolvePresentation(declared, useReducedMotion(), useCompactLayout())
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/scroll/presentation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scroll/presentation.ts src/scroll/presentation.test.ts src/scroll/usePresentation.ts
git commit -m "feat: resolve dial vs list presentation from motion and viewport"
```

---

### Task 4: Pure timeline arithmetic

Extracting these three keeps the untestable part of `timeline.ts` (GSAP, DOM, Lenis) as thin as possible.

**Files:**
- Create: `src/scroll/timelineMath.ts`
- Create: `src/scroll/timelineMath.test.ts`

**Interfaces:**
- Consumes: `snapProgress` from `~/lib/ring` (Task 1).
- Produces: `pinLengthPx(lengthVh: number, viewportHeight: number): number`; `scrollAtProgress(start: number, end: number, p: number): number`; `SNAP_EPSILON: number`; `needsSnap(p: number, count: number, epsilon?: number): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/scroll/timelineMath.test.ts`:

```ts
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
    expect(needsSnap(0.5, 7)).toBe(true)
  })

  it('tolerates float drift within epsilon', () => {
    expect(needsSnap(progressAtIndex(7, 24) + SNAP_EPSILON / 2, 24)).toBe(false)
  })

  it('never asks a single-piece category to snap', () => {
    expect(needsSnap(0.4, 1)).toBe(false)
  })
})
```

Note on the last case: `progressAtIndex` returns 0 for `count <= 1`, and `needsSnap` compares against `snapProgress` which is also 0 — but `0.4` is not within epsilon of `0`. Implement `needsSnap` to return `false` when `count < 2`, since there is nowhere to snap to.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scroll/timelineMath.test.ts`
Expected: FAIL — cannot find module `./timelineMath`.

- [ ] **Step 3: Write the implementation**

Create `src/scroll/timelineMath.ts`:

```ts
import { snapProgress } from '~/lib/ring'

/** A scene declares its pin length in vh; ScrollTrigger wants document px. */
export const pinLengthPx = (lengthVh: number, viewportHeight: number): number =>
  (lengthVh / 100) * viewportHeight

/** Document scroll position for a progress within a trigger's range. */
export const scrollAtProgress = (start: number, end: number, p: number): number =>
  start + p * (end - start)

/** Float drift below this is not worth a correction the user would feel. */
export const SNAP_EPSILON = 0.001

/**
 * Whether an idle scroll sits far enough off a stop to be worth correcting.
 * A category of one has nowhere to snap to.
 */
export const needsSnap = (p: number, count: number, epsilon = SNAP_EPSILON): boolean =>
  count >= 2 && Math.abs(p - snapProgress(p, count)) > epsilon
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/scroll/timelineMath.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scroll/timelineMath.ts src/scroll/timelineMath.test.ts
git commit -m "feat: add pure pin-length, scroll-mapping and snap-threshold helpers"
```

---

### Task 5: Build the timeline — triggers, pins, rotation, index

Nothing on the page currently creates a ScrollTrigger. This task makes every section register its label, pins the dial scenes, and drives rotation and `activeIndex`. **Snapping is deliberately not in this task** — it lands in Task 6, so a reviewer can accept the timeline and reject the snap feel independently.

**Files:**
- Modify: `src/scroll/timeline.ts` (48 lines → ~150)
- Modify: `src/routes/ScrollPage.tsx`

**Interfaces:**
- Consumes: `rotationAtProgress`, `indexAtProgress`, `progressAtIndex` (Task 1); `GALLERY_SCENES`, `activeCount`, `GalleryLabel` (Task 2); `Rendered`, `resolvePresentation` (Task 3); `pinLengthPx`, `scrollAtProgress` (Task 4).
- Produces: `buildTimeline(resolved: Record<GalleryLabel, Rendered>): void`; `killTimeline(): void`; `onSceneRotation(label: GalleryLabel, cb: (rotation: number) => void): () => void`; `scrollToPiece(label: GalleryLabel, index: number, count: number): void`; `refreshTimeline(): void`.

- [ ] **Step 1: Add the timeline builder**

In `src/scroll/timeline.ts`, keep every existing export (`registerLabel`, `getLabelOffset`, `scrollToLabel`, `refreshAfterFonts`, `clearLabels`, and the `ScrollTrigger, gsap` re-export). Add these imports at the top:

```ts
import { GALLERY_SCENES, activeCount, type GalleryLabel } from './scenes'
import type { Rendered } from './presentation'
import { frame, setActiveIndex, setLabel } from './store'
import { indexAtProgress, progressAtIndex, rotationAtProgress } from '~/lib/ring'
import { pinLengthPx, scrollAtProgress } from './timelineMath'
```

Then append:

```ts
type Rotate = (rotation: number) => void

const rotationListeners = new Map<GalleryLabel, Rotate>()
const sceneTriggers = new Map<GalleryLabel, ScrollTrigger>()
let triggers: ScrollTrigger[] = []

/**
 * A Dial registers the single DOM write it owns, and GSAP never leaves this
 * module. Fires once immediately so a freshly mounted ring is not stuck at 0°.
 */
export const onSceneRotation = (label: GalleryLabel, cb: Rotate): (() => void) => {
  rotationListeners.set(label, cb)
  cb(frame.rotation[label])
  return () => {
    rotationListeners.delete(label)
  }
}

/** Clicking a thumb rotates it to centre by scrolling to that piece's stop. */
export const scrollToPiece = (label: GalleryLabel, index: number, count: number): void => {
  const trigger = sceneTriggers.get(label)
  const lenis = getLenis()
  if (!trigger || !lenis) return
  const target = scrollAtProgress(trigger.start, trigger.end, progressAtIndex(index, count))
  lenis.scrollTo(target, { duration: 0.6 })
}

/** Selecting a merch chip changes the piece count; layout must be remeasured. */
export const refreshTimeline = (): void => ScrollTrigger.refresh()

export const killTimeline = (): void => {
  for (const t of triggers) t.kill()
  triggers = []
  sceneTriggers.clear()
  clearLabels()
}

/**
 * Builds every ScrollTrigger on the page.
 *
 * One trigger per section, not one gsap.timeline() — a single timeline cannot
 * pin four sections independently, so the "master timeline" of the design spec
 * is this module rather than a GSAP object. It still owns all seven labels, the
 * proportional pins, and the one post-fonts refresh.
 *
 * `resolved` says how each gallery scene is actually rendering: a dial pins and
 * scrubs, a list does neither and owns its own scrolling.
 */
export const buildTimeline = (resolved: Record<GalleryLabel, Rendered>): void => {
  killTimeline()

  // Whole-document progress, for the r3f stage.
  triggers.push(
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        frame.progress = self.progress
      },
    }),
  )

  for (const label of ['hero', 'about', 'contact'] as const) {
    const el = document.getElementById(label)
    if (!el) continue
    triggers.push(
      ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom top',
        onRefresh: (self) => registerLabel(label, self.start),
        onEnter: () => setLabel(label),
        onEnterBack: () => setLabel(label),
      }),
    )
  }

  for (const scene of GALLERY_SCENES) {
    const el = document.getElementById(scene.label)
    if (!el) continue
    const label = scene.label

    if (resolved[label] !== 'dial') {
      // No pin, no scrub: the list and the track scaffold own their own scrolling.
      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top top',
          end: 'bottom top',
          onRefresh: (self) => registerLabel(label, self.start),
          onEnter: () => setLabel(label),
          onEnterBack: () => setLabel(label),
        }),
      )
      continue
    }

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: () => '+=' + pinLengthPx(scene.length, window.innerHeight),
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onRefresh: (self) => registerLabel(label, self.start),
      onEnter: () => setLabel(label),
      onEnterBack: () => setLabel(label),
      onUpdate: (self) => {
        const p = self.progress
        const count = activeCount(scene)

        frame.sceneProgress = p
        const rotation = rotationAtProgress(p, count, scene.seats)
        frame.rotation[label] = rotation
        rotationListeners.get(label)?.(rotation)

        // Discrete channel: ~24 React updates across a 320vh pin, never 60/s.
        setActiveIndex(scene.category, indexAtProgress(p, count))
      },
    })

    sceneTriggers.set(label, trigger)
    triggers.push(trigger)
  }
}
```

- [ ] **Step 2: Wire it into the page**

Rewrite `src/routes/ScrollPage.tsx`. Resolve every scene's presentation once at this level — calling the two media hooks once and mapping is cleaner than a hook per scene, and the resolved map is what both the timeline and the scene components need.

```tsx
import { useEffect, useMemo } from 'react'
import { Hero } from '~/sections/Hero'
import { About } from '~/sections/About'
import { GalleryScene } from '~/sections/GalleryScene'
import { Contact } from '~/sections/Contact'
import { SideRail } from '~/components/SideRail'
import { Stage } from '~/three/Stage'
import { GALLERY_SCENES, type GalleryLabel } from '~/scroll/scenes'
import { resolvePresentation, type Rendered } from '~/scroll/presentation'
import { useCompactLayout, useReducedMotion } from '~/scroll/useReducedMotion'
import { useLenis, getLenis } from '~/scroll/useLenis'
import { buildTimeline, killTimeline, refreshAfterFonts } from '~/scroll/timeline'
import { useScrollState } from '~/scroll/store'

const KEY = 'ovalese:scroll'

/**
 * The single-page scroll site. Detail pages are separate routes, so this
 * unmounts when one opens — including the r3f canvas and every ScrollTrigger.
 */
export const ScrollPage = () => {
  const { label } = useScrollState()
  const reduced = useReducedMotion()
  const compact = useCompactLayout()
  useLenis()

  const resolved = useMemo(
    () =>
      Object.fromEntries(
        GALLERY_SCENES.map((s) => [s.label, resolvePresentation(s.presentation, reduced, compact)]),
      ) as Record<GalleryLabel, Rendered>,
    [reduced, compact],
  )

  useEffect(() => {
    buildTimeline(resolved)
    refreshAfterFonts()

    // Restore the position the visitor left from when they come back off a
    // detail route. Immediate, so they land where they were rather than
    // watching the page scroll itself there.
    const saved = sessionStorage.getItem(KEY)
    if (saved) {
      const top = Number(saved)
      requestAnimationFrame(() => {
        const lenis = getLenis()
        if (lenis) lenis.scrollTo(top, { immediate: true })
        else window.scrollTo(0, top)
      })
    }

    const save = () => sessionStorage.setItem(KEY, String(window.scrollY))
    window.addEventListener('scroll', save, { passive: true })

    return () => {
      window.removeEventListener('scroll', save)
      save()
      killTimeline()
    }
  }, [resolved])

  // The rail flips to ink on cream grounds (About, Merchandise).
  const ground = label === 'about' || label === 'g4' ? 'cream' : 'dark'

  return (
    <>
      <Stage />
      <SideRail ground={ground} />
      <main className="relative z-10">
        <Hero />
        <About />
        {GALLERY_SCENES.map((scene) => (
          <GalleryScene key={scene.label} scene={scene} rendered={resolved[scene.label]} />
        ))}
        <Contact />
      </main>
    </>
  )
}
```

- [ ] **Step 3: Accept the new prop so the build passes**

In `src/sections/GalleryScene.tsx`, change the props type to `type Props = { scene: Scene; rendered: Rendered }` and destructure `rendered` (unused for now — Task 10 uses it). Import `type Rendered` from `~/scroll/presentation`. Add `void rendered` immediately after destructuring so `noUnusedLocals` does not fail the build.

- [ ] **Step 4: Verify the whole suite and the types**

Run: `npm run typecheck && npm test`
Expected: PASS — 4 test files green, no type errors.

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open the served URL, and confirm:
- Scrolling pins Artworks, Ovalese, Murals and Merchandise in turn, each releasing before the next begins.
- The progress row counter climbs `01 / 24` → `24 / 24` across the Artworks pin and reaches 24 exactly as the pin releases.
- The side rail's active diamond changes as you pass each section.
- No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/scroll/timeline.ts src/routes/ScrollPage.tsx src/sections/GalleryScene.tsx
git commit -m "feat: build the master scroll timeline with pinned gallery scenes"
```

---

### Task 6: Snap the scroll on rest, through Lenis

`ScrollTrigger.snap` animates `window.scrollTo` directly, and `useLenis.ts:29` already makes Lenis the scroll authority. Two things writing scroll position fight, and it shows up as jitter that is miserable to reproduce. So the snap goes through Lenis.

**Files:**
- Modify: `src/scroll/timeline.ts`

**Interfaces:**
- Consumes: `needsSnap`, `scrollAtProgress` (Task 4); `snapProgress` (Task 1); `activeCount` (Task 2).
- Produces: no new exports — behaviour only.

- [ ] **Step 1: Add the idle-snap to the dial trigger**

In `src/scroll/timeline.ts`, extend the imports:

```ts
import { indexAtProgress, progressAtIndex, rotationAtProgress, snapProgress } from '~/lib/ring'
import { needsSnap, pinLengthPx, scrollAtProgress } from './timelineMath'
```

Add the constants and the timer registry next to the other module-level values:

```ts
/** Long enough that a snap never fires mid-gesture, short enough to feel immediate. */
const SNAP_IDLE_MS = 120
const SNAP_DURATION = 0.35

/**
 * The pending idle timer per scene, so a route change cannot leave one firing
 * into a dead trigger. One entry per scene, replaced each frame — an array would
 * grow by one every onUpdate and never shrink.
 */
const snapTimers = new Map<GalleryLabel, ReturnType<typeof setTimeout>>()
```

Extend `killTimeline` to clear them — add these two lines at the top of its body:

```ts
  for (const t of snapTimers.values()) clearTimeout(t)
  snapTimers.clear()
```

Inside `buildTimeline`, in the dial branch, declare the timer above the `ScrollTrigger.create` call:

```ts
    let idle: ReturnType<typeof setTimeout> | undefined
```

and append this to the end of the existing `onUpdate` body:

```ts
        // Snap settles on rest, never mid-gesture. Reading self.progress inside
        // the timeout rather than closing over `p` matters: by the time it fires
        // the user has moved on, and snapping to a stale progress fights them.
        if (idle) clearTimeout(idle)
        idle = setTimeout(() => {
          const at = self.progress
          const n = activeCount(scene)
          const lenis = getLenis()
          if (!self.isActive || !lenis || !needsSnap(at, n)) return
          const target = scrollAtProgress(self.start, self.end, snapProgress(at, n))
          lenis.scrollTo(target, { duration: SNAP_DURATION })
        }, SNAP_IDLE_MS)
        snapTimers.set(label, idle)
```

- [ ] **Step 2: Verify types and the suite still pass**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Verify the feel in the browser**

Run: `npm run dev` and confirm:
- Stopping mid-scene settles the scroll onto the nearest piece within roughly a sixth of a second.
- Snapping never fires while you are still scrolling — scroll continuously through the whole Artworks pin and it should never grab.
- Scrolling backwards retraces the same stops.
- With reduced motion enabled in the OS, no snapping happens at all and no pin exists.

- [ ] **Step 4: Commit**

```bash
git add src/scroll/timeline.ts
git commit -m "feat: settle the ring onto a piece when scrolling stops"
```

---

### Task 7: The centre slot

The focused piece is never on the orbit — it lives on this plate. The cross-fade here is the documented seam the r3f ripple replaces when real textures land.

**Files:**
- Create: `src/sections/ring/look.ts`
- Create: `src/sections/ring/CentreSlot.tsx`
- Modify: `src/styles/index.css`

**Interfaces:**
- Consumes: `Category`, `Piece` from `~/data`.
- Produces: `RING_LOOK: Record<CategoryId, RingLook>` where `type RingLook = { slot: 'circle' | 'ovoid' | 'square'; slotW: number; slotH: number; thumbW: number; thumbH: number }`; `<CentreSlot category piece onCream />`.

- [ ] **Step 1: Add the fade-out utility**

In `src/styles/index.css`, add after the `ovoid` utility:

```css
/* Centre-slot cross-fade. An animation, not a transition — the outgoing layer
   mounts already-visible and must fade without a state flip to trigger it. */
@utility fade-out {
  animation: ovalese-fade-out 380ms ease forwards;
}
@keyframes ovalese-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
```

- [ ] **Step 2: Add the per-category ring geometry**

Create `src/sections/ring/look.ts`:

```ts
import type { CategoryId } from '~/data'

export type RingLook = {
  /** Centre-plate silhouette. */
  slot: 'circle' | 'ovoid' | 'square'
  slotW: number
  slotH: number
  thumbW: number
  thumbH: number
}

/** Slot and thumb geometry per category — README "Spacing & geometry". */
export const RING_LOOK: Record<CategoryId, RingLook> = {
  artworks: { slot: 'circle', slotW: 280, slotH: 280, thumbW: 112, thumbH: 112 },
  ovalese: { slot: 'ovoid', slotW: 248, slotH: 312, thumbW: 98, thumbH: 124 },
  merch: { slot: 'square', slotW: 250, slotH: 250, thumbW: 150, thumbH: 150 },
  murals: { slot: 'square', slotW: 0, slotH: 0, thumbW: 0, thumbH: 0 }, // track scene, unused
}

export const SHAPE_CLASS: Record<RingLook['slot'], string> = {
  circle: 'rounded-full',
  ovoid: 'ovoid',
  square: '',
}
```

- [ ] **Step 3: Write the centre slot**

Create `src/sections/ring/CentreSlot.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import type { Category, Piece } from '~/data'
import { RING_LOOK, SHAPE_CLASS } from './look'

const CROSSFADE_MS = 380

type Props = {
  category: Category
  piece: Piece | undefined
  onCream: boolean
}

/**
 * RIPPLE SEAM — the whole of the piece-arrival transition lives in this one
 * component. Today it is a DOM cross-fade; when real textures land, the r3f
 * displacement shader replaces the two stacked layers and nothing else in the
 * ring moves. Do not spread transition logic outward from here.
 */
export const CentreSlot = ({ category, piece, onCream }: Props) => {
  const look = RING_LOOK[category.id]
  const [outgoing, setOutgoing] = useState<Piece | null>(null)
  const last = useRef<Piece | undefined>(piece)

  useEffect(() => {
    if (!piece || last.current?.slug === piece.slug) return
    setOutgoing(last.current ?? null)
    last.current = piece
    const t = setTimeout(() => setOutgoing(null), CROSSFADE_MS)
    return () => clearTimeout(t)
  }, [piece])

  if (!piece) return null

  const shape = SHAPE_CLASS[look.slot]
  const box = { width: look.slotW, height: look.slotH }

  return (
    <>
      <Link
        to={`/${category.path}/${piece.slug}`}
        aria-label={`Open ${piece.title}`}
        className={`absolute block overflow-hidden border border-ochre/45 shadow-glow-strong ${shape}`}
        style={{ ...box, transform: 'translate(-50%, -50%)' }}
      >
        <Placeholder
          label={piece.images[0]?.alt ?? piece.title}
          tone={onCream ? 'cream' : 'focus'}
          className={`size-full ${shape}`}
        />
        {outgoing && (
          <Placeholder
            key={outgoing.slug}
            label={outgoing.images[0]?.alt ?? outgoing.title}
            tone={onCream ? 'cream' : 'focus'}
            className={`fade-out absolute inset-0 ${shape}`}
          />
        )}
      </Link>

      <div
        className={`absolute w-[320px] text-center font-mono text-caption tracking-caption uppercase ${
          onCream ? 'text-ink/62' : 'text-cream/55'
        }`}
        style={{ transform: 'translate(-50%, -50%) translate(0, 196px)' }}
      >
        <p>
          “{piece.title}” · {piece.medium}
        </p>
        <p>
          {piece.size} · {piece.year} — Enquire
        </p>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Verify types**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sections/ring/look.ts src/sections/ring/CentreSlot.tsx src/styles/index.css
git commit -m "feat: add the centre slot with its cross-fade ripple seam"
```

---

### Task 8: The dial presentation

**Files:**
- Create: `src/sections/ring/Dial.tsx`

**Interfaces:**
- Consumes: `seatContent`, `seatStep` (Task 1); `GalleryScene`, `activePieces` (Task 2); `onSceneRotation`, `scrollToPiece` (Task 5); `RING_LOOK`, `SHAPE_CLASS`, `CentreSlot` (Task 7).
- Produces: `<Dial scene activeIndex />`.

- [ ] **Step 1: Write the dial**

Create `src/sections/ring/Dial.tsx`:

```tsx
import { useEffect, useRef, type CSSProperties } from 'react'
import { Placeholder } from '~/components/Placeholder'
import { categoryById } from '~/data'
import { seatContent, seatStep } from '~/lib/ring'
import { activePieces, type GalleryScene } from '~/scroll/scenes'
import { onSceneRotation, scrollToPiece } from '~/scroll/timeline'
import { CentreSlot } from './CentreSlot'
import { RING_LOOK, SHAPE_CLASS } from './look'

type Props = {
  scene: GalleryScene
  activeIndex: number
}

/**
 * The pinned rotating presentation.
 *
 * Rotation arrives as ONE CSS custom property per frame: the ring turns on --r
 * and every seat counter-rotates off the same value, so crops stay upright while
 * the compositor does the work. React re-renders only when activeIndex changes —
 * roughly 24 times across a 320vh pin, never 60 times a second.
 */
export const Dial = ({ scene, activeIndex }: Props) => {
  const ring = useRef<HTMLDivElement>(null)
  const category = categoryById(scene.category)!
  const look = RING_LOOK[scene.category]
  // Indices address THIS list — a filtered merch ring is five jackets, not the
  // first five products in the category.
  const pieces = activePieces(scene)
  const count = pieces.length
  const onCream = scene.ground === 'cream'
  const shape = SHAPE_CLASS[look.slot]

  // The single DOM write this component owns. GSAP stays inside timeline.ts.
  useEffect(
    () =>
      onSceneRotation(scene.label, (rotation) => {
        ring.current?.style.setProperty('--r', `${rotation}deg`)
      }),
    [scene.label],
  )

  const seats = seatContent(activeIndex, scene.seats, count)

  return (
    <div className="absolute" style={{ left: '62%', top: '52%' }}>
      {/* Guide circles — presentation chrome, not interactive. */}
      <div
        className="absolute rounded-full border border-cream/10"
        style={{ width: scene.guide, height: scene.guide, transform: 'translate(-50%, -50%)' }}
      />
      <div
        className="absolute rounded-full border border-dashed border-cream/12"
        style={{ width: 460, height: 460, transform: 'translate(-50%, -50%)' }}
      />

      <div
        ref={ring}
        className="absolute"
        style={
          {
            '--r': '0deg',
            '--step': `${seatStep(scene.seats)}deg`,
            '--orbit': `${scene.orbit}px`,
            transform: 'rotate(var(--r))',
          } as CSSProperties
        }
      >
        {seats.map((pieceIndex, i) => {
          const piece = pieces[pieceIndex]
          if (!piece) return null
          return (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPiece(scene.label, pieceIndex, count)}
              aria-label={`Bring ${piece.title} to centre`}
              className={`absolute overflow-hidden border border-cream/14 ${shape}`}
              style={
                {
                  '--i': i,
                  width: look.thumbW,
                  height: look.thumbH,
                  transform:
                    'translate(-50%, -50%) rotate(calc(var(--i) * var(--step)))' +
                    ' translate(0, calc(-1 * var(--orbit))) rotate(calc(-1 * var(--r)))',
                } as CSSProperties
              }
            >
              <Placeholder
                label={piece.images[0]?.alt ?? piece.title}
                tone={onCream ? 'cream' : 'dim'}
                className={`size-full ${shape}`}
              />
            </button>
          )
        })}
      </div>

      <CentreSlot category={category} piece={pieces[activeIndex]} onCream={onCream} />
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/sections/ring/Dial.tsx
git commit -m "feat: add the rotating dial presentation driven by one CSS variable"
```

---

### Task 9: The snap-list presentation

The pin-free path. Every piece stays reachable and every item is a real link — that is what "nothing structural is lost" means.

**Files:**
- Create: `src/sections/ring/SnapList.tsx`

**Interfaces:**
- Consumes: `GalleryScene`, `activePieces` (Task 2); `setActiveIndex` from `~/scroll/store`.
- Produces: `<SnapList scene activeIndex />`.

- [ ] **Step 1: Write the list**

Create `src/sections/ring/SnapList.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import { categoryById } from '~/data'
import { activePieces, type GalleryScene } from '~/scroll/scenes'
import { setActiveIndex } from '~/scroll/store'

type Props = {
  scene: GalleryScene
  activeIndex: number
}

/**
 * The pin-free presentation: reduced motion, and anything under 900px.
 *
 * No rotation, no pin, no GSAP. Native scroll-snap does the settling, and the
 * nearest item publishes the same activeIndex the dial would — the caption,
 * progress row and routes are identical either way.
 */
export const SnapList = ({ scene, activeIndex }: Props) => {
  const list = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLAnchorElement | null)[]>([])
  const category = categoryById(scene.category)!
  const onCream = scene.ground === 'cream'
  // The filtered list, not a slice of the full category — see activePieces.
  const pieces = activePieces(scene)

  useEffect(() => {
    const el = list.current
    if (!el) return
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let bestDistance = Infinity
      items.current.forEach((item, i) => {
        if (!item) return
        const centre = item.offsetLeft + item.clientWidth / 2
        const d = Math.abs(centre - mid)
        if (d < bestDistance) {
          bestDistance = d
          best = i
        }
      })
      setActiveIndex(scene.category, best)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scene.category])

  return (
    <div
      ref={list}
      className="absolute right-0 left-0 flex snap-x snap-mandatory gap-[18px] overflow-x-auto pl-6"
      style={{ top: '50%', transform: 'translateY(-50%)', scrollbarWidth: 'none' }}
    >
      {pieces.map((piece, i) => (
        <Link
          key={piece.slug}
          ref={(el) => {
            items.current[i] = el
          }}
          to={`/${category.path}/${piece.slug}`}
          className={`shrink-0 snap-center overflow-hidden border transition-opacity ${
            i === activeIndex
              ? 'border-ochre/55 opacity-100 shadow-glow'
              : `opacity-55 ${onCream ? 'border-ink/25' : 'border-cream/14'}`
          }`}
          style={{ width: 250, height: 330 }}
        >
          <Placeholder
            label={piece.images[0]?.alt ?? piece.title}
            tone={onCream ? 'cream' : i === activeIndex ? 'focus' : 'dim'}
            className="size-full"
          />
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/sections/ring/SnapList.tsx
git commit -m "feat: add the pin-free snap list presentation"
```

---

### Task 10: Wire the presentations into the gallery scene

Also lands the merch filter chips, and the one edge case worth designing for: filtering 12 pieces down to 5 changes the piece count mid-scene.

**Files:**
- Modify: `src/sections/GalleryScene.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2, 3, 7, 8, 9; `setMerchFilter` and `useScrollState` from `~/scroll/store`; `refreshTimeline` (Task 5); `trackProgress` (Task 1).
- Produces: no new exports.

- [ ] **Step 1: Rewrite the scene component**

Replace `src/sections/GalleryScene.tsx` in full:

```tsx
import { useEffect } from 'react'
import { categories, categoryById, merch, type MerchKind } from '~/data'
import { trackProgress } from '~/lib/ring'
import { activeCount, type GalleryScene as Scene } from '~/scroll/scenes'
import type { Rendered } from '~/scroll/presentation'
import { setActiveIndex, setMerchFilter, useScrollState } from '~/scroll/store'
import { refreshTimeline } from '~/scroll/timeline'
import { Dial } from './ring/Dial'
import { SnapList } from './ring/SnapList'

type Props = { scene: Scene; rendered: Rendered }

const MERCH_KINDS: MerchKind[] = ['jackets', 'bags', 'shirts', 'earrings']

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 03–06 · Gallery scenes. One component, four configurations.
 *
 * The furniture — title block, category list, progress row — is shared by every
 * presentation. Only the middle changes: a pinned rotating dial, a pin-free snap
 * list, or (Murals) the track scaffold, which is deliberately unfinished and
 * belongs to a separate spec.
 */
export const GalleryScene = ({ scene, rendered }: Props) => {
  const { activeIndex, merchFilter } = useScrollState()
  const category = categoryById(scene.category)!
  const count = activeCount(scene)
  const index = Math.min(activeIndex[scene.category], Math.max(0, count - 1))
  const onCream = scene.ground === 'cream'

  // Selecting a chip re-blooms a smaller ring: the piece count changes, so the
  // old index can point past the end. Reset it and remeasure.
  useEffect(() => {
    if (scene.category !== 'merch') return
    setActiveIndex('merch', 0)
    refreshTimeline()
  }, [merchFilter, scene.category])

  return (
    <section
      id={scene.label}
      className={`relative h-screen w-full overflow-hidden ${
        onCream ? 'bg-cream text-ink' : 'bg-ink text-cream'
      }`}
    >
      {/* Title block */}
      <div className="absolute z-10" style={{ left: 118, top: 64 }}>
        <p
          className={`font-mono text-label tracking-apparatus uppercase ${
            onCream ? 'text-ochre-deep' : 'text-ochre'
          }`}
        >
          {category.sceneLabel}
        </p>

        <h2 className="mt-4 font-display text-scene">
          {scene.category === 'ovalese' ? <em className="italic">{category.label}</em> : category.label}
        </h2>

        <p
          className={`mt-5 font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/55' : 'text-cream/55'
          }`}
        >
          {pad(count)} pieces
        </p>
        <p
          className={`mt-1 font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/40' : 'text-cream/35'
          }`}
        >
          {rendered === 'dial'
            ? 'Scroll rotates · Snap centres · Click opens detail'
            : rendered === 'list'
              ? 'Swipe to browse · Tap opens detail'
              : 'Two chapters, scrubbed in sequence'}
        </p>

        {/* Filter chips — merch only. Default is unfiltered; no cart, enquire only. */}
        {scene.category === 'merch' && (
          <div className="mt-6 flex gap-2">
            {MERCH_KINDS.map((kind) => {
              const n = merch.filter((p) => p.kind === kind).length
              const on = merchFilter === kind
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setMerchFilter(on ? null : kind)}
                  className={`rounded-chip border px-3 py-[7px] font-mono text-caption tracking-caption whitespace-nowrap uppercase ${
                    on ? 'border-ochre-deep text-ochre-deep' : 'border-ink/25 text-ink/55'
                  }`}
                >
                  {kind} {pad(n)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Category list, top right */}
      <ul className="absolute z-10 text-right" style={{ right: 72, top: 64 }}>
        {categories.map((c) => (
          <li
            key={c.id}
            className={`font-mono text-caption tracking-caption uppercase ${
              c.id === scene.category
                ? onCream
                  ? 'text-ochre-deep'
                  : 'text-ochre'
                : onCream
                  ? 'text-ink/30'
                  : 'text-cream/30'
            }`}
          >
            {c.label} {pad(c.pieces.length)} {c.id === scene.category ? '●' : ''}
          </li>
        ))}
      </ul>

      {/* The presentation */}
      {rendered === 'dial' && <Dial scene={scene} activeIndex={index} />}
      {rendered === 'list' && <SnapList scene={scene} activeIndex={index} />}
      {rendered === 'track' && (
        <div
          className="absolute grid place-items-center"
          style={{ left: '62%', top: '52%', transform: 'translate(-50%, -50%)' }}
        >
          {/* SCAFFOLD: the Murals x-translate track is a separate spec. This scene
              pins so the label offsets and document height stay correct. */}
          <p className="font-mono text-caption tracking-apparatus text-cream/30 uppercase">
            Track — {pad(count)} dossiers, x-translate
          </p>
        </div>
      )}

      {/* Progress row */}
      <div
        className="absolute z-10 flex items-center gap-4"
        style={{ left: 118, bottom: 52, right: 72 }}
      >
        <span
          className={`font-mono text-caption tracking-caption ${onCream ? 'text-ink/62' : 'text-cream/60'}`}
        >
          {pad(index + 1)} / {pad(count)}
        </span>
        <span className={`relative h-px flex-1 ${onCream ? 'bg-ink/25' : 'bg-cream/16'}`}>
          <span
            className="absolute top-1/2 size-[7px] -translate-y-1/2 rounded-full bg-ochre"
            style={{ left: `${trackProgress(index, count) * 100}%` }}
          />
        </span>
        <span
          className={`font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/40' : 'text-cream/35'
          }`}
        >
          {rendered === 'dial' ? 'Thumbs counter-rotate' : 'Planes bend ±8° at edges'}
        </span>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify types and the suite**

Run: `npm run typecheck && npm test`
Expected: PASS — 4 test files green.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev` and confirm:
- Artworks shows 8 circular thumbs on the orbit plus the centre plate; the ring turns as you scroll and the thumbs stay upright.
- The centre caption tracks the focused piece and cross-fades rather than cutting.
- Clicking an orbit thumb brings it to centre without navigating; clicking the centre opens `/artworks/:slug`.
- Ovalese shows 6 ovoid thumbs plus a centred ovoid — all 7 eggs visible at once, none repeated.
- Merchandise renders on cream. Clicking `JACKETS 05` re-blooms a 5-piece ring; clicking it again clears the filter. `EARRINGS 01` leaves the centre alone with an empty orbit.
- Resize below 900px: every dial becomes a horizontal snap list, pins release, and swiping updates the progress row.
- Enable reduced motion in the OS: same list, no smoothing, no pins.

- [ ] **Step 4: Commit**

```bash
git add src/sections/GalleryScene.tsx
git commit -m "feat: render the dial or list per scene, with merch filter chips"
```

---

### Task 11: Full verification and scaffold-comment cleanup

Three files still carry `SCAFFOLD:` comments describing work this plan completes. Leaving them makes finished code read as unfinished.

**Files:**
- Modify: `src/sections/GalleryScene.tsx` (comment already replaced in Task 10 — verify)
- Modify: `src/three/Stage.tsx`
- Modify: `docs/superpowers/specs/2026-07-30-gallery-ring-timeline-design.md`

**Interfaces:**
- Consumes: everything.
- Produces: nothing.

- [ ] **Step 1: Correct the spec's merch-filter section**

§11 of the design spec says the unfiltered pin length leaves "the last 7 stops as dead scroll." That was written assuming the count is captured when the timeline is built. It is not — `activeCount(scene)` reads it dynamically (Task 2), so a filtered ring simply spreads 5 stops across the same 260vh. Replace the `merchFilter` paragraph of §11 with:

```markdown
**`merchFilter` changes `n` mid-scene.** Filtering 12 pieces to 5 jackets changes the snap stops and
the index range. `activeCount(scene)` reads the count dynamically, so the rotation mapping stays
correct — 5 stops simply spread across the same 260vh pin. What does need handling: the old
`activeIndex` can point past the end of the filtered list. On filter change, reset
`activeIndex.merch` to 0 and call `ScrollTrigger.refresh()` to remeasure. The `earrings` filter
yields `count = 1`, which is the single-piece case above — this is why `seatContent` is capped at
`count - 1`.
```

- [ ] **Step 2: Update the r3f stage comment**

In `src/three/Stage.tsx`, the comment claims the centre slot is still to come. The centre slot now exists in DOM. Replace the `SCAFFOLD:` line with:

```
 * SCAFFOLD: only pollen exists so far. The flock (~1,200 instances, wing phase
 * in the vertex shader, one attractor per scene) is still to come. The centre
 * slot is DOM for now and cross-fades on snap — see sections/ring/CentreSlot.tsx,
 * which holds the seam the ripple/displacement shader replaces.
```

- [ ] **Step 3: Run the full verification**

Run: `npm run typecheck && npm test && npm run build`
Expected: all three PASS. Report the actual test count and build output — do not claim success without the output in front of you.

- [ ] **Step 4: Manual browser pass**

Run: `npm run dev` and walk the whole page top to bottom, confirming:
- All four gallery scenes pin and release cleanly, in order, with no overlap or gap.
- Artworks reaches `24 / 24` exactly as its pin releases.
- Navigating into a detail route and pressing Back restores the scroll position.
- The reduced-motion path releases every pin and loses no piece.
- The console is clean.

- [ ] **Step 5: Commit**

```bash
git add src/three/Stage.tsx docs/superpowers/specs/2026-07-30-gallery-ring-timeline-design.md
git commit -m "docs: correct the merch-filter note and refresh the stage scaffold comment"
```

---

## Out of scope

Named so nothing here reads as finished:

- Murals x-translate track — g3 pins but does not animate
- Butterfly flock: instances, attractors, MotionPath between scenes
- The r3f ripple/displacement shader on the centre slot
- Between-scene "collapse to a seed" transition
- Mobile bottom ticker and the rail's cream-ground flip
- Detail-page media: zoomable artwork, orbitable ovoid, mural crop strip
- All imagery, and Denise's copy

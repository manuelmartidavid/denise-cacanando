# Collapse-to-Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Between Artworks (`g1`) and Ovalese (`g2`), the ring contracts into a single small mark that survives the gap between the two pins, then opens back out into the next scene's ring.

**Architecture:** The whole-document ScrollTrigger already writes `--progress` to `<html>` every frame. It gains two more properties — `--seam` (signed, −1→0→+1 across the seam's band) and `--seed` (0→1, the seed's shaped presence). Both are derived from the *same* boundary maths the butterfly flock already uses, so the ring and the flock cannot drift apart. A new fixed layer draws the seed; the two participating `Dial`s derive their own contraction from `--seam` in pure CSS.

**Tech Stack:** React 19, TypeScript, GSAP ScrollTrigger (confined to `src/scroll/timeline.ts`), Tailwind 4, Vitest (node environment).

## Global Constraints

Copied from the spec and the handoff's invariants. **Every task's requirements implicitly include this section.**

- **Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`. No DOM. Every test is a pure-function test. Do NOT add jsdom or component tests.** (invariant 6)
- **GSAP lives only in `src/scroll/timeline.ts`.** No component may import `gsap` or `ScrollTrigger`. (invariant 2)
- **`src/three/flock.ts` may NOT import `~/scroll/timeline`, even transitively.** It is loaded by a node test. (invariant 2)
- **The scrub value never enters React state.** Per-frame values reach the DOM as CSS custom properties only. (invariant 1)
- **Counts, spans and offsets are measured, never hardcoded.** (invariant 4)
- **Section geometry is utility classes, never inline `style` — but inline `style` remains correct for per-frame plumbing** (`--r`, `--i`, and here `--seam`/`--seed`). (invariant 13)
- **`flockAt`'s behaviour must not change.** The existing 25 tests in `src/three/flock.test.ts` must pass untouched. Any change in flock behaviour is a defect, not an improvement.
- **Nothing on the hot path may allocate.** `flockAt` runs every frame; the helpers it calls must return numbers, not objects.
- Run `npm run typecheck` and `npm test` before every commit. Use `git diff --cached --stat` — **not** `git status` — to confirm what is about to be recorded.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/three/flock.ts` | **Modify.** Extract `nearestSeamIndex` and `gatherAt` from `flockAt`'s inline scan; add `seamAt`. Pure boundary geometry, shared with the flock. |
| `src/three/flock.test.ts` | **Modify.** Tests for the three new exports. |
| `src/scroll/seed.ts` | **Create.** Everything seed-specific: which seam, its index, the two scene roles, and the presence shaping. Pure. |
| `src/scroll/seed.test.ts` | **Create.** Tests for the above. |
| `src/scroll/timeline.ts` | **Modify.** Cache spans on refresh; publish `--seam` and `--seed` from the existing whole-document trigger. |
| `src/sections/SeedLayer.tsx` | **Create.** The fixed layer that draws the contracted guide circle. |
| `src/sections/ring/Dial.tsx` | **Modify.** Accept an optional seam role; derive contraction in CSS. |
| `src/sections/GalleryScene.tsx` | **Modify.** Pass the role through to `Dial`. |
| `src/routes/ScrollPage.tsx` | **Modify.** Mount `SeedLayer`, gated on both neighbours resolving to `dial`. |

### A refinement to the spec, discovered while planning

The spec assumed `seamAt` would need `nearestSeamIndex` to force `gather` to 0 when some other boundary is nearer. **It does not.** `halfWidthAt` already clamps every band to at most half the distance to each neighbouring boundary, so at the point where the nearest boundary flips, the distance from either one is `>= w` and `gatherAt` has already returned exactly 0. The guard is redundant, and dropping it removes a linear scan from the per-frame path.

**This is a load-bearing assumption, so Task 2 pins it with a test rather than trusting the reasoning.** `nearestSeamIndex` is still extracted and exported — `flockAt` uses it, and it deserves its own test.

---

## Task 1: Extract the boundary helpers from `flockAt`

A pure refactor. No behaviour changes.

**Files:**
- Modify: `src/three/flock.ts:146-166`
- Test: `src/three/flock.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `nearestSeamIndex(spans: Span[], p: number): number` — index `i` of the boundary between `spans[i]` and `spans[i+1]` nearest to `p`. `gatherAt(spans: Span[], p: number, i: number): number` — the gather ramp for boundary `i`, 1 at the boundary and 0 at or beyond its band edge. Neither allocates.

- [ ] **Step 1: Write the failing tests**

Add to `src/three/flock.test.ts`:

```ts
describe('nearestSeamIndex', () => {
  it('picks the boundary the point is closest to', () => {
    const spans = FIXTURE
    expect(nearestSeamIndex(spans, boundaryOf(spans, 0))).toBe(0)
    expect(nearestSeamIndex(spans, boundaryOf(spans, 2))).toBe(2)
    expect(nearestSeamIndex(spans, boundaryOf(spans, 5))).toBe(5)
  })

  it('never returns an index without a following span', () => {
    const spans = FIXTURE
    for (let k = 0; k <= 200; k++) {
      const i = nearestSeamIndex(spans, k / 200)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThanOrEqual(spans.length - 2)
    }
  })
})

describe('gatherAt', () => {
  it('is 1 at the boundary', () => {
    const spans = FIXTURE
    expect(gatherAt(spans, boundaryOf(spans, 2), 2)).toBeCloseTo(1, 10)
  })

  it('is 0 outside its own band, for every boundary', () => {
    // Load-bearing: `seamAt` relies on this instead of a nearest-seam scan.
    const spans = FIXTURE
    for (let i = 0; i <= spans.length - 2; i++) {
      for (let k = 0; k <= 2000; k++) {
        const p = k / 2000
        const inBand = Math.abs(p - boundaryOf(spans, i)) < halfWidthOf(spans, i)
        if (!inBand) expect(gatherAt(spans, p, i)).toBe(0)
      }
    }
  })
})
```

`FIXTURE`, `boundaryOf` and `halfWidthOf` are test-local helpers. **`FIXTURE` must be the existing fixture already in this file** — it was read out of the live page rather than derived, and recomputing it is how the gating cycle hid a real discontinuity. `boundaryOf(spans, i)` is `(spans[i].to + spans[i + 1].from) / 2`; `halfWidthOf` mirrors `halfWidthAt`, including both clamps.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- flock`
Expected: FAIL — `nearestSeamIndex is not a function`, `gatherAt is not a function`.

- [ ] **Step 3: Extract the two helpers**

In `src/three/flock.ts`, above `flockAt`:

```ts
/**
 * Index of the boundary nearest `p`. A linear scan over six seams, once a
 * frame. Returns a number rather than a record deliberately: `flockAt` runs
 * every frame and its contract is that only a point genuinely inside a band
 * allocates.
 */
export const nearestSeamIndex = (spans: Span[], p: number): number => {
  let nearest = 0
  let distance = Infinity
  for (let i = 0; i < spans.length - 1; i++) {
    const d = Math.abs(p - boundaryAt(spans, i))
    if (d < distance) {
      distance = d
      nearest = i
    }
  }
  return nearest
}

/**
 * The gather ramp for one boundary: 1 at the seam, falling to exactly 0 with
 * zero slope at `b ± halfWidthAt(i)`, and 0 beyond.
 *
 * Because `halfWidthAt` clamps every band to at most half the distance to its
 * neighbours, this is 0 for any `p` outside band `i` — which is why `seamAt`
 * needs no nearest-boundary check. There is a test pinning that.
 */
export const gatherAt = (spans: Span[], p: number, i: number): number => {
  const w = halfWidthAt(spans, i)
  if (w <= 0) return 0
  const u = Math.abs(p - boundaryAt(spans, i)) / w
  return u >= 1 ? 0 : 1 - smoothstep(u)
}
```

Then replace the inline scan inside `flockAt` (currently `let nearest = 0` through `const gather = ...`) with:

```ts
  const nearest = nearestSeamIndex(spans, p)
  const a = spans[nearest]!
  const b = spans[nearest + 1]!
  const w = halfWidthAt(spans, nearest)
  const distance = Math.abs(p - boundaryAt(spans, nearest))

  const t = w > 0 ? clamp01((p - (boundaryAt(spans, nearest) - w)) / (2 * w)) : distance > 0 ? 1 : 0
  const gather = gatherAt(spans, p, nearest)
```

Everything below `const gather` is unchanged. Add `nearestSeamIndex, gatherAt` to the test file's import from `./flock`.

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: PASS — **including all 25 pre-existing `flock.test.ts` tests untouched.** If any pre-existing test changed behaviour, the extraction is wrong; revert and redo. Do not edit an existing test to make it pass.

- [ ] **Step 5: Commit**

```bash
git add src/three/flock.ts src/three/flock.test.ts
git diff --cached --stat
git commit -m "refactor: the seam maths the ring needs was locked inside flockAt"
```

---

## Task 2: The signed seam scalar

**Files:**
- Modify: `src/three/flock.ts`
- Test: `src/three/flock.test.ts`

**Interfaces:**
- Consumes: `gatherAt` from Task 1.
- Produces: `seamAt(spans: Span[], p: number, seam: number): number` — `-1` before the seam's band, `0` exactly at the boundary, `+1` after, saturated outside. Allocation-free.

- [ ] **Step 1: Write the failing tests**

```ts
describe('seamAt', () => {
  const SEAM = 2 // g1|g2 in the fixture

  it('is 0 exactly at the boundary', () => {
    expect(seamAt(FIXTURE, boundaryOf(FIXTURE, SEAM), SEAM)).toBeCloseTo(0, 10)
  })

  it('is -1 before the band and +1 after it', () => {
    const b = boundaryOf(FIXTURE, SEAM)
    const w = halfWidthOf(FIXTURE, SEAM)
    expect(seamAt(FIXTURE, b - w, SEAM)).toBeCloseTo(-1, 10)
    expect(seamAt(FIXTURE, b + w, SEAM)).toBeCloseTo(1, 10)
    expect(seamAt(FIXTURE, 0, SEAM)).toBeCloseTo(-1, 10)
    expect(seamAt(FIXTURE, 1, SEAM)).toBeCloseTo(1, 10)
  })

  it('changes sign only at the boundary', () => {
    const b = boundaryOf(FIXTURE, SEAM)
    for (let k = 0; k <= 4000; k++) {
      const p = k / 4000
      const s = seamAt(FIXTURE, p, SEAM)
      if (p < b) expect(s).toBeLessThanOrEqual(0)
      if (p > b) expect(s).toBeGreaterThanOrEqual(0)
    }
  })

  it('is continuous across the whole document', () => {
    // Stepped as k / STEPS, never accumulated: an accumulating loop drifts
    // short of 1.0 and never exercises the endpoint.
    const STEPS = 20000
    let prev = seamAt(FIXTURE, 0, SEAM)
    for (let k = 1; k <= STEPS; k++) {
      const s = seamAt(FIXTURE, k / STEPS, SEAM)
      expect(Math.abs(s - prev)).toBeLessThan(0.01)
      prev = s
    }
  })

  it('steps rather than returning NaN on a zero-width band', () => {
    const degenerate: Span[] = [
      { from: 0, to: 0.5, target: [0, 0, 0], hold: 1 },
      { from: 0.5, to: 0.5, target: [0, 0, 0], hold: 1 },
      { from: 0.5, to: 1, target: [0, 0, 0], hold: 1 },
    ]
    for (let k = 0; k <= 100; k++) {
      expect(Number.isNaN(seamAt(degenerate, k / 100, 1))).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- flock`
Expected: FAIL — `seamAt is not a function`.

- [ ] **Step 3: Implement**

```ts
/**
 * One seam as a signed scalar: -1 at the band's entry edge, 0 exactly at the
 * boundary, +1 at the exit edge, saturated at ±1 across the rest of the
 * document.
 *
 * Signed rather than a bare magnitude because `gather` is symmetric about the
 * boundary, and a consumer on the outgoing side needs to distinguish "not there
 * yet" from "already past" — otherwise the outgoing ring blooms open again as
 * it scrolls away.
 *
 * No nearest-boundary check: `gatherAt` is already 0 outside band `seam`,
 * because `halfWidthAt` clamps each band to at most half the distance to its
 * neighbours. There is a test pinning that.
 */
export const seamAt = (spans: Span[], p: number, seam: number): number => {
  if (spans.length < 2 || seam < 0 || seam > spans.length - 2) return 1
  const sign = p < boundaryAt(spans, seam) ? -1 : 1
  return sign * (1 - gatherAt(spans, p, seam))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
git add src/three/flock.ts src/three/flock.test.ts
git diff --cached --stat
git commit -m "feat: one signed number for where you are in the g1-g2 seam"
```

---

## Task 3: The seed module

**Files:**
- Create: `src/scroll/seed.ts`
- Test: `src/scroll/seed.test.ts`

**Interfaces:**
- Consumes: `LABELS`, `GalleryLabel` from `~/scroll/scenes`; `clamp01` from `~/three/flock`.
- Produces: `SEED_SEAM`, `SEED_SEAM_INDEX: number`, `SeamRole = 'out' | 'in'`, `seamRole(label: GalleryLabel): SeamRole | undefined`, `SEED_PLATEAU: number`, `seedPresence(seam: number): number`.

- [ ] **Step 1: Write the failing test**

Create `src/scroll/seed.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- seed`
Expected: FAIL — cannot resolve `./seed`.

- [ ] **Step 3: Implement**

Create `src/scroll/seed.ts`:

```ts
/**
 * The between-scene "collapse to a seed" transition — README §179, and
 * `docs/superpowers/specs/2026-08-03-collapse-to-seed-design.md`.
 *
 * Pure, and deliberately separate from `~/three/flock`: that module owns the
 * boundary geometry the flock and this share, while everything here is about
 * the seed alone. Keeping the shaping constant on this side is what lets the
 * transition's feel be tuned without moving the butterflies.
 */

import { clamp01 } from '~/three/flock'
import { LABELS, type GalleryLabel } from './scenes'

/**
 * The one seam that collapses. Ring-to-ring only: g3 is the Murals track, not
 * a ring, so the two seams touching it keep the plain scroll-away. Adding a
 * boundary later is a matter of generalising this declaration — but the track
 * would still need its own collapse treatment designed first.
 */
export const SEED_SEAM = { out: 'g1', in: 'g2' } as const

/** Position in `LABELS`, never a hardcoded index (invariant 4). */
export const SEED_SEAM_INDEX = LABELS.indexOf(SEED_SEAM.out)

export type SeamRole = 'out' | 'in'

/** Which side of the seam a scene is on, if any. `g4` gets `undefined`. */
export const seamRole = (label: GalleryLabel): SeamRole | undefined =>
  label === SEED_SEAM.out ? 'out' : label === SEED_SEAM.in ? 'in' : undefined

/**
 * How much of the band the seed spends at full presence.
 *
 * `gather` is a smoothstep hump: it touches 1 at the midpoint and immediately
 * falls away, so driving the seed from it directly would show the seed for a
 * single instant. Dividing by this and clamping flattens the top, giving a
 * genuine plateau — the seed *holds* across the gap, which is the whole point
 * of it being one object rather than a collapse and a bloom.
 *
 * A look decision. Tune in a browser; likely wants Denise's eye.
 */
export const SEED_PLATEAU = 0.55

/** The seed's presence, 0 outside the band and 1 across the plateau. */
export const seedPresence = (seam: number): number =>
  clamp01((1 - Math.abs(seam)) / SEED_PLATEAU)
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scroll/seed.ts src/scroll/seed.test.ts
git diff --cached --stat
git commit -m "feat: the seed holds because a smoothstep hump would only flicker"
```

---

## Task 4: Publish `--seam` and `--seed`

**Files:**
- Modify: `src/scroll/timeline.ts:354-374`

**Interfaces:**
- Consumes: `seamAt` (Task 2), `SEED_SEAM_INDEX`, `seedPresence` (Task 3), and the existing module-private `getLabelSpan`.
- Produces: two CSS custom properties on `documentElement` — `--seam` (−1..1) and `--seed` (0..1).

- [ ] **Step 1: Add the imports and the span cache**

At the top of `src/scroll/timeline.ts`, extend the existing imports:

```ts
import { seamAt, spansFrom, type Span } from '~/three/flock'
import { SEED_SEAM_INDEX, seedPresence } from './seed'
```

Near the other module-level state (beside `sceneTriggers`):

```ts
/**
 * Spans for the seam scalar, rebuilt on refresh rather than per frame:
 * `spansFrom` allocates seven objects, and label offsets only move when the
 * document height does.
 */
let seamSpans: Span[] = []
```

- [ ] **Step 2: Publish from the whole-document trigger**

Replace the whole-document `ScrollTrigger.create({...})` at the end of `buildTimeline` with:

```ts
  triggers.push(
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      refreshPriority: -1,
      // Runs last by the same `refreshPriority`, which is exactly what the
      // spans need: every pin has already registered its own by now.
      onRefresh: () => {
        seamSpans = spansFrom(
          LABELS.map((label) => getLabelSpan(label)),
          document.documentElement.scrollHeight - window.innerHeight,
        )
      },
      onUpdate: (self) => {
        frame.progress = self.progress
        // The mobile ticker's progress line. A CSS custom property is how a
        // per-frame value legally reaches the DOM here: it keeps the scrub out
        // of React state (invariant 1) and keeps GSAP inside this module
        // (invariant 2) — the ticker only ever reads --progress.
        const root = document.documentElement.style
        root.setProperty('--progress', String(self.progress))

        // The collapse-to-seed transition, on the same channel and for the
        // same reason. Saturates at +1 when spans are not yet measured, which
        // is the "fully past the seam" state and leaves both rings open.
        const seam = seamSpans.length ? seamAt(seamSpans, self.progress, SEED_SEAM_INDEX) : 1
        root.setProperty('--seam', String(seam))
        root.setProperty('--seed', String(seedPresence(seam)))
      },
    }),
  )
```

- [ ] **Step 3: Verify types and tests still pass**

Run: `npm run typecheck && npm test`
Expected: PASS. No new unit tests here — this is GSAP wiring, which invariant 6 puts in the browser, not vitest.

- [ ] **Step 4: Confirm in a browser that the property actually moves**

Start the server:

```bash
npm run dev -- --port 5173 --strictPort
```

In a Playwright script (see Task 7 for the harness), scroll to the g1|g2 seam and read:

```js
getComputedStyle(document.documentElement).getPropertyValue('--seam')
```

Expected: about `-1` early in g1's pin, crossing `0` near the midpoint of the gap, `+1` once g2 is pinned. **If it reads `1` everywhere, `seamSpans` is empty** — check that `onRefresh` fired after the pins registered.

- [ ] **Step 5: Commit**

```bash
git add src/scroll/timeline.ts
git diff --cached --stat
git commit -m "feat: the seam reaches the DOM the same way progress always has"
```

---

## Task 5: The seed layer

**Files:**
- Create: `src/sections/SeedLayer.tsx`
- Modify: `src/routes/ScrollPage.tsx:119-138`

**Interfaces:**
- Consumes: `--seed` (Task 4).
- Produces: `<SeedLayer />`, a fixed decorative layer.

- [ ] **Step 1: Create the component**

```tsx
import type { CSSProperties } from 'react'

/**
 * The seed: the Dial's own dashed guide circle, contracted to a mark that
 * survives the gap between g1 and g2.
 *
 * It lives here rather than in either section because every section clips to
 * its own pane (invariant 10) and both neighbours are mid-scroll exactly when
 * the seed must be visible — anything section-owned is clipped away at the one
 * moment it matters.
 *
 * `left: 62% / top: 52%` is not a new constant: it is where `Dial` puts its
 * ring centre, and a pinned section's box is the viewport, so these coincide
 * with both rings' centres with nothing to measure.
 *
 * z-[2]: above the r3f canvas (z-1), below `main` (z-10), so the flock can pass
 * in front of it and the incoming scene's title is never covered.
 */
const SEED_PX = 24

export const SeedLayer = () => (
  <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden="true">
    <div
      className="absolute rounded-full border border-dashed border-cream/14"
      style={
        {
          left: '62%',
          top: '52%',
          width: SEED_PX,
          height: SEED_PX,
          // Per-frame plumbing, which invariant 13 keeps as inline style.
          transform: 'translate(-50%, -50%) scale(calc(0.4 + 0.6 * var(--seed, 0)))',
          opacity: 'var(--seed, 0)',
        } as CSSProperties
      }
    />
  </div>
)
```

- [ ] **Step 2: Mount it, gated**

In `src/routes/ScrollPage.tsx`, add the import and derive the gate next to the existing `ground` line:

```tsx
import { SeedLayer } from '~/sections/SeedLayer'
import { SEED_SEAM } from '~/scroll/seed'
```

```tsx
  // Both neighbours must actually be rings. Below 939px, or under reduced
  // motion, `resolvePresentation` returns 'list' — there is no ring to contract
  // and no gap to cross, so the seed must not exist at all.
  const seeded = resolved[SEED_SEAM.out] === 'dial' && resolved[SEED_SEAM.in] === 'dial'
```

Then inside the fragment, immediately after `<Stage />`'s `</Suspense>`:

```tsx
      {seeded && <SeedLayer />}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Confirm the gates in a browser**

At 1440×900 the element exists; at 390×844 it does not; under `reducedMotion: 'reduce'` it does not. Query with `document.querySelectorAll('[aria-hidden] .border-dashed')` or give the layer a `data-seed` attribute for probing.

- [ ] **Step 5: Commit**

```bash
git add src/sections/SeedLayer.tsx src/routes/ScrollPage.tsx
git diff --cached --stat
git commit -m "feat: the seed needs its own layer because sections clip it away"
```

---

## Task 6: Contract the two rings

**Files:**
- Modify: `src/sections/ring/Dial.tsx:10-13,46-47`
- Modify: `src/sections/GalleryScene.tsx:163`

**Interfaces:**
- Consumes: `--seam` (Task 4), `seamRole`, `SeamRole` (Task 3).
- Produces: nothing downstream.

- [ ] **Step 1: Give `Dial` the role prop**

Extend its `Props`:

```tsx
import { seamRole, type SeamRole } from '~/scroll/seed'

type Props = {
  scene: GalleryScene
  activeIndex: number
  /**
   * Which side of the collapse-to-seed seam this ring is on, if any.
   * Undefined — the default, and what `g4` gets — means the ring behaves
   * exactly as it did before the transition existed.
   */
  seam?: SeamRole
}
```

- [ ] **Step 2: Derive the contraction in CSS**

Inside the component, above the return:

```tsx
  /**
   * How contracted this ring is, 0..1, derived from the one signed scalar.
   *
   * `out` opens at seam -1 and is a point from 0 onward; `in` is a point until
   * 0 and opens by +1. Deriving both from the sign is what stops the outgoing
   * ring blooming open again as it scrolls off the top.
   *
   * The fallbacks matter: with no --seam written yet, `out` reads -1 (open) and
   * `in` reads +1 (open), so a ring is never stuck collapsed.
   */
  const collapse =
    seam === 'out'
      ? 'clamp(0, calc(1 + var(--seam, -1)), 1)'
      : seam === 'in'
        ? 'clamp(0, calc(1 - var(--seam, 1)), 1)'
        : '0'
```

Then on the outermost `<div className="absolute" style={{ left: '62%', top: '52%' }}>`, replace that style with:

```tsx
    <div
      className="absolute"
      style={
        {
          left: '62%',
          top: '52%',
          '--collapse': collapse,
          // Contracts toward the seed's own size. Everything inside — guides,
          // thumbs, centre slot — rides this one transform.
          transform: 'scale(calc(1 - 0.96 * var(--collapse)))',
          opacity: 'calc(1 - var(--collapse))',
        } as CSSProperties
      }
    >
```

- [ ] **Step 3: Pass the role**

In `src/sections/GalleryScene.tsx`, line 163:

```tsx
      {rendered === 'dial' && (
        <Dial scene={scene} activeIndex={index} seam={seamRole(scene.label)} />
      )}
```

Add `import { seamRole } from '~/scroll/seed'`. **`scene.label` here is typed `GalleryLabel`** — if TypeScript disagrees, widen `seamRole`'s parameter rather than casting at the call site.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sections/ring/Dial.tsx src/sections/GalleryScene.tsx
git diff --cached --stat
git commit -m "feat: both rings derive their own contraction from one number"
```

---

## Task 7: Verify it in a browser

Invariant 6 makes this the real test. Four defects in this repo (#3, #8, #12, #16) were invisible to every measurement taken and catchable only by looking, so **screenshots are required, not optional.**

**Files:** none in the repo. Write the harness to the session scratchpad.

- [ ] **Step 1: Get a browser**

`playwright-core` into a scratch dir, **not** the project — it ships no postinstall browser download, so the version mismatch the `npx playwright` route hits never arises:

```bash
npm install playwright-core --no-save
```

Point `chromium.launch` at the browser already on disk, checking the path first — this machine also carries `chromium-1217` and several `mcp-chrome-*` builds:

```
executablePath: '%LOCALAPPDATA%\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe'
```

Launch headed, then `bringToFront()`. **Scroll with `lenis.scrollTo`, never `window.scrollTo`** — Lenis owns the scroll position. Reach it via `import('/src/scroll/useLenis.ts').getLenis()`, which works only on a page not HMR-edited since load; reload first and assert the instance is non-null.

- [ ] **Step 2: Sweep the band for continuity**

Read the g1 and g2 spans live with `getLabelSpan` rather than reusing any px figure from the handoff, compute the boundary and band, then step every pixel across it reading `--seam`. Assert no step exceeds a small epsilon.

Expected: continuous, crossing 0 within a pixel of the midpoint.

- [ ] **Step 3: Screenshot the transition**

Capture at band entry, quarter, midpoint, three-quarter and exit. Verify by eye:
- the g1 ring visibly contracts,
- the seed is visible and centred on where both rings' centres were,
- the g2 ring opens out,
- **g1 does not re-bloom on the falling side.** This is the specific failure the signed scalar exists to prevent, so it must be observed rather than assumed.

- [ ] **Step 4: Check the plateau**

Confirm `--seed` reads exactly `1` across a range of scroll positions rather than at a single pixel. If it is 1 for only one sample, `SEED_PLATEAU` is wrong and the seed will flicker.

- [ ] **Step 5: Check the gates and other viewports**

- 390×844: no seed element in the DOM.
- `reducedMotion: 'reduce'`: no seed element, and no pin-spacers.
- 1280×800 and one short viewport: the transition still reads, noting that the band is a fixed 5% of the document so it is proportionally tighter.

- [ ] **Step 6: Confirm the flock is untouched**

Compare `uGather`, `uSettle` and `uPresence` at hero, About's midpoint and the foot against the values recorded in the handoff — `presence` 1 / 0.45 / 1, `settle` 0 / 0 / 1. **Any difference means the Task 1 extraction changed flock behaviour and must be fixed, not accepted.**

- [ ] **Step 7: Record and commit**

Revise `docs/superpowers/HANDOFF.md`: mark item 3 done, record the measured band and boundary for this viewport, note `SEED_PLATEAU`'s tuned value and whether it still wants Denise's eye, and add any defect this cycle found to the numbered list.

```bash
git add docs/superpowers/HANDOFF.md
git diff --cached --stat
git commit -m "docs: the ring collapses to meet the flock now"
git push
```

Verify the push landed with `git ls-remote origin refs/heads/motion-upgrade` against local `HEAD`, rather than trusting that the command reported success.

---

## Self-Review

**Spec coverage.** Persistent seed → Tasks 3, 5. Ring-to-ring scope only → `SEED_SEAM` in Task 3. Contracted guide circle → Tasks 5, 6. Flock's boundary maths as driver → Tasks 1, 2. Signed scalar → Task 2. Allocation-free helpers → Task 1. `SEED_PLATEAU` → Task 3. Fixed layer at `z-[2]`, mounted in `ScrollPage` → Task 5. `Dial` role prop defaulting to absent → Task 6. All three gates → Task 5 Step 2. Pure tests → Tasks 1–3; browser verification → Task 7. Risks 1–4 → Task 7 Steps 3–5.

**Type consistency.** `seamAt(spans, p, seam)` is defined in Task 2 and called in Task 4 with `SEED_SEAM_INDEX` from Task 3. `seedPresence(seam)` defined Task 3, called Task 4. `SeamRole` defined Task 3, consumed Task 6. `seamRole(label)` defined Task 3, called Task 6. `--seam` written Task 4, read Tasks 5 and 6. `--seed` written Task 4, read Task 5 only.

**One thing deliberately left to the browser.** `SEED_PX = 24`, the `0.96` scale factor and the `0.4 + 0.6` seed scale ramp are starting values, not measurements. They are the transition's look, and the handoff is explicit that a computed style is not what you see. Expect to tune them in Task 7 — that is not a plan failure, it is where those numbers are supposed to be decided.

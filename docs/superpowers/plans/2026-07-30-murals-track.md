# Murals x-translate Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Murals track (g3) — seven walls scrubbed horizontally as dossiers — so the last gallery scene stops rendering a labelled stub.

**Architecture:** The scene runs on one CSS custom property per frame, `--at` (the fractional wall index), which drives both the row's x-translate and every plane's clamped ±8° bend. The pin/scrub/snap/index machinery already proven on the three dial scenes is extracted into a shared `createScrubScene` factory that both presentations call, differing only in their pure progress→scalar mapping.

**Tech Stack:** Vite 8 · React 19 · TypeScript 5.9 · GSAP ScrollTrigger 3.15 · Lenis 1.3 · Tailwind 4 · Vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-30-murals-track-design.md`

## Global Constraints

These come from the spec and the gallery-ring handoff. Every task's requirements implicitly include them.

- **Rotation and per-frame values never enter React state.** One CSS custom property per frame, per scene. `activeIndex` publishes only when the rounded index changes.
- **GSAP lives only in `src/scroll/timeline.ts`** (and pre-existing `useLenis.ts`). No component imports `gsap` or `ScrollTrigger`.
- **The snap goes through Lenis, never `ScrollTrigger.snap`.** Two writers of scroll position fight and produce jitter.
- **Counts are never hardcoded in a view** — read via `activeCount(scene)` / `activePieces(scene)`.
- **Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`.** Only `.test.ts` runs and there is no DOM. Every test is a pure-function test by design. **Do not add jsdom or component tests.**
- **Design tokens live in `src/styles/index.css` under `@theme`.** Hairlines are always 1px. Mono labels are always uppercase and letter-spaced. Every piece renders `<Placeholder>`; there is no imagery.
- **Path alias:** `~` resolves to `src/`. `~/data` re-exports every type (`Piece`, `MuralLocation`, `ImageRole`) and the `ph` helper via `export * from './types'`.
- **Commands:** `npm test` (vitest run) · `npm run typecheck` · `npm run build` · `npm run dev`.
- **Copy is not final** but metadata labels are. Mono apparatus text is uppercased by CSS (`uppercase`), so write source strings in natural case.

---

### Task 1: Pure track geometry

The whole scene's arithmetic, with no DOM. Written first so the CSS in later tasks is transcribed from a tested contract rather than guessed.

**Files:**
- Create: `src/lib/track.ts`
- Test: `src/lib/track.test.ts`

**Interfaces:**
- Consumes: `Piece` and `MuralLocation` from `~/data`.
- Produces:
  - `DOSSIER_W = 816`, `DOSSIER_H = 410`, `TRACK_GAP = 24`, `TRACK_PITCH = 840`, `MAX_BEND = 8`
  - `trackAt(p: number, count: number): number`
  - `bendDegrees(i: number, at: number, max?: number): number`
  - `trackGutter(width?: number): string`
  - `CHAPTER_LABELS: Record<MuralLocation, string>`
  - `type Chapter = { id: MuralLocation; label: string; count: number; firstIndex: number }`
  - `chaptersOf(pieces: Piece[]): Chapter[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/track.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { murals, ph, type Piece } from '~/data'
import {
  bendDegrees,
  chaptersOf,
  DOSSIER_W,
  MAX_BEND,
  TRACK_GAP,
  TRACK_PITCH,
  trackAt,
  trackGutter,
} from './track'

/** A wall stripped to the fields chaptersOf reads. */
const wall = (slug: string, location: Piece['location']): Piece => ({
  slug,
  title: slug,
  medium: 'Acrylic on concrete',
  size: '10 × 3 m',
  year: 2025,
  status: 'showcase',
  location,
  images: [ph(`${slug} — context`, 'context')],
})

describe('track geometry', () => {
  it('spaces walls by the dossier width plus the gap', () => {
    expect(TRACK_PITCH).toBe(DOSSIER_W + TRACK_GAP)
    expect(TRACK_PITCH).toBe(840)
  })

  it('centres the row so the first and last wall can both reach the middle', () => {
    expect(trackGutter()).toBe('calc(50% - 408px)')
  })
})

describe('trackAt', () => {
  it('puts wall 0 at p=0 and wall n-1 at p=1', () => {
    expect(trackAt(0, 7)).toBe(0)
    expect(trackAt(1, 7)).toBe(6)
  })

  it('is linear in between', () => {
    expect(trackAt(0.5, 7)).toBeCloseTo(3, 10)
  })

  it('pins a single-wall category at 0 for every progress', () => {
    expect(trackAt(0, 1)).toBe(0)
    expect(trackAt(0.5, 1)).toBe(0)
    expect(trackAt(1, 1)).toBe(0)
  })

  it('never goes negative on an empty category', () => {
    expect(trackAt(1, 0)).toBe(0)
  })
})

describe('bendDegrees', () => {
  it('leaves the centred wall flat', () => {
    expect(bendDegrees(3, 3)).toBe(0)
  })

  it('reaches the full bend at exactly one pitch either side', () => {
    expect(bendDegrees(4, 3)).toBe(MAX_BEND)
    expect(bendDegrees(2, 3)).toBe(-MAX_BEND)
  })

  it('holds at the clamp beyond one pitch instead of winding up', () => {
    expect(bendDegrees(9, 3)).toBe(MAX_BEND)
    expect(bendDegrees(-4, 3)).toBe(-MAX_BEND)
  })

  it('is antisymmetric about the centre', () => {
    expect(bendDegrees(3.5, 3)).toBe(-bendDegrees(2.5, 3))
  })
})

describe('chaptersOf', () => {
  it('splits the real walls BGC 4 / Layaw 3', () => {
    expect(chaptersOf(murals)).toEqual([
      { id: 'bgc', label: 'BGC', count: 4, firstIndex: 0 },
      { id: 'layaw', label: 'Layaw, Makati', count: 3, firstIndex: 4 },
    ])
  })

  it('counts correctly when locations are interleaved, ordering by first appearance', () => {
    const interleaved = [
      wall('a', 'layaw'),
      wall('b', 'bgc'),
      wall('c', 'layaw'),
    ]
    expect(chaptersOf(interleaved)).toEqual([
      { id: 'layaw', label: 'Layaw, Makati', count: 2, firstIndex: 0 },
      { id: 'bgc', label: 'BGC', count: 1, firstIndex: 1 },
    ])
  })

  it('returns nothing for an empty category', () => {
    expect(chaptersOf([])).toEqual([])
  })

  it('ignores pieces with no location rather than inventing a chapter', () => {
    expect(chaptersOf([wall('x', undefined)])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/track.test.ts`
Expected: FAIL — `Failed to resolve import "./track"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/track.ts`:

```ts
import type { MuralLocation, Piece } from '~/data'

/**
 * Pure geometry for the Murals x-translate track.
 *
 * No React, no DOM, no GSAP. The scroll timeline supplies a progress and this
 * turns it into ONE number — the fractional wall index — which the row writes
 * to a single CSS custom property. The plane bend is then pure CSS off that
 * same variable, so none of this runs per frame.
 */

/** Dossier box, from the design of record: 16 + 540 + 14 + 230 + 16. */
export const DOSSIER_W = 816
export const DOSSIER_H = 410
export const TRACK_GAP = 24

/** Centre-to-centre spacing. The row translates by exactly this per wall. */
export const TRACK_PITCH = DOSSIER_W + TRACK_GAP

/** Maximum plane bend at the frame edges, in degrees. */
export const MAX_BEND = 8

/** Fractional wall index at progress p. Wall 0 at p=0, wall n-1 at p=1. */
export const trackAt = (p: number, count: number): number => p * Math.max(0, count - 1)

/**
 * Plane bend for the wall at index i when the track sits at `at`.
 *
 * Shipped as a CSS clamp() on --at rather than called per frame — this is the
 * contract the CSS is transcribed from, and this test is what keeps the two
 * from drifting apart.
 */
export const bendDegrees = (i: number, at: number, max: number = MAX_BEND): number =>
  Math.max(-max, Math.min(max, (i - at) * max))

/** Symmetric centring gutter, so wall 1 and wall n both reach the centre. */
export const trackGutter = (width: number = DOSSIER_W): string => `calc(50% - ${width / 2}px)`

export const CHAPTER_LABELS: Record<MuralLocation, string> = {
  bgc: 'BGC',
  layaw: 'Layaw, Makati',
}

export type Chapter = {
  id: MuralLocation
  label: string
  count: number
  firstIndex: number
}

/**
 * The chapters a set of walls falls into, ordered by first appearance.
 *
 * Deliberately does not assume the data is grouped. `murals.ts` happens to list
 * BGC then Layaw, but a wall inserted out of order must join its own chapter
 * rather than opening a third one — a Map keyed by location gives that for
 * free, and preserves insertion order for the ordering guarantee.
 */
export const chaptersOf = (pieces: Piece[]): Chapter[] => {
  const byId = new Map<MuralLocation, Chapter>()
  pieces.forEach((piece, i) => {
    const id = piece.location
    if (!id) return
    const found = byId.get(id)
    if (found) found.count += 1
    else byId.set(id, { id, label: CHAPTER_LABELS[id], count: 1, firstIndex: i })
  })
  return [...byId.values()]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/track.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all test files pass (7 files now), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/track.ts src/lib/track.test.ts
git commit -m "feat: add pure track geometry for the Murals scene"
```

---

### Task 2: Track scenes fall back to the snap list

**Files:**
- Modify: `src/scroll/presentation.ts:14-21`
- Test: `src/scroll/presentation.test.ts:21-23` (replace the existing track case)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `resolvePresentation('track', reduced, compact)` now returns `'list'` when either flag is set. `ScrollPage` already calls this for every scene and needs no change.

`SnapList` is category-generic — it reads `activePieces(scene)` and its own `SNAP_ITEM_WIDTH`, and never touches `RING_LOOK` — so it renders the seven walls with no modification, linking each to `/murals/<slug>`.

- [ ] **Step 1: Write the failing test**

In `src/scroll/presentation.test.ts`, **delete** this existing case:

```ts
  it('leaves a track scene alone — its fallback belongs to the Murals spec', () => {
    expect(resolvePresentation('track', true, true)).toBe('track')
  })
```

and replace it with:

```ts
  it('renders the track when motion is allowed and there is room', () => {
    expect(resolvePresentation('track', false, false)).toBe('track')
  })

  it('falls a track scene back to the pin-free list under reduced motion', () => {
    expect(resolvePresentation('track', true, false)).toBe('list')
  })

  it('falls a track scene back to the pin-free list below 900px', () => {
    expect(resolvePresentation('track', false, true)).toBe('list')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/scroll/presentation.test.ts`
Expected: FAIL — two cases expected `'list'` but received `'track'`.

- [ ] **Step 3: Write the implementation**

Replace the body and docstring of `resolvePresentation` in `src/scroll/presentation.ts`:

```ts
/**
 * Both presentations fall back to the pin-free list under reduced motion or
 * below 900px. Both routes reach every piece and carry the same links: nothing
 * structural is lost, which is the requirement, not a nicety.
 *
 * The list is category-generic, so the seven mural walls come through it as
 * cards linking to the same `/murals/<slug>` route the dossier links to.
 */
export const resolvePresentation = (
  declared: Presentation,
  reduced: boolean,
  compact: boolean,
): Rendered => {
  if (reduced || compact) return 'list'
  return declared === 'track' ? 'track' : 'dial'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/scroll/presentation.test.ts`
Expected: PASS — 7 tests. The four existing dial cases must stay green; they are the regression guard on this rewrite.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/scroll/presentation.ts src/scroll/presentation.test.ts
git commit -m "feat: fall the Murals track back to the snap list under reduced motion"
```

---

### Task 3: Generalise the frame channel

A pure refactor: no behaviour changes, no new features. The dial branch of `buildTimeline` already does the five things the track needs — pin, scrub, publish one scalar per frame, publish `activeIndex`, arm the idle snap. Extract it so the track can reuse it instead of copying it.

**This task has no new pure surface to test.** Its verification is that the existing 70 tests stay green, typecheck and build pass, and all three dial scenes still behave in a browser. That is stated plainly rather than papered over with a fake test — invariant 6 forbids DOM tests, and `timeline.ts` is nothing but DOM and GSAP.

**Files:**
- Modify: `src/scroll/store.ts:67-77`
- Modify: `src/scroll/timeline.ts:64-91` and `:146-199`
- Modify: `src/sections/ring/Dial.tsx:6` and `:36-42`

**Interfaces:**
- Consumes: `trackAt` is *not* used here — this task only restructures the dial path.
- Produces:
  - `frame.scalar: Record<GalleryLabel, number>` in `store.ts` (renamed from `frame.rotation`)
  - `onSceneFrame(label: GalleryLabel, cb: (value: number) => void): () => void` in `timeline.ts` (renamed from `onSceneRotation`)
  - An internal `createScrubScene(el: Element, scene: GalleryScene, publish: (p: number, count: number) => number): ScrollTrigger` — not exported; Task 6 calls it for the track.

- [ ] **Step 1: Rename the frame store field**

In `src/scroll/store.ts`, replace the `rotation` entry of the `frame` object:

```ts
  /** Current ring rotation in degrees, per scene label. */
  rotation: { g1: 0, g2: 0, g3: 0, g4: 0 } as Record<'g1' | 'g2' | 'g3' | 'g4', number>,
```

with:

```ts
  /**
   * The last scalar published per scene: degrees for a dial, fractional wall
   * index for the track. Seeds a freshly-mounted listener so a remounted
   * presentation is not stuck at 0 — nothing else reads it.
   */
  scalar: { g1: 0, g2: 0, g3: 0, g4: 0 } as Record<'g1' | 'g2' | 'g3' | 'g4', number>,
```

This is safe: `frame.rotation` is written at `timeline.ts:175` and read at `timeline.ts:87` and nowhere else in the codebase — not by r3f, not by any component.

- [ ] **Step 2: Rename the listener channel**

In `src/scroll/timeline.ts`, replace lines 64–91 (the `Rotate` type through the end of `onSceneRotation`):

```ts
/** One scalar per frame: degrees for a dial, fractional wall index for a track. */
type Publish = (value: number) => void

const frameListeners = new Map<GalleryLabel, Publish>()
const sceneTriggers = new Map<GalleryLabel, ScrollTrigger>()
let triggers: ScrollTrigger[] = []

/** Long enough that a snap never fires mid-gesture, short enough to feel immediate. */
const SNAP_IDLE_MS = 120
const SNAP_DURATION = 0.35

/**
 * The pending idle timer per scene, so a route change cannot leave one firing
 * into a dead trigger. One entry per scene, replaced each frame — an array would
 * grow by one every onUpdate and never shrink.
 */
const snapTimers = new Map<GalleryLabel, ReturnType<typeof setTimeout>>()

/**
 * A presentation registers the single DOM write it owns, and GSAP never leaves
 * this module. Fires once immediately so a freshly mounted scene is not stuck
 * at 0.
 *
 * What the scalar MEANS is the presentation's business: the dial reads it as
 * degrees and writes --r, the track reads it as a fractional wall index and
 * writes --at. This channel only guarantees one number per frame.
 */
export const onSceneFrame = (label: GalleryLabel, cb: Publish): (() => void) => {
  frameListeners.set(label, cb)
  cb(frame.scalar[label])
  return () => {
    frameListeners.delete(label)
  }
}
```

- [ ] **Step 3: Extract the scrub-scene factory**

In `src/scroll/timeline.ts`, replace the whole `for (const scene of GALLERY_SCENES)` loop body inside `buildTimeline` (lines 146–199) with a call to a new factory. First add the factory **above** `buildTimeline`, after `createLabelTrigger`:

```ts
/** Maps a scene's scroll progress to the one scalar its presentation writes. */
type PublishAt = (p: number, count: number) => number

/**
 * A pinned, scrubbed scene: the pin, the per-frame scalar, the discrete index
 * channel, and the idle snap. Every gallery presentation that pins uses this —
 * a dial and the Murals track differ only in `publish` and in which CSS custom
 * property the component writes.
 */
const createScrubScene = (el: Element, scene: GalleryScene, publish: PublishAt): ScrollTrigger => {
  const label = scene.label
  let idle: ReturnType<typeof setTimeout> | undefined

  return ScrollTrigger.create({
    trigger: el,
    start: 'top top',
    end: () => '+=' + pinLengthPx(scene.length, window.innerHeight),
    pin: true,
    invalidateOnRefresh: true,
    onRefresh: (self) => registerLabel(label, self.start),
    onEnter: () => setLabel(label),
    onEnterBack: () => setLabel(label),
    onUpdate: (self) => {
      const p = self.progress
      const count = activeCount(scene)

      frame.sceneProgress = p
      const value = publish(p, count)
      frame.scalar[label] = value
      frameListeners.get(label)?.(value)

      // Discrete channel: ~24 React updates across a 320vh pin, never 60/s.
      setActiveIndex(scene.category, indexAtProgress(p, count))

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
    },
  })
}
```

Note `scrub: 1` is **dropped**. It was already inert — these triggers have no `animation`, so `onUpdate` fires regardless. This is the first of the handoff's logged follow-ups, resolved here because the code moved anyway.

Then the loop in `buildTimeline` becomes:

```ts
  for (const scene of GALLERY_SCENES) {
    const el = document.getElementById(scene.label)
    if (!el) continue

    if (resolved[scene.label] !== 'dial') {
      // No pin: the list owns its own scrolling.
      triggers.push(createLabelTrigger(el, scene.label))
      continue
    }

    const trigger = createScrubScene(el, scene, (p, count) =>
      rotationAtProgress(p, count, scene.seats),
    )
    sceneTriggers.set(scene.label, trigger)
    triggers.push(trigger)
  }
```

- [ ] **Step 4: Update the module docstring**

In `src/scroll/timeline.ts`, the `buildTimeline` docstring currently claims `scrub: 1`. Replace the sentence

```
 * `resolved` says how each gallery scene is actually rendering: a dial pins and
 * scrubs, a list does neither and owns its own scrolling.
```

with

```
 * `resolved` says how each gallery scene is actually rendering: a dial and the
 * Murals track both pin and publish a per-frame scalar through
 * `createScrubScene`; a list does neither and owns its own scrolling.
 */
```

(keeping the closing `*/` that is already there — do not add a second one).

- [ ] **Step 5: Update the Dial's import and callback**

In `src/sections/ring/Dial.tsx` line 6, change:

```ts
import { onSceneRotation, scrollToPiece } from '~/scroll/timeline'
```

to:

```ts
import { onSceneFrame, scrollToPiece } from '~/scroll/timeline'
```

and lines 36–42, change:

```ts
  useEffect(
    () =>
      onSceneRotation(scene.label, (rotation) => {
        ring.current?.style.setProperty('--r', `${rotation}deg`)
      }),
    [scene.label],
  )
```

to:

```ts
  useEffect(
    () =>
      onSceneFrame(scene.label, (degrees) => {
        ring.current?.style.setProperty('--r', `${degrees}deg`)
      }),
    [scene.label],
  )
```

- [ ] **Step 6: Verify nothing else references the old names**

Run: `grep -rn "onSceneRotation\|frame\.rotation" src/`
Expected: no output. If anything matches, update it before continuing.

- [ ] **Step 7: Run the full suite, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: 7 test files / **86** tests pass (70 before this cycle + 14 new in `track.test.ts` + 2 net in `presentation.test.ts`), typecheck clean, build succeeds.

- [ ] **Step 8: Browser regression check on the dials**

Run: `npm run dev`, open `http://localhost:5173/` at 1440×900, and confirm by scrolling that **nothing changed**:

1. Artworks rotates and its counter climbs `01 / 24` → `24 / 24`.
2. Stopping mid-scroll still settles onto a stop within about a second.
3. Clicking an orbit thumb still brings it to centre without navigating.
4. Ovalese and Merchandise still pin and rotate; merch chips still re-bloom.
5. Document height is still exactly 15 viewports — the track is not wired yet.

This is a refactor of code verified end-to-end earlier in this cycle; three scenes exercise the extraction, so a mistake shows up immediately.

- [ ] **Step 9: Commit**

```bash
git add src/scroll/store.ts src/scroll/timeline.ts src/sections/ring/Dial.tsx
git commit -m "refactor: extract createScrubScene and generalise the per-frame channel"
```

---

### Task 4: The dossier

One wall: a context plate with its title and metadata, beside a column of two detail crops. No motion of its own — it carries `--i` and reads the row's `--at`.

**Files:**
- Create: `src/sections/track/Dossier.tsx`
- Modify: `src/styles/index.css` (add one type token)

**Interfaces:**
- Consumes: `DOSSIER_W`, `DOSSIER_H`, `MAX_BEND`, `CHAPTER_LABELS` from Task 1.
- Produces: `<Dossier piece={Piece} index={number} count={number} active={boolean} />`

- [ ] **Step 1: Add the dossier title type token**

The dossier title is Instrument Serif 30px/1.1 and no existing token matches. In `src/styles/index.css`, immediately after the `--text-leaf` pair (around line 58), add:

```css
  --text-dossier: 30px;
  --text-dossier--line-height: 1.1;
```

- [ ] **Step 2: Write the component**

Create `src/sections/track/Dossier.tsx`:

```tsx
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import type { Piece } from '~/data'
import { CHAPTER_LABELS, DOSSIER_H, DOSSIER_W, MAX_BEND } from '~/lib/track'

type Props = {
  piece: Piece
  index: number
  count: number
  active: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * One wall, as a dossier.
 *
 * No full-width photograph of these walls exists, so a wall is NEVER faked as a
 * panorama: one context shot at the widest angle available, plus two detail
 * crops. That decision is the whole reason this scene breaks pattern.
 *
 * The plane bend is pure CSS off the row's --at, clamped to ±MAX_BEND so distant
 * walls sit at a constant angle instead of winding up. Nothing here runs per
 * frame — see `bendDegrees` in lib/track.ts for the contract this transcribes.
 */
export const Dossier = ({ piece, index, count, active }: Props) => {
  const context = piece.images.find((i) => i.role === 'context')
  const details = piece.images.filter((i) => i.role === 'detail').slice(0, 2)
  const chapter = piece.location ? CHAPTER_LABELS[piece.location] : ''

  return (
    <Link
      to={`/murals/${piece.slug}`}
      aria-label={`Open ${piece.title}`}
      className={`flex shrink-0 gap-[14px] border p-4 transition-opacity ${
        active ? 'border-ochre/35 opacity-100 shadow-glow' : 'border-cream/10 opacity-45'
      }`}
      style={
        {
          '--i': index,
          width: DOSSIER_W,
          height: DOSSIER_H,
          background: 'var(--color-ink-panel)',
          transform: `rotateY(clamp(-${MAX_BEND}deg, calc((var(--i) - var(--at, 0)) * ${MAX_BEND}deg), ${MAX_BEND}deg))`,
        } as CSSProperties
      }
    >
      {/* Context column — the widest angle that exists, never a stitched panorama. */}
      <div className="flex w-[540px] flex-col gap-3">
        <Placeholder
          label={context?.alt ?? piece.title}
          tone={active ? 'focus' : 'dim'}
          className="flex-1"
        />
        <div>
          <p className="font-display text-dossier">{piece.title}</p>
          <p className="mt-[7px] font-mono text-caption tracking-caption text-cream/50 uppercase">
            {chapter} · {piece.medium} · {piece.year} — Wall {pad(index + 1)} / {pad(count)}
          </p>
        </div>
      </div>

      {/* Detail column. data.test.ts guarantees two crops per wall, so there is
          no empty-slot case to handle here. */}
      <div className="flex w-[230px] flex-col gap-[14px]">
        {details.map((image) => (
          <Placeholder
            key={image.alt}
            label={image.alt}
            tone={active ? 'focus' : 'dim'}
            className="flex-1"
          />
        ))}
        <p className="font-mono text-ph tracking-rail text-ochre-bright uppercase">
          Context + detail pair
          <br />
          Click → wall page
        </p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean. The component is not rendered anywhere yet, so there is nothing to see in a browser — Task 5 mounts it.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: 7 files / 86 tests pass, unchanged. No `.test.ts` covers `.tsx`, by design.

- [ ] **Step 5: Commit**

```bash
git add src/sections/track/Dossier.tsx src/styles/index.css
git commit -m "feat: add the mural dossier — context plate, metadata, detail pair"
```

---

### Task 5: The track row, mounted

Renders the row, the chapter bar and the annotation, and swaps out the scaffold. After this task the scene is **visible but static**: `--at` stays at its `0` default because g3 is not yet a scrub scene, so wall 1 sits centred with its neighbours bent and dimmed. The chapter buttons are wired to `scrollToPiece` but stay inert until Task 6 registers g3's trigger — that is expected, and Task 6 makes them live.

**Files:**
- Create: `src/sections/track/Track.tsx`
- Modify: `src/sections/GalleryScene.tsx:8-9` and `:133-144`

**Interfaces:**
- Consumes: `Dossier` from Task 4; `chaptersOf`, `trackGutter`, `TRACK_PITCH` from Task 1; `onSceneFrame` and `scrollToPiece` from Task 3.
- Produces: `<Track scene={GalleryScene} activeIndex={number} />`, matching `Dial` and `SnapList`.

- [ ] **Step 1: Write the component**

Create `src/sections/track/Track.tsx`:

```tsx
import { useEffect, useRef, type CSSProperties } from 'react'
import { activePieces, type GalleryScene } from '~/scroll/scenes'
import { chaptersOf, trackGutter, TRACK_GAP, TRACK_PITCH } from '~/lib/track'
import { onSceneFrame, scrollToPiece } from '~/scroll/timeline'
import { Dossier } from './Dossier'

type Props = {
  scene: GalleryScene
  activeIndex: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The Murals presentation — the deliberate pattern break.
 *
 * The ring unrolls: vertical scroll becomes an x-translate. Rotation arrives as
 * ONE CSS custom property per frame, --at, the fractional wall index. That
 * single value positions the row AND bends every plane (see Dossier), so there
 * is no per-dossier JavaScript and no second channel. React re-renders only when
 * activeIndex changes.
 */
export const Track = ({ scene, activeIndex }: Props) => {
  const row = useRef<HTMLDivElement>(null)
  const pieces = activePieces(scene)
  const count = pieces.length
  const chapters = chaptersOf(pieces)

  // The single DOM write this component owns. GSAP stays inside timeline.ts.
  useEffect(
    () =>
      onSceneFrame(scene.label, (at) => {
        row.current?.style.setProperty('--at', String(at))
      }),
    [scene.label],
  )

  if (count === 0) return null

  return (
    <>
      {/* The track. One transform on the row; the bends are CSS off --at. */}
      <div
        className="absolute right-0 left-0 flex items-center"
        style={{ top: 308, height: 430, perspective: '1600px' }}
      >
        <div
          ref={row}
          className="flex items-center"
          style={
            {
              '--at': 0,
              gap: TRACK_GAP,
              paddingInline: trackGutter(),
              transform: `translateX(calc(var(--at) * -${TRACK_PITCH}px))`,
            } as CSSProperties
          }
        >
          {pieces.map((piece, i) => (
            <Dossier
              key={piece.slug}
              piece={piece}
              index={i}
              count={count}
              active={i === activeIndex}
            />
          ))}
        </div>
      </div>

      {/* Why this scene looks different from the other three. */}
      <p
        className="absolute z-10 text-right font-mono text-caption-sm tracking-rail text-cream/42"
        style={{ right: 72, top: 250, width: 280 }}
      >
        No full-width photo exists for these walls,
        <br />
        so a wall is presented as context + detail
        <br />
        rather than faked as one panorama
      </p>

      {/* Chapters. The active one is derived from the active wall, never stored. */}
      <div
        className="absolute z-10 flex gap-[30px] font-mono text-caption tracking-caption-wide uppercase"
        style={{ left: 118, top: 770 }}
      >
        {chapters.map((chapter) => {
          const on =
            activeIndex >= chapter.firstIndex && activeIndex < chapter.firstIndex + chapter.count
          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => scrollToPiece(scene.label, chapter.firstIndex, count)}
              aria-label={`Jump to ${chapter.label}`}
              className={on ? 'text-ochre' : 'text-cream/35'}
            >
              {chapter.label} — {pad(chapter.count)} walls {on ? '●' : ''}
            </button>
          )
        })}
        <span className="text-cream/25">Two chapters, scrubbed in sequence</span>
      </div>
    </>
  )
}
```

Note the chapter-active test uses `firstIndex + count`, which is only a contiguous range. That is correct for the shipped data (BGC 0–3, Layaw 4–6) and degrades to highlighting nothing rather than crashing if walls are ever interleaved — `chaptersOf` still counts them correctly for the label.

- [ ] **Step 2: Swap the scaffold for the component**

In `src/sections/GalleryScene.tsx`, add the import after the `SnapList` import on line 9:

```ts
import { Track } from './track/Track'
```

Then replace the whole `rendered === 'track'` block (lines 133–144):

```tsx
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
```

with:

```tsx
      {rendered === 'track' && <Track scene={scene} activeIndex={index} />}
```

Also update the component docstring: replace

```
 * list, or (Murals) the track scaffold, which is deliberately unfinished and
 * belongs to a separate spec.
```

with

```
 * list, or (Murals) the x-translate track.
```

- [ ] **Step 3: Typecheck and run the suite**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 4: Look at it in a browser**

Run: `npm run dev`, open `http://localhost:5173/` at 1440×900, scroll to the Murals scene, and confirm:

1. Seven dossiers render in a row; the first is centred, bordered ochre with a glow, at full opacity.
2. Neighbours are dimmed to .45 and visibly bent — the plane immediately right leans one way, the ones beyond it hold a constant angle.
3. Each dossier shows a context plate, a serif title, a metadata line reading e.g. `BGC · ACRYLIC ON CONCRETE · 2025 — WALL 01 / 07`, two detail crops, and the ochre `CONTEXT + DETAIL PAIR / CLICK → WALL PAGE` note.
4. The chapter bar reads `BGC — 04 WALLS ●` and `LAYAW, MAKATI — 03 WALLS`, followed by `TWO CHAPTERS, SCRUBBED IN SEQUENCE`.
5. The right-side annotation is present.
6. Clicking a dossier navigates to `/murals/<slug>`.
7. The scene does **not** yet pin or move — the document is still 15 viewports. That is this task's expected end state.

- [ ] **Step 5: Commit**

```bash
git add src/sections/track/Track.tsx src/sections/GalleryScene.tsx
git commit -m "feat: render the Murals track, chapter bar and annotation"
```

---

### Task 6: Wire g3 as a scrub scene

The pin, the scrub, the snap, the index channel and the chapter jumps all go live here.

**Files:**
- Modify: `src/scroll/timeline.ts` (the `buildTimeline` loop from Task 3)

**Interfaces:**
- Consumes: `createScrubScene` from Task 3; `trackAt` from Task 1.
- Produces: g3 registered in `sceneTriggers`, which is what makes `scrollToPiece('g3', …)` — and therefore Task 5's chapter buttons — work.

- [ ] **Step 1: Import the mapping**

In `src/scroll/timeline.ts`, add to the imports:

```ts
import { trackAt } from '~/lib/track'
```

- [ ] **Step 2: Route track scenes through the factory**

Replace the loop body written in Task 3 with:

```ts
  for (const scene of GALLERY_SCENES) {
    const el = document.getElementById(scene.label)
    if (!el) continue
    const rendered = resolved[scene.label]

    if (rendered === 'list') {
      // No pin: the list owns its own scrolling.
      triggers.push(createLabelTrigger(el, scene.label))
      continue
    }

    // A dial and the track differ only in the scalar they publish: degrees off
    // the ring's seat step, or the fractional wall index.
    const trigger = createScrubScene(
      el,
      scene,
      rendered === 'track'
        ? (p, count) => trackAt(p, count)
        : (p, count) => rotationAtProgress(p, count, scene.seats),
    )
    sceneTriggers.set(scene.label, trigger)
    triggers.push(trigger)
  }
```

- [ ] **Step 3: Run the suite, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: 7 files / 86 tests pass, typecheck clean, build succeeds.

- [ ] **Step 4: Verify in a browser**

Run: `npm run dev` and open `http://localhost:5173/` at 1440×900. Drive it with real wheel input — if you automate this, the page must be the **active tab**, or `requestAnimationFrame` is throttled and nothing Lenis-driven will move. Confirm rAF is alive first by checking it ticks ~55 times in 500ms.

Check each of these:

1. **Document height** is ~17.4 viewports (was 15). At 900px tall that is ~15660px. g3's pin measures 240vh = 2160px.
2. **The track scrubs.** Scrolling through g3 translates the row left; `--at` on the row climbs 0 → 6.
3. **The counter climbs** `01 / 07` → `07 / 07`, reaching 07/07 while still pinned.
4. **Idle snap works.** Stop mid-scroll; within about a second `--at` settles on an integer. Read it with
   `getComputedStyle(document.querySelector('#g3 [style*="--at"]')).getPropertyValue('--at')`.
5. **The centred dossier is flat** and its neighbours are bent. Check `getComputedStyle(el).transform` on the active dossier — its matrix3d should be effectively identity in Y — while a neighbour one pitch away is at the ±8° clamp.
6. **Chapter jump works.** Click `LAYAW, MAKATI — 03 WALLS`; `--at` animates to exactly 4, the `●` moves to Layaw, and the URL does not change.
7. **Clicking a dossier** navigates to `/murals/<slug>`, and going back restores scroll position.
8. **The other three scenes still work** — Artworks and Ovalese pin and rotate, Merchandise chips still re-bloom. Their label offsets shifted by 2160px and must have recomputed.
9. **Console is clean** apart from the known three.js `Clock` deprecation notice.

- [ ] **Step 5: Verify the fallback**

Resize the browser to 800px wide and confirm the Murals scene renders as the horizontal snap list — seven cards, native scroll-snap, each linking to `/murals/<slug>` — with no pin.

Then set `prefers-reduced-motion: reduce` at 1440px wide and confirm the same.

- [ ] **Step 6: Commit**

```bash
git add src/scroll/timeline.ts
git commit -m "feat: pin and scrub the Murals track through the shared scrub scene"
```

---

### Task 7: Update the handoff record

The handoff is the document a fresh session reads first. Leaving it saying "g3 pins but does not animate" after this work would mislead the next reader twice over.

**Files:**
- Modify: `docs/superpowers/2026-07-30-gallery-ring-timeline-handoff.md`

- [ ] **Step 1: Update the handoff**

Make these edits:

1. In **"NOT yet verified by anyone"** — replace the whole section with a note that both idle snap and thumb click were confirmed in a browser on 2026-07-30: the snap pulls backwards onto the stop and holds, it never fires mid-gesture across 14 wheel events at 70ms intervals, and a thumb click rotates the clicked piece to centre without navigating.
2. In **"What's next"** — remove the Murals bullet and its "only item that reads as broken" note.
3. In **"Logged follow-ups"** — remove the `scrub: 1` bullet (resolved in Task 3).
4. In the **module map** — add `src/lib/track.ts`, `src/sections/track/Track.tsx` and `src/sections/track/Dossier.tsx`.
5. In **invariant 1** — note that the channel is now `onSceneFrame` carrying one scalar, `--r` for dials and `--at` for the track.
6. Update the **Status** line to the new head commit and the new test count.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/2026-07-30-gallery-ring-timeline-handoff.md
git commit -m "docs: record the Murals track and the closed verification gaps"
```

---

## Self-Review

**Spec coverage.** §0 corrected starting state → Task 6 adds the pin and the index channel. §2 geometry → Task 1 constants, Task 4/5 markup. §3 single frame scalar → Task 3 channel, Task 5 row transform, Task 4 bend. §4 module map → Tasks 1, 3, 4, 5, 6 (every row covered; `look.ts` explicitly untouched). §5 presentation resolution → Task 2. §6 components → Tasks 4 and 5. §7 edge cases → `count === 0` guarded in Task 5 Step 1 and tested in Task 1; `count === 1` covered by `trackAt` tests and `needsSnap`'s existing guard; fallback verified in Task 6 Step 5; document height and resize in Task 6 Step 4. §8 testing → Tasks 1 and 2 for pure tests, Task 6 Step 4 for the browser list. §9 out of scope → nothing here touches it.

**Placeholder scan.** No TBD/TODO. Every code step carries the actual code. The one prose-only step is Task 7 Step 1, which is documentation editing where the content is enumerated point by point.

**Type consistency.** `onSceneFrame` is introduced in Task 3 and used with that exact name in Tasks 4 (no) / 5 (yes). `frame.scalar` introduced Task 3, used Task 3 only. `trackAt`, `bendDegrees`, `trackGutter`, `chaptersOf`, `CHAPTER_LABELS`, `DOSSIER_W`, `DOSSIER_H`, `MAX_BEND`, `TRACK_PITCH` all defined in Task 1 with the signatures used in Tasks 4, 5 and 6. `Dossier` props `{ piece, index, count, active }` defined Task 4, called with exactly those in Task 5. `Track` props `{ scene, activeIndex }` defined Task 5, called with exactly those in Task 5 Step 2. `createScrubScene(el, scene, publish)` defined Task 3, called with that arity in Tasks 3 and 6.

**One deliberate wrinkle:** Task 5 ships chapter buttons that do nothing until Task 6. Called out in the task preamble so a reviewer does not treat it as a defect.

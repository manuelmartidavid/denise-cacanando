# Gallery ring + scroll timeline — design

**Date:** 2026-07-30
**Project:** Ovalese — Denise Cacanando artist portfolio
**Status:** approved, ready for implementation planning

## 1. Context

The repo has a working scaffold: Vite + React 19 + TS + Tailwind v4, design tokens, four typed data
modules (50 pieces, tested), the two-channel scroll store, Lenis and reduced-motion hooks, static
desktop section scaffolds, the side rail, and the pollen point system.

Nothing creates a ScrollTrigger. `registerLabel` is never called, no section pins, and
`frame.progress` is never written. `lib/ring.ts` exists and is tested, but has no rotation source.

This spec covers the scroll timeline and the gallery ring together, because the ring is a pure
function of scroll progress — designing either alone means guessing at the other's interface.

## 2. Correction to the ring model

`lib/ring.ts` assumes `step = 360 / count`: 24 pieces means seats every 15°. The design of record
disagrees. `Ovalese Site - Pollen Dial.dc.html:122–131` draws **eight seats at exactly 45°** —
`(0,-326) (230,-230) (326,0) (230,230) (0,326) (-230,230) (-326,0) (-230,-230)` — plus a **separate
280px centre plate** at the ring origin carrying the ochre border, the glow, and the caption 196px
below it.

At 15° spacing, 112px thumbs on a 326px orbit sit 85px apart and overlap.

The real model is **N orbit seats + 1 centre slot**, where the orbit is a window onto the category:

| Scene | Seats | Pieces | Relationship |
|---|---|---|---|
| Artworks | 8 | 24 | window — content recycles through seats |
| Ovalese | 6 | 7 | 6 orbit + 1 centre = all 7 visible at once |
| Merchandise | 6 | 12 | window |

**The focused piece is never on the orbit.** It is the centre plate. `FOCUS_ANGLE`, `thumbAngle`,
`indexAtFocus`, `snapRotation`, `progressToRotation` and `visibleThumbs` all encode the wrong model
and are replaced in §5. `ring.test.ts` is rewritten against the seats model — revision, not addition.

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Rotation reaches the DOM as **one CSS custom property** per frame | One JS write per frame; the compositor does the rest; React never re-renders during scroll |
| D2 | The centre plate **cross-fades in DOM**; the r3f ripple is deferred | No imagery exists — a displacement shader would have to displace a synthesised stripe texture, then be redone when real images land |
| D3 | Snap settles **scroll position on rest**, per scene; rotation stays a pure function of progress | Rotation can never drift from the scrollbar; scrolling back retraces exactly |
| D4 | Snap is driven **through Lenis**, not `ScrollTrigger.snap` | Two writers of scroll position fight; `useLenis.ts:29` already makes Lenis the authority |
| D5 | The global label snap is **dropped** | Per-scene snapping already prevents stalling inside a scene; Hero/About/Contact are plain 100vh sections where stopping is normal |
| D6 | Both fallbacks ship, sharing **one index model** | Retrofitting a pin-free path later reopens the timeline, the scene component and the store |
| D7 | Presentation is a **per-scene declaration** in `scenes.ts`, and pin length is read from it | The two presentations have different scroll contracts; making the choice data means switching later is a data change, not a retrofit |

## 4. Architecture

```
                 scroll
                   │
        ┌──────────▼──────────┐
        │  scroll/timeline.ts │   one ScrollTrigger per section
        │  builds + owns pins │   registers label offsets
        └─────┬──────────┬────┘
              │          │
   continuous │          │ discrete
   (60fps)    │          │ (on index change only)
              ▼          ▼
        frame.rotation   setActiveIndex()
              │          │
              ▼          ▼
        --r on ring   React re-render
        (1 DOM write) (centre, caption, progress row)
```

| Module | Owns | Depends on |
|---|---|---|
| `lib/ring.ts` *(revised)* | Seat geometry and index math. Pure — no React, DOM or GSAP | nothing |
| `scroll/scenes.ts` *(revised)* | Scene declarations, now including `presentation` and `seats` | `data` |
| `scroll/timeline.ts` *(extended)* | ScrollTriggers, pin lengths, snap, label registration. **The only module that touches GSAP** | `scenes`, `store`, `ring` |
| `scroll/usePresentation.ts` *(new)* | Resolving reduced-motion + viewport → `'dial' \| 'list'` | `useReducedMotion` |
| `sections/GalleryScene.tsx` *(extended)* | Shared furniture; picks a presentation | all of the above |
| `sections/ring/Dial.tsx` *(new)* | The pinned rotating presentation | `ring` |
| `sections/ring/SnapList.tsx` *(new)* | The pin-free presentation | `ring` |
| `sections/ring/CentreSlot.tsx` *(new)* | Centre plate, cross-fade swap, click→route; holds the ripple seam | `data` |

**The invariant:** rotation never enters React state; `activeIndex` never enters the frame loop.
`store.ts` already encodes this split; this design holds to it. Every module except `timeline.ts`
and the two presentations is testable with no scroll harness and no browser.

## 5. `lib/ring.ts` — revised contract

Positioning moves to CSS, so the coordinate helpers are deleted rather than reworked.

```ts
/** Angular gap between neighbouring seats. Artworks 45°, Ovalese/Merch 60°. */
export const seatStep = (seats: number): number

/** Ring rotation in degrees at scroll progress p. */
export const rotationAtProgress = (p: number, count: number, seats: number): number
//  => p * max(0, count - 1) * seatStep(seats)

/** Focused piece at progress p. Clamped to [0, count-1]. */
export const indexAtProgress = (p: number, count: number): number
//  => clamp(round(p * (count - 1)), 0, count - 1)

/** Progress at which `index` is focused. Piece 0 at p=0, piece n-1 at p=1. */
export const progressAtIndex = (index: number, count: number): number

/** Nearest snap stop. Idempotent: snapProgress(snapProgress(p)) === snapProgress(p). */
export const snapProgress = (p: number, count: number): number

/**
 * Piece indices occupying the orbit seats, forward from the focus.
 * Length is min(seats, count - 1) — the centre holds one piece, and a filtered
 * merch ring of 1 must not repeat that piece around the orbit.
 */
export const seatContent = (activeIndex: number, seats: number, count: number): number[]

/** 0–1 across the category, for the `07 / 24` progress row and its track dot. */
export const trackProgress = (index: number, count: number): number   // kept as-is
```

**Deleted:** `FOCUS_ANGLE`, `step`, `thumbAngle`, `polar`, `thumbPosition`, `counterRotation`,
`normalize`, `shortestDelta`, `rotationForIndex`, `indexAtFocus`, `snapRotation`,
`progressToRotation`, `visibleThumbs`.

## 6. Scene declarations

`scenes.ts` gains `presentation` and `seats`; `visible` is removed (superseded by `seats`).

```ts
export type GalleryScene = {
  label: 'g1' | 'g2' | 'g3' | 'g4'
  category: CategoryId
  presentation: 'dial' | 'track'   // 'track' = Murals; see §11
  seats: number                    // orbit seats, not piece count
  length: number                   // pin length in vh — read from the presentation
  ground: 'dark' | 'cream'
  guide: number                    // outer guide circle, px
  orbit: number                    // thumb orbit radius, px
}
```

| label | category | presentation | seats | length | ground | guide | orbit |
|---|---|---|---|---|---|---|---|
| g1 | artworks | dial | 8 | 320 | dark | 660 | 326 |
| g2 | ovalese | dial | 6 | 220 | dark | 640 | 326 |
| g3 | murals | track | — | 240 | dark | — | — |
| g4 | merch | dial | 6 | 260 | cream | 600 | 296 |

## 7. Timeline

`timeline.ts` stays the sole owner of GSAP and creates **one ScrollTrigger per section**. A single
`gsap.timeline()` cannot pin four sections independently, so the "master timeline" of the README is
a module boundary, not a GSAP object. Everything the README wants from it — seven labels,
proportional pins, one post-fonts refresh — still holds.

**Non-pinned sections** (`hero`, `about`, `contact`): a trigger that registers its label offset and
writes `frame.progress`. No pin.

**Dial scenes**: `pin: true`, `scrub: 1`, `end: () => '+=' + (length / 100) * window.innerHeight`.

Rotation and index per scene, with `n = count`, `seats` from the declaration:

| Scene | `rotation(p)` | Total turn | Snap stops |
|---|---|---|---|
| Artworks | `p · 23 · 45°` | 1035° (2.9 turns) | 24, every ~13.9vh |
| Ovalese | `p · 6 · 60°` | 360° (exactly 1 turn) | 7, every ~36.7vh |
| Merchandise | `p · 11 · 60°` | 660° (1.8 turns) | 12, every ~23.6vh |

`onUpdate` does three things, in order:

1. writes `frame.rotation[label]`
2. notifies the Dial's registered `--r` callback
3. calls `setActiveIndex` **only when `indexAtProgress` changes** — roughly 24 discrete React
   updates across a 320vh pin, never 60/s

**Registration seam.** `timeline.ts` exposes `onSceneUpdate(label, cb)`. The Dial registers
`(rotation) => el.style.setProperty('--r', rotation + 'deg')`. GSAP stays in one module; DOM writes
stay in the component that owns the element.

**Fonts.** `refreshAfterFonts()` already exists and is called from `ScrollPage`; it stays.

**Teardown** kills every trigger it created and clears label offsets. `ScrollPage` unmounts on every
detail-route navigation, so a leak here compounds fast.

## 8. Snap

Per dial scene:

1. A ~120ms debounce on `onUpdate` detects scroll idle.
2. On idle, if the trigger is active and `Math.abs(p - snapProgress(p, n)) > 0.001`, convert the
   target to document px
   (`trigger.start + target * (trigger.end - trigger.start)`) and call
   `lenis.scrollTo(px, { duration: 0.35 })`.
3. The operation is idempotent — a re-fire lands on the same target, so no guard flag is needed
   beyond the epsilon.

If `getLenis()` returns null (reduced motion), no dial exists and no snap runs.

## 9. Presentations

### `Dial.tsx`

Mounts `min(seats, count - 1)` seat elements, each carrying `--i`. The ring carries `--r` and
`--step`; positioning is entirely CSS:

```css
.ring { transform: rotate(var(--r)); }
.seat { transform: translate(-50%, -50%)
                   rotate(calc(var(--i) * var(--step)))
                   translate(0, calc(-1 * var(--orbit)))
                   rotate(calc(-1 * var(--r))); }
```

Seat *i* shows `pieces[seatContent(activeIndex, seats, count)[i]]` — a forward window, reassigned on
index change only, through React. On Ovalese the 6 seats plus the centre show all 7 pieces with no
repeats.

Clicking a seat **scrolls to that piece's stop** (`lenis.scrollTo` at `progressAtIndex`); it does
not navigate. Only the centre is a link. This matches the README: "Clicking a ring thumb rotates it
to centre (it does not navigate). Clicking the centred piece opens its route."

### `SnapList.tsx`

Native `scroll-snap-type: x mandatory`. Nearest-item detection on scroll → `setActiveIndex`. Every
item is a real link. No rotation, no pin, no GSAP. Centred item 250 × 330px, next peeking at
200 × 264px, `gap: 18px`, 24px left padding.

### `usePresentation`

Two distinct unions, deliberately:

- `scene.presentation: 'dial' | 'track'` — what the scene *declares* it is
- `usePresentation(scene): 'dial' | 'list' | 'track'` — what actually renders

Resolution: a `'track'` scene always resolves to `'track'` (g3 renders its scaffold either way; its
fallback belongs to the Murals spec). For a `'dial'` scene, `prefers-reduced-motion` **or** viewport
< 900px resolves to `'list'`; otherwise `'dial'`. D7's future switch is the declaration.

## 10. Centre slot

`CentreSlot.tsx` owns the plate, the ochre border, the glow, the caption block 196px below, and the
route link. Sizes per scene: 280px circle (Artworks), 248 × 312px ovoid (Ovalese), 250px square
(Merchandise).

The cross-fade is two stacked layers keyed by slug. **One function, `swapTo(piece)`, is the
documented ripple seam**: when real textures land, the r3f displacement shader replaces that
function's body and nothing else in the codebase changes.

## 11. State and edge cases

`store.ts` is unchanged. `activeIndex` and `merchFilter` already exist and carry the right shape.

**Empty or single-piece category.** `count = 0` renders nothing and registers no snap. `count = 1`
renders the centre only, zero seats, and no snap stops beyond progress 0.

**`merchFilter` changes `n` mid-scene.** Filtering 12 pieces to 5 jackets changes the snap stops and
the index range. `activeCount(scene)` reads the count dynamically, so the rotation mapping stays
correct — 5 stops simply spread across the same 260vh pin. What does need handling: the old
`activeIndex` can point past the end of the filtered list. On filter change, reset
`activeIndex.merch` to 0 and call `ScrollTrigger.refresh()` to remeasure. The `earrings` filter
yields `count = 1`, which is the single-piece case above — this is why `seatContent` is capped at
`count - 1`.

**Murals (g3)** pins for 240vh with its existing scaffold content, so label offsets and document
height are correct. It registers no index updates and no snap. The x-translate track is a separate
spec; it is unfinished on purpose and is marked as such in the component.

## 12. Testing

Rewritten and new pure tests in `lib/ring.test.ts`:

- `seatStep` for 8 and 6 seats
- `indexAtProgress` hits exactly 0 at p=0 and n−1 at p=1, for each of 24 / 7 / 12
- `progressAtIndex` and `indexAtProgress` round-trip
- `snapProgress` is idempotent
- `rotationAtProgress` is monotonic and matches the §7 totals
- `seatContent` wraps at `n`, never repeats the focused piece, and caps its length at `count - 1`
- `count = 0` and `count = 1` return sane values everywhere

Not unit tested: GSAP pin behaviour, Lenis snap feel, cross-fade timing. Those are verified in the
browser.

**Verification before this work is called done:**

```
npm run typecheck && npm test && npm run build
```

plus a manual browser pass: all four scenes pin and release cleanly, Artworks reaches piece 24 at
pin release, back-navigation from a detail route restores scroll position, and the reduced-motion
path releases all pins.

## 13. Out of scope

Named explicitly so nothing here reads as finished:

- Murals x-translate track (g3 pins but does not animate)
- Butterfly flock — all ~1,200 instances, attractors, MotionPath between scenes
- The r3f ripple/displacement shader on the centre slot
- Between-scene "collapse to a seed" transition
- Mobile bottom ticker and the rail's cream-ground flip
- Detail-page media: zoomable artwork, orbitable ovoid, mural crop strip
- All imagery, and Denise's copy

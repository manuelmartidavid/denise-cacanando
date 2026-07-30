# Murals x-translate Track — Design

**Scene:** g3 · Murals · the deliberate pattern break.
**Supersedes:** the "separate spec" deferral in
`docs/superpowers/specs/2026-07-30-gallery-ring-timeline-design.md` §9 and §11.
**Design of record:** `README.md` §05 and the `05 MURALS` frame in
`Ovalese Site - Pollen Dial.dc.html` (lines 208–245).

---

## 0. Starting state, corrected

The gallery-ring handoff and the parent spec both say *"g3 pins for 240vh but does not animate."*
**It does not pin.** `buildTimeline` takes the `resolved[label] !== 'dial'` branch for a `track`
scene and creates a plain label trigger, so `scene.length: 240` is read by nothing. Measured in the
browser: g3 spans 8460→9360, exactly one 900px viewport.

Consequences this spec must own, rather than inherit as already-solved:

- Adding the pin grows the document from 15 viewports to ~17.4 (`+240vh`).
- g3 currently registers no `ScrollTrigger` in `sceneTriggers`, so `scrollToPiece('g3', …)` is a
  no-op today. It starts working the moment the scene is built through the shared factory.
- `activeIndex.murals` is never written today. The progress row therefore reads `01 / 07`
  permanently.

## 1. What the scene is

Seven walls, scrubbed horizontally. Vertical scroll maps to x-translate; the ring "unrolls".

No full-width photograph of these walls exists, so **a wall is never faked as a panorama**. Each
wall is a *dossier*: one context plate at the widest angle available, its title and metadata
beneath, beside a column of two detail crops. That decision is the reason the scene breaks pattern,
and the right-side annotation on screen says so to the viewer.

## 2. Geometry

Taken from the mockup frame, not invented.

| Value | px | Source |
| --- | --- | --- |
| Context plate column | 540 | mockup |
| Detail column | 230 | mockup |
| Gap between the two columns | 14 | mockup |
| Dossier padding | 16 | mockup |
| **Dossier width** | **816** | `16 + 540 + 14 + 230 + 16` |
| **Dossier height** | **410** | mockup |
| Gap between dossiers | 24 | mockup row `gap:24px` |
| **Track pitch** | **840** | `816 + 24` |
| Row vertical band | top 308, height 430 | mockup |
| Perspective on the row | 1600 | chosen; see §3 |

The row is centred with the gutter idiom already established in `snapList.ts`:
`padding-inline: calc(50% - 408px)`. This is what lets wall 1 and wall 7 both reach the viewport
centre — the same defect class as the snap-list tail bug fixed in the previous cycle, avoided here
by construction rather than by patch.

Pin length stays **240vh**, unchanged from `scenes.ts`. Ovalese pins 220vh for the same 7 pieces, so
the track is marginally slower per wall, which suits a denser object.

## 3. The single frame scalar

The scene runs on **one CSS custom property per frame**, exactly as the dial runs on `--r`.

`--at` is the *fractional* active index: `p * (count - 1)`. It goes on the row.

```css
/* the row */
transform: translateX(calc(var(--at) * -840px));
perspective: 1600px;

/* each dossier, carrying its own --i */
transform: rotateY(clamp(-8deg, calc((var(--i) - var(--at)) * 8deg), 8deg));
```

The row's translate and every plane's ±8° bend fall out of the same variable. No per-dossier
JavaScript, no measurement, no `getBoundingClientRect` in a frame loop, and no second channel
alongside the rotation one.

Sign convention: a dossier to the **right** of centre (`--i > --at`) gets a **positive** `rotateY`,
so its outer edge recedes. Walls fan away from the viewer symmetrically on both sides.

`clamp()` reaches ±8° at exactly one pitch from centre and holds there, so distant walls sit at a
constant angle instead of winding up.

## 4. Module map

| Module | Status | Role |
| --- | --- | --- |
| `src/lib/track.ts` | **new** | Pure track geometry: `DOSSIER_W`, `DOSSIER_H`, `TRACK_GAP`, `TRACK_PITCH`, `trackAt`, `bendDegrees`, `trackGutter`, `chaptersOf`. |
| `src/lib/track.test.ts` | **new** | Pure tests for all of the above. |
| `src/scroll/timeline.ts` | refactor | Extract `createScrubScene`; both presentations use it. Rename `onSceneRotation` → `onSceneFrame`. |
| `src/scroll/store.ts` | edit | Rename `frame.rotation` → `frame.scalar` and redocument it. |
| `src/scroll/presentation.ts` | edit | A `track` scene falls back to `list`. |
| `src/sections/track/Track.tsx` | **new** | The row, the chapter bar, the annotation. Owns the one DOM write. |
| `src/sections/track/Dossier.tsx` | **new** | One wall. |
| `src/sections/GalleryScene.tsx` | edit | Replace the scaffold `<p>` with `<Track>`. |

`src/sections/ring/look.ts` is untouched; its `murals` entry stays a documented zero — the track
does not use ring geometry. (It is one of the two-sources-of-truth items already logged in the
handoff; this spec does not widen that problem, and does not fix it either.)

### `src/lib/track.ts`

```ts
export const DOSSIER_W = 816
export const DOSSIER_H = 410
export const TRACK_GAP = 24
export const TRACK_PITCH = DOSSIER_W + TRACK_GAP   // 840

/** Fractional active index at progress p. Wall 0 at p=0, wall n-1 at p=1. */
export const trackAt = (p: number, count: number): number => p * Math.max(0, count - 1)

/** Plane bend for the dossier at index i, clamped to ±MAX_BEND. */
export const bendDegrees = (i: number, at: number, max = 8): number =>
  Math.max(-max, Math.min(max, (i - at) * max))

/** Symmetric centring gutter, so wall 1 and wall n both reach centre. */
export const trackGutter = (width = DOSSIER_W): string => `calc(50% - ${width / 2}px)`

export type Chapter = {
  id: MuralLocation
  label: string
  count: number
  firstIndex: number
}

/** Chapters in the order their first wall appears. Derived, never stored. */
export const chaptersOf = (pieces: Piece[]): Chapter[]
```

`bendDegrees` exists as a pure function so the clamp is tested, even though the shipped bend is
computed by CSS `clamp()` rather than by calling it per frame. The two must agree; the test pins the
contract and the CSS is written from it.

`chaptersOf` groups by `piece.location`, keyed in first-appearance order. `count` is the total
occurrences of that location, `firstIndex` the index of its first wall. Written to tolerate
non-contiguous locations (it does not assume the data is grouped) even though `murals.ts` is grouped
BGC-then-Layaw today.

Chapter labels come from a small map in `track.ts`: `bgc → 'BGC'`, `layaw → 'Layaw, Makati'`.

### `createScrubScene` in `timeline.ts`

The existing dial branch already does five things the track needs verbatim: pin, scrub, publish one
scalar per frame, publish `activeIndex` on the rounded index, and arm the idle snap. Only the
progress→scalar mapping and the CSS property differ. Extract:

```ts
type ScrubScene = {
  el: Element
  scene: GalleryScene
  /** Pure progress → the one scalar this presentation writes. */
  publish: (p: number, count: number) => number
}
```

`createScrubScene` keeps everything else identical to the code verified in this cycle — the
`SNAP_IDLE_MS` timer that reads `self.progress` inside the timeout rather than closing over `p`, the
per-scene `snapTimers` entry, the `sceneTriggers` registration that makes `scrollToPiece` work, and
`invalidateOnRefresh`.

Dial passes `(p, n) => rotationAtProgress(p, n, scene.seats)`.
Track passes `(p, n) => trackAt(p, n)`.

The listener channel `onSceneRotation` becomes `onSceneFrame`, since what it carries is now
"this scene's one scalar" rather than specifically a rotation.

`frame.rotation` in `store.ts` is renamed to **`frame.scalar`**, documented as *"the last scalar
published per scene — degrees for a dial, fractional wall index for the track."* Leaving a
fractional index in a field named `rotation` would be a lie in the store's own type. The rename is
safe and small: `frame.rotation` is written at `timeline.ts:175` and read at `timeline.ts:87` (the
seed value handed to a freshly-mounted listener) and **nowhere else in the codebase** — not by r3f,
not by any component. Three lines change, including the declaration.

**Invariant 1 is preserved, not weakened:** still one CSS custom property per frame per scene, still
no rotation in React state, still `activeIndex` published only on change.

**Invariant 2 is preserved:** GSAP still appears only in `timeline.ts`.

**Invariant 3 is preserved:** the snap still goes through Lenis, never `ScrollTrigger.snap`.

## 5. Presentation resolution

```ts
export const resolvePresentation = (declared, reduced, compact): Rendered =>
  reduced || compact ? 'list' : declared === 'track' ? 'track' : 'dial'
```

A `track` scene now falls back to `list` under reduced motion or below 900px, where before it always
resolved to `track`.

`SnapList` is category-generic — it reads `activePieces(scene)` and its own `SNAP_ITEM_WIDTH`, and
never touches `RING_LOOK` — so it renders the seven walls with no change. Each card links to
`/murals/<slug>`, the same route the dossier links to. Nothing structural is lost, which is the
standing requirement for a fallback.

`GalleryScene`'s existing copy already handles both states correctly: `'Two chapters, scrubbed in
sequence'` and `'Planes bend ±8° at edges'` for `track`, the swipe copy for `list`.

## 6. Components

### `Track.tsx`

Props: `{ scene, activeIndex }`, matching `Dial` and `SnapList`.

Owns exactly one DOM write, through the same `useEffect` idiom as `Dial`:

```ts
useEffect(
  () => onSceneFrame(scene.label, (at) => {
    row.current?.style.setProperty('--at', String(at))
  }),
  [scene.label],
)
```

Renders, in the mockup's positions:

- The row at `top: 308px, height: 430px`, `perspective: 1600px`, gutter per §2.
- The right-side annotation at `right: 72px, top: 250px`, width 280, right-aligned, mono 9px/1.7,
  `.1em`, `cream/42`: `NO FULL-WIDTH PHOTO EXISTS FOR THESE WALLS, / SO A WALL IS PRESENTED AS
  CONTEXT + DETAIL / RATHER THAN FAKED AS ONE PANORAMA`.
- The chapter bar at `left: 118px, top: 770px`, gap 30, mono 9.5px, `.14em`. Each chapter is a
  `<button type="button">` reading `BGC — 04 WALLS ●` (ochre, `●` only when active) or
  `LAYAW, MAKATI — 03 WALLS` (`cream/35`), followed by the static
  `TWO CHAPTERS, SCRUBBED IN SEQUENCE` in `cream/25`.

Clicking a chapter calls `scrollToPiece(scene.label, chapter.firstIndex, count)`. The active chapter
is the one whose range contains `activeIndex` — derived on render from `chaptersOf`, never stored.

### `Dossier.tsx`

Props: `{ piece, index, count, active }`.

816 × 410, `background: ink-panel` (`#100e0c`), padding 16, gap 14. Carries `--i: {index}` and the
`rotateY` from §3.

- **Active:** `border: 1px solid ochre/35`, `box-shadow: 0 0 90px ochre/13`, opacity 1.
- **Inactive:** `border: 1px solid cream/10`, opacity `.45`.

Left column, 540 wide:

- Context plate, `flex: 1`, a `<Placeholder>` with the piece's `role: 'context'` image alt, label
  bottom-left at mono 9px/1.5 `.06em`.
- Beneath it: title in Instrument Serif 30px/1.1, then a mono 9.5px `.12em` `cream/50` metadata line
  `{CHAPTER} · {MEDIUM} · {YEAR} — WALL {nn} / {NN}`, built from `location`, `medium`, `year` and
  the index. Uppercased by CSS, per the standing mono-label rule.

Right column, 230 wide:

- The two `role: 'detail'` images as `<Placeholder>`s, `flex: 1` each, gap 14, labels bottom-left at
  mono 8.5px/1.4.
- The note `CONTEXT + DETAIL PAIR / CLICK → WALL PAGE` in `ochre-bright`, mono 8.5px/1.6 `.1em`.

The whole dossier is a single `<a href="/murals/{slug}">` — matching the centre slot's "click opens
detail", and giving one link target per wall rather than three. No nested interactive elements.

`data.test.ts` already guarantees every mural has exactly one `context` image and at least two
`detail` images, so the column layout has no empty-slot case to handle.

## 7. Edge cases

**`count === 0`** — render nothing, register no snap. `trackAt` returns 0 for any p.

**`count === 1`** — `trackAt` is 0 throughout; the wall sits centred, unbent, for the whole pin.
`needsSnap` already returns `false` for `count < 2`, so no snap fires. The chapter bar shows one
chapter.

**Reduced motion / <900px** — `SnapList`, per §5.

**Document height** — grows to ~17.4 viewports. Label offsets for g4 and contact shift by 2160px at
1440×900; both are registered through `onRefresh`, so they recompute with no extra work. The
existing `refreshAfterFonts` pass still covers the font-metric drift.

**Route return** — `ScrollPage`'s restore already targets `getLabelOffset`, which the factory
registers for g3 the same way the dial branch does.

**Resize** — `invalidateOnRefresh` re-derives the pin length. The pitch is a fixed px constant, not
viewport-relative, so the track geometry itself needs no recompute; only the centring gutter moves,
and it is a CSS `calc(50% - …)` that the browser handles.

## 8. Testing

Pure tests only, `src/**/*.test.ts`, `environment: 'node'`. **Invariant 6 stands: no jsdom, no
component tests.** The presentations are verified in a browser.

`src/lib/track.test.ts`:

- `trackAt` returns exactly 0 at p=0 and exactly `count - 1` at p=1, for counts 7 and 1.
- `trackAt` returns 0 for `count <= 1` at any progress.
- `TRACK_PITCH === DOSSIER_W + TRACK_GAP` — pins the one arithmetic relationship the CSS depends on.
- `bendDegrees` is 0 when `i === at`, reaches exactly +8 and −8 at one pitch either side, holds
  there beyond it, and is antisymmetric about centre.
- `trackGutter` produces `calc(50% - 408px)` for the shipped width.
- `chaptersOf(murals)` gives BGC 4 at `firstIndex 0` and Layaw 3 at `firstIndex 4`.
- `chaptersOf` on a deliberately interleaved fixture still counts correctly and orders chapters by
  first appearance — the property the implementation claims.
- `chaptersOf([])` returns `[]`.

`src/scroll/presentation.test.ts`, extended:

- `track` + reduced → `list`; `track` + compact → `list`; `track` + neither → `track`.
- The existing dial cases must stay green — they are the regression guard on the resolution rewrite.

The `createScrubScene` extraction has no new pure surface of its own; its regression guard is that
`ring.test.ts` and `timelineMath.test.ts` stay green and that all four scenes still behave in the
browser.

### Browser verification

Playwright, viewport ≥ 940px, driving real wheel input. The page is the active tab, so
`requestAnimationFrame` advances and Lenis-driven motion is observable — the occlusion problem that
blocked the previous cycle's verification does not apply.

1. Document height is ~17.4 viewports and g3's pin measures 240vh.
2. `--at` climbs 0 → 6 across the pin; the counter climbs `01 / 07` → `07 / 07`.
3. Idle snap lands `--at` on an integer, as the dial's does on a multiple of 45°.
4. A dossier at centre measures `rotateY(0)`; its neighbours measure ±8° at the clamp.
5. Clicking `LAYAW, MAKATI` moves `--at` to exactly 4 without navigating.
6. Clicking a dossier navigates to `/murals/<slug>`.
7. Console clean apart from the known three.js `Clock` notice.

## 9. Out of scope

Unchanged from the parent spec: the butterfly flock, the r3f ripple on the centre slot, the
between-scene collapse transition, the mobile bottom ticker, detail-page mural crop strip, all
imagery, and Denise's copy.

Also explicitly not in this spec: the two-sources-of-truth geometry cleanup (`--spacing-guide-*`
tokens vs JS constants). This spec adds its constants to `src/lib/track.ts`, following the existing
JS-side convention rather than picking the fight.

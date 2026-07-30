# Ovalese — Project Handoff

**Read this first.** It is the single current-state document for the site; there is no other handoff.

**State:** `main` @ `f1f5896`, working tree clean, **no git remote configured**. All four gallery
scenes are complete and merged. Nothing is in flight.
**Verification:** typecheck clean · 7 test files / 93 tests passing · `npm run build` succeeds ·
critical-path bundle 400 kB, three.js split into a lazy 882 kB chunk.
**Console:** clean apart from one pre-existing three.js `Clock` deprecation notice from the r3f stage.

Denise Cacanando's artist portfolio: a single scroll page (Hero → About → four gallery scenes →
Contact) plus one routed detail page per piece. Vite 8 · React 19 · GSAP ScrollTrigger · Lenis ·
Tailwind 4 · react-three-fiber. No CMS — one typed data module per category.

**Design of record:** `README.md` (tokens, per-screen specs, interaction rules) and the static
mockups in `Ovalese Site - Pollen Dial.dc.html`. The mockups draw *frames* of a scroll experience;
the real thing is driven by the timeline. Do not port their markup.

**Specs and plans:** `docs/superpowers/specs/` and `docs/superpowers/plans/` — two cycles, both
complete. Their checkboxes were never ticked, so the plan files still *read* as unstarted. They are
not.

---

## Commands

```
npm run dev        # Vite on :5173
npm test           # vitest run — 93 tests
npm run typecheck  # tsc -b --noEmit
npm run build      # tsc -b && vite build
```

## Module map

| Module | Role |
| --- | --- |
| `src/data/*.ts` | One module per category. Counts confirmed 24 / 7 / 7 / 12; titles and dates are placeholders. |
| `src/lib/ring.ts` | Pure ring geometry. Seats + centre slot, `orbitSeats`, index/progress mapping. |
| `src/lib/track.ts` | Pure Murals track geometry — pitch, fractional wall index, bend contract, chapters. |
| `src/lib/snapList.ts` | Pure nearest-item search + centring gutter for the fallback list. |
| `src/scroll/scenes.ts` | Per-scene declarations. Pure `piecesFor(scene, filter)` + live-reading `activePieces`. |
| `src/scroll/presentation.ts` | `resolvePresentation(declared, reduced, compact)` → what actually renders. |
| `src/scroll/timelineMath.ts` | Pure pin-length, scroll-mapping, snap-threshold helpers. |
| `src/scroll/timeline.ts` | **Sole owner of GSAP.** `createScrubScene` builds every pinned scene. |
| `src/scroll/store.ts` | Two channels: discrete `state` (publishes to React) and per-frame `frame` (never does). |
| `src/routes/ScrollPage.tsx` | The scroll page. Owns scroll save/restore — see Decisions. |
| `src/sections/ring/Dial.tsx` | Pinned rotating presentation (g1, g2, g4). |
| `src/sections/ring/SnapList.tsx` | Pin-free fallback. Category-generic — serves the track too. |
| `src/sections/ring/CentreSlot.tsx` | Focused piece + cross-fade. **The documented ripple seam.** |
| `src/sections/track/Track.tsx` | Murals row: track, chapter bar, annotation. |
| `src/sections/track/Dossier.tsx` | One wall: context plate + metadata + two detail crops. |
| `src/three/Stage.tsx` | r3f canvas, pollen only. Memoised and lazy-loaded. |

## Invariants — do not break these

1. **The scrub value never enters React state; `activeIndex` never enters the frame loop.** Each
   frame reaches the DOM as one scalar via `onSceneFrame`, whose meaning belongs to the presentation:
   degrees written to `--r` by a dial, fractional wall index written to `--at` by the track. The
   track's single `--at` drives both the row's x-translate and every plane's ±8° bend in pure CSS.
   `activeIndex` publishes only when the rounded index changes — never 60/s.
2. **GSAP lives only in `src/scroll/timeline.ts`** (and `useLenis.ts`). No component imports `gsap`
   or `ScrollTrigger`.
3. **The snap goes through Lenis, never `ScrollTrigger.snap`.** Two writers of scroll position fight
   and produce jitter that is miserable to reproduce.
4. **Counts are never hardcoded in a view** — read via `activeCount(scene)` / `activePieces(scene)`.
5. **The ring is N orbit seats + one centre slot.** The orbit is a *window* onto the category, not a
   seat per piece, and the focused piece is never on it. Orbit length is `orbitSeats(seats, count)` =
   `min(seats, count - 1)`; both the seat spacing and the rotation must read it, or the ring visibly
   under-turns per piece.
6. **Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`.** No DOM. Every test is a
   pure-function test *by design* — presentations are verified in a browser instead. **Do not add
   jsdom or component tests.**
7. Design tokens live in `src/styles/index.css` under `@theme` — **except scene geometry**, which
   lives in `scenes.ts`, `look.ts` and `lib/track.ts` because the timeline computes with it. Hairlines
   are 1px. Mono labels are always uppercase and letter-spaced — put `uppercase` on the element
   itself, since a `<button>` does not inherit `text-transform`. Every piece renders `<Placeholder>`;
   there is no imagery yet.

## How to verify UI work here

Invariant 6 means the browser *is* the test for anything visual. Two traps, each of which has already
cost a cycle:

- **Drive the page as the active tab.** Lenis runs off a GSAP ticker on `requestAnimationFrame`. In an
  occluded or background tab rAF is throttled and nothing Lenis-driven moves, so the snap looks broken
  when it is fine. Playwright's own page is always active; confirm rAF is alive (~50+ ticks per 500ms)
  before concluding anything about motion. Scroll with real wheel input, never `window.scrollTo` —
  Lenis owns the scroll position.
- **A computed style is not what you see.** Every check in one cycle asserted
  `getComputedStyle().transform` and reported a clean ±8° bend while the planes rendered flat, because
  the parent lacked `transform-style: preserve-3d` and collapsed the rotation into a 1% `scaleX`.
  Measurement cannot see that. **Look at a screenshot, and press Tab.** Two of the three most serious
  defects in that cycle were invisible to probing and obvious to an eye.

One probe gotcha: matching `/\d\d \/ \d\d/` against a scene's text finds a *dossier's*
`WALL 01 / 07` metadata, not the progress row. Match the element whose entire text is `nn / nn`.

## What's next — nothing is blocked on a decision

- Butterfly flock: ~1,200 instances, wing phase in the vertex shader, one attractor per scene,
  MotionPath between them. The largest remaining piece.
- The r3f ripple/displacement shader on the centre slot. The seam is built and documented in
  `CentreSlot.tsx` as a single `swapTo(piece)` function — but it would ripple placeholder stripes
  until real imagery lands.
- Between-scene "collapse to a seed" transition.
- Mobile bottom ticker and the rail's cream-ground flip.
- Detail-page media: zoomable artwork, orbitable ovoid, mural crop strip.

**Blocked on Denise, not on us:** all imagery, her copy (every slot is tagged `COPY SLOT` in the
mockups), and most of the detail-page media. `<Placeholder>` is scaffolding to delete when real files
land, not a loading state.

**No logged follow-ups.** The previous list was worked to zero. Two of its entries turned out to be
wrong; they are recorded below so nobody "fixes" them back.

---

## Decisions already ruled on — do not re-open

**`refreshTimeline()` is not a no-op. Do not remove it.** It was logged as one on the grounds that the
pin length is count-independent and the section is `h-screen`, so nothing *measurable* changes. True,
and beside the point: what the refresh does is drive an `onUpdate`, and that is the only thing
recomputing the ring's rotation for a newly filtered count. Measured with it removed — the seats
re-render 6 → 4 correctly while `--r` stays frozen at 300.10° for over a second where 109.13° is right.

**Scroll restore needs all three of these.** Each was hiding the next, and each tempting
simplification reinstates a real bug:

1. The offset is written through on **every scroll**, and deliberately **not** again on cleanup.
   Teardown is too late to read `scrollY`: the timeline effect is declared first, so `killTimeline()`
   unpins four sections and collapses the document before this cleanup runs, and a save there
   overwrote a correct offset with the clamped one (3428 → 388). Writing through also lets a hard
   refresh keep its place — no React cleanup runs on page unload.
2. The restore waits for `refreshAfterFonts`' callback, **not** a bare `rAF`. Creating a pinned
   trigger does not lay out its pin spacer; only the refresh does. Restoring earlier addressed a
   document still at its unpinned seven viewports and clamped anything past 5400px — 9180 landed at
   5400, while shallower offsets survived and made it look like it worked.
3. `lenis.resize()` runs before the `scrollTo`. Lenis caches its scroll limit and recomputes only from
   an async ResizeObserver, so it otherwise clamps to the pre-pin height.

The `sessionStorage` read also happens at effect setup, *before* the listener is attached — the
browser's own load-time restoration fires scroll events that would overwrite the offset first.

**Geometry deliberately is not in `index.css`.** Seventeen tokens mirroring the scene numbers sat
there referenced by nothing and were deleted rather than wired up: the timeline computes with these
values (seat steps, pin lengths, track pitch), which CSS cannot do.

**`scrub: 1` was removed from the scrub triggers; do not re-add it.** A reviewer correctly noted that
removing it flips ScrollTrigger's internal `isToggle`, so this is *empirically equivalent, not
provably inert*. Tested directly: merch chip clicked mid-pin, scroll unchanged at y=10424, `--r` moved
300.10° → 109.13° within 16ms. The corrective `onUpdate` still fires, including across a refresh.

**Keyboard focus on the track uses `:focus-visible`, not a pointer flag.** Tabbing to an off-screen
wall centres it; clicking one must not, or the centring fights the click's own navigation. A
`pointerdown` flag was tried and latches — a click on the row's gutter or gap focuses nothing, so the
flag survives and swallows the next genuine Tab.

**The gallery section is `overflow-x: clip`, not `hidden`.** `hidden` still creates a
programmatically scrollable box, so tabbing to an off-screen dossier set `section.scrollLeft` to 1680
and left the track permanently desynced from `--at`. `clip` clips identically without the scroll
container.

**Kept deliberately despite zero consumers:** `src/scroll/usePresentation.ts` (`ScrollPage` calls
`resolvePresentation` directly) and `sceneCount` in `scenes.ts`. `RING_LOOK.murals` is a type-required
zero row, not an orphan.

**Cream-ground dial chrome** uses `border-ink/25` uniformly rather than a 12/25 staircase, matching
the sibling `SnapList` card hairline on the same scene.

## Known-good measurements

A regression baseline; all confirmed in a real browser at 1440×900.

- Document is **17.4 viewports** (15660px). Scene offsets: g1 1800, g2 5580, g3 8460, g4 11520.
- Artworks counter climbs `01 / 24` → `24 / 24`, reaching 24/24 while still pinned.
- Idle snap overshoots, then pulls *backwards* onto the stop and holds. The residual is integer-scroll
  quantisation, not error — stop 20 sits at 4304.35 and the browser can only rest on 4304.
- The snap never fires mid-gesture: 14 wheel events at 70ms intervals, strictly monotonic.
- A thumb click rotates that piece to centre without navigating.
- Murals: `--at` spans 0→6; the centred dossier is 816×410 unrotated and its neighbours measure
  749.4 / 689.7 / 630 wide — symmetric, only the centred wall flat. Chapter jump moves `--at` 4→0
  without navigating.
- Merch chips re-bloom: jackets → 4 thumbs at exactly 90° gaps; earrings → 0 thumbs, centre only,
  `01 / 01`.
- Breakpoint: 920px renders the list, 960px the dial.
- Scroll restore is exact from 3428, 9180 and 12371, and survives a hard refresh.

## Defects caught in previously-prescribed code

Kept because it calibrates how much to trust a written spec here — including specs I wrote myself.

1. A test asserting `needsSnap(0.5, 7) === true`, which is impossible (0.5 *is* stop 3 of 7).
2. A duplicated `ScrollTrigger.create` label block → extracted as `createLabelTrigger`.
3. **A CSS transform leaving every orbit thumb tilted by its seat angle** — the counter-rotation
   cancelled the ring's spin but not the seat's own placement. Invisible on Artworks' circles, glaring
   on Ovalese ovoids and Merch squares.
4. Murals track copy showing under the `list` presentation on every dial scene.
5. A double cross-fade on merch filter clicks, plus a reset fighting the route-return scroll restore.
6. **A snap list whose last three pieces could never become active** — no centring gutter, so the
   nearest-to-mid search never selected the tail. Violated the plan's own "every piece stays
   reachable".
7. **Chapter-bar labels rendering in mixed case**, because `<button>` does not inherit
   `text-transform` and the class sat on the wrapper. Now part of invariant 7.
8. **The ±8° plane bend rendering flat**, because the row lacked `transform-style: preserve-3d`.
   Reported as verified by measurements that could not have detected it.
9. **`g3` documented as pinning when it never pinned at all.** That error survived a spec, a plan and
   a handoff before anyone measured the document height.

## Housekeeping

`.claude/worktrees/gallery-ring-timeline/` is an empty untracked leftover — no worktree is registered
for it. Safe to delete.

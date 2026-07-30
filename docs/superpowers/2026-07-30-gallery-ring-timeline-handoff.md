# Gallery Ring + Scroll Timeline — Handoff

**Status:** All four gallery scenes complete and merged to `main`. The Murals x-translate track
merged at `ed1fa7a`; the scroll-restore fix and the follow-up sweep landed after it.
**Verification:** typecheck clean · 7 test files / 93 tests passing · `npm run build` succeeds.
Critical-path bundle 400 kB (three.js split into a lazy 882 kB chunk).
**Plan:** `docs/superpowers/plans/2026-07-30-gallery-ring-timeline.md` (all 11 tasks done — note its
checkboxes were never ticked, so the file still *reads* as unstarted).
**Design spec:** `docs/superpowers/specs/2026-07-30-gallery-ring-timeline-design.md`

---

## What shipped

All four gallery scenes pin, rotate, snap to pieces, and fall back to a pin-free snap list under
reduced motion or below 940px.

This cycle added the Murals x-translate track (scene `g3`), which now genuinely pins and scrubs
through the same shared frame channel as the dials (see invariant 1). Design decisions: idle snap
reuses the dial's Lenis path rather than a free scrub; walls render as uniform full dossiers dimmed at
the edges rather than the mockup's literal tiered stubs; chapters are clickable jump targets; and the
reduced-motion/compact fallback reuses `SnapList` unchanged.

| Module | Role |
| --- | --- |
| `src/lib/ring.ts` | Pure ring geometry. Seats + centre slot model. |
| `src/lib/snapList.ts` | Pure nearest-item search + centring gutter for the fallback list. |
| `src/scroll/scenes.ts` | Per-scene declarations; `activePieces` / `activeCount` read the filter dynamically. |
| `src/scroll/presentation.ts` | `resolvePresentation(declared, reduced, compact)` → what actually renders. |
| `src/scroll/timelineMath.ts` | Pure pin-length, scroll-mapping, snap-threshold helpers. |
| `src/scroll/timeline.ts` | **Sole owner of GSAP.** Triggers, pins, rotation, index, idle snap. |
| `src/sections/ring/Dial.tsx` | Pinned rotating presentation. |
| `src/sections/ring/SnapList.tsx` | Pin-free fallback presentation. |
| `src/sections/ring/CentreSlot.tsx` | Focused piece + cross-fade. **The documented ripple seam.** |
| `src/sections/ring/look.ts` | Per-category slot/thumb geometry. |
| `src/lib/track.ts` | Pure track geometry — pitch, fractional wall index, bend contract, chapter grouping. |
| `src/sections/track/Track.tsx` | The Murals row: track, chapter bar and annotation. |
| `src/sections/track/Dossier.tsx` | One wall: context plate + metadata + two detail crops. |

## Invariants a new session must not break

1. **The scrub value never enters React state; `activeIndex` never enters the frame loop.** Each
   frame reaches the DOM as one scalar via `onSceneFrame`, whose meaning belongs to the presentation:
   degrees written to `--r` by a dial, fractional wall index written to `--at` by the Murals track.
   The track's single `--at` drives both the row's x-translate and every plane's ±8° bend in pure
   CSS. `activeIndex` publishes only when the rounded index changes (~24 updates across a 320vh pin,
   never 60/s).
2. **GSAP lives only in `src/scroll/timeline.ts`** (and pre-existing `useLenis.ts`). No component
   imports `gsap` or `ScrollTrigger`.
3. **The snap goes through Lenis, never `ScrollTrigger.snap`.** Two writers of scroll position fight
   and produce jitter that is miserable to reproduce.
4. **Counts are never hardcoded in a view** — read via `activeCount(scene)` / `activePieces(scene)`.
5. **The ring is N orbit seats + one centre slot.** The orbit is a *window* onto the category, not a
   seat per piece. The focused piece is never on the orbit. Orbit length is `min(seats, count - 1)`.
6. **Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`.** Only `.test.ts` runs and
   there is no DOM. Every test is a pure-function test by design — the presentations are verified in
   the browser. Do not add jsdom or component tests.
7. Design tokens live in `src/styles/index.css` under `@theme` — **except scene geometry**, which
   lives in `scenes.ts`, `look.ts` and `lib/track.ts` because the timeline computes with it. Hairlines
   are always 1px. Mono labels are always uppercase and letter-spaced — put `uppercase` on the element
   itself, since a `<button>` does not inherit `text-transform`. Every piece renders `<Placeholder>`;
   there is no imagery.

## Verified in a real browser

- Document height was exactly 15 viewports (13500px at 900px tall) before this cycle. Now that `g3`
  genuinely pins for its full 240vh instead of measuring one viewport, the document is **17.4
  viewports (15660px at 900px tall)**, confirmed in the browser.
- Artworks counter climbs `01 / 24` → `24 / 24`, hitting 24/24 while still pinned, releasing after.
- All 8 orbit seats measure an *identical* rotation against the ring → net zero, thumbs upright.
- Ovalese: 6 ovoid seats + centre = all 7 eggs, none repeated.
- Merchandise renders on cream with visible ink chrome; chips re-bloom (JACKETS → 5 pieces / 4 seats;
  EARRINGS → 1 piece / **0 seats**, centre only).
- Centre is a real `<a>` to the detail route; thumbs are `<button type="button">`; no nesting.
- Console clean (one pre-existing three.js `Clock` deprecation notice from the r3f stage).
- Compact snap list confirmed working by Marti (at the time the breakpoint was 900px; it is now 940).

## Idle snap and thumb click — now verified

Both desktop-dial behaviours previously listed as unverified were confirmed in a real browser on
2026-07-30. The earlier pass couldn't reach them because its automated tab was occluded, so
`requestAnimationFrame` was paused and the GSAP ticker driving Lenis never advanced; driving the page
through Playwright, whose page is always the active tab, solved it.

- **Idle snap** — on Artworks, scroll overshot to scrollY 4336.8, then pulled *backwards* to 4304 and
  held across six consecutive samples. The reversal is what proves it is the snap and not inertia
  decaying. Stop 20 sits at 4304.35; the browser can only rest on integer scroll positions, so the
  residual 0.125° of ring rotation is exactly the 0.35px it cannot express — it lands as precisely as
  the platform allows.
- **Never mid-gesture** — 14 wheel events at 70ms intervals (under the 120ms `SNAP_IDLE_MS`) produced
  a strictly monotonic scroll trail, zero reversals.
- **Thumb click** — clicking the 4th orbit seat rotated the ring 179.68° ≈ 4 stops, landed exactly on
  stop 21, left the URL at `/`, and brought that exact piece to the centre slot linking to
  `/artworks/window-box`.

The compact list uses native CSS scroll-snap and was already confirmed separately (see above).

---

## What's next — the plan's own "Out of scope"

- Butterfly flock: ~1,200 instances, wing phase in the vertex shader, one attractor per scene,
  MotionPath between them.
- The r3f ripple/displacement shader on the centre slot (the seam is built and documented in
  `CentreSlot.tsx` — but it would ripple placeholder stripes until real imagery lands).
- Between-scene "collapse to a seed" transition.
- Mobile bottom ticker and the rail's cream-ground flip.
- Detail-page media: zoomable artwork, orbitable ovoid, mural crop strip.
- All imagery, and Denise's copy.

**Blocked on Denise, not on us:** the imagery, her copy, and most of the detail-page media.

## Logged follow-ups

**All cleared.** Nothing outstanding beyond the out-of-scope list above. What was fixed, and the
three that turned out not to be what the note said:

| Was logged as | Outcome |
| --- | --- |
| Route-return scroll restore broken | Fixed — three causes. See "Scroll restore" below. |
| `refreshTimeline()` is a no-op | **Wrong.** It is load-bearing. See below. |
| Filtered merch ring is a 240° arc | Fixed — `orbitSeats` now drives both spacing and rotation. |
| Geometry has two sources of truth | Resolved by deleting the 17 dead tokens. See below. |
| `scenes.test.ts` mutates global filter | Retired by the `piecesFor` split, not by an `afterEach`. |
| `activePieces` is not pure | Split into pure `piecesFor(scene, filter)` + a wrapper. |
| Reduced motion animates the rail jump | Fixed — measured instant vs. 8 eased steps. |
| `<Stage />` re-renders per scene | `React.memo`. Also `React.lazy`: 1.28 MB → 400 kB critical path. |
| Dial clipped 900–940px | Compact breakpoint raised to 940. 920 → list, 960 → dial. |
| `count === 0` renders `01 / 00` | Now `00 / 00`. |

**`refreshTimeline()` is not a no-op — do not remove it.** The old note was right that the pin
length is count-independent and the section is `h-screen`, so nothing *measurable* changes. That is
beside the point: what the refresh does is drive an `onUpdate`, and that is the only thing that
recomputes the ring's rotation for the new piece count. Measured with it removed — the seats
re-render 6 → 4 correctly while `--r` stays frozen at 300.10° for over a second where 109.13° is
correct.

**Geometry deliberately does not live in `index.css`.** The 17 tokens there were referenced by
nothing and have been deleted rather than wired up: the timeline has to compute with these numbers
(seat steps, pin lengths, track pitch), which CSS cannot do, so JS is the only workable home. Ring
geometry is in `scenes.ts` and `look.ts`, the track's in `lib/track.ts`. This is the exception to
invariant 7, and the token block says so.

## Decisions already ruled on — do not re-open

- **Scroll restore.** Three things had to hold at once, and each was hiding the next, so do not
  simplify any of them away:
  1. The offset is written through on **every scroll**, and deliberately **not** again on cleanup.
     Teardown is too late to read `scrollY` — the timeline effect is declared first, so
     `killTimeline()` unpins four sections and collapses the document before this cleanup runs, and
     a save there overwrote a correct offset with the clamped one (3428 → 388). Writing through also
     lets a hard refresh keep its place; no React cleanup runs on page unload.
  2. The restore waits for `refreshAfterFonts`' callback, **not** a bare `rAF`. Creating a pinned
     trigger does not lay out its pin spacer; only the refresh does. Restoring earlier addressed a
     document still at its unpinned seven viewports, clamping anything past 5400px — 9180 landed at
     5400, while shallower offsets survived and made it look like it worked.
  3. `lenis.resize()` runs before the `scrollTo`. Lenis caches its scroll limit and recomputes it
     only from an async ResizeObserver, so it clamps to the pre-pin height otherwise.

  The `sessionStorage` read also happens at effect setup, before the listener exists — the browser's
  own load-time restoration fires scroll events that would otherwise overwrite the offset first.
- `src/scroll/usePresentation.ts` ships with **zero consumers** (`ScrollPage` calls
  `resolvePresentation` directly). Kept deliberately.
- `sceneCount` in `scenes.ts` has **zero consumers** since Task 10. Kept deliberately.
- Cream-ground dial chrome uses `border-ink/25` uniformly rather than a 12/25 staircase, matching the
  sibling `SnapList` card hairline on the same scene.
- `scrub: 1` was removed from the scrub triggers in the Murals cycle. A reviewer correctly noted that
  removing it flips ScrollTrigger's internal `isToggle` flag, which is not literally a no-op at the
  GSAP-internals level — so this is **empirically equivalent, not provably inert**. Tested directly:
  with a merch chip clicked mid-pin and the scroll position unchanged at y=10424, `--r` moved from
  300.10° to 109.13° within 16ms — the corrective `onUpdate` still fires, and 109.13° is exactly right
  for the re-bloomed 5-piece mapping. Holds across a refresh cycle too. Do not re-add `scrub: 1`.

## Defects caught in the plan's own prescribed code

Recorded because it calibrates how much to trust the remaining specs — six were found and fixed:

1. A test asserting `needsSnap(0.5, 7) === true`, which is impossible (0.5 *is* stop 3 of 7).
2. A duplicated `ScrollTrigger.create` label block → extracted as `createLabelTrigger`.
3. **A CSS transform that left every orbit thumb tilted by its seat angle** — the counter-rotation
   cancelled only the ring's spin, not the seat's own placement. Invisible on Artworks' circles,
   glaring on Ovalese ovoids and Merch squares.
4. Murals track copy showing under the `list` presentation on every dial scene.
5. A double cross-fade on merch filter clicks, plus a reset fighting the route-return scroll restore.
6. **A snap list whose last three pieces could never become active** — no centring gutter, so the
   nearest-to-mid search never selected the tail. Violated the plan's own "every piece stays
   reachable". Fixed, and the search is now a pure tested function in `src/lib/snapList.ts`.

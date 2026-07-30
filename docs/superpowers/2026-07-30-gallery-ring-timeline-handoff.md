# Gallery Ring + Scroll Timeline — Handoff

**Status:** Gallery ring + scroll timeline complete and merged (`main` @ `4e26db6`, 18 commits from
`73b897f`). The Murals x-translate track is complete and reviewed on `feat/murals-track` @ `ee2b104`,
forked from `main` @ `956cfab`; **not yet merged**.
**Verification:** typecheck clean · 7 test files / 86 tests passing · `npm run build` succeeds.
**Plan:** `docs/superpowers/plans/2026-07-30-gallery-ring-timeline.md` (all 11 tasks done — note its
checkboxes were never ticked, so the file still *reads* as unstarted).
**Design spec:** `docs/superpowers/specs/2026-07-30-gallery-ring-timeline-design.md`

---

## What shipped

All four gallery scenes pin, rotate, snap to pieces, and fall back to a pin-free snap list under
reduced motion or below 900px.

This cycle added the Murals x-translate track (scene `g3`), which now genuinely pins and scrubs
through the same shared frame channel as the dials (see invariant 1). Design decisions: idle snap
reuses the dial's Lenis path rather than a free scrub; walls render as uniform full dossiers dimmed at
the edges rather than the mockup's literal tiered stubs; chapters are clickable jump targets; and the
reduced-motion/sub-900px fallback reuses `SnapList` unchanged.

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
7. Design tokens live in `src/styles/index.css` under `@theme`. Hairlines are always 1px. Mono labels
   are always uppercase and letter-spaced. Every piece renders `<Placeholder>`; there is no imagery.

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
- Sub-900px snap list confirmed working by Marti.

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

The sub-900px list uses native CSS scroll-snap and was already confirmed separately (see above).

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

## Logged follow-ups (reviewed, none blocking)

- **Route-return scroll restore does not work, for any scene.** A detail route's document is only
  ~1288px tall, so the browser clamps `scrollY` before `ScrollPage`'s `save()` cleanup runs. Verified
  on `g1`: scrollY was 8400 before entering `/artworks/everlasting` and 388 after going back. Not
  caused by the Murals track — it reproduces on scenes that cycle never touched.
- The merch filter's `refreshTimeline()` is now a no-op: `pinLengthPx` is count-independent and the
  section is `h-screen`, so nothing measurable changes. Drop it or fix the comment.
- A filtered merch ring is an **arc, not a ring**: `--step` stays 60° while seats cap at `count - 1`,
  so *jackets* gives 4 thumbs spanning 240°. `seatStep(Math.min(scene.seats, count - 1))` would
  redistribute evenly.
- **Geometry has two sources of truth.** All 14 `--spacing-guide-*` / `--orbit*` / `--slot*` /
  `--thumb*` tokens in `index.css` are unreferenced; the live values are JS numbers in `scenes.ts`
  and `look.ts`. Pick one home before they drift.
- `scenes.test.ts` mutates the module-global merch filter without an `afterEach` reset — a single
  failing assertion would cascade.
- `activePieces` reads module-global state, so it is not a pure function of its arguments.
- Reduced motion still gets an animated rail scroll (`scrollToLabel` falls back to
  `behavior: 'smooth'` when Lenis is absent).
- `<Stage />` re-renders ~n times per scene; `React.memo` is a one-line fix (it takes no props).
- The dial is clipped between 900 and ~940px — it needs ~940px of width but engages at 900.
- `count === 0` would render `01 / 00` (unreachable with current data).
- Bundle is 1.28 MB, dominated by three.js. `<Stage />` is the only consumer and is behind
  `pointer-events-none aria-hidden` — a `React.lazy` boundary would take it off the critical path.

## Decisions already ruled on — do not re-open

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

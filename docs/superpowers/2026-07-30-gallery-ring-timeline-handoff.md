# Gallery Ring + Scroll Timeline — Handoff

**Status:** Complete and merged. `main` @ `4e26db6`. 18 commits from `73b897f`.
**Verification:** typecheck clean · 6 test files / 70 tests passing · `npm run build` succeeds.
**Plan:** `docs/superpowers/plans/2026-07-30-gallery-ring-timeline.md` (all 11 tasks done — note its
checkboxes were never ticked, so the file still *reads* as unstarted).
**Design spec:** `docs/superpowers/specs/2026-07-30-gallery-ring-timeline-design.md`

---

## What shipped

All four gallery scenes pin, rotate, snap to pieces, and fall back to a pin-free snap list under
reduced motion or below 900px.

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

## Invariants a new session must not break

1. **Rotation never enters React state; `activeIndex` never enters the frame loop.** Rotation reaches
   the DOM as one CSS custom property (`--r`) per frame via `onSceneRotation`. `activeIndex`
   publishes only when the rounded index changes (~24 updates across a 320vh pin, never 60/s).
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

- Document height is exactly 15 viewports, matching the plan's pin lengths.
- Artworks counter climbs `01 / 24` → `24 / 24`, hitting 24/24 while still pinned, releasing after.
- All 8 orbit seats measure an *identical* rotation against the ring → net zero, thumbs upright.
- Ovalese: 6 ovoid seats + centre = all 7 eggs, none repeated.
- Merchandise renders on cream with visible ink chrome; chips re-bloom (JACKETS → 5 pieces / 4 seats;
  EARRINGS → 1 piece / **0 seats**, centre only).
- Centre is a real `<a>` to the detail route; thumbs are `<button type="button">`; no nesting.
- Console clean (one pre-existing three.js `Clock` deprecation notice from the r3f stage).
- Sub-900px snap list confirmed working by Marti.

## NOT yet verified by anyone

Two desktop-dial behaviours, both animated through Lenis. The browser pass could not reach them —
the automated tab was occluded, so `requestAnimationFrame` was paused and the GSAP ticker driving
Lenis never advanced. Ten seconds on the Artworks scene closes this:

1. **Idle snap** — stop mid-scroll; it should settle onto the nearest piece in ~1/6 s, and must never
   grab mid-gesture.
2. **Thumb click** — clicking an orbit thumb should rotate it to centre without navigating.

The sub-900px list uses native CSS scroll-snap, so Marti's check does not cover either.

---

## What's next — the plan's own "Out of scope"

- **Murals x-translate track** — g3 pins but does not animate; it renders a labelled stub. *This is
  the only item that reads as broken rather than merely absent, and sits between two finished scenes.*
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

- `scrub: 1` on the dial triggers is inert — the triggers have no `animation`, and `onUpdate` fires
  regardless. Remove it or attach a real tween; either way the module docstring overstates it.
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

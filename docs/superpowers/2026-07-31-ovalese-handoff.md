# Ovalese — Project Handoff

**Read this first.** It is the single current-state document for the site; there is no other handoff.
It revises the version committed in `486fb32` in place — one current-state document, revised, never
accumulated.

**State:** **branch `feat/butterfly-flock`, NOT MERGED.** The last *code* commit is **`49da5c3`**;
`HEAD` is the docs commit that carries this file, sitting on top of it. (The previous version of this
document gave only the code hash and cost the next session a few minutes working out why `HEAD`
disagreed — hence the distinction.) Cut from `main` @ `d12435c`.
No `finishing-a-development-branch` step has been run and **there is still no git remote configured**.
`main` does not have the flock, and now does not have the canvas fixes either. Working tree clean
apart from untracked `.claude/`.

**Verification (run on `49da5c3`, not copied from a report):** `npm run typecheck` clean ·
`npm test` → **8 test files / 106 tests passing** · `npm run build` succeeds · critical-path bundle
**401.35 kB**, three.js split into a lazy **886.68 kB** chunk.
**Console:** clean apart from the pre-existing three.js `Clock` deprecation notice from the r3f
stage, plus a dev-only `favicon.ico` 404 (there is no `public/favicon.ico`).

Denise Cacanando's artist portfolio: a single scroll page (Hero → About → four gallery scenes →
Contact) plus one routed detail page per piece. Vite 8 · React 19 · GSAP ScrollTrigger · Lenis ·
Tailwind 4 · react-three-fiber. No CMS — one typed data module per category.

**Design of record:** `README.md` (tokens, per-screen specs, interaction rules) and the static
mockups in `Ovalese Site - Pollen Dial.dc.html`. The mockups draw *frames* of a scroll experience;
the real thing is driven by the timeline. Do not port their markup.

**Specs and plans:** `docs/superpowers/specs/` and `docs/superpowers/plans/` — three cycles, all
complete. Their checkboxes were never ticked, so the plan files still *read* as unstarted. They are
not.

---

## The three defects that dominated the last handoff are fixed

The previous version of this document opened with "The canvas does not reach a visitor — three
pre-existing defects". All three are now fixed and verified in a real browser. What follows is what
they actually were, because the diagnosis changed the shape of the fix.

### (b) and (c) were one defect, not two — `49da5c3`'s parent `b5ea535`

**ScrollTrigger refreshes its triggers in creation order, and lays each pin's spacer out as it
reaches it.** Measured directly by wrapping every trigger's `refresh()` and recording
`document.documentElement.scrollHeight` at each step:

| refresh # | trigger | doc height when it measured |
| --- | --- | --- |
| 1 | whole-document | 6300 (fully unpinned) |
| 2–3 | hero, about | 6300 |
| 4 | **contact** | **6300** |
| 5 | g1 | 9180 |
| 6 | g2 | 11160 |
| 7 | g3 | 13320 |
| 8 | g4 | 15660 |

`buildTimeline` created the whole-document trigger and the `contact` label **before** the four
pinned scenes, so both measured the 6300px unpinned document whose maxScroll is 5400. That produced
two bugs that looked unrelated: `contact` registered 5400 instead of 14760 (sending the rail's
Contact diamond into the middle of the Ovalese scene), and the whole-document trigger ended at 5400,
saturating `frame.progress` at 1.0 from 37% of the page onward so the flock never travelled.

This is also why the previous cycle's explicit `ScrollTrigger.refresh()` "did not fix it" — refresh
replays the same order. GSAP documents exactly this: create ScrollTriggers in the order they occur
on the page, or use `refreshPriority`.

**The fix is ordering only.** `buildTimeline` now builds top to bottom — hero, about, the four
gallery scenes, contact — with the whole-document trigger created last and held there by
`refreshPriority: -1` (lower refreshes later), because it is the one trigger that measures the
*whole* document and must run after every pin has contributed its spacing.

### (a) the canvas was covered everywhere — `b5ea535`

`Stage`'s wrapper was `z-0`, `<main>` is `z-10`, and every section painted an **opaque** ground.
`document.elementFromPoint` at five points returned the section under `MAIN.relative.z-10` at every
one. Injecting `main { opacity: 0 }` rendered a dense diamond field plus thousands of pollen points;
with `main` visible, nothing. **`Pollen` had apparently never been visible to anyone**, despite
being listed as shipped in two previous handoffs.

README §182 wants "one fixed full-viewport canvas behind the DOM" and §183 has pollen at "half
density over cream grounds" — both of which put the ground *under* the canvas and the content *over*
it. So the sections are now transparent and **`src/sections/GroundLayer.tsx`** paints each section's
ground across the scroll range that section owns.

**The obvious alternative was considered and rejected**, and the reason is worth keeping: one fixed
full-screen ground driven by the active label is simpler, but the label only flips once the incoming
section reaches the top of the viewport, so Merchandise's cream content would spend a whole viewport
of scrolling on Murals' ink. The document-space blocks make the boundary slide exactly as an opaque
section background did — verified at scrollY 11100, where the ink/cream seam sits at exactly 420px,
matching g4's viewport top.

### The follow-on that (a) caused — `49da5c3`

Making the sections transparent removed something that had been masking a latent layout problem.
**Sections are 100vh; their content is not.** At short viewports content spills outside the section
box, and because siblings paint in order, a section's *downward* spill had always been covered by the
next section's opaque ground. Nothing covered it once the grounds moved out.

Measured at 1024×640, spill outside each section's own box:

| section | above | below | note |
| --- | --- | --- | --- |
| hero | 170 | 170 | already `overflow-hidden`, so masked |
| about | 135 | 135 | `visible` — 910px of content in a 640px box |
| g1 | 49 | 75 | `overflow-x-clip` only, so y was never clipped |
| g2 | 55 | 81 | |
| g3 | 0 | 145 | |
| g4 | 38 | 64 | |
| contact | 0 | 0 | |

About is `flex items-center`, which is why its spill is symmetric. Only the **downward** spill was
ever visible — an upward spill paints over the previous section regardless of opacity, since it comes
later in the DOM. Fixed by clipping each section to its own pane: `overflow-clip` on About and
Contact, and `GalleryScene`'s `overflow-x-clip` widened to both axes.

**`clip`, not `hidden`** — `hidden` fixes the paint and reintroduces a scroll container, which is how
tabbing to an off-screen dossier once set `section.scrollLeft` to 1680 and left the Murals track
desynced from `--at`. Verified: forcing `scrollLeft = 1680` and `scrollTop = 400` on g1 and g3 leaves
both at 0.

At 1440×900 every section measures **0 spill**, so this commit is a no-op at the design viewport.

---

## Commands

```
npm run dev        # Vite on :5173 — SEE BELOW
npm test           # vitest run — 106 tests
npm run typecheck  # tsc -b --noEmit
npm run build      # tsc -b && vite build
```

**Port 5173 is the user's.** A long-lived dev server ran there from 2026-07-30 until this cycle,
when the user asked for it to be killed; it has not been restarted. Start your own on another port
(`npm run dev -- --port 5180 --strictPort`) and leave 5173 alone unless asked. Console errors
previously seen on 5173/5175 (`orbitSeats is not defined`, `lazy is not defined`) were stale HMR
state in that long-lived server, not defects in this tree.

## Module map

| Module | Role |
| --- | --- |
| `src/data/*.ts` | One module per category. Counts confirmed 24 / 7 / 7 / 12; titles and dates are placeholders. |
| `src/lib/ring.ts` | Pure ring geometry. Seats + centre slot, `orbitSeats`, index/progress mapping. |
| `src/lib/track.ts` | Pure Murals track geometry — pitch, fractional wall index, bend contract, chapters. |
| `src/lib/snapList.ts` | Pure nearest-item search + centring gutter for the fallback list. |
| `src/scroll/scenes.ts` | Per-scene declarations + `LABELS`. Pure `piecesFor(scene, filter)` + live-reading `activePieces`. |
| `src/scroll/presentation.ts` | `resolvePresentation(declared, reduced, compact)` → what actually renders. |
| `src/scroll/timelineMath.ts` | Pure pin-length, scroll-mapping, snap-threshold helpers. |
| `src/scroll/timeline.ts` | **Sole owner of GSAP.** `createScrubScene` builds every pinned scene. Holds the label registry. **Build order is load-bearing — see invariant 9.** |
| `src/scroll/store.ts` | Two channels: discrete `state` (publishes to React) and per-frame `frame` (never does). |
| `src/routes/ScrollPage.tsx` | The scroll page. Owns scroll save/restore — see Decisions. Mounts `GroundLayer` → `Stage` → `main`. |
| `src/sections/GroundLayer.tsx` | **New.** Paints each section's ground in document space, behind the canvas. Measures pin-spacers; subscribes to `onTimelineRefresh`. |
| `src/sections/ring/Dial.tsx` | Pinned rotating presentation (g1, g2, g4). |
| `src/sections/ring/SnapList.tsx` | Pin-free fallback. Category-generic — serves the track too. |
| `src/sections/ring/CentreSlot.tsx` | Focused piece + cross-fade. **The documented ripple seam.** |
| `src/sections/track/Track.tsx` | Murals row: track, chapter bar, annotation. |
| `src/sections/track/Dossier.tsx` | One wall: context plate + metadata + two detail crops. |
| `src/three/Stage.tsx` | r3f canvas at **`z-[1]`** — above the grounds, below `main`. Memoised and lazy-loaded. |
| `src/three/Pollen.tsx` | Pre-existing pollen system. Scatters across a hardcoded 22 × 14 box — see Decisions. |
| `src/three/flock.ts` | **Pure.** `flockAt`, `waypointsFrom`, `ATTRACTORS`. No three.js, no React, no `timeline` import. |
| `src/three/flock.test.ts` | 13 pure tests, node environment. |
| `src/three/Butterflies.tsx` | One `instancedMesh`, 1,200 rhombi, custom shader. Owns `activeWaypoints()` and the tuning table. |

## Invariants — do not break these

1. **The scrub value never enters React state; `activeIndex` never enters the frame loop.** Each
   frame reaches the DOM as one scalar via `onSceneFrame`, whose meaning belongs to the presentation:
   degrees written to `--r` by a dial, fractional wall index written to `--at` by the track.
   `activeIndex` publishes only when the rounded index changes — never 60/s.
2. **GSAP lives only in `src/scroll/timeline.ts`** (and `useLenis.ts`). No component imports `gsap`
   or `ScrollTrigger` — `GroundLayer` goes through `onTimelineRefresh` for exactly this reason.
   **This is why `flock.ts` may not import `timeline.ts` even transitively.**
3. **The snap goes through Lenis, never `ScrollTrigger.snap`.** Two writers of scroll position fight
   and produce jitter that is miserable to reproduce.
4. **Counts are never hardcoded in a view** — read via `activeCount(scene)` / `activePieces(scene)`.
   Likewise label offsets and ground ranges: `waypointsFrom` and `GroundLayer` both measure, never
   embed the known-good baseline.
5. **The ring is N orbit seats + one centre slot.** Orbit length is `orbitSeats(seats, count)` =
   `min(seats, count - 1)`; both the seat spacing and the rotation must read it.
6. **Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`.** No DOM. Every test is a
   pure-function test *by design* — presentations are verified in a browser instead. **Do not add
   jsdom or component tests.**
7. Design tokens live in `src/styles/index.css` under `@theme` — **except scene geometry**, which
   lives in `scenes.ts`, `look.ts`, `lib/track.ts` and `three/flock.ts` because the timeline and the
   motion rule compute with it. Hairlines are 1px. Mono labels are always uppercase and
   letter-spaced — put `uppercase` on the element itself, since a `<button>` does not inherit
   `text-transform`. Every piece renders `<Placeholder>`; there is no imagery yet.
8. **`THREE.Color` cannot parse `oklch`.** The stage converts tokens to hex by hand and names the
   token in a comment. `--color-ochre-bright` `oklch(0.8 0.09 62)` = `#e8b181` and `--color-sage`
   `oklch(0.68 0.11 150)` = `#63ab74`, both as `Butterflies.tsx` has them.
9. **`buildTimeline` builds in page order, top to bottom, and the whole-document trigger is last
   with `refreshPriority: -1`.** ScrollTrigger refreshes in creation order and applies pin spacing as
   it goes; anything created ahead of the pinned scenes measures a 6300px document. This is what
   defects (b) and (c) were. Adding a new section means inserting it at its page position.
10. **Every section clips to its own pane, with `clip` and not `hidden`.** The grounds no longer
    mask a neighbour's overflow, and `hidden` would make the section a scroll container and desync
    the Murals track.
11. **The ground layer's blocks must tile the document end to end.** Each block spans one section's
    scroll range, taken from its pin-spacer where it has one. A gap shows as a strip of bare `body`.

## How to verify UI work here

Invariant 6 means the browser *is* the test for anything visual. Four traps, each of which has
already cost a cycle:

- **Drive the page as the active tab.** Lenis runs off a GSAP ticker on `requestAnimationFrame`. In
  an occluded or background tab rAF is throttled and nothing Lenis-driven moves. **Playwright's page
  is the tool that works** — a Chrome-extension attempt hit severe rAF throttling and produced
  unusable screenshots. Even Playwright's headed browser throttles when occluded. **Call
  `bringToFront()` and then measure the tick rate before trusting anything.** Healthy readings differ
  per machine and per browser: a previous cycle measured 26–27 ticks/500 ms (~54 Hz) as healthy;
  this cycle's Playwright browser reads **61–62 ticks/500 ms (~122 Hz)**. Do not carry a threshold
  across machines — take a reading, and if it is ~1, fix the focus before concluding anything.
  Scroll with `lenis.scrollTo` or real wheel input, never `window.scrollTo` — Lenis owns the scroll
  position.
- **A computed style is not what you see.** One cycle asserted `getComputedStyle().transform` and
  reported a clean ±8° bend while the planes rendered flat, because the parent lacked
  `transform-style: preserve-3d`. **Look at a screenshot, and press Tab.**
- **A framebuffer readback is not looking either.** An agent that could not screenshot used
  `gl.readPixels`, got exactly the right alpha and exactly the right ochre, and was structurally
  blind to the marks being the wrong *shape*.
- **Vary viewport height, not just width.** This cycle's own regression — five sections spilling
  outside their boxes — was invisible because every check used 920/960/1440 widths at a single 900px
  height. It appears at 640px height and vanishes at 900. Check at least one short viewport.

Two probe gotchas:

- Matching `/\d\d \/ \d\d/` against a scene's text finds a *dossier's* `WALL 01 / 07` metadata, not
  the progress row. Match the element whose entire text is `nn / nn`.
- **Dynamically importing a source module from the page gives you a second module instance after any
  HMR edit.** Vite serves the app `timeline.ts?t=<stamp>` once the file changes, so a bare
  `import('/src/scroll/timeline.ts')` gets a fresh copy with an empty label registry — which reads as
  "the fix broke label registration". `ScrollTrigger` itself is shared, so read ground truth from
  `ScrollTrigger.getAll()` instead of the module's own state.

## What's next

**The canvas now reaches a visitor, so the questions that were unanswerable are answerable.**

- **`RADIUS_WIDE` is the user's, not yours. Do not change it.** Still `32` at
  `Butterflies.tsx:42`. A four-way comparison (32 / 52 / 76 / 110) was captured this cycle and the
  user has taken the decision to set it by hand during their own testing — see "The RADIUS_WIDE
  comparison" below for what the candidates look like and how to re-shoot them. Treat any value you
  find there as deliberate.
- The r3f ripple/displacement shader on the centre slot. The seam is built and documented in
  `CentreSlot.tsx` as a single `swapTo(piece)` function — but it would ripple placeholder stripes
  until real imagery lands.
- Between-scene "collapse to a seed" transition. README §175 couples this to the flock; the flock's
  half is built, the ring's half is not, and it is a change to `timeline.ts`'s scene structure.
- Mobile bottom ticker and the rail's cream-ground flip.
- Detail-page media: zoomable artwork, orbitable ovoid, mural crop strip.
- **Nothing has been merged.** `finishing-a-development-branch` has still not been run and there is
  still no remote.

**Blocked on Denise, not on us:** all imagery, her copy (every slot is tagged `COPY SLOT` in the
mockups), and most of the detail-page media. `<Placeholder>` is scaffolding to delete when real files
land, not a loading state.

## The RADIUS_WIDE comparison

`RADIUS_WIDE` scales **only the dispersed state**. `flock.ts`'s `gather` is `sin(pi * t)` across each
leg, so it is exactly 0 at every waypoint and 1 mid-leg, where the spread is `RADIUS_TIGHT` (3.5)
instead. **The dense migrating cloud between scenes is therefore identical at every candidate value**
— only the resting state differs, which is the state a visitor spends their reading time in.

This corrects an impression recorded mid-cycle. A screenshot at scrollY 12100 looked heavily
speckled and was briefly described as the flock crowding the content; that position is mid-leg at
`gather` ≈ 0.95, i.e. the migrating cloud working as designed. At rest, `R = 32` is already fairly
restrained.

Captured at 1280×800 at the exact label offsets (g1 = 1600, g4 = 10240, both landed exactly, so
`gather` = 0):

- **32** — current. Reads as deliberate texture on ink; a light speckle on cream.
- **52** — fine dust; marks still legible on both grounds, sub-copy clean. The most likely
  improvement if a thinner residue is wanted.
- **76** — sparse.
- **110** — near-bare; the flock effectively disappears on cream.

The side-by-side page is the durable copy:
**https://claude.ai/code/artifact/adb62663-51f2-44e6-bd90-62cf2fc94529**
The source frames were written to that cycle's session scratchpad as
`cmp-r{32,52,76,110}-{g1-ink,g4-cream}.jpg` and **do not survive into a new session** — the artifact
does.

**To re-shoot:** edit the constant, reload (it is baked into the vertex shader as a literal), and
capture at the two label offsets for the viewport in use. Offsets are viewport-dependent, so read
them from `ScrollTrigger.getAll()` rather than reusing the numbers above, and confirm the page landed
exactly on them — a few px off a waypoint is no longer `gather = 0` and the comparison stops being
like-for-like.

---

## Decisions already ruled on — do not re-open

### From the canvas-visibility cycle

**The ground lives in `GroundLayer`, in document space — not on the sections, and not in one fixed
element.** See "(a) the canvas was covered everywhere" for why the fixed-ground alternative is wrong
at the ink/cream boundaries. The blocks are measured from pin-spacers so they follow whatever the
timeline does; they are not derived from the known-good offsets.

**`Stage` is `z-[1]`, not `z-0`.** The stack is ground `z-0` → canvas `z-1` → `main` `z-10`.

**Sections clip with `overflow-clip` on both axes.** Not `hidden` — see invariant 10.

### From the butterfly flock cycle

**No GSAP MotionPath.** README §175 names it as the flock's driver; the spec deliberately rejected
it (`specs/2026-07-31-butterfly-flock-design.md` §2). Every other piece of geometry here is a pure
module with a test file, and MotionPath would cost a plugin in the critical-path bundle and add a
second writer to the `frame` channel.

**`frame.attractor` was deleted, not filled in.** The flock runs r3f-reads-progress, not
GSAP-writes-attractor, so the field would only ever publish a permanent zero that reads as live state.

**`activeWaypoints()` lives in `Butterflies.tsx`, not `flock.ts`.** `flock.ts` is imported by a
node-environment test and must not reach `timeline.ts` even transitively (invariant 2). The pure half
is `waypointsFrom(offsets, scrollable)`; the one live-reading line stays in the r3f file.

**Wing geometry is two triangles apexed at `y = 0`, not two quads. Do not "simplify" it back.** The
only rotation is about `y`, which scales `x` by `cos(flap)` and never touches `y` — so a quad with
corners `(±1, ±0.6)` is an **axis-aligned rectangle at every flap value** and can never read as
README §227's rotated square. Both the original spec and plan prescribed the quads.

**The real camera frustum at the `z = 0` plane is ~8.28 world units tall — NOT the 22 × 14 that
`Pollen.tsx` hardcodes.** Camera is `position: [0, 0, 10], fov: 45`, so height = `2 · 10 · tan(22.5°)`
= 8.284, fixed. Width is **aspect-dependent**: ≈ **13.25 at 1440×900** and ≈ **14.7 at 16:9**. Both
are the same measurement at different viewports; neither is 22 × 14.

**`Pollen.tsx`'s off-token colour is a known, deliberate non-fix.** It hardcodes `#b8873f`, but
`--color-ochre` is `oklch(0.68 0.11 62)`, which converts to `#c9884c`. Pre-existing, out of scope.
Its 22 × 14 scatter box is the other half of the same drift. **Now that the canvas is visible, both
are worth revisiting.**

### Carried forward

**`refreshTimeline()` is not a no-op. Do not remove it.** What the refresh does is drive an
`onUpdate`, and that is the only thing recomputing the ring's rotation for a newly filtered count.
Measured with it removed — the seats re-render 6 → 4 correctly while `--r` stays frozen at 300.10°
for over a second where 109.13° is right.

**Scroll restore needs all three of these.** Each was hiding the next:

1. The offset is written through on **every scroll**, and deliberately **not** again on cleanup.
   Teardown is too late to read `scrollY`: `killTimeline()` unpins four sections and collapses the
   document before this cleanup runs, and a save there overwrote a correct offset with the clamped
   one (3428 → 388). Writing through also lets a hard refresh keep its place.
2. The restore waits for `refreshAfterFonts`' callback, **not** a bare `rAF`. Creating a pinned
   trigger does not lay out its pin spacer; only the refresh does.
3. `lenis.resize()` runs before the `scrollTo`. Lenis caches its scroll limit and recomputes only
   from an async ResizeObserver.

The `sessionStorage` read also happens at effect setup, *before* the listener is attached.

**Geometry deliberately is not in `index.css`.** Seventeen tokens mirroring the scene numbers sat
there referenced by nothing and were deleted rather than wired up: the timeline computes with these
values, which CSS cannot do.

**`scrub: 1` was removed from the scrub triggers; do not re-add it.** Removing it flips
ScrollTrigger's internal `isToggle`, so this is *empirically equivalent, not provably inert*. Tested
directly: merch chip clicked mid-pin, scroll unchanged at y=10424, `--r` moved 300.10° → 109.13°
within 16ms.

**Keyboard focus on the track uses `:focus-visible`, not a pointer flag.** A `pointerdown` flag was
tried and latches — a click on the row's gutter focuses nothing, so the flag survives and swallows
the next genuine Tab.

**Kept deliberately despite zero consumers:** `src/scroll/usePresentation.ts` and `sceneCount` in
`scenes.ts`. `RING_LOOK.murals` is a type-required zero row, not an orphan.

**Cream-ground dial chrome** uses `border-ink/25` uniformly rather than a 12/25 staircase.

## Known-good measurements

A regression baseline. Confirmed in a real browser at 1440×900 unless marked.

**Confirmed on `49da5c3`:**

- Document is **17.4 viewports (`scrollHeight` 15660)**; `maxScroll` = **14760**.
- **All seven label offsets: `hero 0 · about 900 · g1 1800 · g2 5580 · g3 8460 · g4 11520 ·
  contact 14760`.** The four gallery offsets are unchanged from the pre-fix baseline; only `contact`
  moved (5400 → 14760, its real top).
- The whole-document trigger ends at **14760**, and `frame.progress` tracks `scrollY / 14760`
  exactly: 250 → 0.0170, 3321 → 0.2250, 5400 → 0.3659, 8144 → 0.5518, 12006 → 0.8134, 14760 → 1.
- **The rail's Contact diamond lands at 14760** with Contact's top at viewport top. This had never
  been measured before; it used to land at 5400, mid-Ovalese.
- Flock waypoints are now monotonic: `at` = `[0, 0.061, 0.122, 0.378, 0.573, 0.780, 1.0]`, so
  `flockAt`'s `p >= last.at` clamp fires only at the very end, which is the intended "landed" state.
- Ground blocks tile **0 → 15660** exactly, with boundaries at every label offset. Still tile at
  920 and 960 width, and at 1024×640 and 1280×800.
- The ink/cream seam slides: at scrollY 11100 the boundary sits at **420px**, matching g4's viewport
  top.
- Every section measures **0 spill** at 1440×900; sections refuse `scrollLeft`/`scrollTop`.
- Murals: `--at` spans **0 → 3 → 6**; centred dossier **816** wide, neighbours **749.4 / 689.7 /
  630** — matching the older baseline exactly.
- Scroll restore exact from **3428, 9180 and 12371**, and survives a hard refresh.
- Reduced-motion frieze and the 920/960 breakpoints behave; compact drops `Butterflies` entirely and
  keeps pollen at 25%.
- Bundle: critical path **401.35 kB**, lazy three chunk **886.68 kB**.
- rAF ~122 Hz (61–62 ticks / 500 ms) in this cycle's Playwright browser, once frontmost.
- At **1280×800**, offsets are `hero 0 · about 800 · g1 1600 · g2 4960 · g3 7520 · g4 10240 ·
  contact 13120`, maxScroll 13120. Recorded because the flock comparison was shot there.

**Older baseline, still believed good:**

- Artworks counter climbs `01 / 24` → `24 / 24`, reaching 24/24 while still pinned.
- Idle snap overshoots, then pulls *backwards* onto the stop and holds. The residual is
  integer-scroll quantisation — stop 20 sits at 4304.35 and the browser can only rest on 4304.
- The snap never fires mid-gesture: 14 wheel events at 70ms intervals, strictly monotonic.
- A thumb click rotates that piece to centre without navigating. Chapter jump moves `--at` 4→0
  without navigating.
- Merch chips re-bloom: jackets → 4 thumbs at exactly 90° gaps; earrings → 0 thumbs, centre only,
  `01 / 01`.

**Retired.** Every "now in doubt" entry in the previous handoff is resolved: `frame.progress` is no
longer `scrollY / 5400`, `contact` is no longer 5400, and visual judgements no longer need the
uncommitted `z-index: 9999` diagnostic — the canvas is visible in the real stacking order.

## Defects caught in previously-prescribed code

Kept because it calibrates how much to trust a written spec here — including specs written in this
repo by previous cycles.

1. A test asserting `needsSnap(0.5, 7) === true`, which is impossible (0.5 *is* stop 3 of 7).
2. A duplicated `ScrollTrigger.create` label block → extracted as `createLabelTrigger`.
3. **A CSS transform leaving every orbit thumb tilted by its seat angle** — the counter-rotation
   cancelled the ring's spin but not the seat's own placement.
4. Murals track copy showing under the `list` presentation on every dial scene.
5. A double cross-fade on merch filter clicks, plus a reset fighting the route-return scroll restore.
6. **A snap list whose last three pieces could never become active** — no centring gutter.
7. **Chapter-bar labels rendering in mixed case**, because `<button>` does not inherit
   `text-transform`. Now part of invariant 7.
8. **The ±8° plane bend rendering flat**, because the row lacked `transform-style: preserve-3d`.
   Reported as verified by measurements that could not have detected it.
9. **`g3` documented as pinning when it never pinned at all.** That error survived a spec, a plan and
   a handoff before anyone measured the document height.
10. **A plan that mandated code its own verification step names as the failure signature.** The
    flock plan's Step 5 read "if the marks render as perfect rectangles rather than diamonds, the
    wing rotation is wrong" — while the plan's own code block *guaranteed* rectangles.
11. **A test that could not fail.** A review asked for a test pinning the `span > 0` guard and
    supplied a waypoint list that can never reach the negative-span segment, so it passed identically
    against the guarded *and* the naive implementation.
12. **A framebuffer readback substituted for looking.** See "How to verify UI work here".
13. **Two handoffs stating that pollen was shipped and working.** It had never been visible to
    anyone — the canvas was occluded from the moment it was added. Nobody had looked at the page with
    the DOM hidden until this cycle.
14. **A fix whose verification pass had a shape-shaped hole in it.** `b5ea535` was verified across
    920/960/1440 *widths* at a single 900px *height*, and shipped a regression that only appears at
    short viewports. Caught one commit later, by looking at a screenshot taken for an unrelated
    purpose. The lesson is in "How to verify UI work here".
15. **This document claiming `.claude/worktrees/gallery-ring-timeline/` "still contains nothing".**
    It contains six PNGs and a `.playwright-mcp` directory from the flock cycle. Written twice
    without being checked.

## Open minor findings

Reviewed, judged non-blocking, deliberately not fixed.

- **`flock.ts:127`'s length guard** (`offsets.length !== LABELS.length`) also rejects arrays *longer*
  than 7, which the doc comment does not say. No functional risk — the sole caller passes exactly 7.
- **`Butterflies.tsx`'s `useFrame` reads `document.documentElement.scrollHeight` every frame**, which
  forces layout, and does so unconditionally. A deliberate tradeoff, commented in the code.
- **`Pollen.tsx` hardcodes `#b8873f` and a 22 × 14 scatter box.** Off-token colour (should be
  `#c9884c`) and a box unrelated to the real frustum. Pre-existing — and now visible, so worth
  revisiting.
- **`flockAt`'s `span > 0` ternary is unreachable**, and the early-return clamps are what actually
  bound the function. Proven by a 2,000,000-trial fuzz and re-confirmed by a 500,000-trial one, both
  finding zero counterexamples. **Do not delete it** — it is cheap and documents the invariant — but
  do not believe it is load-bearing either. With (c) fixed the waypoint list is monotonic by
  construction, so the non-monotonic input it was imagined to guard against no longer occurs.
- **`GroundLayer` re-measures on a rAF after mount**, because child effects run before the parent's
  `buildTimeline`. Harmless — at that moment the page is at scroll 0 and hero's block is correct
  either way — but it means the layer is briefly measured against an unpinned document.

## Housekeeping

`.claude/worktrees/gallery-ring-timeline/` is registered to no worktree (`git worktree list` shows
only the main checkout) but is **not empty** — it holds six PNGs and a `.playwright-mcp` directory
left by the flock cycle. Safe to delete; the previous two handoffs said it was empty, which was
wrong.

`.superpowers/` is git-ignored scratch and is expected to be deleted.

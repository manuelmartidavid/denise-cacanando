# Ovalese — Project Handoff

**Read this first.** It is the single current-state document for the site; there is no other handoff.
It replaces `2026-07-30-ovalese-handoff.md`, which was deleted in the same commit — one current-state
document, revised, never accumulated.

**State:** **branch `feat/butterfly-flock` @ `6c0d7d2`, NOT MERGED.** Cut from `main` @ `d12435c`.
No `finishing-a-development-branch` step was run and **there is still no git remote configured**.
You are standing on an unmerged branch: `main` does not have the flock. Working tree clean apart
from untracked `.claude/`.
**Verification (re-run 2026-07-31 on `6c0d7d2`, not copied from a report):** `npm run typecheck`
clean · `npm test` → **8 test files / 106 tests passing** · `npm run build` succeeds · critical-path
bundle 400.39 kB, three.js split into a lazy 886.68 kB chunk.
**Console:** clean apart from one pre-existing three.js `Clock` deprecation notice from the r3f
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

## The canvas does not reach a visitor — three pre-existing defects

**This is the most important section in this document.** All three predate `feat/butterfly-flock`,
all three are outside the flock's files, and all three were deliberately left unfixed so the branch
stayed purely additive. They were surfaced by the flock cycle's browser pass and, for (a),
re-verified structurally by the controller independently of the browser.

### (a) The r3f canvas is fully occluded. Nothing on it has ever been seen.

`Stage`'s wrapper is `pointer-events-none fixed inset-0 z-0` (`src/three/Stage.tsx:36`) and `<main>`
is `relative z-10` (`src/routes/ScrollPage.tsx:123`). Every section paints an **opaque** ground —
`bg-ink`, `bg-cream` on About and g4, Hero's opaque radial gradient. The canvas is painted and then
covered. `document.elementFromPoint` at five points across the viewport returns the section's
opaque `SECTION` under `MAIN.relative.z-10` at every one of them. Injecting `main { opacity: 0 }`
at the same scroll position renders a dense diamond field plus thousands of pollen points; with
`main` visible, nothing.

**State the implication plainly: `Pollen` has apparently never been visible to anyone.** This branch
touched only `store.ts`, `Stage.tsx`, `Butterflies.tsx`, `flock.ts`, `flock.test.ts` and two docs;
`Stage.tsx`'s wrapper `div` and every section background are unchanged from `main`. Pollen is listed
as shipped and working in the previous handoff and in README §183 ("always on"). It is neither.
README §182 says the canvas is "behind the DOM", so the intent is a canvas that shows *through* — the
grounds being opaque is the bug, not the `z-0`.

Fixing it means deciding where the ground colour lives. That is a change to the section
architecture.

### (b) `frame.progress` saturates at 1.0 past scrollY 5400.

The whole-document ScrollTrigger at `src/scroll/timeline.ts:213-222` — `trigger:
document.documentElement`, `start: 'top top'`, `end: 'bottom bottom'` — reports `start: 0, end:
**5400**`, while `ScrollTrigger.maxScroll(window)` correctly reports **14760**. So
`frame.progress` is `scrollY / 5400`, clamped. Measured at rest after a clean reload: 250 → 0.046,
3321 → 0.615, 3493 → 0.647, 5907 → **1**, 8144 → **1**, 12006 → **1**, 14760 → **1**.

**5400 is exactly 7 sections × 900 − 900 viewport = the document with all pin spacing stripped —
the same number the previous handoff records from the scroll-restore bug** ("anything past 5400px
clamped"). ScrollTrigger strips pin spacing while refreshing and measures the trigger element in
that state, so a trigger on `documentElement` can never see the pinned height. **An explicit
`ScrollTrigger.refresh()` does not fix it** — it was called and `end` stayed 5400.

### (c) `getLabelOffset('contact')` returns 5400, not 14760 — and the rail's Contact jump is broken.

Same root cause. Live registry after a clean load:
`hero 0 · about 900 · g1 1800 · g2 5580 · g3 8460 · g4 11520 · contact **5400**`. The four gallery
offsets match the known-good baseline exactly. Contact's real document top is 14760, measured with
`getBoundingClientRect`. It reads 5400 because `buildTimeline` creates the `hero`/`about`/`contact`
label triggers *before* the gallery scenes, so contact refreshes while the pins are still stripped.

Two consequences, one of them user-visible in shipped code:

1. **`scrollToLabel('contact')` from the side rail scrolls to 5400 — the middle of the Ovalese
   scene.** A navigation bug that nobody had measured. It is not the flock's problem.
2. The flock's waypoint list becomes non-monotonic: `at` = `[0, 0.061, 0.122, 0.378, 0.573, 0.780,
   **0.366**]`.

### What (b) + (c) do to the flock, and why it degrades instead of crashing

`flock.ts` is correct; its inputs are not. Because the last waypoint's `at` is 0.366, `flockAt`'s
`p >= last.at` clamp fires from 37% of the page onward and the flock is **permanently "landed"**
past roughly g1 — one ~6-unit pop at 37% progress, then nothing.

The final whole-branch review verified empirically, with 2000-sample sweeps against both the
malformed production list and a fully shuffled one, that **`flockAt` is total**: zero non-finite
results, zero out-of-range uniforms, nothing corrupted. The degradation is bounded, not a crash.

**Correction to what the cycle first believed about *why*.** The boundedness comes from the two
early-return clamps (`p <= first.at`, `p >= last.at`), **not** from the `span > 0` ternary at
`flock.ts:68`. That ternary's `: 0` branch is **provably unreachable for any input**: reaching the
segment search means `first.at < p < last.at` strictly; whether the loop stops early
(`waypoints[i+1].at > p`, and `waypoints[i].at <= p` is what advanced into `i`) or hits the
`length - 2` cap (`b = last`, and `p < last.at` because the clamp did not fire), you always end with
`a.at <= p < b.at`, i.e. `span > 0`. Confirmed by the implementer with a 2,000,000-trial fuzz
(334,039 interior hits, min span +0.0012, zero counterexamples) and re-confirmed independently while
writing this handoff with a 500,000-trial fuzz (69,338 interior hits, min span +0.00035, zero
non-positive). **Do not delete the ternary on that basis** — it is cheap and it documents the
invariant — but do not believe it is what is holding the flock together either. If a real guard
against defect (c)'s non-monotonic input is wanted at the `t` computation, that needs a change to
`flock.ts`'s logic and is still an open question (see "Open minors").

---

## Commands

```
npm run dev        # Vite on :5173 — SEE BELOW, 5173 is the user's
npm test           # vitest run — 106 tests
npm run typecheck  # tsc -b --noEmit
npm run build      # tsc -b && vite build
```

**Port 5173 belongs to the user.** Their dev server has been running there since 2026-07-30. Start
your own on another port (`npm run dev -- --port 5180 --strictPort`) and leave theirs alone. Console
errors seen on 5173/5175 (`orbitSeats is not defined`, `lazy is not defined`) are stale HMR state in
the user's long-lived server, not defects in this tree.

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
| `src/scroll/timeline.ts` | **Sole owner of GSAP.** `createScrubScene` builds every pinned scene. Holds the label registry — see defect (c). |
| `src/scroll/store.ts` | Two channels: discrete `state` (publishes to React) and per-frame `frame` (never does). `frame.attractor` was deleted this cycle. |
| `src/routes/ScrollPage.tsx` | The scroll page. Owns scroll save/restore — see Decisions. |
| `src/sections/ring/Dial.tsx` | Pinned rotating presentation (g1, g2, g4). |
| `src/sections/ring/SnapList.tsx` | Pin-free fallback. Category-generic — serves the track too. |
| `src/sections/ring/CentreSlot.tsx` | Focused piece + cross-fade. **The documented ripple seam.** |
| `src/sections/track/Track.tsx` | Murals row: track, chapter bar, annotation. |
| `src/sections/track/Dossier.tsx` | One wall: context plate + metadata + two detail crops. |
| `src/three/Stage.tsx` | r3f canvas. Mounts `Pollen` and (non-compact only) `Butterflies`. Memoised and lazy-loaded. |
| `src/three/Pollen.tsx` | Pre-existing pollen system. Scatters across a hardcoded 22 × 14 box — see Decisions. |
| `src/three/flock.ts` | **Pure.** `flockAt`, `waypointsFrom`, `ATTRACTORS`. No three.js, no React, no `timeline` import. |
| `src/three/flock.test.ts` | 13 pure tests, node environment. |
| `src/three/Butterflies.tsx` | One `instancedMesh`, 1,200 rhombi, custom shader. Owns `activeWaypoints()` and the tuning table. |

## Invariants — do not break these

1. **The scrub value never enters React state; `activeIndex` never enters the frame loop.** Each
   frame reaches the DOM as one scalar via `onSceneFrame`, whose meaning belongs to the presentation:
   degrees written to `--r` by a dial, fractional wall index written to `--at` by the track. The
   track's single `--at` drives both the row's x-translate and every plane's ±8° bend in pure CSS.
   `activeIndex` publishes only when the rounded index changes — never 60/s.
2. **GSAP lives only in `src/scroll/timeline.ts`** (and `useLenis.ts`). No component imports `gsap`
   or `ScrollTrigger`. **This is why `flock.ts` may not import `timeline.ts` even transitively** —
   `timeline.ts` registers GSAP at module scope and `flock.test.ts` runs in a node environment.
3. **The snap goes through Lenis, never `ScrollTrigger.snap`.** Two writers of scroll position fight
   and produce jitter that is miserable to reproduce.
4. **Counts are never hardcoded in a view** — read via `activeCount(scene)` / `activePieces(scene)`.
   Likewise label offsets: `waypointsFrom` never embeds the known-good baseline, because those are
   recomputed on every refresh.
5. **The ring is N orbit seats + one centre slot.** The orbit is a *window* onto the category, not a
   seat per piece, and the focused piece is never on it. Orbit length is `orbitSeats(seats, count)` =
   `min(seats, count - 1)`; both the seat spacing and the rotation must read it, or the ring visibly
   under-turns per piece.
6. **Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`.** No DOM. Every test is a
   pure-function test *by design* — presentations are verified in a browser instead. **Do not add
   jsdom or component tests.**
7. Design tokens live in `src/styles/index.css` under `@theme` — **except scene geometry**, which
   lives in `scenes.ts`, `look.ts`, `lib/track.ts` and `three/flock.ts` because the timeline and the
   motion rule compute with it. Hairlines are 1px. Mono labels are always uppercase and
   letter-spaced — put `uppercase` on the element itself, since a `<button>` does not inherit
   `text-transform`. Every piece renders `<Placeholder>`; there is no imagery yet.
8. **`THREE.Color` cannot parse `oklch`.** The stage converts tokens to hex by hand and names the
   token in a comment. If `index.css` changes, recompute them. Verified this cycle:
   `--color-ochre-bright` `oklch(0.8 0.09 62)` = `#e8b181` and `--color-sage` `oklch(0.68 0.11 150)`
   = `#63ab74`, both exactly as `Butterflies.tsx` has them.

## How to verify UI work here

Invariant 6 means the browser *is* the test for anything visual. Three traps, each of which has
already cost a cycle, and the first two recurred again this cycle:

- **Drive the page as the active tab.** Lenis runs off a GSAP ticker on `requestAnimationFrame`. In
  an occluded or background tab rAF is throttled and nothing Lenis-driven moves, so the snap looks
  broken when it is fine. **Playwright's page is the tool that works** — a Chrome-extension attempt
  this cycle hit severe rAF throttling and produced unusable screenshots. Even Playwright's headed
  browser throttles when its window is occluded: the first reading this cycle was **1 tick per
  500 ms**, and after `page.bringToFront()` it was 26 / 27 / 27 — i.e. **~54 Hz, which is a healthy
  reading on this machine**. The previous handoff's "50+ ticks per 500ms" threshold implicitly
  assumed a ~100 Hz display; do not use it here. If your first count is ~1, call `bringToFront()`
  before concluding anything. Scroll with real wheel input, never `window.scrollTo` — Lenis owns the
  scroll position.
- **A computed style is not what you see.** Every check in one cycle asserted
  `getComputedStyle().transform` and reported a clean ±8° bend while the planes rendered flat, because
  the parent lacked `transform-style: preserve-3d` and collapsed the rotation into a 1% `scaleX`.
  Measurement cannot see that. **Look at a screenshot, and press Tab.**
- **A framebuffer readback is not looking either.** This cycle an agent that could not screenshot
  used `gl.readPixels`, got exactly the right alpha and exactly the right ochre, and was
  structurally blind to the marks being the wrong *shape*. Third instance of the same lesson.

One probe gotcha: matching `/\d\d \/ \d\d/` against a scene's text finds a *dossier's*
`WALL 01 / 07` metadata, not the progress row. Match the element whose entire text is `nn / nn`.

## What's next

**Highest value, and it comes first: fix defects (a), (b) and (c).**

- **(a) is what makes anything on the canvas reach a visitor at all** — this branch *and* the
  already-shipped pollen. Building a third canvas system before (a) is fixed means building
  something nobody can see, tuned against numbers nobody can check.
- **(b) and (c)** are what make the flock travel and what put the rail's Contact diamond somewhere
  other than mid-Ovalese. (c) is a live navigation bug in shipped code.
- Once (a) is fixed, **revisit `RADIUS_WIDE`** (see Decisions) — it was documented rather than
  retuned precisely because it could not be judged.

Then, carried forward:

- The r3f ripple/displacement shader on the centre slot. The seam is built and documented in
  `CentreSlot.tsx` as a single `swapTo(piece)` function — but it would ripple placeholder stripes
  until real imagery lands.
- Between-scene "collapse to a seed" transition. README §175 couples this to the flock; the flock's
  half is built, the ring's half is not, and it is a change to `timeline.ts`'s scene structure —
  where the verified pin lengths and the scroll-restore sequence live.
- Mobile bottom ticker and the rail's cream-ground flip.
- Detail-page media: zoomable artwork, orbitable ovoid, mural crop strip.

**Blocked on Denise, not on us:** all imagery, her copy (every slot is tagged `COPY SLOT` in the
mockups), and most of the detail-page media. `<Placeholder>` is scaffolding to delete when real files
land, not a loading state.

---

## Decisions already ruled on — do not re-open

### From the butterfly flock cycle

**No GSAP MotionPath.** README §175 names it as the flock's driver; the spec deliberately rejected
it (`specs/2026-07-31-butterfly-flock-design.md` §2). Reasons: every other piece of geometry here is
a pure module with a test file, invariant 6 makes the browser the only other check, and the browser
has already missed two serious defects. MotionPath would also cost a plugin in the critical-path
bundle and add a second writer to the `frame` channel.

**`frame.attractor` was deleted, not filled in.** It was reserved for a design where GSAP wrote an
attractor and r3f read it. The flock runs the opposite way — r3f reads `frame.progress` and computes
its own target — so the field would only ever publish a permanent zero that reads as live state.

**`activeWaypoints()` lives in `Butterflies.tsx`, not `flock.ts`.** `flock.ts` is imported by a
node-environment test and must not reach `timeline.ts` even transitively (invariant 2). The pure half
is `waypointsFrom(offsets, scrollable)`; the one live-reading line stays in the r3f file. Same split
as `piecesFor` / `activePieces` in `scenes.ts`.

**Wing geometry is two triangles apexed at `y = 0`, not two quads. Do not "simplify" it back.** The
original spec and plan both prescribed quads with corners `(±1, ±0.6)`. The only rotation is about
`y`, which scales `x` by `cos(flap)` and never touches `y` — so that silhouette is an **axis-aligned
rectangle at every flap value** and can never read as README §227's rotated square. Caught in review,
escalated, and the human ruled to fix the geometry. `Butterflies.tsx` states this in the geometry
comment; keep the comment with the code.

**`RADIUS_WIDE = 32` makes the attractors visually inert at rest — documented, not retuned.** At that
radius the `gather: 0` dispersal ellipsoid's semi-axes dwarf the visible frame's half-extents, so the
frame lies wholly inside it for all seven attractors: the resting residue is near-uniform dust rather
than a placement biased toward any one attractor, and the coordinates function purely as **travel
endpoints** for the dense mid-leg cloud. The controller ruled to document this rather than retune,
because defect (a) means nobody has seen the flock in the real page and any new value would be a
guess stacked on a guess. **Revisit once (a) is fixed.** (`R=13` left ~300-456 of 1,200 on screen at
`gather: 0`; `R=32` leaves ~110-145 — thinner, but still not as sparse as the mockups draw.)

**The real camera frustum at the `z = 0` plane is ~8.28 world units tall — NOT the 22 × 14 that
`Pollen.tsx` hardcodes.** Camera is `position: [0, 0, 10], fov: 45` (`Stage.tsx:41`), so height =
`2 · 10 · tan(22.5°)` = 8.284, fixed. Width is **aspect-dependent**: `8.284 × aspect` ≈ **13.25 at
1440×900** (what `flock.ts` rounds to "13.1") and ≈ **14.7 at 16:9** (the figure the cycle ledger
records). Both are the same measurement at different viewports; neither is 22 × 14. The wrong number
propagated into three separate comments before being caught. Stating it here once, authoritatively.

**`Pollen.tsx`'s off-token colour is a known, deliberate non-fix.** It hardcodes `#b8873f`, but
`--color-ochre` is `oklch(0.68 0.11 62)`, which converts to `#c9884c` (verified). Pre-existing,
noticed while converting the flock's tokens, out of scope. Its 22 × 14 scatter box is the other half
of the same drift.

### Carried forward

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
   5400, while shallower offsets survived and made it look like it worked. **That 5400 is the same
   number as defects (b) and (c); see that section.**
3. `lenis.resize()` runs before the `scrollTo`. Lenis caches its scroll limit and recomputes only from
   an async ResizeObserver, so it otherwise clamps to the pre-pin height.

The `sessionStorage` read also happens at effect setup, *before* the listener is attached — the
browser's own load-time restoration fires scroll events that would overwrite the offset first.

**Geometry deliberately is not in `index.css`.** Seventeen tokens mirroring the scene numbers sat
there referenced by nothing and were deleted rather than wired up: the timeline computes with these
values (seat steps, pin lengths, track pitch, flock attractors), which CSS cannot do.

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

A regression baseline. Everything below was confirmed in a real browser at 1440×900 unless marked.

**Still good — re-confirmed live this cycle:**

- Document is **17.4 viewports (`scrollHeight` 15660)**; `maxScroll` = 14760.
- Gallery label offsets: **g1 1800, g2 5580, g3 8460, g4 11520** — matched the baseline exactly.
- `hero 0`, `about 900`.
- Camera frustum at `z = 0`: **8.28 tall**, `8.28 × aspect` wide (≈13.25 at 1440×900).
- rAF at ~54 Hz (26-27 ticks / 500 ms) is healthy on this machine, once the page is frontmost.
- Reduced-motion frieze and the 920/960 breakpoints both behave; compact drops `Butterflies`
  entirely and keeps pollen at 25%.
- Bundle: critical path 400.39 kB, lazy three chunk 886.68 kB.

**Now in doubt, or known wrong, because of defects (b) and (c):**

- **`contact`'s label offset reads 5400; its real top is 14760.** Any measurement that depended on
  the contact label — including the side rail's Contact diamond — is wrong, and was never in the
  baseline to begin with. **The rail's Contact jump has never been measured.** Measure it after
  fixing (c).
- **`frame.progress` is `scrollY / 5400`, not `scrollY / 14760`.** Any past or future claim about
  whole-document progress, and every visual judgement about the flock's travel, is measured against
  a driver that saturates at 37% of the page.
- Every visual judgement about the flock and about pollen was made with the canvas **artificially
  lifted above the DOM** by an uncommitted `z-index: 9999` diagnostic. They are judgements about the
  right grounds (ink and cream) but not about the real stacking. Re-check after (a).

**Older baseline, unaffected by the above and still believed good:**

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
10. **A plan that mandated code its own verification step names as the failure signature.** The
    flock plan's Step 5 read "if the marks render as perfect rectangles rather than diamonds, the
    wing rotation is wrong" — while the plan's own code block, quads at `(±1, ±0.6)` rotated only
    about `y`, *guaranteed* rectangles. Both spec and plan prescribed it.
11. **A test that could not fail.** The final review asked for a test pinning the `span > 0` guard
    and supplied a verbatim waypoint list. That list can never reach the negative-span segment
    (it would need `p >= 0.6` and `p < 0.3` simultaneously), so it passed identically against the
    guarded *and* the naive implementation. Caught by the implementer, who verified the guard with a
    different list rather than reporting success — and then found that **no** list can reach it (see
    the defects section). The test is still in the file as a bounds/finiteness check over a
    non-monotonic list, which is what it actually is. See "Open minors" for the unresolved half.
12. **A framebuffer readback substituted for looking.** An agent that could not screenshot used
    `gl.readPixels`, got exactly the right alpha and exactly the right ochre, and was structurally
    blind to the geometry being the wrong shape. Third instance of this project's recurring lesson —
    see items 8 and 11, and "How to verify UI work here".

## Open minor findings

Reviewed, judged non-blocking, deliberately not fixed. Carried out of the deleted cycle workspace
so they are not lost. Everything else the cycle logged was fixed in `6c0d7d2`.

- **`flock.ts:127`'s length guard** (`offsets.length !== LABELS.length`) also rejects arrays *longer*
  than 7, which the doc comment does not say. No functional risk — the sole caller passes exactly 7.
- **`Butterflies.tsx`'s `useFrame` reads `document.documentElement.scrollHeight` every frame**, which
  forces layout, and does so unconditionally — the height gate only avoids the cheap half (seven Map
  lookups and seven allocations in `activeWaypoints()`). A deliberate tradeoff, commented in the
  code.
- **`Pollen.tsx` hardcodes `#b8873f` and a 22 × 14 scatter box.** Off-token colour (should be
  `#c9884c`) and a box unrelated to the real frustum. Pre-existing; see Decisions.
- **Open question nobody has ruled on:** `flockAt` has two overlapping safety mechanisms, and the
  early-return clamps make the `span > 0` ternary permanently unreachable. If a guard against defect
  (c)'s non-monotonic input is wanted *at the `t` computation* rather than incidentally via the
  clamps, that is a change to `flock.ts`'s logic. Left untouched deliberately.

## Housekeeping

`.claude/worktrees/gallery-ring-timeline/` still exists, still contains nothing, and is still
registered to no worktree (`git worktree list` shows only the main checkout). Flagged as safe to
delete in the previous handoff and not deleted. Safe to delete.

`.superpowers/` is git-ignored scratch and is expected to be deleted. Everything from the butterfly
flock cycle that matters beyond it is in this document.

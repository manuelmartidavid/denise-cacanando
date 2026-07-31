# Ovalese — Project Handoff

**Read this first.** It is the single current-state document for the site; there is no other handoff.
Revised in place each cycle — one current-state document, never accumulated. This revision folds in
the mobile layer; the previous ones were `486fb32` (post-flock) and `23d40e7` (post-canvas-fix).

**State:** **branch `feat/butterfly-flock` @ `6b5d76c`, NOT MERGED TO `main`.** The last *code*
commit is **`d20bd37`**; `HEAD` is the docs commit that carries this file, sitting on top of it. (An
earlier version of this document gave only the code hash and cost the next session a few minutes
working out why `HEAD` disagreed — hence the distinction.)

`feat/mobile-responsive` was merged into `feat/butterfly-flock` (a fast-forward) and deleted, so
**three cycles are now stacked on one branch**: the butterfly flock, the canvas-visibility fixes, and
the mobile layer. `main` is still at `d12435c` and has none of them. **There is still no git remote
configured**, so nothing has been pushed anywhere.

**Working tree is NOT clean, and the two modified files are deliberate:**

- `vite.config.ts` adds `server.allowedHosts: ['.ngrok-free.dev']`, for testing the mobile layer on a
  real phone through an ngrok tunnel. The leading dot allows a free tunnel's rotating subdomain, so
  the file does not need editing on every ngrok restart. `allowedHosts` matches the **Host header** —
  a full URL with a scheme never matches and every request returns "Blocked request".
- `tsconfig.app.json` drops `baseUrl`. `paths` alone resolves `~/*` in TS 5.x+.

Both are uncommitted from the previous session. Decide whether they belong in a commit; do not
"clean" them away. Also untracked: `.claude/`, `.playwright-mcp/`, and two before-shots
(`mob-hero-before.jpeg`, `mob-about-before.jpeg`).

**Verification (run on `d20bd37`, measured this cycle, not copied from a report):**
`npm run typecheck` clean · `npm test` → **8 test files / 109 tests passing** · `npm run build`
succeeds · critical-path bundle **404.39 kB** (was 401.35; +3.04 kB is the ticker and the mobile
utility classes), three.js still split into a lazy **886.68 kB** chunk.
**Console:** clean apart from the dev-only `favicon.ico` 404 (there is no `public/favicon.ico`).
The three.js `Clock` deprecation notice earlier handoffs mention did not appear this cycle.

Denise Cacanando's artist portfolio: a single scroll page (Hero → About → four gallery scenes →
Contact) plus one routed detail page per piece. Vite 8 · React 19 · GSAP ScrollTrigger · Lenis ·
Tailwind 4 · react-three-fiber. No CMS — one typed data module per category.

**Design of record:** `README.md` (tokens, per-screen specs, interaction rules) and the static
mockups in `Ovalese Site - Pollen Dial.dc.html`. The mockups draw *frames* of a scroll experience;
the real thing is driven by the timeline. Do not port their markup.

**Specs and plans:** `docs/superpowers/specs/` and `docs/superpowers/plans/` — four cycles, all
complete. Their checkboxes were never ticked, so the plan files still *read* as unstarted. They are
not.

---

## The mobile layer is built — this cycle

The site had no mobile tier at all: every section hardcoded desktop geometry as **inline styles**,
which no CSS variant can override. Mobile is now the base style and desktop lives behind Tailwind's
`sm:` (640px). All ten tasks of `plans/2026-07-31-mobile-responsive.md` are done.

At **390 × 844** the only elements still crossing the viewport edge are the hero's cream circle and
its own placeholder label — the circle is *designed* to bleed off-edge (README §154) and the section
is `overflow-hidden`, so nothing scrolls and nothing is lost. That is down from **47** before the
work, and the four content defects the spec named are gone:

| Was | Now |
| --- | --- |
| Hero `<h1>` at x −227 → 303, rendering as "**nando**" | x 24 → 250, reads in full at 54px |
| Hero fragment cream-on-cream, invisible | ink `rgba(13,12,10,.78)` inside the circle |
| About portrait column at x 537 → 977, entirely off-screen | in flow, full width, between headline and copy |
| About content 910px in an 844px box | 763px against a 782px budget |

**Three things the plan did not foresee**, each caught in a browser and each now in the code:

1. **JSX drops the whitespace around a line-broken element.** About's and Contact's headlines break
   with `<br className="hidden sm:inline" />`; once those are `display: none` at mobile the words
   butt together — "I paint the hour**before something**closes", "Commissions,**walls**". The
   explicit `{' '}` on either side is load-bearing. **Any future `hidden` `<br>` needs the same.**
2. **About cannot show all five blocks at 360 × 640.** They need 763px against the 578px the ticker
   leaves. The portrait yields below 700px of height, recovering 270px and keeping every word of
   copy and all three stats. The query carries `max-width: 639px` so a short *desktop* window, where
   the portrait is a `flex-1` column costing nothing, is untouched — verified at 1440 × 640.
3. **The merch chips wrap into the snap list.** Four chips need 366px against the 342px a 390
   viewport leaves, and shrinking the type to fit would break the 8.5px floor. `SnapList`'s top is
   `50%` and knows nothing about how tall the title block is, so the wrapped row runs ~27px over the
   first card. The chips win — they are controls, the card is a placeholder — and carry an opaque
   cream ground to stay legible. **Provisional: no mocked frame shows a wrapped row.**

---

## The three defects that made the canvas invisible are fixed — the cycle before this one

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
| `src/scroll/scenes.ts` | Per-scene declarations + `LABELS`. Pure `piecesFor(scene, filter)` + live-reading `activePieces`. Owns `stopIndexFor`, shared by the rail and the ticker so their active stop cannot disagree. |
| `src/components/SideRail.tsx` | Desktop nav. `hidden … sm:block` — never visible at the same time as the ticker. |
| `src/components/BottomTicker.tsx` | **New.** The mobile nav, `sm:hidden`. Same four stops as the rail. Its progress line is driven by `--progress`, written every frame by the whole-document trigger — that is how a per-frame value legally reaches the DOM without entering React state (invariants 1 and 2). |
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
| `src/three/Butterflies.tsx` | One `instancedMesh` of rhombi, custom shader. Count comes from `Stage.tsx`'s `FULL_FLOCK` — never restate it here. Owns `activeWaypoints()` and the tuning table. |

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
10. **Every section clips to its own pane, with `clip` and not `hidden` — except Hero.** The grounds
    no longer mask a neighbour's overflow, and `hidden` would make the section a scroll container and
    desync the Murals track. **`Hero` is `overflow-hidden` and always has been**: `b5ea535` converted
    every other section and left it alone. Previous versions of this invariant said "every section",
    which described code that does not exist. Hero has no horizontally-translated track to desync, so
    the exception is harmless — but do not "fix" it as part of something else.
11. **The ground layer's blocks must tile the document end to end.** Each block spans one section's
    scroll range, taken from its pin-spacer where it has one. A gap shows as a strip of bare `body`.
12. **Mobile is the base style and desktop lives behind `sm:` — and layout tiers are CSS, never JS.**
    `useCompactLayout`'s 939px `matchMedia` flag feeds `resolvePresentation` only; reading it for
    *layout* would put a timeline teardown (`killTimeline` unpins four sections and rebuilds every
    trigger) behind a phone rotation. Nothing in the mobile layer reads it.
13. **Section geometry is utility classes, never inline `style`.** An inline style beats every `sm:`
    variant, so geometry expressed that way cannot respond at all — this was the single blocker that
    shaped the whole mobile diff. **Inline `style` remains correct for per-frame plumbing**: `--r`,
    `--at`, `--i`, and the transforms computed from them. The distinction is geometry vs. frame data,
    not inline vs. class.

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

**Playwright is not installed in this project.** There is no `playwright` dependency and no MCP
server for it in a plain session. What worked this cycle: `npx playwright` (it self-installs into the
npx cache) driven from a plain Node script, pointed at the Chromium already in
`%LOCALAPPDATA%\ms-playwright`. The npx build wanted `chromium-1232` and the machine had up to
`chromium-1228`, so pass `executablePath` at `chromium.launch` rather than downloading another
browser. Launch **headed** and `bringToFront()` before measuring.

**Three corrections to the mobile plan's own probes.** All three read as defects when they are not:

- **Probe C's label map is always empty.** It reads `t.vars.id`, and `createLabelTrigger` never sets
  an `id`. Key on the trigger *element* instead — for a section's `top top` label trigger, `start`
  **is** the label offset. **`contact` is the exception**: its trigger is `top 25%`, so its `start`
  is `offset − 0.25 × viewportHeight` (14535 at 1440 × 900, for a real offset of 14760). A `contact`
  reading of 14535 is correct, not the old 5400 defect returning.
- **Probe C and Probe B select `main > section`, which silently skips all four gallery scenes.**
  ScrollTrigger wraps each pinned scene in a pin-spacer, so they are no longer direct children of
  `main`. Use `section[id]`.
- **Probe B counts a wrapper's own `padding-bottom` as content.** About's inner column carries
  `pb-[86px]` *as* the ticker clearance, so Probe B reports `overflowsTicker: +67` at 390 × 844 where
  the last real content edge clears the ticker by 19px. Measure the last laid-out child, not the
  padding box, before believing an overflow.

Two more probe gotchas:

- Matching `/\d\d \/ \d\d/` against a scene's text finds a *dossier's* `WALL 01 / 07` metadata, not
  the progress row. Match the element whose entire text is `nn / nn`.
- **Dynamically importing a source module from the page gives you a second module instance after any
  HMR edit.** Vite serves the app `timeline.ts?t=<stamp>` once the file changes, so a bare
  `import('/src/scroll/timeline.ts')` gets a fresh copy with an empty label registry — which reads as
  "the fix broke label registration". `ScrollTrigger` itself is shared, so read ground truth from
  `ScrollTrigger.getAll()` instead of the module's own state.

## What's next

**The canvas now reaches a visitor, so the questions that were unanswerable are answerable.**

- **The 640–939 tablet band is broken, and it is pre-existing.** Between `sm:` (640) and the compact
  breakpoint, desktop layout applies at a viewport too narrow for it. At **640 × 844** About's
  portrait column sits at x **537 → 977** and Contact's form-slot note at x **613 → 680**; at
  **768 × 900** About's column alone still does. The cause is About's rigid `sm:[1fr_440px]` against
  `sm:pl-[118px] sm:pr-[72px]` and a 78px gap: 768 leaves 578px, of which the portrait and gap want
  518. **Measured identically on the pre-session code (`6ae749b`), so this cycle neither caused nor
  worsened it** — but note the spec claims otherwise. `specs/2026-07-31-mobile-responsive-design.md`
  §62 says "at 768 only About overflows, and this design fixes About's grid at that width too". It
  does not: the mobile work moved About's geometry into `sm:` variants at the *same values*. The fix
  is a flexible second column, or a third tier that holds 440px only at `lg`. Both change desktop's
  grid and must be re-verified against the baseline below.
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
- **The detail-page mobile layout is derived, not specced — re-check it first when Denise rules.**
  The mockup has no mobile detail frame and README §159 covers desktop only. The treatment (one
  column, 24px gutters, image well above the metadata, 34px title) follows the four mocked mobile
  screens and is provisional. The merch chip wrap (above) is provisional on the same terms.
- Detail-page media: zoomable artwork, orbitable ovoid, mural crop strip.
- **Nothing has reached `main`.** `finishing-a-development-branch` ran this cycle and merged
  `feat/mobile-responsive` into `feat/butterfly-flock`, but that branch has never been merged into
  `main` and there is still no remote. Three cycles of work sit on one unmerged branch — decide
  whether `main` should take it before a fourth stacks on top.

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

**These frames are void as an absolute reference.** Every one was captured at the then-current
`FULL_FLOCK = 1200` and `FULL_POLLEN = 4000`. Both counts have since been cut hard — see "The flock
and pollen counts were cut" below — so the density in these images is nothing like what the same
radius produces now. What survives is the *relationship*: larger radius, thinner residue, and the
rank order of the four. Re-shoot before judging an absolute.

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

### The flock and pollen counts were cut

**`FULL_POLLEN` 4000 → 500 and `FULL_FLOCK` 1200 → 30** (`Stage.tsx:7-8`), set by the user by hand
after seeing the canvas working for the first time. Treat as deliberate, alongside `RADIUS_WIDE`.

Two consequences, both of which will otherwise read as inconsistencies later:

- **This diverges from README §183–184**, which specify "~4k" pollen and "~1,200 instances", and the
  README is the design of record. The divergence is recorded here rather than silently reconciled;
  if the new counts stand, §183–184 want updating so the design of record stops disagreeing with
  the build.
- **Every density figure measured before this is a proportion, not an absolute.** The `RADIUS_WIDE`
  docstring's "~300–456 at R=13, ~110–145 at R=32" were counts out of 1,200, and the four-way
  comparison frames were shot at 1,200. At 30 instances the same radius leaves proportionally fewer
  marks in frame.

**The radius and the count are one decision.** A thinner residue can be reached from either end, so
tuning `RADIUS_WIDE` without fixing the count first — or vice versa — chases a moving target.

The `instancedMesh` architecture is count-independent: placement is four uniforms in the vertex
shader, so per-frame CPU cost is O(1) whether the flock is 30 or 1,200. Nothing about a smaller count
is a performance fix; it is purely a look decision.

### From the mobile cycle

**`display: contents` is how About reorders across a container boundary.** Mobile wants label →
headline → **portrait** → copy → stats, and the portrait lives in the desktop grid's *second column*.
At base the two wrapper divs are `contents`, which removes their boxes and promotes their children to
direct flex items of the outer column, where `order-*` sequences them; at `sm:` every wrapper takes
its box back and the layout is bit-for-bit the desktop one. The alternative — rewriting the desktop
grid — would have put "1440 unchanged" at risk for no gain. Verified working in About's real markup.

**The portrait is the block that yields on a short phone, and Denise chose it.** Offered against
shrinking the portrait while dropping the second copy paragraph, and against declaring 390 × 844 the
floor. Copy survives; the image does not, below 700px of height. See the mobile section above.

**The ticker's cream flip is driven by the same `ground` prop as the rail**, which `ScrollPage`
already computes. The two navs share `stopIndexFor` and are never both visible.

**Mobile drops nothing structural.** README §197 is a requirement, not a nice-to-have: every piece is
reachable at 390 × 844 and under reduced motion, verified by link count and by an actual tap-through.

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

**Confirmed on `d20bd37` — the mobile matrix.** Every viewport driven section by section, since a
section only lays out correctly once it is the one on screen. "Overflow" below is the last real
content edge against the ticker line; negative is clearance.

| Viewport | Probe A beyond the circle | Worst section overflow | Note |
| --- | --- | --- | --- |
| 360 × 640 | 0 | About **−43** | portrait hidden here; all copy + 3 stats survive |
| 390 × 844 | 0 | About **−19** | the mocked mobile frame; portrait shown |
| 414 × 896 | 0 | About **−71** | |
| 640 × 844 | About + Contact | About −47 | **pre-existing tablet-band failure — see What's next** |
| 768 × 900 | About | About −75 | same |
| 1440 × 900 | 0 | About −220 | design viewport, unchanged |

- Every gallery scene and Contact clear the ticker by exactly **24px** at all three phone widths.
- Hero's only "overflow" at every viewport is the cream circle, which bleeds off-edge by design
  inside `overflow-hidden`. At 360 × 640 that reads as 182px below the ticker line; nothing is lost.
- **The ticker flips at the label boundary, not before it**: at 390 × 844 the active stop is
  `01 Hero` through scrollY 844 and `02 About` from 845, with the bar flipping to cream at the same
  pixel. A screenshot taken at exactly the boundary offset looks like the flip failed. It has not.
- Ticker progress line travels monotonically: widths 0 → 59 → 63 → 67 → 89 → 118 across the document.
- Detail leaves at 390 × 844 (`/artworks/…`, `/ovalese/…`, `/murals/…`): **zero overflow on all
  three**, single column, image well above the metadata, title 34px, enquire button spanning the
  full 327px column at 43px tall, prev/next side by side without collision.
- At 390 × 844, tapping the centred g1 card opens `/artworks/floral-bouquet` and going back restores
  scroll to **exactly** the departure offset (1888 → 1888).
- Reduced motion at 390 × 844 and 1440 × 900: document collapses to **6300**, **zero pin-spacers**,
  all four scenes are snap lists, link counts **24 / 7 / 7 / 12** — every piece still reachable.
- rAF this cycle read 23–62 ticks / 500 ms across viewports in a headed Playwright Chromium. Take a
  reading; do not carry the threshold.

**Confirmed on `49da5c3`, and re-confirmed unchanged on `d20bd37`:**

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
- Sections refuse `scrollLeft` / `scrollTop`. **Spill at 1440 × 900 is not literally 0 everywhere**,
  and earlier versions of this line overstated it: Hero measures **+40 / +40**, which is the 980px
  circle centred in a 900px box and is the deliberate off-edge bleed. Every other section measures
  *negative* spill (content inside its box): about −140/−140, g1 −64/−50, g2 −64/−44, g3/g4 −64/−52,
  contact −237/−52. The claim that holds is "no section spills content it does not mean to".
- Murals: `--at` spans **0 → 3 → 6**; centred dossier **816** wide, neighbours **749.4 / 689.7 /
  630** — matching the older baseline exactly.
- Scroll restore exact from **3428, 9180 and 12371**, and survives a hard refresh.
- Reduced-motion frieze and the 920/960 breakpoints behave; compact drops `Butterflies` entirely and
  keeps pollen at 25%.
- Bundle: critical path now **404.39 kB** (was 401.35), lazy three chunk **886.68 kB** unchanged.
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
16. **A prescribed headline that reads "I paint the hourbefore somethingcloses" at mobile.** The
    mobile plan's own code for About and Contact hides the line-break `<br>`s with `hidden sm:inline`
    — and JSX drops the whitespace around a line-broken element, so the words joined. Invisible to
    every measurement in the plan (Probe A, Probe B and the order probe all passed); caught only by
    looking at a screenshot. **This is the fourth entry on this list that only a screenshot could
    catch** — see #3, #8, #12.
17. **A spec asserting a fix it did not contain.** `specs/2026-07-31-mobile-responsive-design.md` §62
    states "at 768 only About overflows, and this design fixes About's grid at that width too". The
    design moves About's geometry behind `sm:` at the *same values*, so 768 is bit-identical to
    before — measured on both the pre- and post-session trees. The tablet band is still broken.
18. **Three probes in the mobile plan that cannot report what they claim.** Probe C's label map reads
    a `vars.id` that is never set; Probe B and Probe C select `main > section`, which skips all four
    pinned scenes; Probe B counts a wrapper's bottom padding as content. Written into the plan and
    never run before it was committed. See "How to verify UI work here".

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

Untracked at the repo root and left alone this cycle: `.playwright-mcp/` (five console logs and five
page snapshots from the mobile cycle's earlier session) and `mob-hero-before.jpeg` /
`mob-about-before.jpeg`, the before-shots the mobile spec's defect table was written from. The
before-shots are worth keeping until Denise has signed off the mobile layer; the rest is disposable.

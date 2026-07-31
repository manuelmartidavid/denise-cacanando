# Ovalese — Project Handoff

**Read this first.** It is the single current-state document for the site. **Revise it in place;
never add a second one.** The filename is deliberately undated — the four dated handoffs that came
before it each invited a successor, and a stale sibling is worse than no document at all. Supersedes
`2026-07-31-ovalese-handoff.md`, which is deleted, not archived. Its history is in git.

Last revised **2026-08-01**, after the pollen frustum fix.

---

## State

**Everything is on `main`.** 82 commits, no branches, working tree clean of tracked changes. The last
*code* commit is **`c11100d`** (the pollen frustum fix); `HEAD` is the docs commit carrying this
file. A docs commit cannot cite its own hash — trust the code hash and `git log`, not a number here.
The predecessor said "80 commits" while sitting on the 81st; `git rev-list --count HEAD` is the
answer, and a count in a handoff is stale the moment the next commit lands.

Three cycles were merged this session, all fast-forward, no merge commits, no divergence: the
butterfly flock, the canvas-visibility fixes, and the mobile layer. `feat/butterfly-flock` and
`feat/mobile-responsive` are both deleted. The next piece of work branches from a `main` that is
actually current — the first time that has been true.

> ### ⚠ There is no git remote. Do this first.
>
> `git remote -v` is empty. **This machine holds the only copy of all 80 commits.** No push, no
> backup, no PR history. Everything below is worth less than fixing this.

**Verification, measured on `c11100d`, not copied from a report:** `npm run typecheck` clean ·
`npm test` → **8 test files / 109 tests passing** · `npm run build` succeeds · critical-path bundle
**404.75 kB**, CSS **35.47 kB**, three.js split into a lazy **886.87 kB** chunk. The three chunk grew
0.19 kB with the pollen fix; the critical path did not move. **CSS was never 35.33** — the figure
below it was already wrong, confirmed by building both with and without the fix. Console clean apart
from a dev-only `favicon.ico` 404 (there is no `public/favicon.ico`) and three.js's `Clock`
deprecation notice from the r3f stage.

**Untracked and deliberately kept:** `.claude/`, `.playwright-mcp/`, and `mob-hero-before.jpeg` /
`mob-about-before.jpeg` — the before-shots the mobile spec's defect table was written from. Worth
keeping until Denise signs off the mobile layer.

---

## What this is

Denise Cacanando's artist portfolio: a single scroll page (Hero → About → four gallery scenes →
Contact) plus one routed detail page per piece. Vite 8 · React 19 · GSAP ScrollTrigger · Lenis ·
Tailwind 4 · react-three-fiber. No CMS — one typed data module per category.

**Design of record:** `README.md` (tokens, per-screen specs, interaction rules) and the static
mockups in `Ovalese Site - Pollen Dial.dc.html`. The mockups draw *frames* of a scroll experience;
the real thing is driven by the timeline. **Do not port their markup.**

**Specs and plans:** `docs/superpowers/specs/` and `docs/superpowers/plans/` — four cycles, all
complete. Their checkboxes were never ticked, so the plan files still *read* as unstarted. They are
not. Treat their prescribed code as a draft, not as truth: see "Defects caught in prescribed code".

## Commands

```
npm run dev        # Vite on :5173 — SEE BELOW
npm test           # vitest run — 109 tests
npm run typecheck  # tsc -b --noEmit
npm run build      # tsc -b && vite build
```

**Port 5173 is Denise's.** Start your own elsewhere (`npm run dev -- --port 5180 --strictPort`) and
leave 5173 alone unless asked. Console errors once seen on 5173/5175 (`orbitSeats is not defined`,
`lazy is not defined`) were stale HMR state in a long-lived server, not defects in this tree.

`vite.config.ts` allows `.ngrok-free.dev` hosts so the site can be opened on a real phone through a
tunnel. `allowedHosts` matches the **Host header** — a bare hostname, never a URL with a scheme — and
the leading dot covers the rotating subdomain a free tunnel hands out.

---

## What's next

Ordered. The first item is the only one with real risk attached.

1. **Configure a git remote and push.** See the warning above.
2. **Two provisional mobile decisions await Denise's ruling.** Both shipped and both flagged in code:
   - **The detail-page mobile layout is derived, not specced.** The mockup has no mobile detail
     frame and README §159 covers desktop only. One column, 24px gutters, image well above the
     metadata, 34px title — inferred from the four mocked phone screens.
   - **The merch chip wrap**, where the wrapped second row crosses the first card by ~27px. No mocked
     frame shows a wrapped row.
3. **The r3f ripple/displacement shader on the centre slot.** The seam is built and documented in
   `CentreSlot.tsx` as a single `swapTo(piece)` function — but it would ripple placeholder stripes
   until real imagery lands.
4. **Between-scene "collapse to a seed" transition.** README §175 couples this to the flock; the
   flock's half is built, the ring's half is not, and it is a change to `timeline.ts`'s scene
   structure.
5. **Detail-page media:** zoomable artwork, orbitable ovoid, mural crop strip.

**Blocked on Denise, not on us:** all imagery, her copy (every slot is tagged `COPY SLOT` in the
mockups), and most detail-page media. `<Placeholder>` is scaffolding to **delete** when real files
land — it is not a loading state.

**Hers to set, not yours:** `RADIUS_WIDE` (`Butterflies.tsx:42`, still `32`), `FULL_FLOCK` (30) and
`FULL_POLLEN` (500) in `Stage.tsx:7-8`. Treat any value you find there as deliberate. See "The
RADIUS_WIDE comparison".

---

## Module map

| Module | Role |
| --- | --- |
| `src/data/*.ts` | One module per category. Counts confirmed 24 / 7 / 7 / 12; titles and dates are placeholders. |
| `src/lib/ring.ts` | Pure ring geometry. Seats + centre slot, `orbitSeats`, index/progress mapping. |
| `src/lib/track.ts` | Pure Murals track geometry — pitch, fractional wall index, bend contract, chapters. |
| `src/lib/snapList.ts` | Pure nearest-item search + centring gutter for the fallback list. |
| `src/scroll/scenes.ts` | Per-scene declarations + `LABELS`. Pure `piecesFor(scene, filter)` + live-reading `activePieces`. Owns `stopIndexFor`, shared by rail and ticker so their active stop cannot disagree. |
| `src/scroll/presentation.ts` | `resolvePresentation(declared, reduced, compact)` → what actually renders. |
| `src/scroll/timelineMath.ts` | Pure pin-length, scroll-mapping, snap-threshold helpers. |
| `src/scroll/timeline.ts` | **Sole owner of GSAP.** `createScrubScene` builds every pinned scene. Holds the label registry. **Build order is load-bearing — invariant 9.** |
| `src/scroll/store.ts` | Two channels: discrete `state` (publishes to React) and per-frame `frame` (never does). |
| `src/routes/ScrollPage.tsx` | The scroll page. Owns scroll save/restore. Mounts `GroundLayer` → `Stage` → `main`. |
| `src/routes/DetailPage.tsx` | One routed leaf per piece. Mobile treatment is **derived, not specced**. |
| `src/sections/GroundLayer.tsx` | Paints each section's ground in document space, behind the canvas. Measures pin-spacers; subscribes to `onTimelineRefresh`. |
| `src/sections/Hero.tsx` | 01. The one section that is `overflow-hidden`, not `clip` — invariant 10. |
| `src/sections/About.tsx` | 02. Four layout tiers; `display: contents` reordering — see below. |
| `src/sections/GalleryScene.tsx` | 03–06. One component, four configurations. Shared furniture; only the middle changes. |
| `src/sections/Contact.tsx` | 07. |
| `src/sections/ring/Dial.tsx` | Pinned rotating presentation (g1, g2, g4). |
| `src/sections/ring/SnapList.tsx` | Pin-free fallback. Category-generic — serves the track too. Its top is `50%` and it knows nothing about the title block's height. |
| `src/sections/ring/CentreSlot.tsx` | Focused piece + cross-fade. **The documented ripple seam.** |
| `src/sections/track/Track.tsx` | Murals row: track, chapter bar, annotation. |
| `src/sections/track/Dossier.tsx` | One wall: context plate + metadata + two detail crops. |
| `src/components/SideRail.tsx` | Desktop nav, `hidden … sm:block`. |
| `src/components/BottomTicker.tsx` | Mobile nav, `sm:hidden`. Same four stops. Progress line reads `--progress`, written every frame by the whole-document trigger — how a per-frame value legally reaches the DOM (invariants 1, 2). |
| `src/three/Stage.tsx` | r3f canvas at **`z-[1]`** — above the grounds, below `main`. Memoised and lazy-loaded. Owns `FULL_FLOCK` / `FULL_POLLEN`. |
| `src/three/Pollen.tsx` | Pollen points. Scatters across the camera's real frustum, read live from r3f's `viewport`, so it follows the aspect ratio. Owns `SLIDE_X`. |
| `src/three/flock.ts` | **Pure.** `flockAt`, `waypointsFrom`, `ATTRACTORS`. No three.js, no React, no `timeline` import. |
| `src/three/flock.test.ts` | 13 pure tests, node environment. |
| `src/three/Butterflies.tsx` | One `instancedMesh` of rhombi, custom shader. Count comes from `Stage.tsx` — never restate it here. Owns `activeWaypoints()` and the tuning table. |

---

## Invariants — do not break these

1. **The scrub value never enters React state; `activeIndex` never enters the frame loop.** Each
   frame reaches the DOM as one scalar via `onSceneFrame`, whose meaning belongs to the presentation:
   degrees written to `--r` by a dial, fractional wall index to `--at` by the track. `activeIndex`
   publishes only when the rounded index changes — never 60/s.
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
7. **Design tokens live in `src/styles/index.css` under `@theme`** — except scene geometry, which
   lives in `scenes.ts`, `look.ts`, `lib/track.ts` and `three/flock.ts` because the timeline and the
   motion rule compute with it. Hairlines are 1px. Mono labels are always uppercase and
   letter-spaced — put `uppercase` **on the element itself**, since a `<button>` does not inherit
   `text-transform`. Nothing drops below 8.5px (README §156). Every piece renders `<Placeholder>`.
8. **`THREE.Color` cannot parse `oklch`.** The stage converts tokens to hex by hand and names the
   token in a comment. `--color-ochre-bright` `oklch(0.8 0.09 62)` = `#e8b181`; `--color-sage`
   `oklch(0.68 0.11 150)` = `#63ab74`.
9. **`buildTimeline` builds in page order, top to bottom, and the whole-document trigger is last
   with `refreshPriority: -1`.** ScrollTrigger refreshes in creation order and applies pin spacing as
   it goes; anything created ahead of the pinned scenes measures a 6300px document. Adding a section
   means inserting it at its page position.
10. **Every section clips to its own pane, with `clip` and not `hidden` — except Hero.** `hidden`
    would make the section a scroll container and desync the Murals track. **`Hero` is
    `overflow-hidden` and always has been**; earlier handoffs said "every section", which described
    code that does not exist. The exception is harmless — but do not "fix" it in passing.
11. **The ground layer's blocks must tile the document end to end.** Each block spans one section's
    scroll range, taken from its pin-spacer where it has one. A gap shows as a strip of bare `body`.
12. **Mobile is the base style; desktop is reached through `sm:` → `lg:` → `xl:`; layout tiers are
    CSS, never JS.** Four tiers — see the table below. `useCompactLayout`'s 939px `matchMedia` flag
    feeds `resolvePresentation` **only**; reading it for layout would put a timeline teardown
    (`killTimeline` unpins four sections and rebuilds every trigger) behind a phone rotation.
    **A rigid track (`440px`) in a variant anchored at `sm` is the bug that cost most of one cycle**
    — it cannot shrink, so it overflows every width down to the breakpoint. Pin fixed geometry to the
    tier that actually has room for it.
13. **Section geometry is utility classes, never inline `style`.** An inline style beats every
    variant, so geometry expressed that way cannot respond at all — the single blocker that shaped
    the whole mobile diff. **Inline `style` remains correct for per-frame plumbing**: `--r`, `--at`,
    `--i` and the transforms computed from them. The distinction is geometry vs. frame data.

### The four layout tiers

| Tier | Range | About | Gutters |
| --- | --- | --- | --- |
| phone | `< 640` | one column, portrait in flow, bottom ticker | 24 |
| tablet | `sm` 640–1023 | one column, portrait in flow, side rail, 56px headline | 64 / 40 |
| small desktop | `lg` 1024–1279 | two columns, 320px portrait, one copy column | 80 / 48 |
| desktop | `xl` ≥ 1280 | **the design-viewport geometry** — 440px track, 78px gap, two copy columns, 74px headline | 118 / 72 |

`Contact` and `GalleryScene` follow the same gutter ladder so the three sections never disagree at
the same width. Contact's reserved form slot waits for `lg`, where the two-up row has room for it.

---

## How to verify UI work here

Invariant 6 means **the browser is the test** for anything visual. Every trap below has already cost
a cycle.

- **Drive the page as the active tab.** Lenis runs off a GSAP ticker on `requestAnimationFrame`; in
  an occluded or background tab rAF is throttled and nothing Lenis-driven moves. Call
  `bringToFront()` and **measure the tick rate before trusting anything**. Healthy readings vary by
  machine — cycles have measured 26–27, 61–62, and 23–62 ticks/500 ms. **Do not carry a threshold
  across machines**; take a reading, and if it is ~1, fix the focus before concluding anything.
  Scroll with `lenis.scrollTo` or real wheel input, **never `window.scrollTo`** — Lenis owns the
  scroll position.
- **A computed style is not what you see.** One cycle asserted `getComputedStyle().transform` and
  reported a clean ±8° bend while the planes rendered flat, because the parent lacked
  `transform-style: preserve-3d`. **Look at a screenshot, and press Tab.**
- **A framebuffer readback is not looking either.** An agent that could not screenshot used
  `gl.readPixels`, got exactly the right alpha and exactly the right ochre, and was structurally
  blind to the marks being the wrong *shape*.
- **Vary viewport height, not just width.** One regression — five sections spilling outside their
  boxes — was invisible because every check used 920/960/1440 widths at a single 900px height. Check
  at least one short viewport.
- **Section-by-section, not once per viewport.** A section only lays out correctly once it is the one
  on screen. Scroll to each label before probing it.

### Getting a browser

**Playwright is not a dependency of this project and there is no Playwright MCP server in a plain
session.** What works: `npx playwright` (it self-installs into the npx cache) driven from a plain
Node script, pointed at the Chromium already in `%LOCALAPPDATA%\ms-playwright`. The npx build wanted
`chromium-1232` while the machine had `chromium-1228`, so pass `executablePath` to `chromium.launch`
rather than downloading another browser. Launch **headed**, then `bringToFront()`.

Two things the app does not expose, both needed for probing, and both with a trap:

- **`ScrollTrigger`** is not on `window`. A bare `import('gsap/ScrollTrigger')` fails — a bare
  specifier does not resolve in the browser. Import the exact URL the app already loaded, version
  query and all, found via `performance.getEntriesByType('resource')`; a different query string
  fetches a second copy with an empty trigger list.
- **Lenis** is not on `window` either. `import('/src/scroll/useLenis.ts').getLenis()` works **only on
  a page not HMR-edited since load** — after an edit Vite serves a stamped URL and the fresh module's
  instance is `null`. Reload first and assert the instance came back non-null.

### Probe corrections — three in the mobile plan report defects that are not real

- **A label map keyed on `t.vars.id` is always empty.** `createLabelTrigger` never sets an `id`. Key
  on the trigger *element*: for a section's `top top` label trigger, `start` **is** the label offset.
  **`contact` is the exception** — its trigger is `top 25%`, so its `start` is
  `offset − 0.25 × viewportHeight` (14535 at 1440×900, for a real offset of 14760). A `contact`
  reading of 14535 is correct, not the old 5400 defect returning.
- **`main > section` silently skips all four gallery scenes.** ScrollTrigger wraps each pinned scene
  in a pin-spacer, so they are no longer direct children of `main`. Use `section[id]`.
- **A vertical-fit probe counts a wrapper's own `padding-bottom` as content.** About's inner column
  carries `pb-[86px]` *as* the ticker clearance, so a naive probe reports +67px of overflow at
  390×844 where the last real content edge clears the ticker by 19px. Measure the last laid-out
  child, not the padding box.

Two more:

- Matching `/\d\d \/ \d\d/` against a scene's text finds a *dossier's* `WALL 01 / 07` metadata, not
  the progress row. Match the element whose entire text is `nn / nn`.
- **Hero's cream circle always reads as viewport overflow.** It bleeds off-edge by design inside
  `overflow-hidden` (left −120 at mobile, −250 at desktop). Two entries — the circle and its own
  placeholder label — are the clean baseline, not a defect.

---

## Decisions already ruled on — do not re-open

### Set by Denise, by hand

**`FULL_POLLEN` 4000 → 500 and `FULL_FLOCK` 1200 → 30** (`Stage.tsx:7-8`), after seeing the canvas
working for the first time. README §183–184 have been updated to match. **The radius and the count
are one decision** — tuning `RADIUS_WIDE` without fixing the count, or vice versa, chases a moving
target. The `instancedMesh` architecture is count-independent (placement is four vertex-shader
uniforms, so per-frame CPU cost is O(1) at 30 or 1,200); a smaller count is **purely a look
decision**, never a performance fix.

**Every density figure measured before that cut is a proportion, not an absolute.**

### From the mobile cycle

**`display: contents` is how About reorders across a container boundary.** Mobile wants label →
headline → **portrait** → copy → stats, and the portrait lives in the desktop grid's *second column*.
Below `lg` the two wrapper divs are `contents`, which removes their boxes and promotes their children
to direct flex items of the outer column where `order-*` sequences them; at `lg` every wrapper takes
its box back. The alternative — rewriting the desktop grid — would have risked "1440 unchanged" for
no gain.

**The portrait is the block that yields when the column is short of room, and Denise chose it** —
over shrinking it while dropping the second copy paragraph, and over declaring 390×844 the floor.
Below `lg` it takes `min(320px, 30vh)` and disappears entirely under 700px of height, capped at
`max-width: 1023px` so it only ever applies while the portrait is in the flow.

**JSX drops the whitespace around a line-broken element.** About's and Contact's headlines break with
`<br className="hidden lg:inline" />`; once those are `display: none` the words butt together —
"I paint the hour**before something**closes", "Commissions,**walls**". The explicit `{' '}` on either
side is **load-bearing**. **Any future `hidden` `<br>` needs the same.**

**The merch chips win their overlap with the snap list.** Four chips need 366px against the 342px a
390 viewport leaves, and shrinking the type would break the 8.5px floor, so they wrap; `SnapList`'s
top is `50%` and knows nothing about the title block's height, so the second row runs ~27px over the
first card. Chips are controls, the card is a placeholder — they carry an opaque cream ground to stay
legible. **Provisional.**

**The ticker's cream flip is driven by the same `ground` prop as the rail.** The two navs share
`stopIndexFor` and are never both visible.

**Mobile drops nothing structural.** README §197 is a requirement, not a nice-to-have.

### From the canvas-visibility cycle

**The ground lives in `GroundLayer`, in document space** — not on the sections, and not in one fixed
element. The obvious alternative (one fixed full-screen ground driven by the active label) is wrong
at the ink/cream boundaries: the label only flips once the incoming section reaches the top of the
viewport, so Merchandise's cream content would spend a whole viewport on Murals' ink. Document-space
blocks make the boundary slide exactly as an opaque section background did.

**`Stage` is `z-[1]`, not `z-0`.** The stack is ground `z-0` → canvas `z-1` → `main` `z-10`.

### From the butterfly flock cycle

**No GSAP MotionPath.** README §175 names it as the flock's driver; the spec deliberately rejected it
— it would cost a plugin in the critical-path bundle and add a second writer to the `frame` channel.

**`frame.attractor` was deleted, not filled in.** The flock runs r3f-reads-progress, so the field
would only ever publish a permanent zero that reads as live state.

**`activeWaypoints()` lives in `Butterflies.tsx`, not `flock.ts`** — `flock.ts` is imported by a
node-environment test and must not reach `timeline.ts` even transitively (invariant 2).

**Wing geometry is two triangles apexed at `y = 0`, not two quads. Do not "simplify" it back.** The
only rotation is about `y`, which scales `x` by `cos(flap)` and never touches `y` — so a quad with
corners `(±1, ±0.6)` is an **axis-aligned rectangle at every flap value** and can never read as
README §227's rotated square. Both the original spec and plan prescribed the quads.

### From the pollen fix

**The scatter box is read from the camera, never hardcoded.** r3f's `viewport` reports the visible
extent in world units at the `z = 0` plane, so the field follows the aspect ratio instead of assuming
one. **Do not replace it with a constant** — a constant is what was wrong, and it is wrong at a
different amount at every width.

**Each particle spreads across the frustum at its own `z`, not a shared slice.** The frustum is a
pyramid; a single slice leaves the near and far edges unevenly covered.

**A resize re-scatters the field, and that is deliberate.** It is the only way the width can follow a
new aspect, and a reshuffle of faint additive dots behind the page costs less than carrying
normalised coordinates through the drift. If it ever *does* read as a pop — the realistic case is a
phone's URL bar collapsing mid-scroll — the fix is normalised coordinates, not a frozen box.

**`SLIDE_X` is one constant used twice**: it sizes the extra material on the right *and* drives the
leftward slide. The old 22-wide box absorbed the slide by accident; a frustum-sized one does not, so
splitting them back into two numbers empties the right edge at the end of the document.

### Carried forward

**`refreshTimeline()` is not a no-op. Do not remove it.** The refresh drives an `onUpdate`, and that
is the only thing recomputing the ring's rotation for a newly filtered count. Measured with it
removed: seats re-render 6 → 4 correctly while `--r` stays frozen at 300.10° for over a second where
109.13° is right.

**Scroll restore needs all three of these.** Each was hiding the next:

1. The offset is written through on **every scroll**, and deliberately **not** again on cleanup.
   Teardown is too late to read `scrollY`: `killTimeline()` unpins four sections and collapses the
   document first, and a save there overwrote a correct offset with the clamped one (3428 → 388).
2. The restore waits for `refreshAfterFonts`' callback, **not** a bare `rAF`. Creating a pinned
   trigger does not lay out its pin spacer; only the refresh does.
3. `lenis.resize()` runs before the `scrollTo`. Lenis caches its scroll limit and recomputes only
   from an async ResizeObserver.

The `sessionStorage` read also happens at effect setup, *before* the listener is attached.

**Geometry deliberately is not in `index.css`.** Seventeen tokens mirroring the scene numbers sat
there referenced by nothing and were deleted rather than wired up: the timeline computes with these
values, which CSS cannot do.

**`scrub: 1` was removed from the scrub triggers; do not re-add it.** Removing it flips
ScrollTrigger's internal `isToggle`, so this is *empirically equivalent, not provably inert*. Tested:
merch chip clicked mid-pin, scroll unchanged at y=10424, `--r` moved 300.10° → 109.13° within 16ms.

**Keyboard focus on the track uses `:focus-visible`, not a pointer flag.** A `pointerdown` flag
latches — a click on the row's gutter focuses nothing, so the flag survives and swallows the next
genuine Tab.

**Kept deliberately despite zero consumers:** `src/scroll/usePresentation.ts` and `sceneCount` in
`scenes.ts`. `RING_LOOK.murals` is a type-required zero row, not an orphan.

**Cream-ground dial chrome** uses `border-ink/25` uniformly rather than a 12/25 staircase.

---

## Known-good measurements

A regression baseline. Confirmed in a real browser at 1440×900 unless marked, on `5e95ecc`.

### Responsive matrix

| Viewport | Overflow beyond the hero circle | Worst section fit | Note |
| --- | --- | --- | --- |
| 360 × 640 | 0 | About **−43** | portrait hidden; all copy + 3 stats survive |
| 390 × 844 | 0 | About **−19** | the mocked mobile frame; portrait shown |
| 414 × 896 | 0 | About **−71** | |
| 640 × 844 | 0 | About **−23** | tablet tier; portrait at 30vh |
| 768 × 900 | 0 | About **−111** | tablet tier |
| 1440 × 900 | 0 | About **−220** | design viewport |

Negative is clearance. **Widths swept clean for horizontal overflow: 640, 768, 900, 1024, 1100, 1280,
1440.** Nothing overflows its 100vh clip at 640×844, 640×640, 768×900, 820×1180, 1024×768, 1024×900,
1100×900, 1280×900 or 1440×900.

- Every gallery scene and Contact clear the ticker by exactly **24px** at all three phone widths.
- **The ticker flips at the label boundary, not before it**: at 390×844 the active stop is `01 Hero`
  through scrollY 844 and `02 About` from 845, the bar flipping to cream at the same pixel. **A
  screenshot taken at exactly the boundary offset looks like the flip failed. It has not.**
- Ticker progress line travels monotonically: widths 0 → 59 → 63 → 67 → 89 → 118 across the document.
- Detail leaves at 390×844 (`/artworks/…`, `/ovalese/…`, `/murals/…`): **zero overflow on all three**,
  single column, image well above the metadata, title 34px, enquire button spanning the full 327px
  column at 43px tall, prev/next side by side without collision.
- At 390×844, tapping the centred g1 card opens `/artworks/floral-bouquet`; going back restores
  scroll to **exactly** the departure offset (1888 → 1888).
- Reduced motion at 390×844 and 1440×900: document collapses to **6300**, **zero pin-spacers**, all
  four scenes are snap lists, link counts **24 / 7 / 7 / 12** — every piece still reachable.

### Timeline and canvas

- Document is **17.4 viewports (`scrollHeight` 15660)**; `maxScroll` = **14760**.
- **Label offsets: `hero 0 · about 900 · g1 1800 · g2 5580 · g3 8460 · g4 11520 · contact 14760`.**
  (`contact`'s *trigger start* reads 14535 — see probe corrections.)
- The whole-document trigger ends at **14760**; `frame.progress` tracks `scrollY / 14760` exactly:
  250 → 0.0170, 3321 → 0.2250, 5400 → 0.3659, 8144 → 0.5518, 12006 → 0.8134, 14760 → 1.
- **The rail's Contact diamond lands at 14760** with Contact's top at viewport top.
- Flock waypoints are monotonic: `at` = `[0, 0.061, 0.122, 0.378, 0.573, 0.780, 1.0]`.
- Ground blocks tile **0 → 15660** exactly, boundaries at every label offset. Also tile at 920, 960,
  1024×640 and 1280×800.
- The ink/cream seam slides: at scrollY 11100 the boundary sits at **420px**, matching g4's viewport
  top.
- Sections refuse `scrollLeft` / `scrollTop`. **Spill at 1440×900 is not literally 0 everywhere** —
  Hero measures **+40 / +40**, the 980px circle centred in a 900px box, deliberate. Every other
  section is *negative*: about −140/−140, g1 −64/−50, g2 −64/−44, g3/g4 −64/−52, contact −237/−52.
  The claim that holds is "no section spills content it does not mean to".
- Murals: `--at` spans **0 → 3 → 6**; centred dossier **816** wide, neighbours **749.4 / 689.7 / 630**.
- Scroll restore exact from **3428, 9180 and 12371**, and survives a hard refresh.
- Bundle: critical path **404.75 kB**, CSS **35.33 kB**, lazy three chunk **886.68 kB**.
- At **1280×800**: `hero 0 · about 800 · g1 1600 · g2 4960 · g3 7520 · g4 10240 · contact 13120`,
  maxScroll 13120. Recorded because the flock comparison was shot there.

### Older baseline, still believed good

- Artworks counter climbs `01 / 24` → `24 / 24`, reaching 24/24 while still pinned.
- Idle snap overshoots, then pulls *backwards* onto the stop and holds. The residual is integer-scroll
  quantisation — stop 20 sits at 4304.35 and the browser can only rest on 4304.
- The snap never fires mid-gesture: 14 wheel events at 70ms intervals, strictly monotonic.
- A thumb click rotates that piece to centre without navigating. Chapter jump moves `--at` 4→0
  without navigating.
- Merch chips re-bloom: jackets → 4 thumbs at exactly 90° gaps; earrings → 0 thumbs, centre only,
  `01 / 01`.

---

## The RADIUS_WIDE comparison

`RADIUS_WIDE` scales **only the dispersed state**. `flock.ts`'s `gather` is `sin(pi * t)` across each
leg, so it is exactly 0 at every waypoint and 1 mid-leg, where the spread is `RADIUS_TIGHT` (3.5)
instead. **The dense migrating cloud between scenes is identical at every candidate value** — only
the resting state differs, which is the state a visitor spends their reading time in.

A screenshot at scrollY 12100 once looked heavily speckled and was described as the flock crowding
the content; that position is mid-leg at `gather` ≈ 0.95, i.e. the migrating cloud working as
designed. At rest, `R = 32` is already fairly restrained.

**The captured frames are void as an absolute reference** — every one was shot at the old
`FULL_FLOCK = 1200` / `FULL_POLLEN = 4000`. What survives is the *relationship*: larger radius,
thinner residue, and the rank order. Captured at 1280×800 at exact label offsets (`gather` = 0):

- **32** — current. Deliberate texture on ink; a light speckle on cream.
- **52** — fine dust; marks legible on both grounds. The most likely improvement if a thinner residue
  is wanted.
- **76** — sparse. · **110** — near-bare; the flock effectively disappears on cream.

Durable side-by-side: **https://claude.ai/code/artifact/adb62663-51f2-44e6-bd90-62cf2fc94529**
(the source frames lived in a session scratchpad and are gone).

**To re-shoot:** edit the constant, reload (it is baked into the vertex shader as a literal), and
capture at the two label offsets **for the viewport in use** — read them from `ScrollTrigger.getAll()`
rather than reusing numbers, and confirm the page landed exactly on them. A few px off a waypoint is
no longer `gather = 0` and the comparison stops being like-for-like.

---

## Defects caught in prescribed code

Kept because it calibrates how much to trust a written spec here — **including specs and plans
written in this repo by previous cycles.**

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
10. **A plan that mandated code its own verification step names as the failure signature.** The flock
    plan's Step 5 read "if the marks render as perfect rectangles rather than diamonds, the wing
    rotation is wrong" — while the plan's own code block *guaranteed* rectangles.
11. **A test that could not fail.** A review asked for a test pinning the `span > 0` guard and
    supplied a waypoint list that can never reach the negative-span segment.
12. **A framebuffer readback substituted for looking.**
13. **Two handoffs stating that pollen was shipped and working.** It had never been visible to
    anyone — the canvas was occluded from the moment it was added.
14. **A fix whose verification pass had a shape-shaped hole in it.** Verified across 920/960/1440
    *widths* at a single 900px *height*, and shipped a regression only visible at short viewports.
15. **A handoff claiming `.claude/worktrees/gallery-ring-timeline/` "still contains nothing".** It
    contains six PNGs and a `.playwright-mcp` directory. Written twice without being checked.
16. **A prescribed headline reading "I paint the hourbefore somethingcloses" at mobile.** The mobile
    plan's own code hid the line-break `<br>`s, and JSX drops the whitespace around them. Invisible
    to every measurement in the plan; caught only by looking at a screenshot. **The fourth entry here
    that only a screenshot could catch** — see #3, #8, #12.
17. **A spec asserting a fix it did not contain.** The mobile spec §62 claimed "this design fixes
    About's grid at 768 too". It moved the geometry behind `sm:` at the *same values*, so 768 stayed
    bit-identical — measured on both trees. Fixed afterwards by the `lg`/`xl` tiers. **A spec claiming
    a defect "falls out" of a change is a claim to measure, not to believe.**
18. **Three probes in the mobile plan that cannot report what they claim.** See "Probe corrections".
    Written into the plan and never run before it was committed.
19. **Two numbers in the immediately preceding handoff that no build produces.** CSS was recorded as
    **35.33 kB** where it builds at **35.47**, and the commit count as **80** while `HEAD` sat on the
    81st. Caught by building the tree twice — with and without the pollen change — rather than
    assuming a moved figure was the change's fault. **A figure in this file is only worth what the
    command that produced it is**; the CSS one was carried across revisions unmeasured.
20. **A comment's arithmetic that never matched its own inputs.** `Butterflies.tsx` derived its 0.62
    squash from a frustum "13.1 wide", where `2 · 10 · tan(22.5°) · 1.6` is **13.255**. The constant
    0.62 was right the whole time — 8.28 / 13.3 — so nothing rendered wrong, and the wrong width sat
    there through every cycle that cited the docstring as the authority on the frustum.

## Open minor findings

Reviewed, judged non-blocking, deliberately not fixed.

- **`flock.ts:127`'s length guard** (`offsets.length !== LABELS.length`) also rejects arrays *longer*
  than 7, which the doc comment does not say. No functional risk — the sole caller passes exactly 7.
- **`Butterflies.tsx`'s `useFrame` reads `document.documentElement.scrollHeight` every frame**, which
  forces layout, unconditionally. A deliberate tradeoff, commented in the code.
- **`flockAt`'s `span > 0` ternary is unreachable**; the early-return clamps are what bound the
  function. Proven by a 2,000,000-trial fuzz and a 500,000-trial re-run, both finding zero
  counterexamples. **Do not delete it** — it is cheap and documents the invariant — but do not
  believe it is load-bearing either.
- **`GroundLayer` re-measures on a rAF after mount**, because child effects run before the parent's
  `buildTimeline`. Harmless — the page is at scroll 0 and hero's block is correct either way.
- **`w-rail` in `SideRail.tsx` has no `--width-rail` token behind it**, so Tailwind emits nothing and
  the rail is content-sized (roughly x 30–50). Band gutters were chosen to clear that measured
  extent, not the class.

## Housekeeping

`.claude/worktrees/gallery-ring-timeline/` is registered to no worktree (`git worktree list` shows
only the main checkout) but is **not empty** — six PNGs and a `.playwright-mcp` directory left by the
flock cycle. Safe to delete.

`.superpowers/` is git-ignored scratch and is expected to be deleted.

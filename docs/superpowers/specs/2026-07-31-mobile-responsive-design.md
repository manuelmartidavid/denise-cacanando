# Mobile responsiveness — design

**Status:** approved, not yet implemented.
**Design of record:** `README.md` §79, §150–157 and the four 390 × 844 frames under
`data-screen-label="08 Mobile"` in `Ovalese Site - Pollen Dial.dc.html`.

---

## The problem, measured

The site was built against a single 1440 × 900 design viewport. This is not a defect in a
responsive layer; there is no responsive layer.

- **Zero** `sm:` / `md:` / `lg:` utilities exist anywhere in `src/`.
- Every section hardcodes desktop geometry as **inline styles** — `paddingLeft: 118`,
  `paddingRight: 72`, `right: 72`, `top: 104`, `gridTemplateColumns: '1fr 440px'`, `gap: 78`.
- Every type token in `index.css` is a fixed px size.
- `--text-hero-m` (54px), `--text-stat-m` (24px) and `--text-body-m` (13px) are defined and
  **referenced by nothing**. The mobile type scale was tokenised and never wired up.
- `useCompactLayout()` (max-width 939px) is the only width-aware code. It swaps the
  *presentation* (dial → snap list) and thins the canvas. It never touches layout or type.
  Its own docstring claims "the rail becomes the bottom ticker" — that was never built.

Measured in a real browser at 390 × 844 on `322ddde`, rAF healthy at 61 ticks/500 ms:

| Symptom | Measurement |
| --- | --- |
| Elements overflowing the viewport | **47** (excluding legitimate `overflow-x-auto` scrollers) |
| About portrait column | x **537 → 977**, entirely off-screen on a 375px content box |
| About `2015 / First show` stat | x **408 → 459**, off-screen |
| Hero `<h1>` | x **−227 → 303** — renders as "**nando**" |
| Hero fragment | cream on cream, invisible — the exact trap README §154 names |
| About content height | **910px** in an 844px `overflow-clip` box, so it clips vertically too |

At 640 width: hero, about and contact overflow. At 768: only About (its rigid 440px column).
Below ~1000px About is the structural failure at every width.

**Root cause:** desktop pixel geometry expressed as inline styles, which no CSS variant can
override, plus a type scale with no mobile tier wired up.

---

## Tiers

Two, and only the first is new.

| Tier | Range | Owns |
| --- | --- | --- |
| **mobile** | `< 640px` (Tailwind base) | layout, type, gutters, ticker |
| **desktop** | `≥ 640px` (Tailwind `sm:`) | today's geometry, unchanged |
| **compact** *(existing)* | `≤ 939px`, JS `matchMedia` | presentation swap + canvas thinning **only** |

640px is Tailwind's default `sm` breakpoint, so no custom breakpoint is registered. Mobile is the
base style and desktop values move behind `sm:`.

**Layout tiers are CSS, never JS.** `compact` feeds `resolvePresentation`, and changing it re-runs
`buildTimeline` / `killTimeline` — tearing down four pins and every ScrollTrigger. Layout does not
need that, and a phone rotating should not rebuild the timeline. `useCompactLayout` is therefore
left exactly as it is; nothing in this work reads it for layout.

Between 640 and 939 the page keeps desktop layout and gets the snap-list presentation, which is
what a tablet wants. Verified: at 768 only About overflows, and this design fixes About's grid at
that width too.

---

## The blocker that shapes the diff

**Inline styles beat every utility class**, so no `sm:` variant can override
`style={{ paddingLeft: 118 }}`. Each section's geometry must move from inline styles to utility
classes before it can respond at all.

This is the bulk of the change and it is mechanical, not clever. Arbitrary values
(`sm:pl-[118px]`) match how the repo already writes `left-[30px]` and `max-w-[360px]`.

Inline styles that are *not* geometry — the `--r` / `--at` / `--i` custom properties, and
`transform` strings computed from them — stay inline. They are per-frame plumbing, not layout.

---

## Type scale

Wire the three orphans, and add the mockup's mobile sizes that have no token at all. All go in
`@theme` in `src/styles/index.css` alongside their desktop counterparts (invariant 7: type is a
token, scene *geometry* is not).

| Token | Value | Role | State |
| --- | --- | --- | --- |
| `--text-hero-m` | 54px / 0.92 | hero name | exists, wire it |
| `--text-stat-m` | 24px / 1 | stat number | exists, wire it |
| `--text-body-m` | 13px / 1.7 | body copy | exists, wire it |
| `--text-about-m` | 40px / 1.04 | About headline | **new** |
| `--text-scene-m` | 44px / 1 | gallery scene title | **new** |
| `--text-contact-m` | 46px / 1 | Contact headline | **new** |
| `--text-enquire-m` | 21px / 1.3 | Contact links | **new** |
| `--text-fragment-m` | 17px / 1.45 | hero fragment | **new** |

Nothing drops below 8.5px (README §156). Mono apparatus keeps `uppercase` on the element itself —
a `<button>` does not inherit `text-transform` (invariant 7, defect #7).

---

## Per-section behaviour

Gutters are **24px** at mobile (README §79) against desktop's 118/72. Every section keeps its
`h-screen` box and its existing clipping mode — see Constraints.

### Hero
- Name 54px at `left 24 / top 110`; right-alignment and `mix-blend-difference` drop at mobile.
- Cream circle **480px at `left −120 / top 280`** (desktop: 980px at `left −250`).
- Tagline 8.5px `.22em` at `top 240`, reading `FLOWERS · BUTTERFLIES · WALLS`.
- **The fragment moves inside the circle and flips to ink `rgba(13,12,10,.78)`.** Cream-on-cream is
  the named trap in README §154 and is currently the live bug. It carries its own
  `COPY SLOT — DENISE TO WRITE` label in ochre-deep, as mocked.
- The bottom meta block (`Manila, PH — Oil · …` / `Scroll ↓`) hides at mobile; the ticker occupies
  that band and the mockup omits it.

### About — the section that prompted this work
Single column at `left/right 24, top 74`, in mockup order:

1. `ABOUT — 02 / 04` label (the `B. 1994, Manila` counterpart hides at mobile).
2. Headline 40px.
3. **Portrait, 250px tall, full width** — moved out of the second grid column and into the flow.
4. Body copy, single column, 13px/1.7.
5. Stat row: **three** stats, `PIECES / EGGS / WALLS`, numbers 24px. `First show / 2015` hides at
   mobile per README §155 and the mocked frame.

The `Fig. 02 / Parallax 0.9×` caption hides at mobile.

Counts stay derived from the data (invariant 4) — hiding the fourth stat is a CSS concern, so
`STATS` keeps all four entries and the mobile-hidden one is marked in the array, never spliced.

### Gallery scenes ×4
- Title block at `left 24 / top 70`; scene title 44px.
- The top-right category list **hides at mobile** — it collides with the title block.
- Count and hint stay under the title (`07 PAINTED OSTRICH EGGS` / `SWIPE OR SCROLL`).
- The snap list already works; its gutter comes from `snapListGutter()` and is untouched.
- Merch filter chips wrap at mobile rather than overflowing.
- The progress row clears the 62px ticker.

### Contact
- Headline 46px at `top 96`.
- The two links **stack vertically**, `gap 26`, each with an `EMAIL` / `INSTAGRAM` label above it,
   21px, keeping the 1px bottom border and its ochre-bright hover.
- The reserved form-slot note hides at mobile (mocked frame omits it).
- Footer sits above the ticker, reading `© DENISE CACANANDO 2026 — MANILA, PH`.

### Rail → bottom ticker
`SideRail` hides below `sm`. A new `src/components/BottomTicker.tsx` takes over:

- 62px bar, `rgba(13,12,10,.72)` + `backdrop-filter: blur(6px)`, 1px top hairline.
- Four labels `01 HERO / 02 ABOUT / 03 GALLERY / 04 CONTACT`, mono 9px `.14em`, active in
  ochre-bright.
- **Flips to cream** (`rgba(242,236,225,.82)`, ink text, ochre-deep active) on About and
  Merchandise, driven by the `ground` prop `ScrollPage` already computes for the rail.
- Stops, active-index logic and `scrollToLabel` are **shared with `SideRail`**, not duplicated.
  `stopIndexFor` moves next to `RAIL_STOPS` so both consume one definition.

**The progress line** is the only piece touching invariant 1. It needs whole-document progress,
which is a per-frame value that must not enter React state. The seam already exists: the
whole-document trigger's `onUpdate` sets `frame.progress`. It gains one line writing `--progress`
to `documentElement`, and the line is `width: calc(var(--progress) * 100%)` — pure CSS, no React,
GSAP still confined to `timeline.ts` (invariant 2).

### Detail pages — derived, not specced
The mockup has **no mobile detail frame**; README §159 specs desktop only. This treatment is
derived from the four mocked mobile screens and should be treated as provisional — Denise may
correct it.

Single column at 24px gutters: image well on top, then category/year label, title, metadata table,
copy slot, then the full-width `ENQUIRE ABOUT THIS PIECE` button and the prev/next row. The top
bar's back link and `nn / nn` counter stack if they collide.

---

## Constraints this work must not break

1. **Sections stay `h-screen` with `overflow-clip` on both axes.** Letting About grow on mobile
   would change its pin-spacer, and GroundLayer measures pin-spacers to tile the document —
   invariants 9, 10 and 11 all depend on the current section box. The mobile type scale is what
   makes the content fit, not a taller section.
2. **`clip`, never `hidden`** (invariant 10). `hidden` reintroduces a scroll container and desyncs
   the Murals track.

   Noted while reading: **Hero is still `overflow-hidden`**, not `overflow-clip`. Invariant 10 says
   "every section", but `b5ea535` only converted About, Contact and `GalleryScene` — Hero was
   already `hidden` and masking its own spill, so it was left alone. Pre-existing and out of scope
   here; flagged so the next reader does not take the invariant as describing the code. Do not
   "fix" it as part of this work.
3. **Counts and offsets stay derived** (invariant 4). No mobile layout embeds a known-good number.
4. **GSAP stays in `timeline.ts`** (invariant 2). The ticker reads a CSS variable, never GSAP.
5. **The frame channel never publishes to React** (invariant 1). The progress line is CSS.
6. **`RADIUS_WIDE`, `FULL_FLOCK` and `FULL_POLLEN` are the user's** — out of scope, not touched.
7. Desktop at 1440 × 900 must be **byte-for-byte unchanged in behaviour**: seven label offsets,
   `scrollHeight` 15660, ground tiling 0 → 15660, 0 spill per section.

---

## Verification

Invariant 6 makes Vitest node-only and pure-function-only; **do not add jsdom or component tests.**
The browser is the test for everything visual, driven by Playwright as the frontmost tab with the
rAF tick rate read before trusting any measurement (a reading of ~1 means fix focus first).

Pure additions get pure tests: if the shared ticker/rail stop logic is extracted as a function, it
is tested in `src/**/*.test.ts` like `ring.ts` and `track.ts` are.

**Must pass:**

- Overflow probe returns **0 elements** past the viewport at 360 × 640, 390 × 844 and 414 × 896,
  excluding real `overflow-x-auto` scrollers.
- Content fits vertically inside `100vh − 62px` at each of those, **including the 640px-tall floor**
  — defect #14 was a fix verified at one viewport height that shipped a short-viewport regression.
- Hero fragment is **ink on cream and legible** — confirmed on a screenshot, not a computed style
  (defect #8, #12).
- Ticker: correct active stop per section, cream flip on About and Merchandise, progress line
  tracking `--progress` 0 → 1 across the document.
- Every piece still reachable: snap-list tap → detail route → back restores scroll.
- **1440 × 900 regression baseline intact** — seven label offsets `hero 0 · about 900 · g1 1800 ·
  g2 5580 · g3 8460 · g4 11520 · contact 14760`, `scrollHeight` 15660, ground blocks tiling
  0 → 15660, 0 spill per section.
- `npm run typecheck` clean, `npm test` 106 passing (plus any new pure tests), `npm run build`
  succeeds, console clean apart from the known three.js `Clock` notice and the dev favicon 404.

---

## Out of scope

Per-line text reveal and portrait parallax (About), the ripple shader, the collapse-to-a-seed
transition, and real imagery — all blocked on Denise or tracked separately in the handoff.

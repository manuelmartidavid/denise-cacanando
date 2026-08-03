# Handoff: Ovalese — Denise Cacanando artist portfolio

## Overview
A single-page scroll site for Denise Cacanando (paintings, murals, and *Ovalese* — her series of painted ostrich eggs), plus one routed detail page per piece. The chosen concept is **"Pollen Dial"**: a scroll-driven radial gallery where **a rotating ring browses pieces within a category**, and **an instanced butterfly flock carries the viewer between categories**. Non-standard layout by intent — no conventional header nav, no card grid.

Sections in scroll order: Hero → About → Gallery (Artworks · Ovalese · Murals · Merchandise, four pinned scenes) → Contact. Every piece links to its own route.

Stack the client is building in: **Vite + React 19 + GSAP (ScrollTrigger) + react-three-fiber**. No CMS.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that communicate intended look, layout, and behavior. They are **not production code to copy**. The task is to recreate these designs in the target codebase using its own environment, patterns, and libraries (here: Vite + React 19 + GSAP + r3f). Do not port the mockup markup; rebuild it as components.

In particular: the mockups render **static frames** of a scroll experience. Rings, flocks, and parallax are drawn as fixed snapshots so the intent is legible. The real implementation drives them from a scroll timeline (spec below).

Every image in the mockups is a **diagonally-striped placeholder with a monospace label** describing what belongs there. All real imagery is still outstanding.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and layout are final and should be matched closely. Two caveats:
- **Copy is not final.** Every poetic fragment is tagged `COPY SLOT — DENISE TO WRITE` in the mockups; the text present is a length-and-tone guide only. Metadata labels (MEDIUM, SIZE, YEAR, STATUS) *are* final.
- Piece **counts are confirmed** (24 / 7 / 7 / 12) but titles, mural names, dimensions, and years are invented placeholders except where noted.

---

## Design Tokens

### Color
| Token | Value | Use |
|---|---|---|
| `ink` | `#0d0c0a` | primary dark ground, text on cream |
| `ink-deep` | `#0a0908` | detail-page image wells, inset panels |
| `ink-panel` | `#100e0c` | mural dossier ground |
| `cream` | `#f2ece1` | cream ground, text on dark |
| `cream-2` | `#e8e1d3` / `#e4dccd` / `#ece5d8` | placeholder stripe fills on cream |
| `dark-stripe-a` | `#1c1916` / `#241f1a` | placeholder stripes on dark |
| `dark-stripe-b` | `#221e19` / `#2b251e` | placeholder stripes on dark, alt |
| `dark-stripe-focus` | `#2b251e` / `#332c23` | focused/centre placeholder |
| `dark-stripe-dim` | `#161310` / `#1c1916` | off-focus placeholder |
| `ochre` | `oklch(0.68 0.11 62)` | accent on dark grounds |
| `ochre-bright` | `oklch(0.80 0.09 62)` | accent text on dark (higher contrast) |
| `ochre-deep` | `oklch(0.50 0.11 62)` / `oklch(0.52 0.11 62)` | accent on cream grounds |
| `sage` | `oklch(0.68 0.11 150)` | secondary accent. **Currently unreferenced** — the flock was its only consumer and its wings are now textured from `textures/butterfly-wing-{rose,blue}.png`. Retained for the About cream-crossing diamonds (§119). |
| `link` | `oklch(0.60 0.11 62)`, hover `oklch(0.52 0.11 62)` | default `a` on cream |
| `bark` | `#4a3524` | butterfly bodies and antennae in the flock (canvas only) |
| `ochre-glow` | `#b8873f` | the glow rgb below, named; petal tint base (canvas only) |

Accents share L and C and vary only in hue. Ochre glow is expressed as `box-shadow: 0 0 90–120px rgba(184,135,63,.13–.22)` and `radial-gradient(..., rgba(184,135,63,.10–.12), transparent 42–44%)` — `184,135,63` is `ochre-glow`.

The last two are sRGB hex rather than `oklch` because `THREE.Color` cannot parse `oklch`; both are consumed by the WebGL systems, never by CSS.

Alpha ramps used throughout: text on dark `rgba(242,236,225, .30 / .35 / .40 / .45 / .55 / .60 / .66 / .72)`; text on cream `rgba(13,12,10, .35 / .40 / .45 / .50 / .55 / .62 / .65 / .72)`; hairlines `rgba(242,236,225,.10–.16)` on dark, `rgba(13,12,10,.12–.25)` on cream.

### Typography
Two families, loaded from Google Fonts:
```
Instrument Serif — 400, roman + italic   → all display and voice
Space Grotesk — 300/400/500              → body copy and UI
ui-monospace, Menlo, monospace           → all apparatus/labels (system, not loaded)
```

| Role | Spec |
|---|---|
| Hero name (desktop) | Instrument Serif 400, **132px / 0.86**, `letter-spacing:-.018em`; surname italic |
| Hero name (mobile) | Instrument Serif 400, 54px / 0.92 |
| Section title (gallery scene) | Instrument Serif 400, **96px / 0.94** (Ovalese italic) |
| About headline | Instrument Serif 400, 74px / 1.02, `-.01em` |
| Contact headline | Instrument Serif 400, 104px / 0.94 |
| Detail-page title | Instrument Serif 400, 62px / 1 |
| Dossier title (mural wall) | Instrument Serif 400, 30px / 1.1 |
| Poetic fragment | Instrument Serif **italic** 400, 22–25px / 1.5, `text-wrap:pretty` |
| Stat number | Instrument Serif 400, 34px / 1 (mobile 24px) |
| Body copy | Space Grotesk 400, 14px / 1.75 (mobile 13px / 1.7) |
| Detail body | Space Grotesk 400, 13.5px / 1.75 |
| Apparatus label | mono 400, 10px / 1, `letter-spacing:.18em–.20em` |
| Small caption | mono 400, 9–9.5px / 1.6–1.9, `letter-spacing:.12em–.14em` |
| Placeholder label | mono 400, 8.5–9.5px / 1.3–1.5 |
| Nav count / rail | mono 400, 9–10.5px, `letter-spacing:.10em–.18em` |

Rule of thumb: **serif for voice, mono for apparatus, Space Grotesk only for paragraphs.** Mono labels are always uppercase and letter-spaced.

### Spacing & geometry
- Desktop frame: **1440 × 900** per scene (Contact 780, detail pages 800).
- Content gutters: **left 118px** (clears the 44px rail at left:30px), **right 72px**. Top 64px, bottom 52px for scene furniture.
- Mobile frame: **390 × 844**, gutters 24px, bottom ticker 62px, status bar 46px.
- Ring geometry (desktop): outer guide circle 660px (Artworks), 640px (Ovalese), 600px (Merch); dashed inner guide 460px; thumb orbit radius **326px** (Artworks/Ovalese) / **296px** (Merch); centre slot 280px circle, 248 × 312px ovoid, or 250px square (Merch).
- Thumb sizes: 112px circle (Artworks), 98 × 124px ovoid (Ovalese), 150px square (Merch).
- Egg silhouette: `border-radius: 44% 44% 46% 46% / 56% 56% 44% 44%`.
- Radii: rings/thumbs `50%`; chips `99px`; frames square (the mockup's 6px radius is presentation chrome only, not part of the design).
- Hairlines are always **1px**, never 2px. Dashed guides `1px dashed`.

### Placeholder pattern (delete once real images land)
```css
background: repeating-linear-gradient(135deg, #1c1916 0 7px, #241f1a 7px 14px); /* dark */
background: repeating-linear-gradient(135deg, #e4dccd 0 7px, #ece5d8 7px 14px); /* cream */
```
Stripe width is 7px (8px on large plates). Label sits bottom-left, mono, 8.5–9.5px.

---

## Screens / Views

### 01 · Hero — `/` (100vh, not pinned)
**Purpose:** establish the artist and the flowers/butterflies motif in one screen.

Layout: dark ground `radial-gradient(ellipse at 10% 90%, #191411, #0d0c0a 58%)`. A **980px cream circle** bleeds off the left edge (`left:-250px; top:50%; translateY(-50%)`) holding a circular crop of a signature floral. Name is right-aligned at `right:72px; top:104px` in `mix-blend-mode:difference` so it reads across both grounds. Below it: tagline (mono, `.30em` tracking, ochre-bright), then the fragment, then a bottom-right credits/scroll block.

Components:
- **Name** — "Denise" / *"Cacanando"* (italic), 132px/0.86, difference blend.
- **Tagline** — `FLOWERS · BUTTERFLIES · WALLS · SHELLS`, mono 11px, `.30em`, ochre-bright.
- **Fragment** — italic serif 25px, `rgba(242,236,225,.70)`, max-width 360px, right-aligned. Copy slot.
- **Meta** — `MANILA, PH — OIL · ACRYLIC · WATERCOLOUR · PASTEL · BALLPEN · WALLS` + `SCROLL ↓`, mono 10px/1.7.
- **Side rail** (fixed, all sections) — 44px column at `left:30px`, vertically centred: `01` label, then four diamonds (`rotate:45deg`, 11px filled for active / 8px 1px-border for inactive) separated by 1px × 44px rules, then `04`. On dark grounds it uses `mix-blend-mode:difference` with cream; on cream grounds it switches to ink at 45–50% and ochre-deep for the active diamond.

Motion: the cream crop **rotates 0.4° per 100px scrolled and scales 1 → 1.08**. Pollen drifts. Flock idles low-left, entering from the crop's edge.

### 02 · About (100vh)
Cream ground `#f2ece1`, ink text — the first palette flip.

Layout: `grid-template-columns: 1fr 440px; gap:78px; padding:80px 0` inside `left:118px / right:72px`. Left column is `space-between`: a mono header row (`ABOUT — 02 / 04` · `B. 1994, MANILA`), then the headline + two-column body, then a stats row. Right column is a vertical portrait placeholder with a `FIG. 02 / PARALLAX 0.9×` caption row beneath.

- **Headline** — "I paint the hour / before something / *closes.*" 74px/1.02.
- **Body** — two paragraphs, `grid-template-columns:1fr 1fr; gap:34px; max-width:720px`, 14px/1.75, `rgba(13,12,10,.72)`. Copy slot.
- **Stats** — `50 PIECES SHOWN · 07 OSTRICH EGGS · 07 WALLS PAINTED · 2015 FIRST SHOW`, `gap:52px`, above a 1px top rule. Numbers 34px serif, labels mono 9px `.16em`.
- Two small ochre/sage diamonds drift across the cream (flock crossing a light ground).

Motion: text reveals by line (SplitText or per-line clip), portrait parallax 0.9×.

### 03 · Gallery scene 01 — Artworks (pinned ~320vh)
Dark ground. Title block at `left:118px; top:64px`: scene label (ochre mono), `Artworks` 96px, then `24 PIECES — OIL, ACRYLIC, WATERCOLOUR, PASTEL, BALLPEN` / `SCROLL ROTATES · SNAP CENTRES · CLICK OPENS DETAIL`, then the fragment.

The **ring** is centred at `left:62%; top:52%`. Eight thumbs are visible at once on a 326px orbit; the centre slot (280px) holds the focused piece with an ochre border and glow, and a caption block 196px below it: `"FLORAL BOUQUET" · OIL ON CANVAS / 90 × 120 CM · 2025 — ENQUIRE`.

Furniture: category list top-right (`ARTWORKS 24 ●` active in ochre, others at 30% cream); bottom progress row `07 / 24` + 1px track with a 7px ochre dot + `THUMBS COUNTER-ROTATE`.

### 04 · Gallery scene 02 — Ovalese (pinned ~220vh)
Same construction, ring at 640px with **six ovoid thumbs + one centred ovoid = 7**. Title italic. Sub-copy: `07 PAINTED OSTRICH EGGS` / `ONLY THE CENTRED SHELL IS 3D — RING THUMBS ARE FLAT CROPS`. Bottom-right note: `ONE OVOID, ONE MATERIAL · TEXTURE SWAPS ON SNAP`. Four flock diamonds sit outside the ring.

### 05 · Gallery scene 03 — Murals (pinned ~240vh) — **deliberate pattern break**
The ring **unrolls into a horizontal track**: vertical scroll maps to x-translate, scrub 1.

No full-width photograph of these walls exists, so a wall is **never faked as a panorama**. Each wall is a **dossier**: a 540px context plate (`context shot — widest angle available / WALL IS 14 M; PHOTO COVERS ~6 M`) with its title and metadata beneath, beside a 230px column of two detail crops and a `CONTEXT + DETAIL PAIR / CLICK → WALL PAGE` note. The active dossier has an ochre border and glow; neighbours are dimmed (opacity .40–.55) and partially cropped by the frame edges.

Chapters (bottom, `top:770px`): `BGC — 04 WALLS ●` · `LAYAW, MAKATI — 03 WALLS` · `TWO CHAPTERS, SCRUBBED IN SEQUENCE`. Right-side annotation explains the context+detail decision. Progress `02 / 07`, `PLANES BEND ±8° AT EDGES`.

### 06 · Gallery scene 04 — Merchandise (pinned ~260vh)
**Cream ground** — the palette flips back so product reads as product. Ring of six 150px square tiles + a 250px centre tile (`Butterfly Jacket`, `HAND-PAINTED DENIM · ONE OF ONE — ENQUIRE`).

**Filter chips** under the sub-copy: `JACKETS 05 · BAGS 04 · SHIRTS 02 · EARRINGS 01` — `padding:7px 12px; border:1px solid rgba(13,12,10,.25); border-radius:99px; white-space:nowrap;` mono 9.5px `.12em`. Default state is unfiltered (no chip active) and the ring holds all 12; selecting a chip re-blooms a smaller ring of that kind only. Showcase only — **no cart**; every item links to enquire.

### 07 · Contact (100vh)
Dark ground. Headline `Commissions, / walls, *and* / everything else.` 104px/0.94. Two links side by side (`gap:74px`): EMAIL `hello@denisecacanando.com` and INSTAGRAM `@ovalese` — Instrument Serif 32px with a `1px rgba(242,236,225,.30)` bottom border, 6px padding-bottom; **hover** → `oklch(0.80 0.09 62)` text and border. Right side reserves the form slot: `FORM COMES LATER — SLOT RESERVED / MURAL ENQUIRIES: INCLUDE WALL DIMENSIONS`. Footer rule: `© DENISE CACANANDO 2026` · `MANILA, PH`.

The flock **lands here and stops** — wings idle, no drift. That's the ending.

### 08 · Mobile (390 × 844)
Four screens mocked: Hero, About, Ovalese scene, Contact.
- The **ring unrolls into a horizontal snap list** (`scroll-snap-type: x mandatory`); centred item 250 × 330px, next peeking at 200 × 264px, `gap:18px`, 24px left padding.
- The **rail becomes a bottom ticker**: 62px bar, `rgba(13,12,10,.72)` + `backdrop-filter:blur(6px)`, four labels `01 HERO / 02 ABOUT / 03 GALLERY / 04 CONTACT`, active in ochre-bright, with a 1px progress line above it.
- Hero name drops to 54px; the cream circle becomes 480px at `left:-120px; top:280px`. **The hero fragment sits inside the circle in ink** (`rgba(13,12,10,.78)`) — cream-on-cream is the trap here; watch it if you move anything.
- About keeps the full stat row (abbreviated labels: PIECES / EGGS / WALLS).
- Metadata and captions stay mono 8.5–9px; nothing drops below 8.5px.

### 09 · Detail pages — `/:category/:slug` (routed, **not modals**)
Two layouts mocked; both `grid-template-columns: 1fr 420px; gap:64px` inside `left/right:72px`, `top:104px`, `bottom:96px`.

**Artwork leaf.** Left is the full **uncropped, zoomable** image (`THE RING CROPS TO A CIRCLE; THE PAGE NEVER DOES`). Right column: category/year label, title 62px, then a metadata table — rows `MEDIUM / SIZE / YEAR / STATUS`, each `padding:11px 0` with a 1px top rule, label at 45% cream, value in full cream, `STATUS: AVAILABLE` in ochre-bright. Then a copy slot paragraph. Pinned to the bottom: a full-width outlined **ENQUIRE ABOUT THIS PIECE** button (`padding:15px 0; border:1px solid ochre;` mono 10.5px `.20em`) and a prev/next row. Top bar: `← BACK TO THE RING · /artworks/floral-bouquet` and `07 / 24 — ARTWORKS`.

**Ovalese leaf.** Same skeleton; the left well is the **3D viewer** — one ovoid on a `radial-gradient(ellipse at 50% 40%, #191411, #0a0908 68%)` ground, `DRAG TO ORBIT · SCROLL TO ZOOM · DOUBLE-TAP RESETS`, with four 52px circular angle thumbs bottom-right (active one ochre-bordered). Metadata swaps YEAR for `SHOTS USED — 08 ANGLES → 2K MAP`.

**Mural leaf** reuses the artwork layout plus a detail-crop strip under the context shot.

---

## Interactions & Behavior

### Scroll timeline (GSAP)
One **master ScrollTrigger timeline** with seven labels: `hero · about · g1 · g2 · g3 · g4 · contact`.
- Gallery scenes **pin** with `scrub: 1`, lengths proportional to count: **320vh / 220vh / 240vh / 260vh** (24 / 7 / 7 / 12).
- Inside a scene, scroll progress maps to **ring rotation** with `snap: 1/n`, and every thumb **counter-rotates by −rotation** so crops stay upright.
- Between scenes the ring **collapses to a seed** and the flock's MotionPath progress owns the gap — the transition *is* the navigation.
- Scene 03 (Murals) swaps rotation for an **x-translate track**.
- `ScrollTrigger.snap` on labels so the user can't stall mid-flight.
- Hero crop: rotate 0.4°/100px, scale 1 → 1.08. About: per-line reveal, portrait parallax 0.9×.
- **Lenis** for smoothing. One `ScrollTrigger.refresh()` after fonts load (`document.fonts.ready`) — without it, pin lengths are computed against fallback metrics and every scene drifts.

### r3f stage
**One fixed full-viewport canvas behind the DOM**, three systems sharing a scroll uniform:
1. **Pollen / petal points** — **500**, additive, always on; half density over cream grounds.
2. **Instanced butterflies** — **30 instances**, wing phase animated per-instance in the vertex shader, one attractor target per scene. They gather toward the next category title, then thin to a residue as the artwork resolves.

> Both counts were **set by hand by Denise** after seeing the canvas working for the
> first time, cutting the ~4k pollen and ~1,200 butterflies this section originally
> specified. They are a look decision, not a performance one — the `instancedMesh`
> places every instance from four vertex-shader uniforms, so per-frame CPU cost is
> O(1) at either count. Treat the shipped numbers as deliberate; `RADIUS_WIDE` in
> `Butterflies.tsx` is hers on the same terms.
3. **Centre slot** — a plane with a ripple/displacement shader that settles as the ring snaps (paint blooming in water).

**No 3D eggs in the ring.** Ring thumbs are flat circular crops; the orbitable ovoid is mounted **only on the Ovalese detail route** — one geometry, one material, seven 2K maps loaded on demand. This is the deliberate answer to the perf concern: you keep the 3D and the ring stays cheap.

Textures: KTX2, 1024px max in-scene (2K only on the Ovalese leaf), lazy per scene. `dpr` capped `[1, 1.75]`. Canvas paused when out of view. Entering a detail route unmounts the gallery canvas and restores scroll position on back.

### Navigation
- Rail diamonds jump to timeline labels.
- Clicking a ring thumb rotates it to centre (it does **not** navigate). Clicking the **centred** piece opens its route.
- Detail pages are real routes — linkable, shareable, back-button correct.

### Reduced motion (`prefers-reduced-motion`)
Rings become snap-scroll lists, the flock freezes into a static frieze, pins release. **Nothing structural is lost** — this is a requirement, not a nice-to-have. Under 900px, the ring unrolls into the horizontal snap list and the rail becomes the bottom ticker. Mobile drops the butterfly system entirely and keeps pollen at 25%.

## State Management
- `activeScene: 0–3` (derived from the timeline label, not stored independently).
- `activeIndex` per scene — the snapped ring position; drives the centre slot, caption, and progress row.
- `merchFilter: null | 'jackets' | 'bags' | 'shirts' | 'earrings'` — `null` shows all 12; a value re-blooms a smaller ring.
- `eggAngle` on the Ovalese leaf (orbit controls + the four angle thumbs).
- Route params `:category/:slug` resolve to a data record; prev/next are index ± 1 within that category.
- Scroll position preserved across route changes.
- No data fetching — data ships with the bundle.

## Data (no CMS)
One typed module per category: `artworks.ts · ovalese.ts · murals.ts · merch.ts`. Record shape:

```ts
type Piece = {
  slug: string; title: string; medium: string;
  size: string; year: number;
  status: 'available' | 'sold' | 'commission' | 'showcase';
  images: { src: string; alt: string; role: 'primary' | 'detail' | 'context' | 'angle' }[];
  body?: string;                       // Denise's copy
  kind?: 'jackets' | 'bags' | 'shirts' | 'earrings';   // merch only
  location?: 'bgc' | 'layaw';          // murals only
};
```
**The ring reads `length` from the data** — never hardcode counts in a view. Confirmed counts: **Artworks 24 · Ovalese 7 · Murals 7 (BGC 4, Layaw Makati 3) · Merchandise 12 (jackets 5, bags 4, shirts 2, earrings 1)** = 50 pieces.

## Assets
- **Fonts:** Instrument Serif + Space Grotesk (Google Fonts). Mono is the system stack — do not load a mono webfont.
- **Imagery: none delivered yet.** Every image is a striped placeholder with a monospace label naming what belongs there. Source files live in the client's Drive as HEIC/TIF and need converting to web JPG/WebP.
- **No icons, no SVG illustration.** The only glyph-like marks are CSS squares rotated 45° (butterflies) and circles (pollen/thumbs). Keep it that way — the flock is 3D geometry in production, not SVG.
- **No logo yet.** The rail shows `01…04` and a diamond; a wordmark can slot at the rail top if one is made.

## Still outstanding before or during build
1. **Web-ready imagery** for all 50 pieces — plus 8 angles per Ovalese egg for the texture map, and context + 2 detail crops per mural.
2. **Denise's copy** — 5 fragments on the scroll page and one paragraph per piece. All slots are tagged `COPY SLOT — DENISE TO WRITE` in the mockups.
3. **Real titles, media, dimensions, years, availability** for every piece.
4. **Mural reshoot list** — decide which walls need a better context shot; the design accommodates partial coverage but 2 detail crops per wall is the minimum.
5. **Contact form** — slot reserved in the layout; email + Instagram ship first.
6. **Device floor.** The mobile bailout as specced (no butterflies, 25% pollen) assumes a recent phone. If older Android matters, cut pollen too and keep the snap list only.

## Files
- `Ovalese Site - Pollen Dial.dc.html` — **the design of record.** Nine labelled frames: 7 desktop scenes at 1440, 4 mobile screens at 390, 2 detail pages, and an on-page build spec.
- `Ovalese Concepts.dc.html` — the exploration that led here. Turn 1 = five concepts (`1a` Pressed, `1b` Nocturne, `1c` Migration, `1d` Bloom Dial, `1e` Torn Press); turn 2 = `2a`/`2b`/`2c`, where `2c` Pollen Dial was chosen. Useful for the *why*, and for rejected alternatives if a decision needs revisiting.
- Both open directly in a browser. In each, the top-left mono label on a frame states which scene it is and what the scroll does there.
- `screens/` — PNG exports at 2× of every frame, for reference without opening the HTML:
  `01-hero · 02-about · 03-gallery-artworks · 04-gallery-ovalese · 05-gallery-murals · 06-gallery-merchandise · 07-contact · 08-mobile · 09-detail-pages`.
  The HTML remains the source of truth for exact values — measure there, not in the PNGs.

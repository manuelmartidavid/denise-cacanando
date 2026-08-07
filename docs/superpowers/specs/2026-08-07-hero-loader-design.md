# Hero loader — the name writes itself, then takes its place

**Date:** 2026-08-07
**Status:** Approved

## Goal

On first arrival the site opens on the hero's own near-black ground with
nothing on it but the name, written out by hand as the page and the 3D dahlia
load. A small grey `loading...` sits under the name. When the flower has
painted its first frame the name glides — seamlessly, no resize, no reflow —
into its real hero position, and the tagline, fragment, meta line and the
dahlia fade in around it.

The point is that the visitor never sees a hero missing its centrepiece.
Today the type paints immediately and the flower arrives whenever three.js
and the GLB are ready; the loader turns that gap into the opening beat.

## Approach (decided)

**Overlay loader with a FLIP handoff.** A fixed full-screen layer above the
page holds its own copy of the name, set in the same font at the same size
with the same line breaks. When loading finishes it measures the real `<h1>`
and glides its copy there with a transform only — no font-size or layout
animation — then hands over to the real `<h1>` and unmounts.

Rejected alternatives:

- *Promote the real `<h1>` during load* (fix it centred, animate it home).
  One DOM node, but it fights `mix-blend-difference`, the parallax `par`
  wrapper, and the hero's ScrollTrigger pin, which measures the section.
  Risk with no visible gain.
- *Withhold the page until loaded.* Not viable: the flower cannot load if
  the section that mounts its canvas is not mounted.

The overlay costs a second, temporary rendering of the name. That is the
standard FLIP trade, and it is what keeps the hero's layout, the timeline and
the pin completely untouched.

## Architecture

Three new files plus small edits to three existing ones.

### `src/scroll/loading.ts` — the load channel

Same two-channel discipline as `scroll/store.ts`, and for the same reason:

- **`phase`** — discrete, published to React via `useSyncExternalStore`:
  `'loading' | 'revealing' | 'done'`. `Hero` and `ScrollPage` read it.
- **`load`** — continuous, mutated in place, **never published**. Holds
  `target` (0–1, the honest load fraction) and `written` (0–1, the eased
  value the wipe actually draws). The loader's own rAF reads and writes these
  and pokes the DOM directly. Routing a per-frame wipe through React state
  would re-render the whole hero sixty times a second.

Exports `reportLoad(milestone)` where milestone is `'chunk' | 'model' |
'frame'`, `beginReveal()`, `finishReveal()`, and `useLoadPhase()`.

Milestone weights and where each is reported from:

| Milestone | Share | Reported by |
| --- | --- | --- |
| `chunk` | 0.4 | The `.then()` on `Hero.tsx`'s lazy `HeroFlower` import |
| `model` | 0.4 | `Bloom`, once `useGLTF` has resolved the GLB |
| `frame` | 0.2 | `Bloom`'s first `useFrame` tick |

Within the `model` band, `target` is filled continuously rather than jumping
at the end: the loader's rAF reads `useProgress.getState().progress` — drei's
loading-manager store, read imperatively so it publishes nothing to React —
and interpolates 0.4→0.8 across it. The `model` milestone then pins that band
complete. The first `useFrame` tick means the model is in the scene graph and
that frame's draw follows immediately; the one-frame lead is invisible.

### `src/scroll/loadProgress.ts` — the easing, as a pure function

```
advance(written, target, dt, elapsed) -> number
```

Monotonic (never returns less than `written`), eases toward `target` with a
time-constant so a jump in `target` reads as a hand speeding up rather than a
snap, and is clamped below 1 until `elapsed >= MIN_DURATION` (1600ms). This
is what guarantees the name always finishes writing — a warm cache reports
every milestone in under 100ms, and without the floor the loader would be a
flash. Pure and dependency-free so it can be unit-tested.

### `src/components/Loader.tsx` — the layer

- `fixed inset-0 z-50`, background = the hero ground gradient. That constant
  moves out of `GroundLayer.tsx` into a shared export (`HERO_GROUND`) so the
  loader and the section cannot drift apart. Because the backdrop *is* the
  hero ground, its fade-out is invisible in the hero itself; what it actually
  reveals is the side rail and the bottom ticker.
- The name: two lines, `Denise` / `Cacanando`, in the **exact hero classes** —
  `font-hero text-hero-m sm:text-hero text-cream sm:mix-blend-difference` —
  centred in the viewport. The blend mode is included deliberately: the
  loader's backdrop and the hero's ground are the same colour and the flower
  is still invisible at handoff, so the blended result is identical on both
  sides of the swap.
- Under it: `loading...` in `font-mono text-meta uppercase text-cream/40`,
  with the three dots cycling on a CSS keyframe.
- Waits on Pinyon Script (`document.fonts.load('1em "Pinyon Script"')`, capped
  at 1.5s) before it starts the wipe. Wiping a fallback face and then swapping
  fonts mid-write would break the illusion outright.

### The wipe

Each line carries a `mask-image: linear-gradient(90deg, #000 <a>%,
transparent <b>%)` whose stops are advanced by the loader's rAF. The soft
ramp between the two stops is the pen tip; ahead of it the script has not been
written yet, behind it the glyphs are whole and already joined — which is what
a connected hand needs and a per-glyph fade cannot give.

Overall progress is split between the two lines in proportion to their
measured widths, so the pen crosses both at one constant speed rather than
spending half the write on the shorter word.

## The handoff

1. Flower reports `frame`; `written` finishes its run to 1.
2. Phase → `'revealing'`. The loader measures its own two lines and the real
   `<h1>`'s two lines, then GSAP-animates each of its lines by the delta,
   transform only, ~0.9s on a gentle ease.
   - Measurement uses `Range.getBoundingClientRect()` over each line's text
     node, so the numbers are glyph bounds rather than block bounds. This
     means the h1's own alignment (right at sm+, left below) and its parallax
     `par` transform are absorbed by the measurement instead of having to be
     reasoned about.
   - The `<h1>`'s `<br>` becomes two `<span class="block">`s so each line is
     independently measurable. Purely structural; it renders identically.
3. On the same timeline: the backdrop fades out, and the real `<h1>` cross-
   fades up over the loader's copy in the last ~120ms of the glide. A hard
   swap would be defensible since the two are pixel-identical, but the short
   dissolve costs nothing and forgives sub-pixel differences.
4. Landing: `finishReveal()` → phase `'done'`, loader unmounts, and the
   tagline, fragment, meta line and flower canvas fade in over ~0.8s with a
   small stagger. `Hero` drives these from the phase — `opacity-0` until
   `'revealing'`, then a transition to full.

## Scroll lock

The page behind the loader is live and scrollable, which would let a visitor
wheel away from a hero they cannot see. While the loader is mounted:

- `getLenis()?.stop()`, restarted on unmount. Lenis owns wheel, touch and
  keyboard on the normal path, so this is the real lock.
- Plus non-passive `wheel` / `touchmove` `preventDefault` listeners as the
  universal guard — reduced motion skips Lenis entirely, so there is no
  instance to stop there.
- `window.scrollTo(0, 0)` at loader start.

`ScrollPage`'s session restore is skipped while the loader plays. In practice
the two cannot collide (the loader only runs when the session flag is absent,
and the flag is written alongside the saved offset), but a stale offset from a
pre-loader session must not yank the page mid-write.

## Frequency, reduced motion, failure

- **Once per session.** `sessionStorage['ovalese:loaded']`, written when the
  loader completes. Present → `ScrollPage` never mounts the loader and the
  page behaves exactly as it does today, including the flower's own fade-in.
  Returning from a detail route therefore lands instantly.
- **Reduced motion.** No typing and no glide. The loader shows the finished
  name and `loading...` statically, and cross-fades out when the flower is
  ready; the hero content fades in on the same short transition. Everything
  else — the lock, the session flag — is unchanged.
- **Hang.** A 10s safety timeout forces `target` to 1 regardless of
  milestones. A failed GLB fetch must never leave the site behind a permanent
  black screen.
- **Resize mid-glide.** Finish immediately: snap to the landed state rather
  than animating toward stale targets. Resize while still writing needs no
  handling — the loader is centred and re-centres itself.

## Testing

- `src/scroll/loadProgress.test.ts` (vitest, in the style of `flock.test.ts`
  and `painterly.test.ts`): monotonicity, never overshooting `target`, the
  minimum-duration floor, and reaching exactly 1 once `target` is 1 and the
  floor has passed.
- `src/scroll/loading.test.ts`: milestone weights accumulate to 1, milestones
  are idempotent and order-independent, phase transitions are one-way.
- Browser verification per the hidden-tab workflow — screenshots pump frames,
  so the write and the glide are sampled by screenshotting at intervals.
  Checked at desktop (right-aligned h1) and mobile (left-aligned, `text-hero-m`)
  widths, and with reduced motion forced.

# Parallax section transitions — design

**Date:** 2026-08-06
**Status:** approved (brainstorm complete; implementation plan to follow)
**Visual guide:** https://claude.ai/code/artifact/51e6086b-60c5-4b56-8a79-7d8e0138fe00 — live maquette of the chosen treatment; the depth table and boundary rule below mirror it.

## What this is

Scroll-driven parallax on section transitions across the single-page site. The chosen treatment is the **lift, gated by ground contrast**: content planes lead the scroll and grounds trail it, so the page reads as rising past the visitor — but the full gesture fires only where the ground flips between ink and cream. Same-ground boundaries keep a quiet residual depth.

`@react-spring/parallax` was considered and rejected: it owns its own scroll container, which is incompatible with Lenis document scroll, the four ScrollTrigger pins, label offsets, scroll restore, and the flock's document-progress feed. No new dependencies; no GSAP Observer (ScrollTrigger already reads the smoothed scroll — there is no second input path to capture).

## The scalar: `--par`

One CSS custom property per section, written onto that section's own element (`#hero`, `#about`, `#g1`, …) so it scopes to the section's subtree, by the whole-document trigger's `onUpdate` — the same per-frame channel that writes `--seam` — using the label offsets and spans the section triggers register on refresh. (Measured, never derived; a second per-section trigger was rejected because a pinned element's exit mis-measures without `pinnedContainer` compensation, while the spans already hold the released range.) Value:

- **−1 → 0** while the section enters (one viewport of scroll),
- **0** held across the seated/pinned run,
- **0 → +1** while it exits (one viewport).

The ramps are **sign-preserving quadratics** — steep at the section's edges, zero slope at the seat — so sections arrive and settle rather than glide. The easing is baked into the scalar, not the consumer.

Each edge of the ramp is additionally scaled by a **boundary intensity**:

- **×1.0** where the two grounds the boundary joins differ (ink|cream flip),
- **×0.35** where they match.

Intensities are **derived from the ground declarations** — `scene.ground` for gallery scenes and the same hero/about/contact grounds `GroundLayer` reads — never a hand-maintained boundary list. Reordering or appending a section keeps the rule true automatically. With the current spine (dark, cream, cream, dark, dark, cream, dark) that yields: Hero→About **lift**, About→g1 **calm**, g1→g2 **lift**, g2→g3 **calm**, g3→g4 **lift**, g4→Contact **lift**. A section can enter loud and exit quiet.

All mapping logic — progress → ramp/plateau/ramp, easing, edge intensities from a ground list — lives in a new pure module `src/scroll/parallax.ts` (no DOM reads; plateau width passed in from the pin length), unit-tested in `src/scroll/parallax.test.ts` like `seed.ts` and `timelineMath.ts`.

## The consumer

One rule in `src/styles/index.css`:

```css
.par { transform: translate3d(0, calc(var(--par, 0) * var(--depth, 0) * 1vh), 0); }
```

Elements opt in with `className="par"` and an inline `--depth` (viewport-height percent). Positive depth lags the scroll (the slower world); negative leads it (the rising page). The fallback `var(--par, 0)` means unmounted-timeline, reduced-motion, and teardown states all render exactly today's layout.

## Depth map (starting values — look decisions, tuned in browser)

| Section | Moves | Held still |
|---|---|---|
| hero | crop circle **+8** · name **−8** · fragment/meta **−12** | nothing |
| about | imagery **+8** · body text **−8** · pull-quote **−12** | — |
| g1–g4 | scene heading **−8** · captions/counters **−12** | centrepieces (field, dials, track): the pinned scrub owns their motion (`--r`, `--at`); they enter at scroll speed, keeping the artwork calm inside the lift |
| contact | bloom **+8** · sign-off **−8** · meta **−12** | seated before any link is in comfortable reach |
| canvas / grounds | — | flock, petals, pollen keep their own depth model off `frame.progress`; GroundLayer blocks tile the document exactly — the grounds ARE the slower world |

Motion exists only in the ramps: seated sections are stationary, so running text is readable and hit-targets never move under the cursor.

## Seed system

Untouched. `--seam` / `--seed` / `--seam-pin` and SeedLayer are not read or written by any parallax code. The seam is currently dormant anyway (g1 renders as a field; ScrollPage's dial|dial gate keeps SeedLayer unmounted). Recorded future intent, out of scope here: make Murals (g3) a ring and re-seat the seed at Ovalese|Murals — a dark|dark boundary, which under this rule meets only the ×0.35 depth and can never collide with the full lift.

## Guarantees

- **Reduced motion:** the `--par` triggers are not created when `prefersReducedMotion()` holds; the CSS fallback leaves every layer where it sits today. Same switch the presentations already resolve against.
- **Teardown:** `killTimeline()` removes each section's `--par` the way it removes `--seam` — absent, not defaulted — so a detail-route round-trip cannot leave a stale offset.
- **Invariants respected:** per-frame values reach the DOM as CSS custom properties, never React state (invariant 1); GSAP stays inside the scroll module — sections only gain a class and a `--depth` (invariant 2).
- **Performance:** transform-only (composited); at most two sections are in their ramps at once; writes are skipped while a value is clamped and unchanged.

## Testing

`parallax.test.ts` asserts: ramp shape and clamps at both edges; plateau equals the pinned run and degenerates to a point for unpinned sections; the quadratic easing's zero slope at the seat; intensity derivation from ground lists (flip → 1.0, match → 0.35, first/last edges); and that a full-scroll sweep is continuous (no jumps at ramp/plateau joins). Depth values themselves are look decisions and are not asserted.

## Out of scope

- The Murals-as-ring / seed relocation (own design later).
- Any change to the seed system, dial/track/field scrub, GroundLayer, or canvas systems.
- Horizontal parallax, scale, or opacity treatments — vertical translate only.

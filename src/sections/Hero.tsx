import { lazy, Suspense, useRef, type CSSProperties } from 'react'
import { reportLoad } from '~/scroll/loading'

/**
 * Same treatment as the Stage in ScrollPage: three.js is most of the bundle
 * and the bloom is decorative, so the hero's type paints without waiting on
 * it. The fallback is legitimately nothing — the flower fades in when ready.
 */
const HeroFlower = lazy(() =>
  import('~/three/HeroFlower').then((m) => {
    // First of the loader's three milestones — three.js and drei have
    // landed, which is the biggest single wait on a cold cache.
    reportLoad('chunk')
    return { default: m.HeroFlower }
  }),
)

/**
 * The dahlia's pose tuner — dev builds only, and even there only on request:
 * visit `localhost:5173/?tune` to summon it. The DEV guard is on the DYNAMIC
 * import, so production never even fetches the chunk; the ternary (rather
 * than a bare `lazy` behind a JSX guard) is what keeps the module out of the
 * prod graph entirely.
 */
const HeroFlowerTuner = import.meta.env.DEV
  ? lazy(() => import('~/three/HeroFlowerTuner').then((m) => ({ default: m.HeroFlowerTuner })))
  : null

/** Read per render, not cached: the flag arrives by editing the URL. */
const tunerRequested = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('tune')

/**
 * 01 · Hero — `/`, 100vh, pinned for 300vh of scroll while the dahlia plays
 * out (timeline.ts, HERO_LENGTH). The pin releases under reduced motion.
 *
 * Below xl (chosen over the README §150/§154 plan when the flower landed):
 * the name stays at the top, the DAHLIA takes the centre of the screen — it
 * is the centrepiece on every device — and the tagline + fragment sit in
 * their own block above the ticker. The side-by-side desktop composition
 * needs ~1280px; below that the copy landed on pale petals. The old spec put
 * the fragment INSIDE the cream circle in ink; the circle is gone and the
 * ground here is dark, so that ink had become ink-on-ink and invisible. The
 * fragment below xl is cream now, and lives in an `xl:hidden` twin of the
 * column block — if you touch the copy, change BOTH renderings.
 *
 * `overflow-hidden` rather than `overflow-clip`: this is the one section
 * b5ea535 left alone, and changing it is out of scope.
 *
 * The circular crop is no longer a placeholder: the 3D dahlia (HeroFlower)
 * blooms in its box, scrubbed by the hero's own exit via frame.heroProgress.
 * The old plan's rotate 0.4°/100px + scale 1→1.08 belonged to the flat crop
 * and went with it. SCAFFOLD still to come — pollen drift, and the flock
 * idling low-left out of the bloom's edge.
 */
// Ground is painted by GroundLayer, behind the canvas — see that file.
export const Hero = () => {
  // The crop circle's box, kept as an invisible anchor: the flower's canvas
  // spans the whole section (so exploding petals are clipped by the section's
  // own overflow-hidden, not an arbitrary square in the middle of it), and
  // HeroFlower measures this rect to place and size the dahlia where the
  // circle was. Same DOM↔canvas agreement trick as three/avoid.ts.
  const anchorRef = useRef<HTMLDivElement>(null)

  return (
  <section id="hero" className="relative h-screen w-full overflow-hidden">
    {/* The dahlia's canvas — the full section, behind the shell's children.
        pointer-events-none on the host AND inline on the Canvas inside — see
        NearStage for why the class alone loses to r3f's inline style. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 par"
      style={{ '--depth': 8 } as CSSProperties}
    >
      <Suspense fallback={null}>
        <HeroFlower anchorRef={anchorRef} />
      </Suspense>
    </div>

    {HeroFlowerTuner && tunerRequested() && (
      <Suspense fallback={null}>
        <HeroFlowerTuner />
      </Suspense>
    )}
    {/*
      Everything is positioned against the SHELL, not the viewport. The offsets
      below are unchanged — at 1440 the shell is the viewport and this renders
      identically — but past 1560 the shell centres, so the crop and the name
      stop being dragged to opposite edges of the monitor.

      The shell carries NO padding, and that is deliberate. Every child here
      places itself explicitly (left-6, right-[72px], bottom-[52px]), so gutters
      would be doing nothing — except to the crop, which `Placeholder` renders
      as `position: relative`, not absolute. A relative offset is measured from
      where the box would have sat, so 118px of padding-left silently moved the
      crop 118px right and it overlapped the name at 1440. Padding on this shell
      is not a no-op; leave it off.
    */}
    <div className="page-shell relative h-full">
      {/* Where the flower lives — centred below xl (the centrepiece of any
          screen too narrow to hold flower and copy side by side; at 1024 the
          side-by-side put the tagline on pale petals), the old circle's spot
          at xl+: 980px bleeding
          off-edge left. Empty on purpose: it renders nothing and only lends
          its rect to the canvas above, so the dahlia holds its spot at every
          shell width without restating these offsets in world units.
          --bloom-align rides the same breakpoint: it multiplies the tuned
          nudgeX, which carries the head toward the crop's right edge in the
          desktop composition and would drag it off-centre in this one.
          Deliberately WITHOUT `par`: the canvas host carries the lift for the
          whole flower, and measuring a lifted anchor would double it. */}
      <div
        ref={anchorRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[54%] size-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 [--bloom-align:0] sm:size-[min(78vw,720px)] xl:left-[-250px] xl:top-1/2 xl:size-[980px] xl:translate-x-0 xl:[--bloom-align:1]"
      />

    {/*
      Name, tagline and fragment are ONE anchored column, not three separately
      pinned blocks. They used to carry hardcoded tops — 104 / 359.04 / 395.04 —
      measured off a mock set in Instrument Serif. A script has different
      metrics: at 150/1.0 the name's box runs to y 404 and the tagline, still
      nailed at 359, printed straight through "Cacanando". Stacking them means
      the name's height drives what follows it, and the next type change cannot
      reintroduce that collision.
    */}
      <div className="absolute z-10 left-6 top-[110px] text-left sm:left-auto sm:right-[72px] sm:top-[104px] sm:text-right">
      {/*
        The one script on the site — `font-hero`, not `font-display`. No <em>:
        italic is emphasis, and a signature emphasises nothing. The surname's
        weight used to come from the italic; it now comes from the hand.
      */}
      <h1
        className="font-hero text-hero-m text-cream sm:text-hero sm:mix-blend-difference par"
        style={{ '--depth': -8 } as CSSProperties}
      >
        Denise
        <br />
        Cacanando
      </h1>

      {/* Hidden below xl: through phone, tablet and small laptop these two
          live in the bottom block — between 640 and 1280 the centred flower
          owns the middle of the screen, and copy set beside it landed on top
          of pale petals. */}
      <p
        className="hidden xl:block mt-5 font-mono text-label-lg tracking-tagline text-ochre-bright uppercase par"
        style={{ '--depth': -12 } as CSSProperties}
      >
        Flowers · Butterflies · Walls · Shells
      </p>

      <p
        className="hidden xl:block mt-[25px] ml-auto max-w-[360px] text-pretty font-display text-fragment italic text-cream/70 par"
        style={{ '--depth': -12 } as CSSProperties}
      >
        {/* COPY SLOT — DENISE TO WRITE. Length and tone guide only. */}
        A held breath before the petals let go — the hour when the garden decides
        what it will keep.
      </p>
    </div>

      {/* The phone/tablet twin of the tagline + fragment, above the ticker
          (below sm) or the bottom edge (sm–lg, where the rail replaces the
          ticker) and over the flower's lower petals. Cream, never ink: the
          ground behind it is dark (see the header comment for the ink-on-ink
          history). */}
      <div className="absolute z-10 left-6 right-6 bottom-[88px] sm:left-16 sm:bottom-16 xl:hidden">
        <p className="font-mono text-ph tracking-[0.22em] text-ochre-bright uppercase par"
          style={{ '--depth': -12 } as CSSProperties}
        >
          Flowers · Butterflies · Walls · Shells
        </p>
        <p
          className="mt-3 max-w-[340px] text-pretty font-display text-fragment-m italic text-cream/75 sm:max-w-[440px] sm:text-fragment-sm par"
          style={{ '--depth': -12 } as CSSProperties}
        >
          {/* COPY SLOT — DENISE TO WRITE. Keep in sync with the lg+ block. */}
          A held breath before the petals let go — the hour when the garden
          decides what it will keep.
        </p>
      </div>

      {/* lg+, not sm+: through the tablet band the bottom belongs to the
          tagline/fragment twin, and two blocks sharing that strip collided. */}
      <div
        className="absolute z-10 hidden text-right font-mono text-meta tracking-caption text-cream/40 uppercase xl:block right-[72px] bottom-[52px] par"
        style={{ '--depth': -12 } as CSSProperties}
      >
        <p>Manila, PH — Oil · Acrylic · Watercolour · Pastel · Ballpen · Walls</p>
        <p className="mt-2 text-cream/60">Scroll ↓</p>
      </div>
    </div>
  </section>
  )
}

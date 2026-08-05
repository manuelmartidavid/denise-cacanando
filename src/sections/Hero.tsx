import { Placeholder } from '~/components/Placeholder'

/**
 * 01 · Hero — `/`, 100vh, not pinned.
 *
 * Mobile (README §150, §154): the name drops to 54px and goes left-aligned, the
 * circle shrinks to 480px and sits low-left, and the fragment moves INSIDE the
 * circle in ink. Cream-on-cream is the named trap here — the fragment was
 * invisible at every width below the design viewport. Watch it if you move
 * anything.
 *
 * `overflow-hidden` rather than `overflow-clip`: this is the one section
 * b5ea535 left alone, and changing it is out of scope.
 *
 * SCAFFOLD: grounds, gutters and the type scale are in place. Still to come —
 * the crop's rotate 0.4°/100px + scale 1→1.08, pollen drift, and the flock
 * idling low-left out of the crop's edge.
 */
// Ground is painted by GroundLayer, behind the canvas — see that file.
export const Hero = () => (
  <section id="hero" className="relative h-screen w-full overflow-hidden">
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
      {/* Cream circle — 480px low-left on mobile, 980px bleeding off-edge at sm. */}
      <Placeholder
        label="Signature floral — circular crop"
        tone="cream"
        className="absolute left-[-120px] top-[280px] size-[480px] rounded-full sm:left-[-250px] sm:top-1/2 sm:size-[980px] sm:-translate-y-1/2"
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
      <h1 className="font-hero text-hero-m text-cream sm:text-hero sm:mix-blend-difference">
        Denise
        <br />
        Cacanando
      </h1>

      <p className="mt-[26px] font-mono text-ph tracking-[0.22em] text-ochre-bright uppercase sm:mt-5 sm:text-label-lg sm:tracking-tagline">
        Flowers · Butterflies · Walls · Shells
      </p>

      <p className="mt-[39px] max-w-[230px] text-pretty font-display text-fragment-m italic text-ink/78 sm:mt-[25px] sm:ml-auto sm:max-w-[360px] sm:text-fragment sm:text-cream/70">
        {/* COPY SLOT — DENISE TO WRITE. Length and tone guide only. */}
        A held breath before the petals let go — the hour when the garden decides
        what it will keep.
      </p>
    </div>

      <div className="absolute z-10 hidden text-right font-mono text-meta tracking-caption text-cream/40 uppercase sm:block sm:right-[72px] sm:bottom-[52px]">
        <p>Manila, PH — Oil · Acrylic · Watercolour · Pastel · Ballpen · Walls</p>
        <p className="mt-2 text-cream/60">Scroll ↓</p>
      </div>
    </div>
  </section>
)

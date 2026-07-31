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
    {/* Cream circle — 480px low-left on mobile, 980px bleeding off-edge at sm. */}
    <Placeholder
      label="Signature floral — circular crop"
      tone="cream"
      className="absolute left-[-120px] top-[280px] size-[480px] rounded-full sm:left-[-250px] sm:top-1/2 sm:size-[980px] sm:-translate-y-1/2"
    />

    <h1 className="absolute z-10 left-6 top-[110px] text-left font-display text-hero-m text-cream sm:left-auto sm:right-[72px] sm:top-[104px] sm:text-right sm:text-hero sm:mix-blend-difference">
      Denise
      <br />
      <em className="italic">Cacanando</em>
    </h1>

    <p className="absolute z-10 left-6 top-[240px] text-left font-mono text-ph tracking-[0.22em] text-ochre-bright uppercase sm:left-auto sm:right-[72px] sm:top-[359.04px] sm:text-right sm:text-label-lg sm:tracking-tagline">
      Flowers · Butterflies · Walls · Shells
    </p>

    <p className="absolute z-10 left-6 top-[312px] max-w-[230px] text-left text-pretty font-display text-fragment-m italic text-ink/78 sm:left-auto sm:right-[72px] sm:top-[395.04px] sm:max-w-[360px] sm:text-right sm:text-fragment sm:text-cream/70">
      {/* COPY SLOT — DENISE TO WRITE. Length and tone guide only. */}
      A held breath before the petals let go — the hour when the garden decides
      what it will keep.
    </p>

    <div className="absolute z-10 hidden text-right font-mono text-meta tracking-caption text-cream/40 uppercase sm:block sm:right-[72px] sm:bottom-[52px]">
      <p>Manila, PH — Oil · Acrylic · Watercolour · Pastel · Ballpen · Walls</p>
      <p className="mt-2 text-cream/60">Scroll ↓</p>
    </div>
  </section>
)

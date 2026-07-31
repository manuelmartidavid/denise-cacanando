import { Placeholder } from '~/components/Placeholder'

/**
 * 01 · Hero — `/`, 100vh, not pinned.
 *
 * SCAFFOLD: grounds, gutters and the type scale are in place. Still to come —
 * the crop's rotate 0.4°/100px + scale 1→1.08, pollen drift, and the flock
 * idling low-left out of the crop's edge.
 */
export const Hero = () => (
  // Ground is painted by GroundLayer, behind the canvas — see that file.
  <section id="hero" className="relative h-screen w-full overflow-hidden">
    {/* 980px cream circle, bleeding off the left edge */}
    <Placeholder
      label="Signature floral — circular crop"
      tone="cream"
      className="absolute size-[980px] rounded-full"
      style={{ left: -250, top: '50%', transform: 'translateY(-50%)' }}
    />

    {/* Difference blend so the name reads across both grounds */}
    <h1
      className="absolute z-10 text-right font-display text-hero text-cream mix-blend-difference"
      style={{ right: 72, top: 104 }}
    >
      Denise
      <br />
      <em className="italic">Cacanando</em>
    </h1>

    <p
      className="absolute z-10 text-right font-mono text-label-lg tracking-tagline text-ochre-bright uppercase"
      style={{ right: 72, top: 104 + 132 * 0.86 * 2 + 28 }}
    >
      Flowers · Butterflies · Walls · Shells
    </p>

    <p
      className="absolute z-10 max-w-[360px] text-right font-display text-fragment italic text-cream/70"
      style={{ right: 72, top: 104 + 132 * 0.86 * 2 + 64, textWrap: 'pretty' }}
    >
      {/* COPY SLOT — DENISE TO WRITE. Length and tone guide only. */}
      A held breath before the petals let go — the hour when the garden decides
      what it will keep.
    </p>

    <div
      className="absolute z-10 text-right font-mono text-meta tracking-caption text-cream/40 uppercase"
      style={{ right: 72, bottom: 52 }}
    >
      <p>Manila, PH — Oil · Acrylic · Watercolour · Pastel · Ballpen · Walls</p>
      <p className="mt-2 text-cream/60">Scroll ↓</p>
    </div>
  </section>
)

/**
 * 07 · Contact — 100vh, dark ground. The flock lands here and stops.
 *
 * SCAFFOLD: layout and links are final. Still to come — the flock's arrival and
 * idle-wing rest state, which is the ending of the whole scroll.
 */
// Ground is painted by GroundLayer, behind the canvas — see that file.
export const Contact = () => (
  <section
    id="contact"
    className="relative flex h-screen w-full flex-col justify-center overflow-clip text-cream"
    style={{ paddingLeft: 118, paddingRight: 72 }}
  >
    <div className="flex w-full items-end justify-between">
      <div>
        <h2 className="font-display text-contact">
          Commissions,
          <br />
          walls, <em className="italic">and</em>
          <br />
          everything else.
        </h2>

        <div className="mt-14 flex" style={{ gap: 74 }}>
          <a
            href="mailto:hello@denisecacanando.com"
            className="border-b border-cream/30 pb-[6px] font-display text-enquire transition-colors hover:border-ochre-bright hover:text-ochre-bright"
          >
            hello@denisecacanando.com
          </a>
          <a
            href="https://instagram.com/ovalese"
            target="_blank"
            rel="noreferrer"
            className="border-b border-cream/30 pb-[6px] font-display text-enquire transition-colors hover:border-ochre-bright hover:text-ochre-bright"
          >
            @ovalese
          </a>
        </div>
      </div>

      {/* Form slot reserved — email + Instagram ship first. */}
      <div className="max-w-[280px] text-right font-mono text-caption tracking-caption text-cream/40 uppercase">
        <p>Form comes later — slot reserved</p>
        <p className="mt-2">Mural enquiries: include wall dimensions</p>
      </div>
    </div>

    <div
      className="absolute flex justify-between border-t border-cream/12 pt-5 font-mono text-caption-sm tracking-caption text-cream/45 uppercase"
      style={{ left: 118, right: 72, bottom: 52 }}
    >
      <span>© Denise Cacanando 2026</span>
      <span>Manila, PH</span>
    </div>
  </section>
)

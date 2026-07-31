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
    className="relative flex h-screen w-full flex-col justify-center overflow-clip px-6 text-cream sm:px-0 sm:pl-[118px] sm:pr-[72px]"
  >
    <div className="flex w-full flex-col items-start sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-display text-contact-m sm:text-contact">
          {/*
            The explicit spaces are load-bearing — JSX drops the whitespace around
            a line-broken element, so once these <br>s are display:none at mobile
            the words butt together ("Commissions,walls").
          */}
          Commissions,{' '}
          <br className="hidden sm:inline" />
          walls, <em className="italic">and</em>{' '}
          <br className="hidden sm:inline" />
          everything else.
        </h2>

        <div className="mt-10 flex flex-col gap-[26px] sm:mt-14 sm:flex-row sm:gap-[74px]">
          <div>
            <p className="font-mono text-ph tracking-apparatus text-cream/45 uppercase sm:hidden">
              Email
            </p>
            <a
              href="mailto:hello@denisecacanando.com"
              className="mt-2 block border-b border-cream/30 pb-[6px] font-display text-enquire-m transition-colors hover:border-ochre-bright hover:text-ochre-bright sm:mt-0 sm:inline-block sm:text-enquire"
            >
              hello@denisecacanando.com
            </a>
          </div>
          <div>
            <p className="font-mono text-ph tracking-apparatus text-cream/45 uppercase sm:hidden">
              Instagram
            </p>
            <a
              href="https://instagram.com/ovalese"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block border-b border-cream/30 pb-[6px] font-display text-enquire-m transition-colors hover:border-ochre-bright hover:text-ochre-bright sm:mt-0 sm:inline-block sm:text-enquire"
            >
              @ovalese
            </a>
          </div>
        </div>
      </div>

      {/* Form slot reserved — email + Instagram ship first. */}
      <div className="hidden max-w-[280px] text-right font-mono text-caption tracking-caption text-cream/40 uppercase sm:block">
        <p>Form comes later — slot reserved</p>
        <p className="mt-2">Mural enquiries: include wall dimensions</p>
      </div>
    </div>

    <div className="absolute flex justify-between border-t border-cream/12 pt-5 font-mono text-caption-sm tracking-caption text-cream/45 uppercase left-6 right-6 bottom-[86px] sm:left-[118px] sm:right-[72px] sm:bottom-[52px]">
      <span>© Denise Cacanando 2026</span>
      <span>Manila, PH</span>
    </div>
  </section>
)

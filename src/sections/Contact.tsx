/**
 * 07 · Contact — 100vh, dark ground. The flock lands here and stops.
 *
 * SCAFFOLD: layout and links are final. Still to come — the flock's arrival and
 * idle-wing rest state, which is the ending of the whole scroll.
 */
import type { CSSProperties } from 'react'

// Ground is painted by GroundLayer, behind the canvas — see that file.
export const Contact = () => (
  <section
    id="contact"
    className="relative flex h-screen w-full flex-col justify-center overflow-clip px-6 text-cream sm:px-0 sm:pl-16 sm:pr-10 lg:pl-20 lg:pr-12 xl:pl-[118px] xl:pr-[72px]"
  >
    <div className="flex w-full flex-col items-start lg:flex-row lg:items-end lg:justify-between">
      <div className="par" style={{ '--depth': -8 } as CSSProperties}>
        <h2 className="font-display text-contact-m sm:text-contact">
          {/*
            The explicit spaces are load-bearing — JSX drops the whitespace around
            a line-broken element, so once these <br>s are display:none at mobile
            the words butt together ("Commissions,walls").
          */}
          Commissions,{' '}
          <br className="hidden sm:inline" />
          walls, and{' '}
          <br className="hidden sm:inline" />
          everything else.
        </h2>

        {/* Stacked until lg, and that is measured, not taste: the two links in
            a row at text-enquire are ~760px of Fraunces, and at 768 the
            Instagram handle ran off the right edge of the screen. */}
        <div className="mt-10 flex flex-col gap-[26px] sm:mt-14 lg:flex-row lg:gap-[74px] lg:items-end">
          <div>
            <p className="font-mono text-ph tracking-apparatus text-cream/45 uppercase lg:hidden">
              Email
            </p>
            <a
              href="mailto:hello@denisecacanando.com"
              className="mt-2 block border-b border-cream/30 pb-[6px] font-display text-enquire-m transition-colors hover:border-ochre-bright hover:text-ochre-bright sm:text-enquire lg:mt-0 lg:inline-block"
            >
              hello@denisecacanando.com
            </a>
          </div>
          <div>
            <p className="font-mono text-ph tracking-apparatus text-cream/45 uppercase lg:hidden">
              Instagram
            </p>
            <a
              href="https://instagram.com/upto.denise"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block border-b border-cream/30 pb-[6px] font-display text-enquire-m transition-colors hover:border-ochre-bright hover:text-ochre-bright sm:text-enquire lg:mt-0 lg:inline-block"
            >
              @upto.denise
            </a>
          </div>
        </div>
      </div>

    </div>

    <div
      className="absolute flex justify-between border-t border-cream/12 pt-5 font-mono text-caption-sm tracking-caption text-cream/45 uppercase left-6 right-6 bottom-[86px] sm:left-16 sm:right-10 sm:bottom-[52px] lg:left-20 lg:right-12 xl:left-[118px] xl:right-[72px] par"
      style={{ '--depth': -12 } as CSSProperties}
    >
      <span>© Denise Cacanando 2026</span>
      <span>Manila, PH</span>
    </div>
  </section>
)

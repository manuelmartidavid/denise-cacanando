import { RAIL_STOPS, stopIndexFor } from '~/scroll/scenes'
import { scrollToLabel } from '~/scroll/timeline'
import { useScrollState } from '~/scroll/store'

type Props = {
  /** Cream grounds (About, Merchandise) flip the bar and its type to ink. */
  ground?: 'dark' | 'cream'
}

/**
 * The mobile counterpart to the side rail — README §153. A 62px bar with the
 * same four stops, and a 1px progress line above it.
 *
 * The line is driven by `--progress`, written every frame by the whole-document
 * ScrollTrigger in `scroll/timeline.ts`. That is deliberate: the scrub is a
 * per-frame value and must never enter React state (invariant 1), so it reaches
 * the DOM as a custom property and CSS does the rest.
 *
 * Hidden at `sm` and up, where `SideRail` takes over. The two are never both
 * visible, and they share `stopIndexFor` so their active stop cannot disagree.
 */
export const BottomTicker = ({ ground = 'dark' }: Props) => {
  const { label } = useScrollState()
  const active = stopIndexFor(label)
  const onDark = ground === 'dark'

  return (
    <nav
      aria-label="Sections"
      className={`fixed inset-x-0 bottom-0 z-40 border-t sm:hidden ${
        onDark ? 'border-cream/14 bg-ink/72' : 'border-ink/16 bg-cream/82'
      }`}
      style={{ backdropFilter: 'blur(6px)' }}
    >
      {/* Progress line, sitting on the bar's top hairline. */}
      <div
        className={`absolute inset-x-0 -top-px h-px ${onDark ? 'bg-cream/16' : 'bg-ink/16'}`}
        aria-hidden="true"
      >
        <div className="h-px bg-ochre" style={{ width: 'calc(var(--progress, 0) * 100%)' }} />
      </div>

      <div className="flex h-[62px] items-center justify-between px-[22px]">
        {RAIL_STOPS.map((stop, i) => (
          <button
            key={stop.target}
            type="button"
            onClick={() => scrollToLabel(stop.target)}
            aria-current={i === active ? 'true' : undefined}
            className={`font-mono text-caption-sm tracking-caption-wide uppercase ${
              i === active
                ? onDark
                  ? 'text-ochre-bright'
                  : 'text-ochre-deep'
                : onDark
                  ? 'text-cream/35'
                  : 'text-ink/35'
            }`}
          >
            {stop.n} {stop.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

import { RAIL_STOPS } from '~/scroll/scenes'
import { scrollToLabel } from '~/scroll/timeline'
import { useScrollState } from '~/scroll/store'

/** Gallery labels all light the same rail stop. */
const stopIndexFor = (label: string) =>
  label === 'hero' ? 0 : label === 'about' ? 1 : label === 'contact' ? 3 : 2

type Props = {
  /** Cream grounds swap the difference blend for ink at 45–50%. */
  ground?: 'dark' | 'cream'
}

/**
 * Fixed 44px column at left:30px, vertically centred. Present on every section.
 * Diamonds are CSS squares rotated 45° — no SVG anywhere in this design.
 */
export const SideRail = ({ ground = 'dark' }: Props) => {
  const { label } = useScrollState()
  const active = stopIndexFor(label)
  const onDark = ground === 'dark'

  return (
    <nav
      aria-label="Sections"
      className={`fixed left-[30px] top-1/2 z-40 w-rail -translate-y-1/2 select-none ${
        onDark ? 'mix-blend-difference text-cream' : 'text-ink/50'
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <span className="font-mono text-caption-sm tracking-apparatus">01</span>

        {RAIL_STOPS.map((stop, i) => (
          <div key={stop.target} className="flex flex-col items-center gap-3">
            {i > 0 && <span className="block h-rail w-px bg-current opacity-40" />}
            <button
              type="button"
              onClick={() => scrollToLabel(stop.target)}
              aria-label={`Go to ${stop.label}`}
              aria-current={i === active ? 'true' : undefined}
              className="grid place-items-center p-1"
            >
              <span
                className={`block rotate-45 ${
                  i === active
                    ? `size-[11px] ${onDark ? 'bg-current' : 'bg-ochre-deep'}`
                    : 'size-[8px] border border-current opacity-60'
                }`}
              />
            </button>
          </div>
        ))}

        <span className="font-mono text-caption-sm tracking-apparatus">04</span>
      </div>
    </nav>
  )
}

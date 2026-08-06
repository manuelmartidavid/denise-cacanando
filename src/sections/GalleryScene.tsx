import { useEffect, useRef, type CSSProperties } from 'react'
import { categories, categoryById, merch, type MerchKind } from '~/data'
import { trackProgress } from '~/lib/ring'
import type { Rendered } from '~/scroll/presentation'
import { seamRole } from '~/scroll/seed'
import { activeCount, labelForCategory, type GalleryScene as Scene } from '~/scroll/scenes'
import { setActiveIndex, setMerchFilter, useScrollState } from '~/scroll/store'
import { refreshTimeline, scrollToLabel } from '~/scroll/timeline'
import { Field } from './field/Field'
import { Dial } from './ring/Dial'
import { SnapList } from './ring/SnapList'

type Props = { scene: Scene; rendered: Rendered }

const MERCH_KINDS: MerchKind[] = ['jackets', 'bags', 'shirts', 'earrings']

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 03–06 · Gallery scenes. One component, four configurations.
 *
 * The furniture — title block, category list, progress row — is shared by every
 * presentation. Only the middle changes: a pinned rotating dial, the Artworks
 * field, or the pin-free snap list.
 */
export const GalleryScene = ({ scene, rendered }: Props) => {
  const { activeIndex, merchFilter } = useScrollState()
  const category = categoryById(scene.category)!
  const count = activeCount(scene)
  const index = Math.min(activeIndex[scene.category], Math.max(0, count - 1))
  const onCream = scene.ground === 'cream'

  // Selecting a chip re-blooms a smaller ring, and the refresh is what resyncs
  // it. Not for measurement: the pin length is count-independent and the section
  // is h-screen, so nothing about the layout actually changes. What the refresh
  // does is drive an onUpdate, and that is the only thing that recomputes the
  // ring's rotation against the new piece count. Drop it and the seats re-render
  // correctly while --r stays frozen at the old count's angle until the visitor
  // happens to scroll — measured: 300.10° held for over a second where 109.13°
  // was correct.
  //
  // Guarded against mount (lastFilter starts equal to merchFilter) so a route
  // return that restores scroll is not fought by a refresh that never needed to
  // happen.
  const lastFilter = useRef(merchFilter)
  useEffect(() => {
    if (scene.category !== 'merch') return
    if (lastFilter.current === merchFilter) return
    lastFilter.current = merchFilter
    refreshTimeline()
  }, [merchFilter, scene.category])

  return (
    // Ground is painted by GroundLayer, behind the canvas — see that file.
    //
    // `overflow-clip` on BOTH axes, and `clip` rather than `hidden`. Each
    // section is exactly one viewport and must stay inside it: at short
    // viewports the content overflows its 100vh box, and the transparent
    // grounds no longer hide a neighbour's spill the way an opaque background
    // did. `hidden` would fix the paint and reintroduce a scroll container —
    // tabbing to off-screen content then sets section.scrollLeft and desyncs
    // what a per-frame property placed (this bit as a real bug when Murals
    // was an x-translate track). `clip` clips identically without one.
    <section
      id={scene.label}
      className={`relative h-screen w-full overflow-clip ${
        onCream ? 'text-ink' : 'text-cream'
      }`}
    >
      {/* Title block */}
      <div
        className="absolute z-10 left-6 top-[70px] sm:left-16 sm:top-16 lg:left-20 xl:left-[118px] par"
        style={{ '--depth': -8 } as CSSProperties}
      >
        <h2 className="font-display text-scene-m sm:text-scene">
          {scene.category === 'ovalese' ? <em className="italic">{category.label}</em> : category.label}
        </h2>

        <p
          className={`mt-5 font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/55' : 'text-cream/55'
          }`}
        >
          {pad(count)} pieces
        </p>

        {/*
          Filter chips — merch only. Default is unfiltered; no cart, enquire only.

          They wrap at mobile, as the spec asks: four chips need 366px against
          the 342px a 390 viewport leaves, and shrinking the type to fit would go
          under the 8.5px floor. The wrapped second row then runs ~27px into the
          snap list, whose top is `50%` and knows nothing about how tall this
          block is. The chips win that overlap — they are controls, and the card
          beneath them is a placeholder — so they carry an opaque ground (merch
          is always a cream scene) to stay legible where they cross it.
          PROVISIONAL: the mocked frame does not show a wrapped row.
        */}
        {scene.category === 'merch' && (
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
            {MERCH_KINDS.map((kind) => {
              const n = merch.filter((p) => p.kind === kind).length
              const on = merchFilter === kind
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setMerchFilter(on ? null : kind)
                    setActiveIndex('merch', 0)
                  }}
                  className={`rounded-chip border bg-cream px-3 py-[7px] font-mono text-caption tracking-caption whitespace-nowrap uppercase sm:bg-transparent ${
                    on ? 'border-ochre-deep text-ochre-deep' : 'border-ink/25 text-ink/55'
                  }`}
                >
                  {kind} {pad(n)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/*
        Category list, top right. Hidden below sm, where it collides with the
        title block — the mocked frame replaces it with the count line that is
        already rendered under the title.

        These are JUMP LINKS, not a legend. The gallery is four pinned scenes
        over roughly eleven viewports of scroll, and reaching Merchandise from
        Artworks meant riding all of it; the rail only offers one Gallery stop
        for the whole run. Anyone who already knows they want the walls can go
        straight there.

        The active entry stays enabled rather than being disabled or made a
        span: pressing it returns to the top of the scene you are in, which is
        useful once a ring has been scrolled halfway, and a disabled control
        that looks identical to three working ones is worse than a live one.
      */}
      <nav
        aria-label="Gallery sections"
        className="absolute z-10 hidden text-right sm:block sm:right-10 sm:top-16 lg:right-12 xl:right-[72px]"
      >
        <ul>
          {categories.map((c) => {
            const target = labelForCategory(c.id)
            const current = c.id === scene.category
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => target && scrollToLabel(target)}
                  aria-current={current ? 'true' : undefined}
                  aria-label={`Go to ${c.label}`}
                  className={`font-mono text-caption tracking-caption uppercase transition-colors ${
                    current
                      ? onCream
                        ? 'text-ochre-deep'
                        : 'text-ochre'
                      : onCream
                        ? 'text-ink/30 hover:text-ink/70'
                        : 'text-cream/30 hover:text-cream/70'
                  }`}
                >
                  {c.label} {pad(c.pieces.length)} {current ? '●' : ''}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* The presentation */}
      {rendered === 'field' && <Field scene={scene} activeIndex={index} />}
      {rendered === 'dial' && (
        <Dial scene={scene} activeIndex={index} seam={seamRole(scene.label)} />
      )}
      {rendered === 'list' && <SnapList scene={scene} activeIndex={index} />}

      {/* Progress row — 86px clears the 62px ticker plus a 24px gutter. */}
      <div
        className="absolute z-10 flex items-center gap-4 left-6 right-6 bottom-[86px] sm:left-16 sm:right-10 sm:bottom-[52px] lg:left-20 lg:right-12 xl:left-[118px] xl:right-[72px] par"
        style={{ '--depth': -12 } as CSSProperties}
      >
        <span
          className={`font-mono text-caption tracking-caption ${onCream ? 'text-ink/62' : 'text-cream/60'}`}
        >
          {/* An empty category is 00 / 00, not 01 / 00 — the ordinal only
              exists once there is something to be first. */}
          {pad(count === 0 ? 0 : index + 1)} / {pad(count)}
        </span>
        <span className={`relative h-px flex-1 ${onCream ? 'bg-ink/25' : 'bg-cream/16'}`}>
          <span
            className="absolute top-1/2 size-[7px] -translate-y-1/2 rounded-full bg-ochre"
            style={{ left: `${trackProgress(index, count) * 100}%` }}
          />
        </span>
      </div>
    </section>
  )
}

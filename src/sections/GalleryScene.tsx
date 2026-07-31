import { useEffect, useRef } from 'react'
import { categories, categoryById, merch, type MerchKind } from '~/data'
import { trackProgress } from '~/lib/ring'
import { activeCount, type GalleryScene as Scene } from '~/scroll/scenes'
import type { Rendered } from '~/scroll/presentation'
import { setActiveIndex, setMerchFilter, useScrollState } from '~/scroll/store'
import { refreshTimeline } from '~/scroll/timeline'
import { Dial } from './ring/Dial'
import { SnapList } from './ring/SnapList'
import { Track } from './track/Track'

type Props = { scene: Scene; rendered: Rendered }

const MERCH_KINDS: MerchKind[] = ['jackets', 'bags', 'shirts', 'earrings']

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 03–06 · Gallery scenes. One component, four configurations.
 *
 * The furniture — title block, category list, progress row — is shared by every
 * presentation. Only the middle changes: a pinned rotating dial, a pin-free snap
 * list, or (Murals) the x-translate track.
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
    // tabbing to an off-screen dossier then sets section.scrollLeft and leaves
    // the track desynced from --at. `clip` clips identically without one.
    <section
      id={scene.label}
      className={`relative h-screen w-full overflow-clip ${
        onCream ? 'text-ink' : 'text-cream'
      }`}
    >
      {/* Title block */}
      <div className="absolute z-10" style={{ left: 118, top: 64 }}>
        <p
          className={`font-mono text-label tracking-apparatus uppercase ${
            onCream ? 'text-ochre-deep' : 'text-ochre'
          }`}
        >
          {category.sceneLabel}
        </p>

        <h2 className="mt-4 font-display text-scene">
          {scene.category === 'ovalese' ? <em className="italic">{category.label}</em> : category.label}
        </h2>

        <p
          className={`mt-5 font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/55' : 'text-cream/55'
          }`}
        >
          {pad(count)} pieces
        </p>
        <p
          className={`mt-1 font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/40' : 'text-cream/35'
          }`}
        >
          {rendered === 'dial'
            ? 'Scroll rotates · Snap centres · Click opens detail'
            : rendered === 'list'
              ? 'Swipe to browse · Tap opens detail'
              : 'Two chapters, scrubbed in sequence'}
        </p>

        {/* Filter chips — merch only. Default is unfiltered; no cart, enquire only. */}
        {scene.category === 'merch' && (
          <div className="mt-6 flex gap-2">
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
                  className={`rounded-chip border px-3 py-[7px] font-mono text-caption tracking-caption whitespace-nowrap uppercase ${
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

      {/* Category list, top right */}
      <ul className="absolute z-10 text-right" style={{ right: 72, top: 64 }}>
        {categories.map((c) => (
          <li
            key={c.id}
            className={`font-mono text-caption tracking-caption uppercase ${
              c.id === scene.category
                ? onCream
                  ? 'text-ochre-deep'
                  : 'text-ochre'
                : onCream
                  ? 'text-ink/30'
                  : 'text-cream/30'
            }`}
          >
            {c.label} {pad(c.pieces.length)} {c.id === scene.category ? '●' : ''}
          </li>
        ))}
      </ul>

      {/* The presentation */}
      {rendered === 'dial' && <Dial scene={scene} activeIndex={index} />}
      {rendered === 'list' && <SnapList scene={scene} activeIndex={index} />}
      {rendered === 'track' && <Track scene={scene} activeIndex={index} />}

      {/* Progress row */}
      <div
        className="absolute z-10 flex items-center gap-4"
        style={{ left: 118, bottom: 52, right: 72 }}
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
        <span
          className={`font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/40' : 'text-cream/35'
          }`}
        >
          {rendered === 'dial'
            ? 'Thumbs counter-rotate'
            : rendered === 'list'
              ? 'Swipe centres'
              : 'Planes bend ±8° at edges'}
        </span>
      </div>
    </section>
  )
}

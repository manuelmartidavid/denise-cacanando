import { categories } from '~/data'
import { sceneCount, type GalleryScene as Scene } from '~/scroll/scenes'
import { useScrollState } from '~/scroll/store'
import type { Rendered } from '~/scroll/presentation'

type Props = { scene: Scene; rendered: Rendered }

/**
 * 03–06 · Gallery scenes. One component, four configurations.
 *
 * SCAFFOLD: the title block, furniture and progress row are real and read their
 * counts from the data. The ring itself is not built yet — that is the next
 * piece of work, and the shape it takes (DOM thumbs vs r3f, how rotation
 * reaches the thumbs) is what we're about to brainstorm.
 *
 * When it lands: scroll progress → rotation with snap 1/n, every thumb
 * counter-rotating by −rotation. Scene g3 (Murals) swaps rotation for an
 * x-translate track.
 */
export const GalleryScene = ({ scene, rendered }: Props) => {
  void rendered
  const { activeIndex } = useScrollState()
  const category = categories.find((c) => c.id === scene.category)!
  const count = sceneCount(scene)
  const index = activeIndex[scene.category]
  const onCream = scene.ground === 'cream'

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <section
      id={scene.label}
      className={`relative h-screen w-full overflow-hidden ${
        onCream ? 'bg-cream text-ink' : 'bg-ink text-cream'
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
          {count} pieces
        </p>
        <p
          className={`mt-1 font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/40' : 'text-cream/35'
          }`}
        >
          {scene.presentation === 'dial'
            ? 'Scroll rotates · Snap centres · Click opens detail'
            : 'Two chapters, scrubbed in sequence'}
        </p>
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

      {/* Ring / track mounts here */}
      <div
        className="absolute grid place-items-center"
        style={{ left: '62%', top: '52%', transform: 'translate(-50%, -50%)' }}
      >
        <p
          className={`font-mono text-caption tracking-apparatus uppercase ${
            onCream ? 'text-ink/35' : 'text-cream/30'
          }`}
        >
          {scene.presentation === 'dial'
            ? `Ring — ${count} thumbs on a ${scene.orbit}px orbit`
            : `Track — ${count} dossiers, x-translate`}
        </p>
      </div>

      {/* Progress row */}
      <div
        className="absolute z-10 flex items-center gap-4"
        style={{ left: 118, bottom: 52, right: 72 }}
      >
        <span
          className={`font-mono text-caption tracking-caption ${onCream ? 'text-ink/62' : 'text-cream/60'}`}
        >
          {pad(index + 1)} / {pad(count)}
        </span>
        <span className={`relative h-px flex-1 ${onCream ? 'bg-ink/25' : 'bg-cream/16'}`}>
          <span
            className="absolute top-1/2 size-[7px] -translate-y-1/2 rounded-full bg-ochre"
            style={{ left: `${count > 1 ? (index / (count - 1)) * 100 : 0}%` }}
          />
        </span>
        <span
          className={`font-mono text-caption tracking-caption uppercase ${
            onCream ? 'text-ink/40' : 'text-cream/35'
          }`}
        >
          {scene.presentation === 'dial' ? 'Thumbs counter-rotate' : 'Planes bend ±8° at edges'}
        </span>
      </div>
    </section>
  )
}

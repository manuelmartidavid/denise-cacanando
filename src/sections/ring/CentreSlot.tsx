import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import type { Category, Piece } from '~/data'
import { RING_LOOK, SHAPE_CLASS } from './look'

const CROSSFADE_MS = 380

type Props = {
  category: Category
  piece: Piece | undefined
  onCream: boolean
}

/** Gap between the bottom edge of the plate and the caption block. */
const CAPTION_GAP = 56

const plateOf = (categoryId: Category['id']) => {
  const look = RING_LOOK[categoryId]
  return { width: look.slotW, height: look.slotH }
}

/**
 * RIPPLE SEAM — the whole of the piece-arrival transition lives in this one
 * component. Today it is a DOM cross-fade; when real textures land, the r3f
 * displacement shader replaces the two stacked layers and nothing else in the
 * ring moves. Do not spread transition logic outward from here.
 *
 * The outgoing layer is a SIBLING of the link rather than a child pinned to
 * `inset-0`, so each layer carries its own dimensions and they cross-fade in
 * place. Every plate is the same box per category today, which makes that
 * moot — but it is the arrangement that survives a plate whose size depends on
 * what is on it, and the previous one silently did not.
 */
export const CentreSlot = ({ category, piece, onCream }: Props) => {
  const look = RING_LOOK[category.id]
  const [outgoing, setOutgoing] = useState<Piece | null>(null)
  const last = useRef<Piece | undefined>(piece)

  useEffect(() => {
    if (!piece || last.current?.slug === piece.slug) return
    setOutgoing(last.current ?? null)
    last.current = piece
    const t = setTimeout(() => setOutgoing(null), CROSSFADE_MS)
    return () => clearTimeout(t)
  }, [piece])

  if (!piece) return null

  const shape = SHAPE_CLASS[look.slot]
  const box = plateOf(category.id)

  return (
    <>
      {outgoing && (
        <div
          key={outgoing.slug}
          aria-hidden="true"
          className={`fade-out absolute overflow-hidden border border-ochre/45 ${shape}`}
          style={{ ...plateOf(category.id), transform: 'translate(-50%, -50%)' }}
        >
          <Placeholder
            label={outgoing.images[0]?.alt ?? outgoing.title}
            tone={onCream ? 'cream' : 'focus'}
            className={`size-full ${shape}`}
          />
        </div>
      )}

      <Link
        to={`/${category.path}/${piece.slug}`}
        aria-label={`Open ${piece.title}`}
        className={`absolute block overflow-hidden border border-ochre/45 shadow-glow-strong ${shape}`}
        style={{
          ...box,
          transform: 'translate(-50%, -50%)',
          // The plate morphs between shapes rather than cutting. Off the
          // compositor, but it runs once per snap and never per frame.
          transition: `width ${CROSSFADE_MS}ms ease, height ${CROSSFADE_MS}ms ease`,
        }}
      >
        <Placeholder
          label={piece.images[0]?.alt ?? piece.title}
          tone={onCream ? 'cream' : 'focus'}
          className={`size-full ${shape}`}
        />
      </Link>

      {/* Rides the plate's own height, so it never crosses a tall portrait. */}
      <div
        className={`absolute w-[320px] text-center font-mono text-caption tracking-caption uppercase ${
          onCream ? 'text-ink/62' : 'text-cream/55'
        }`}
        style={{
          transform: `translate(-50%, -50%) translate(0, ${box.height / 2 + CAPTION_GAP}px)`,
          transition: `transform ${CROSSFADE_MS}ms ease`,
        }}
      >
        <p>
          “{piece.title}” · {piece.medium}
        </p>
        <p>
          {piece.size} · {piece.year} — Enquire
        </p>
      </div>
    </>
  )
}

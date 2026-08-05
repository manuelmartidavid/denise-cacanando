import type { CSSProperties, FocusEvent } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import type { Piece } from '~/data'
import { CHAPTER_LABELS, DOSSIER_H, DOSSIER_W, MAX_BEND } from '~/lib/track'

type Props = {
  piece: Piece
  index: number
  count: number
  active: boolean
  /** Forwards the event so the row can tell a Tab from a click. */
  onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * One wall, as a dossier.
 *
 * No full-width photograph of these walls exists, so a wall is NEVER faked as a
 * panorama: one context shot at the widest angle available, plus two detail
 * crops. That decision is the whole reason this scene breaks pattern.
 *
 * The plane bend is pure CSS off the row's --at, clamped to ±MAX_BEND so distant
 * walls sit at a constant angle instead of winding up. Nothing here runs per
 * frame — see `bendDegrees` in lib/track.ts for the contract this transcribes.
 */
export const Dossier = ({ piece, index, count, active, onFocus }: Props) => {
  const context = piece.images.find((i) => i.role === 'context')
  const details = piece.images.filter((i) => i.role === 'detail').slice(0, 2)
  const chapter = piece.location ? CHAPTER_LABELS[piece.location] : ''

  return (
    <Link
      to={`/murals/${piece.slug}`}
      aria-label={`Open ${piece.title}`}
      onFocus={onFocus}
      className={`flex shrink-0 gap-[14px] border p-4 transition-opacity ${
        active ? 'border-ochre/35 opacity-100 shadow-glow' : 'border-cream/10 opacity-45'
      }`}
      style={
        {
          '--i': index,
          width: DOSSIER_W,
          height: DOSSIER_H,
          background: 'var(--color-ink-panel)',
          transform: `rotateY(clamp(-${MAX_BEND}deg, calc((var(--i) - var(--at, 0)) * ${MAX_BEND}deg), ${MAX_BEND}deg))`,
        } as CSSProperties
      }
    >
      {/* Context column — the widest angle that exists, never a stitched panorama. */}
      <div className="flex w-[540px] flex-col gap-3">
        <Placeholder
          label={context?.alt ?? piece.title}
          tone={active ? 'focus' : 'dim'}
          className="flex-1"
        />
        <div>
          <p className="font-display text-dossier">{piece.title}</p>
          <p className="mt-[7px] font-mono text-caption tracking-caption text-cream/50 uppercase">
            {chapter} · {piece.medium} · {piece.year} — Wall {pad(index + 1)} / {pad(count)}
          </p>
        </div>
      </div>

      {/* Detail column. data.test.ts guarantees two crops per wall, so there is
          no empty-slot case to handle here. */}
      <div className="flex w-[230px] flex-col gap-[14px]">
        {details.map((image) => (
          <Placeholder
            key={image.alt}
            label={image.alt}
            tone={active ? 'focus' : 'dim'}
            className="flex-1"
          />
        ))}
        <p className="font-mono text-ph tracking-rail text-ochre-bright uppercase">
          Click → wall page
        </p>
      </div>
    </Link>
  )
}

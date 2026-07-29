import type { CSSProperties, ReactNode } from 'react'

type Tone = 'dark' | 'cream' | 'focus' | 'dim'

const TONE: Record<Tone, string> = {
  dark: 'ph-dark text-cream/45',
  cream: 'ph-cream text-ink/50',
  focus: 'ph-focus text-cream/60',
  dim: 'ph-dim text-cream/30',
}

type Props = {
  /** The mono label naming what belongs here. Use the image's alt text. */
  label: string
  tone?: Tone
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * A striped plate standing in for an image that has not been delivered yet.
 *
 * DELETE THIS COMPONENT once real imagery lands — it is scaffolding, not a
 * loading state. Every one of the 50 pieces currently renders one of these.
 */
export const Placeholder = ({ label, tone = 'dark', className = '', style, children }: Props) => (
  <div
    className={`relative overflow-hidden ${TONE[tone]} ${className}`}
    style={style}
    role="img"
    aria-label={`Placeholder: ${label}`}
  >
    <span className="absolute bottom-2 left-2 max-w-[85%] font-mono text-ph tracking-caption uppercase">
      {label}
    </span>
    {children}
  </div>
)

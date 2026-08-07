import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  HERO_FLOWER_DEFAULTS,
  heroFlowerTuning,
  type HeroFlowerTuning,
} from './heroFlowerTuning'

type NumericKey = keyof typeof HERO_FLOWER_DEFAULTS

type Row = { key: NumericKey; label: string; min: number; max: number; step: number }

/**
 * Ranges are generous on purpose — the point of the panel is to explore past
 * where the shipped numbers sit. Tilts run 0 (flat, face-up) to π (fully
 * inverted); lean covers a whole quarter-turn either side.
 */
const ROWS: Row[] = [
  { key: 'tiltBud', label: 'tilt · bud', min: 0, max: Math.PI, step: 0.01 },
  { key: 'tiltBloom', label: 'tilt · bloom', min: 0, max: Math.PI, step: 0.01 },
  { key: 'leanZ', label: 'lean · z', min: -1.6, max: 1.6, step: 0.01 },
  { key: 'bloomAt', label: 'bloom at', min: 0.05, max: 1, step: 0.01 },
  { key: 'scale', label: 'scale', min: 0.5, max: 8, step: 0.05 },
  { key: 'nudgeX', label: 'nudge · x', min: -4, max: 4, step: 0.05 },
  { key: 'nudgeY', label: 'nudge · y', min: -4, max: 4, step: 0.05 },
]

const snapshot = (): HeroFlowerTuning => ({ ...heroFlowerTuning })

/**
 * DEV-ONLY pose tuner for the hero dahlia. Renders sliders over the page that
 * write `heroFlowerTuning` in place; the flower reads that object every frame,
 * so drags land on the next rendered frame without any React state crossing
 * into the canvas. React state here only mirrors the values for display.
 *
 * "park" holds the scrub at the slider's progress instead of live scroll —
 * bud at 0, `bloomAt` for the open face, 1 for the full scatter — so a pose
 * can be studied without holding a scroll position.
 *
 * Portalled to <body>: the hero section is pinned, and GSAP pins by
 * transform — a `position: fixed` panel inside a transformed ancestor is
 * fixed to the SECTION, not the viewport, and would scroll away with it.
 *
 * Never mounted in production — Hero gates it behind import.meta.env.DEV and
 * a lazy import, so the chunk is not even fetched there. When numbers feel
 * right, "copy" puts them on the clipboard; paste them over
 * HERO_FLOWER_DEFAULTS in heroFlowerTuning.ts to ship the pose.
 */
export const HeroFlowerTuner = () => {
  const [values, setValues] = useState(snapshot)
  const [copied, setCopied] = useState(false)

  const write = (patch: Partial<HeroFlowerTuning>) => {
    Object.assign(heroFlowerTuning, patch)
    setValues(snapshot)
  }

  const copy = async () => {
    const lines = ROWS.map((r) => `  ${r.key}: ${heroFlowerTuning[r.key].toFixed(3)},`)
    try {
      await navigator.clipboard.writeText(`{\n${lines.join('\n')}\n}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard needs focus; the values stay visible in the panel either way.
    }
  }

  const parked = values.progressOverride !== null

  return createPortal(
    <div
      className="fixed bottom-4 left-4 z-[200] w-[280px] rounded-sm bg-black/85 p-4 font-mono text-[11px] leading-relaxed text-white/85 backdrop-blur-sm select-none"
      aria-label="Hero flower pose tuner (dev only)"
    >
      <p className="mb-3 flex items-baseline justify-between tracking-caption uppercase">
        <span>dahlia · pose</span>
        <span className="text-white/40">dev</span>
      </p>

      <label className="mb-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={parked}
          onChange={(e) =>
            write({ progressOverride: e.target.checked ? heroFlowerTuning.bloomAt : null })
          }
        />
        <span>park scrub</span>
        <span className="ml-auto text-white/45">
          {parked ? values.progressOverride!.toFixed(3) : 'live scroll'}
        </span>
      </label>
      {parked && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={values.progressOverride!}
          onChange={(e) => write({ progressOverride: Number(e.target.value) })}
          className="mb-3 w-full"
        />
      )}

      {ROWS.map((row) => (
        <label key={row.key} className="mb-2 block">
          <span className="flex justify-between">
            <span>{row.label}</span>
            <span className="text-white/45">{values[row.key].toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={row.min}
            max={row.max}
            step={row.step}
            value={values[row.key]}
            onChange={(e) => write({ [row.key]: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      ))}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-sm border border-white/25 px-2 py-1 uppercase tracking-caption hover:bg-white/10"
          onClick={copy}
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
        <button
          type="button"
          className="flex-1 rounded-sm border border-white/25 px-2 py-1 uppercase tracking-caption hover:bg-white/10"
          onClick={() => write({ ...HERO_FLOWER_DEFAULTS, progressOverride: null })}
        >
          reset
        </button>
      </div>
    </div>,
    document.body,
  )
}

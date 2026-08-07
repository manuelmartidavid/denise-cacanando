import { useSyncExternalStore } from 'react'

/**
 * The load channel — the same two-channel discipline as `scroll/store.ts`,
 * and for the same reason:
 *
 *   `phase`  — discrete, published to React. Three values, one way only.
 *   `load`   — continuous, mutated in place, NEVER published. The wipe reads
 *              it sixty times a second; routing that through React state
 *              would re-render the whole hero on every frame.
 */

export type LoadPhase = 'loading' | 'revealing' | 'done'

/** Written once the loader completes; absent means "play the loader". */
const FLAG = 'ovalese:loaded'

/**
 * What each milestone is worth. `model` is the only band filled
 * continuously — see reportModelFraction.
 */
export const WEIGHTS = { chunk: 0.4, model: 0.4, frame: 0.2 } as const
export type Milestone = keyof typeof WEIGHTS
const MILESTONES = Object.keys(WEIGHTS) as Milestone[]

/**
 * Decided once per page load and memoised, so the answer cannot change
 * underneath a render. sessionStorage throws in some privacy modes; a
 * portfolio must not white-screen over a loader, so failure means "skip".
 */
let decision: boolean | null = null

export const shouldPlayLoader = (): boolean => {
  if (decision !== null) return decision
  try {
    decision = typeof window !== 'undefined' && !window.sessionStorage.getItem(FLAG)
  } catch {
    decision = false
  }
  return decision
}

const markLoaderSeen = () => {
  try {
    window.sessionStorage.setItem(FLAG, '1')
  } catch {
    // Nothing to do — the loader simply plays again next navigation.
  }
}

/** Per-frame values. Mutated in place; read in rAF, never in render. */
export const load = {
  /** 0–1, the honest load fraction. */
  target: 0,
  /** 0–1, the eased value the wipe actually draws. */
  written: 0,
}

const landed = new Set<Milestone>()
let modelFraction = 0

const recompute = () => {
  let t = 0
  for (const m of MILESTONES) {
    if (landed.has(m)) t += WEIGHTS[m]
    else if (m === 'model') t += WEIGHTS.model * modelFraction
  }
  // Monotonic at the source as well as in the easing: drei's progress store
  // resets to 0 between loads, and the pen must not un-write.
  load.target = Math.max(load.target, Math.min(1, t))
}

export const reportLoad = (m: Milestone) => {
  if (landed.has(m)) return
  landed.add(m)
  recompute()
}

/** Fills the model band from the loading manager's own fraction (0–1). */
export const reportModelFraction = (f: number) => {
  if (!Number.isFinite(f)) return
  modelFraction = Math.min(1, Math.max(modelFraction, f))
  recompute()
}

/** The safety timeout's hammer: a failed fetch must never brick the site. */
export const forceComplete = () => {
  load.target = 1
}

let phase: LoadPhase | null = null
const listeners = new Set<() => void>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export const getPhase = (): LoadPhase => {
  // Resolved lazily rather than at module scope so the sessionStorage read
  // happens on first use, not on import — which keeps this module safe to
  // import from a test with no `window`.
  if (phase === null) phase = shouldPlayLoader() ? 'loading' : 'done'
  return phase
}

const ORDER: LoadPhase[] = ['loading', 'revealing', 'done']

const setPhase = (next: LoadPhase) => {
  const current = getPhase()
  if (ORDER.indexOf(next) <= ORDER.indexOf(current)) return
  phase = next
  for (const fn of listeners) fn()
}

export const beginReveal = () => setPhase('revealing')

export const finishReveal = () => {
  setPhase('done')
  markLoaderSeen()
}

export const useLoadPhase = (): LoadPhase =>
  useSyncExternalStore(subscribe, getPhase, () => 'done' as LoadPhase)

/** Test-only. Nothing in the app may call this. */
export const resetLoadingForTest = () => {
  decision = true
  phase = null
  landed.clear()
  modelFraction = 0
  load.target = 0
  load.written = 0
}

// A dev handle for browser verification — the same spirit as the flower's
// `?tune` panel. Never reaches production.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__ovaleseLoad = {
    load,
    phase: getPhase,
  }
}

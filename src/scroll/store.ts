import { useSyncExternalStore } from 'react'
import type { CategoryId, MerchKind } from '~/data'
import type { Label } from './scenes'

/**
 * Two channels, deliberately separated:
 *
 *   `state`  — discrete, low-frequency. Changes when a ring snaps or a chip is
 *              clicked. Publishes to React, so components re-render.
 *   `frame`  — continuous, every-frame. Rotation and scroll progress. Mutated
 *              in place by the GSAP scrub and read by r3f in useFrame. NEVER
 *              publishes — routing 60fps through React state is what makes
 *              scroll-driven canvas sites stutter.
 */

export type ScrollState = {
  /** Derived from the timeline label — not stored independently. */
  label: Label
  /** The snapped ring position per category. */
  activeIndex: Record<CategoryId, number>
  /** null shows all 12; a value re-blooms a smaller ring. */
  merchFilter: MerchKind | null
}

let state: ScrollState = {
  label: 'hero',
  activeIndex: { artworks: 0, ovalese: 0, murals: 0, merch: 0 },
  merchFilter: null,
}

const listeners = new Set<() => void>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const emit = () => {
  for (const fn of listeners) fn()
}

export const getScrollState = () => state

const set = (patch: Partial<ScrollState>) => {
  state = { ...state, ...patch }
  emit()
}

export const setLabel = (label: Label) => {
  if (state.label !== label) set({ label })
}

export const setActiveIndex = (category: CategoryId, index: number) => {
  if (state.activeIndex[category] === index) return
  set({ activeIndex: { ...state.activeIndex, [category]: index } })
}

export const setMerchFilter = (merchFilter: MerchKind | null) => {
  if (state.merchFilter !== merchFilter) set({ merchFilter })
}

export const useScrollState = (): ScrollState =>
  useSyncExternalStore(subscribe, getScrollState, getScrollState)

/** Per-frame values. Mutated in place; read in useFrame, never in render. */
export const frame = {
  /** 0–1 across the whole master timeline. */
  progress: 0,
  /**
   * The last scalar published per scene: degrees for a dial, fractional wall
   * index for the track. Seeds a freshly-mounted listener so a remounted
   * presentation is not stuck at 0 — nothing else reads it.
   */
  scalar: { g1: 0, g2: 0, g3: 0, g4: 0 } as Record<'g1' | 'g2' | 'g3' | 'g4', number>,
  /** 0–1 through the active scene's pin. */
  sceneProgress: 0,
}

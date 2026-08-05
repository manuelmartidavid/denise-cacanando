/**
 * The rectangles the petal field has to flow around.
 *
 * Petals are a GPU system: every position comes from the vertex shader, and the
 * CPU writes two uniforms a frame no matter how many petals exist (see
 * `Petals.tsx`, and `Stage.tsx` on why the count is free). Colliding them with
 * the artworks the honest way — physics bodies, or CPU-simulated petals —
 * inverts exactly that property, and would replace drift that was tuned by eye
 * with drift that comes out of an integrator.
 *
 * So the artworks come to the shader instead. This module is the one channel:
 * the field publishes its on-screen rectangles in normalised device coordinates
 * and the petal shader treats each as a soft repulsor. Petals slide around a
 * painting rather than passing over it. It is not a simulation and does not
 * claim to be — but it costs one uniform upload a frame, needs no new
 * dependency, and leaves the existing motion intact.
 *
 * NDC rather than px because that is the one space both sides already agree on
 * without either knowing the other's units: the DOM measures in CSS px against
 * the viewport, the petals live in world units at a depth the camera decides,
 * and `Petals.tsx` already knows how to get from one to the other via `uWrap`.
 */

/** Hard ceiling, matched by `AVOID_MAX` in the petal shader. */
export const AVOID_MAX = 8

/** cx, cy, halfW, halfH — all in NDC, so x and y both run -1..1. */
export type AvoidRect = readonly [number, number, number, number]

let rects: AvoidRect[] = []
let version = 0

/**
 * Measure the field's pieces and store the ones actually on screen.
 *
 * Capped at AVOID_MAX and sorted by how central they are, so when more pieces
 * are in frame than the shader has slots the ones nearest the middle — where
 * the petals mostly are — win. A silent cap that dropped whichever came first
 * in DOM order would make the effect flicker as the field pans.
 */
export const publishAvoidRects = (root: HTMLElement | null): void => {
  if (!root) return
  const w = window.innerWidth
  const h = window.innerHeight
  const found: { rect: AvoidRect; centrality: number }[] = []

  for (const el of root.querySelectorAll<HTMLElement>('[data-field-piece]')) {
    const r = el.getBoundingClientRect()
    if (r.right < 0 || r.left > w || r.bottom < 0 || r.top > h) continue
    const cx = ((r.left + r.width / 2) / w) * 2 - 1
    const cy = -(((r.top + r.height / 2) / h) * 2 - 1)
    found.push({
      rect: [cx, cy, r.width / w, r.height / h],
      centrality: Math.abs(cx),
    })
  }

  found.sort((a, b) => a.centrality - b.centrality)
  rects = found.slice(0, AVOID_MAX).map((f) => f.rect)
  version++
}

export const getAvoidRects = (): AvoidRect[] => rects

/** Bumped on every publish, so a consumer can skip an unchanged upload. */
export const getAvoidVersion = (): number => version

export const clearAvoidRects = (): void => {
  rects = []
  version++
}

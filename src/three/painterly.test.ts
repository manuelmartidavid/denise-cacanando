import { describe, expect, it, vi } from 'vitest'
import { ShaderLib } from 'three'
import { painterlyUniforms, patchPainterlyShader, syncPainterlyUniforms } from './painterly'

// The real templates onBeforeCompile receives — #include directives unresolved.
const vert = ShaderLib.physical.vertexShader
const frag = ShaderLib.physical.fragmentShader

describe('patchPainterlyShader', () => {
  it('patches both stages of the stock physical shader', () => {
    const out = patchPainterlyShader(vert, frag)
    expect(out).not.toBeNull()
    expect(out!.vertexShader).toContain('vPainterlyPos = position;')
    expect(out!.vertexShader).toContain('varying vec3 vPainterlyPos;')
    expect(out!.fragmentShader).toContain('painterlyStrokeField')
    expect(out!.fragmentShader).toContain('uEdgeFade')
  })

  it('keeps the stroke grain before lighting and the banding after it', () => {
    const out = patchPainterlyShader(vert, frag)!
    const f = out.fragmentShader
    expect(f.indexOf('diffuseColor.rgb *= 1.0 + stroke')).toBeLessThan(
      f.indexOf('#include <lights_fragment_begin>'),
    )
    expect(f.indexOf('float litLum')).toBeLessThan(f.indexOf('#include <opaque_fragment>'))
    expect(f.indexOf('float litLum')).toBeGreaterThan(f.indexOf('#include <lights_fragment_begin>'))
  })

  it('returns null and reports the anchor when one is missing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = patchPainterlyShader(vert, frag.replace('#include <color_fragment>', ''))
    expect(out).toBeNull()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('#include <color_fragment>'))
    error.mockRestore()
  })
})

describe('syncPainterlyUniforms', () => {
  it('copies tuning values into the uniform set', () => {
    syncPainterlyUniforms({
      strokeScale: 1.5,
      strokeStrength: 0.4,
      bandMix: 0.6,
      chalk: 0.2,
      edgeFade: 0.7,
    })
    expect(painterlyUniforms.uStrokeScale.value).toBe(1.5)
    expect(painterlyUniforms.uStrokeStrength.value).toBe(0.4)
    expect(painterlyUniforms.uBandMix.value).toBe(0.6)
    expect(painterlyUniforms.uChalk.value).toBe(0.2)
    expect(painterlyUniforms.uEdgeFade.value).toBe(0.7)
  })
})

import * as THREE from 'three'

/**
 * The hero dahlia's faded-oil-sketch treatment, layered INTO the GLB's own
 * material via onBeforeCompile rather than replacing it — the standard
 * pipeline keeps doing lights, vertex colours and tone mapping, and three
 * fragments are injected around it:
 *
 *  1. stroke grain  — after <color_fragment>: fBm noise sampled from the
 *     petal-local position in a radial frame (long along the petal, fine
 *     across it), modulating albedo lightness plus a warm/cool drift, with
 *     a chalky desaturate-and-lift toward the page cream.
 *  2. light banding — before <opaque_fragment>: the lit colour's luminance
 *     softly quantized into 3 bands, blended by uBandMix.
 *  3. dry-brush rim — same injection: fresnel-driven lift toward cream,
 *     broken by the stroke noise so the fade is ragged, not a smooth glow.
 *
 * Colour-only on purpose: no alpha is touched, because the 22 double-sided
 * zero-thickness petal meshes would make blended transparency a sorting
 * minefield (see the design doc).
 *
 * The stroke field reads the raw `position` attribute, so paint sticks to
 * each petal through the baked bloom/scatter animation instead of swimming.
 */

export type PainterlyTuning = {
  strokeScale: number
  strokeStrength: number
  bandMix: number
  chalk: number
  edgeFade: number
}

/**
 * Shared across every patched material and written by syncPainterlyUniforms
 * each frame — the same live-channel discipline as heroFlowerTuning itself.
 * uCream is the page background (--color-cream); constructed as a CSS colour
 * so color management lands it in the linear working space.
 *
 * The rim mix (see FRAGMENT_FINISH) blends toward uCream before tone mapping
 * runs, so with the canvas's default ACES tone mapping a fully-faded rim
 * lands slightly darker than the page's literal #f2ece1 — fine at the
 * shipped edgeFade, worth knowing before cranking it higher.
 */
export const painterlyUniforms = {
  uStrokeScale: { value: 2 },
  uStrokeStrength: { value: 0.9 },
  uBandMix: { value: 0.62 },
  uChalk: { value: 0.4 },
  uEdgeFade: { value: 0.4 },
  uCream: { value: new THREE.Color('#f2ece1') },
}

export const syncPainterlyUniforms = (t: PainterlyTuning): void => {
  painterlyUniforms.uStrokeScale.value = t.strokeScale
  painterlyUniforms.uStrokeStrength.value = t.strokeStrength
  painterlyUniforms.uBandMix.value = t.bandMix
  painterlyUniforms.uChalk.value = t.chalk
  painterlyUniforms.uEdgeFade.value = t.edgeFade
}

const VERTEX_DECL = /* glsl */ `
varying vec3 vPainterlyPos;
`

const VERTEX_ASSIGN = /* glsl */ `
vPainterlyPos = position;
`

const FRAGMENT_DECL = /* glsl */ `
varying vec3 vPainterlyPos;
uniform float uStrokeScale;
uniform float uStrokeStrength;
uniform float uBandMix;
uniform float uChalk;
uniform float uEdgeFade;
uniform vec3 uCream;

float painterlyHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}

float painterlyNoise( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( mix( painterlyHash( i ), painterlyHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
         mix( painterlyHash( i + vec3( 0.0, 1.0, 0.0 ) ), painterlyHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
    mix( mix( painterlyHash( i + vec3( 0.0, 0.0, 1.0 ) ), painterlyHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
         mix( painterlyHash( i + vec3( 0.0, 1.0, 1.0 ) ), painterlyHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ),
    f.z );
}

// Two-octave fBm in a radial frame around the flower's +Y axis: the noise
// domain moves fast around the axis (fine ACROSS a stroke) and slowly with
// radius + height (long ALONG the petal). The unit-circle mapping keeps it
// seamless in angle; below 1e-4 radius the frame degenerates, so the heart
// of the flower just reads one stroke — invisible at that size.
float painterlyStrokeField( vec3 p, float scale ) {
  float r = length( p.xz );
  vec2 dir = r > 1e-4 ? p.xz / r : vec2( 1.0, 0.0 );
  vec3 q = vec3( dir * 9.0 * scale, ( r + 0.55 * p.y ) * 0.9 * scale );
  return painterlyNoise( q ) * 0.65 + painterlyNoise( q * 2.7 + 11.3 ) * 0.35;
}
`

const FRAGMENT_GRAIN = /* glsl */ `
float painterlyStroke = painterlyStrokeField( vPainterlyPos, uStrokeScale ) - 0.5;
float painterlyStrokeDrift = painterlyStrokeField( vPainterlyPos + 37.0, uStrokeScale * 1.8 ) - 0.5;
diffuseColor.rgb *= 1.0 + painterlyStroke * uStrokeStrength;
diffuseColor.rgb += vec3( painterlyStrokeDrift, 0.0, -painterlyStrokeDrift ) * uStrokeStrength * 0.18;
float painterlyLum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( painterlyLum ), uChalk * 0.55 );
diffuseColor.rgb = mix( diffuseColor.rgb, uCream, uChalk * 0.3 );
`

const FRAGMENT_FINISH = /* glsl */ `
float painterlyLitLum = dot( outgoingLight, vec3( 0.2126, 0.7152, 0.0722 ) );
float painterlyBandsX = painterlyLitLum * 3.0;
float painterlyBanded = ( floor( painterlyBandsX ) + smoothstep( 0.25, 0.75, fract( painterlyBandsX ) ) ) / 3.0;
float painterlyTargetLum = mix( painterlyLitLum, painterlyBanded, uBandMix );
outgoingLight *= ( painterlyTargetLum + 1e-3 ) / ( painterlyLitLum + 1e-3 );
float painterlyFres = pow( 1.0 - abs( dot( normalize( vViewPosition ), normal ) ), 2.2 );
float painterlyBrushBreak = 0.55 + 0.9 * painterlyStrokeField( vPainterlyPos * 1.7 + 5.0, uStrokeScale );
outgoingLight = mix( outgoingLight, uCream, clamp( painterlyFres * painterlyBrushBreak * uEdgeFade, 0.0, 1.0 ) );
`

type Patched = { vertexShader: string; fragmentShader: string }

/**
 * Pure string patch against the UNRESOLVED shader templates (onBeforeCompile
 * runs before #include expansion, so the directives below are literal
 * anchors). Any missing anchor — a three upgrade renaming a chunk — logs
 * which one and returns null, leaving the plain flower rendering.
 */
export const patchPainterlyShader = (
  vertexShader: string,
  fragmentShader: string,
): Patched | null => {
  const edits: Array<{ stage: 'vertex' | 'fragment'; anchor: string; inject: string }> = [
    { stage: 'vertex', anchor: '#include <common>', inject: VERTEX_DECL },
    { stage: 'vertex', anchor: '#include <begin_vertex>', inject: VERTEX_ASSIGN },
    { stage: 'fragment', anchor: '#include <common>', inject: FRAGMENT_DECL },
    { stage: 'fragment', anchor: '#include <color_fragment>', inject: FRAGMENT_GRAIN },
  ]
  let vertex = vertexShader
  let fragment = fragmentShader
  for (const { stage, anchor, inject } of edits) {
    const source = stage === 'vertex' ? vertex : fragment
    if (!source.includes(anchor)) {
      console.error(`[painterly] missing shader anchor ${anchor} — flower renders unpatched`)
      return null
    }
    const patched = source.replace(anchor, `${anchor}\n${inject}`)
    if (stage === 'vertex') vertex = patched
    else fragment = patched
  }
  // The finish layer injects BEFORE its anchor — banding and rim fade need
  // outgoingLight complete, and opaque_fragment is where it gets written out.
  const out = '#include <opaque_fragment>'
  if (!fragment.includes(out)) {
    console.error(`[painterly] missing shader anchor ${out} — flower renders unpatched`)
    return null
  }
  fragment = fragment.replace(out, `${FRAGMENT_FINISH}\n${out}`)
  return { vertexShader: vertex, fragmentShader: fragment }
}

/**
 * Installs the patch on a GLB material. Guarded by userData so the traverse
 * in HeroFlower — which sees the one shared petal material 22 times — only
 * wires it once.
 */
export const applyPainterly = (material: THREE.Material): void => {
  if (material.userData.painterly) return
  material.userData.painterly = true
  material.onBeforeCompile = (shader) => {
    const patched = patchPainterlyShader(shader.vertexShader, shader.fragmentShader)
    if (!patched) return
    Object.assign(shader.uniforms, painterlyUniforms)
    shader.vertexShader = patched.vertexShader
    shader.fragmentShader = patched.fragmentShader
  }
  material.needsUpdate = true
}

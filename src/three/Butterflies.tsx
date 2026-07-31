import { useMemo, useRef } from 'react'
import * as THREE from 'three'

type Props = {
  count: number
}

/**
 * `THREE.Color` cannot parse `oklch`, so the two tokens this system uses are
 * converted once. Keep the token name — if `index.css` changes, these must be
 * recomputed by hand.
 */
const OCHRE_BRIGHT = '#e8b181' // --color-ochre-bright, oklch(0.8 0.09 62)
const SAGE = '#63ab74' //         --color-sage,         oklch(0.68 0.11 150)

/** README §41 restricts sage to the flock and says "sparingly". */
const SAGE_SHARE = 1 / 6

/** Tuning table from the spec §5. Expected to move during browser verification. */
const RADIUS_WIDE = 13
const RADIUS_TIGHT = 3.5
const ALPHA_THIN = 0.18
const ALPHA_DENSE = 0.85
const FLAP_FULL = 1.15
const FLAP_IDLE = 0.06

/**
 * Eight vertices: two quads sharing a hinge edge at x = 0. `aWing` is -1 on the
 * left pair and +1 on the right, so one `sin` drives both wings in opposite
 * directions.
 *
 * The camera is fixed (Stage.tsx), so nothing is billboarded: a folded pair
 * already reads as the rotated square README §227 requires, and the flap's
 * foreshortening supplies the motion.
 */
const wingGeometry = (): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry()
  const position = new Float32Array([
    0, -0.6, 0, 0, 0.6, 0, -1, 0.6, 0, -1, -0.6, 0, // left
    0, -0.6, 0, 0, 0.6, 0, 1, 0.6, 0, 1, -0.6, 0, //   right
  ])
  const aWing = new Float32Array([-1, -1, -1, -1, 1, 1, 1, 1])
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('aWing', new THREE.BufferAttribute(aWing, 1))
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6])
  return g
}

/**
 * Per-instance variation. `cbrt` on the radius spreads instances evenly through
 * the volume instead of clumping them at the centre, and y is squashed to 0.62
 * because the visible frame is 22 wide by 14 tall.
 */
const instanceAttributes = (count: number) => {
  const aOffset = new Float32Array(count * 3)
  const aPhase = new Float32Array(count)
  const aSpeed = new Float32Array(count)
  const aTint = new Float32Array(count)
  const aScale = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const z = Math.random() * 2 - 1
    const ring = Math.sqrt(1 - z * z)
    const r = Math.cbrt(Math.random())

    aOffset[i * 3] = Math.cos(theta) * ring * r
    aOffset[i * 3 + 1] = Math.sin(theta) * ring * r * 0.62
    aOffset[i * 3 + 2] = z * r * 0.25

    aPhase[i] = Math.random() * Math.PI * 2
    aSpeed[i] = 5 + Math.random() * 4
    aTint[i] = Math.random()
    aScale[i] = 0.05 + Math.random() * 0.045
  }

  return { aOffset, aPhase, aSpeed, aTint, aScale }
}

const VERTEX = /* glsl */ `
  uniform vec3 uTarget;
  uniform float uGather;
  uniform float uSettle;
  uniform float uTime;

  attribute vec3 aOffset;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aTint;
  attribute float aScale;
  attribute float aWing;

  varying float vTint;
  varying float vAlpha;

  void main() {
    // One scalar drives both spread and opacity, so "thins to a residue" cannot
    // drift out of sync with "gathers".
    vec3 centre = uTarget + aOffset * mix(${RADIUS_WIDE.toFixed(1)}, ${RADIUS_TIGHT.toFixed(1)}, uGather);

    float drift = 1.0 - uSettle;
    centre.x += sin(uTime * aSpeed * 0.6 + aPhase) * 0.6 * drift;
    centre.y += cos(uTime * aSpeed * 0.45 + aPhase) * 0.4 * drift;

    float flap = sin(uTime * aSpeed + aPhase) * mix(${FLAP_FULL.toFixed(2)}, ${FLAP_IDLE.toFixed(2)}, uSettle);
    float c = cos(flap * aWing);
    float s = sin(flap * aWing);

    vec3 p = position * aScale;
    vec3 wing = vec3(p.x * c, p.y, -p.x * s);

    vTint = aTint;
    vAlpha = mix(${ALPHA_THIN.toFixed(2)}, ${ALPHA_DENSE.toFixed(2)}, uGather);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + wing, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3 uOchre;
  uniform vec3 uSage;

  varying float vTint;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(mix(uOchre, uSage, step(${(1 - SAGE_SHARE).toFixed(4)}, vTint)), vAlpha);
    #include <colorspace_fragment>
  }
`

/**
 * The instanced butterfly flock — README §184.
 *
 * Every instance is placed in the vertex shader from four uniforms, so the CPU
 * writes four values per frame rather than 1,200 matrices. `instanceMatrix` is
 * never used, which is also why frustum culling is off: three would cull
 * against a bounding box the shader ignores.
 *
 * Alpha blending, not the additive blending `Pollen` uses. Additive over g4's
 * cream ground adds toward white and vanishes; butterflies are solid marks.
 */
export const Butterflies = ({ count }: Props) => {
  const mesh = useRef<THREE.InstancedMesh>(null)

  const geometry = useMemo(() => {
    const g = wingGeometry()
    const a = instanceAttributes(count)
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(a.aOffset, 3))
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(a.aPhase, 1))
    g.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(a.aSpeed, 1))
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(a.aTint, 1))
    g.setAttribute('aScale', new THREE.InstancedBufferAttribute(a.aScale, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTarget: { value: new THREE.Vector3() },
          uGather: { value: 0 },
          uSettle: { value: 0 },
          uTime: { value: 0 },
          uOchre: { value: new THREE.Color(OCHRE_BRIGHT) },
          uSage: { value: new THREE.Color(SAGE) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
}

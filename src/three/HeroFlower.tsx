import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { frame } from '~/scroll/store'
import { useReducedMotion } from '~/scroll/useReducedMotion'
import { heroFlowerTuning as tune } from './heroFlowerTuning'

/**
 * Served from /public rather than imported: useGLTF keys its cache on the URL,
 * and a stable absolute path keeps the preload below pointing at the same
 * entry the hook resolves.
 */
const MODEL_URL = '/3d/dahlia_bloom.glb'

/**
 * Every pose number — the two tilts, the lean, scale, nudge, and where the
 * bloom completes — lives in `heroFlowerTuning`, read LIVE each frame so the
 * dev tuner's sliders land on the next rendered frame. In production nothing
 * writes it and the values are `HERO_FLOWER_DEFAULTS`. What the numbers MEAN
 * (and why the lean is bigger than it looks) is documented on the type.
 *
 * The model authors the flower facing +Y — a dahlia seen from directly above
 * its stem. Tilting the root toward the camera is what turns "botanical
 * diagram" into "bloom looking at you", and the tilt RIDES the scrub: the
 * closed bud reads in profile with the stem anchoring the crop, easing to
 * face the screen in step with the petals opening. `tiltAt` pins the arrival
 * at `bloomAt`, the moment of full bloom, and holds it through the scatter;
 * a bloom that reached face-on any later would still be turning while it
 * explodes.
 */

/** Root tilt for a scrub progress — bud profile easing to screen-facing. */
const tiltAt = (p: number): number =>
  tune.tiltBud +
  (tune.tiltBloom - tune.tiltBud) * Math.min(1, Math.max(0, p / tune.bloomAt))

/** The scrub scalar — the tuner's parked pose wins over live scroll in dev. */
const progressAt = (): number => tune.progressOverride ?? frame.heroProgress

type AnchorRef = RefObject<HTMLDivElement | null>

type BloomProps = { frozen: boolean; anchorRef: AnchorRef }

/**
 * The dahlia itself. Separate from the Canvas because useGLTF suspends, and
 * the Suspense boundary has to sit between this and the canvas root.
 */
const Bloom = ({ frozen, anchorRef }: BloomProps) => {
  const { scene, animations } = useGLTF(MODEL_URL)
  const invalidate = useThree((s) => s.invalidate)
  const size = useThree((s) => s.size)
  const get = useThree((s) => s.get)
  const group = useRef<THREE.Group>(null)

  /**
   * One clip — the export bakes every node's bloom into a single 13.3s
   * "Scene" action. Mapped over anyway: a re-export that splits per node
   * (as flower-exploding.glb did) scrubs identically, with each clip
   * clamping at its own end against the longest duration.
   */
  const { mixer, actions, duration } = useMemo(() => {
    const mixer = new THREE.AnimationMixer(scene)
    const actions = animations.map((clip) => {
      const action = mixer.clipAction(clip)
      action.setLoop(THREE.LoopOnce, 1)
      // Past either end the pose holds — bud below, full bloom above — instead
      // of LoopRepeat's wrap back to the bud mid-scroll.
      action.clampWhenFinished = true
      return action
    })
    return { mixer, actions, duration: Math.max(...animations.map((c) => c.duration)) }
  }, [scene, animations])

  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      // The petals are zero-thickness by design, so backfaces are half the
      // flower — without this they vanish. The export carries doubleSided
      // already; forcing it here is what survives a re-export that loses the
      // flag.
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) material.side = THREE.DoubleSide
      // Bounding volumes are computed from the bind pose, and the scatter
      // carries petals ~6.6 units from where they were measured. The flower is
      // the only thing in this canvas, so culling buys nothing and can only
      // ever blink a petal out mid-flight.
      mesh.frustumCulled = false
    })
  }, [scene])

  /**
   * Places the flower over the DOM anchor — the box the cream circle held in
   * Hero.tsx. The canvas spans the whole section, so the crop's position
   * arrives by measurement instead of being restated in world units: both
   * rects live in the pinned section and move together, which is why the
   * difference is taken rather than either absolute. Keyed on the canvas
   * `size`, the only thing that moves the anchor (its offsets are fixed
   * against the shell). Same DOM↔canvas agreement trick as three/avoid.ts.
   */
  /**
   * The measured frame the tuning values are composed against: the anchor's
   * centre in world units and the anchor↔canvas height ratio `k`, which is
   * what keeps `scale`/`nudge` meaning the same thing at the 980px crop and
   * the 480px mobile crop. Held in a ref and composed with the live tuning in
   * useFrame rather than applied here, so a slider drag moves the flower on
   * the very next frame instead of waiting for a resize.
   */
  const base = useRef<{ x: number; y: number; k: number; align: number } | null>(null)

  useLayoutEffect(() => {
    const g = group.current
    const anchor = anchorRef.current
    if (!g || !anchor) return
    const { gl, viewport } = get()
    const c = gl.domElement.getBoundingClientRect()
    const a = anchor.getBoundingClientRect()
    if (!c.width || !c.height || !a.height) return
    const k = a.height / c.height
    const x = ((a.left + a.width / 2 - c.left) / c.width - 0.5) * viewport.width
    const y = -((a.top + a.height / 2 - c.top) / c.height - 0.5) * viewport.height
    // The anchor publishes which composition it is in via --bloom-align
    // (0 on the centred mobile crop, 1 on the desktop crop) — a multiplier on
    // the tuned nudgeX, which exists to carry the head toward the desktop
    // crop's right edge and would drag it off-centre on mobile. Read here so
    // the breakpoint lives in CSS with the rest of the layout, not restated
    // in a matchMedia.
    const align = Number.parseFloat(getComputedStyle(anchor).getPropertyValue('--bloom-align'))
    base.current = { x, y, k, align: Number.isNaN(align) ? 1 : align }
    // Applied immediately as well: under reduced motion's demand frameloop
    // there may be no next useFrame tick to pick the measure up.
    const b = base.current
    g.position.set(x + tune.nudgeX * b.align * k, y + tune.nudgeY * k, 0)
    g.scale.setScalar(tune.scale * k)
    invalidate()
  }, [size, get, anchorRef, invalidate])

  useEffect(() => {
    for (const action of actions) action.play()
    // Seed from the live scroll value, not 0: a breakpoint flip remounts this
    // mid-page, and snapping a settled bloom back to the bud for one frame is
    // exactly the kind of blink the rest of the site is careful about.
    mixer.setTime(progressAt() * duration)
    scene.rotation.x = tiltAt(progressAt())
    scene.rotation.z = tune.leanZ
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
    }
  }, [mixer, actions, duration, scene])

  useFrame(() => {
    if (frozen) return
    // Un-pause before every setTime, and it is not optional: clampWhenFinished
    // pauses an action at its clip's end, setTime() then resets action.time to
    // 0, and a paused action has an effective timeScale of 0 — so once the
    // scrub touched either end, every later setTime would strand the action on
    // its first frame and the flower would snap to the bud mid-scroll.
    for (const action of actions) action.paused = false
    const p = progressAt()
    mixer.setTime(p * duration)
    // The root turns to camera on the same scalar the clip scrubs on, so the
    // face-on arrival is welded to the bloom completing — see tiltAt. Lean,
    // nudge and scale re-apply here too: all cheap writes, and it is what
    // makes every tuner slider live.
    scene.rotation.x = tiltAt(p)
    scene.rotation.z = tune.leanZ
    const b = base.current
    const g = group.current
    if (b && g) {
      g.position.set(b.x + tune.nudgeX * b.align * b.k, b.y + tune.nudgeY * b.k, 0)
      g.scale.setScalar(tune.scale * b.k)
    }
  })

  /**
   * Reduced motion: one static open bloom, same pattern as the Petals frieze.
   * `frameloop: 'demand'` does not stop useFrame — the `frozen` early-return
   * above is what holds this still; this effect only sets the frame that gets
   * drawn.
   */
  useEffect(() => {
    if (!frozen) return
    for (const action of actions) action.paused = false
    mixer.setTime(tune.bloomAt * duration)
    // tiltAt(bloomAt) is exactly tiltBloom: the still faces the screen, the
    // same pose the live scrub holds at full bloom.
    scene.rotation.x = tiltAt(tune.bloomAt)
    scene.rotation.z = tune.leanZ
    invalidate()
  }, [frozen, actions, mixer, duration, scene, invalidate])

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

type Props = { anchorRef: AnchorRef }

/**
 * The signature floral — the 3D dahlia that replaced the hero's cream circle.
 *
 * Its own canvas rather than a tenant of the fixed Stage: the Stage sits
 * behind the whole document and its systems are placed in viewport space,
 * while this bloom belongs to the hero SECTION and holds through its pin.
 * The canvas fills the section — NOT the crop box — so the exploding petals
 * are clipped by the hero's own overflow-hidden instead of a square boundary
 * hanging in the middle of the composition; the crop box survives as the
 * measured anchor the flower is placed against.
 */
export const HeroFlower = ({ anchorRef }: Props) => {
  const reduced = useReducedMotion()

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={reduced ? 'demand' : 'always'}
      // antialias ON, unlike the Stage: the petals there are alpha-tested
      // texture quads with nothing to aliase, this is real geometry whose
      // silhouette edges shimmer without it.
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 10], fov: 45 }}
      // r3f's default, but stated because it is load-bearing: the vertex
      // colours are linear, and without sRGB output the ember goes muddy.
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
      // Inline style, not a class on a wrapper — r3f writes pointerEvents:
      // 'auto' into its container's inline style, and only merging into that
      // same object overrides it. See NearStage, which learned this the hard
      // way with elementFromPoint.
      style={{ pointerEvents: 'none' }}
    >
      {/* White lights, deliberately: the palette lives in the model's vertex
          colours, and a tinted key would double-apply it. */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 8]} intensity={1.6} />
      <Suspense fallback={null}>
        <Bloom frozen={reduced} anchorRef={anchorRef} />
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL)

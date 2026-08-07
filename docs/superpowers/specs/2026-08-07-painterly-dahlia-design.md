# Painterly dahlia — faded oil-sketch treatment for the hero flower

**Date:** 2026-08-07
**Status:** Approved

## Goal

The hero's 3D dahlia should read as an oil sketch — visible but soft brush
strokes, slightly chalky/desaturated colour, petal rims that fade like dry
brush — while remaining clearly a dimensional flower. The effect must hold
through the whole scrub (bud → bloom → scatter), the reduced-motion still,
and both the desktop and mobile crops.

Chosen intensity: **faded oil sketch** — between "subtle glaze" and "full
impasto". The flower keeps its lighting and vertex-colour palette; the paint
is layered on top of them, not a replacement.

## Approach (decided)

**In-material painterly pass** via `onBeforeCompile` on the GLB's single
`Dahlia_Petal` material. Rejected alternatives:

- *Kuwahara post-process:* strokes live in screen space, so petals slide
  under the paint while animating (shower-door effect); a full-screen pass
  also complicates the transparent hero canvas and costs GPU on a pinned,
  always-rendering section.
- *Painted texture map:* the GLB carries no textures and UVs on only 1 of
  22 meshes — there is nothing to map onto.

In-material strokes stick to the petals through bloom and scatter, add no
render passes, and leave alpha compositing with the page untouched.

## Architecture

New module `src/three/painterly.ts`:

- Exports `applyPainterly(material)` — installs the `onBeforeCompile` patch —
  and the shared uniform set the patch reads.
- `HeroFlower.tsx` calls it inside the existing `scene.traverse` effect (where
  `DoubleSide` and `frustumCulled = false` are already forced), so the patch
  covers all 22 meshes and survives a model re-export.
- The GLB's `MeshStandardMaterial` keeps doing lights and vertex colours; the
  patch injects around the standard chunks rather than replacing the material.

## The paint — three fragment-shader layers

1. **Stroke grain.** A varying carries the petal-local (pre-transform)
   position. Strokes are drawn from petal-local polar coordinates around the
   flower axis: fBm value noise sampled anisotropically — long along the
   radial direction, fine across it — so brush pulls run from the flower's
   heart out along each petal. Because the field is sampled from the local
   position attribute, strokes are glued to petals through the baked
   animation. The grain modulates base colour in lightness plus a small
   warm/cool drift, like uneven paint mixing.

2. **Soft light banding.** The diffuse light response is partially quantized
   into ~3 smoothstepped bands, blended roughly half-and-half with the
   continuous term — shading reads as laid-down strokes without hard toon
   edges.

3. **Chalky fade.** Albedo is slightly desaturated and lifted toward the
   site cream. At grazing angles (fresnel) the lift strengthens, with noise
   breaking the fade so rims dissolve like dry brush. This is a **colour**
   fade, not alpha: 22 double-sided zero-thickness meshes make blended
   transparency a sorting minefield. If truly ragged rims are wanted later,
   an `alphaTest` cutout is the safe escape hatch — out of scope here.

## Tuning

Five knobs join `HeroFlowerTuning`, its defaults, and the dev tuner's
sliders, on the existing live-object channel:

| Knob | Meaning |
| --- | --- |
| `strokeScale` | Spatial frequency of the stroke field |
| `strokeStrength` | How strongly grain modulates colour |
| `bandMix` | Blend between continuous and banded diffuse (0–1) |
| `chalk` | Desaturation + lift toward cream |
| `edgeFade` | Strength of the fresnel dry-brush rim fade |

`heroFlowerTuning.ts` stays free of three.js imports; `HeroFlower`'s
`useFrame` (and the reduced-motion effect) copies the live values into the
shader uniforms, so slider drags land on the next rendered frame. Settled
values get baked into `HERO_FLOWER_DEFAULTS`.

## Error handling

- If `onBeforeCompile` string anchors are missing after a three.js upgrade,
  the patch must fail loudly in dev (console.error naming the chunk) while
  leaving the unpatched material rendering — a plain flower beats a black one.

## Verification

- Dev server + browser screenshots at bud / mid-bloom / full bloom / scatter
  (scrollTo + screenshot to scrub, since the automation tab is rAF-throttled).
- Reduced-motion still (freezes at `bloomAt`) shows the same treatment.
- Mobile crop (`--bloom-align: 0`) spot-checked.
- Tuner sliders move the effect live in dev.

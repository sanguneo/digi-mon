# Puppy v3 — baby Shiba revision

Project-authored Blender geometry and PBR materials; no downloaded model, texture
service or runtime Blender dependency. This revision follows the owner's latest
art direction: a cute baby Shiba with **simpler surfaces and visibly thinner legs**,
not the earlier anatomically lumpy puppy.

## Shape and surface direction

- One clean broad round cranium, short muzzle, lower dark eyes and a small nose.
- Small upright rounded triangular ears, warm tan coat and cream *urajiro* mask.
- A compact oval torso and plush tan/cream curled tail.
- Four continuous, gently tapered legs ending in small integrated rounded soles.
  There are no stacked ellipsoid paws, boot cuffs, shoulder/haunch bulges, toe
  lobes, brow pads or forehead tuft. Leg roots blend inside the torso.
- A small sage bib, cream hem and leather collar/tag repositioned below the low
  baby jaw. Growth remains readable without lengthening the neck.
- Four nonmetallic PBR roles: matte fur (.82 roughness), cloth (.94), leather
  (.57), and restrained satin eyes/nose (.30). No unlit/emissive facial surfaces.

The earlier plump-limb Shiba candidate was also superseded by the owner's explicit
request for thinner legs. The lower right-front limb measures **0.337468 units**
across the exported vertices in Y=0.12–0.32. Both the binary validator and the
independent Three test enforce a width below 0.40, preventing oversized boot-like
feet from silently returning.

## Preserved runtime contract

The identity `puppy-asset` root remains Y-up, forward +Z, with floor Y=0.
`body`, `head`, `tail`, `growth-collar` and `growth-bandana` keep their names.
Head and tail pivots remain `(0, 1.6, 0.5)` and `(0, 1.03, -0.94)`.
The app still owns growth scales, care animation and accessory visibility.
No skeleton, animation clip, texture or extra runtime fetch is introduced.

| Measured property | Baby Shiba revision |
| --- | ---: |
| Triangles | 31,808 |
| Draw primitives | 6 |
| Shared material roles | 4 |
| GLB bytes | 1,062,044 |
| Width / height / depth | 1.5524 / 2.3274 / 2.5497 |
| Lower-front limb width | 0.337468 |

Every authored and exported component is closed manifold. Body, head and tail
are each one connected component after exported UV-seam welding. Normals are
unit length, all geometry and UV triangles have positive area, and all four paws
have ground-contact vertices. Editable `.blend` contains named components and
role materials, with no preview camera, light or floor.

## Rebuild and verify

Run from the repository root; Blender 4.3.2 was used:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/puppy-v3/build_puppy_v3.py
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/puppy-v3/build_puppy_v3.py -- --verify-only
node --test apps/web-garden/art/puppy-v3/verify_puppy_v3.test.mjs
```

Default output is the retained local `puppy-v3.glb`. To regenerate the app asset:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/puppy-v3/build_puppy_v3.py -- \
  --output apps/web-garden/public/models/puppy.glb
```

The JSON report records a portable GLB path and actual file/source hashes,
attributes, geometry/UV areas, bounds, pivots, topology and material values.
The five real Three tests check those bytes, exported topology, independent
runtime cloning, facial ray visibility and the slim lower-limb guard.

## Visual review

The rejected generic puppy GLB and corresponding renders are retained under
ignored `artifacts/model-quality/puppy-cute/`. The slim Shiba was inspected in
front, three-quarter and extreme feeding poses at all four growth scales.
The feeding check uses the actual `.36 / scale + .62` lowering and maximum
head X rotation `.695`, not a rest pose. No neck opening or floor intersection
was visible across those poses.

Optional repeatable PNG review, isolated from authoring/export:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/puppy-v3/render_review.py -- \
  --view three-quarter --size 640 --samples 32 \
  --output artifacts/model-quality/puppy-cute/after-three-quarter.png
```

Use `--view front` or `--view feeding` for other checks and `--source` for a
retained baseline. These are **offline Cycles path-traced QA images**, not a claim
of real-time ray tracing in the mobile WebGL game. Cycles denoising is disabled
because this Blender distribution lacks OpenImageDenoise. Preview lights,
cameras and images never enter the shipped GLB.

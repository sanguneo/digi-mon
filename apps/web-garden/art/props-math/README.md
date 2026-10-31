# Math puppy-yard props — smooth storybook revision

Nine original Blender-authored props, refined to accompany the accepted baby
Shiba. The direction is **smooth, restrained and purposeful**, not inflated,
lumpy or randomly detailed. The Shiba and fish assets are not modified here.

## Inventory and documented purpose

| Runtime ID | Purpose retained | Shape/material refinement | Triangles | Primitives |
| --- | --- | --- | ---: | ---: |
| puppy-ball | Shared yard decoration and ball-play care prop | Seam-aligned curved surface rings remove the old stair-stepped tennis seam; shallow continuous cream inlay in a muted felt ball | 2,688 | 1 |
| soft-bed | Resting-bed decoration | Low front bolster, gently domed cream cushion and one quiet inset seam; warm matte fabric, no empty basin or stacked cushion blobs | 3,120 | 1 |
| puppy-house | Shelter decoration | Rounded upright gable, true arched doorway, thicker soft fascia/eaves and correctly mating roof/walls; coplanar front/side artifact removed | 5,656 | 1 |
| flower-hoop | Flower-hoop decoration/growth scenery | Broader cupped petals and leaves whose roots overlap their flower centers; attached to one continuous warm-wood hoop | 3,144 | 1 |
| water-bowl | Water-bowl decoration | Smooth hollow ceramic profile, rolled cream rim, inset meniscus and restrained ripple arcs | 3,252 | 1 |
| paw-flag | Paw-flag decoration | Gently flowing thick cloth, curved free edge and attached paw applique in the shared sage/cream palette | 1,796 | 2 |
| feeding-bowl | Feeding-action vessel | Matching hollow ceramic bowl with an empty, light interior; real floor below rim, not a painted disc | 2,720 | 1 |
| grooming-brush | Brushing-action tool | Formed oval wood paddle, inset soft pad, one continuous ergonomic handle and 24 safely rounded bristles | 2,686 | 2 |
| dog-food | Feeding-action particles | Nine flatter softly beveled biscuit-like kibble solids at the exact existing pellet centers | 1,728 | 1 |
| **Total** | **All nine IDs preserved** | **Three shared PBR roles** | **26,790** | **11** |

The exported GLB is **1,328,044 bytes**, below 3 MB. All ordinary parts remain
below 3,500 triangles, the house below 8,000, and the library below 40,000.
The editable source contains 143 named closed manifold components. Decorative
piping/petals remain intentionally separate editable solids; this is not claimed
to be a single topological shell for the whole library.

## Preserved application contract

- One identity `math-props` root with all nine direct identity part groups.
- Y-up geometry, existing local footprints and care origins; no normalization or
  layout transforms are baked into runtime assets.
- All non-ball part bounds pass the existing stricter runtime tolerance (0.00637),
  as well as the authoring validator. The brush base remains
  exactly 0.38 × 0.14 × 0.52, the handle ends at Z=-0.65, and bristles reach Y=-0.21.
- The ball stays centered at `(0, 0.3, 0)` with maximum radius 0.3. Its shallow
  groove remains above radius 0.295. The historical baseline's obsolete 0.018
  protruding ring explains the largest legacy-bound delta, not a new footprint.
- The house entrance remains genuinely open; front and upright-gable ray probes
  hit Z=0.45, while doorway rays reach the rear wall at Z=-0.38.
- Center depths below rims: bed 0.2036, empty bowl 0.2175, water surface 0.0925.
- The nine kibble centers, alternating heights, all IDs and visibility/care rules
  remain runtime-owned and unchanged.

Materials are white-base, nonmetallic Principled vertex-color roles: matte (.82),
fabric (.95), satin (.35). Every primitive has finite positions, unit normals,
nondegenerate UVs and opaque vertex colors. No textures, external buffers, skins,
animation clips, cameras or lights are shipped. UVs are overlapping dominant-axis
projections for the texture-free library, not a unique painting atlas.

## Rebuild and validate

Run from the repository root with Blender 4.3.2 or a compatible newer version:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/props-math/build_props_math.py
python apps/web-garden/art/props-math/verify_props_math.py
blender --background --threads 4 apps/web-garden/art/props-math/props-math.blend \
  --python-exit-code 1 --python apps/web-garden/art/props-math/verify_props_math.py
npx vitest run --config apps/web-garden/vite.config.ts \
  apps/web-garden/art/props-math/verify-load.test.ts
```

The builder saves the editable named components, joins temporary export copies,
validates the actual binary and writes `props-math-report.json`. Blender 4.3
requires `use_nodes=True` and re-fetching both UV/color handles after allocating
CustomData attributes; the helper does so explicitly. Opaque-alpha assertions
protect against the stale-UV-handle corruption found during compatibility QA.

The three actual Three/runtime tests cover complete loader attributes/budgets,
independent runtime clones and exact-once disposal, and real doorway/interior ray
hits. These are geometry/lifecycle tests, not assertions about artistic taste.

## Actual rendered review

`render_props_math.py` loads the exported GLB into an isolated Cycles review scene.
All nine parts were inspected in a labeled before/after overview; focused views
inspect the bed cushion, house junctions, brush and flower attachments. Display scales are
fixed from baseline bounds for readable inventory views; runtime footprints are
not changed. Captions and review plinths are presentation-only.

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/props-math/render_props_math.py -- \
  --source apps/web-garden/public/models/props-math.glb \
  --output artifacts/math-props/overview.png --size 1200 --samples 32
```

Add `--part puppy-house` (or any other ID) for a close-up. Use the same script and
settings with a retained baseline GLB for a matched comparison. This is offline
path-traced art QA, not a claim of real-time ray tracing. Preview objects/images
are never saved into the authoring `.blend` or runtime GLB.

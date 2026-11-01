# Orchard tree v2 — Blender-authored runtime asset

Original project geometry, MIT licensed. The active `public/models/tree.glb` is
built here; `art/tree/` preserves v1. Blender is an authoring tool, not a runtime
requirement. No downloaded models, image textures or additional dependencies.

## Art changes

- A less regular, broader domed orchard crown: branch endpoints vary in angle,
  height and reach, rather than repeating identical radial sprays.
- 54 young-tree and 78 mature-tree leaves (previously 45 and 65). Blades have
  rounded shoulders, smooth quadratic midrib camber, gently rolled edges and thin closed-volume silhouettes.
  Leaf overlap, swept curvature and restrained tip/underside color variation create the
  detail; this is not a global subdivision pass.
- The connected trunk/root/branch network keeps smooth junctions. Low-amplitude
  longitudinal bark flutes are modeled into the existing surface, with warmer
  twig and cooler root color gradients instead of high-frequency bark stripes.
- The two articulated sprout leaves use broadened, thinner blades with raised
  surface-following midribs and four curved secondary veins.
- Concealed bark-colored sockets overlap both the fixed branches and moving
  petioles throughout care motion; fruit calyx bases sit inside the fruit shoulder.
  These are small closed geometry forms, not alpha cards or screen-space coverups.
- Blossom pollen beads and stalks use fewer segments, reallocating geometry to foliage silhouette.
  Four-petal persimmon blossoms remain distinct from the fuller four-lobed fruit,
  stems and curled four-lobed calyxes.
- Three opaque, white-base vertex-color Principled roles: dry bark (roughness
  0.88), gently waxed foliage (0.60), and satin petals/fruit (0.38). Closed shells
  use backface culling; no emission, metallic coating or alpha cards are added.

## Runtime contract

Y-up model-local coordinates; identity `tree-asset` and four exclusive stage roots.
The runtime clones only the active stage. Sprout leaf pivots remain `(0,1,0)` and
`(0,1.35,0.02)`; canopy pivots remain `(0,1.6,0)` and `(0,2.15,0)`.
World placement, growth thresholds, care timing, leaf/canopy motion and ownership
of cloned GPU resources are unchanged.

## Rebuild and verify

From the repository root, using Blender 4.3.2 or a compatible newer release:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/tree-v2/build_tree.py
python apps/web-garden/art/tree-v2/verify_tree.py
blender --background --threads 4 apps/web-garden/art/tree-v2/tree.blend \
  --python-exit-code 1 --python apps/web-garden/art/tree-v2/verify_tree.py
```

The builder exports the canonical GLB, saves editable `tree.blend`, then validates
actual GLB binary accessors and the Blender scene before writing `tree-report.json`.
The builder contains no render or image API calls and disables file thumbnails/backups.
The separate optional preview script reads the exported GLB without modifying the
source or introducing preview lights/cameras into the shipped model:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/tree-v2/render_tree.py -- \
  apps/web-garden/public/models/tree.glb 3 artifacts/tree-stage-3.png
```

Use stage indices 0–3. Rendering and visual inspection are authorized for this
upgrade by the user’s 2026-10-31 instruction; older no-preview rules are obsolete.

| Active stage | Triangles | Primitives |
| --- | ---: | ---: |
| Sprout | 4,968 | 4 |
| Young tree | 18,576 | 4 |
| Blossom | 34,864 | 5 |
| Fruit | 34,916 | 5 |
| **Library total** | **93,324** | **18** |

GLB: **3,713,992 bytes**. Three shared materials. Every stage stays below 35,000
triangles; the total stays below 100,000 triangles and 5 MB. The additional 11,956 triangles over v1 are concentrated on curved blade
sections, sprout veins and concealed articulated joints, not uniform subdivision.

The binary validator checks identity roots and exact pivots, independent stages,
finite positions/colors/UVs, unit normals, nondegenerate geometry and UV triangles,
positive-volume closed shells, connected structural networks, genuine growth size,
semantic blossom/fruit counts, and triangle/material/file budgets. Saved `.blend`
reopen checks editable meshes, material node links and absence of external images,
lights, cameras and unapplied modifiers. An actual-mesh BVH probe checks 185
joint poses, including the complete +0.1 Y / +0.045 rad canopy lift and both
±0.38 rad sprout leaf sweeps. Every sampled pose retains positive surface overlap
(minimum approximately 0.00296 model units). Reopen measurements use a 0.0001-unit
comparison tolerance; every positive-contact assertion is rerun.

Cycles studio renders provide path-traced lighting/shadow inspection. They are not
the browser renderer and do not imply browser hardware ray tracing. Runtime loader,
clone, growth/care and resource-lifecycle tests remain necessary; app integration
QA is tracked by the parent task.

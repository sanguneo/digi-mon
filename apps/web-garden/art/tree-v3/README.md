# Orchard tree — original shape, warmer color only

The owner preferred the published v2 shape to the proposed foliage/wood redesign.
This revision therefore preserves **all four original growth-stage geometries**:
leaves, crown, branches, roots, fruit, blossoms, joints and transforms. Only the
vertex-color palette changes to the warmer, quieter green progression. No rejected
v3 shape changes or new roughness settings remain. The directory name `tree-v3`
identifies the later authoring revision, not a geometry redesign.

## Exact preservation, not a visual approximation

`tree-v2-geometry.glb` is the published v2 reference. The builder starts with the
original v2 geometry recipe and writes the editable `tree.blend`. It then transfers
only authored `COLOR_0` bytes into the reference GLB using `color_only.py`.
`verify_color_only.py` independently checks the complete binary: JSON, materials,
node transforms, positions, normals, UVs, indices and every non-color byte must
match. All 43,711 changed color vertices remain within the original vertex layout.
The original three roughness roles (bark 0.88, foliage 0.60, fruit 0.38) are unchanged.
The approved Shiba and clownfish remain byte-for-byte unchanged.

## Rebuild and verify

Run from the repository root with Blender 4.3.2:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/tree-v3/build_tree.py
python apps/web-garden/art/tree-v3/verify_color_only.py
python apps/web-garden/art/tree-v3/verify_tree.py
blender --background --threads 4 apps/web-garden/art/tree-v3/tree.blend \
  --python-exit-code 1 --python apps/web-garden/art/tree-v3/verify_tree.py
```

The original tree validator retains its geometry, manifold, stage, articulation,
semantic feature and resource checks. Reopening the blend checks 185 joint poses.

| Active stage | Triangles | Primitives |
| --- | ---: | ---: |
| Sprout | 4,968 | 4 |
| Young tree | 18,576 | 4 |
| Blossom | 34,864 | 5 |
| Fruit | 34,916 | 5 |
| **Whole library** | **93,324** | **18** |

The canonical GLB is 3,713,992 bytes with three shared materials. The library stays
below 100,000 triangles / 5 MB and each active stage below 35,000 triangles.

## Matched offline visual review

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python apps/web-garden/art/tree-v3/render_tree.py -- \
  apps/web-garden/public/models/tree.glb 3 artifacts/tree-color-only.png 32 three-quarter
```

Use the exact same camera, lights and samples for the reference GLB. All images are
actual Blender Cycles offline path-traced renders, not browser screenshots. The
runtime remains Three.js rasterized PBR; these renders do not prove mobile GPU
output, frame rate, or real-time ray tracing. Browser GPU QA remains unverified.

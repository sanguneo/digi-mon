# Blender growing tree

Original project-authored geometry under the repository MIT license. Blender is
needed only to edit or rebuild the asset, not to run the app.

From the repository root, using Blender 5.2.1 LTS:

```text
blender --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/tree/build_tree.py
```

The command produces `tree.blend`, `public/models/tree.glb` in the garden app, and
`tree-report.json`. `verify_tree.py` validates the exported binary and saved Blender
structure. No image rendering, preview or image analysis is part of this workflow.

## Exclusive stages

The identity `tree-asset` root contains `tree-stage-0` through `tree-stage-3`.
The runtime clones only the selected stage.

| Stage | Geometry | Triangles | Primitives |
| --- | --- | ---: | ---: |
| 0 | Sprout, roots and curved leaves | 4,488 | 4 |
| 1 | Young branching tree and leaf sprays | 14,484 | 3 |
| 2 | Blossoming tree | 33,252 | 4 |
| 3 | Persimmon fruit, stems and calyxes | 29,144 | 4 |

The complete library contains 81,368 triangles in 3,324,892 bytes, with three shared
white-base vertex-color materials and no textures. Each stage is below the 35,000
triangle budget.

Coordinates are model-local Y-up. Sprout leaf pivots and later canopy pivots match the
care contract in `docs/design/companion-art.md`; world placement is applied by the app.
Export checks cover identity transforms, finite attributes, unit normals, usable UVs,
closed shells and a connected structural network for each stage.

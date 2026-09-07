# Korean garden prop library

Original geometry authored with Blender 5.2.1 LTS. No downloaded assets,
textures, images, cameras, lights, animation clips, previews, or renders.
Visual review is intentionally left to the separately delegated Claude agent.

## Deliverables

- `build_props_korean.py`: deterministic complete-library source.
- `props-korean.blend`: editable, separately named feature meshes and two shared
  white-base Principled vertex-color materials.
- `../../public/models/props-korean.glb`: actual embedded-buffer Y-up export.
- `asset-report.json`: real GLB binary-accessor validation and per-part metrics.
- `blend-report.json`: numeric inspection of the reopened editable blend.
- `loader-report.json`: CPU-only Three GLTFLoader and care-transform exercise.
- `baseline-bounds.json` and `measure-baseline.ts`: preserved reference work,
  measured from revision `214416e`; neither is a final asset.

## Reproduce from repository root

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 6 --python-exit-code 1 --python apps/web-garden/art/props-korean/build_props_korean.py
python apps/web-garden/art/props-korean/verify_props_korean.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background apps/web-garden/art/props-korean/props-korean.blend --threads 6 --python-exit-code 1 --python apps/web-garden/art/props-korean/verify_blend.py
bun apps/web-garden/art/props-korean/exercise-glb.ts
```

The builder disables blend backups and file thumbnails, saves the editable
feature hierarchy, then joins features only in memory for the GLB export.
The math helper is neither imported nor executed. No application server is
started and no runtime files are changed.

## Coordinate and material contract

`korean-props` is the sole identity root. Its 14 direct identity groups are:

`moon-chair`, `dandelion-pot`, `tiny-pond`, `cloud-balloon`, `reading-cat`,
`rainbow-flag`, `picnic-basket`, `strawberry-patch`, `mushroom-home`, `bird-bath`,
`pebble-fountain`, `firefly-lantern`, `watering-can`, `sunlight-token`.

Each group owns one joined mesh node, with one or two material primitives.
All nodes have identity transforms and local origin `[0, 0, 0]`. Parts overlap
at the origin by design: isolate a group when editing and clone that group
for placement. The exported up axis is +Y, and front is +Z. Blender stores
the corresponding Z-up vertices. Geometry is fitted per axis to the exact
recorded local bounds; placement, inventory scale, and care motion are not
baked in. In particular, the can and sun keep centered care-tool pivots.

Colors are linear `COLOR_0` data converted from the established warm pastel
palette. Materials are white-base, nonmetallic, opaque Principled surfaces:
matte roughness 0.82 and satin roughness 0.32. Water and firefly light are
colored geometry, not transparent materials or actual lights. UVs use
nondegenerate dominant-axis triangle projections with intentional island
overlap; no texture image or UV atlas is required.

The cat's body, neck and head are a single connected loft. Its ears, limbs,
tail, muzzle and open book remain editable attached features. Vessel walls
have real inner surfaces and recessed floors. The flag is one thick curved
cloth volume, the book has continuous folded covers/pages, and the mushroom
entrance is an opening in a thick wall rather than a painted dark patch.

## Numeric acceptance

The binary validator checks all names and direct groups, every transform,
actual accessor bounds against the baseline, finite attributes, unit normals,
normal/winding agreement, nondegenerate geometry and UV triangles, opaque
vertex colors, closed manifold components after welding exporter splits,
embedded buffers, excluded resource types, and material/primitive/byte/triangle
budgets. It also checks the connected cat body/head component numerically.

Final geometry: 23,842 triangles, 20 primitives, two materials, 1,367,532 GLB
bytes. Every non-cat part is at or below 3,500 triangles (basket: 3,420), and
the cat is 2,300 triangles. Maximum baseline bound error is below 0.0000001
world units. Reports contain exact values and content hashes.

The host Python language server cannot resolve Blender-only `bpy`, `bmesh`,
and `mathutils`; validation therefore includes execution in the specified
Blender interpreter. Blender 5.2 reports a forward-looking `use_nodes`
deprecation for 6.0; this does not prevent source build or export.
No image-based appearance judgment is claimed.

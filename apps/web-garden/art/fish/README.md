# Blender fish

Original project-authored geometry under the repository MIT license. Blender is an
authoring tool only; the app consumes the committed `public/models/fish.glb`.

From the repository root, using Blender 5.2.1 LTS:

```text
blender --background --factory-startup --python-exit-code 1 --python apps/web-garden/art/fish/build_fish.py
python apps/web-garden/art/fish/build_fish.py --verify-only
```

The source produces `fish.blend`, the runtime GLB and `asset-report.json`. It does
not render previews or create image assets. No external models or textures are used.

## Contract

- Identity root `fish-asset`, Y-up and forward +X.
- Independent tail, pectoral-fin and mouth pivots matching the care runtime.
- `growth-markings` from stage 2 and `growth-fin-detail` from stage 3.
- Runtime-owned growth scales and independently colored companion clones.
- Linear vertex colors, white-base material, normals and UVs.

Verified export: 24,660 triangles, six primitives, one material and 717,764 bytes.
The anatomical body core is a closed connected manifold. Numerical validation covers
node transforms, geometry, normals, UVs, budgets and the absence of external image,
texture, camera, light and animation dependencies. No appearance judgment is implied.

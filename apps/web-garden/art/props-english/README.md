# English prop library

Deliverables: `props-english.blend`, `build_props_english.py`,
`validate_props_english.py`, `validation-report.json`, and
`../../public/models/props-english.glb`.

The GLB has one identity root named `english-props`, with these eight direct,
identity-transform mesh children: `shell-arch`, `ribbon-kelp`, `coral-garden`,
`bubble-rock`, `treasure-chest`, `star-lamp`, `fish-food`, `bubble-trail`.
Each child can be cloned independently at its existing application local origin.
The library overlaps parts intentionally; it is not a presentation scene.

The six decoration meshes bake the preserved baseline extents into their vertices.
The care groups preserve the original centers and radii without normalization:
five food pellets alternating X +/-0.055 at Y 0 through 0.34, and five bubble
rings at X `sin(i*1.6)*0.3`, Y `i*0.3`, major radii 0.12/0.19 and tube radius
0.014, each with its original opaque highlight form. Export coordinates are Y-up;
the editable Blender meshes use the equivalent native Z-up coordinates.

Geometry includes a closed fluted/scalloped shell with pearl, five solid twisted
kelp ribbons, three coral stalks with nine side branches, a rippled irregular rock
with four bubble forms, a hollow beveled chest with open curved barrel lid and
two curved bands, and a continuous thick five-lobed starfish with raised nodules.
Disconnected detail components are intentionally joined into their part's mesh.
Three shared white-base Principled roles use opaque vertex colors: matte 0.82,
satin 0.34, wood 0.68 roughness. There are no textures or transparency.
UVs are finite, nondegenerate tri-planar coordinates with intentional overlap,
appropriate for this texture-free library; they are not an atlas for unique paint.

## Reproduce on Windows

From the repository root in Git Bash:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" \
  --background --factory-startup --python-exit-code 1 \
  --python apps/web-garden/art/props-english/build_props_english.py
python apps/web-garden/art/props-english/validate_props_english.py
bun test ./apps/web-garden/art/props-english/english-props.test.ts
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" \
  --background --factory-startup --python-exit-code 1 \
  --python apps/web-garden/art/props-english/validate_blend_english.py
```

The builder disables `.blend1` backups and writes the blend, GLB, and numerical
report. The standalone validator reads the actual GLB bytes and checks hierarchy,
IDs, identity transforms, baseline bounds, care component placement, finite
attributes, unit normals, nonzero geometric/UV triangle areas, opacity, white-base
materials, absence of external resources, and triangle/primitive/file budgets.
Generation is deterministic; no random inputs, network requests, or images.

No preview, render, screenshot, OCR, image generation, or visual analysis was
performed. Visual review is handled separately by the lead. Runtime code and
other asset libraries are outside this deliverable's scope.

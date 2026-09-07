# Blender puppy v1 - historical source

The active puppy now comes from [puppy-v2](../puppy-v2/README.md). This directory
preserves the first design and its measurements. The old rebuild command below
exports v1 to the canonical path; use the v2 publication command for the active app.

Original project-authored geometry, distributed under the repository MIT license.
No downloaded models or textures are included.

## Files

- `build_puppy.py`: reproducible Blender modeling and export source.
- `puppy.blend`: editable Blender project, including the optional preview setup.
- `../../public/models/puppy.glb`: self-contained runtime asset.
- `asset-report.json`: measured export properties and contract checks.

Blender is needed only to edit or rebuild the asset. Running or building the web app
uses the committed GLB and does not require Blender.

## Rebuild from the repository root

Tested with Blender 5.2.1 LTS:

```text
blender --background --factory-startup --threads 8 --python-exit-code 1 --python apps/web-garden/art/puppy/build_puppy.py -- --no-preview
```

On the development Windows machine, replace `blender` with:

```text
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
```

Omit `-- --no-preview` to additionally render the front/side/three-quarter contact
sheet at `artifacts/puppy/contact-sheet.png`. Preview cameras, lights and floor are
created after GLB export, so they are not shipped. Backup `.blend1` saving is disabled.

## Runtime contract

- Y-up, forward +Z, floor at Y=0; identity `puppy-asset` root.
- Independent `body`, `head` and `tail` frames.
- Head pivot `(0, 1.6, 0.5)`; tail pivot `(0, 1.03, -0.94)`.
- Named `growth-collar` and `growth-bandana` accessories.
- Linear vertex colors with white-base fur, satin-face and cloth materials.
- No textures, image dependencies, skeleton or embedded animation clips.
- The app owns growth scaling, animation timing and disposable cloned instances.

The measured export contains 35,112 triangles in six primitives, three materials,
and 1,197,684 bytes. The source validates pivots, bounds, connectivity of the primary
body/skull, unit normals, usable UVs and a 45,000-triangle/3 MB hard budget.

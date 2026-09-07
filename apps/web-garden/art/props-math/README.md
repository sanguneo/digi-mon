# Math puppy-yard prop library

Original procedural geometry authored with Blender 5.2.1 LTS. The interrupted
builder's mesh, lathe, ellipsoid, tube, color and UV helpers are retained; the
polygon extrusion is completed and all nine prop builders are implemented.

## Deliverables

- `build_props_math.py`: complete deterministic authoring and export entry point.
- `props-math.blend`: editable source, 163 named closed manifold mesh components.
- `../../public/models/props-math.glb`: self-contained runtime library.
- `props-math-report.json`: measured per-part bounds, triangles, primitive counts,
  feature probes, material roles, source hashes and output hashes.
- `verify_props_math.py`: independent binary GLB and editable-scene validation.
- `verify-load.test.ts`: real Three.js GLTFLoader integration and placement test.
- `baseline-bounds.json` and `measure-baseline.ts`: preserved baseline from
  revision `214416e`, measured before application placement and care motion.

## Coordinate and material contract

The GLB has one identity `math-props` root, with nine direct identity groups named
exactly as in the table below. Each group has one identity mesh node (the flag's
mesh uses two primitives). Geometry is in local Y-up meters. Blender vertices
are Z-up with the conversion baked into coordinates, never group transforms.
All props intentionally overlap at their local origins in the editable library;
the application owns placement and visibility. No layout or inventory transforms
are included.

There are three shared white-base Principled vertex-color roles: matte (.82
roughness), fabric (.95), satin (.35); metallic is zero. Every primitive exports
finite POSITION, NORMAL, TEXCOORD_0 and COLOR_0. Normals are unit length. UVs use
nondegenerate dominant-axis face projections with intentionally overlapping
islands: suitable for this vertex-colored library, not a unique baking atlas.

No external models, textures, images, cameras, lights, skins or animation clips
are included. The GLB contains the one embedded binary buffer required by the
GLB format, with no external buffers or resource URIs. No images, previews,
renders, OCR or visual analysis were produced during authoring or validation.
Blend previews and numbered backups are disabled.

## Forms and measured budgets

| Direct group | Triangles | Primitives | Authored form |
| --- | ---: | ---: | --- |
| puppy-ball | 2,208 | 1 | Radius .3 at Y .3, recessed winding tennis seam |
| soft-bed | 1,984 | 1 | Continuous padded bolster, depressed cushion, piping and stitches |
| puppy-house | 3,508 | 1 | Hollow arched entrance, floor, upright gables, sloping roof, eaves, planks, pegs and bone plaque |
| flower-hoop | 2,568 | 1 | Continuous hoop, three five-petal cupped flowers and shaped leaves |
| water-bowl | 2,500 | 1 | Thick hollow vessel, rolled rim, recessed water meniscus and ripple geometry |
| paw-flag | 1,796 | 2 | Curved thick tricolor cloth, attached raised pad and four toes, pole and ties |
| feeding-bowl | 1,920 | 1 | Empty hollow vessel with inner walls, floor and rolled rim |
| grooming-brush | 2,476 | 1 | Rounded .38 x .14 x .52 base, contoured negative-Z handle, 24 rounded bristles |
| dog-food | 2,016 | 1 | Nine individually scored kibble volumes at original pellet centers |
| **Total** | **20,976** | **10** | **3 shared materials** |

Final GLB: **987,316 bytes**, below the hard 3,000,000-byte budget.
Editable blend: **521,049 bytes**. Every non-house prop is below 3,500 triangles;
the house is below 8,000 and the total below 40,000.

Local bounds are measured from exported positions, not object bounding-box
metadata. The baseline comparison permits .02 per bound coordinate. The ball
intentionally drops the baseline's protruding .018 ring: its final envelope is
exactly radius .3, Y 0 through .6. Other maximum bound deltas are at most .006369;
the bed, both bowls and brush match within float precision. Full signed min/max,
centers and sizes are in the report. No whole-part rescaling or recentering is
used to conceal geometric drift.

Numerical feature evidence:

- Four entrance rays pass to the house back wall at Z -.38; neighboring wall
  and upright gable rays hit the front wall at Z .45.
- Bed center Y .115 is .248637 below the padded rim.
- Feeding-bowl floor Y .055 is .2175 below the rim. Water Y .183 is .0895 below it.
- Brush handle ends at Z -.65; bristles extend to Y -.21.
- Nine exported disconnected pellets retain center radius .25 and alternating
  local Y 0/.04; the editable scene checks each original center numerically.
- All 163 authored components are closed manifold solids with positive volume.
  The raised paw is tested for physical intersection with the curved cloth.
- Maximum exported normal length error is 1.227e-7; all geometry and UV triangles
  have nonzero area.

## Rebuild and verify

Run these commands from the repository root using Git Bash on Windows:

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/props-math/build_props_math.py
python apps/web-garden/art/props-math/verify_props_math.py
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 apps/web-garden/art/props-math/props-math.blend --python-exit-code 1 --python apps/web-garden/art/props-math/verify_props_math.py
bun test ./apps/web-garden/art/props-math/verify-load.test.ts
```

The builder validates both the authored scene and exported binary and regenerates
the report. The saved blend retains separately named components; only temporary
duplicates are joined for export. The standalone verifier uses only Python's
standard library; Blender-specific checks run when invoked inside Blender.

Verification completed: background build, standalone GLB check, saved-blend
reopen/check, and the loader test (1 pass, 196 assertions, one run). The loader
test loads the actual shipped GLB, verifies materials and attributes, checks all
bounds, and clones/translates each part independently without touching runtime
code or starting the application.

Editor diagnostics were run. Python's language server cannot resolve Blender's
embedded `bpy`, `bmesh` and `mathutils` modules and reports untyped-script warnings;
those modules and the full scripts were exercised successfully inside Blender.
No type-check suppression or test skips are used. Visual review was explicitly
out of scope; the lead handles the separate independent review.

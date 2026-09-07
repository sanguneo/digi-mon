# Puppy v2 - active model

Fresh warm-cream toy/chibi puppy, authored from new cross-sections and soft
volumes. This is not a modification or import of the previous puppy geometry.
Only generic coordinate/export/connected-remesh mechanics follow the existing
asset pipeline. The live `public/models/puppy.glb` is now exported from this source.
The detailed authoring evidence below records the initial staging phase. After the
prop integration baseline passed, the lead published this model through `--output`.
A separate, bounded Claude Opus check of the actual-app candidate capture passed.

## Delivered files

- `build_puppy_v2.py`: self-contained Blender source, defaulting to this directory.
- `puppy-v2.blend`: editable connected meshes, pivot groups, vertex colors and
  Principled materials. No camera, lights, images, or preview scene.
- `puppy-v2.glb`: retained candidate runtime-format export.
- `asset-report.json`: actual binary/source numeric validation results and hashes.
- `verify_puppy_v2.test.mjs`: repeatable real Three loader/runtime-cloning tests.
- `three-report.json`: independently loaded geometry/material/bounds report.
- `verification-audit.json`: explicit-output rebuild comparison and untouched
  canonical asset hash.
- `build.log`, `verify.log`, `output-check.log`, `three-tests.log`: execution logs.

## New design and interpretation

The broad, gently squared cream cranium, single low off-white muzzle and short
caramel droplet ears are remeshed into **one connected head surface**. There are
no long pendant hair panels, human-style eye sockets, sclera, eyelids, or glossy
eye materials. Modest dark oval eyes turn with the local facial surface rather
than projecting straight forward. Their authored height is 0.21 (14.2% of the
1.48 cranium height); center separation measures 0.8143. Each has a small
physically lit off-white highlight disc. The nose is a softened bean/triangle,
with a small smile and short center line on the muzzle.

The torso, broad chest/neck bridge, four short thick legs and oversized planted
paws form **one connected body surface**, with blended transitions rather than
separate joint balls. The rear capsule still reaches Z=-1.0768 to receive the
unchanged tail pivot. A short round-section crescent curls back toward the rump.
The caramel collar and off-white softly rounded bandana are independent growth
accessories and reuse the body palette rather than adding accent colors.

Fixed pivots and the care envelope take precedence over the brief's conflicting
literal ratios: the large cranium straddles the unchanged head pivot; the broad
neck bridges the squat body without lowering the whole dog. The authored short
ear range is Y=1.735..2.24, ending near the lower eye region rather than the jaw.
The authored lower-leg display region is Y=0.29..0.58 and paw width is 0.60.
These design parameters are distinguished from measured exported bounds below.

"Flat palette" means four color roles (cream, caramel, off-white, chocolate)
with narrow vertex-color transitions, **smooth normals and matte physical
lighting**. It does not mean faceted normals or unlit body materials. All three
materials are white-base, metallic=0 Principled materials, loaded by Three as
vertex-colored `MeshStandardMaterial`; roughness is 0.90 / 0.84 / 0.96. No
textures, images, animations, skins, morph targets or glTF extensions are used.

## Measured staging results

| Metric | Actual result |
| --- | ---: |
| Blender | 5.2.1 LTS |
| GLB bytes | 1,073,828 |
| Triangles | 32,056 |
| Mesh primitives | 6 |
| Materials | 3 |
| Width / height / depth | 2.023117 / 2.408007 / 2.852415 |
| Minimum XYZ | (-1.011548, 0, -1.373094) |
| Maximum XYZ | (1.011569, 2.408007, 1.479321) |
| Rounded muzzle front Z | 1.421708 |
| Nose/front-detail maximum Z | 1.479321 |
| Body / head / tail connected components | 1 / 1 / 1 |
| Body / head / tail nonmanifold source edges | 0 / 0 / 0 |
| Ground-contact vertices across the four paws | 61 / 57 / 60 / 59 |
| Maximum exported normal-length error | 1.1921e-7 |

The facial detail mesh intentionally contains separate eyes, highlight discs,
nose and mouth strokes, all under the head group. Its curve-cap rims remain
separate source vertices; it is not claimed to be a single manifold sculpt.
The primary head includes both ears and the muzzle and is a closed manifold.
Exported body/head/tail connectivity and closedness are independently checked
after exact position welding of UV seams in the Three test.

The identity root is `puppy-asset`. Its independent children are:

| Group | Y-up pivot |
| --- | --- |
| `body` | (0, 0, 0) |
| `head` | (0, 1.6, 0.5) |
| `tail` | (0, 1.03, -0.94) |
| `growth-collar` | (0, 0, 0) |
| `growth-bandana` | (0, 0, 0) |

Coordinates are Y-up, forward +Z, ground Y=0. `POSITION`, `NORMAL`, `TEXCOORD_0`
and `COLOR_0` are present on every primitive; normals are unit length, UVs have
nonzero span and stay in [0,1], colors are finite linear RGB in [0,1], and triangle
indices/areas are valid. Opaque alpha is implicit in the exported RGB colors.

## Rebuild and verify

Run from the repository root in Git Bash. The command uses six CPU threads on
the 12-logical-core workstation and never renders or creates a preview:

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 6 --python-exit-code 1 --python apps/web-garden/art/puppy-v2/build_puppy_v2.py
```

Default output is `apps/web-garden/art/puppy-v2/puppy-v2.glb`. The blend and JSON
report always stay in this staging directory. File thumbnails and numbered
backups are disabled before saving. There is no preview function or image API
path to accidentally execute.

Repeat validation without rebuilding geometry:

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 6 --python-exit-code 1 --python apps/web-garden/art/puppy-v2/build_puppy_v2.py -- --verify-only
node --test apps/web-garden/art/puppy-v2/verify_puppy_v2.test.mjs
```

Blender prints `PUPPY_V2_REPORT` with `status: PASS`. The Node command passed all
four tests in one execution: actual GLTF loading/materials/bounds, primary
exported connectivity, actual runtime resource cloning/pivot isolation, and
numeric face-ray visibility. No test uses timers, sleeps, mocked loaders or
prose assertions.

The Three tests load the exact `glb` path recorded by the most recent validator,
so both default staging and explicit canonical exports retain the hash check.
Regenerate the report with the desired `--verify-only` / `--output` combination
before running these tests from a different checkout.

The `--output` option was exercised using a temporary staging GLB. That rebuild
had identical JSON metadata, vertex attributes and oriented triangle sets.
Blender reordered some facial triangles in the index stream, so byte-identical
rebuild hashes are **not** promised. The override-check GLB was removed after
comparison; its log and hashes remain in the audit report.

### Canonical export

This command was executed after the props baseline and Opus candidate check passed:

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 6 --python-exit-code 1 --python apps/web-garden/art/puppy-v2/build_puppy_v2.py -- --output apps/web-garden/public/models/puppy.glb
```

An absolute GLB path works with the same `--output` option. Explicit override
rebuilds the model through Blender's exporter; it does not copy the old asset.
Running any override updates the staging report's GLB path to that destination;
`--verify-only` without an override restores the report to the staging GLB.

## Evidence and limits

- Staging GLB SHA-256:
  `3e8b5e82a1f97ca23fc0cc615ba8dd7c3a6e7c8b05fe70e59bb37fdd148694fb`.
- Canonical v1 GLB SHA-256 before and after the initial staging-authoring task:
  `f267220030083e51a22f5828dac2f147dd9214b61b20a146adcafae14956a322`.
- Python AST validation passed. The JS test has no editor diagnostics. The
  Python editor's remaining errors are unresolved `bpy`, `bmesh`, `mathutils`
  imports outside Blender's embedded interpreter. Unknown-type warnings also
  remain visible; none are suppressed. Blender execution resolves the modules
  and passes the actual validators.
- The asset author used no image generation, image reading, Fable call, Blender
  render/preview or screenshot. Numerical ray probes confirm exposed facial
  features, not artistic appearance. The later app-capture check was Opus-only.
- The initial authoring task left runtime and canonical files untouched. The lead
  subsequently exported the canonical GLB and validated it with the prop integration.

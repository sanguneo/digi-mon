# Approved cute clownfish companion — fish v3

The user approved the **v5 cute-character design on 2026-10-31 at 09:37 UTC**.
The authoring directory remains `fish-v3`; v5 identifies the reviewed delivery,
not a new runtime format. `public/models/fish.glb` is an exact copy of the approved
staging GLB. No remote publication or deployment is implied.

## Character and geometry

This is an original stylized companion, not a licensed film model. Its broader
head, large shallow warm iris/pupil and small upturned smile deliberately favor
character appeal over strict anatomical proportions. Compared with the preceding
cute draft, the eye outline is 33.75% wider and 31.43% taller, while the connected
body core is 7.51% shorter. There is no human white sclera or grafted cheek/nose
sphere.

The controlled forehead, jaw and tapered rear curves preserve a compressed fish
profile, formed short snout, narrow caudal peduncle, continuous dorsal, posterior
anal fin, pelvic pair and rounded fan tail. Required anatomy is present at baby
stage; growth adds restrained fin-edge details rather than another large sail.

Three cream bars and thin dark borders are vertex colors, not raised collars.
The middle bar bulges forward, and its color continues onto dorsal/anal surfaces.
Longitudinal rings follow the curved paint boundaries to prevent diagonal
stair-step edges. Fins are closed surfaces with buried roots; they are not all
welded to the body loft. A subtle median-fin root crease can remain under grazing
light, but the tested attachment patches stay enclosed throughout care motion.

Three opaque, white-base, nonmetallic PBR surface roles use vertex colors:

| Surface | Roughness |
| --- | ---: |
| Satin skin | 0.50 |
| Soft fins | 0.64 |
| Eye | 0.30 |

No texture, external buffer/image, downloaded mesh, emissive lighting bake or
extension-only shader is required. Geometry normals and PBR materials react to
the app's actual lighting. Offline Cycles previews are **not browser ray tracing**.

## Approved asset measurements

| Item | Result |
| --- | ---: |
| GLB size | 1,017,224 bytes |
| Triangles, including hidden growth details | 32,608 |
| Meshes / draw primitives / material roles | 7 / 7 / 3 |
| Connected body-core length / height / width | 1.355 / 0.730 / 0.360 |
| Whole asset length / height / width | 1.733 / 0.975 / 0.502 |
| Boundary / nonmanifold edges | 0 / 0 on every closed component |
| Degenerate geometry / UV triangles | 0 / 0 |

The asset exceeds the 30k soft triangle target but remains below the 35k hard
limit, 3 MB size limit, seven primitives and three materials. UV charts occupy
their normalized domain; exported normals, colors and UVs are validated.

Approved hashes:

- Source: `ddae42a4aad559a34547f0f5b24541b1a5f747e479876ed2f32bc148ffbb4055`
- GLB: `d5709e719fdcb54aa2f9502299411f15c07be9607b70724d3e55e85d4361a08b`
- Editable Blend: `8f7ff24b2fa81ebfe3a12c401d12c502051408a606aa6d2cbe52f8d0c658bb62`

## Runtime contract and focused verification

Identity root `fish-asset`, Y-up, +X forward. The seven mesh names remain `body`,
`tail`, `pectoral-fin`, `mouth`, `growth-markings`, `growth-fin-detail` and
`eye-detail`. Legacy animation pivots are unchanged:

- Tail: `(-.65, 0, 0)`; its actual root extends beneath the shorter body's peduncle.
- Pectoral: `(0, -.13, .28)`; the actual root is inward of this external pivot.
- Mouth: `(.68, -.05, 0)`; only local Y scales for feeding.
- Growth nodes remain present, becoming visible at stages 2 and 3.

Fresh focused validation uses **Blender 4.3.2, Three.js 0.185.1 and Node 24**:

- Builder's binary validation passed: budgets, names/pivots, materials, attributes,
  bounds, closed topology, UV areas and normals.
- All **seven actual-GLB tests passed again after approval**, using the original
  application's `cloneModelAsset` implementation and the exact Three version.
  They cover resource ownership, proportions, curved bands and fin continuation,
  median-fin enclosure, eye visibility, animated roots and mouth-only opening.
- Nine actual exported root vertices were checked through 17 angles per moving
  attachment against the isolated connected body core. Minimum enclosure was
  **0.03702 for the tail** and **0.04989 for the pectoral**, above the 0.025 check.
- The saved Blend reopened with seven meshes, three materials and no review
  cameras, lights or images. Actual exported-GLB side, three-quarter and extreme
  care-pose Cycles views were inspected and the appearance was user-approved.

`asset-report.json`, `three-report.json` and `joint-report.json` record the actual
approved binary. The Node report's `renderer_or_image_analysis_performed: false`
refers only to that numerical test, not to the separate Blender visual review.
The test file was reconstructed during workspace recovery and then rerun; no
unverified claim of its pre-recovery byte identity is made.

The approved bytes were then integrated into the recovered full repository.
The complete garden suite passed **292/292**, the strict garden TypeScript/build
passed, and the dedicated puppy/fish tests passed **12/12**. Root tests passed
**256/256** and the root verification chain passed. These are code-level checks,
including the actual fish loader, friend palette, care, cloning and camera tests.
Browser GPU execution remains unverified; no browser visual QA or FPS claim is
made. Existing dependency-audit findings and bundle warnings are recorded in the
final verification report rather than hidden by unrelated dependency changes.

## Reproduction

Run from the repository root after installing its dependencies:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/fish-v3/build_fish_v3.py
python apps/web-garden/art/fish-v3/build_fish_v3.py --verify-only
node --test apps/web-garden/art/fish-v3/verify_fish_v3.test.mjs
cmp apps/web-garden/art/fish-v3/fish-v3.glb apps/web-garden/public/models/fish.glb
```

The default builder writes only `art/fish-v3/fish-v3.glb`, its editable Blend and
report. It does **not** silently replace the runtime model. A canonical update
requires an intentional explicit copy/export; the approved integration uses the
exact GLB bytes above. Rebuilding a Blend can change container metadata, so do not
assume a regenerated Blend will have the same file hash.

The helper imports the actual GLB under a consistent studio setup:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/fish-v3/render_fish_v3.py -- --asset apps/web-garden/art/fish-v3/fish-v3.glb --output /tmp/clownfish.png --samples 48 --size 660 --view three-quarter
```

`--view side`, `--stage 3`, `--tail-angle`, `--fin-angle`, `--mouth-scale` and
`--lighting raking` support additional review. Cameras/lights/backgrounds are
never included in the runtime GLB or authoring Blend.

## Reference provenance

The species basis was informed by actual *Amphiprion ocellaris* photographs and
written descriptions from the [Florida Museum](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/clown-anemonefish/)
and [FishBase](https://www.fishbase.se/Fieldguide/FieldGuideSummary.php?c_code=036&genusname=Amphiprion&speciesname=ocellaris).
The final proportions are intentionally stylized after user feedback, rather
than asserted to be anatomically exact. Reference photographs were for internal
study only and are not included, republished, textured onto the model or needed
at runtime. All delivered meshes, vertex colors and Blender previews are authored
for this project.

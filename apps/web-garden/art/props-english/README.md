# English props — rounded marine miniatures

Eight locally authored Blender props support the approved orange clownfish without
changing that character, catalog IDs, placements or care behavior. The library is
an overlapping asset collection at original local origins, not a composed scene.

## Preserved catalog intent

The intent comes from `src/garden-worlds.ts` and `docs/design/companion-art.md`,
not a new generic prop theme. No catalog purpose or action has been replaced.

| ID | Documented purpose | Refinement serving that purpose |
| --- | --- | --- |
| shell-arch | 조개 쉼터 — a pearly resting shell | Concave shell and open pearl cradle |
| ribbon-kelp | 리본 물풀 — green ribbon-like plants | Thin swept/cupped blades, not thick stalks |
| coral-garden | 산호 정원 — hide-and-seek between coral | Open branched spaces and smooth joined forks |
| bubble-rock | 거품 바위 — round bubbles rising | Quiet matte stone with four airy rings |
| treasure-chest | 보물 상자 — shining underwater treasure | Recognizable hollow wooden chest, lid/hinges and satin hardware |
| star-lamp | 불가사리 등불 — a small underwater star | Soft warm five-arm star motif; no new runtime light |
| fish-food | Feed care — approach/eat small morsels | Five quiet grain pellets at the original care centers |
| bubble-trail | Bubble care — follow a short rising trail | Five shallow rings at the original animation origins |

## What changed

- **shell-arch:** thick concave fluted upper valve, an actual open lower dish and a
  seated pearl. The upper interior is measurably recessed, not a flat painted fan.
- **ribbon-kelp:** five swept, cupped thin blades with soft cross-sections, tapered
  tips and a restrained sea-green gradient, rooted in the existing footprint.
- **coral-garden:** three trunks with rounded branches and a fused shared base.
  Outward-wound input volumes are locally voxel-unioned, smoothed and reduced to
  a bounded mesh. Forks are genuinely connected, not overlapping tube sleeves.
- **bubble-rock:** one softly irregular matte stone instead of glossy added lumps;
  four airy satin bubble rings with small curved glints.
- **treasure-chest:** hollow interior, rounded wooden front planks, curved beveled
  lid, quiet planar wood normals, latch, bands and actual back hinge knuckles.
  Dry wood and satin hardware retain different material roles.
- **star-lamp:** one puffed five-arm volume with blunt rounded tips and a soft rim;
  the earlier array of raised nodules is removed to reduce visual noise.
- **fish-food:** five warm, subtly shaped grain pellets, retaining exact centers
  and 0.11-unit diameter envelopes rather than becoming large decorative objects.
- **bubble-trail:** smooth shallow rings and small curved glints; original five
  ring radii, group origins and highlight centers are unchanged.

The shapes use gentle cream, sea-green, muted coral, stone and warm wood colors.
Three shared white-base, opaque, nonmetallic PBR roles separate matte organic/stone
(roughness 0.80), satin shell/bubbles/hardware (0.36) and dry wood/grain (0.68).
There are no textures, downloaded models, external buffers, image dependencies,
baked light maps or runtime Blender requirements.

## Runtime contract and measured budget

Root `english-props` has eight direct identity-transform parts:
`shell-arch`, `ribbon-kelp`, `coral-garden`, `bubble-rock`, `treasure-chest`,
`star-lamp`, `fish-food`, `bubble-trail`. All exported geometry is Y-up. The editable
Blend stores equivalent Z-up geometry, with identity transforms on its objects.

All six catalog props retain the exact historical bounding boxes in
`baseline-bounds.json`, within 2e-6. The two care groups are not normalized: food
centers remain alternating X ±0.055 at Y 0…0.34; the five bubble centers remain
`(sin(i*1.6)*0.3, i*0.3, 0)`, with major radii 0.12/0.19 and the original shallow
depth envelope. No runtime, saved placement, particle origin or timing was edited.

| Part | Triangles | Primitives |
| --- | ---: | ---: |
| shell-arch | 3,028 | 1 |
| ribbon-kelp | 2,204 | 1 |
| coral-garden | 3,398 | 1 |
| bubble-rock | 2,936 | 2 |
| treasure-chest | 2,900 | 2 |
| star-lamp | 2,880 | 1 |
| fish-food | 1,440 | 1 |
| bubble-trail | 3,260 | 1 |
| **Total** | **22,046** | **10** |

The GLB is **915,072 bytes**, below 30,000 triangles / 3 MB. Every part remains below
3,500 triangles and below three primitives. All parts share just three materials.
Two-material GLB parts can load as a Three.js Group containing primitive meshes;
the named direct part root and its identity transform remain intact, as required
by the existing prop loader/instancer.

UVs are finite, nondegenerate tri-planar coordinates with intentional overlap,
appropriate for texture-free vertex colors, not a unique texture-paint atlas.
Color values and opaque alpha are independently checked in the exported binary.
The builder fully assigns Color before creating UVMap, avoiding invalidated
Blender CustomData handles.

## Reproduce and validate

Tested with Blender **4.3.2**, Node **24** and the repository's Three.js dependency.
From the repository root:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/props-english/build_props_english.py
python apps/web-garden/art/props-english/validate_props_english.py
node --test apps/web-garden/art/props-english/english-props.test.ts
blender --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/props-english/validate_blend_english.py
```

The builder writes the editable Blend, canonical English-prop GLB and actual-byte
report. No other subject library or character asset is written. The standalone
Python validator checks all IDs/transforms, exact extents and care components,
finite normals/UVs/colors, nonzero triangle areas, opacity and resource budgets.
It also requires one connected coral volume and one connected star volume.

The four real-GLB Node tests pass: parts/bounds/budgets, semantic surface separation,
a front ray test proving the shell recess, and the application's actual cloner
with independently owned resources and unchanged catalog/care transforms.
The saved Blend reopens with eight mesh objects, three materials, positive closed
manifold geometry and no review cameras/lights/images/actions. `validation-report.json`
and `blend-validation-report.json` record numerical evidence.

## Actual visual review

The optional helper imports the exported GLB, never a substitute illustration:

```bash
blender --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/props-english/render_props_english.py -- --asset apps/web-garden/public/models/props-english.glb --output /tmp/english-props-review --samples 32 --size 440
```

`--part <id>` renders one prop to the requested output file. `--part all` (default)
renders all eight into a directory. Each part's framing derives from the fixed
baseline bounds, so before/after views have matching cameras, lighting and scale
within each pair. Separate cards are not a claim that differently sized props have
identical world dimensions.

All eight before/after actual-GLB Cycles views were inspected. Early coral tips
revealed inward input caps before voxel union; correcting component winding fixed
them. Star tip sampling and chest construction were then refined from the actual
renders. The visual review is an offline CPU path-traced asset study, **not live
browser QA or real-time browser ray tracing**. No render scene is exported.

Full-world batching, aggregate budgets and app integration are verified by the
integrator separately. Browser GPU execution remains unavailable here; no workaround
or browser screenshot claim is made. Approved fish/Shiba assets and gameplay remain
outside this prop-only change.

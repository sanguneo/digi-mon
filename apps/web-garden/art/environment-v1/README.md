# Curved surrounding environments

Original reproducible Blender sources for supporting scenery, not a downloaded
asset pack. The published Shiba and approved clownfish remain byte-identical.
This work complements tree-v3 and the three subject prop libraries.

## Inventory and identity

| Existing scene element | Authored refinement | Runtime use |
| --- | --- | --- |
| Grassy island and earth rim | Continuous rounded turf/earth profile, softly irregular outline | Korean/math, all stages |
| Eight pillow-like border shrubs | Sparse rooted swept clover leaves | Korean/math perimeter |
| Seven path stones | Asymmetric low rounded river stones | Same path coordinates |
| Six background flowers | Curved stems, cupped petals and joined leaves | Same quiet meadow area |
| Rear fence | Rounded pickets and gently bowed overlapping rails | Same rear boundary |
| Growing background garden plants | Curved stem and thin swept rooted leaves | Korean stages 0–3 |
| Aquarium base/sand | Rounded plinth and shallow soft sand edge | English, all stages |
| Aquarium frame/glass | Soft edges, consolidated back/side panes, open front | Never covers fish viewing face |
| Waterline and rear pebbles | Quiet back-only curve and low smooth stones | English background |
| Aquatic growth plants | Thin swept upright ribbon rosettes | English, 3–6 instances |
| Water-care droplets | One pre-authored seven-drop group | Original animated group origin |

The separate catalog/care IDs retain their documented identity, original footprint,
unlock order, placement IDs and care timing. No new game mechanic or saved field
is introduced. The characters stay the focal point; scenery is deliberately quiet.

## Files and reproduction

```sh
blender -t 4 -b --factory-startup --python-exit-code 1 --python apps/web-garden/art/environment-v1/build_environment.py
node apps/web-garden/art/environment-v1/export-worlds.mjs /tmp/digi-mon-world-review
node apps/web-garden/art/quality/measure-world-budgets.mjs --write
```

Three editable `.blend` files and subject-lazy `environment-{subject}.glb` files
contain identity-root parts and baked Y-up geometry, normals, UVs and linear vertex
colors. No cameras, lights, animation clips, textures or external buffers ship.
The saved Blender file keeps individual named features; exported meshes consolidate
only by material role. Creating layers reacquires Blender CustomData handles before
writing, for Blender 4.3 compatibility.

Each world has an immutable cached CPU template and independent owned resources.
Repeated sprigs share cloned geometry/materials only inside that world. The care
pool is built once. Transparent aquarium panes do not write depth or cast opaque
shadows. Failed loads can retry; abandoned loads cannot install stale scenes.

Independent ceilings: each library at most 22,000 triangles / 1.5 MB / three
materials; actual active scenery at most 26,000 triangles on land, 14,000 in water,
10 mesh submissions and three materials. Full-scene ceilings remain unchanged at
115,000 resident triangles, 36 meshes and 14 materials, including hidden care pools.
Exact measurements are in `asset-report.json` and the full-world fixture.

## Evidence boundary

`export-worlds.mjs` runs the actual Three model builder with the shipped GLBs,
then exports its visible graph for matched Blender Cycles inspection. This checks
integrated arrangement, silhouettes, contacts and offline light response. It is
**not** an actual browser screenshot, GPU shader check, FPS or mobile-device test.
The previously blocked browser socket/protocol route was not retried. Existing
numerical phone/tablet framing, real-GLB, clone/disposal, retry and care regressions
remain separate from offline renders. Runtime lighting remains raster PBR/PCF,
not real-time ray tracing.

# Fish v2 - active model

New baby-fish geometry authored in Blender 5.2.1 LTS from the English redesign
brief. This is not a refinement of the rejected fish silhouette. The canonical
`apps/web-garden/public/models/fish.glb` is now exported from this source; `art/fish/`
preserves the first design. The authoring evidence below describes staging checks.
A later bounded Claude Opus check of the actual-app candidate capture passed.

## Deliverables

- `build_fish_v2.py`: standalone procedural source plus actual GLB validator.
- `fish-v2.blend`: editable smooth meshes, linear vertex colors and UV atlases.
- `fish-v2.glb`: retained self-contained candidate export.
- `asset-report.json`: full per-node numerical results, bounds, topology,
  normals, UV areas, growth-stage bounds, pivots and file hashes.

## New design

One connected chubby teardrop body has a broad rounded head/front half, a
59.29% body-height/length ratio and a baked five-degree rising centerline.
There is no separate snout volume. Two large solid dark side-eye caps each
carry one small white, surface-following flattened dot; no sclera or iris.
The independent mouth is an upturned thin crescent, at most 0.015 units proud
of the head surface, rather than projecting annular lips.

The large tail is a closed rounded crescent, not the old striped fan. A rounded
triangle dorsal fin and two small rounded pectoral fins are solid smooth shells.
Stage 2 adds six soft cream spots; stage 3 adds three low rounded dorsal accents.
No radial ridges, gill stripes or scale-band geometry is retained.

Broad warm coral (`#f28b7d`), cream belly/front (`#ffe8c5`) and lighter fin
(`#f6b4a0`) regions use linear vertex colors. Dark eyes/mouth and ordinary white
highlight dots share the same physically lit Principled material: white base,
metallic 0, roughness 0.82, opaque, no emission and smooth normals. Matte means
matte lighting response, not faceted normals or an unlit body.

## Verified numerical results

| Metric | Result |
| --- | ---: |
| GLB bytes | 776,908 |
| Blend bytes | 537,830 |
| Triangles, all stages present | 24,208 |
| Meshes / primitives | 6 / 6 |
| Materials | 1 |
| Final +X length | 2.0560995 |
| Final +Y height | 1.2802500 |
| Final Z depth | 0.8797743 |
| Tail height | 1.0025001 |
| Body height / body length | 0.5928799 |
| Normal lengths across all primitives | 0.9999999118 - 1.0000001425 |
| Smallest UV triangle area | 0.0000005013631 |
| Boundary / nonmanifold edges | 0 / 0 on every mesh |
| Degenerate geometry / UV triangles | 0 / 0 |
| Textures / images / skins / animation clips / external buffers | 0 |

GLB SHA-256: `d46395d9c7585ad1b7678abdfdf176609a80c4195ca98c89ce069775c57ff4f3`.
The body core is one closed connected component with 4,034 welded vertices.
Attached fins, eyes and dots are individually closed surface components.

## Runtime contract and checks

The exported `fish-asset` root has identity TRS and these direct children:

| Node | Y-up local pivot | Runtime role |
| --- | --- | --- |
| `body` | `(0, 0, 0)` | Main body, eyes, dorsal and opposite pectoral |
| `tail` | `(-0.65, 0, 0)` | Tail motion |
| `pectoral-fin` | `(0, -0.13, 0.28)` | Fin motion; runtime rest Z = -0.6 |
| `mouth` | `(0.68, -0.05, 0)` | Independent local-Y feeding scale |
| `growth-markings` | `(0, 0, 0)` | Visible from stage 2 |
| `growth-fin-detail` | `(0, 0, 0)` | Visible from stage 3 |

The opposite pectoral shape includes its matching rest orientation; the named
animated fin does not pre-apply the runtime rotation. Growth stages retain
scales `[0.82, 1.02, 1.27, 1.48]`. Mouth local height grows from 0.0826113 to
0.2560951 at local-Y scale 3.1 without changing its X/Z extents or body scale.

Executed verification:

1. Blender background build and actual binary GLB validator: PASS, including
   explicit `--output` pointed to the staging destination.
2. Standalone `--verify-only`: PASS against the exported binary.
3. Saved `.blend` reopened in Blender, with no rendering: all seven objects
   present, all six meshes manifold, all polygons smooth, UV layers present,
   and no images/cameras/lights.
4. Actual `parseFishAsset` and `cloneFishAsset` loaded through Vite SSR with the
   staging bytes: six MeshStandard-compatible vertex-color meshes, independent
   clones, unchanged template/primary colors, deterministic friend palette,
   and blue/red color sum ratio 1.5161. Pivots, stage scales, fin rest angle and
   mouth-only Y growth were exercised numerically at all four stages.
5. During initial staging authoring, the canonical v1 GLB Git blob hash remained
   `fe31a1a50331ab38dd96bb88c692bff73d86fb8f`.

Static-analysis limitation: the workstation Python LSP cannot resolve Blender's
embedded `bpy`/`bmesh` imports and reports dynamic/unannotated Python typing
warnings. These were not suppressed; Blender executes those imports and the
asset validator successfully. No app-render/browser visual test was performed.

## Rebuild and verify

Run from the repository root in PowerShell. Default export stays in this folder:

```powershell
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/fish-v2/build_fish_v2.py
python apps/web-garden/art/fish-v2/build_fish_v2.py --verify-only
```

Canonical publication override, executed after the props baseline and Opus candidate
check passed:

```powershell
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/fish-v2/build_fish_v2.py -- --output "C:/Users/USER/WebstormProjects/digi-mon/apps/web-garden/public/models/fish.glb"
```

`--output` changes only the GLB destination. Blend and report remain in this
staging folder. The report records the actual destination and resulting hashes.

## Assumptions and limits

The asset author used no Fable, image reading, image generation, screenshots,
Blender previews or renders. Thumbnails
and backup versions are disabled in the authoring script. Geometry and the actual
runtime loader were checked numerically; the later actual-app capture was checked
by Opus only. Friend coloring, visibility and care animation remain runtime-owned.
The lead published the canonical asset after the isolated authoring task completed.

# Korean garden props — curved storybook revision

All fourteen original props were refined in Blender 4.3.2 and reviewed in matched
Cycles contact sheets made from the actual baseline and candidate GLBs. This is a
complete collection pass, not a single showcase asset or blanket subdivision.
No downloaded models, texture images, runtime Blender dependency, or gameplay
changes are introduced.

## Collection and measured geometry

| Part | Triangles | Design work |
| --- | ---: | --- |
| `moon-chair` | 2,660 | Rounded reclined slats, splayed legs, small crescent inset |
| `dandelion-pot` | 2,916 | Soft hollow pot, bowed stem, cupped leaves and narrow yellow dandelion florets |
| `tiny-pond` | 2,884 | Organic basin, inset water, small swimming fish, lily leaf and bank stones |
| `cloud-balloon` | 1,214 | One continuous rounded scalloped puff, fine swaying tether |
| `reading-cat` | 6,334 | Connected seated kitten sculpt, blended cream markings, curved arms and open book |
| `rainbow-flag` | 868 | Continuous thick wind-curved cloth and rounded pole ends |
| `picnic-basket` | 3,084 | Rounded hollow body, surface-following weave and smooth oval handle |
| `strawberry-patch` | 3,304 | Soft planter edges, curved foliage/calyxes and heart-shaped fruit |
| `mushroom-home` | 3,448 | Continuous hollow stem/arched doorway, rounded cap and flush ivory spots |
| `bird-bath` | 2,298 | Soft turned stone, recessed water and one connected tiny bird |
| `pebble-fountain` | 3,268 | Smooth river pebbles and continuous arcing streams |
| `firefly-lantern` | 2,892 | Bowed cage ribs, soft bonnet/tray and warm dimensional center |
| `watering-can` | 2,380 | Rounded hollow enamel body, open spout and curved handle |
| `sunlight-token` | 2,288 | Rounded petal rays and a quiet smiling face |

**Total: 39,838 triangles, 21 primitives, 2 shared materials, 1,636,456 GLB bytes.**
All thirteen non-cat parts remain below 3,500 triangles; the cat remains below
8,000. The complete library stays below 65,000 triangles and 5 MB. The basket uses
fewer triangles than the previous version while retaining readable weaving.

## Rebuild and validate

Run from the repository root:

```bash
blender -b --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/props-korean/build_props_korean.py
python apps/web-garden/art/props-korean/verify_props_korean.py
blender -b apps/web-garden/art/props-korean/props-korean.blend --threads 2 --python-exit-code 1 --python apps/web-garden/art/props-korean/verify_blend.py
node --experimental-strip-types apps/web-garden/art/props-korean/exercise-glb.ts
```

The `.blend` retains 233 separately named editable features. Features are joined
only in memory for export; no preview cameras or lights enter the source or GLB.
The builder disables numbered backups and embedded thumbnails. It explicitly
reacquires UV/color layer handles after both layers are created, avoiding Blender
4.3 CustomData handle invalidation.

`asset-report.json` validates actual binary accessors; `blend-report.json` verifies
the reopened source; `loader-report.json` exercises Three GLTFLoader, placement,
care-tool origins, and rays through real mesh cavities. All three pass. The ray
checks find the pot soil, basket floor, can floor and basin water below their rims.
A ray through the mushroom doorway reaches the back wall while its neighbor hits
the solid front wall.

## Visual review

Generate the same contact sheet for each exported GLB:

```bash
blender -b --factory-startup --threads 4 --python apps/web-garden/art/props-korean/render_collection.py -- previous-props-korean.glb artifacts/korean-props/before.png
blender -b --factory-startup --threads 4 --python apps/web-garden/art/props-korean/render_collection.py -- apps/web-garden/public/models/props-korean.glb artifacts/korean-props/after.png
```

The script isolates and labels every part, using the same 1600-square camera,
orientation, Cycles lighting, AgX transform and 48 samples for both versions.
The installed build lacks OpenImageDenoise, so denoising is disabled. These are
actual exported-mesh previews, not generated concept art or browser screenshots.

The initial candidate review caught buried basket weave and an abrupt cat muzzle
color boundary. Both were corrected and re-rendered. The reviewed result shows
smoother cloud, foliage, handles, bowls and cap silhouettes while preserving
recognizable construction, hollow interiors and warm muted materials. Integrated
world scale, placement and mobile/browser acceptance belong to the lead's separate
application checks; these asset previews do not certify those results.

## Preserved contract

`korean-props` has the same fourteen direct identity groups and saved identifiers.
Each group owns one mesh node with one or two material primitives. All local
origins remain `[0, 0, 0]`, Y-up and +Z-front. Parts overlap at the origin by design;
placement, inventory scale and care motion remain runtime responsibilities.
The can and sun retain centered care pivots. Maximum baseline bound error is
9.54e-8 world units, measured from exported positions rather than metadata.

Two white-base, nonmetallic, opaque Principled surfaces share linear vertex colors:
matte roughness 0.76 and satin 0.30. Water and firefly forms use geometry and color,
not transparency or embedded lights. UVs are finite, nondegenerate dominant-axis
projections with overlapping islands; no texture atlas is required. The GLB has
one embedded buffer and no images, textures, cameras, lights, skins or animations.
Closed manifold components, unit normals, normal/winding agreement, finite color
ranges, opacity, usable UV triangles and geometry budgets are checked numerically.

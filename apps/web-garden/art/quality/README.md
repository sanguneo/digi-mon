# Sculpted companion quality pass

Original Blender-authored geometry and standard Three.js PBR, not downloaded
models or a high-poly replacement hidden behind a screenshot. Active source:
[puppy v3](../puppy-v3/README.md), [fish v3](../fish-v3/README.md),
[tree v2](../tree-v2/README.md). Previous source versions are retained.

## Measured asset budgets

| Asset | Before triangles | After triangles | Primitives | Materials | GLB bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baby Shiba puppy | 32,056 | 31,808 | 6 | 4 | 1,062,044 |
| Approved cute clownfish | 24,208 | 32,608 | 7 | 3 | 1,017,224 |
| Tree, all stages | 81,368 | 93,324 | 18 | 3 | 3,713,992 |

Only one tree stage is cloned at runtime: 4,968 / 18,576 / 34,864 / 34,916
triangles. Per-stage primitives are 4 / 4 / 5 / 5. The complete-library total
must not be confused with the active scene's cost. Curvature and covered
articulated junctions receive the additional geometry; hard asset budgets remain.
The approved clownfish exceeds its 30,000-triangle soft target but stays below
the unchanged 35,000-triangle hard cap; this tradeoff is explicit, not hidden.

## Runtime rendering

[Rendering rig](rendering.md) documents the local GGX-prefiltered studio probe,
semantic roughness roles, key/fill/rim lighting and demand-driven daylight/side-light
presets. The app uses **rasterized PCF shadows and PBR environment reflections**,
not real-time ray tracing. Blender preview scripts use **offline Cycles path tracing**.
Neither the preview quality nor geometry counts establish mobile GPU frame rate.

The mobile scene resource ceiling is independently checked at 115,000 resident
triangles, 36 mesh submissions and 14 owned materials. The largest final full-catalog
scene is the mature Korean world: 100,602 resident triangles, 30 meshes, 8 materials;
93,038 triangles and 26 meshes are visible at rest. The mature English scene, including its companion clone, has 96,786 resident
triangles / 28 meshes / 12 materials; 90,762 triangles and 24 meshes are visible
at rest. Shadow and probe passes are separate from these model counts. Unchanged scenery retains its exact prior budget.

## Reproduce checks

Run from the repository root, with Node 24+ and installed workspace dependencies:

```bash
npm run garden:test
npm run garden:build
node --test apps/web-garden/art/puppy-v3/verify_puppy_v3.test.mjs
node --test apps/web-garden/art/fish-v3/verify_fish_v3.test.mjs
python apps/web-garden/art/tree-v2/verify_tree.py
node apps/web-garden/art/quality/measure-world-budgets.mjs
```

The measured regression fixture is updated only with an explicit `--write` flag.
Do not raise its independent ceilings to hide a regression. Tests exercise real GLB
bytes, material roles, geometry/normal/color preservation, growth and care poses,
camera projections, immutable templates, exact-once disposal and failed loading.
The light presets do not mutate saved game state or allocate a new probe.

## Recorded verification and limits

The integration pass used Blender 4.3.2 and Node 24.22.1. Garden tests passed
292/292; its strict TypeScript/build passed. Dedicated puppy/fish loader tests
passed 12/12. The tree passed actual-binary and reopened-Blender validation plus
185 joint-pose contact samples. Matched original/final Cycles renders were inspected.
Root tests passed 256/256, the full `verify` chain and generated-artifact freshness
passed, and Markdown/patch hygiene passed. The root type gate still prints four
pre-existing generator diagnostics outside its enforced `src/engine/` scope.
The existing large Three.js chunk warning remains (renderer chunk 658.32 kB).

**Not verified here:** real-browser GPU shader compilation, integrated game
screenshots, touch-device behavior and frame time. Chromium could not create its
local process socket under this executor's sandbox; an escalated launch failed
before execution. The cloud browser could not reach the isolated local server.
No screenshot or path-traced render is represented as proof of those missing checks.

Once a browser is available, capture the real app with:

```bash
# Optional CHROMIUM_PATH selects an installed Chromium executable.
node apps/web-garden/art/quality/capture-worlds.mjs . after
```

The script uses the real engine/app, captures phone and desktop layouts, checks
runtime errors/overflow, and captures both lighting presets when available. It is
included and syntax-checked but could not complete in this executor. Also run the
existing model/mobile Playwright suites before production acceptance. No remote
push, pull request, merge or deployment was performed by this pass.

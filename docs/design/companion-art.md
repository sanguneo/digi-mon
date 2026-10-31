# Companion art and reciprocal care contract

Owner: companion rendering task. Link this document from `apps/web-garden/DESIGN.md`
(the learning/design owner owns that file). This contract precedes implementation.

## Direction and focal hierarchy

Warm storybook miniatures, authored as real Three.js geometry, not flat illustration
substitutes. Rounded Korean sans typography belongs to the shared workspace. Garden
CSS changes remain scoped to the world room. The companion is the focal point, with
quiet supporting scenery, softened borders and explicit native care controls.

- Sprout: shaped pointed leaves with midribs, a soil nest and seed shell; later stages
  have bark marks, articulated leafy crown, blossoms and fruit with stems/leaves.
- Fish: an appealing orange clownfish with three curved creamy-white bands, fine
  dark edges, a larger rounded head and warm expressive eyes. Retain a laterally
  compressed short body, recognizable snout, continuous dorsal/anal fins and a
  narrow peduncle with rounded fan tail. Avoid a sphere with stripes or disconnected
  fin tabs. The owner approved this stylized v5 proportion on 2026-10-31; growth
  scaling and close stage-aware framing must still communicate progression.
- Puppy: a cute baby Shiba Inu with warm tan fur, cream urajiro cheeks/chest/belly,
  small rounded upright triangular ears, a short muzzle and a plush curled tail.
  Use simple soft volumes and short limbs, not anatomical undulations, sculpted
  brow ridges or a forehead tuft. Keep articulated head/tail and readable feeding
  posture. Fur is matte, not plastic.
- House: an explicitly extruded upright triangular gable, horizontal eaves and ridge
  above the walls; no rotated triangular cylinder whose point faces downward.
- Aquarium: open viewing face with no upper front rail crossing the actor. Back/side
  glass and a thin waterline communicate enclosure without obscuring fish silhouettes.

## Blender puppy replacement

Author the puppy locally in Blender from a reproducible Python script, retain the
editable `.blend`, and ship a self-contained `public/models/puppy.glb`. No downloaded
model, texture service or runtime Blender dependency is introduced. Companion and
prop sources are authored separately; the supporting environment stays procedural.

Use a clean oval body, visibly thinner gently tapered limbs and small paws, with no
shoulder caps, ankle cuffs, swollen feet or pinched wavy transitions. The head
should read as one soft baby-like volume with broad cheeks, a short muzzle and small
upright triangular ears with rounded tips. Avoid adult fox-like sharpness, lumpy
anatomy and disconnected ball joints. Prioritize an appealing clean silhouette over
extra contour detail. Preserve the warm tan/cream palette and matte/satin material
distinction. This baby-Shiba direction reflects the owner’s latest puppy revision.

The exported asset is Y-up, faces +Z and rests on y=0. Its identity root is
`puppy-asset`; body, head and tail remain independently addressable. Head pivot is
`(0, 1.6, 0.5)` and tail pivot is `(0, 1.03, -0.94)` in exported coordinates.
`growth-collar` and `growth-bandana` identify removable growth accessories. Existing
growth scales and care timelines remain runtime responsibilities.

Target 15,000-35,000 triangles, at most 45,000 triangles and 3 MB per complete GLB,
with no external textures and at most five simple materials. Record actual geometry,
bounds and submission counts before judging the budget. Preserve authored normals,
colors and independent motion frames through cloning and batching; each live instance
owns its disposable resources. Math-world asset loading must be lazy, failures
must reach the existing retry surface, and abandoned loads must not install a renderer.

Verification combines actual-GLB parsing and model/lifecycle/browser assertions
with direct visual review. Render matched Blender views and real-app screenshots
before and after changes; inspect silhouette, curvature, surface response, contacts,
all growth stages and animated care poses. Keep preview cameras/lights out of the
runtime GLBs. Numerical checks establish contracts and budgets, not appearance.

## Blender tree and fish replacement

Author the remaining growing companions locally in Blender, retaining Python source,
editable `.blend` files and self-contained `tree.glb` and `fish.glb`. No downloaded
models or texture-service dependencies are introduced. Visual inspection of original
Blender renders and the integrated game is part of acceptance.

The tree asset has an identity `tree-asset` root with four independent stage roots,
`tree-stage-0` through `tree-stage-3`. Clone only the active stage. Sprout leaves have
named motion pivots; later canopies pivot at Y=1.6 for the young tree and Y=2.15 for
blossom/fruit stages. Leaves have actual curvature and thickness, trunks taper and
branch, and blossoms/fruits are separate volumetric growth features. Care adds motion
to the authored rest pose instead of imposing the old primitive leaf orientations.
Budget each active stage at no more than 35,000 triangles, the complete asset at
100,000 triangles/5 MB, and preferably six primitives and three materials per stage.

The fish asset has an identity `fish-asset` root, Y-up and forward +X. Its named tail,
pectoral fin and mouth use the existing pivots `(-0.65,0,0)`, `(0,-0.13,0.28)` and
`(0.68,-0.05,0)`. Use one connected, smoothly controlled body loft with a short soft forehead,
large shallow orange iris/pupil and a small smile. Keep thin curved fins with
buried roots, rather than bulky disconnected lobes. Growth markings/fin details
supplement existing scaling, and the companion fish
reuses an independently owned clone with a separate palette. Hard budget: 35,000
triangles/3 MB, seven primitives and three simple materials.

All three subjects load only their own required asset. Failed loads remain retryable,
abandoned scene loads cannot install stale renderers, cached templates are immutable,
and owned clones preserve authored normals/colors and dispose without harming other
instances. Unchanged environment and decoration geometry retains its measured budget.

## Secondary prop libraries

Upgrade the existing 24 catalog decorations and seven reusable care-prop groups in
Blender without changing catalog IDs, unlocks, saved placements or care timing.
Each subject has one self-contained library GLB, loaded for that subject only:

- `props-korean.glb`, root `korean-props`: the twelve Korean catalog IDs plus
  `watering-can` and `sunlight-token`.
- `props-english.glb`, root `english-props`: the six English catalog IDs plus
  `fish-food` and `bubble-trail`.
- `props-math.glb`, root `math-props`: the six math catalog IDs plus
  `feeding-bowl`, `grooming-brush` and `dog-food`.

Every reusable part is a direct, identity-transform child named by its ID, with
Y-up geometry at its own local origin and the existing unit footprint. Reuse the
ball model for both placement and play. Care tools retain their existing pivots
and particle-group origin conventions. World placement, growth decorations and
care animation remain runtime concerns.

Improve shape-specific geometry: hollow bowls/pots/entrances, beveled furniture,
curved cloth/kelp, shell fluting, branching coral, formed basket handles and rims,
layered petals and shaped fruit. Do not merely export the primitive placeholders.
Use shared white-base vertex-color material roles, no downloaded textures/models,
and at most three primitives per prop where feasible.

The Korean library has a 65,000-triangle/5 MB hard budget, English 30,000/3 MB and
math 40,000/3 MB. Most parts target 3,500 triangles or fewer; the cat and house may
use up to 8,000. Validate every required ID, bounds, normals, UVs, colors and resource
counts from the actual exported GLB. Clone only parts used by the current scene,
preserve independent instance transforms and dispose owned resources exactly once.

Capture and inspect actual-app screenshots at important milestones. Review evidence
locally and deliver useful comparisons with the implementation; external messaging
or publication remains a separate user-authorized action.

## Materials and rendering

Use a small fixed set of semantic surfaces: matte organic/fur, dry wood/earth,
restrained satin fish/ceramic, water and transparent glass. Opaque batching retains
roughness/metalness by surface role and linear vertex color within independently
moving coordinate systems. Do not discard geometry/normals/UVs to meet a draw budget.
Reuse one batch material per role, not one material/draw per color or detail.
Keep the unchanged procedural environment's batching and geometry budgets independent
of authored actors and props. Consolidated GLB parts retain their material roles;
full-scene resource budgets are measured for the actual subject, stage and placements
instead of forcing new assets into the earlier primitive-only material limits.
Transparent panes retain their sorting/depth behavior.
Keep capped DPR, offscreen/background suspension, demand rendering when motion is
stopped, and exact-once geometry/material disposal.

## Finite care seam

Care counts, milestones, lastCare and reward keys remain compatible with version 3
and legacy migrations. `lastCare` is history, never an animation trigger. A session-only
care event with monotonic identity is emitted for every actual care-button activation,
including repeats of the same action. It is neither saved nor used by answer/reward
deduplication. Navigating/reloading/retrying WebGL must not replay history.

Each animation has approach, response and settling beats, then returns to ambient
pose with all transient props hidden. A new click restarts the current response; it
does not queue an unbounded sequence or create new GPU resources. Duration is 3.6
seconds of visible active time. Paused, background and offscreen time do not advance
it. Reduced motion or an explicit pause uses a static acknowledgment and the text
response, not falling particles or looping care. Scene data attributes expose event
identity and phase for exact browser subscriptions (no fixed-sleep tests).

- Water: can tips, droplets reach the roots, leaves lift and gently settle.
- Sunlight: warm sun token appears; leaves/crown turn up, then return.
- Fish food: fish approaches the feeding point, opens its mouth/eats the disappearing
  morsels, turns back toward the learner and returns to its swimming path.
- Bubbles: fish follows a short rising bubble trail, then acknowledges and settles.
- Puppy food: puppy approaches the bowl, lowers its head to food, lifts its head and
  wags toward the learner, then returns to its resting position.
- Brush: a visible brush strokes the fur; head leans into it and tail wags; brush exits.
- Ball: one throw, puppy follows/nuzzles the ball, turns toward learner and returns.

No hunger, decay, care costs or time rewards. Thresholds remain 3/12/36 distinct
answers plus 1/3/6 care. Mature copy points to existing unplaced decorations and
rearrangement, not a new currency, economy or infinite growth promise.

## Verification and lead handoff

Deterministic model tests sample explicit animation times, including retrigger and
completion. Batching tests compare triangle positions, normals, UVs, colors, material
properties and all moving coordinate systems at those times. Geometry tests assert
upright gable/ridge and genuine volume/growth. UI tests cover event identity without
changing persistence/reward semantics. Use custom inline SVG care/subject icons in
a consistent rounded stroke style. No prose-pinning tests.

Lead owns code-driven browser checks at phone/tablet sizes, including stage zero and
maturity, care repeat/completion, reduced motion, pause, scrolling, retry and console
errors. Model and behavior checks do not certify appearance. Include inspected Blender and
actual-app evidence, with known rendering/device limitations stated explicitly.

## Sculpted companion and lighting refinement (2026-10)

Active authoring sources are `art/puppy-v3`, `art/fish-v3` and `art/tree-v2` in the
garden workspace. Previous versions remain historical references. The original
Blender geometry is editable and reproducible without downloaded assets. Invest
triangles in clean rounded silhouettes, blended attachment roots, thick swept fins,
folded leaves and hidden articulated roots rather than blanket subdivision.

Differentiate matte organic surfaces from eyes/noses, waxy leaves and satin fruit
with exported glTF roughness roles. The real-time renderer uses standard Three.js
PBR, a locally generated 128px prefiltered studio probe, shaped key/fill/rim lights
and one 1024px PCF shadow map. The probe is computed once per renderer and disposed
with it; it is not an animated reflection capture or a remote HDR dependency.
The optional lighting controls stay inside the existing collapsed camera panel.
They change actual light direction and reflection orientation on demand, without
new game state, time rewards or a continuously running lighting animation.

The web renderer is rasterized, **not real-time ray tracing**. Blender Cycles
preview images use offline path tracing to inspect curvature, junctions, contact
shadows and highlight response. Clearly label those images; they do not certify
browser GPU output or mobile frame rate. Keep source/GLB validation, full-scene
resource budgets, camera projection checks and live browser QA distinct.

Measure every stage with empty/full placement catalogs and each care action using
`art/quality/measure-world-budgets.mjs`. Preserve independent hard ceilings in the
regression tests so refreshing exact measurements cannot hide a performance
regression. The existing subject-lazy loading, stage selection, immutable templates,
independent clones, reduced-motion behavior and disposal contracts still apply.

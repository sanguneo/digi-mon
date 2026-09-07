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
- Fish: warm apricot body against deeper cool water, scalloped fins with rays, gill,
  mouth, limited scale accents and restrained eye highlights. A larger starting fish
  and closer stage-aware camera must not erase subsequent visible size growth.
- Puppy: caramel fur, cream muzzle/paws, brow and cheek details, separated floppy
  ears, articulated head/tail and readable feeding posture. Fur is matte, not plastic.
- House: an explicitly extruded upright triangular gable, horizontal eaves and ridge
  above the walls; no rotated triangular cylinder whose point faces downward.
- Aquarium: open viewing face with no upper front rail crossing the actor. Back/side
  glass and a thin waterline communicate enclosure without obscuring fish silhouettes.

## Blender puppy replacement

The first Blender-authored mesh is the puppy only. Author it locally in Blender
from a reproducible Python script, retain the editable `.blend`, and ship a
self-contained `public/models/puppy.glb`. No downloaded model, texture service or
runtime Blender dependency is introduced. Other worlds and scenery remain procedural.

Use connected, smoothly shaped body/shoulder/haunch volumes, defined paws, a connected
skull/cheek/muzzle form, eye sockets and thick curved ears with inner folds. Spend
geometry on silhouettes and curvature, not many tiny fur spheres. Preserve the warm
caramel/cream palette and existing matte/satin material distinction.

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

Verification is primarily actual-GLB parsing and model/lifecycle/browser assertions.
The puppy's earlier preview belongs to the completed milestone. For subsequent
model work, the user's latest instruction forbids image generation, rendered
previews, OCR and image analysis. Validate geometry, asset loading and behavior in
code; do not run the earlier preview workflow.

## Blender tree and fish replacement

Author the remaining growing companions locally in Blender, retaining Python source,
editable `.blend` files and self-contained `tree.glb` and `fish.glb`. No textures,
downloaded models, rendered previews or image-analysis tools are used.

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
`(0.68,-0.05,0)`. Use a connected tapered body, shaped gill/head forms and thick curved
fins. Growth markings/fin details supplement existing scaling, and the companion fish
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

The user permits quick real-app screenshots at important milestones, sent directly
to Telegram without inspection or analysis. This does not permit Blender previews,
image generation, OCR or an image-based review/polishing loop.

## Materials and rendering

Use a small fixed set of semantic surfaces: matte organic/fur, dry wood/earth,
restrained satin fish/ceramic, water and transparent glass. Opaque batching retains
roughness/metalness by surface role and linear vertex color within independently
moving coordinate systems. Do not discard geometry/normals/UVs to meet a draw budget.
Reuse one batch material per role, not one material/draw per color or detail.
Target initial worlds at <= 15% of original unbatched mesh submissions; at most five
material roles including glass for procedural worlds. The Blender math world retains
three authored puppy materials plus three environment materials, with a six-material
resource budget rather than flattening the authored appearance into the old roles.
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
errors. Model and behavior checks do not certify appearance. Under the current user
instruction, do not generate or analyze image evidence.

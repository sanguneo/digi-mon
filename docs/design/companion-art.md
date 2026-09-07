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

## Materials and rendering

Use a small fixed set of semantic surfaces: matte organic/fur, dry wood/earth,
restrained satin fish/ceramic, water and transparent glass. Opaque batching retains
roughness/metalness by surface role and linear vertex color within independently
moving coordinate systems. Do not discard geometry/normals/UVs to meet a draw budget.
Reuse one batch material per role, not one material/draw per color or detail.
Target initial worlds at <= 15% of original unbatched mesh submissions; at most five
material roles including glass. Transparent panes retain their sorting/depth behavior.
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

Lead owns final real-browser comparison at 375x812, 768x1024 and 1024x768, including
stage zero and maturity, each care beat/repeat, reduced motion, pause, scroll/touch,
context-loss retry and console errors. Model/type/build checks cannot certify visual
quality; the final capture pass is explicitly separate.

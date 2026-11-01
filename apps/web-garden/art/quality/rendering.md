# Companion rendering rig

The upgraded Blender surfaces use the existing Three.js physical material shader,
now lit by a local studio probe. No remote HDR image, texture download, postprocess
stack, custom shader-string patch or extra runtime dependency is introduced.

## What changed

- Four broad warm/cool light cards are filtered once through native GGX PMREM.
  Roughness can now distinguish dry bark/fur, folded leaves, satin fins and facial
  details instead of every material receiving only flat ambient fill.
- A warm key, quiet cool fill and warm rear light describe the silhouettes. The
  lower hemisphere intensity preserves cheek, fin and foliage curvature.
- One 1024-square PCF shadow map remains. Radius 2.25 and a smaller normal bias
  soften the edge without replacing contact with a floating blob shadow.
- ACES tone mapping and sRGB output remain. DPR stays capped at 2. Camera framing,
  gesture defaults, motion preference, background/offscreen suspension and care
  timelines are unchanged.
- The existing collapsed camera disclosure contains two optional 48px-target
  lighting buttons: soft daylight and warm side-light. Switching moves the actual
  shadow-casting key and rotates the same reflection probe, then draws on demand.
  It does not start a time-of-day loop or change saved learning/care progress.
  The choice resets to daylight on subject change or context retry.

These interactive cast shadows are rasterized PCF shadows; surface reflections
are prefiltered image-based lighting. Neither is real-time ray tracing. Blender
Cycles renders can provide separate offline ray-traced model previews, but cannot
be presented as evidence of the WebGL application's final rendering.

## Measured code-level resource contract

`garden-lighting.test.ts` executes Three 0.185.1's real PMREM allocation and filter
scheduling with only GPU draws replaced. This is not a GPU timing measurement.

| Resource or operation | Result |
| --- | --- |
| Probe face size | 128 |
| Packed CubeUV target | 384 × 512, RGBA16F |
| Persistent color storage | 1,572,864 bytes (1.5 MiB) |
| Probe generation | Once per renderer initialization |
| Precompute renderer submissions | 32, before the first world frame |
| Per-frame probe capture or geometry | None |
| Shadow-casting lights | One |
| Additional steady-state direct lights | One unshadowed rim light |

The color-storage figure excludes driver allocation overhead, the retained depth
attachment, the temporary equally sized PMREM ping-pong target, programs, and the
existing world/shadow resources. It is not total VRAM. No FPS, milliseconds-to-first
frame, mobile GPU throughput or production-device claim is inferred from these
counts.

The probe, shadow and temporary generator resources have explicit disposal owners.
Tests cover exact-once disposal, probe generation failure, renderer/context release
before retry, and reuse across growth, care and camera changes. The original cached
GLB templates remain untouched.

## Verification boundary

Type checking and focused lighting/renderer tests pass. Actual WebGL shader
compilation, integrated game screenshots and device performance require a working
browser GPU context. This executor's Chromium launch is blocked by Unix-socket
sandbox restrictions before it can render; Blender model renders are separate
evidence and do not certify this WebGL rig's final appearance.

Once a browser is available, run the documented actual-app capture script at
375 × 812 and desktop size; check every companion at stage zero and maturity,
bright fur/leaf highlight retention, contact shadows, repeated care, subject
switches and context retry. Tune exposure only after inspecting those game views.

# Real water reflections

The reflection was a genuine planar mirror render, but it read like a medium-quality screen-space effect because (1) the mirror image was 640x360 and then blurred, so shapes dissolved, and (2) it left out the flowers and every grass layer except the two foreground ones.

## What changed (`?reflection=previous` restores the old behaviour)
- The mirror render now contains the real scene: all four grass layers (including the void fill) and the flowers, plus terrain, spruce, hamlet, mountains and sky.
- Its size follows the drawing buffer: three quarters of its width, 1024-2048 px, 16:9 (1920x1080 for a 2560-wide buffer), with 8x anisotropic filtering.
- The water samples it with the hardware mip chain (blur follows how much the ripples stretch the lookup) instead of a fixed distance blur. The "Reflection sharpness" slider is now a mip bias on that lookup.

## Evidence
Zoomed comparison of the main pool and bank (`diagnostics/out/r2-*.png`, `r3-*.png`): reflected grass flecks, hill shapes and ripple-broken edges are recognisable instead of soft blobs. At 1x the pool differs mostly in detail, not in overall composition.
Experiments (1280 vs 1920, explicit mip vs hardware mip) showed resolution mainly removes blockiness; GPU time is vertex-bound and does not change with size.

## Cost (production preview, GPU ms)
| | Cached (before) | Real |
|---|---:|---:|
| Steady frame p50 (two runs) | 9.88 / 9.91 | 10.07 / 9.90 (no difference) |
| One refresh of the reflection | 1.3-1.7 | 4.25-4.26 |
| Refresh draws / triangles | 44 / 3.5M | 98 / 9.8M |
| Reflection memory (calculated) | about 3 MB | about 28 MB (1920x1080, half-float with mips) |
The bed capture (about 4.2 ms) is unchanged. Rendering still settles at frame 3 and stops.

## Honest limits
- It is cached: the reflection refreshes when the scene changes (look-dev edits do this after 0.25 s), not every frame. A living world will need a refresh schedule, for example every 100-200 ms, about 20-40 ms of GPU per second, or on light and wind changes.
- It is one plane at the near pool's height (1.754 m). The pool and left stream sit within 0.2 m of it. The elevated tributary sits level with the camera, so a planar reflection cannot exist for it.
- It is a mirror of the flat plane, not ray tracing: no reflection of things the mirror camera cannot see, and no sun glitter (the sun is behind the camera).

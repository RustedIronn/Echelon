# Water and bank refinement

Stop for visual review. Nothing outside the water, its reflection capture and the terrain beside the channel was changed.

## Review files (identical camera, exposure and display transform; 2560x1440 frames or crops of them)
- `pass4-full-blender-vs-refined.png`, `pass4-full-approved-vs-refined.png`: complete frames side by side (5120x1440).
- `pass4-approved.png` (approved baseline), `pass4-refined.png` (new default), `pass4-refined-linear.png` (optional linear resolve).
- Reflection crops (Blender | approved | refined): `pass4-detail-reflection-left-stream.png`, `-reflection-spruce.png`, `-reflection-centre.png`.
- Detail montages (Blender | approved | refined | refined + linear): `pass4-detail-water-near.png`, `-water-bank-wide.png`, `-bank-strip.png`, `-tributary.png`, `-left-bank.png`, `-water-left.png`, `-mid-reflection.png`.
- Data: `pass4-regional-metrics-all.json`, `pass4-regional-metrics-water.json`, `pass4-browser-results.json` (GPU), `pass4-capture-cost-experiments.json`, `pass4-reflection-cost-experiments.json`.
- Preview `http://127.0.0.1:4174/landscape-preview.html` now serves the refined water. `?waterpass=approved` reproduces the approved baseline exactly
  (whole-frame difference 0 against the approved capture); `?pass=previous` still reproduces the renderer before the meadow/flower pass (difference 0).

## Where each discrepancy comes from (controlled experiments, 60+ runtime variants against the Blender frame)
Error = mean absolute RGB difference between 8x8 block means, 0-255 (lower is better). Baseline errors: near water 9.3, mid water 8.0, left stream 15.5, tributary 11.0, far bank strips 7.1 / 6.5 / 11.4.

| Discrepancy | Optics | Capture resolution / filtering | Sediment material | Shoreline | Terrain / vegetation |
|---|---|---|---|---|---|
| Too blue, uniform, reflective | **Main cause.** Fresnel weight 0.8 and extinction x0.5: near error 9.3 -> 5.0, luminance +13.9% -> +0.4%, colour (104,138,163) -> (98,130,153) vs Blender (103,129,151). Removing the local bank reflection entirely makes mid water +61% bright, so it is needed | Reflection map size is irrelevant: it is sampled at mip 3-3.5 (1280x720 without grass: 10.19 vs 10.18). Its *content* matters: the capture excluded all vegetation. Adding the two near grass layers: mean error -6% | no effect | no effect | no effect |
| Bed lacks clarity and variation | Reflection and attenuation scale bed contrast to ~0.4x; clearer water alone brightens it | Bed capture is half resolution: 1920x1080 or 2560x1440 raises near-water contrast ratio only 0.33 -> 0.35 / 0.41 and leaves mean error unchanged (10.18 -> 10.26 / 10.20), for +16 / +39 MB and +0.3 / +0.6 ms per refresh | Existing wet darkening and normal flattening *help* (removing them worsens near error 9.3 -> 9.9). Per-pebble albedo variation (994 authored pebbles, 41,748 vertices) had no measurable effect | no effect | Raw bed beneath the water has near-Blender contrast; the loss happens in the composite |
| Hard stair-stepped shoreline | no | Nearest-neighbour taps of the 1280x720 depth capture quantise coverage into 2 px steps; larger capture only shrinks them | no | **Cause and fix:** feather from the authored per-vertex water depth | no |
| Overly continuous exposed-soil strip | no | no | no | no | **Mostly terrain.** The strip is 13 / 12 / 24 percent too bright, less saturated and bluer than Blender, but its local contrast is within 15 percent. Restoring the 18,395 thinned layer 0/1 roots changes nothing. The near terrain is a 19k-triangle mesh with 1024 px maps over 440 x 235 m, so micro-detail cannot be shown there |

## What changed (all behind `waterpass`; default refined)
1. **Optics** (`WATER_REFINEMENT`): reflection weight 0.8, extinction x0.5 (more transparent), shoreline from vertex depth with a 0.04 m ramp (0.10 gave a visible dark smear at the near-left bank; 0.03-0.05 are crisp).
2. **Reflection capture** keeps the two near grass layers (`Foreground arching grass`, `Low basal meadow foliage`), still 640x360, and is sampled at mip 1.5-2.0 instead of 3.0-3.5.
   The approved blur turned the spruce and bank reflections into a flat grey: the left stream was 8% dark and brown-grey. At mip 1.5-2.0 that stream reads blue-grey like Blender (RGB 98,118,115 vs 97,116,113 at 2.5; error 14.0 -> 10.8) and the mean water error falls another 6%.
   Resolution is not the lever: a 1280x720 map at the old blur matches it only because its mip 3 is as sharp as mip 2 of the 640x360 map, so +7 MB was not justified. The heights of the left stream (1.93-1.95 m) are within 0.2 m of the reflection plane (1.754 m), so the height fade was not the cause; only the tributary (4.4 m) is faded to sky, which is why it stays pale.
3. **Bank wet band** (`bankWetness.js`, `applyBankWetness`): a 798x1024 single-channel map rasterised once from the existing water surface and blurred 1.5 m. Terrain albedo inside it is darkened to 0.88 and saturation raised 0.2, fading out between 70 and 120 m.
   A first version without the fade darkened grass-covered channel terrain on the far horizon (horizon-field error 4.0 -> 7.7); the distance fade removed that regression (back to 4.0).
No new geometry, rocks, vegetation or scatter; river course, terrain, stones, camera and root placements untouched. The bed capture stays at 1280x720.

## Results against Blender
| Region | Approved | Refined |
|---|---|---|
| near water (lum / contrast / error) | +13.9% / x0.33 / 9.3 | +0.8% / x0.36 / 5.1 |
| mid water | +13.0% / x1.42 / 8.0 | +3.1% / x1.41 / 5.3 |
| left stream | +2.7% / x1.41 / 15.5 | +7.0% / x1.51 / 10.8 |
| tributary | +17.8% / x1.68 / 11.0 | +11.9% / x1.40 / 10.1 |
| far bank strips A / B / C (error) | 7.1 / 6.5 / 11.4 | 4.2 / 5.8 / 6.0 |
Mean error over the 15 whole-scene regions: approved 7.264, refined 6.738 (-7.2%); with the optional linear resolve 7.303. Sky, mountains, hamlet, meadow and flower regions are unchanged
(spruce 9.5 -> 9.4). Remaining visible differences: near-water contrast is still 0.35x Blender's (Blender's fine ripple and pebble speckle), the left stream is now 7% bright, the tributary is still pale and slightly clean-edged,
and the bank still lacks Blender's gravel micro-structure and the decimated terrain's faceted lip.

## Performance (production preview, 2560x1440, DPR 1, 4x MSAA, 600 samples, A/B/C/C/B/A)
| Case | GPU p50 (two runs) | p95 | Draws | Textures |
|---|---|---|---:|---:|
| approved | 8.78, 9.00 / 8.86, 9.39 | 10.27, 10.38 / 10.76, 10.76 | 134 | 34 |
| refined | 8.99, 9.16 / 8.96, 8.98 | 10.64, 10.79 / 10.72, 10.65 | 134 | 35 |
| refined + linear | 9.67, 9.78 / 9.44, 9.46 | 11.23, 11.02 / 11.18, 11.22 | 135 | 36 |
Two full runs (before and after the reflection-blur change). Steady state: refined vs approved is between -4% and +2% at p50 across the runs, i.e. within run-to-run variation (one extra texture fetch in the terrain shader; same draws and triangles). Linear resolve costs +4 to +9%. One-time: wet map build 16-58 ms CPU and 0.82 MB; reflection refresh 0.38 -> 1.32 ms GPU
(20 -> 44 draws, 0.61M -> 3.53M triangles); bed capture unchanged (4.1-4.6 ms). Static rendering still settles at frame 3 and stops. The reflection-blur change is a shader constant and adds no cost. Memory estimates are calculated allocations, not measured VRAM.

## Validation
24 prototype tests (6 new for water and bank) and 203 application tests pass; lint clean; application and prototype builds pass (existing chunk warnings); no page, shader, console or HTTP errors.

## Not done, with reasons
Bed capture resolution increase (cost above, no error gain; shoreline fixed more cheaply), near-field ripple strength (x1.5-x3 raises contrast 0.35 -> 0.43-0.69 but adds error because the ripple pattern is not aligned with Blender's),
per-pebble tint (no measurable effect), a 1280x720 reflection map (same result as the sharper 640x360, +7 MB), a second reflection plane (not needed: the left stream is within 0.2 m of the plane), restoring thinned roots (no effect on the bank), terrain re-bake or micro-detail for the bank (a delivery-pipeline change), anything on the tributary colour.

## Files
`alpineParityMaterials.js`, `AlpinePrototype.jsx`, `landscapePreview.jsx`, new `bankWetness.js`, `tests/environment-prototype.test.mjs`, `verify-water.mjs`, and the `diagnostics/` scripts and evidence.

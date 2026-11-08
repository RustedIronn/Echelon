# Strip normals, linear-light resolve, flower filtering, and environment isolation

Stop for visual review. No further artistic changes were made.

## Review files (all 2560x1440 frames or crops of them, identical camera, exposure and display transform)
- `pass3-full-blender-vs-new.png`, `pass3-full-previous-vs-new.png`: two complete frames side by side (5120x1440).
- `pass3-previous.png`, `pass3-new.png`, `pass3-new-linear.png`, `pass3-blender-reference.png`: the individual frames.
- Detail montages (Blender | previous | new | new + linear): `pass3-detail-flowers-mid.png`, `-flowers-near.png`, `-meadow-far.png`, `-meadow-mid.png`, `-water-near.png`, `-mountains.png`, `-spruce.png`.
- Data: `pass3-regional-metrics.json`, `pass3-browser-results.json` (GPU), `pass3-strip-calibration-scores.json`, `pass3-missing-asset-probe-before.json` / `-after.json`.
- Preview: `http://127.0.0.1:4174/landscape-preview.html` now serves the new default. Add `?pass=previous` for the renderer exactly as it was before this pass
  (verified pixel-identical to the pre-change frame: whole-frame difference 0). `?resolve=linear` enables the optional linear path;
  `?strips=previous` and `?flowerfilter=previous` switch individual changes off.

## 1. Layer 2/3 strip normals (default on)
Change: `alpineParityMaterials.js` exports `STRIP_SHADING`; layers 2/3 get their own material (`applyGrassHabitat(..., strip)`) with an upward
normal blend and a canopy-occlusion gain. Foreground layers, roots, shape variants, instance counts (773,158) and geometry are untouched.

Calibration (scored against the saved Blender frame, not by eye): 32 + 16 captures, blend K in 0.5-0.9, gain G in 0.50-0.88, both resolve paths.
Score = mean over four grass regions of |relative luminance error| + 0.5 |ln(contrast ratio)|. Previous renderer 0.561. The optimum is a flat plateau
(K 0.8-0.9, G 0.66-0.70 on the display path, 0.58-0.62 on the linear path), score about 0.09. Chosen: K = 0.80, G = 0.68 (display), 0.62 (linear),
the middle of the plateau, keeping some normal variation instead of the smoothest result.

Result, default renderer vs Blender (luminance error / local-contrast ratio / blur error against Blender, 0-255):
| Region | Previous | New |
|---|---|---|
| far field (120-200 m) | -17.3% / x3.66 / 8.9 | +1.4% / x0.95 / 3.9 |
| mid band (60-100 m) | -7.5% / x1.76 / 5.4 | +0.4% / x1.06 / 5.0 |
| far-left field | -0.9% / x3.27 / 6.8 | +5.3% / x1.06 / 5.0 |
| horizon (200-300 m) | -3.2% / x2.35 / 4.6 | -1.2% / x1.47 / 4.0 |
Residuals: horizon contrast is still 1.47x, and the far-left field is 5% bright. The gain is an empirical canopy-occlusion term for unresolved strips,
not a measured physical value, and it is tied to the display path (the linear path needs 0.62).

## 2. Four-sample linear-light resolve (optional, NOT default)
Change: `linearResolve.js`. Renders scene-linear HDR into a 4x multisampled half-float target, resolves in linear light, then applies the Blender
display LUT once (same LUT, exposure and output encoding). Enabled with `?resolve=linear`. Sky is bit-identical to the default path (display applied once).

Whole-scene comparison against Blender (15 regions, mean blur error; lower is better): previous 7.887, new default 7.264, new + linear 7.843, linear alone 7.819.
It brightens everything about 9 percent. That helps regions that were dark (far grass, mid-band flowers: whites per 1000 px 9.6 -> 23.5, Blender 23.4)
but moves regions that were already bright further away: mountains +6.4% -> +9.1%, near grass +28.9% -> +37.5%, mid water +13% -> +20.7%, near flowers +16% -> +29%.
Overall fidelity does not improve, so it stays optional. Cost: +9% GPU median (+16% p95). No regressions in sky, spruce or hamlet (hamlet improves slightly).

## 3. Flower anisotropic filtering (default on, 8x)
Change: `FLOWER_ANISOTROPY = 8` applied to flower albedo maps (clamped to the device maximum). Sweep 1/2/4/8/16 against Blender:
| Level | Mid band blur error | Mid band whites/1000 | Near blur error |
|---|---:|---:|---:|
| 1 (previous) | 7.8 | 9.5 | 8.7 |
| 2 | 7.1 | 12.1 | 8.7 |
| 4 | 6.8 | 12.4 | 8.7 |
| 8 | 6.7 | 12.7 | 8.7 |
| 16 | 6.7 | 12.7 | 8.7 |
Gain saturates at 8. Near petals are unchanged in blur error (8.7 -> 8.7) and visually; near whites per 1000 go 13.0 -> 14.4 (Blender 13.9), near luminance +3 percent.
Distant readability improves but is not solved: whites per 1000 reach 12.7 of Blender's 23.4, and blue-grey-leaning pixels fall 97 -> 75 (Blender 10). Pinks stay low (8.4 vs 15.2).
The remaining gap needs the resolve change (rejected above) or LOD/material work, which was out of scope.

## 4. Missing-asset failure (fixed)
Cause: `ThreeLandscapeWorld` loads `/assets/environment/{terrain,foliage,flowers,village}/*`, which do not exist; the failure unmounted the whole React root.
Fix: new `EnvironmentBoundary.js` wraps the Canvas in `LandscapeEnvironment.jsx`. On any failure it renders nothing, the existing `.landscape-environment__fallback`
gradient stays behind the app, and one console warning is emitted. The alpine prototype was not wired into the app.
Probe (real `LandscapeEnvironment` beside a sentinel, three hosting cases: dev server, host rewriting to index.html with 200, host returning 404):
before: root children 0, sentinel gone in all three; after: sentinel present, environment mounted, fallback element present in all three.
Not fixed: the assets are still missing, so the app shows the gradient instead of the 3D backdrop, and the failed requests still happen. Deciding how to restore the
backdrop (restore assets, restore the deleted 2D scene, or integrate the prototype) is a separate decision.

## GPU benchmarks (production preview build, 2560x1440, DPR 1, 4x MSAA, 600 samples, A/B/C/C/B/A)
Two complete runs; the second is the final code (anisotropy 8).
| Case | Run 1 p50 | Run 2 p50 | Run 2 p95 | Draws | Triangles |
|---|---|---|---|---:|---:|
| previous | 8.82, 8.94 | 9.14, 9.19 | 10.30, 10.46 | 134 | 16,432,549 |
| new default | 8.86, 9.18 | 9.32, 9.24 | 10.62, 10.80 | 134 | 16,432,549 |
| new + linear | 9.61, 9.76 | 10.24, 9.76 | 12.74, 11.34 | 135 | 16,432,551 |
New default vs previous: +1.6% (run 1), +1.2% (run 2) at p50, about +3% at p95: within run-to-run variation. Linear: +9.1% in both runs. Static rendering still settles at frame 3
and stops for both paths. No errors. Absolute numbers drift between sessions (earlier report 9.4-9.7 ms); compare ratios. No integrated-GPU, VRAM, thermal or Tauri measurements.

## Validation
- `npm test`: 203 pass. `node --test tests/environment-prototype.test.mjs`: 19 pass (13 existing, 6 new: strip shader edits and keys, calibration bounds, linear resolve single LUT, flower filter, boundary behaviour, app/prototype isolation).
- `npm run lint`: clean. `npm run build` and the standalone prototype build: pass (existing chunk-size warnings only).
- Browser: no page, shader, console or HTTP errors in any capture or benchmark case.

## Trade-offs and what this does not address
- Calibration targets one reference frame and five measured regions; other lighting or cameras will need re-fitting.
- The pre-existing bright foreground (near grass +28.9%, worst blur error 13.2), dark hamlet (-26%, blur error 20.1) and water contrast are unchanged and remain the largest errors.
- Dropped for this pass: forced LOD0 flowers (+33% GPU), 8x multisampling (+28%), pink-flower response, water shoreline stair-step, any root/density change.

## Files changed
`alpineParityMaterials.js`, `AlpinePrototype.jsx`, `alpinePrototypeData.js`, `landscapePreview.jsx`, new `linearResolve.js`, new `EnvironmentBoundary.js`, `LandscapeEnvironment.jsx`,
`tests/environment-prototype.test.mjs`; `verify-pass.mjs` and the `diagnostics/` scripts and evidence.

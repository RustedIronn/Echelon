# Echelon: desktop WebGL parity refinement

## Review evidence

Local preview: http://127.0.0.1:4174/landscape-preview.html

Default: static demand rendering. Compare complete frames shows both full 16:9 frames, rather than covering half of WebGL. `?refinement=previous` selects the previous parity treatment on identical assets/camera. `?water=physical` selects the expensive comparison.

Browser captures: `cohesion-refined.png` (2560×1440), `cohesion-blender-comparison.png` (two complete 1280×720 frames), and detail crops `cohesion-water.png`, `cohesion-meadow.png`, `cohesion-mountains-hamlet.png`, `cohesion-spruce.png`. These are actual WebGL screenshots. The reference is the saved `grounding_pass_preview.png`, supplied through the existing reference JPEG. Both comparison frames preserve the same camera and 16:9 projection.

## Spruce diagnosis

The spruce was present in the delivery and full WebGL view. The old comparison overlaid Blender over WebGL's entire left half, concealing the runtime tree. This was a comparison defect, not missing geometry.

Runtime inspection confirms two visible spruce material primitives with identical authored transforms before/after. The canopy projects to NDC X −0.876..−0.565, entirely inside the formerly covered half. Combined height is 6.300395 m, matching the native audited object. Position remains (−16.371059, 2.259356, −18.296854) in Three coordinates. No moving, rescaling or replacement occurred.

Native and delivered needle alpha both pass 17.4572% of texels at threshold 0.3; the cutout was not lost. Material inspection is recorded in `native-spruce.log`; exact runtime matrices/bounds are in `cohesion-browser-results.json`. Raster card normals and self-shadowing still look coarser than Cycles.

## Meadow and lighting

Counts remain 268,864 authored grass roots and 2,114 flowers. Positions, botanical colors and flower LOD thresholds are unchanged.

Matching prototype vertices are merged and normals smoothed without moving the blades. Distant shading converges gradually toward a canopy response instead of alternating harsh tiny face normals. The existing full-source root-density map contributes more source grass color to unresolved distant ground. A restrained approximation of the native 16% leaf translucency reuses already-shadowed incident light; layered root shading adds depth. No extra grass shadow pass is introduced.

A tested alpha-to-coverage fade produced pale distant specks. It was rejected and removed after actual visual inspection.

Three direction-independent geometry AO maps improve local ambient separation on near terrain, mountain gullies/green slopes and architecture. They attenuate ambient visibility rather than baking afternoon sunlight or recoloring the source albedo. Source sky radiance, sun direction, exposure, normal/roughness textures and Blender display transform remain.

## Efficient water

The depth/Fresnel surface remains the default. Refined ripple scale, submerged normal response and blue-green attenuation make water darker/bluer and soften harsh pebble lighting. This is appearance adaptation, not physical refraction or volume simulation.

Sky-only reflection could not reproduce the dark banks. One cached 640×360 half-float planar capture now includes terrain, buildings, stones and spruce, with oblique clipping. Instanced grass/flowers and underwater sediment are omitted from that capture. Mip-filtered sampling softens reflections; source display mapping applies after sampling linear reflection radiance. The probe height is sampled from the actual foreground water under the camera. Graded distant water blends back to the sky reflection instead of forcing one plane over the whole watercourse.

The capture runs once after the initial main shadow pass. There is no recurring reflection render for this static view. Camera object changes (including resize-created cameras), geography and water-mode changes invalidate it. Future mutable-camera parallax, time-of-day changes and moving reflected objects require explicit invalidation or a measured update cadence; none is implemented here. The backdrop remains live geometry, not a baked hero-view image.

## Measured performance

Production build; headless Microsoft Edge; ANGLE D3D11; NVIDIA GeForce RTX 5050 Laptop GPU; 4× MSAA. Each case discards 60 frames, retains 600 RAF intervals and available disjoint-checked GPU timer samples. A/B/B/A ordering gives two previous/refined runs each. Default buffer is 2560×1440, DPR 1; high-DPR buffer is 3840×2160.

| Case | GPU median ms | GPU p95 ms | Draws across passes | Triangles across passes |
| --- | ---: | ---: | ---: | ---: |
| cohesion-previous | 8.977 | 9.913 | 134 | 16,375,297 |
| cohesion-refined | 8.394 | 10.074 | 134 | 16,375,297 |
| cohesion-refined-repeat | 8.238 | 9.119 | 134 | 16,375,297 |
| cohesion-previous-repeat | 9.106 | 10.325 | 134 | 16,375,297 |
| cohesion-physical | 15.033 | 16.642 | 223 | 25,851,770 |
| cohesion-high-dpr | 11.045 | 12.683 | 134 | 16,375,297 |

Refined medians were 8.238–8.394 ms versus previous 8.977–9.106 ms. Tail timings overlap: first refined p95 10.074 ms versus previous 9.913 ms. This supports preserved rendering efficiency; it is not a universal FPS guarantee or proof every frame is faster. Steady-state draws/triangles are unchanged.

The one-off reflection capture measured 0.424–0.431 ms GPU in the two refined runs: 20 draws / 609,978 triangles. Its 4K case measured 0.616 ms. Captures occur during warm-up and are reported separately. These timings exclude asset loading and shader compilation latency. Physical transmission remained substantially dearer at 15.033 ms median / 223 draws.

Texture resource counts rose from 27 to 31: three AO maps and the reflection target. AO PNGs total 1,912,837 bytes on disk. No total VRAM measurement was taken. All six cases recorded no page, shader, console or HTTP errors. Static demand rendering settled at frame 3 and stayed there for a further 1.5 seconds. Raw evidence: `cohesion-browser-results.json`, `cohesion-idle.json`.

## Candid visual assessment

Water is closer in blue depth and reflected-bank response; contact shading helps the slopes and hamlet; leaf shading is softer. Composition and authored placements remain intact.

Parity is incomplete. The middle meadow is still grainier and less continuous than Blender; source shape approximation and fine vegetation occlusion remain gaps. The water's planar approximation can look more mirror-like than native rough refraction. Pebble silhouettes are not physically refracted or optically blurred. The spruce's needle cards/self-shadowing and mountain atmospheric depth remain coarser. No new parity percentage or artistic approval is claimed.

## Reproduction, validation and boundaries

After the previously documented base delivery, normal/roughness and parity preparations, run Blender with `--background --factory-startup --disable-autoexec --python design-reference/environment/webgl-prototype/prepare_cohesion_surfaces.py`. It imports the delivery GLB only, writes AO PNGs/provenance, and does not open/save the master.

Build the app with `npm run build`, then the preview with `npm exec -- vite build --config design-reference/environment/webgl-prototype/vite.config.mjs`. Serve with `npm exec -- vite preview --config design-reference/environment/webgl-prototype/vite.config.mjs --host 127.0.0.1 --port 4174 --strictPort`. Run `node design-reference/environment/webgl-prototype/verify-cohesion.mjs`; `ECHELON_PREVIEW_URL` can override the server address.

Passed: 203 application tests; 9 prototype tests (including source projection/root preservation, AO provenance and installed Three shader compatibility); ESLint; application production build; separate preview build; real browser visual/GPU checks. Builds retain their >500 kB chunk warning. No Tauri/live-productivity-UI, sustained thermal or total-VRAM benchmark was performed.

The master was hash-checked afterward and remains `0abcb3c95ae349e9c7831d0e8913c3d40016fc049675aa738df773b1aae25506`. Geography GLB, architecture/tree models, authored vegetation roots, reference image and master were not rewritten. Productivity logic and mobile fluid-gradient work are untouched. No animation, seasons, weather, fish, downloads or deployment occurred. Existing private-asset redistribution restrictions still apply.

Changed implementation: `AlpinePrototype.jsx`, `alpineParityMaterials.js`, `landscapePreview.jsx`, `alpinePrototype.css`, `tests/environment-prototype.test.mjs`. Added reproducible AO/verification and native material inspection scripts, three local AO textures, provenance, benchmark JSON, screenshots and this report. Prior parity reports remain available. Stop for human visual review.

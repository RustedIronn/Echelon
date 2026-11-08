# Echelon environment handoff for Claude

## Read this first

Echelon is a working React + Vite + Tauri productivity app. We are adapting an approved Blender-authored alpine landscape into a desktop Three.js / React Three Fiber backdrop.

**The WebGL scene is NOT artistically approved or ready for the next stage.** The user explicitly wants the base refined, especially water and the middle meadow. The latest pass has stopped for visual review. This document provides context; it is not authorization to start additional implementation or expand scope.

The real project is **`D:\Projects\Echelon`**. Some older conversation/environment messages still name `C:\Users\User\Projects\Echelon`; that is stale. Resolve paths against D: and inspect the actual files before working.

### Current boundaries

- Preserve approved geography, camera, mountain silhouettes/direction, hamlet placement/general architecture, stream layout, and foreground flower palette/placements.
- Keep the Blender master unchanged. Work on delivery derivatives and the isolated WebGL prototype.
- Do not touch authentication, routes, state, persistence, finances, habits, schedules or other productivity functionality.
- Do not add wind, day/night, weather, seasons, moon systems, fish, or other new systems in the current pass.
- Do not restart asset hunting, scatter random detail, redesign the landscape, or rebuild mountains/terrain procedurally to avoid rendering problems.
- Mobile uses a separate fluid-gradient direction. Do not merge it into this desktop WebGL work.
- The environment is designed for one controlled hero camera with gentle future parallax, not unrestricted exploration.
- Every visual revision should include an actual rendered picture. The user finds rendering Blender manually inconvenient.
- Passing tests or generating geometry does not constitute artistic success. Inspect the actual hero view and close-ups; report weaknesses candidly.

## Artistic intent and current composition

The intended feeling is standing in a lush, flower-rich alpine meadow beside a winding stream, looking toward a small distant hamlet and a connected mountain range. Foreground vegetation and water are the experience; mountains support it. Keep the valley open and peaceful.

The fixed camera is low/slightly elevated on the left foreground. The main stream enters lower-right, curves left across the scene and leaves the frame; a smaller tributary continues toward the foothills. A foreground-left spruce provides scale. The hamlet is on the right. Mountains rise naturally behind the valley, with plenty of sky.

Visible flowers include Marguerites, Dandelions, Red Clover and Carthusian Pink. Foreground flower placement finally works; do not move the population back toward the cottage/horizon. Existing background trees are hidden; do not casually add forest coverage.

There is a long history of discarded procedural landscapes, grass auditions and a separate House on the Hill/red-cottage experiment. Those are historical branches, not the current foundation. Do not follow old cleanup/rebuild instructions as new requests. The current working foundation is the approved alpine Blender scene below.

## Source of truth and review evidence

**Blender master:**
`D:\Projects\Echelon\design-reference\environment\alpine-composition-01\echelon_alpine_composition_01.blend`

Unchanged SHA-256:
`0abcb3c95ae349e9c7831d0e8913c3d40016fc049675aa738df773b1aae25506`

**Approved saved Blender hero render:**
`D:\Projects\Echelon\design-reference\environment\alpine-composition-01\grounding_pass_preview.png`

Reference size: 2560×1440. The runtime reference JPEG derives from it and is only a comparison image, never a world background.

**Latest report:**
`D:\Projects\Echelon\design-reference\environment\webgl-prototype\CORRIDOR_REVIEW.md`

**Latest actual WebGL evidence, in that same directory:**
- `corridor-refined.png`: full hero image.
- `corridor-blender-comparison.png`: complete Blender frame left / complete WebGL frame right, total 5120×1440.
- `corridor-water-close.png`: camera-preserving water/bank crop.
- `corridor-middle-close.png`: camera-preserving middle-meadow/hamlet-context crop.
- `corridor-browser-results.json`: actual GPU measurements and diagnostics.
- `corridor-idle.json`: static rendering check.

`COHESION_REVIEW.md`, `PARITY_REPORT.md`, `PARITY_BENCHMARK.md` and the prototype README contain earlier stages. Some historical README URLs/overlay descriptions are stale. Prefer the current code and CORRIDOR_REVIEW. None of those reports grants artistic approval.

## Application versus prototype: do not confuse them

The new Blender-authored environment is isolated at:
`http://127.0.0.1:4174/landscape-preview.html`

That link works while the local production preview server runs. The ordinary productivity app has **not** been switched to this prototype.

`D:\Projects\Echelon\src\app\environment\LandscapeEnvironment.jsx` still mounts the older `ThreeLandscapeWorld.jsx`. Editing that old renderer will not fix the new prototype, and replacing application integration is outside the current scope.

### Active implementation files

Under `D:\Projects\Echelon\src\app\environment\`:

- **`AlpinePrototype.jsx`** — R3F scene, asset loading, exact authored camera, lighting, geography/material preparation, instanced grass/flower LODs, cached water captures and measurement instrumentation.
- **`alpineParityMaterials.js`** — native Blender display LUT, grass/canopy shading, wet sediment, sky shader, old comparison water and current depth-resolved water.
- **`alpinePrototypeData.js`** — camera/axis conversion, grass transforms, static ripple data, stable foreground representation selection and three-triangle distant blade geometry.
- **`landscapePreview.jsx`** — standalone preview controls and diagnostic URL parameters.
- **`alpinePrototype.css`** — preview/comparison layout.

Entry: `D:\Projects\Echelon\landscape-preview.html`.
Delivery assets: `D:\Projects\Echelon\public\assets\environment\alpine-prototype\`.
Pipeline/evidence/scripts: `D:\Projects\Echelon\design-reference\environment\webgl-prototype\`.
Prototype tests: `D:\Projects\Echelon\tests\environment-prototype.test.mjs`.

Installed versions observed: Three 0.186.1, R3F 9.8.2, React 19.2.8, Vite 8.2.0, Blender 5.2.2 LTS. Inspect installed source when modifying shader hooks: a Three internal diffuse-lighting expression changed, and a regression test now guards against silently losing our leaf contribution.

## What is actually transferred

The hybrid workflow uses Blender-authored geography and placements, with runtime-specific materials/representation. It is not a new procedural reconstruction or a static wallpaper.

- `geography.glb` contains the approved terrain, mountain silhouettes, hamlet, upper water faces, bank stones, sediment and spruce. Terrain was simplified from 3,629,860 to 580,777 triangles before near/far partitioning to preserve their shared boundary.
- `manifest.json` contains camera, sun, palettes and authored flower transforms.
- `parity.json` describes source sky/display conversion, grass data, water depths, sediment wetness and original coverage data.
- `flowers-lod.glb` retains the source species with three LODs. Existing 2,114 flower transforms remain unchanged; distance thresholds are 26 m and 65 m.
- Foreground grass uses source-derived curved blade prototypes and native roots/headings/dimensions.
- `canopy-material.json`, `meadow-canopy-color.png`, `meadow-canopy-normal.png`, `grass-canopy-2.bin` and `grass-canopy-3.bin` are the latest native middle/foothill derivatives.

### Coordinates and materials

Blender `(x,y,z)` becomes Three `(x,z,-y)`. Manifest camera and flower matrices are already converted; do not convert them twice. Grass binary records retain native coordinates and are converted by `grassMatrix`.

The saved camera is 28 mm, vertical FOV about 39.7607076°, 16:9. Three camera position is approximately `(-3, 4.362933, 10)`, with the exact saved quaternion/matrix in the manifest. Projection tests independently compare native and runtime landmarks.

Surface bakes contain albedo, normals, roughness and direction-independent AO, not fixed afternoon illumination. Terrain UV maps use `flipY=false`; the world-space top-down canopy maps use `flipY=true`. Albedo is sRGB; normal/roughness/AO data is non-color. Preserve those distinctions.

The runtime uses a sampled native Blender OCIO display transform: a 65³ RGBA16F LUT in log domain −12..8, reproducing the saved AgX look. Three's stock AgX is not identical. Source sky is a linear EXR from Blender's physical sky, used for background/IBL. Avoid double tone mapping, arbitrary palette overlays, and compensating for material errors with extra ambient light.

## Latest meadow approach and lessons

The sparse middle meadow previously used detailed blades at a subset of the original roots. Merely fading/thinning these over a terrain texture made the field flat; that attempt was rejected.

The current implementation recovers the full valid native middle and foothill populations: 185,941 and 441,263 roots respectively. It uses narrow three-triangle curved strips at those distances instead of 12-triangle blades. Existing foreground detail remains, including every prior blade within 32 m. Middle/foothill roots are culled only outside the active view plus a 20% NDC safety margin.

Total rendered grass instances are now 773,158 versus 268,864 previously. This count increase is explicit, but it restores source placements with cheaper geometry; no new uniform/random scatter was generated. All-pass triangles rise only about 0.35%. The extra instance work/coverage still has a measured GPU cost.

Unlit source grass color/coverage and world normals support broad terrain canopy response. Native growth masks and botanical colors are retained. Reduced distant upward-normal bias avoids artificially bright, uniformly sun-facing grass.

Two failures worth avoiding:
- Alpha-to-coverage fading produced pale distant specks; it was removed.
- A filled two-triangle diamond turned lateral blade curvature into oversized leaf area. The corrected three-triangle strip preserves narrow cross-sections. Do not reintroduce the diamond or inflated width.

Earlier isolated shrub/tuft scattering, random weed additions, uniform density increases and dark carpet-like terrain repeatedly failed. Improve representation, growth continuity and light response rather than hiding defects with more objects.

## Latest water approach and limitations

The previous alpha shader tone-mapped the water and opaque scene separately before blending. The new shader combines reflected radiance and attenuated bed radiance in linear space, then applies the native display transform once.

It uses:
- Existing source water mesh and channel geometry.
- A cached 640×360 foreground planar reflection of geography/architecture/stones/spruce, excluding expensive instanced vegetation.
- A cached 1280×720 opaque scene color/depth view for actual submerged detail.
- Per-pixel surface-to-bed distance, restrained screen-space refraction, rejection of samples crossing onto above-water banks, depth-dependent filtering and spectral attenuation.
- Existing submerged stones/turf overhangs naturally participating through depth, without adding decorative rock lines.

The old fixed blue sediment multiplier is removed in this path. Static ripple/reflection response is tuned; there is no flow or time animation.

Captures run once during settling; static demand rendering then stops. Camera object/geometry/mode changes invalidate them. `window.__echelonPrototype.refreshWaterOptics()` explicitly refreshes them for measurement. Mutable-camera parallax and future changing lights/reflected objects will need proper invalidation/update scheduling later; it is not implemented now. This cache is an optical buffer, not a replacement image for the whole world.

Remaining limitations: screen-space refraction cannot reveal hidden bed surfaces, filtering can smear small pebbles, one planar probe approximates a graded watercourse, the opposite bank's exposed soil remains too even, and the distant tributary is pale/clean-edged. Do not claim the water is finished.

## Spruce: already diagnosed

The prominent spruce was not missing. The old comparison overlaid Blender across WebGL's entire left half, concealing the runtime tree. Compare now shows two full frames.

Both spruce primitives retain their authored transform and a combined height about 6.300395 m. Native and delivered alpha cutout coverage match (about 17.4572% of texels pass threshold 0.3). Do not move or duplicate the tree to fix a comparison problem. Raster needle normals/self-shadowing still differ from Cycles.

## Latest measured performance — not estimates

Production preview, headless Edge, ANGLE D3D11, RTX 5050 Laptop GPU, 4× MSAA, 2560×1440 at DPR 1. Alternating A/B/B/A cases; 60 warm-up frames discarded; 600 RAF samples with disjoint-checked GPU timer queries.

| Metric | Previous pass (`corridor=0`) | Current |
|---|---:|---:|
| GPU median | 8.280–8.432 ms | 9.361–9.718 ms |
| GPU p95 | 9.564–9.684 ms | 10.349–11.319 ms |
| Draws across passes | 134 | 134 |
| Triangles across passes | 16,375,297 | 16,432,549 |
| Texture resources | 31 | 34 |

The current version costs roughly another millisecond per steady frame. Physical transmission with the same current meadow measured 16.356 ms median / 223 draws / 26,168,554 triangles. No FPS guarantee follows from these numbers.

Initial bed-capture query intervals measured 35.837–344.751 ms, including lazy pipeline/driver initialization. After warming, explicit bed refreshes measured 3.875–3.954 ms and reflection refreshes 0.344–0.371 ms. These captures are not recurring static-frame costs, but their setup/refresh cost must not be hidden.

Two 3072×2791 canopy PNGs add 15.98 MB. Native placement records add a net 18.82 MB over the sampled versions: about 34.8 MB additional raw delivery data. Full uncompressed mip-chain storage for the canopy pair is calculated around 91.5 MB, plus an approximate 13.5 MB color/depth target budget. These are allocation calculations, not measured VRAM residency. No total-VRAM, sustained thermal or integrated Tauri/UI benchmark has been done.

Static rendering settled at frame 3 and remained there during a further 1.5 seconds. All five final browser cases recorded no page/shader/console/HTTP errors. Raw JSON is the evidence; do not invent new performance figures.

## Run and validate

From PowerShell:

```powershell
Set-Location 'D:\Projects\Echelon'
npm test
node --test tests/environment-prototype.test.mjs
npm run lint
npm run build
npm exec -- vite build --config design-reference/environment/webgl-prototype/vite.config.mjs
npm exec -- vite preview --config design-reference/environment/webgl-prototype/vite.config.mjs --host 127.0.0.1 --port 4174 --strictPort
```

Build the normal app before the standalone preview: the app build empties `dist`. If port 4174 is already served by the existing preview process, reuse it; do not kill unrelated processes.

In another shell, run:

```powershell
node design-reference/environment/webgl-prototype/verify-corridor.mjs
```

`ECHELON_PREVIEW_URL` overrides the benchmark server. Playwright is already isolated under the prototype's `browser-tools/node_modules`; scripts use installed Edge and confirm the actual RTX renderer. No new dependency/add-on install is needed.

Useful URL parameters:
- `capture=1`: hide controls.
- `compare=1`: two complete matching frames.
- `benchmark=1`: continuous rendering for profiling; otherwise demand rendering.
- `corridor=0`: immediately previous water/meadow pass, correct current A/B baseline.
- `refinement=previous`: an older pre-cohesion treatment; not the immediately previous pass.
- `look=baseline`: the early prototype, older again.
- `water=physical` / `water=alpha`: costly physical / crude alpha comparisons.
- `vegetation=0`: geography isolation.
- `dpr=1.5`: higher internal resolution; do not compare its timing against DPR 1 without saying so.

Last validation passed: 203 application tests, 13 prototype checks, lint, normal production build, standalone production build. Chunk-size warnings remain. Tests cover camera projection, unchanged source provenance, native root preservation, display LUT, installed shader compatibility and narrow distant-strip geometry.

## Reproduce derivatives only if necessary

Blender executable:
`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`

Pipeline scripts live in `D:\Projects\Echelon\design-reference\environment\webgl-prototype\`:
1. `export_prototype.py` — base geography/material/placement delivery; `--surface-only` for native normal/roughness bakes.
2. `prepare_parity.py` — native display LUT, sky, initial grass records, depth/wetness and flower LODs.
3. `prepare_cohesion_surfaces.py` — direction-independent delivery-geometry AO.
4. `prepare_canopy_material.py` — unlit native grass material atlases.
5. `prepare_canopy_roots.py` — full valid native middle/foothill records and metadata.

Run Blender with `--background --factory-startup --disable-autoexec --python <script>`. These preparations use temporary in-memory scenes and do not save the master. Most inspection should use existing derivatives/evidence first; a full re-export is not required for a shader adjustment.

## Practical cautions and what remains pending

Assets include mixed CC0/CC BY/Royalty Free sources. Local derivatives are ignored under their asset folder and are not cleared for public raw-asset redistribution. Do not force-add, publish, deploy or relabel them CC0. No new assets were downloaded in the latest pass.

The latest result still needs human review. In particular, compare the bank soil continuity, pale tributary, middle-field grain/lighting and pebble filtering against Blender at the identical camera. Texture-only flattening and simplistic wider leaf cards have already been tried and rejected. Do not declare victory because root counts, geometry totals or tests look good.

The user's latest request was this handoff. No additional rendering implementation was authorized after the review stop. When further work is requested, stay on the current base water/middle-meadow refinement unless the user explicitly changes priorities.

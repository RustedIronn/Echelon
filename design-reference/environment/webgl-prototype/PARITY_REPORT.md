# Desktop visual parity and targeted optimization

The revised default is ready for **artistic review**, not declared pixel-identical to Cycles.

Open **http://127.0.0.1:4174/landscape-preview.html**. It renders only when needed by default. Enable **Profile continuously** to inspect running frame statistics. Use **Compare** for the approved Blender reference on the left and WebGL on the right.

## What improved

### Meadow body

The first prototype retained only 107,645 grass blades. This pass recovers **268,864 existing authored roots**, concentrated according to the source layers rather than uniformly filling the entire valley:

| Source layer | Original prototype | Revised |
|---|---:|---:|
| Foreground arching grass | 68,719 | 143,829 |
| Low basal foliage | 8,536 | 20,520 |
| Midground continuation | 22,340 | 65,167 |
| Meadow/foothill transition | 8,050 | 39,348 |

A regression check confirms that the original sampled roots remain in the new set. No plants were moved or offset into duplicate patches.

A representation bug also mattered: the first prototype scaled blade width with its forward reach. Short, upright templates could consequently become broad ribbons when reused for a longer blade. Revised records retain **independent measured width, reach and height**, and templates are matched by their arch/upright profile. This improves structure instead of disguising it with count alone.

The grass shader adds restrained root-to-tip color and indirect-light occlusion. A **1024² coverage field derived from the full valid native root population** supplies the unresolved canopy color in the middle distance, blended by viewing distance. It follows the existing habitat and gaps; it is not a new scatter or a painted flower distribution.

The new roots increase actual 3D coverage, while the canopy field addresses the surface between distant blades. Some distant grass still looks grainier than the Blender reference; the entire 856,263-blade source population has not been exported.

### Flowers and targeted geometry savings

All **2,114 delivered flower placements** remain unchanged. The nearest flowers retain the previous high-detail delivery sources. At 26 m and 65 m horizontal camera distance, medium and distant source LODs take over. Far flower instances no longer all cast tiny, barely readable shadows.

| Species | Near triangles/source | Medium | Distant |
|---|---:|---:|---:|
| Marguerite | 4,665 | 1,632 | 630 |
| Dandelion | 7,061 | 2,471 | 847 |
| Red Clover | 7,502 | 2,624 | 899 |
| Carthusian Pink | 2,004 | 701 | 240 |

These are measured geometry counts, not FPS predictions. LODs preserve the source images/materials and botanical palette. They were judged from the actual hero render; close petals remain recognizable. Future moving-camera use will need a transition policy if threshold popping becomes visible.

### Lighting and color

The original prototype used Three's base AgX approximation, an analytic sky and manually reduced environment intensity. That did not reproduce the saved Blender look.

The revised renderer uses:

- The saved **AgX / Medium High Contrast** OpenColorIO transform, sampled into a 65³ RGBA16F display LUT. Input is scene-linear Rec.709/sRGB, and the LUT output is linear display RGB before the final sRGB encoding.
- The saved **0.1-stop exposure**, read from derivative metadata rather than chosen as another color correction.
- A **2048×1024 sky-only linear EXR** captured from the approved Blender physical world. This supplies both the visible sky and environment illumination/reflections; no landscape or house imagery is baked into it.
- The existing sun direction, color and energy, with dynamic Three.js material lighting and shadows.

An independent CPU-reference test verifies that native OCIO middle grey is reproduced within the LUT interpolation tolerance. This fixes the underlying display-transform mismatch instead of applying a green tint or more ambient light.

The sky radiance is a static afternoon asset. Future time-of-day work must provide changing sky radiance or a matching dynamic atmosphere; the sky component is separate for that purpose. Sunlight is **not** baked into the terrain albedo.

### Mountain and terrain response

Normal and roughness maps are baked from the original editable material system onto the same delivery meshes/UVs: **1024² near normals, 2048² mountain normals, and 512²/1024² roughness**. The connected terrain, silhouette, camera and architecture geometry were not changed.

This restores surface response that the first color-only bake discarded. The detail on/off comparison shows its visible contribution. Its measured timing difference is small enough that this short benchmark should not be treated as a precise isolated cost or proof that these resolutions are optimal. No larger texture resolution was assumed to be better.

### Cheaper water

The new default is **single-pass depth-aware Fresnel compositing**:

1. Per-vertex depth comes from raycasting the exact delivered surface vertices against the evaluated Blender streambed.
2. Fresnel reflectance samples the source sky radiance.
3. Restrained absorption and a shallow-edge fade leave the actual rendered bed and submerged objects visible.
4. Small static normal variations give the surface a calmer water read.

It does **not** request Three's physical transmission render target or re-render the opaque landscape.

The speckles were not just a water-normal issue. The delivery stones had lost their native wet/material response. A wetness field now comes from the authored water surface; submerged pebbles are darkened accordingly, and their delivery normals are smoothed without changing vertex positions, shapes or placements. Scattering was reduced to avoid the milky appearance. Pebbles remain present rather than being deleted to conceal the problem.

**Limitations:** this method has no true refractive displacement, no tree/hamlet reflections and no full RGB volumetric transport. Alpha compositing is an approximation to Cycles' optical integration. Some bed stones remain too crisp and the water is still lighter than the Blender reference. It is nevertheless a materially better match than the old flat alpha approximation at a similar measured cost. Physical transmission remains selectable for comparison.

Three's documentation also distinguishes physical transmission from ordinary opacity and notes the added material cost: [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html). Actual costs below come from this project benchmark, not the documentation.

## Actual validation

See **PARITY_BENCHMARK.md** and raw `parity-browser-results.json`.

All seven production-browser cases loaded without recorded page, console or failed-resource errors. Inspected full hero views, the Blender split comparison, and direct foreground, mountain and water crops. Files:

- `parity-fresnel.png`: revised default.
- `parity-blender-comparison.png`: source reference left, revised WebGL right.
- `baseline-physical.png`: original prototype remeasured in the same harness.
- `parity-physical.png`, `parity-alpha.png`: alternative water paths with the revised scene.
- `parity-no-surface-detail.png`: material-detail comparison.
- `parity-foreground-detail.png`, `parity-mountain-detail.png`, `parity-water-detail.png`: actual browser crops.
- `parity-idle-hero.png`: default demand-rendered view.

The default static scene's frame counter stayed at **1 → 1 over 1,500 ms** after settling. This establishes that this preview did not submit more frames while unchanged; it is not a claim of zero system GPU power. Future wind/water motion must enable continuous or explicitly scheduled rendering while active. Continuous profiling is enabled by `?benchmark=1`.

Checks passed: **203 existing application tests**, **7 prototype regression checks**, lint, application build and isolated preview build. Both builds retain the chunk-size warning. No Tauri/WebView2 or live productivity-UI performance benchmark was performed.

## What is still different

The comparison now reads much more like the same environment: the sky/color mismatch is reduced, the meadow has a fuller body, mountain surfaces have more depth, and the river is clearer and less speckled. It is not finished artistic parity. Remaining differences include distant-canopy grain, simplified grass self-lighting, spruce-card response, missing Cycles GI/refraction and some overly crisp/bright streambed detail.

Do not use a timing result or these checks as artistic approval. The saved hero images are the review evidence.

## Reproduce this pass

From the project root:

```powershell
# Base assets, only if absent or the approved master changes:
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python design-reference/environment/webgl-prototype/export_prototype.py

# Source material response on the existing delivery topology:
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python design-reference/environment/webgl-prototype/export_prototype.py -- --surface-only

# Native display/sky, grass, depth/wetness and flower LOD derivatives:
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python design-reference/environment/webgl-prototype/prepare_parity.py

npm test
node --test tests/environment-prototype.test.mjs
npm run lint
npm run build
npm exec -- vite build --config design-reference/environment/webgl-prototype/vite.config.mjs
npm exec -- vite preview --config design-reference/environment/webgl-prototype/vite.config.mjs --host 127.0.0.1 --port 4174
```

For captures/benchmarks, use the existing isolated Playwright installation and installed Edge:

```powershell
$env:ECHELON_PREVIEW_URL='http://127.0.0.1:4174'
node design-reference/environment/webgl-prototype/verify-browser.mjs
```

Useful review URLs:

- `?compare=1`: Blender split comparison.
- `?water=physical&benchmark=1`: revised scene, physical transmission.
- `?water=alpha&benchmark=1`: revised scene, flat alpha approximation.
- `?look=baseline&water=physical&benchmark=1`: original look/coverage.
- `?detail=0&benchmark=1`: native surface maps disabled.
- `?dpr=1.5&benchmark=1`: higher drawing-buffer resolution.

Default `water=fresnel`, `look=parity`, DPR 1. No animation is implemented.

## Preservation, changed files and publication

The Blender master's SHA-256 remains:

`0abcb3c95ae349e9c7831d0e8913c3d40016fc049675aa738df773b1aae25506`

Camera/terrain projection and source provenance remain regression-checked. The original geography GLB, architectural models, source flower assets and authored flower transforms are retained. No productivity logic or mobile fluid-gradient implementation was changed, and the application has not been switched from its existing environment to this preview.

Changed implementation: `AlpinePrototype.jsx`, `alpinePrototypeData.js`, new `alpineParityMaterials.js`, `landscapePreview.jsx`, prototype tests; native preparation/export and browser-verification scripts; local ignored derivatives and review evidence.

Rendering efficiency improved; transfer size is **not yet optimized**. Additional grass records, normal maps, a display LUT and comparison LOD assets increase local data. Baseline comparison assets also remain available. No total VRAM measurement was taken. KTX2/mesh compression, a final deployment asset subset and Tauri integration remain later work.

All prior private-asset restrictions still apply. No assets were downloaded or publicly deployed in this pass. Source credits remain in the original attribution files. The generated display LUT derives from Blender's installed OCIO configuration; its header credits AgX work by Troy Sobotka, Zijun Eary Zhou, Mark Faderbauer and Sakari Kapanen, and points to https://github.com/EaryChow/AgX. Retain the applicable OCIO/configuration notices when preparing redistribution; the LUT is not being newly labeled CC0 here.

No wind, water-flow animation, weather, seasons or fish were added. Stop here for visual review.

# Echelon: water and middle-meadow refinement

## Review files

Preview: http://127.0.0.1:4174/landscape-preview.html

Previous pass on the same camera/assets: append `?corridor=0`. Current default uses the refined water and middle meadow. The normal application environment has not been switched over.

- `corridor-blender-comparison.png`: two complete 2560×1440 frames, Blender left / WebGL right; total image 5120×1440.
- `corridor-refined.png`: current full WebGL hero frame.
- `corridor-water-close.png`: 1300×500 camera-preserving hero crop, showing the body, bed and both bank transitions.
- `corridor-middle-close.png`: 1800×420 camera-preserving hero crop, showing the middle meadow, stream corridor and settlement context.

These are actual browser screenshots. The native reference is the existing saved `grounding_pass_preview.png`, supplied through the existing reference JPEG. No substitute render or generated image was used.

## What changed: water

The previous transparent shader separately tone-mapped water and background before blending them. It could not combine depth, submerged detail and reflected radiance consistently. The refinement composites reflected light and attenuated bed light in linear space, then applies the existing Blender display LUT once.

A cached half-resolution opaque color/depth capture (1280×720) provides the actual view of gravel, pebbles, bank geometry and vegetation behind the water surface. Per-pixel scene depth resolves the water-to-bed optical distance rather than relying only on interpolated terrain-bed depths. Refraction is restrained, and samples that would pull an above-water bank into the stream are rejected. Depth-dependent filtering softens submerged detail. Shore coverage uses actual surface-to-opaque depth, allowing existing stones and turf overhangs to meet the water naturally.

The previous fixed blue multiplier on sediment is removed in this path. Submerged gravel retains softer normal response and wet darkening; wavelength-dependent attenuation occurs in the water instead. Reflections retain the cached local-bank probe, with calmer static ripples and mip filtering. An extra sky blend was rejected because the bright horizon overwhelmed the local-bank reflection; the probe already contains the visible sky.

This remains a non-physical, screen-space approximation. It uses no physical transmission pass or simulation. Geometry, bed, stones, bank shapes, water course, mountain layout and camera are unchanged. No additional stones or decorative bank objects were scattered.

## What changed: middle meadow

A texture-only canopy with heavily thinned blades was tested and rejected: it removed grain but flattened the field. The final approach recovers the full valid authored middle/foothill root populations from Blender, preserving the existing ecological distribution and original sample anchors. It does not generate new scatter positions.

The previously sampled middle blades used 12 triangles each. The restored population uses narrow, curved three-triangle strips, retaining native heading, reach, width and height variations. A filled two-triangle diamond was rejected because lateral bend inflated apparent leaf width; a regression test now protects the corrected strip geometry.

Detailed foreground blades remain. Every prior blade within 32 m is retained. More distant foreground/basal detail hands over gradually, while the actual middle/foothill populations retain their native density. Off-camera middle roots are culled against the active projection with a 20% NDC safety margin. Root count rises from 268,864 to 773,158, but geometry per distant blade is substantially cheaper; this is a representation change, not uniform new scatter.

Unlit color/coverage and world-normal atlases are rendered from the existing native grass only, with no afternoon illumination baked in. They carry source growth variation into the underlying terrain rather than a constant mean-green fill. Coverage-derived canopy occlusion supports broad masses. The distant upward-normal bias is reduced to avoid artificially bright, uniformly sun-facing grass. Source botanical colors and flower transforms are unchanged.

## RTX 5050 measurements

Production build; Microsoft Edge headless; ANGLE Direct3D11; NVIDIA GeForce RTX 5050 Laptop GPU; 4× MSAA; 2560×1440 drawing buffer, DPR 1. Each case discards 60 initial frames and collects 600 RAF intervals with available disjoint-checked GPU timer samples. Previous/current/current/previous ordering supplies two runs each. Physical transmission is an additional comparison with the same new meadow representation.

| Case | GPU median ms | GPU p95 ms | Steady draws, all passes | Triangles, all passes | Texture resources |
| --- | ---: | ---: | ---: | ---: | ---: |
| corridor-before | 8.432 | 9.564 | 134 | 16,375,297 | 31 |
| corridor-refined | 9.718 | 11.319 | 134 | 16,432,549 | 34 |
| corridor-refined-repeat | 9.361 | 10.349 | 134 | 16,432,549 | 34 |
| corridor-before-repeat | 8.280 | 9.684 | 134 | 16,375,297 | 31 |
| corridor-physical | 16.356 | 17.977 | 223 | 26,168,554 | 32 |

Current median GPU time is 9.361–9.718 ms versus previous 8.280–8.432 ms. This pass costs approximately 0.9–1.4 ms more per steady frame in these runs. P95 also increases. It is not a free visual improvement. Physical transmission measured 16.356 ms median and 223 draws, so the cached optical approach remains substantially cheaper in this comparison.

Steady draw calls remain 134. Triangles increase from 16,375,297 to 16,432,549: +57,252, approximately +0.35%. The larger instance population still increases vertex/instance work and pixel coverage despite a near-constant triangle budget. Prototype-vertex totals alone do not measure vertex-shader invocations.

### Optical-cache cost

Reflection and bed captures occur during initial settling and are not recurring steady-state passes. The first bed-capture GPU-query interval measured 344.751 ms on the first page and 35.837 ms on the repeat page. These first-use intervals include lazy pipeline/driver initialization and must not be presented as warmed draw cost.

Explicit refreshes after warming measured 3.875–3.954 ms for the bed capture (89 draws, 9,736,005 triangles) and 0.344–0.371 ms for the reflection (20 draws, 609,978 triangles). A future cache refresh therefore has a real rendering cost. No continuous refresh or animation is implemented. Static demand rendering settled at frame 3 and remained at frame 3 during another 1.5-second observation.

### Texture and delivery cost

The observed GPU texture-resource counter rises from 31 to 34. Added roles are two canopy textures and the color/depth optical target; the old density-only terrain sampler is no longer active in the new path. This resource count is not VRAM usage.

Both canopy maps are 3072×2791 RGBA8, totaling 15,983,408 bytes as PNG files. Calculated uncompressed texel storage with full mip chains is about 91.5 MB for the pair. The half-resolution RGBA16F color plus depth target has a calculated storage budget around 13.5 MB including color mips. These are allocation estimates, not measured driver/VRAM residency.

Native middle/foothill records total 22,579,344 bytes versus 3,762,540 bytes for their old sampled records: +18,816,804 raw bytes. Together with the atlases this adds about 34.8 MB of raw delivery data. Compression/packing is not done in this pass. The increased texture and placement footprint is a known cost, not silently treated as optimized.

All five benchmark cases recorded no page, shader, console or HTTP errors. Raw measurements: `corridor-browser-results.json`; idle check: `corridor-idle.json`. No integrated Tauri/productivity-UI benchmark, sustained thermal test or total-VRAM measurement was performed. These are GPU-time measurements, not FPS guarantees.

## Visual assessment and remaining weaknesses

The middle meadow retains a three-dimensional grass body rather than sparse upright specks or a flat texture, and the authored growth pattern continues toward the hamlet. Water has more coherent bed-to-reflection/depth behavior, with softened submerged detail and existing bank vegetation correctly occluding the surface. The full view is closer in continuity, but not artistically finished or fully at Blender parity.

The opposite bank still has an overly even exposed-soil profile. The distant tributary remains pale and clean-edged. Some middle-distance grass still reads as raster grain, and the simplified blades do not reproduce all native curvature/self-shadowing. Bed filtering can smear small pebble groups, and screen-space refraction cannot reveal surfaces hidden from the main camera. The foreground planar reflection remains an approximation for a graded stream.

These weaknesses remain visible in the review images. No rocks, shrubs, extra flowers or unrelated features were added to conceal them. This pass does not justify advancing to animation or seasons without further visual approval.

## Reproduction and preservation

After the previously documented base/parity/AO delivery preparation, run Blender background with `--factory-startup --disable-autoexec --python` for:

1. `prepare_canopy_material.py`: read-only master import, unlit top-down native grass material atlases.
2. `prepare_canopy_roots.py`: read-only master import, valid native middle/foothill roots and matching metadata.

Both scripts hash-check the master and never save it. The master remains `0abcb3c95ae349e9c7831d0e8913c3d40016fc049675aa738df773b1aae25506`. The geography GLB also remains unchanged and is checked against AO provenance.

Build the application with `npm run build`, then the standalone preview with `npm exec -- vite build --config design-reference/environment/webgl-prototype/vite.config.mjs`. Serve using the documented Vite preview command on port 4174 and run `node design-reference/environment/webgl-prototype/verify-corridor.mjs`. `ECHELON_PREVIEW_URL` overrides the server address.

Passed: 203 application tests; 13 prototype tests including camera projection, provenance, near-blade preservation, existing native anchors and corrected distant strip geometry; ESLint; application and standalone production builds; actual hero/detail inspection and GPU measurements. Existing chunk-size warnings remain.

Changed source: `AlpinePrototype.jsx`, `alpineParityMaterials.js`, `alpinePrototypeData.js`, `landscapePreview.jsx`, prototype regression tests. Added canopy preparation/verification scripts, two texture atlases, two native root buffers, metadata, captures and this report. The Blender master, mountain/hamlet/camera/stream geography, flower palette/placements, productivity features and mobile fluid-gradient implementation are untouched. No wind, time states, weather, seasons, fish or other living-world systems were added. No downloads or public deployment occurred; existing private-asset redistribution restrictions remain.

Stop for visual review of the base scene.

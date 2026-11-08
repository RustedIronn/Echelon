# Shared meadow habitat review — 8 November 2026

## Review images and preview
- before.png: actual checkpoint scene, 2560×1440.
- after.png: revised production WebGL render, identical camera and resolution.
- before-after.png: side-by-side display of the actual captures.
- Live production preview: http://127.0.0.1:4181/landscape-preview.html
- Previous meadow available with ?meadow=detailed. New default: ?meadow=habitat.

## What changed
The old middle meadow enlarged grass with distance while separate noise functions controlled terrain tint and plant distribution. This produced a tall bristly belt and disconnected growth. The new system reuses the foreground grass geometry at natural scale and shares one world-coordinate habitat field across ground shading, grass density/height/color and middle-distance blossoms. Broad overlapping growth sweeps are moderated by slope, actual prepared water geometry and height, lowered bank ground, settlement clearings and existing grass coverage. Mild coherent noise softens patch edges rather than generating the landscape structure.

Three render iterations corrected an initially bare bank, restored authored bank turf, adjusted growth using actual bank elevations, and established intermingled bloom pockets. A final grounding correction prevents new bank grass receiving the bank lowering twice. New plants are rejected below water level near the shoreline. Ground tint and new growth fade in beyond 32 metres; the existing immediate foreground and flower placements are retained. A quieter, low-detail canopy continues farther into the valley instead of filling every distant pixel with enlarged geometry.

Editable controls: GROWTH_SWEEPS and habitat channel formulas in meadowHabitat.js; growth reach, density, scale and flower pocket logic in meadowHabitatGrowth.js. The 440×304 RGBA habitat map stores density, height, blossom abundance and moisture. CPU placement samples the same quantized data as the terrain shader. No downloaded assets, dependencies, Blender regeneration, or new animation systems.

## Preservation
Checkpoint: design-reference/environment/checkpoints/2026-11-08-before-shared-habitat.
All 157 checkpoint hashes verified; failed hashes: 0. All runtime delivery assets and the Blender master remain unchanged. Existing camera, river layout, hamlet, mountain geometry and lighting are preserved. Source changes are confined to the environment preview and its vegetation helpers, plus regression tests. Existing water reflections can reflect the new vegetation naturally.
The sampled foreground rectangle (x80,y1050,width1000,height350) has mean absolute RGB difference 0; sky rectangle difference 0. These measurements verify those regions, not the entire image.

## Production measurements
RTX 5050 Laptop GPU, Edge headless ANGLE D3D11, 2560×1440, DPR1, four-sample resolve. Matched A/B/B/A, 600 collected frame samples per run, GPU timer samples collected asynchronously; raw data in benchmark.json. These are local browser measurements, not a guarantee of application frame rate on all devices.

| Measurement | Previous | Revised |
|---|---:|---:|
| GPU median ms, repeated runs | 13.67 / 12.78 | 14.06 / 13.73 |
| GPU p95 ms, repeated runs | 14.62 / 14.04 | 15.60 / 15.34 |
| Draw calls, all passes | 193 | 184 |
| Triangles, all passes | 16,850,484 | 20,198,285 |
| Texture resources | 44 | 45 |
| Geometry resources | 153 | 144 |

The habitat texture adds 535,040 base bytes (about 0.51 MiB), no mip chain, and no additional asset download. Texture count is not a VRAM measurement. The extra modelled middle vegetation increases triangle work by about 20%; fewer mesh groups reduce draw calls. No performance improvement is claimed for this visual pass.

## Verification
- npm test: 203/203 passed.
- Environment and habitat tests: 58/58 passed, including water exclusion, shared texture sampling, deterministic growth, protected foreground and root grounding.
- Changed implementation/test files pass ESLint.
- Repository-wide lint remains blocked by six pre-existing active errors in GeneratedSky.jsx, hamletGeometry.js and tuftGroup.js. Historical copied source inside the checkpoint also duplicates old lint findings unless excluded. Those unrelated files were left untouched.
- Normal application production build and separate environment production build passed; large bundle warning remains.
- Production captures report no page errors. No FPS, VRAM or WebGL mobile claims beyond the measured desktop runs.

## Artistic assessment and remaining weaknesses
The opposite bank and middle valley now share the foreground's low flowering grass language, with softer height transitions and intermingled blossoms instead of tall grass fences. Openness, the stream view and architectural landmarks remain readable. This is a more cohesive review candidate, not artistic approval.
The farthest meadow is still simpler and flatter in its visual structure than the foreground. The preserved hamlet path remains abrupt, the distant stream remains smooth, and the existing water surface still has conspicuous underwater/reflection patterning. These were not disguised by changing the approved geography, hamlet or water treatment. Final landscape quality still requires human review; this pass stops here.

## Files changed
- src/app/environment/AlpinePrototype.jsx
- src/app/environment/landscapePreview.jsx
- src/app/environment/realFlowers.js
- src/app/environment/meadowHabitat.js (new)
- src/app/environment/meadowHabitatGrowth.js (new)
- tests/environment-prototype.test.mjs (updated preview default expectation)
- tests/meadow-habitat.test.mjs (new)
- This private checkpoint and shared-habitat review scripts, diagnostics and actual render captures.

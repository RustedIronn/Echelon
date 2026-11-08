# Day-cycle art direction - 8 November 2026

## Scope and evidence

Refines Claude's `a7f4fb4` foundation. Original source and hashes are preserved in `design-reference/environment/checkpoints/2026-11-08-before-day-cycle/`. No Blender master, geography, botanical placement, camera, mountain forms, hamlet layout, application logic or water material was changed. No downloads, seasons, vegetation animation or new weather systems. Not committed or pushed by this pass.

Actual 2560x1440 WebGL hero captures, fixed date 21 June 2026:

- 06:30 morning
- 14:00 afternoon
- 19:12 sunset
- 20:06 blue hour
- 21:30 night

Full-resolution frames, contact sheets and measurements are in `day-cycle/`. Contact sheets arrange actual screenshots; they are not concept images. Both before and after sets were inspected at full frame and as a group.

## Changes and reasons

- Daylight washed out the foreground: reduced high-sun direct/fill/environment strengths and restrained the maximum vibrance/contrast grade to +7%/+2.5%, from +20%/+8%. This changes scene illumination rather than botanical colors or material palettes.
- Sunset flattened into pink: concentrated warm glow nearer the horizon, kept a cooler upper sky, increased medium-scale cloud/shading structure, and reduced the oversized sun-disc threshold.
- Moon felt graphic: reduced radius from .021 to .012 radians and softened its broad halo. Calendar phases remain. Direct moonlight follows illuminated fraction, without an artificial quarter-strength floor.
- Morning mist revealed terrain sheets: two layers replace three, with no uniform opacity floor, reduced strength and more foreground clearance. The stream retains a restrained dawn trace. This is still a surface approximation, not volumetric fog.
- Uniformly lit windows looked staged: a per-aperture vertex attribute selects a minority of cottage/farm rooms, a faint chapel vestibule window and subtle nave glazing. Belfry louvers stay dark. One shared glass material adds no light sources or draw calls; it does not simulate interiors or ground light spill.
- Live mode advanced in 30-second steps: cache two model states at 30-second anchors and interpolate directions, colors and atmosphere at 4 Hz. Cloud coordinates are continuous across date boundaries. PMREM and water optics retain the slower cadence; manual changes refresh after settling. Approved mode remains static.
- Found an existing restoration bug: `Color.set()` was called on the manifest's RGB array, leaving the previous warm sun tint in place. Array references now use `fromArray()`. The regression test uses the real array-shaped reference.
- Replaced reversed-edge smoothstep expressions in the touched sky shader with inverse ascending ramps. A scoped scene-attachment helper also resolves the earlier GeneratedSky hook-immutability lint failure.

## Assessment and limitations

The five moods are more distinct and cohesive: fresh morning, clearer daylight, warm clouded sunset, lavender blue hour and quieter moonlit night with selected warm rooms. Night keeps the stream and meadow silhouette readable without trying to preserve daytime botanical detail.

This is a refinement for human review, not final artistic approval. Clouds remain a soft 2D procedural treatment. Mist can expose its approximation from other viewpoints. Window warmth implies occupancy through emission rather than true interior lights. These visual captures cover one summer date/phase, not every season or lunar phase. Astronomy remains deliberately art-directed rather than location-accurate. No additional effects were added to conceal weaknesses.

## Actual checks

- 203 application tests pass; 67 environment/habitat/community/day-cycle tests pass.
- Four new tests cover subsecond/midnight continuity, restrained grade/phase lighting, selective windows and approved restoration.
- Changed-file ESLint passes. Full lint retains two existing unused-parameter errors in untouched `tuftGroup.js`.
- Application and isolated prototype production builds pass; the existing large-chunk advisory remains.
- All five views have empty browser/shader error lists.
- Live demand-mode validation: 8 seconds produced 39 frames with no new environment/reflection captures. After a further 23.5 seconds the sky count advanced from 2 to 3 and the reflection count from 3 to 4. Framework/metrics invalidations add frames beyond the 4 Hz sampling callback. Live mode redraws more often than the old 30-second stepping; approved remains demand-rendered/static.
- Manual -> live -> approved visually matches a fresh approved load: only 22 RGB channels differ by one 8-bit value, mean absolute difference 0.00000199/255. No browser errors.
- Original/current hamlet comparison: all 32 position/normal/UV/color arrays and all indices are byte-identical; both have 5,420 triangles. Only the glass warmth attribute was added.

## Short rendering measurements

RTX 5050 Laptop GPU, Edge/ANGLE D3D11, 2560x1440 DPR1. Each view has 180 warm frame samples after startup; GPU query samples are fewer. These short runs show approximate cost, not a statistically strong speed improvement. No VRAM measurement. No new textures/material meshes; active mist loses one draw.

| View | GPU median before / after | Draws before / after |
|---|---:|---:|
| morning | 21.84 / 20.89 ms | 219 / 218 |
| afternoon | 20.65 / 20.77 ms | 215 / 215 |
| sunset | 22.30 / 22.41 ms | 220 / 219 |
| blue-hour | 21.61 / 21.37 ms | 217 / 217 |
| night | 19.02 / 19.44 ms | 217 / 217 |

## Reproduce

```powershell
npx vite --config design-reference/environment/webgl-prototype/day-cycle.config.mjs --host 127.0.0.1 --port 5195
node design-reference/environment/webgl-prototype/capture-day-cycle.mjs after
node design-reference/environment/webgl-prototype/validate-day-cycle.mjs
node --test tests/day-cycle.test.mjs
npx vite build --config design-reference/environment/webgl-prototype/vite.config.mjs --outDir dist/day-cycle
```

Preview: `/landscape-preview.html?tod=14&date=2026-06-21`. Other hours: `6.5`, `19.2`, `20.1`, `21.5`. `?tod=live` follows the device clock. Omit `tod` for approved static mode. `capture=1` hides controls. Existing private delivery assets/browser-tools are required.

Changed source: `timeOfDay.js`, `GeneratedSky.jsx`, `skyShader.js`, `ValleyMist.jsx`, `AlpinePrototype.jsx`, `hamletWindowLighting.js`, `hamletGeometry.js`, `Hamlet.jsx`; plus regression tests, capture/validation scripts and preview config. No productivity code changed.

# Meadow clarity and coverage correction

## What was corrected
- The finite baked canopy used a hard rectangular UV inclusion test. Its colour contribution, normal response and canopy occlusion now feather together over 24 metres; the newer habitat field also feathers its own outer boundary.
- The previous new grass stopped at 150 metres, leaving the old sparse/flat representation exposed in the left valley. Habitat growth now continues to 220 metres, within the existing ground-height field. This fixes the coverage gap as well as the material seam.
- Source layer 2/3 blades were unconditionally reduced from 12 triangles to 3. Their actual curved geometry now remains through a staggered 112–138 metre handover. Added foreground-source grass retains its 20-triangle shape to 105 metres rather than 68 metres. No textures were upscaled.
- Leaf width increases gradually beyond the protected 32-metre foreground, reaching 1.55× at 125 metres. This preserves readable narrow leaf silhouettes without inflating whole plants. Blade reach, roots and underlying geography are unchanged.
- Natural flower placement matrices carried scale, but the instancing planner discarded it. It now preserves that authored size variation and adds bounded (at most 22%) middle-distance silhouette compensation. The existing foreground flower component is unchanged.
- Flower pockets continue to 175 metres instead of stopping at 108 metres. Abundance is concentrated into richer habitat areas, reducing uniform coloured speckling. 2,168 new middle-distance flowers in this pass, versus 1,472 previously.

## Visual iteration
The first clarity attempt fixed coverage but was too busy (1.46 million grass instances, 3,832 new flowers). The second reduced redundant distant blade overlap and concentrated flowers into bloom pockets: 1,267,529 grass instances. All counts include existing vegetation. The actual hero-camera render was inspected at 2560×1440, along with the middle strip and before/after crop. The formerly bare left region now reads as continuing meadow, with fuller silhouettes and more visible flower colour. The far valley is still simpler than the foreground because individual leaves eventually become subpixel; no claim of full Blender parity.

## Preservation
New rollback checkpoint: design-reference/environment/checkpoints/2026-11-08-before-meadow-clarity.
The existing larger checkpoint remains intact. All 42 delivery files and the Blender master are unchanged. The hero camera, river layout, mountains, hamlet, lights and original foreground placements are preserved. Mean absolute RGB difference in the protected foreground test rectangle: 0; sky: 0. These are region checks, not proof of every pixel elsewhere. Water may reflect vegetation changes; no water-system redesign.

## Measured cost
Production WebGL preview in headless Edge, ANGLE D3D11 on RTX 5050 Laptop GPU, 2560×1440, DPR1, four-sample resolve. Two 600-frame captures, GPU queries asynchronous. Previous-pass measurements are saved separately and were taken in an earlier session, so this is not a simultaneous controlled hardware comparison.

| Metric | Previous habitat pass | Clarity pass |
|---|---:|---:|
| Median GPU ms, two runs | 14.06 / 13.73 | 16.07 / 16.17 |
| GPU p95 ms, two runs | 15.60 / 15.34 | 18.56 / 18.43 |
| Draw calls, all passes | 184 | 207 |
| Triangles, all passes | 20,198,285 | 25,687,519 |
| Texture resources | 45 | 45 |

The increase in cost is explicit: more resolved geometry is retained farther from the camera. No higher-resolution textures or new downloads. The first clarity attempt submitted 29,263,594 triangles; refinement brought that to 25,687,519. No FPS or VRAM claims.

## Validation
- npm test: 203 passed.
- Environment/habitat tests: 59 passed, including a new regression proving flower size variation survives instancing without moving roots.
- Changed implementation files and habitat tests pass ESLint.
- Full lint (excluding private checkpoints) still reports six pre-existing errors in untouched GeneratedSky.jsx, hamletGeometry.js and tuftGroup.js.
- Application and isolated preview production builds pass. Large-bundle warnings remain.
- Both production captures report no page errors.

## Files and review
Changed: AlpinePrototype.jsx, alpineParityMaterials.js, meadowHabitat.js, meadowHabitatGrowth.js, realFlowers.js and tests/meadow-habitat.test.mjs. No new library or living-world feature.

Images: after.png (full hero), before-after.png (full comparison), coverage-comparison.png (left-valley comparison), middle.png (middle-distance crop). Raw metrics: benchmark.json; preservation.json and pixel-comparison.json hold verification evidence.

Preview: http://127.0.0.1:4181/landscape-preview.html

This is a review candidate. The far meadow remains fairly level and the hamlet path and water patterning are still weak; changing those preserved systems is outside this pass.

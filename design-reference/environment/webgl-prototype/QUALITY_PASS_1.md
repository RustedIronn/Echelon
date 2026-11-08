# Quality pass 1: resolution, texture filtering, anti-aliasing

Driven by review of the live preview ("anti-aliasing not working", blurry mountains, stretched meadow texture, specks on the ridges). Blender is no longer the target; these are renderer faults.

## What was wrong and what changed
| Symptom | Cause (verified) | Change |
|---|---|---|
| Soft, jagged everything on a laptop display | The preview rendered at pixel ratio 1 regardless of screen scaling, so the browser stretched the canvas (a 1707x960 buffer shown on 2560x1440 device pixels at 150%) | Resolution is now **Auto** (the screen's pixel ratio, capped at 2); the panel has a Resolution selector (Auto / 1x / 1.5x / 2x) and `?dpr=` still overrides |
| Dark dotted specks along every mountain silhouette | The display transform was applied before MSAA samples were blended, so edge pixels against the bright sky went dark. Removed by the linear-light resolve and by nothing else I tried (no AO, no normal map, no shadow receive, no fog) | **Linear-light resolve is now the default** (4 samples, display transform applied once afterwards) |
| Blurry mountains, stretched ground | Terrain, mountain, hamlet and tree textures and the canopy atlas had no anisotropic filtering at grazing angles | 16x anisotropy on those textures (`?terrainfilter=previous` turns it off) |

## Evidence (captures in `diagnostics/out`, not copied)
- Ridge crop: specks present in the old pipeline, absent with linear resolve (`f3-ridge.png`). Mountain and ground crops: more rock and ground detail with anisotropy (`f1-mountains-filter.png`, `f1-ground-filter.png`). Scaled-display demo: 1x canvas visibly softer than auto (`f1-scaled-mountain-edge.png`).
- Whole-frame change versus the previously approved capture: mean difference 1.5 of 255, largest in flowers and meadow (up to 5), sky unchanged. The scene is slightly brighter in the meadow because blending in linear light keeps more energy in small bright details; use Exposure in the panel to taste.

## Reproducing earlier looks
`?resolve=display&terrainfilter=previous` reproduces the last approved capture exactly (whole-frame difference 0); `?pass=previous` reproduces the original default (difference 0).

## Cost (production preview, 2560x1440 buffer, 4x MSAA, GPU p50 ms)
| Case | p50 | vs previous |
|---|---:|---:|
| previous (display resolve, no aniso) | 8.72 / 9.00 | - |
| now, pixel ratio 1 | 9.89 / 10.43 | about +15% |
| now, pixel ratio 1.5 (3840x2160 buffer) | 13.35 | about +51% |
| now, pixel ratio 2 (3840x2160 css-equivalent at 2x) | 17.62 | about +99% |
Auto means the cost follows your device pixels: a 1707x960 window at 150% renders a 2560x1440 buffer, i.e. the first "now" row. Weaker GPUs will need the Resolution selector or a quality tier. Static rendering still settles at frame 3.

## Seen but not fixed in this pass
The flat, detail-free patch in the left middle ground is clearly visible (`f3-meadow-left.png`); the tributary still reads as flat blue; spruce needles, distant flower shimmer, reflections, the hamlet and the sky/light are next.

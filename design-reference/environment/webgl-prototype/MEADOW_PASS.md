# Middle and far meadow pass (phases 1 and 2)

`?meadow=previous` (also implied by `?pass=previous`) restores the earlier meadow.

## Phase 1: terrain shader detail (`meadowDetail.js`)
Beyond about 32-64 m the meadow ground gets growth patches (clover, lush, drier tall grass), finer breakup, flower specks in drifts and a little aerial perspective. It acts on the near-terrain meadow only (not the mountains) and skips the hamlet's tended ground. The distant blades follow the same patchiness and the void-fill patch is darkened to match.

## Phase 2: clustered far flowers (`farFlowers.js`, `FarFlowers.jsx`)
About 10-30k upright quads (two triangles each) in drifts from 40 m to 300 m, inside the camera's view, sized by distance, muted palette (cream, buttercup, pink, red clover), grounded from `far-heights.bin` (made by `make-far-heights.mjs` from the terrain meshes), kept off the hamlet and the stream banks and out of the water reflection.

## Cost (RTX 5050 laptop, 2560x1440, A/B/B/A, `verify-meadow.mjs`, `meadow-benchmark.json`)
GPU median 10.33 / 10.42 ms before, 10.97 / 10.88 ms after (about +0.55 ms); +1 draw, +32k triangles of 16.5M counted across all passes.

## Not done
Look-dev sliders for the meadow, wind, the white glints in the far strips, integrated-GPU quality tier, up-close check of the fill patch.

## Revision after review: natural placement and extended tall grass
- The first far flowers (flat dots on a grid) read as confetti rows and were replaced by small real flowers (stem, leaves, petal fan, centre; 10-24 triangles) in irregular clumps of one dominant species with strays, plus scattered singles, varied in size, lean and turn.
- Diagnosis: the authored tall arching grass exists only in a corridor about 50 m wide (x -25..25, 20-70 m), and `keepResolvedGrass` thins it from 100% at 32 m to 8% at 85 m; the delivered flowers are about 10x sparser beyond 40 m. Everything else was short strips.
- `meadowSynthesis.js` now builds extra tall grass for the barren middle ground from the authored blades (shape, palette, variants), on a jittered grid, density 28/m2 near and 15/m2 at 110 m, modulated by growth patches, skipping the existing corridor, the hamlet and the stream, with distant blades wider and taller.
- Cost, same A/B/B/A (RTX 5050 laptop, 2560x1440): GPU median 10.16 / 10.06 ms before, 11.42 / 11.20 ms now (about +1.2 ms), +1.65M triangles (16.5M to 18.2M counted across all passes), +16 draws.

## Revision 2: tuft cards (replaces the synthesized blades and the geometric flowers)
Study of the foreground (about 100 individually readable blades per m2, dark bases and bright tips, a low understory, flower plants with leaves) against the middle ground (14-28 short flat strips per m2, upward-forced normals, no understory, ground specks stretching into dashes at grazing angles) led to baking cards instead of adding blades.
- `tuftBake.js` renders, once at load, the real foreground blades (34/42/26/36 per tuft, delivered shapes and widths), basal leaves, and clusters of the delivered daisies, clover, dandelions and pinks into nine small transparent textures (`diagnostics/dump-atlas.mjs` writes them to `diagnostics/out/tuft-atlas.png`); a card is two crossed quads.
- `tufts.js` places them (jittered grid, patch-modulated density tapering from 3.2/m2 near to 0.45/m2 at 230 m, cards growing with distance; flower clumps in drifts with strays and singles), off the authored corridor, hamlet and stream, on `far-heights.bin`.
- Alpha threshold 0.3 with alpha-to-coverage; grass cards get a light base-to-tip shade of their own; flower cards are lit as if facing the sky and brightened.
- Terrain-shader ground specks removed (they stretched into dashes).
- Cost (A/B/B/A, RTX 5050 laptop, 2560x1440): GPU median 10.02 / 9.88 ms before, 10.94 / 11.38 ms after (about +1.2 ms); +9 draws, +111k triangles. Mostly fill-rate from overlapping cards.

## Revision 3: quality (pixelation)
- Tuft cards are baked at 512x512 (was 256) with blades 1.35x wider so thin blades survive the smaller texture levels; anisotropy 8.
- Anti-aliasing: the resolve target now uses 8 samples by default, capped by the GPU (`?msaa=4` restores the earlier setting). Thin cut-out geometry (tufts, petals) needs more than 4.
- Measured (`verify-dpr.mjs`, RTX 5050 laptop, 2560x1440 viewport): 8x MSAA at 1x resolution is about 13.5 ms GPU median (about 2.3 ms more than 4x at about 11.2 ms); rendering at 1.5x internal resolution is 19.7 ms and at 2x is 30.1 ms.
- Most of what still reads as pixelation at 45-100 m is inherent: a tuft is only a few pixels across there. Only a higher internal resolution (or a quality tier that spends the GPU) fixes that.

## Revision 4: real blades and flowers (default); `?meadow=cards` keeps the baked cards
Research (secondhand search summaries; the Codrops article itself returned HTTP 403): chunked instanced grass with distance LOD (blades near, billboards or clumps far), alpha-test rather than blending, overdraw as the main cost, clump noise driving height and colour, and coverage-preserving alpha for thin cut-outs (alpha scale about 1.3-1.4 per mip, or max-downsampled distance fields; lisyarus.github.io blog).
- Middle ground 32-112 m: real foreground blades from the synthesis (full 20-triangle shape to 60 m, the 3-triangle silhouette beyond), with the foreground material (base-to-tip gradient, base occlusion, back-light), density 90/m2 tapering to 18/m2, patch-modulated colour and height.
- Flowers: real delivered models (middle level of detail, at most 1,800) to 60 m; small baked flower cards beyond (grass cards are no longer used).
- Cost at 4x MSAA (RTX 5050 laptop, 2560x1440, A/B/C/C/B/A, `verify-modes.mjs`): previous meadow 9.96 / 10.41 ms; baked cards 10.97 / 10.90 ms (+0.75); real blades and flowers 10.51 / 10.47 ms (+0.3), +0.36M triangles, +33 draws.
- Not done: coverage-preserving mip alpha for the far flower cards, flower drifts that read at noon, wind, integrated-GPU tier.

## Revision 5: composition (scale compensation and flowering drifts)
Diagnosis: matching true scale and stacking "far" cues (thin blades, flattened shading, haze, thinned flowers) turned the middle and back into fine noise that did not read as the foreground's meadow.
- Scale compensation: distant blades grow with distance (width up to about 2.8x, height up to about 2.1x by the far edge, measured from one point for every layer); far haze halved; blade colour variation raised.
- Flowers: real models to 60 m (cap 1,800, gently larger with distance). Tried and removed: bigger flower objects/cards (read as pale boxes) and ground-shader colour drifts in perspective coordinates (smeared into vertical streaks, also visible in the river reflection).
- Flowering drifts through blade colour (`flowerDrift` in `meadowDetail.js`): where slow drift noise (stretched in depth) is high, the 32-112 m blades take a paler, warmer tint (cream, buttercup, a little lilac), fading in from about 40 m. No extra objects.
- Cost at 4x MSAA (`verify-modes.mjs`): previous 10.62 / 9.94 ms, now 10.53 / 10.57 ms (about +0.3 ms), +0.34M triangles, +30 draws. 8x MSAA (the default) adds about 2.3 ms on top; `?msaa=4` restores 4x.

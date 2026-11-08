# Procedural hamlet (settlement)

Replaces the authored hamlet mesh with a settlement built in JS: the chapel stays the landmark at the same spot, the buildings are about 0.7 of the old size and spread out, and the place now has yards, boundaries, lanes and trees.

## Contents
- Chapel with belfry tower and slate spire, five homesteads (whitewash, cream/timber, ochre farm with wing, ochre cottage), a red barn and a shed.
- Boundaries per yard: dry-stone wall, post-and-rail fence or hedge, each with a gate gap on the side nearest a lane.
- Three lanes converge on a gravel apron in front of the chapel; short spurs reach each homestead.
- Six broadleaf trees, kitchen-garden plots, stacked logs. About 21.6k triangles in 13 meshes (one per material).

## Files
- `src/app/environment/hamletLayout.js` layout data and 2D helpers, `createHamletClearing()` (mown ground).
- `src/app/environment/hamletGeometry.js` pure geometry builder on a height raster (`HeightField`).
- `src/app/environment/hamletTextures.js` small tiling canvas textures; `Hamlet.jsx` the R3F component.
- `make-hamlet-heights.mjs` rasterises the delivered terrain into `hamlet-heights.bin/.json` (gitignored asset).

## Flags
Default is procedural. `?hamlet=previous` (also implied by `?pass=previous`) restores the authored mesh: capture diff against the last approved frame is 0 in every region. Grass roots and flowers inside the clearing are skipped only when the procedural hamlet is on.

## Not done yet
Window glow for night (needs the time-of-day system), a render-cost benchmark, close-up quality (the settlement is judged at the authored camera distance).

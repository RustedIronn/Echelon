# Quality pass 2: empty patch, spruce, far water, distant flowers

Follows `QUALITY_PASS_1.md`. Driven by the live-preview review; judged by eye, not against Blender.

| Complaint | Cause (verified) | Change | Switch back |
|---|---|---|---|
| Flat, detail-free patch in the left middle ground | A rectangular void in the authored grass data (Blender x -150..-30, y 100..150): a root-density map shows zero roots there while the surrounding meadow has about 1,650 per 10 m cell | `make-fill-roots.mjs` resamples roots from the adjacent mid meadow into the void (87,915 roots, seeded, grounded on the delivered terrain, 90-degree-rotated cells with jitter, clear of the hamlet). Rendered as extra layer-2 strips | `?fill=off` |
| Spruce "soul sucked out", blocky needle edges | Flat dark cutout cards: no backlight, faceted card normals, hard alpha-tested edges that MSAA cannot smooth | Alpha-to-coverage on the needles; tonal lift and saturation; cone-like blended normal; back-light and ambient wrap. Spruce brightness slider added to the panel | `?trees=previous` |
| Tributary like light-blue paint | Its surface (4.42 m) sits level with the camera (4.36 m), so no planar reflection can exist for it; it showed flat sky colour with a hard edge | Beyond 40-120 m: shoreline feathers wider with distance, colour drifts 25 percent toward grey, water darkens 28 percent at its banks | `?waterpass=approved` |
| Shimmery meadow after the left stream | Dark, desaturated flower parts (stems, shaded petals) read as speckle at 40-110 m | Back-light and ambient wrap on flowers; dark, low-saturation parts fade into the meadow beyond 40-110 m while strongly coloured petals stay | `?flowerstyle=previous` |

Dropped: a second planar reflection plane for the tributary. It cannot work (camera is below that water plane, so the reflector does not render) and I removed it rather than leave dead code.

## Reproducing earlier looks
`?pass=previous` still reproduces the original default exactly (whole-frame difference 0). `?waterpass=approved&resolve=display&terrainfilter=previous&fill=off&trees=previous&flowerstyle=previous` reproduces the last approved look exactly (difference 0).

## Cost (production preview, 2560x1440 buffer, GPU p50 ms)
previous 8.75 / 8.72; now 9.77 / 9.71 (about +11 percent, which already includes pass 1's linear resolve and anisotropic filtering). Draws 134 -> 145, triangles 16.43M -> 16.60M, textures 34 -> 36. Static rendering still settles at frame 3.

## Still open
Reflections ("make them real"), the hamlet redesign (scaled down, with yards, boundaries and converging lanes, around the chapel), sky and light atmosphere, motion, parallax.

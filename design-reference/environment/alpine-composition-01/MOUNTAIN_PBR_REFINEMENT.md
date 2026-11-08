# Mountain cliff material and clarity pass

The existing canonical blend is updated in place. Mountain geometry, meadow, water, flower positions, camera and sun were checked against pre-pass hashes/settings and remain unchanged.

## Diagnosis

The preceding rock colour, height and roughness images were named `aerial_rocks_04_*_4k.png` but decoded to only 2048 × 2048 pixels. They were projected with a broad 0.28 box blend and subdued into a largely procedural colour response. The camera's depth of field was already disabled, so camera defocus was not the cause.

## Material

Poly Haven's [Marble Cliff 02](https://polyhaven.com/a/marble_cliff_02), by Amal Kumar, supplies four genuine 4096 × 4096 maps: diffuse, roughness, OpenGL normal and floating-point height. It is CC0. Original downloads and attribution are retained under `material-resources/mountain-cliff-pbr/`; dimensions, colour spaces and SHA-256 hashes are recorded in `mountain_pbr_report.json`. All four maps are packed into the blend.

The new editable node group is **Echelon alpine cliff PBR - sharp world projection**. Three sign-correct world projections share a coherent colour/roughness/height/normal coordinate system. Normal maps are reoriented per axis and blended with the underlying mesh normal rather than incorrectly applied through one tangent-space normal map node. Projection weights use an exponent of four. Main cliff formations use a 32 m tile; a restrained 6.8 m height layer adds finer grain. The colour grade is a muted warm grey. Rock normals blend only over exposed rock, preserving meadow/bank shading and excluding the established snow cover.

The first render was too pale and grainy. The final refinement reduces the mineral value to 0.80, normal strength to 0.46 and fine bump to 0.16 / 0.012 m. No new geometric displacement or silhouette changes were made.

## Render clarity and saved settings

The final hero is 2560 × 1440. The same-camera range crop is rendered from a 3840 × 2160 frame. Cycles uses up to 256 samples, noise threshold 0.004 and a 1 px reconstruction filter, with denoising enabled. These settings are saved so opening the canonical file does not silently return to the softer test settings. Device preference and the pre-existing lighting/compositor are preserved.

## Verification

`verify_mountain_pbr.py` reopens the exact saved blend in a fresh process, checks the six preserved terrain/water/flower coordinate hashes, fixed camera and sun, packed 4K maps, their sRGB versus Non-Color assignments, and saved output-quality settings. It also renders the saved-file peak detail to ensure packed maps actually shade correctly. All checks passed.

Actual images: `mountain_pbr_preview.png`, `mountain_pbr_detail.png`, and `mountain_pbr_saved_peak.png`. The surface detail is more legible in the inspected crops. Fine features still diminish with distance and output resolution; this pass does not claim textures alone resolve every remaining geological/artistic issue. No artistic approval is assumed.

## Reproduction

Run `refine_mountain_pbr.py` for an unsaved material audition, or add `-- --commit` to update the canonical blend after rendering. `mountain_pbr_preservation.json` records pre-pass geometry hashes. The new maps are preserved in their original directory. Earlier mountain-construction helpers set older shader values; if rebuilding the terrain from them, apply this material pass afterward. No application code, new scene versions, animation, libraries or add-ons were introduced.

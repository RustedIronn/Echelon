# Reference-led alpine identity refinement

Updated `echelon_alpine_composition_01.blend` in place. The supplied mountain crop is the visual target, not a background image or a claim of exact reconstructed geometry. No outside models or textures were downloaded for this pass.

## Mountains

The preceding range had adequate mesh resolution but rounded faces, broad uniform rock masks and a visually smooth green apron. This pass changes actual face geometry using unequal warped rock domains, secondary angular shoulders, smaller joints, and bounded connected drainage incision. Drainage is conditioned on an isotropic sampling grid with priority-flood outlet routing, contributing-area weighting, limited stream-power-style cutting and restrained side-wall transport. It is an art-directed terrain model, not calibrated physical simulation. Quiet areas remain between the carved areas. Snow is recalculated from elevation, local orientation, drainage and patch-scale accumulation, allowing exposed ribs to break the cover. Grass and rock occupy separate, irregular slope regions instead of one uniformly grey material field. Existing triplanar rock maps are reused at a smaller physical scale.

The latest height changes range from approximately -6.53 to +2.90 m on the mountain faces. The hero skyline is protected with actual camera-ray horizon measurements. Terrain below world Y 268 m is byte-identical to the preceding pass, including the meadow, stream banks and settlement hillside.

## Hamlet and paths

The existing five editable vernacular buildings are refined with unequal heights, roof pitches and volumes: a lower cottage with a timber porch, taller cottages, and a restrained service wing. Door panels are timber rather than pale panels that looked like glazing. Related but different slate tones, stone/limewash finishes, and low-level weathering help avoid the identical-model appearance. These remain simplified British/European countryside-inspired models, not documented reproductions of a specific historic village.

The old narrow wear mask missed much of the visible approach because of both its spatial bounds and terrain occlusion. The approach is now deliberately authored on camera-visible terrain and joins preserved entrance locations and side routes. A wider packed mask covers the full route. Grass and flower exclusion use the same field, and the underlying soil/gravel palette is lightened toward worn buff limestone. The paths are ground material and vegetation response, not floating meshes. World-space control points and map bounds are recorded in `alpine_identity_lanes.json`.

## Stones

The existing reusable stone meshes and their placements are retained. Their material now mixes in a paler, weathered limestone mineral colour instead of the previous uniformly dark brown response. Underwater gravel and the water mesh are retained. No new rock pack is used.

## Preservation and verification

`verify_alpine_identity.py` reopens the actual saved blend in a fresh Blender process and checks the camera/lens, original meadow geometry, exact water coordinates, sun energy, saved camera-view workspaces, and retained grass/flower source counts. It measures old/new terrain horizons using BVH rays rather than projected vertex envelopes. Crop rendering changes are deliberately not saved over the canonical render settings.

The actual native Cycles hero is `alpine_identity_preview.png`. Detail views are `alpine_identity_mountains.png`, `alpine_identity_hamlet.png`, and `alpine_identity_bank.png`. No paintovers or generated images are used. Application code, productivity features, camera, watercourse, background-tree visibility, animation and atmosphere systems are untouched.

## Artistic assessment

The range has more visible internal structure and clearer rock/green/snow separation. The hamlet has more variation in building volumes, and the approach finally reads from the hero view. Existing stones are less visually heavy. The result remains short of the supplied reference: several mountain faces and lower shoulders still have a rounded quality, snow could be more naturally integrated at smaller scale, and the hamlet's masonry and weathering are still simplified. The pathway is intentionally modest but some stretches remain fairly clean-edged. This is a reviewable improvement, not an artistic approval or a 1:1 match.

## Editable sources

- `refine_alpine_identity.py`: current in-place refinement and hero render.
- `alpine_face_drainage.py`: bounded connected face erosion.
- `countryside_architecture.py`: native editable architectural construction.
- `verify_alpine_identity.py`: fresh-file checks and same-camera detail renders.
- `alpine_identity_source.npz/json`: immutable pre-pass terrain and camera baseline.
- `alpine_identity_vegetation_masks.npz`: retained source masks, preventing cumulative removal on reruns.

Do not run older full-scene or earlier refinement generators over this state: they predate these changes. The source baseline prevents cumulative terrain displacement when rerunning the current helper. All work remains in the existing canonical blend; there is no numbered replacement scene.

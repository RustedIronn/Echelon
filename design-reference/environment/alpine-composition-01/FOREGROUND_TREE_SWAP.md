# Foreground-left tree replacement and habitat diagnosis

Current scene: `echelon_alpine_composition_01.blend`.
Current render: `foreground_spruce_preview.png`, also copied to `composition_preview.png`.

The user clarified Larch or Norway Spruce, whichever feels more like a standard tree. Norway Spruce was selected for its familiar compact evergreen silhouette. Only the foreground tree's shared mesh, species/name, yaw and uniform scale were changed. The ground reference and placement remain at the annotated foreground site. Its scale is calibrated to approximately 6 m above the source ground plane, comparable to the replaced alder rather than a full 16 m spruce placed beside the camera.

The previous alder geometry remains available in its hidden source prototype. Existing conifer groups, saplings, ferns, grass, flower placements, terrain, stream, hamlet, mountains, camera, lighting and materials were not changed. `verify_foreground_tree_swap.py` reopened the actual saved file and verified all **269 other objects**, including their transforms, geometry, material assignments and visibility, against the before-swap snapshot. The local habitat refiner's foreground choice was updated for future reproducibility, without rerunning that refiner.

## What the user's reference reveals

The reference uses fairly regular tree spacing, yet feels cohesive because the crowns overlap, light passes through the foliage, and the ground is an interwoven surface with locally different growth rather than an identical grass treatment running straight into every trunk. It represents a grove/orchard-like setting; its density should not simply be copied into the open alpine valley.

The next useful scope would be **one contained tree-ground habitat study** around the foreground spruce: credible root-flare burial, softly varied turf height/density, occasional exposed litter/soil without a circular mulch ring, restrained sheltered foliage and consistent canopy/ground lighting response. The same habitat mask should guide ground material and grass response so those layers belong together.

A single new texture cannot establish this structure. Bump/normal maps contribute shading detail; actual displacement or modeled geometry is needed for silhouette-changing relief. Reference: https://docs.blender.org/manual/en/latest/render/materials/components/displacement.html . Root flare, canopy silhouette, foliage cards and vegetation overlap are separate geometry/material concerns.

The selected mature conifers were auditioned primarily for midground use. Their branch cards remain a limitation at the new foreground distance. A dedicated foreground tree may eventually be justified, but adding many unrelated models is not a substitute for a coherent tree-to-ground transition. No additional asset search, habitat rework or lighting changes were performed in this replacement pass.

All source attributions remain in `ECOSYSTEM_ATTRIBUTION.md`; the Norway Spruce is Georgeous's CC BY 4.0 asset, https://sketchfab.com/models/7a5db417827244d98827459bce0cc944 . Replacement changes: translated display/source normalization inherited, uniform scale to the chosen standing size, rotation and substitution of the shared source geometry. No new textures or tree geometry were generated.

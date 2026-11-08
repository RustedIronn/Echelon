# CC0 mountain-foundation replacement

The existing canonical `echelon_alpine_composition_01.blend` now uses a new mountain foundation based on ambientCG's Terrain002, by Lennart Demes (CC0). See `../asset-auditions/mountain-foundation/ASSET_SOURCES.md` for provenance and actual neutral renders. No Blendkit mountain downloads were usable or integrated.

The important correction is the **source landform and its sampling**, not the mere choice of a height field versus a model. A well-authored height field is perfectly valid for this shot. The previous handmade field had weak broad forms, and stretching its background grid softened new source detail. The selected solution uses authored Gaea drainage/peak geometry at natural aspect ratios, with sufficient mesh detail to retain it.

## Construction

The retained near landscape ends at world Y 268 m. Its 242,106 vertices, original near faces and all fifteen retained floating-point point attributes are copied exactly. A denser far grid, 1537 × 1025, is stitched to its original boundary, producing one connected terrain mesh. The saved terrain has 1,817,531 vertices and 1,986,772 polygons. The far grid widens and recedes beyond the shot to keep mesh edges outside the hero view.

Several unequal source rotations provide the visible peaks. Broader connecting masses behind them form a continuous range, and lower source-derived landforms create the foothills. Local smooth unions connect the terrain without smoothing away the source's face structure. Rock, grass and snow masks use the new mesh's actual slopes and concavity; existing PBR textures remain editable. Rock bump is reduced to keep the geometry legible. Maximum distant haze is reduced from 0.0009 to 0.0005; world, sun and camera are unchanged.

The hamlet, existing approach paths, flowering meadow, tree arrangement and stream geometry are not redesigned in this pass. The water's vertex data is verified byte-identical. No application code, animation, additional time states or new `.blend` iterations are introduced.

## Visual review

Neutral source renders and three hero-camera compositions were inspected. The first was too dominant; the second had weak broad proportions and a large gap. The selected version preserves more natural peak proportions, smaller drainage features, overlapping shoulders and unequal peak heights. It is visibly sharper and more geologically coherent than the preceding hand-shaped range.

This does not claim a 1:1 reproduction of the supplied reference. Some source repetition and sharp lower faces may still be apparent. The meadow-to-distant-range transition remains a possible subject for later artistic review. This pass establishes a stronger foundation, not final artistic approval.

## Saved-file verification

`../asset-auditions/mountain-foundation/verify_saved_foundation.py` reopens the canonical blend in a fresh Blender process. It verifies exact near vertex and attribute preservation, finite coordinates, the original camera matrix/lens, water hash, 2,262 retained flower source points, and saved camera-view workspaces. All 4,104 checked terrain-seam edges have two incident faces. Its fresh saved-file hero is `mountain_foundation_preview.png`.

The preview is 1920 × 1080; `mountain_foundation_detail.png` is a higher-resolution same-camera crop. The construction run and fresh-file verification both completed Cycles renders. No WebGL performance claims or app test results are inferred from these authoring renders.

## Reproduction and editing

Use `../asset-auditions/mountain-foundation/compose_high_resolution_range.py`, with `-- --commit` only when intending to overwrite the canonical blend. It reconstructs from immutable near-mesh/source caches. Peak transforms, foothill controls and masks are editable there; the saved terrain itself remains a native sculptable mesh. The original EXR is retained. A standalone new Blender file is not required.

Do not run older whole-landscape, erosion or identity helpers over this file: they assume the previous terrain topology and source baseline.

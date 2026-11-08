# Countryside hamlet, geological faces and shoreline refinement

This pass updates `echelon_alpine_composition_01.blend` in place. The hero camera, lighting direction, mountain skyline, broad stream layout and flowering foreground remain the compositional foundation. No application code, new asset downloads, animation or additional landscape versions are involved.

## Architecture

The user's direction is grounded British/European countryside architecture, not literal rocks emerging around buildings. Five native editable buildings replace the visible toy-like placeholders: four longer cottages and a small stone rural chapel. Slate courses, modest eaves, masonry chimneys with clay pots, recessed sash openings, side windows, low thresholds and restrained stone/limewash palettes give them vernacular character. The chapel has round-headed windows and a low stone bell tower rather than an exaggerated red spire. These are original simplified designs inspired by countryside construction, not exact historical reconstructions.

The building front doors retain the preceding settlement's entrance locations and orientations. Building footprints and proportions are intentionally changed, so their centres differ. Each floor is seated against the actual terrain at its doorway; walls extend below the local surface rather than sitting on a visible platform. The original building parts remain hidden, while the new parts are organized under `11 Countryside hamlet - vernacular buildings`, with one child collection per building. Individual construction parts and materials remain editable.

Reference principles: stone/rubble walls, slate roofs, restrained openings, roof stacks and stone dressings are documented in [Historic England's Sawrey Ground entry](https://historicengland.org.uk/listing/the-list/list-entry/1405497) and [1–5 Eldwick Beck](https://historicengland.org.uk/listing/the-list/list-entry/1391672). The [Lake District design guidance](https://lakedistrict.gov.uk/planning/planning-policy/design-code/conversions/identity/) also informs material restraint and local character. No models or textures were downloaded from these references.

## Ground and paths

A packed editable wear mask connects the existing entrance positions and an irregular approach track. The same field controls local soil/gravel appearance, slight compaction, shorter/thinner grass and flower exclusions. There is no floating road strip. Close renders showed that grass coverage and terrain occlusion both weakened the original track. A temporary, unsaved emission-mask diagnostic demonstrated that most of its old route lay behind the convex settlement slope. The approach was therefore re-authored on the camera-visible hillside and its grass centre cleared more strongly, retaining soft edges. The track is still restrained in the wide image; it does not yet have the prominence of the reference road.

## Mountains

Unequal elongated joint domains add local cuts to selected rock faces, with quieter areas between them. Their amplitude stays below about two metres in this scene. Existing drainage, incision, exposure and slope guide the detail and snow breakup. A camera-ray horizon exclusion protects the approved range silhouette. This is authored procedural face structure, not a claim of simulated geological erosion. Mountains retain the existing triplanar rock material and connected foothills.

## Banks and rocks

A shared small lateral deformation moves the water and land together, with a maximum water displacement of approximately 0.233 m. Water elevations and longitudinal positions remain identical. Local turf variations and overhanging grass tips soften selected shoreline edges; vegetation roots follow the actual deformed triangulated ground. Two distracting isolated stones are hidden. Existing anchors and ten small stones form a few unequal groups using the four existing reusable stone meshes. Existing sediment instances are retained and regrounded; no continuous rock border is added.

## Validation and remaining weaknesses

The scene is reopened in a fresh Blender process by `verify_country_geology.py`. Its JSON report records the fixed camera, ray-tested unchanged terrain horizon, water displacement limits, retained grass/flower point counts, root grounding, hidden original buildings and preserved tree visibility. Crops are rendered from the same hero camera at a higher sampling resolution without saving crop settings to the blend.

Actual Cycles images: `country_geology_preview.png`, `country_hamlet_detail.png`, `country_mountain_detail.png`, and `country_bank_detail.png`. The revised hero and crops must be judged visually; numerical checks do not constitute artistic approval.

The cottages are more credible but remain simplified village-distance models. Stone-course variation and building-to-building ageing could improve further. Mountain faces still have broad smooth areas, particularly at the foothill transition, and are less fractured than the supplied reference. Some bank sections remain smooth and steep; this is an improvement pass, not a claim that the reference's full naturalism has been reached. The distant tributary remains visually restrained. The existing shallow-water shadow approximation is retained and is not a fully physical caustics solution.

Reproduction: use `refine_geology_settlement.py` with `countryside_architecture.py`, then `verify_country_geology.py`. `country_geology_source.npz/json` and `country_original_pebble_points.npy` are the pre-pass baseline used to prevent cumulative deformation on reruns. Earlier scene-generation helpers predate this state and should not be run over it.

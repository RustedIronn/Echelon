# Environmental cohesion pass

The existing `echelon_alpine_composition_01.blend` is updated in place. No additional .blend scene or numbered version was created.

Current hero: `cohesion_preview.png` (1920 x 1080, Cycles).
Same-camera detail renders: `cohesion_tributary_detail.png`, `cohesion_hamlet_detail.png`.

## Stream / terrain relationship

The pass measures the actual saved tributary waterline in cross-sections instead of assuming that the old mathematical centerline still describes the refined banks. Local, unequal lateral adjustments then move both the carved land and the existing closed water volume together. The main stream is preserved.

Two low gravel benches and one quieter upper shelf are shaped into the actual terrain at selected bends. They grade from dry bank through shallow deposits into the channel. Small erosion pockets occupy opposing banks. Their existing gravel/damp-soil masks and grass clearance follow the same fields. No detached oval stones/soil meshes or continuous bare border were added.

The first render exposed an important screen-space problem: approximately 6 cm of exposed gravel was barely visible from the low hero camera, while grass still obscured the bank surface. The final benches have a slightly higher dry shoulder, grading down into the water; the relevant existing grass is shortened/thinned with the same shelf field. The tributary bends also have unequal local offsets instead of a small regular wobble. This changes the tributary locally without replacing its overall course or touching the main stream.

## Middle meadow

Two authored shallow drainage folds from the preceding terrain pass provide the shared habitat logic. More mesic growth has slightly fuller, taller, darker/fresher grass and stronger existing floral presence; quieter shoulders have lower, warmer grass. Existing grass material indices, leaf spread/height and ground vigor respond together. No new grass population or vegetation objects were created.

135 existing distant flower points were reallocated to mixed, camera-visible near-middle meadow positions: 70 Marguerites, 30 Dandelions, 5 Red Clover and 30 Carthusian Pink. All original source models and total species point counts remain. Candidates are grounded, outside water and footpaths, and selected from the shared meadow fields rather than circles or species-exclusive patches. The immediate foreground is unchanged.

## Hamlet context

Four restrained footpath routes link the existing chapel/cottage entrances. Width and edge wear vary, with shorter/thinner existing grass along the same routes and approximately 18 mm of local ground compaction at maximum wear. No road-strip mesh, fences, garden decoration or new buildings were introduced.

The first attribute-only path mask was under-resolved by the distant terrain mesh. The final wear field is baked to an editable 1024 x 1024 non-color mask, `hamlet_ground_wear_mask.png`, packed inside the .blend. This mask controls the existing earth/gravel material blend. It bakes only placement/wear, not lighting. Vegetation response still uses the same underlying field, preventing the path from being only a colored stripe through full-height grass.

## Preservation and actual verification

`verify_valley_cohesion.py` reopened the exact saved scene in a fresh Blender process and checked:

- All 331 scene objects retained; no additional vegetation or prop objects.
- All object poses and visibility flags identical to the start of this pass, including the hidden background trees.
- Hero camera matrix/lens and lighting unchanged.
- Mountain/upper geography vertices at Y > 250 byte-identical.
- 31,606 main-stream vertices byte-identical.
- Water Y/Z coordinates unchanged and the volume remains closed (two face users per edge).
- Ten tributary centerline samples retain recessed water above the bed.
- All four flower source point counts retained; foreground positions, scales and rotations unchanged for Y < 35.
- All 135 reallocated points fall within the intended hero-camera meadow region.
- Sampled flower grounding checked against the saved evaluated ground.
- Ground-wear mask packed in the saved .blend.

See `cohesion_verification.json` for measured values and `cohesion_report.json` for the authored fields and population changes.

The final hero and both detail renders were visually inspected. No image-generation, paint-over, external asset downloads, time systems or application edits were used.

## Editing and reproduction

- `refine_valley_cohesion.py`: opens and updates the canonical scene, saves and renders the hero.
- `cohesion_fields.py`: shared shoreline, meadow-community and footpath definitions.
- `cohesion_source.npz` / `.json`: source geometry/attribute and placement data for repeatable local refinement, not another scene.
- `verify_valley_cohesion.py`: fresh saved-file validation and same-camera detail renders.
- `hamlet_ground_wear_mask.png`: editable authored mask, also packed.

Do not run the earlier whole-scene or landform helpers over this result; their source baselines predate the cohesion pass. No additional third-party assets were introduced, so existing source attribution remains unchanged.

## Candid artistic assessment

The hamlet now has readable connections to the ground, and the middle meadow has more deliberate growth/flower relationships while retaining openness. The tributary's banks and bed have genuinely different local forms, with vegetation reacting to erosion, deposition and wet ground.

The effect remains restrained at the full hero scale. The upper tributary still looks relatively clean in the enlarged crop, and the broad distant slopes are quieter than the foreground. This is not a claim of final artistic approval. Stop for review before any further vegetation, tree work, atmosphere, fish or animation.

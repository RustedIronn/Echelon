# Terrain coherence, village shelf and bank grounding

The existing `echelon_alpine_composition_01.blend` is updated in place. This pass changes the relationship between landforms, the settlement and bank stones. It adds no asset packs or new Blender scene versions.

## Diagnosed causes

The old mountain approach had an actual drop behind the terrain join: at X -150 m, for example, the surface fell from about 17.0 m at Y 268 to 9.6 m at Y 300, then climbed through three shallow Gaea terrain copies. Several other profiles had the same 7–10 m drop/rise. Those compressed terrain copies produced the unwanted wavy intermediate forms.

The village was also genuinely depressed. At Y 125 m, terrain near X 30 m was about 2.73 m high, while its shoulders near X 10 and X 60 were about 6.89 and 7.57 m. Correcting only building origins would not remove that bowl.

The bank stones intersected the ground, but many exposed 50–60% of their sampled vertices. Their material and the metre-spaced ground attributes did little to connect their small footprints to soil, gravel and turf.

## Landform changes

The three shallow, distorted intermediate terrain masses are removed from the transition calculation. The genuine main range is retained. Its toe positions guide a broad, calm piedmont field, beginning from surveyed meadow elevations and rising gently toward the actual range. This is not the earlier family of rolling mound shapes. The source scene remains one connected mesh.

431,443 upper/main-range vertices, selected where native mountain relief exceeds 17 m, are byte-identical to the pre-pass geometry. The mountain silhouettes and PBR material are retained. X/Y coordinates, terrain below Y 75 m, the water mesh, and 23,212 channel vertices are also verified unchanged.

The sampled profiles are substantially calmer. At X -150 m the former 17.0 → 9.6 → 23.7 m sequence now reads approximately 10.2 m at Y 268, 11.1 m at Y 300, 14.7 m at Y 400 and 17.1 m at Y 450. Minor broad meadow undulations remain; no claim of perfectly monotonic terrain everywhere is made.

## Settlement

A broad, lightly graded shelf replaces the local depression. Its principal grade is 3.5% across X and 6% along Y, with water-stage freeboard at the river-side edge and broad outer blending. It is not five independent pads or a new isolated mound.

The five buildings are seated on that surface, with modest unequal position and orientation changes. They now have individual placement Empties named `Grounded hamlet placement 1` through `5`. The rear cottage's roof pitch is increased modestly to break the coincident roof silhouette while preserving human-scale doors/windows. Wall finishes are related warm roughcast, muted grey-green and local stone; slate colours vary gently between buildings. The initial excessive per-slate checker effect was reduced. Porch feet extend below turf.

One shared lane replaces the branching road network. A small chapel forecourt and doorstep aprons provide local wear without long spurs to every house. The lane follows the visible approach, passes clear of the building footprints, and ends at the rear of the group. Its vegetation exclusion and packed material mask use the same field. The final material is a restrained earth/gravel/buff mixture; earlier grey and overly dark tests were corrected after inspection.

## Bank stones and habitat contact

Existing stone counts and loose group locations are retained. Large caps are reshaped subtly, tilted and seated using sampled terrain contact across their vertices, not only their object origins. About one-third of anchor vertices and 38% of smaller-stone vertices now lie above the sampled surface; those are vertex statistics, not a physical volume estimate. The largest exposed caps sit about 0.13–0.19 m above nearby soil.

Existing pebbles are reseated into the bed. The already-packed cliff scan provides a related weathered mineral response, darkened after the first bright-cap render. A 2048² packed contact mask resolves the small gravel/earth/turf interface more accurately than the coarse near-terrain vertices alone. It uses the same irregular stone-contact field as the vegetation clearings. There are no new dirt-oval meshes, stone borders or uniformly added rock populations.

## Vegetation and validation

The retained grass and flower sources follow the actual new triangulated surface. Species, scales, rotations and X/Y placements are preserved; only necessary height and local traffic/building/stone exclusions change. Old lane exclusions are released locally around the hamlet. No flowers or vegetation types are added.

`verify_terrain_grounding.py` reopens the exact saved file in a fresh Blender process. It checks the fixed camera, water hash, protected mountains/channel/foreground, the shelf equation, lane clearance, building seats, actual stone burial and retained botanical counts. It compares old/new plant embedding through independent BVHs. An initial 0.76 mm error at the shelf-mask fringe was diagnosed as a selection cutoff, corrected in both the source and saved plants, and rechecked. Final sampled embedding difference is about 0.061 mm, and building seating error is below 0.001 mm.

Actual native Cycles images: `grounding_pass_preview.png` (2560 × 1440), `grounding_hamlet_detail.png`, and `grounding_bank_detail.png`. The hero and both crops were inspected, and the road tone, roof variation and bright stone caps were refined for visual reasons. The final sub-millimetre plant-fringe correction does not alter the visible composition.

## Remaining artistic limitations

The village architecture remains simplified at close inspection, and some bank reaches are still smooth. The calmer middle distance deliberately has less landform drama and may still need a later vegetation/material balance review. These checks establish sound seating and terrain relationships; they do not constitute artistic approval.

## Editable sources

- `terrain_grounding_fields.py`: shared piedmont/source sampling, shelf, lane, building and stone-contact fields.
- `refine_terrain_grounding.py`: in-place reconstruction, material treatment, plant seating and renders; add `-- --commit` to save after rendering.
- `verify_terrain_grounding.py`: fresh-file checks.
- `grounding_pass_source.npz/json`: immutable pre-pass coordinates, attributes, object poses and material references, preventing cumulative deformation.
- `grounding_pass_report.json` and `grounding_pass_verification.json`: actual changes and measured checks.

Earlier source helpers assume earlier terrain and settlement states; do not run them blindly over the current file. All new masks are packed. The original mountain/vegetation asset attribution remains applicable, with no new downloads during this pass.

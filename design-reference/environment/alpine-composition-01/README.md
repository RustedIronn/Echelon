Current saved state: coherent piedmont, graded hamlet shelf, one shared lane and embedded bank stones. See TERRAIN_GROUNDING_REFINEMENT.md, grounding_pass_preview.png, grounding_hamlet_detail.png, grounding_bank_detail.png and grounding_pass_verification.json. Use refine_terrain_grounding.py with terrain_grounding_fields.py. Canonical blend updated in place; earlier helpers predate this state.

Current saved state: high-resolution mountain cliff PBR and render-clarity pass. See MOUNTAIN_PBR_REFINEMENT.md, mountain_pbr_preview.png, mountain_pbr_detail.png and mountain_pbr_verification.json. Terrain foundation remains the selected connected CC0 Gaea range. Use refine_mountain_pbr.py for this material layer after any terrain rebuild. Canonical blend updated in place.

Current saved state: new connected high-resolution mountain foundation from ambientCG Terrain002 (CC0). See MOUNTAIN_FOUNDATION_REPLACEMENT.md, mountain_foundation_preview.png and mountain_foundation_detail.png. Author with ../asset-auditions/mountain-foundation/compose_high_resolution_range.py. Canonical blend updated in place; older helpers assume obsolete terrain topology and must not be run over it.

Current saved state: reference-led alpine face structure, individual countryside cottages, readable approach/side paths and paler existing stones. See ALPINE_IDENTITY_REFINEMENT.md, alpine_identity_preview.png and alpine_identity_verification.json. Use refine_alpine_identity.py, alpine_face_drainage.py and countryside_architecture.py. Canonical blend updated in place; older generators predate this state.

Current saved state: countryside hamlet, mountain face structure and irregular bank/stone refinement. See COUNTRYSIDE_GEOLOGY_REFINEMENT.md, country_geology_preview.png and country_geology_verification.json. Use refine_geology_settlement.py with countryside_architecture.py; earlier generators predate this state. Canonical blend updated in place.

Current saved state: stronger hero-scale habitat and daylight pass. See HABITAT_STRUCTURE_LOOKDEV.md, habitat_structure_preview.png and habitat_structure_verification.json. Canonical blend updated in place; use refine_habitat_structure.py with habitat_structure_fields.py. Earlier helpers predate this pass.

Current saved state: environmental cohesion pass. See ENVIRONMENT_COHESION.md, cohesion_preview.png and cohesion_verification.json. Use refine_valley_cohesion.py with cohesion_fields.py; older landform helpers predate this pass. Canonical blend updated in place.

Current saved state: valley landform, middle meadow and hamlet refinement. See VALLEY_LANDFORM_REFINEMENT.md, valley_landform_preview.png, and verify_valley_landforms.py. The canonical blend is updated in place. Use refine_valley_landforms.py for this pass; earlier whole-scene/tree helpers predate these changes.

# Echelon alpine meadow — layered surface refinement

## Local stream and settlement cleanup

The leftgoing main reach narrows by up to 10%, fading in over Y 17–32 m. Bed and banks share this factor. The foreground entry, tributary centerline, hero camera, range and lighting direction are retained. The hamlet's authored building positions are compressed around a common settlement centre (0.78 in X and 0.76 in Y), with that layout centre moved from Y 143 to 124 m. Architecture changes from scale 0.86 to 0.81, about 6% smaller than the previous render; each building is reseated on its new terrain footprint.

The saved-scene diagnosis found continuous tributary water with approximately 0.45 m bed clearance. Camera rays reached its surface through Y 135 m; the farther section was naturally occluded by terrain. Geometric reflection rays hit grassy slopes and opposite bank shoulders—for example, the water at Y 85 reflected terrain near Y 93. This explains why green reflections and exposed shoulders weakened the water read; the bed was not simply missing its water mesh.

The correction feathers the visible tributary's floodplain freeboard from 0.48 toward 0.26 m and reduces its bank-transition width by up to 25%, returning to the original treatment before the hidden upper reach. The bed and water grade remain unchanged. Water roughness gently increases from 0.065 near the viewer to 0.22 in the distance to broaden the reflected environment instead of retaining a narrow dark grassy reflection. There is no opaque blue overlay or emissive water. The confluence and natural hidden endpoint are preserved.

The first cleanup render still showed overly dark distant reflections, so the upper roughness limit was refined from 0.12 to 0.22 and the hero was rendered again. In the inspected final image, the upper bends now catch a recognizable blue-grey water reflection, while the slimmer left crossing and compact hamlet remain secondary to the streamside meadow. The exact saved file was reopened and all checks passed: fixed camera, continuous water above its bed, visible near crossing, hidden endpoints and grounded buildings. Building scale is checked using footprint dimensions and eave height above the terrain seat; total wall bounds also include variable foundation burial and are not a valid uniform-scale test. Camera, range and lighting direction remain unchanged. This is the end of the cleanup pass, awaiting human review.

## Streamside visual hierarchy

The latest layout brings the near stream's turn and junction forward within the same fixed camera. The main control polygon now turns through (X -1, Y 16) and meets the tributary at (X -14, Y 25), rather than waiting until (X -23, Y 44). Its outgoing reach leaves the left frame sooner. The tributary is independently curved back through the middle valley, joining the unchanged distant approach at Y 201–225 m. This is a nonuniform shortening of the near watercourse and its associated floodplain, not a uniform world scale or camera move. Terrain carving, bank masks, vegetation exclusion and the connected water volume all use the revised paths.

The near-left crest remains, descending into the closer channel. The compact bank easing follows the new crossing through Y 8–82 m. Meadow and hamlet farther away remain in place. The existing 54 m mountain setback and continuous foothill climb are retained; the mountains recede through atmospheric contrast instead of another arbitrary translation. The same bounded volume now has world-Y density grading from 0.00005 near the meadow to 0.0018 in the distant range, with a height falloff so upper sky is not equally veiled. Lighting direction and camera are unchanged. No flowers or new decorative assets are introduced.

Current verification samples and measurements refer to this revised near crossing. Older sections below describe earlier layouts and their specific preservation checks.

The new 1440 x 810 hero render was inspected: the nearer sweeping bank and broader apparent bends give the water a more substantial role alongside the foreground grass. The tributary provides the receding route through the valley, while the range has softer contrast without losing its connected profile. It remains a fairly restrained atmosphere; no claim of final art approval is made. Fresh-process reopening passed camera persistence, matching confluence levels, submerged bed clearance, hidden endpoints, grounded buildings and packed material checks. At the sampled near crossings, 80–100% of bed-width sightlines reach water. No flowers or further detailing followed this review.

## Restrained composition refinement

The next review keeps the same hero camera and stream centerlines. The mountain setback increases from 40 to 54 m, a 14 m move along the valley, while retaining the same range and erosion definitions. Hamlet architecture is generated at 0.86 of its previous size about each building's existing position and reseated against the smaller footprint; roof thickness, seams and entrance steps follow that scale. No buildings are moved to a different part of the hillside.

The main stream bed narrows by up to 10% at the foreground entry, with bank widths narrowing by up to 6%. Both taper smoothly to their previous dimensions by Y 30 m, leaving the left crossing and tributary unchanged. An 18 cm maximum authored easing is feathered over the camera-side meadow shoulder along Y 20–105 m; its effect is further moderated by the existing floodplain grading. The rest of the meadow shape remains. There are no flowers, new props, lighting changes or camera adjustments.

The fresh-file verifier checks the actual peak setback and limited height change, the smaller buildings' dimensions and terrain contact, the fixed camera, water continuity, visibility and packed materials. The earlier exact mountain-coordinate preservation assertion applies to the preceding valley revision, not this explicitly requested setback.

The updated hero render was inspected. The range is slightly smaller behind the valley, the settlement is less dominant, and the foreground entry is modestly slimmer. The leftward water crossing remains exposed across the frame; the bank easing is intentionally subtle rather than a newly flattened terrace. Fresh-file checks pass: the highest peak moved 14 m along +Y with only 0.14 m height difference, all five reduced buildings remain grounded, and 60–100% of sampled bed-width rays reach water along the checked left crossing. The camera and saved camera-view workspace persist. The distant tributary remains subdued, and the meadow's existing material/vegetation simplification is unchanged. No artistic approval is implied by those measurements.

## Current valley revision: left-crossing stream and descending foreground

The current saved hero view replaces the previous single upstream course with a branched water network. The main channel enters the lower-right foreground, turns across the left meadow and continues outside the left camera boundary. A smaller tributary joins at X -23, Y 44 m and winds back toward the foothills; its upper end is screened by terrain. `stream_network.py` defines both centerlines, graded water levels, asymmetric banks and floodplain transitions for the same continuous terrain. The water is one closed connected mesh, including the junction, rather than two overlapping ribbons.

The previous raised left-midground platform has been removed. A broad authored near-left crest descends toward the crossing stream and fades into the middle distance. Its grade is chosen with the existing fixed camera so foreground growth does not conceal the crossing. Existing vegetation is regrounded and excluded from both channels. Mountain geometry and erosion, the afternoon lighting and the hamlet's right-hillside role are retained. There are no flowers or new decorative systems in this revision.

`valley_revision_preservation.json` is the pre-edit comparison snapshot for this change. The fresh-file verifier now measures the actual two-stream meshes, centerline bed clearance, water continuity, endpoint visibility, the unchanged camera, protected mountain coordinates, hamlet foundations and packed material maps. Earlier single-stream verification notes below describe the previous layout; consult the current `composition_measurements.json` for current results. Source controls remain editable in `stream_network.py`; changing a hidden design guide alone does not regenerate the terrain.

Final hero review: the main water now visibly crosses the field and reaches the left frame edge, with the tributary extending back through the center-left valley. Two earlier renders exposed foreground occlusion; the final correction replaced the near-left plateau with a deliberately descending surface instead of moving the camera or removing grass. At X -24 m, saved ground heights decrease from 3.11 m at Y 0 to 2.82 m at Y 12, 2.38 m at Y 24 and 2.18 m at Y 36 before reaching the channel. Fresh-file verification passes, including unchanged mountain-coordinate hash and camera, grounded buildings, packed maps and hidden stream endpoints. The tributary remains visually subdued at distance, and its confluence/bank treatment could benefit from a later artistic-detail pass; this revision stops at the requested landform and watercourse arrangement.

Updated in place on 5 November 2026, including scanned terrain materials, hillside continuity, authored alpine landforms and the hillside hamlet. The existing scene, generation script, measurements and hero preview remain the deliverables. No numbered scene or separate iteration was created. Material source libraries and provenance records live in `material-resources`; mountain preview-only references live in `reference-previews`. The red-cottage environment and application files remain untouched.

## Open and reproduce

Open `echelon_alpine_composition_01.blend`. The saved hero camera and camera-view workspace persist. `composition_preview.png` is the 1440 x 810, 96-sample Cycles hero preview.

Run `build_composition.py` with Blender 5.2 to regenerate this same study, then `verify_saved_composition.py` in a separate Blender process. The generator disables incremental save copies for its process; the pre-existing .blend1 is left unchanged. The sampling uses explicit seeds. Layer counts and ecological sample values are recorded in `composition_measurements.json`.

Three free Blendkit material sources were downloaded at 2K: Grass 05, Grass Ground Meadow PBR Scan, and Gravel Rocks Rough PBR Scan B. Aerial Rocks 04 was recovered from the retained local In The Nature scene. Exact sources, creators, licenses and adaptations are documented in `material-resources/ASSET_SOURCES.md`. No dependency or add-on was installed. The main scene embeds the used image maps, and the generator reads the local material-only source libraries.

## What changed in this pass

The previous upright-blade parcel was replaced structurally, rather than only increased in density. The new meadow has four named meshes:

- **Foreground arching grass:** folded, curved leaves spread and overlap close to the ground. Length, height, width, orientation and subtle leaf lighting vary. Upright accents are sparse.
- **Low basal meadow foliage:** small lance-shaped leaves form a subordinate lower layer among the grass. These are plant-scale basal leaves, not flattened shrub objects.
- **Midground meadow continuation:** simpler related leaf forms carry growth from the near field toward the opposite hillside and hamlet. Coverage decreases gradually with distance rather than ending at the former foreground parcel.
- **Meadow to foothill transition:** a separate editable mesh extends related short growth over the previously unpopulated hillside. Coverage overlaps the midground between Y 118 and 155 m, varies with the shared growth field, and recedes gradually with elevation, slope and distance. Roots follow the actual saved terrain mesh.

The annotated hillside was diagnosed using rays from the hero camera. Representative rays through the bare-looking region landed at Y 158-265 m, including X -140/Y 238 and X -70/Y 178. The old plant parcel ended at Y 155 m and X -100, leaving these visible slopes outside its coverage. The correction extends the sampling footprint to X -185..100, Y 118..277 with soft habitat limits, rather than raising the density everywhere. A fine related canopy response in the terrain shader reduces the brighter bare-ground appearance between distant plants.

The first extension still left a pale strip: camera rays revealed locally steep faces with normal Z around 0.28-0.42, which the initial slope exclusion rejected. The transition layer now follows the local terrain plane, avoiding buried leaves. On the finishing pass, the dry upper banks themselves are reshaped into broader upstream-graded meadow shoulders. This addresses the geological cause of the bright cliff-like band, rather than relying on vegetation to hide it.

The final refinement also corrects XY sampling for actual terrain surface area, using inverse-normal-Z weighting with a bounded maximum. Flat-ground density is retained while steep faces receive proportionate coverage. Hillside leaves have a wider footprint and lower rise, forming short overlapping turf rather than tall distant bristles. Shared vigor masks continue to create fuller and quieter areas; this is not uniform density applied to the entire meadow.

The dry-bank grading is restricted to Y 138-217 m and fades eastward over X 0-25 m. Broad 46-54 m shoulder transitions rise toward the foothills. The material pass diagnosed a residual approximately 74-degree lower face in the formerly protected one-metre dry margin; the grading now starts continuously at the existing wet edge instead. Water cross-sections retain the original channel definition, while terrain and vegetation use the refined dry-land function. The camera, watercourse, mountains, hamlet and lighting remain fixed.

Measured hero-camera samples on the corrected shoulder, including the newly checked lower face, are approximately 12-28 degrees, compared with the former approximately 74-degree lower face. A distant-meadow-only canopy normal layer represents grass-scale surface relief between geometric plants; it fades in with distance and excludes exposed rock. It changes surface shading, not light direction or a baked lighting texture.

Material construction: world-scale box-projected turf and meadow-earth maps share the existing vigor masks. Scanned gravel is blended into the bed and damp-bank transitions. Scanned alpine rock uses a 70 m mapping period, reduced saturation, actual roughness and height-derived relief. Snow is broken by terrain features and the scanned rock relief rather than only a flat height threshold. Albedo uses sRGB; all scalar maps use Non-Color, including corrected source height/smoothness tags. Smoothness is inverted. Tangent normal maps are retained in the source assets but not incorrectly box-projected; triplanar height shading provides surface relief instead.

A shared growth field coordinates coverage, height and color across vegetation and ground. It combines broad and local variation with a restrained stream-adjacent moisture influence. Fuller and quieter regions remain intermingled; there are no species-specific circular colonies. Roots are excluded from water and building footprints, while some leaves can overhang the bank naturally.

The final shoreline correction lowers the midground canopy gradually near the water, rather than clearing a bare strip. This preserves planted banks while improving the upstream sightline.

Greens were lifted after the first render looked heavy. Terrain now uses a matching vigor attribute, so quiet areas and foliage share the same color language. Thin-leaf transmission and softly folded blade sections help avoid the old bristly appearance. No flowers or trees were added.

Mountains received five branching medium-scale erosion cuts and three short angular rock ribs, approximately 2-4.5 m in relief. These operate on the existing landforms and fade out toward their ends. The crest composition is preserved. A restrained fractured-rock color response supplements the actual geometry; uniformly noisy displacement was not used.

## What stayed fixed

The camera, stream path, water treatment, main terrain composition, hamlet layout, sky and light direction remain. Camera position is approximately (-3, -10, 4.364), looking toward (-4, 100, 8), with a 28 mm lens and 16:9 framing.

The raised left meadow, foreground-right water entry, main leftward bend, second upstream reach and concealed endpoint are preserved. Water retains its closed refractive volume, IOR 1.333, static normal variation and light absorption. Gravel and dampness are blended into the banks. Daylight remains the same multiple-scattering sky and sun with very thin bounded haze.

The five hamlet placeholders have been replaced with an authored chapel and four cottages. No architecture models were downloaded. The settlement occupies the same far-right hillside, with a looser arrangement on the unchanged terrain. Buildings have independently editable plaster/timber bodies, stone footings, pitched roofs, gables, window recesses, doors and restrained porches. The chapel has a small copper-roofed tower and spire inspired by the supplied photograph's architectural character. No trees, flowers, weather, seasons or animation were added.

## Mountain and hamlet refinement

Four Blendkit listing previews were examined: Snowy Mountain, Rocky Mountain Terrain Landscape 3, Canadian Rockies Mountain Peak and Mountain (green Alps). See `reference-previews/sources.json`. Only public preview images and catalog metadata were fetched. No mountain geometry, textures or model files were downloaded or imported, and no image is used as a background.

The preview study informed general forms: interrupted crest lines, branching arêtes, steep headwalls, broader lower shoulders and snow gathered between exposed ribs. The existing watershed stations were reshaped locally. Five authored branching arêtes, six erosion routes and three shallow upper bowls supplement the existing ridge network. Their relief was reduced after the first render looked too abrupt. Upper terrain edges above Y 238 m receive one conforming subdivision step and are evaluated back onto the authored landform, reducing crest sampling artifacts. This stays in the same continuous terrain mesh. Terrain below Y 210 m remains unchanged.

Snow responds to elevation, slope, directional sun exposure, erosion channels and sheltered bowls, supplemented by the existing scanned rock relief. It is not a uniformly horizontal cap. The camera, lighting direction and stream geometry are unchanged.

### Erosion identity correction

The subsequent reference clarified that drainage erosion, not additional crest ridges, was the missing character. `mountain_erosion.py` now evaluates a bounded 0.8 m heightfield over X -220..220 m and Y 232..420 m. Thirty-six deterministic steps route runoff downhill, accumulate contributing area, incise a branching hierarchy of channels and transfer a small amount of unstable slope material. A discharge threshold preserves land between channels. Incision is capped and fades out before the protected meadow. The very small routing seed perturbation is removed from the resulting height change, so it is not noise displacement used as final detail.

The current hierarchy-refined run has approximately 6.81 m maximum incision, 0.18 m median and 1.79 m 95th-percentile incision within the active mountain domain. Erosion bounds are mountain-local; the current 40 m setback is added to obtain world Y. These are generated displacement statistics, not a claim of geological calibration. The simplified model follows stream-power concepts documented at https://landlab.readthedocs.io/en/latest/generated/api/landlab.components.stream_power.stream_power.html ; Landlab itself was not installed or run. Only Blender's existing NumPy is used.

The resulting shape is actual terrain geometry. Editable point attributes record mountain incision, drainage concentration and transported debris. They inform exposed rock, subtle debris material and snow shelter. Steep walls shed snow while suitable higher gullies retain it. The main masses, hamlet, stream and protected meadow/camera composition remain. No mountain model or new asset was downloaded for this correction.

The hero render and updated mountain crop show the erosion most clearly across the left and central faces: broad slopes are dissected by larger channels with secondary cuts converging into them. This is a substantial change in surface structure rather than merely another sharp skyline. Some channels still have a more regular rhythm than the supplied natural reference, and the geological strata remain simplified. Fresh-file camera, protected geometry, texture integrity and building-contact checks passed after this correction.

### Hierarchy and natural climb refinement

The next pass retains connected runoff erosion but raises the initiation threshold for small channels. Contributing area distinguishes deeper primary gullies from shallower feeders. Broad, unequal resistant-bedrock domains suppress the comb-like parallel cuts on selected central and outer faces; the largest drainage routes can still cross those domains. No extra erosion iterations or new ridge families are added. The same 36-step model is used with more selective erosion.

Following the clarification that the transition should come from distance rather than a raised ramp, the added terrain aprons were removed. The original low foothills stay in place and the mountain masses are translated 40 m farther along the valley's +Y axis. Geological and erosion definitions remain in mountain-local coordinates and move with the range. Small original terrain toes below Y 210 m remain fixed to protect the meadow and hamlet. The background terrain extends to Y 500 m to avoid cutting off the moved range, retaining the original half-metre row spacing and unchanged foreground coordinates. No camera pullback or uniform world scaling is used.

The range retains dominant cuts alongside wider quieter faces. Exposed rock is kept on alpine faces while lower benches remain grassy. Some smaller side channels still show regularity in close views, and the landforms remain stylized. Fresh-file preservation, camera, material and building-contact checks are used for each saved revision, in addition to inspection of the actual hero render.

The setback hero render shows the range smaller and farther behind the existing low foothills, with more visual separation from the meadow. The raised apron/ramp is absent. The saved file was reopened and rendered successfully; protected foreground/midground geometry, full lowland coordinate hash, water, camera and building-contact checks passed. Both supporting crops were refreshed to match.

### Continuous climb from the supplied side-profile sketch

The sketch clarified the underlying shape: low rolling meadow, a sustained foothill rise and progressively steeper mountain faces. The range retains its setback, while its mountain-front reach is lengthened to 190 m for the watershed, 126 m for the left shoulder and 140 m for the right massif. The same convex profile exponent of 1.65 makes grade increase gradually. These are the lower parts of the existing mountain masses, not a separately added raised apron. The old tiny terrain toes under Y 210 m remain fixed, preserving the protected meadow and hamlet.

`render_climb_profile.py` samples three actual longitudinal sections from the saved terrain mesh and creates `climb_profile_preview.png`, with raw measurements in `climb_profile_measurements.json`. The curves show the foothill climb and its local erosion dips. This is a measured side-profile diagram, separate from the actual hero-camera render; no diagram scene is saved. Both views were inspected. Existing erosion hierarchy, stream and hero camera remain.

Architecture is generated by `hamlet_geometry.py`, called by the existing generator. It uses the original hillside surface directly and does not cut new building terraces into the meadow. The first close render exposed overly high stone plinths, so floors now use the average footprint elevation, foundations are lower, and entrance steps follow the actual ground. Local building coordinates and ground seats are recorded in the measurements. `render_review_details.py` renders high-resolution crops from the same hero camera without saving different camera or render settings into the scene.

## Critical render review

The strongest improvement is continuity: the foreground has an overlapping canopy, and the midground now carries visible growth instead of flattening into smooth green terrain. The plant layer has more height and leaf structure, while quieter areas remain part of the same habitat. The opposite meadow and stream banks feel better connected. Medium mountain ribs and cuts add some light-catching geological structure without changing the main range.

The material pass gives the meadow a more grounded surface and the mountains visibly fractured rock character. The lower lip no longer presents as the previous broad bright stripe; some lighter sunlit patches remain naturally among the slopes. Some foreground leaves still reveal simplified ribbon construction at close inspection, and distant growth can look slightly stippled. These meadow limitations were left outside the current mountain/hamlet scope.

This is a stronger meadow foundation for review, not final artistic approval. Flowers or decorative props should not be used to conceal those remaining structural/material weaknesses.

Final mountain/hamlet review: the crest now reads as a connected alpine ridge with branching rocky faces, while the lighter upper surfaces extend into sheltered relief. The lower foothills remain broad and quiet. The settlement is recognizable from the hero camera, with a modest chapel landmark and cottages at differing positions and ground heights. The final crops confirmed lower foundations and grounded entrance steps. Remaining weaknesses are the soft snow transitions, a few rather sharp summit forms, and clean architectural surfaces that could benefit from restrained aging later. Neither area is claimed to match the realism of the photographic reference yet.

## Verification

The final saved file is reopened in a fresh Blender process. Checks cover active camera and saved camera view, foreground water entry, main bend, second upstream reach, water/terrain alignment and foundation contact. The atmospheric container is skipped as a non-opaque boundary in visibility tests; vegetation and terrain still count as occluders. The resulting saved-camera render is visually inspected.

The 5 November pass also verifies all twelve live terrain texture nodes: packed images present, 2048 x 2048 dimensions, sRGB albedo and Non-Color scalar data. Lower-face camera samples were added to the previous upper-hillside checks, and all checked shoulder slopes are below 30 degrees. These checks establish persistence and material integrity, not artistic approval.

The mountain/hamlet pass additionally compares a pre-edit scope snapshot: sampled coordinates and vertex counts for water and foreground/basal/midground plant layers, a complete coordinate hash of terrain below Y 210 m, and the camera transform/lens. These preservation checks are separate from artistic inspection. The farthest foothill plant layer can follow the changed mountain foothills; the protected near and middle meadow layers remain fixed.

The foreground entry and main bend pass their visibility checks. The upstream reach remains partly screened by land and growth: 2 of 5 cross-width rays reach water at Y 107 m, and 4 of 5 at Y 122 m. It is not an uninterrupted exposed ribbon. These are sampled geometric visibility checks, not a claim that the distant stream is visually prominent.

Visible shoreline alignment is sampled over Y 0-132 m; its error remains below 0.000001 m. Bed clearance is approximately 0.6493-0.6500 m. Open-meadow slopes remain about 10.57 degrees at the 95th percentile and 16.88 degrees maximum in the sampled parcel. All five buildings remain grounded. Exact per-layer counts and validation details are in the measurements file.

No WebGL frame-rate or runtime memory benchmark was performed. The native leaf geometry prioritizes this Blender appearance study. It will require a reusable representation for eventual Three.js transfer; procedural materials and atmosphere also need baking or deliberate runtime recreation.

## Editing

Geography, water, village, camera/daylight and vegetation have named objects and collections. Vegetation layers are separate meshes, and terrain materials use editable node groups and point attributes. Density, height, source shapes, palettes and masks are controlled in the existing generator. Regeneration overwrites manual scene edits within this study.


## First ecosystem integration

The canonical scene now contains the first editable flower and tree integration. See ECOSYSTEM_INTEGRATION.md for current render paths, planting controls, measured preservation checks and remaining weaknesses. Source credits and modifications are recorded in ECOSYSTEM_ATTRIBUTION.md. The current composition_preview.png is the integrated hero render.



## Tree composition refinement

The current tree-only refinement is documented in TREE_COMPOSITION.md. The latest hero view is tree_composition_preview.png and composition_preview.png. The canonical file is unchanged in name. Flowers and all non-tree geometry/camera/light settings passed fresh-file preservation checks; five tree placements remain visible, with four held for review.



## Current habitat and hamlet composition

The current in-place scene now includes the foreground-left alder, a restrained fern understory, loose age-varied conifer growth and a locally softened hamlet shoulder. See HABITAT_COMPOSITION.md for current render paths, native scale notes, verification and the scope of the authorized terrain changes. habitat_composition_preview.png and composition_preview.png are the latest hero view. Earlier pass reports remain historical baselines.


## Foreground tree replacement

The foreground-left alder has been replaced by the approved Norway spruce at matching approximately 6 m standing height. foreground_spruce_preview.png and composition_preview.png show the current camera. All other scene objects passed fresh-file preservation checks. See FOREGROUND_TREE_SWAP.md for the replacement and the diagnosis of the remaining tree/ground integration issue.

Latest tree-ground habitat pass: see TREE_GROUND_HABITAT.md, tree_ground_habitat_preview.png and tree_ground_habitat_detail.png. Canonical blend updated in place; old whole-scene generation helpers should not be run to preserve this local refinement.

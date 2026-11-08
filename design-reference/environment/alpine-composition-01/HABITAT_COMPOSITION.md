# Foreground habitat and softened hamlet shoulder

Current canonical file: `echelon_alpine_composition_01.blend`.
Current hero render: `habitat_composition_preview.png`, also copied to `composition_preview.png`.

## Composition changes

The user's marked foreground patch was located through the fixed hero camera, at approximately (-15.15, 9.98) metres, about 23 m from the camera. A native 14 m alder there would overwhelm the shot. The existing Black Alder is instead used as a roughly **5.9 m multi-stem tree**, clipped naturally by the left frame edge. It frames the near meadow and stream while leaving the main bend, settlement and central mountain peaks visible. Its apparent prominence is perspective, not an enormous physical tree: the hamlet is over 120 m away and its architecture was not scaled down.

The conifers retain substantial real-world stature and now describe a loose growth group rather than equal partners: a roughly 16 m larch, a roughly 10 m subordinate larch with partly overlapping canopy, and a deeper spruce on the left slope. Their varied distances, silhouettes and height hierarchy are deliberate. A single mature spruce remains on the right, supported by two young firs; two other saplings belong to the left group. There are **nine tree placements total**, four of them genuine sub-1.5 m saplings. No new tree species were introduced.

Seven restrained fern clumps sit at the sheltered foreground alder base, on the near-stream terrace. They use four variants of one CC0 source family, not a mixture of unrelated weed/shrub models or a new blanket groundcover. They are intentionally subtle in the wide camera. No shrubs or forest wall were added.

## Hamlet and local terrain

The right-hand shoulder was softened with one compact, smoothly feathered vertical deformation field, maximum **1.55 m** lowering. It has finite support: X > 8 m, 65 < Y < 195 m, fading out well before the mountain range. No terrain was uniformly scaled or translated. The stream's bed/water geography is outside the affected area.

Buildings were moved vertically as rigid assemblies by approximately **0.70, 0.98, 1.14, 1.30 and 1.52 m**, following the local ground change. Building XY positions, architectural dimensions, roof geometry and internal assembly relationships remain unchanged. Existing grass geometry and affected flower root Z coordinates follow the same smooth field, avoiding floating vegetation or a bare lowered patch. Flower XY distribution, scale/rotation attributes, materials and counts remain unchanged.

The original ground Z values for affected vertices are retained in `habitat_grounding_baseline.npz`. `habitat_scene_baseline.json` records the source hashes, camera and object transforms. The refiner restores those values before reapplying its field, so repeated runs do not cumulatively lower the hill. All final geometry remains directly editable in Blender.

## Visual inspection and limitations

Two actual 1920x1080 hero renders were inspected. The second adds a smaller larch within the left slope group, giving the foreground frame, midground family and distant foothill tree a clearer age/depth hierarchy. The foreground alder gives a stronger sense of standing beside living vegetation rather than viewing a field of isolated props. The hamlet sits less prominently on its shoulder. The valley remains largely open and the main stream and mountain view are preserved.

This is a composition review, not final artistic approval. The alder is the strongest new framing element, and its sparse lower branching is a limitation of the selected model. The conifer cards still limit close-up quality. The wide-camera fern/sapling contribution is deliberately restrained. No lighting, sky, mountain-position, animation, fish or unrelated detail work was undertaken.

## Saved-file verification

`verify_habitat_composition.py` reopened the actual saved canonical blend and checked:

- Camera matrix/lens and light settings match the previous scene.
- Every mountain vertex at Y >= 225 m matches its original coordinate hash; no range translation or scale change.
- Water/source geometry remains unchanged.
- All authorized terrain/grass/root edits are confined to the recorded local field. Restoring the saved original Z values reconstructs the original mesh hash, proving that XY and geometry outside the field were not changed.
- All **2,262 flower instances** still evaluate: 1,100 Marguerites, 539 Dandelions, 104 Red Clover and 519 Carthusian Pink. XY distributions and per-point rotation/scale hashes match. Maximum flower-root grounding error relative to the intended 12 mm burial is about **4.3 mm**.
- All five stone foundations remain buried into the terrain; minimum corner burial ranges from about 0.25 to 0.41 m. Entry-step bottoms have no meaningful floating gap (largest measured about 1 cm).
- Nine active tree placements, seven fern instances and packed source maps are present.

See `habitat_composition_report.json` for exact measurements. The latest verifier saved the canonical scene after removing only unreferenced import remnants. No application code, productivity functionality or approved cottage files were touched.

## Editing and reproduction

Tree placements remain individual objects in **Authored trees and saplings - individual placements**. Ferns and hidden reusable source meshes are organized under **07 Sheltered habitat plants**. Existing flower Geometry Nodes controls remain in the ecosystem collection.

`refine_habitat_composition.py` is the current local edit step. `verify_habitat_composition.py` performs readback checks and refreshes the usual preview. Earlier generation/refinement scripts and their preservation files describe previous scopes; do not blindly rerun an older whole-landscape generator over the authored canonical scene. The current scene and latest baseline-backed edit are authoritative.

## Added asset credit

**Fern 02**, **Rico Cilliers (modeling), Rob Tuytel (scanning)**, Poly Haven.
Source: https://polyhaven.com/a/fern_02
License: **CC0**, https://polyhaven.com/license

The native Blender file and complete 2K diffuse/normal/roughness/alpha dependencies were obtained through the publisher's API, with MD5 verification, in `../asset-auditions/ecosystem-candidates/sources/fern-02/`. No downloaded scripts or add-ons were run. Modifications are limited to root normalization, shared-mesh instances, scale/yaw variation and grounding. Maps are packed into the canonical file. Exact botanical species is not specified by the source; no species-level identity is claimed.

All existing tree and flower credits/license restrictions remain in `ECOSYSTEM_ATTRIBUTION.md`. Stop here for human review.

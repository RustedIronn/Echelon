# Integrated vegetation attribution

Retain these credits and modification notes with exported derivatives. This file records only the plants integrated in the first ecosystem pass; existing terrain materials remain credited in `material-resources/ASSET_SOURCES.md`.

| Integrated source | Creator and direct source | License | Integration / inherited adaptations |
| --- | --- | --- | --- |
| Marguerite Flowers | Paweł Wałasiewicz — https://www.blendkit.com/asset-gallery-detail/9c41b66e-e694-4502-8283-8f830baf633c/ | Blendkit Royalty Free — https://www.blendkit.com/docs/licenses/ | Original source geometry/materials; root normalization, controlled point instancing, rotation/scale variation. |
| Dandelion 01 | Rico Cilliers (model), Rob Tuytel (photography) — https://polyhaven.com/a/dandelion_01 | CC0 — https://polyhaven.com/license | Existing A LOD0 geometry and original material; root normalization, modest plant-height/scale variation, controlled instancing. |
| Trifolium Pratense / Red Clover | mglnx — https://sketchfab.com/models/ecb868d570684c26a282af8f19a62f18 | CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ | Earlier audition normalized the non-grounded 88.7 cm source to 45 cm and adapted unlit material to daylight Principled using the original color texture. Integration retains that adaptation and adds controlled smaller scale variation and instancing. |
| Dianthus carthusianorum / Carthusian Pink | plantuz — https://sketchfab.com/models/6c1b098527b748da8e1b568a93a69fa4 | CC BY 4.0 | Three paired original stem/head modules retained as one repeatable botanical source. Earlier audition reconstructed missing cutouts from black-backed original images; materials remain editable. Grounded, rotated and scaled instances added. |
| Spruce tree / Picea abies | Georgeous (@intice184) — https://sketchfab.com/models/7a5db417827244d98827459bce0cc944 | CC BY 4.0 | Supplied LOD0 GLB; original materials and native source ground reference retained; imported hierarchy transforms normalized into display geometry; individual grounded placements with moderate rotation/scale variation. |
| Larch tree / Larix | Georgeous (@intice184) — https://sketchfab.com/models/d027dae8c92544d79b946edcea98deca | CC BY 4.0 | Same inspection-to-integration treatment as spruce. Exact larch species remains unspecified by the source. |
| Black Alder Large | Amanpreet Bajwa — https://www.blendkit.com/asset-gallery-detail/7f3605e0-5e27-4e36-a6cb-4d2fa094f37d/ | Blendkit Royalty Free | Source geometry retained; prior audition corrected packed SRA data-map color space on a material copy. One grounded streamside placement, currently withheld in the tree-composition review; normalized root and modest scale/yaw variation. |
| Fir Sapling | Rico Cilliers (model), Rob Tuytel (photography) — https://polyhaven.com/a/fir_sapling | CC0 | Three native young-tree variants, original 2K materials; four individually grounded placements, two currently visible and two withheld; modest scale/yaw variation. |

CC BY 4.0 permits commercial use, modification and source redistribution with attribution, source/license links and modification disclosure. CC0 permits redistribution without mandatory attribution, though credit is appreciated.

Marguerite and Black Alder are **Royalty Free, not openly licensed source assets**. Do not assume that the combined canonical blend or openly extractable GLBs can be placed in the public repository under CC0/CC BY. Their inclusion does not prevent permitted rendered-image use. Review distribution terms before WebGL packaging: https://www.blendkit.com/docs/licenses/licensing-faq/ . Nothing was published, committed or exported during this integration pass.

Earleaf Bellflower and Small Willow 02 are not integrated. The separate prior audition/source files remain unchanged.


## Sheltered habitat addition

Fern 02 by Rico Cilliers (modeling) and Rob Tuytel (scanning), Poly Haven: https://polyhaven.com/a/fern_02 . CC0: https://polyhaven.com/license . Native 2K Blender source and dependencies downloaded through the official API with checksum verification. Seven grounded shared-mesh placements, using four variants, with root normalization and modest scale/yaw variation. Source and maps remain available; images packed. See HABITAT_COMPOSITION.md for the latest tree arrangement and local terrain/vegetation grounding changes. Original tree/flower licenses remain unchanged.


Tree-ground habitat revision: the same seven Fern 02 objects were repositioned/scaled into an irregular sheltered apron; no new assets downloaded. Existing spruce bark material is reused for restrained root seating. See TREE_GROUND_HABITAT.md for current placements and local grass/soil/flower response. Licenses and original source credits above remain unchanged.

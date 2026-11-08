# First ecosystem integration - review notes

Current tree layout: the later tree-only review supersedes the original nine visible placements described below. See TREE_COMPOSITION.md and tree_composition_preview.png. Flowers remain unchanged.

The canonical file remains `echelon_alpine_composition_01.blend`. Open it normally; the original **ECHELON HERO - low left bank fixed camera** is active and the workspace opens in camera/material view. The existing `composition_preview.png` is updated to the final 1920x1080 hero render, also available as `ecosystem_integration_preview.png`.

`ecosystem_foreground_detail.png` is a crop rendered at higher source resolution from the **same hero camera**, not a flattering alternate close-up camera. The crop settings are temporary and are not saved in the canonical file.

## Current planting

| Flower | Saved plants | Heads projected into bottom 35% | Near meadow, Y < 15 m | Midground, Y 15-65 m | Farther continuation |
| --- | --- | --- | --- | --- | --- |
| Marguerite | 1,100 | 191 | 261 | 646 | 193 |
| Dandelion | 539 | 132 | 134 | 313 | 92 |
| Red Clover | 104 | 25 | 34 | 52 | 18 |
| Carthusian Pink | 519 | 67 | 120 | 311 | 88 |

Total: **2,262 instanced botanical specimens**. Some specimens contain several blossoms or stems. These are not raw triangle or blossom counts. The camera-near region was measured on the actual saved terrain before placement; broad world-coordinate scatter was not used as a substitute for identifying the visible foreground.

Tree placements are authored individually: **two Norway Spruce, two Larch, one Black Alder and four Fir Saplings**. The conifers sit toward the left/right valley edges, the alder provides a single upper-stream landmark, and saplings provide restrained young growth. Their source geometry is shared. The central stream view, hamlet and principal mountain view remain open.

**Earleaf is deliberately omitted.** Its approximately 10 cm height does not have a convincing short-grass opening in this existing meadow. No grass or terrain was removed merely to force that optional species into the pass. The rejected willow, new daisy pack and rejected Harebell are not planted.

## Distribution and grounding

Flower roots are ray-cast onto the saved terrain mesh, not regenerated from a possibly stale mathematical terrain function. The real saved water mesh is tested at each root and four surrounding positions. Steep faces and terrain-occluded flowers are rejected. Roots penetrate the soil by 12 mm to avoid hovering stems.

A deterministic, smoothly varying habitat field produces richer and quieter areas, with a near-camera emphasis and gradual reduction through distance. Species preferences vary gently while the four flowers continue to intermingle. A mild shoreline thinning reduces the appearance of a continuous decorative flower border; banks are not excluded by a hard bare strip. The upper continuation tapers rather than stopping at a fixed meadow depth.

Plant rotations follow gentle ground normals with varied yaw and modest independent width/height scales. The Dandelion has an additional 1.38 scale multiplier before individual variation so some heads emerge through the short canopy. Clover was reduced in frequency and size after the initial hero render showed over-dominant large heads. Native materials and earlier approved audition adaptations are retained; no new recoloring was used.

The mature trees preserve their source ground plane and buried root extensions. They remain upright with varied yaw and scale; they are not tilted perpendicular to the hillside. The alder and saplings have normalized ground anchors and slightly buried bases. No terrain sculpting was needed.

## Editability

Expand **06 Meadow ecosystem - first integration**:

- **Editable flower placements - independent species controls** contains one point emitter per species. Each has a Geometry Nodes modifier exposing **Coverage** (0-1) and **Plant size**. Root vertices can be moved in Edit Mode. Per-point `plant_rotation` and `plant_scale` attributes retain authored variation.
- **Authored trees and saplings - individual placements** contains individually movable tree objects with shared source meshes and placement-intent properties.
- **Normalized source plants - used by Geometry Nodes** contains reusable hidden prototypes.
- **Botanical source geometry - hidden originals** retains the imported model parts, including the paired Carthusian Pink stems/heads. Only those related botanical parts are assembled into the repeatable source; unrelated scene elements are not joined.

All four Geometry Nodes populations have viewport/render visibility enabled. The source objects are hidden without disabling the emitter evaluation. Fresh-file dependency-graph inspection counted all **2,262 actual viewport instances**.

## Visual review

The final hero image visibly contains recognizable white daisies and pink/clover accents in the immediate foreground. The flowering meadow continues across the stream and into the midground with quieter growth farther back. The trees establish scale without forming a dense forest or hiding the settlement. This is a stronger sense of inhabitation than the previous empty valley.

Remaining weaknesses: Dandelion yellow is relatively subdued; the existing grass remains coarse at close range; the distant vegetation is intentionally quiet; and the tree source cards are still unsuitable for extreme close-up use. The scene's existing restrained lighting makes the palette more muted than a bright finished concept render. No lighting/sky changes were made to compensate during a planting-only pass. These findings are not a claim of final artistic approval.

One implementation issue was caught in the initial render: the conifer audition contained copies for more than one comparison scene, and a broad name filter initially selected both. The final import is restricted to the exact source meshes recorded in the audition report, with triangle-count assertions (10,387 spruce; 12,201 larch). No duplicated whole trees remain inside the source prototypes.

## Preservation and verification

`ecosystem_geometry_preservation.json` records every original scene object's transform and full mesh-coordinate hash, topology counts and material assignments, plus camera and light parameters. Verification in a fresh Blender process checked **215 original objects**: terrain, all existing grass layers, water, buildings, camera and lights remain unchanged. The original camera lens/matrix and meadow composition are retained. Packed image maps and both viewport/render modifier visibility were checked.

No application files, routes, state, authentication, persistence, WebGL renderer, animations or unrelated environments were modified. No new assets were searched for or downloaded. The separate auditions remain unchanged. No real-time performance claim is made.

The existing `.blend1` is the pre-integration canonical file; no new numbered landscape or audition blend was created. Unused zero-user data from the integration rebuild was removed from the canonical file while all linked scene geometry and hidden source collections were retained.

## Reproduce

`integrate_ecosystem.py` loads the existing canonical landscape, replaces only its own ecosystem collection, checks protected geometry, builds editable planting and renders the hero. It does not call or regenerate `build_composition.py`. `verify_ecosystem.py` reopens the actual saved file, validates protected geometry and instances, updates the usual preview and renders the hero-camera foreground crop. The integration guard intentionally refuses to silently overwrite unrelated approved geometry changes.

See `ecosystem_integration_report.json` for actual placements, scales, counts and saved-file checks. See `ECOSYSTEM_ATTRIBUTION.md` for source licenses and inherited material adaptations. Stop here for artistic review before further development.

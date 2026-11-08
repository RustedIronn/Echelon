# Hero-scale habitat structure and look development

Updated in place: `echelon_alpine_composition_01.blend`.
Hero: `habitat_structure_preview.png` — 1920 x 1080, Cycles, 160 samples.
Same-camera detail renders: `structure_foreground_detail.png`, `structure_water_detail.png`.

## Purpose and visible changes

The previous cohesion edits were too small to read consistently at hero scale. This pass addresses actual canopy volume, the bank cross-section and the relationship between sunlight, water and its bed.

### Meadow body

Existing blades are reshaped into shared, interlocking height/spread masses at several scales. Low basal growth remains beneath the taller arching layer, with quieter thinner areas between richer growth. Small physical ground variation follows the same growth field outside the channel.

No grass or flower population was added. All original grass blade counts and all 2,262 original flower source points remain. Flower species, XY positions, scale and rotation are preserved; root heights follow the actual edited surface.

Plant movement uses the height difference between source and edited evaluated terrain BVHs, rather than assuming that a continuous formula matches the triangulated mesh. This retains the original embedding at roots while changing the surface and canopy above them. Existing sources and removable population modifiers remain editable.

### Banks and local limestone

The main stream and tributary waterlines were measured from the saved scene. Selected unequal reaches receive an actual dry turf shoulder, shallow erosion at the toe, or an inside gravel shelf. Ground material masks, grass clearance and terrain response use the same fields.

Six low embedded limestone anchors and three small bank-gravel pockets establish scale and shoreline contact. Four small native limestone shape variants were authored in Blender. Their material reuses the existing aerial-rock diffuse/height maps, tying them to the range; no external assets were downloaded. Ten existing bank stones reuse this material and follow the new ground vertically.

Pebbles use editable points with Geometry Nodes and four shared source geometries. There are 94 bank pebbles and 900 submerged foreground pebbles, not 994 independent mesh objects. Their placement avoids a continuous uniform stone border. The submerged placement footprint extends outside the camera and varies in density to avoid the rectangular edge seen in an early diagnostic.

### Water and light transport

The water volume's geometry, level, IOR, transmission, reflections and absorption are retained. Its closed-shell shadowing made the bed detail extremely dark. This was diagnosed through unsaved crop tests: hiding the water exposed the real bed geometry, while allowing direct sunlight through its shadow restored the intended shallow-water read.

The retained **rendering approximation** sets the water object's shadow-ray visibility off. Camera, glossy and transmission visibility remain on. This lets sunlight reach the gravel without requiring a caustic solution; it is not a physically exact water-light simulation. Direct attenuation/focusing through the water is consequently simplified, while camera-ray refraction and absorption still operate. This setting must be considered explicitly in any future Three.js adaptation; it does not automatically transfer through glTF.

Native Cycles shadow-caustic controls were tested in an unsaved diagnostic but did not provide the required visible improvement in that crop. They were not retained. Blender documents MNEE as approximate and notes that bump/normal and volumetric material effects are not included in its caustic calculation: https://docs.blender.org/manual/en/5.0/render/cycles/object_settings/object_data.html . The corresponding light/caster/receiver controls are described at https://docs.blender.org/manual/ja/5.2/render/cycles/light_settings.html .

No transparency paint-over, image background, animated water or baked lighting was introduced. Submerged pebbles are actual geometry, placed using refracted camera rays into the existing bed.

### Daylight and range materials

Sun direction stays fixed. Its angle is reduced from 3 degrees to 0.85 degrees to reveal grass/stone contact; energy is 3.25 with a restrained warm tint. The look is AgX Medium High Contrast at +0.10 exposure. Distant haze maximum is reduced from 0.0018 to 0.0009, retaining atmospheric separation with clearer mountain forms.

Existing triplanar rock maps now use a 26 m repeat with restrained height-derived bump. Rock exposure considers elevation and slope. Snow uses elevation, aspect, existing drainage and suitable slopes; the scanned rock-height response breaks its coverage. The first broad snow treatment looked too cap-like, so it was refined and balanced through the actual hero renders. No mountain geometry or silhouette was changed.

## Actual validation

`verify_habitat_structure.py` reopened the canonical file in a fresh Blender process and checked:

- Original hero camera matrix and lens unchanged.
- Original hamlet and tree poses/visibility preserved; background trees remain hidden.
- All range geometry at Y > 250 byte-identical to the start of this pass.
- Entire water coordinate array byte-identical.
- Original grass blade counts retained.
- Flower source count, XY positions, scales and rotations retained.
- Root embedding compared between original and edited evaluated terrain: maximum change approximately 1.2e-7 m in the checked samples/all flower roots. Existing small model/terrain offsets remain (95th-percentile absolute root offset approximately 1.7 cm).
- Actual evaluated pebble instance count equals the 994 saved placement points.
- All six new anchors partly embedded, with no floating bottoms.
- Saved water shadow approximation and the new color-management settings verified.

See `habitat_structure_report.json` and `habitat_structure_verification.json` for measured data. The final full hero and both detail renders were visually inspected.

## Editing and reproduction

- `refine_habitat_structure.py`: source-based in-place refinement and hero render.
- `habitat_structure_fields.py`: common growth, bank and ground response.
- `habitat_structure_source.npz` / `.json`: reproducible source arrays and scene measurements, not another .blend.
- `verify_habitat_structure.py`: fresh-file validation and same-camera detail rendering.
- `10 Stream habitat - reusable limestone`: editable embedded stones, hidden source variants and point-based pebble placements.

Use this helper for this pass. Earlier landscape/cohesion helpers predate these source arrays and should not be run over the current result without accounting for the later work. Existing hamlet wear masks and packed material resources remain available. Lighting is fully editable.

No application files, new tree assets, clouds, fish, animation or seasonal systems were changed.

## Candid visual assessment

The most successful improvement is the water/land relationship: the foreground now reveals actual bed gravel, the banks have readable thickness, and the stone/grass contact is more convincing. Daylight reveals more volume, and the flowering meadow remains dominant.

This is closer to the supplied cohesion reference, but it does not reach all of its surface richness. The distant foothills and mountain faces still have simpler, softer forms; the existing grass source remains more ribbon-like in the enlarged crop. The foreground spruce retains its earlier branch-card limitation. These are visible limitations, not hidden by a claim that successful rendering constitutes artistic approval.

Stop here for human review.

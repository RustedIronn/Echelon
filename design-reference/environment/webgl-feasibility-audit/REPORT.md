# Echelon: Blender → WebGL feasibility audit

**7 November 2026 · Audit only; no conversion implemented**

## Assessment

The approved composition is a credible foundation for a living WebGL backdrop. The strongest route is **hybrid adaptation**: retain Blender as the authoring source for geography, camera, botanical placement and architecture; prepare delivery geometry/materials; implement wind, water optics and atmosphere in Three.js.

A single export of the complete scene would neither reproduce Cycles faithfully nor address the main costs. Rebuilding the world procedurally in JavaScript would throw away approved composition unnecessarily. Real-time fidelity and performance remain unproven until the proposed prototype runs.

The largest measured costs are vegetation and image resources, not the hamlet or the one visible tree. Preserve the foreground's visual quality; change representation according to its contribution to the fixed shot.

## 1. Scope and evidence

Fresh Blender background processes opened the exact saved `../alpine-composition-01/echelon_alpine_composition_01.blend`, with factory startup and automatic script execution disabled. Inspection collected meshes, Geometry Nodes instances, shader dependencies, camera projection and visibility settings. No export or scene save was called. The existing `grounding_pass_preview.png` was visually inspected; this audit did **not** produce a new render.

The 739,753,721-byte scene's SHA-256 before and after the primary inspection was identical:

`0abcb3c95ae349e9c7831d0e8913c3d40016fc049675aa738df773b1aae25506`

Machine-readable evidence and reproducible read-only inspectors accompany this report:

- `scene-audit.json`: object-by-object raw/evaluated geometry, instances, image dependencies, camera and materials.
- `camera-and-systems.json`: actual render projection, grass-root frustum tests, named attributes, water flags and node systems.
- `summary.json`: aggregates and qualifications.
- `inspect_scene.py`, `inspect_camera_systems.py`: inspection only.

**Measurement limitations:** evaluated counts are from Blender's **viewport dependency graph**, not a Cycles render or GPU capture. No modifier had mismatched viewport/render enable flags, but that is not proof that every possible node behaves identically in both contexts. Counts include geometry outside the image and hidden behind other geometry. Instances are reported separately from direct meshes. Triangle equivalents are polygon triangulation counts, not exported vertex counts or actual draw submissions. Material graph reachability conservatively traverses connected node groups; it can include branches that contribute negligibly. Image datablocks are not content-hash deduplicated.

## 2. Saved scene inventory and costs

| System | Measured current state | Consequence |
|---|---|---|
| Connected meadow/foothills/range | 1,817,531 vertices; **3,629,860 triangles**; four material slots; **no UV layers** | Keep the landforms. Delivery topology, mapping and LODs need preparation, not a different landscape generator. |
| Four geometric grass layers | **10,902,888 evaluated vertices; 11,278,048 triangles** | Main direct mesh cost. Currently baked geometry with local GN thinning/root offsets, rather than a shared instanced grass source. No UV layers. |
| Flowers | **2,145 evaluated instances**, four shared species; **23,226,924 expanded triangles** | Sharing reduces stored geometry and draw overhead; it does not eliminate repeated vertex processing. Distance-aware source LODs matter. |
| Graded water volume | 50,430 vertices; **100,856 triangles** | Closed surface/volume construction is useful authoring information, but runtime water need not retain its entire shell. |
| Hamlet | **124 mesh objects; 13,726 triangles** | Geometry is modest; separate objects/materials can create avoidable draw overhead. Preserve buildings/parents in Blender; consolidate delivery copies selectively. |
| Foreground spruce | **10,387 triangles**, two material slots | Already real-time-style trunk plus alpha-cutout branch cards. Texture/shadow behavior needs testing more than polygon reduction. |
| Sediment pockets | **994 pebble instances**, four 80-triangle prototypes; **79,520 expanded triangles** | Straightforward shared geometry/instancing candidate. Preserve the actual placements and burial. |
| Direct meshes in visible view layer | **159 objects; 15,045,665 triangles** | Includes zero-face emitter meshes; not a draw-call count. |
| Direct meshes + evaluated instances | **38,352,109 triangle equivalents** | Arithmetic scene submission baseline before frustum/occlusion decisions, shadows, reflections or other passes. **Not a measured WebGL workload.** |

### Flower sources

| Species | Evaluated instances | Triangles per source | Expanded triangles | Materials |
|---|---:|---:|---:|---:|
| Marguerite | 1,043 | 7,776 | 8,110,368 | 3 |
| Dandelion | 510 | 23,542 | 12,006,420 | 1 |
| Red Clover | 99 | 21,436 | 2,122,164 | 1 |
| Carthusian Pink | 493 | 2,004 | 987,972 | 2 |

This is a useful optimization order: preserve close blossom silhouettes and simplify expensive sources where their projected detail cannot be seen. Dandelions are a larger geometric cost than all the hamlet buildings combined many times over. Do not replace the entire palette or flatten close flowers into indistinct dots merely to lower counts.

### Frustum finding: off-camera deletion is insufficient

The original grass meshes contain **856,263 authored blade blocks**. Using each blade's root and the actual saved camera projection, **820,329 roots (95.8%)** fall inside the nominal hero frustum. Layer fractions are 92.1% foreground, 96.2% basal, 93.4% midground and 98.3% transition.

This test excludes neither occluded roots nor modifier-deleted blades; it is not a visibility or pixel-cost measurement. Nevertheless, it contradicts the idea that most grass can be removed simply because it is off-camera. Much of the cost is **in-frame distant detail**. Use screen-space LOD, shared grass geometry and spatial batches, alongside conservative frustum trimming. Retain margins for parallax, shadows and reflections.

## 3. Material and texture dependencies

The scene retains **61 image datablocks**; **35** are reachable through the inspected visible-object/instance material graphs. Their packed encoded payload totals **233,665,048 bytes (222.8 MiB)**. There are **41 material datablocks** in those graphs; that is not an exact shader-program or draw-call count.

Notable resources:

- **Dandelion:** five **8192 × 8192** maps: diffuse, alpha, mask, normal and roughness. Normal and roughness decode as floating-point images in Blender. These are source-quality assets, not sensible delivery defaults without a screen-space comparison.
- **Mountain cliff:** four actual **4096 × 4096** Marble Cliff 02 maps, including a large normal PNG and floating-point displacement EXR. The normal alone has a 93,276,274-byte packed payload. Keep originals; derive runtime maps separately.
- **Ground/bed:** Grass 05, meadow soil and gravel sets, principally 2K; several legacy rock filenames say 4K although the actual images are 2K.
- **Authored masks:** 1024² shared hamlet lane and 2048² stone-contact masks; additional terrain POINT attributes control snow, rock, damp soil, meadow vigor, streambed, habitat and wear.
- **Botanicals/tree:** UV-mapped flower sources, fern and spruce cards, opacity and normal maps. Some material responses use translucent shading and reconstructed cutouts.

For scale only, placing all 35 image datablocks into separate **RGBA8** textures with complete mip chains would imply approximately **2.44 GiB**, from dimensions × four bytes × 4/3. **That is an accounting scenario, not measured VRAM or a prediction of the actual chosen formats.** Channel packing, deduplication, resolution changes and GPU compression change it; float textures and render targets change it again.

The terrain shader is not a simple set of export-ready PBR inputs. It combines world-space projection, custom triplanar normal orientation, Noise/Voronoi, slope/elevation logic and named terrain attributes. Architecture also uses procedural brick/slate treatment and per-island variation. Standard glTF will not execute these Blender node graphs.

**Recommended transfer:** bake surface properties and authored habitat masks onto delivery meshes/atlases, or retain a small documented layered terrain shader using the same masks and a few tiling maps. Bake albedo, roughness and normals **without afternoon illumination**. Keep macro snow/rock/wetness controls separately addressable for seasons. Compare a baked PBR version against a restrained triplanar version before choosing; avoid copying the entire Blender node network into a huge fragment shader.

Use sRGB for color maps, linear/data interpretation for normals, roughness, opacity and masks, and one deliberate display transform. Three's color-management documentation explicitly distinguishes these roles. The existing app's ad hoc gamma conversion should not be copied into the new material pipeline. [Three.js color management](https://threejs.org/manual/pages/color-management.html)

KTX2/Basis is a practical delivery option, with supported GPU formats selected at load time. Validate flower alpha edges, fine grass contrast and mountain normal detail rather than choosing compression blindly. Mesh compression reduces transfer size; it does not by itself reduce the geometry rendered. [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)

## 4. Existing application architecture

Inspected `LandscapeEnvironment.jsx`, `ThreeLandscapeWorld.jsx`, `threeLandscapeData.js`, preview entry, environment CSS, time/celestial modules, layout integration, package lock, Vite and Tauri configuration.

- Locked dependencies: **Three 0.186.1, R3F 9.8.2, React 19.2.8**. No Drei-based environment architecture is required. Three's existing loaders and R3F are sufficient for a first prototype.
- `Layout.jsx` mounts one decorative, pointer-events-disabled landscape behind navigation, focus surfaces and routed content. Keep this application boundary.
- Current world is an **older independent procedural scene**: camera `(8.5,10,25)`, 35° FOV, procedural terrain, fake water-reflection shader, cloud sprites, 980 old flower instances and 560 foliage cards. It has no link to the approved Blender camera, geography, hamlet or palette.
- Eleven hardcoded terrain/foliage/model URLs under `/assets/environment/` reference a directory absent from the present checkout. This is a **static dependency finding**, not a browser-tested failure diagnosis. Do not mistake the current component for a working export of this Blender scene.
- Current Canvas caps DPR at 1.5, uses ACES tone mapping, continuous rendering by default, and a 2048² directional shadow map. It has Suspense but no dedicated asset-error/context-loss recovery in this component. A Canvas fallback alone does not establish complete load-error handling.
- Existing `environmentTime.js` and `environmentCelestial.js` provide reusable time/phase math. The moon calculation explicitly is an approximate visual phase model, not a location-aware ephemeris. Their old palette values should not override the newly matched look automatically.
- Environment CSS places a substantial translucent white reading surface above the backdrop. Evaluate fidelity both unobstructed and **through the actual UI**, including the focus experience. Narrow layouts need an explicit framing/crop policy.
- Tauri packages Vite's `dist`; the large Blender sources under `design-reference` are not automatically runtime assets. Public assets later copied to `dist` would affect download/installer size. Windows runs WebView2; browser measurements do not replace a Tauri measurement. [Tauri webview versions](https://v2.tauri.app/reference/webview-versions/)

The project currently has **no `node_modules` directory** at this location. No dependency installation, browser startup, build or app test was performed for this audit.

## 5. Camera and export fidelity

Saved hero: **`ECHELON HERO - low left bank fixed camera`**, position `(-3,-10,4.3629322)` in Blender Z-up coordinates, lens **28 mm**, sensor width **36 mm**, AUTO fit, zero lens shift, **2560 × 1440**, clip **0.1–1500 m**, depth of field off.

The calculated render projection has horizontal FOV **65.470°**, vertical FOV **39.761°**. Blender's raw `camera.data.angle_y` reports **46.397°** from sensor settings; using that value directly for Three's vertical FOV would produce the wrong 16:9 shot. Export the actual camera/matrix and verify a projection overlay.

Convert coordinates consistently: Blender `(x,y,z)` → Three `(x,z,-y)` is a proper −90° X rotation. Apply it once across terrain, camera, instance transforms, masks and sun direction; avoid double rotation after a glTF import that already handles axes. Establish meters and keep the complete saved orientation, not a guessed `lookAt`.

The installed Blender 5.2.2 exporter was inspected locally. It exposes **Geometry Nodes Instances (Experimental)** and `EXT_mesh_gpu_instancing`; its GPU-instance option warns about hierarchy and multiple-material limitations. Therefore:

- GN is **not automatically impossible to transfer**. Its evaluated placements can be retained.
- The editable GN program is not a portable runtime program.
- Do not universally Realize Instances: that would expand shared flowers/pebbles unnecessarily.
- Test exporter instancing on one specimen per material layout later. A deterministic placement manifest plus shared GLB prototypes is a practical fallback and gives explicit seasonal/wind controls.
- Exported vertex counts may rise at UV seams, sharp normals and material boundaries. Source vertex counts are not final GPU-buffer counts.

Official loader support includes instancing and relevant material/compression extensions; support does not guarantee the Blender shader's appearance. Installed exporter reference: `C:/Program Files/Blender Foundation/Blender 5.2/5.2/scripts/addons_core/io_scene_gltf2/__init__.py`, properties `export_gn_mesh`, `export_gpu_instances`, `export_attributes`. [Khronos exporter project](https://github.com/KhronosGroup/glTF-Blender-IO), [glTF specification](https://github.com/KhronosGroup/glTF/tree/main/specification/2.0)

## 6. Which systems need runtime treatment?

| System | Recommended adaptation | Specific limitations and tests |
|---|---|---|
| Landforms, banks, bed | Preserve evaluated approved shape; author export derivatives in spatial chunks and camera-relevant LODs | Protect silhouettes, foreground contours, tributary bed and building contact. Test projected error; no arbitrary uniform decimation. Keep offscreen shadow/reflection coverage. |
| Grass | Recover existing roots and variation from authored blade blocks; shared fine-bladed prototypes/clumps in spatial batches, with foreground/midground/distant representations | Current four baked meshes have no ready-made wind attributes. Preserve density/color communities; do not restart uniform random scatter. Shader bending requires root, normalized height, stiffness and phase; bounds need wind margin. |
| Flowers | Preserve evaluated GN placements and species proportions; instance shared UV-mapped sources with authored LODs and stem-root weights | Dandelion/clover need particular attention. Bend stems without stretching blossoms. Match wind in color and shadow/depth passes; otherwise shadows detach. Alpha overdraw and tiny distant blossoms need benchmarking. |
| Spruce/ferns/rocks/hamlet | Keep models and placements; simplify delivery grouping/materials where it is visually invisible | Spruce alpha cards and fern translucency need real-time lighting treatment. Hamlet detail can largely survive; procedural masonry/slate needs baked or equivalent PBR. Do not export hidden background trees merely because they remain in the file. |
| Water | Preserve carved terrain and water heights; derive a visible surface plus bed/depth data; runtime Fresnel, restrained absorption/refraction and animated normals/flow direction | Saved material has transmission 1, IOR 1.333, absorption 0.16, with **water shadow visibility deliberately disabled**. That Cycles setup does not transfer literally. Water rises along the course, so one flat reflection plane is not a perfect match. Begin sky/environment reflections; test selective planar reflections only if visibly needed. |
| Sun/sky/haze | Runtime directional lighting, sky illumination/reflections and controlled distance/height fog matched first to saved afternoon | Current Blender world is physical Sky + Sun and bounded volume haze, not a transferable cloud mesh/HDR sky. Cycles multiple scattering, GI and AgX look are not guaranteed by exporting a Sun or selecting an identically named tone mapper. |
| Clouds | Separate future runtime sky layer: authored cloud volumes/cards or a raymarched layer, selected by actual camera result and measured cost | No approved cloud system is present in this alpine scene. A skybox can be a preview reference; a fixed daytime image is insufficient for dynamic lighting. Avoid prematurely committing to costly volumetrics. |
| Time/moon | One environment clock controlling sun/moon direction, sky, ambient/IBL, fog and window emission consistently | Reuse existing approximate moon phase math. A lit moon sphere or phase shader can implement waxing/waning; it does not need a new geometry asset each day. Do not update thousands of React components every frame. |
| Seasons | Persistent species/instance identities, habitat masks and seasonal material/visibility parameters; separate snow accumulation controls | Recoloring alone cannot create winter vegetation or credible snow depth. Preserve sheltered/slope masks now; decide geometry variants later. Larch is deciduous; spruce is evergreen. |
| Fish | Later small rigged/instanced meshes following paths in actual stream space, constrained by bed and water heights | No fish assets/behavior currently exist. Transparent water must show submerged moving objects; depth/refraction ordering should accommodate them. Full fluid or ecological simulation is unnecessary. |

The current file has **zero action datablocks**. Future animation is feasible as additional work, not an animation capability already delivered in the assets.

Three's `Water` helper is explicitly a flat reflective effect, useful as a comparison rather than an automatic solution to this graded stream. Reflection passes and scene transmission must be measured with vegetation visible. [Three Water](https://threejs.org/docs/pages/Water.html)

Instancing reduces draw-call overhead but not all vertex work, alpha fill or shadow cost. Use spatial batches and valid bounds so one enormous batch does not force irrelevant geometry to render. Share and explicitly dispose resources. [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)

## 7. Practical routes

| Route | Advantages | Problems | Verdict |
|---|---|---|---|
| Whole-scene GLB, little preparation | Fast structural import; convenient camera/static geometry test | Heavy baked grass, expensive repeated sources, unsupported nodes, no living systems; material mismatch likely | Diagnostic only, not production strategy |
| Fully baked still or layered 2.5D backdrop | Closest immediate match to the Cycles image | Parallax boundaries; changing light, wind, water, seasons and fish become constrained compositing problems | Useful fallback/reference, weak primary route for the stated living-world requirements |
| Rebuild all geography and scattering in JS | Complete runtime control | Reintroduces previous composition/placement failures; duplicates authoring systems | Unnecessary |
| **Blender-authored hybrid** | Retains approved place; shared geometry/placements; deliberate dynamic shaders; maintainable source/delivery separation | Requires export preparation and visual matching; not one-click | **Recommended** |

## 8. Runtime architecture recommendation

Retain **one R3F Canvas** at the current decorative layout boundary. Inside the environment module, separate authored asset loading, camera composition, terrain, vegetation, water and atmosphere. A small shared environment controller supplies clock, wind, seasonal and quality uniforms. No route/auth/habit/schedule dependencies belong in these systems.

Keep Blender originals under `design-reference`; later create a reproducible delivery manifest linking exported derivatives to source hashes, camera matrices, units, bounds, species IDs, material roles and attribution. Load spatial terrain/hamlet assets plus shared vegetation prototypes and placement data. Reuse the evaluated placements rather than separately recoding their ecological rules.

Use one linear lighting pipeline and match afternoon first. Avoid baking directional sunlight into base color. Reserve dynamic shadow effort for visibly contributing regions; compare softer approximations farther away against the reference before accepting them.

Update wind/water uniforms in the render loop, not React state per plant. Use normal continuous rendering while animation is active; demand rendering fits a paused/static scene, not continuously moving grass without explicit invalidation. Pause/throttle hidden/minimized scenes and support reduced motion. Recover from asset/context failures independently of the productivity UI. [R3F performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)

## 9. Publication and licensing

Local attribution records distinguish:

- **CC0:** Terrain 002 (Lennart Demes / ambientCG), Marble Cliff 02 (Amal Kumar / Poly Haven), Aerial Rocks 04 (Rob Tuytel / Poly Haven), Dandelion 01 and fir/fern sources where recorded.
- **CC BY 4.0:** Red Clover (mglnx), Carthusian Pink (plantuz), Norway Spruce/Larch (Georgeous). Keep creator/source/license links and describe optimization/material changes. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Blendkit Royalty Free:** Marguerites (Paweł Wałasiewicz), Grass 05 (Paco Salas), meadow soil/gravel (Per's Scan Collection), and some retained audition assets. These are **not automatically cleared for a public raw-asset repository**.

Blendkit's official FAQ conditions game distribution on assets not being directly extractable. Public GLBs/textures are ordinarily retrievable, so public WebGL delivery and GitHub asset publication need explicit permission/clarification or replacement of those particular licensed resources. Bundling/renaming/compression is not a reliable licensing solution. This is a specific unresolved release dependency, not a reason to discard the approved composition or halt a private technical prototype. [Blendkit licenses](https://www.blendkit.com/docs/licenses/), [official distribution FAQ](https://www.blendkit.com/docs/licenses/licensing-faq/)

Use the existing botanical-lineup, mature-conifers and material-resource attribution records as the export manifest's starting evidence. Resolve source-to-image provenance for generic names such as `Image_0.*` before publication. Do not assume the packed `.blend` itself is suitable for unrestricted repository redistribution.

## 10. Minimal prototype plan — proposed, not implemented

### A. Prove camera/geography fidelity first

Use the existing standalone landscape-preview entry as an isolated harness. Prepare only a camera, representative terrain/hamlet derivative and simple runtime sky/light. Compare the 2560×1440 projection directly against the approved image. Preserve screen positions, visible bends, settlement scale and mountain silhouette before optimizing appearance.

Define a small future parallax envelope explicitly, then test its extremes. No approved numerical motion envelope currently exists; do not cull to the exact still image and discover exposed edges later. Choose a separate narrow-aspect framing policy without silently changing the desktop hero.

### B. Prove the costly visible slice

Add one actual foreground meadow/bank section and a representative mid-distance section with all four flowers, shared grass and the existing masks. Compare an authored high-detail reference and delivery variants. Sweep source LODs, tile sizes and texture resolutions individually; preserve the fine foreground silhouette and recognizable blooms.

Add the visible water surface/bed with restrained runtime optics. First measure with sky reflections; compare any extra reflection/refraction pass separately. Demonstrate a small root-anchored wind test and moving normal test only after static matching. Full seasons, clouds and fish are not required to answer this first feasibility question.

### C. Measure in the real application context

Run the same harness in a browser and Windows Tauri/WebView2, then under the real translucent UI/focus surface. Record actual GPU/driver, webview/browser, WebGL capabilities, viewport and DPR. Test native 2560×1440 and representative smaller/narrow layouts; sweep DPR rather than assuming display resolution equals render resolution.

Collect cold load/transfer/decode/first-use times, shader compilation hitches, warm frame-time distributions, CPU responsiveness and available asynchronous GPU timings. Track draw calls/triangles across **all** shadow/reflection/transmission passes, texture/render-target inventories and JS heap where exposed. `renderer.info.memory` reports resource counts, **not total VRAM bytes**. Use GPU timer queries only where supported and valid; discard disjoint results. Do not label CPU `requestAnimationFrame` intervals as GPU time. [WebGLRenderer statistics](https://threejs.org/docs/pages/WebGLRenderer.html)

Compare wind off/on, shadows off/on, water extras off/on, and foreground/midground LOD variants to locate actual bottlenecks. Include UI animation/input responsiveness and sustained operation, not just a brief empty-scene FPS readout. Repeat visibility/minimize/context-loss behavior. Profile the packaged app's decoder/asset URLs as well as Vite dev mode.

### Decision gate

Proceed beyond the prototype only when the fixed hero image retains the approved meadow, stream and range character; foreground flowers remain readable; parallax exposes no gaps; and measured performance fits an explicitly agreed device/frame-time target while the productivity UI remains responsive. **No FPS, final asset-size budget or supported GPU tier is claimed by this audit.**

## What remains unknown

Actual exported topology/size; evaluated export instancing behavior with these multi-material plants; final UV/bake quality; alpha/shadow fill cost; exact Cycles-to-WebGL appearance; mobile/narrow framing quality; load/decode/VRAM use; and performance in the user's WebView2/GPU combination. These require the proposed delivery experiments and a running WebGL benchmark.

Only audit scripts, logs and reports were added. The approved Blender scene and Echelon application were not modified. No assets were downloaded, dependencies installed, conversion exported or living-world implementation started.

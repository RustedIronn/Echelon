> **Current desktop implementation:** see [PARITY_REPORT.md](PARITY_REPORT.md) and [PARITY_BENCHMARK.md](PARITY_BENCHMARK.md). The report below records the first prototype. The current default uses source-derived lighting/color, fuller meadow coverage, flower LODs, depth/Fresnel water, and static demand rendering.

# Echelon — first Blender-authored WebGL prototype

This is a **functional visual/performance prototype**, not artistic parity approval or production optimization. It runs independently of the productivity app.

## Open it

Production preview currently served at **http://127.0.0.1:4174/landscape-preview.html**.

- `?compare=1` overlays the approved Blender reference on the left, with the WebGL rendering on the right.
- `?capture=1` hides preview controls.
- `?vegetation=0` isolates static geography rendering.
- `?water=simple` replaces physical transmission with a cheaper alpha approximation for comparison.
- `?dpr=1.5` renders at higher pixel density. Default is **DPR 1**.

The Compare image is a review overlay only. The actual backdrop is 3D geometry; the reference is never mapped onto the world.

## What was preserved and transferred

The exact saved master remains:

`../alpine-composition-01/echelon_alpine_composition_01.blend`

Its SHA-256 is unchanged:

`0abcb3c95ae349e9c7831d0e8913c3d40016fc049675aa738df773b1aae25506`

The exporter opens the master in a fresh Blender process and creates temporary delivery objects **in memory**. It never calls Save on the source or creates a replacement Blender master.

- The actual 28 mm hero camera is converted to Three's Y-up coordinates. Vertical FOV is **39.7607076°** at 16:9. Regression tests independently compare projected terrain landmarks against Blender's saved matrix; horizontal and vertical NDC differences must remain below `1e-6`.
- The connected authored terrain was simplified from **3,629,860 to 580,777 triangles**. It was partitioned into near/far material regions **after** simplification so their shared boundary remains consistent. No replacement procedural mountain/stream layout was generated.
- The hamlet's actual transforms and modeled components were retained in a joined delivery mesh with an editable-source-derived color atlas. The master still contains separate buildings/components.
- The water uses the **upper faces of the existing carved-channel water volume**, including its actual elevation changes and tributary. The terrain below remains the bed. No new ribbon or straightened river was generated.
- Existing bank stones, sediment pocket placements and the approved foreground spruce were retained. Hidden background trees remain absent.
- The terrain and architecture bakes contain **surface color, not lighting**. Three.js lights, shadows, environment reflections, normals and water optics are live runtime calculations. Roughness is currently simplified; the full Blender material network is not reproduced.

## Representative vegetation

Grass uses real authored roots, headings, dimensions and material palettes, with a deterministic sample of the existing distribution. Forty-eight small blade-shape prototypes are derived from the actual curved source blades. The root/matrix representation supports later wind weights, spatial batching and seasonal controls without flattening the entire meadow into a unique static mesh.

| Authored layer | Prototype instances |
|---|---:|
| Foreground arching grass | 68,719 |
| Low basal foliage | 8,536 |
| Midground continuation | 22,340 |
| Meadow/foothill transition | 8,050 |
| **Total** | **107,645** |

This is intentionally not the complete 856,263-blade master population. Representative coverage is much thinner, especially in the distance, and the simplified ground is more exposed.

The prototype includes the evaluated original flower placements in the foreground/midground region `y < 110 m`, `-60 < x < 65 m`, rather than inventing a fresh scatter:

| Species | Instances | Delivery source triangles |
|---|---:|---:|
| Marguerites | 1,027 | 4,665 |
| Dandelions | 506 | 7,061 |
| Red Clover | 97 | 7,502 |
| Carthusian Pink | 484 | 2,004 |

The sources are still relatively detailed. Multi-material glTF primitives inherit their source species metadata; separate primitive meshes must not be mistaken for absent species. Pink cutouts were reconstructed with the source material's black-matte thresholds into genuine RGBA images. The spruce retains its original material graph and alpha channels, with delivery image derivatives.

## Actual visual review

Inspected the production captures at the saved hero view and at a narrow 760×1000 viewport, as well as geography-only and water comparisons.

**Working:** camera/landmark projection; connected mountain silhouettes; hamlet placement/scale; main leftward stream and tributary; recognizable daisies/clover/pinks in the foreground; proper cutout foliage; no source-scene or application redesign.

**Still visibly different from Blender:**

- The WebGL sky is flatter/paler and the overall response less contrasty. Three's analytic sky, normalized radiance, hemisphere light and AgX implementation are approximations to Blender's physical sky, Cycles indirect lighting and Medium High Contrast look.
- The foreground is less lush and the ground looks smoother because this is sampled vegetation with color bakes, not the complete geometry/bump/material system. Blade-library reuse and coarse/distant grass are visible limitations.
- Fine mountain normal detail and snow/rock shading are less rich. The broad silhouette is retained; the full triplanar normal/material system has not been ported.
- Water transmission is real-time, but highlights/ripple texture and bank appearance still need art direction. Thickness is currently a constant approximation, not an authored depth-field lookup. This is not a finished river shader.
- The spruce is recognizable but its cards/lighting do not match Cycles perfectly. Architectural roughness and subtle material response are simplified.
- Narrow viewports crop the fixed horizontal composition, losing the tree and much of the hamlet. A dedicated narrow framing policy is **not solved** by this prototype.

Early renders revealed a white illumination veil, omitted multi-material flowers and bad cutouts. These were diagnosed and corrected: shared `scene.environmentIntensity` governs scene IBL in this Three version, metadata belongs to glTF parent groups, and RGB source images do not become alpha-bearing merely by writing a fourth pixel component.

See `hero-physical.png`, `geography-only.png`, `narrow.png` and **`blender-webgl-comparison.png`**. These are actual browser screenshots, not edited concept images.

## Measured performance

See **BENCHMARK.md** and raw `browser-results.json`. Measurements use the production Vite preview in headless Microsoft Edge, ANGLE D3D11, **NVIDIA GeForce RTX 5050 Laptop GPU**. Each case waits through 60 warm-up frames and collects 600 RAF interval samples, with asynchronous GPU timing queries sampled every tenth frame. Invalid/disjoint GPU results are discarded.

These are short local observations, not a sustained thermal test, packaged Tauri/WebView2 benchmark, cross-device guarantee or FPS promise. RAF intervals and CPU submission duration are not labeled as GPU time. Renderer triangle/draw statistics include shadow and transmission passes. Resource counts do not measure VRAM.

The physical-water pass has a material cost: it renders opaque scene content again for transmission. The simple-water option is a diagnostic comparison, not an automatic visual replacement.

Delivered local runtime assets occupy about **65.7 MiB** including the manifest and comparison JPEG. Most cost is embedded textures and mesh data; there is no Meshopt/Draco/KTX2 delivery compression yet. Bakes/intermediate textures remain under the ignored authoring cache and are not copied into the runtime folder.

The isolated preview JS build is roughly **1.18 MB minified / 325 KB gzip**. Both production builds warn about chunks above 500 kB. This is a known optimization item, not a build failure.

## Reproduce

From the project root, using Blender 5.2.2:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python design-reference/environment/webgl-prototype/export_prototype.py
npm ci
npm test
node --test tests/environment-prototype.test.mjs
npm run lint
npm run build
npm exec -- vite build --config design-reference/environment/webgl-prototype/vite.config.mjs
npm exec -- vite preview --config design-reference/environment/webgl-prototype/vite.config.mjs --host 127.0.0.1 --port 4174
```

For a quick repeat with the same master and unchanged cached color bakes, add `-- --reuse-bakes` to the Blender command. Cache reuse checks both the master hash and individual bake hashes. A changed master triggers fresh baking. `pack_delivery.py` is called by the exporter to JPEG-compress only opaque baked albedos; alpha textures and all geometry are retained.

Browser verification is isolated from application dependencies:

```powershell
npm install --prefix design-reference/environment/webgl-prototype/browser-tools --no-save --package-lock=false playwright
$env:ECHELON_PREVIEW_URL='http://127.0.0.1:4174'
node design-reference/environment/webgl-prototype/verify-browser.mjs
```

This uses the already-installed Edge browser; it does not require a browser download. It writes the captures and measured JSON beside this document. The development server also serves the preview at `/landscape-preview.html` with `npm run dev`.

## Validation and boundaries

- Existing application suite: **203/203 passed**.
- New prototype regression checks: **4/4 passed**, covering camera projection, coordinate conversion, source provenance and parent metadata inheritance.
- Lint passed; application production build passed; isolated preview production build passed, with the chunk-size warning noted above.
- All five production-browser benchmark cases loaded without page/console/resource errors.
- Blender master hash verified unchanged after export.
- No route, auth, state, persistence, scheduling, habit, finance or Tauri integration code changed. `LandscapeEnvironment.jsx` still uses the existing app renderer. The new scene is available **only in the standalone preview** pending review.
- No wind, cloud animation, flowing water, day/night transition, seasons, moon phases or fish implemented.

The source master retains all material/habitat masks. Current runtime color bakes represent one season; future seasonal snow/ground changes require exporting those masks or additional material layers. Wind root data and authored water coordinates are retained, but complete wind rigs/flow/depth masks are not delivered yet. Nothing here requires sacrificing the authored geography to add those systems later.

## Suggested next work after review

First decide whether this preserves the approved composition closely enough. Then improve lighting/color/material parity, followed by targeted flower LODs, grass spatial batches/shadow policy and a cheaper water/depth strategy. Measure each change against screenshots. Test KTX2 and geometry compression for transfer/decode behavior, and measure in actual Tauri with the real UI before accepting a final performance budget. Do not add living-world systems to mask unresolved static look differences.

## Changed source files

- `src/app/environment/AlpinePrototype.jsx`: isolated R3F scene, runtime material adaptation, instanced vegetation and measurement instrumentation.
- `src/app/environment/alpinePrototypeData.js`: camera conversion, placement matrices, metadata lookup and static normal texture.
- `src/app/environment/landscapePreview.jsx`, `alpinePrototype.css`, `landscape-preview.html`: standalone controls, comparison and failure display.
- `tests/environment-prototype.test.mjs`: camera/placement/import regression checks.
- This directory: reproducible exporter/packer, separate preview build config, browser verification and evidence.
- `public/assets/environment/alpine-prototype/`: local ignored delivery assets and publication notice.

## Licensing / publication

Generated assets are **local and private**, ignored from source control by a folder-specific `.gitignore`. This is not a public deployment. The prototypes include Blendkit Royalty Free derivatives; they must not be treated as freely redistributable source assets.

See the source records in `../asset-auditions/botanical-lineup/ATTRIBUTION.md`, `../asset-auditions/mature-conifers/ATTRIBUTION.md`, `../asset-auditions/mountain-foundation/ASSET_SOURCES.md`, and the approved scene's `material-resources/ASSET_SOURCES.md` plus `mountain-cliff-pbr/ASSET_SOURCES.md`.

Keep the CC BY credits for Red Clover (mglnx), Carthusian Pink (plantuz), and Norway Spruce (Georgeous), including links/license and the changes made here. Dandelion/Poly Haven, Terrain 002/ambientCG and the documented cliff resources are CC0. Marguerites and the three Blendkit ground materials retain their distinct Royalty Free restrictions. Resolve web distribution rights before publishing assets; compression is not a licensing workaround.

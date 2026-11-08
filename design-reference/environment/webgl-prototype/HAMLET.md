# Hamlet comfort / settlement redesign — 8 November 2026

## Design and review

The chapel is the anchor of a small shared green. Two cottages occupy its left side; the farmhouse, service wing and timber barn form a quieter working group behind/right. The six buildings share limestone/buff plaster, weathered timber and muted slate, with different heights, setbacks and orientations. The chapel has a square belfry and modest slate cap instead of the previous very tall needle.

The old independent dark road ribbons have been removed. One bent rural lane runs past the settlement and connects every entrance through smaller spurs. Rounded junctions, gravel shoulders and a less-worn centre are blended into the actual terrain material. Paths share the same coordinate data with grass clearings. Boundary walls and fences are partial rather than complete rectangular enclosures; all intersecting routes open gates through them.

Windows and doors have real wall openings, recessed glazing and reveals. Masonry footings extend into the delivered ground heights, including the chapel tower and farmhouse wing. The old oversized podiums, flagpole, repeated hedge blobs and showpiece chalet additions were removed. A porch, chimneys, benches and a restrained working-yard fence suggest daily use without adding a new prop library.

Yards retain short grass. Only footprints and worn lanes are bare; the local grass becomes shorter near maintained edges. The former broad approach is allowed to grow back into meadow. No general meadow design, weather, time-of-day, mist, water, mountains, camera or application logic was changed. The relief-protection bounds are explicitly retained independently of the new local clearing so this redesign cannot reshape the valley.

I rejected the trial alder: the existing model's sparse crown did not provide the desired shelter at this camera distance. The private test files are archived in the checkpoint, with the original source unchanged. No new external assets or runtime asset dependencies were adopted.

## Actual visual evidence

- `hamlet-comfort/before.png`, `after.png`: identical 2560×1440 hero framing.
- `hamlet-comfort/before-hamlet.png`, `after-hamlet.png`: unrescaled 850×330 image crops.
- `hamlet-comfort/comparison.png`: labelled side-by-side crops.
- `hamlet-comfort/before-metrics.json`, `after-metrics.json`: browser measurements, renderer identity and empty error lists.

The chapel is no longer obscured by a front cottage. The lane reads as shared settlement ground and the materials form a more coherent family. Buildings remain restrained/simplified at this distance: this is a first settlement layout/atmosphere pass for artistic review, not a claim of finished heritage architecture. Ground wear and garden character are subtle in the full frame. The lack of a convincing leafy shelter tree remains a potential later improvement; a poor tree was not retained just to add greenery.

## Reproducible implementation

- `src/app/environment/hamletLayout.js`: six building records, entrance coordinates, shared lane/access network, yards and soft maintenance clearings; stable original terrain-protection bounds.
- `hamletGeometry.js`: pure heightfield-grounded architecture, cut apertures, footings, low boundaries and benches, grouped into eight material meshes.
- `hamletGround.js`: local 456×460 RGBA data mask, terrain-aligned gravel/tended-ground treatment, reversible shader hooks.
- `hamletTextures.js`: small authored neutral plaster, slate, timber and rubble textures.
- `Hamlet.jsx`: component/resource lifecycle and local terrain attachment.
- `AlpinePrototype.jsx`: supplies terrain to the hamlet, keeps the old relief protection and shortens only locally tended grass.
- `tests/environment-prototype.test.mjs`: route connectivity, clear entrances, no roads through buildings, retained living yards and stable relief protection.

The pre-change checkpoint is `design-reference/environment/checkpoints/2026-11-08-before-hamlet-comfort/`, including the original files and SHA256 manifest. Blender master remains untouched at SHA256 `0abcb3c95ae349e9c7831d0e8913c3d40016fc049675aa738df773b1aae25506`.

Build the isolated preview:

```powershell
npx vite build --config design-reference/environment/webgl-prototype/vite.config.mjs --outDir dist/hamlet-comfort
npx vite preview --config design-reference/environment/webgl-prototype/vite.config.mjs --outDir dist/hamlet-comfort --host 127.0.0.1 --port 5193
```

Open `/landscape-preview.html?capture=1` for the approved static lighting/view. `?hamlet=blockout` still supports neutral massing review. The private local capture harness is `hamlet-comfort/capture.mjs`; it uses the existing browser-tools installation. The read-only `baseline.config.mjs` loads the checkpoint module source for an exact before comparison without reverting the working files.

## Measurements

RTX 5050 Laptop GPU, Edge/ANGLE D3D11, 2560×1440, DPR1, four actual MSAA samples, 600 frame samples after warmup, separate sequential runs. Before uses the checkpoint; after uses the production preview. These short runs demonstrate approximate cost, not an exhaustive benchmark or a significant speed claim.

| Measurement | Before | After |
|---|---:|---:|
| Median GPU time | 19.04 ms | 19.28 ms |
| GPU P95 | 20.98 ms | 21.30 ms |
| CPU submit median | 1.70 ms | 1.60 ms |
| All-pass draw calls | 220 | 217 |
| All-pass triangles | 32,881,222 | 33,648,909 |
| Active texture resources | 45 | 44 |
| Shader programs | 22 | 22 |

Hamlet architecture itself decreased from 19,527 to 5,420 triangles and 11 to 8 material meshes. Total scene triangles rise because grass regrows on the removed broad approach; those are local settlement-clearance changes, not a redesign of the meadow generator. The ground mask adds 839,040 bytes (~0.80 MiB) of linear RGBA texel storage; total VRAM was not measured. No high-resolution textures or additional downloaded models were added.

## Verification

- `npm test`: existing 203 application tests pass.
- Environment/habitat/community suites: 63 pass, including two new settlement checks.
- Changed environment-file ESLint: clean.
- Full lint: three existing errors in untouched `GeneratedSky.jsx` (hook immutability) and `tuftGroup.js` (two unused parameters); left outside this pass.
- Application production build and isolated prototype production build: pass. Prototype retains its existing large-chunk advisory.
- Production hero WebGL inspected at desktop scale, no browser/shader errors. Route samples checked for intersections with building footprints. Blender master hash verified unchanged.
- No commits or pushes made by this pass.

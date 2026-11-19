# Valley composition 01

A new landscape built in Blender: the new valley's land (lake, river, the hamlet's shoulder, the valley sides) wearing the approved scene's
skin (its terrain material, grass, flowers, trees, sky and sun), with the approved range scaled up to close the valley. Judged by renders of
the hero frame; nothing here touches the approved master (`alpine-composition-01/echelon_alpine_composition_01.blend`), which is only read.

The working folder is `D:\Projects\Echelon\design-reference\environment\valley-composition-01` (the `.blend` files, the exported hamlet and
the renders are large and stay local). These scripts rebuild everything from the bakes:

1. `tools/bakenear.mjs`, `tools/bakefar.mjs` (run from `webgl-prototype/perf/`, with the valley page served on 127.0.0.1:4197) bake the
   valley's heights into `public/assets/environment/alpine-prototype/` (`near-heights`, `valley-far`); `tools/exportvalley.mjs` exports
   its hamlet (`valley-hamlet.glb`) and layout (`valley-layout.json`).
2. `extract_assets.py`, `extract_range.py`, `extract_stones.py` read the master (never saving it) and write `valley-assets.blend` (grass
   patches cut from the approved meadow layers, the plants), `valley-range.blend` (the range, scaled 12x and lifted 1.6x) and
   `valley-stones.blend`. Run each with `blender --background --factory-startup --disable-autoexec <master> --python <script>`.
3. `run_all.sh` builds `valley_composition_01.blend` step by step - land, skin (the master's terrain material driven by attributes computed
   from slope, height and water), grass, forest, range and river, river dressing, flowers, hamlet, air - each step saving and rendering a
   check frame into `renders/`. `common.py` holds the river's course (traced from the user's line on the hero frame).

State (Nov 2026): first pass. Flowers are a first drift layout; bank cobbles were taken out until there are good rock models; the stream
was rebuilt to read like a glacial river (ref: the Lonza). Not yet exported back to WebGL.

# Look-dev panel

Open `http://127.0.0.1:4174/landscape-preview.html` (without `capture=1`). A panel appears on the right.

- **Defaults are the approved look.** Every slider at its default reproduces the approved capture pixel-for-pixel (verified: whole-frame difference 0 for the default and for `waterpass=approved`; "Reset all" returns to the identical frame).
- **Hold H** (or the "Hold: approved" button) to flash the approved look while you compare; release to return to your settings. **L** hides or shows the panel.
- **Double-click a slider** to reset just that one. Changed sliders turn yellow.
- **Copy settings** copies only the values that differ from approved (JSON). **Copy link** copies a URL with `?ld=hamlet:1.4,waterMurk:0.5` that reproduces the look, including in `capture=1` screenshots.
- Edits are applied live to the running scene: no rebuild and no shader recompile. Water reflection and bed captures refresh about a quarter of a second after you stop dragging.

| Group | Control | What it does |
|---|---|---|
| Light | Exposure | Overall brightness before the display transform |
| | Sun strength | Direct light and shadow contrast |
| | Sky light | Fill light from the sky (the blue in the shade); the sky itself is unchanged |
| | Haze | Distance haze toward the horizon |
| Scene | Hamlet brightness | Houses only |
| | Mountains and far hills | Terrain beyond the meadow |
| | Meadow ground | Soil and bank under the grass |
| Vegetation | Near grass | Foreground and low basal grass |
| | Mid and far grass | The strip layers (assumes the default strip shading) |
| | Flower brightness | All flowers |
| Water | Reflection strength | Weight of the reflection (refined water only) |
| | Reflection sharpness | Lower is sharper, higher is softer |
| | Murkiness | 0 is glass-clear, higher hides the bed |
| | Ripple strength | Surface relief that breaks up reflections |
| | Wet bank | Darkness of the soil beside the water |

Controls that scale colour (hamlet, mountains, ground, grass, flowers) multiply the original material colour, so 1.0 is always "as approved".
The sliders only tune what already exists; they add no geometry, vegetation or lights. Files: `lookDev.js`, `LookDevPanel.jsx`, and the `LookDevBridge` in `AlpinePrototype.jsx`.

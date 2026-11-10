# Echelon world redesign: the plan

Written 2026-11-10, ready for the session after the weekly reset (Wednesday 08:30). Claude owns this foundation work; Codex owns refinement and the UI.

## Why

If we designed the world today, we would not build the current landscape. Its problems come from the foundations, not from how they were executed:

- The British hamlet sits in front of Alpine peaks.
- The mountains are 90 m humps that read as a range, so nothing can grow on them.
- The camera faces south, so the sun is in front and the hamlet is backlit all day.
- The meadow is a carpet with no land use.
- Nothing in the scene changes with the seasons.
- The detailed foreground sits exactly where the UI goes.

We keep:

- **The fixed hero camera.** One frame can be perfect.
- **A stream winding to a hamlet with a chapel.**
- **The systems:** time of day, sun and moon, sky and clouds, water, TAA, the viewer.

## Rules for every step

1. **Judge against real photos and game references, side by side at the same angle and light.** Never judge only against our previous frame.
2. **Add one thing at a time.** It stays behind a flag until approved, and each step gets a before/after at 1864×727 and 16:9.
3. **Directed detail.** Rich, hand-placed detail at the focal points; calm masses elsewhere; scanned assets over procedural stand-ins.
4. **The world and the UI are designed together.** The UI floats in the world's calm zones and stays clear of the hamlet and the sun.
5. **Work in worktrees.** Merge only on the user's yes, never push without a yes, no attribution lines.

## Before Wednesday (the user, no tokens)

Collect 10–20 images into `design-reference/world-redesign/refs/`, named `real-*`, `game-*` and `ui-*`:

- **Real places:** Yorkshire Dales hay meadows (Swaledale in June); Lake District and Snowdonia valleys with drystone walls, a chapel or farm, and fells behind; the same kind of view in autumn and winter if you can. Prefer a low camera height, like ours.
- **Games:** Valhalla's England (the closest to our setting), Far Cry 5's valleys, Odyssey's hillsides. Pick moments where the grass and land look rich but not busy.
- **UI:** any floating-card or HUD-over-world interfaces you like.

Answer these in a line each. "Not sure" is fine; we'll decide with frames.

1. **Place:** Lake District/Snowdonia (it suits our hamlet), or a true Alpine valley?
2. **Seasons:** all four, including real winter snow, or spring to autumn first?
3. **Sun:** side light most of the day with sunset in frame, or the sun visible through the day?
4. **How much the world shows behind the UI:** how big the calm zones are, and where you see the floating cards.
5. **The current scene:** anything in it that must survive no matter what?

## Session 1: the world on paper (small budget)

Output: `docs/WORLD-SPEC.md` and a top-down valley map (SVG). Its sections:

| Section | What it decides |
|---|---|
| Place and identity | geology, architecture, materials, people, history in two lines |
| Orientation | where the camera looks; the sun's path by season and when it is in frame |
| Scale layers, at true size | foreground (0–40 m, hero detail), middle ground (40–600 m, fields, walls, hamlet, trees), backdrop (fells or mountains, km scale, painted or simplified terrain) |
| Frame composition | where the focal points sit, where the calm zones are for floating UI, the eye path |
| Land use | fields and walls, hay meadow vs pasture, wet ground by the stream, lane and tracks, gateways, the hamlet's footprint |
| Plants by condition | each zone gets its species mix (grasses, flowers, rushes, bracken, deciduous trees, conifers) and how it changes through the year |
| Seasons | what leads each season and what changes, per zone |
| Assets | named candidates from Poly Haven (CC0), BlendKit and Quixel: ground, grass and plant scans, wall stone, trees; licence noted for each |
| Reuse | which current systems and assets carry over unchanged, which change, which go |

## Session 2: mood frames and the decision

- **Two or three blockout frames** in WebGL using the existing sky, light and time systems: grey-box terrain at true scale, colour masses for the land use, the hamlet placed, the camera turned to the new orientation. They are not detailed; they test composition, light and scale.
- **Each frame at two moods** (afternoon and evening) with a mock of the floating UI over it, next to the reference photos and the current scene.
- **The decision:** evolve this valley (keep its terrain, add land use and plants) or start a new valley.

## Sessions 3 and on: the build (one step per session, each approved before the next)

1. **Terrain and layers** at true scale: foreground sculpt, middle-ground fields, backdrop range. Camera and composition locked.
2. **Land use:** drystone walls along the slope, gateways, the lane and tracks, wet ground. Walls are the strongest single element.
3. **Ground:** a scanned terrain material that lets soil, stones and dead matter show through.
4. **Grass rebuilt from scans:** a few species mixed in patches, seed heads and thatch, clumps; fewer blades, more kinds; the far meadow muted and warm.
5. **Flowers and plants by condition** (buttercups in damp hollows, rushes by water, bracken on slopes); no painted bands.
6. **Trees:** deciduous at the field edges and by the stream, conifers where they belong.
7. **Seasons:** each zone's plants change on their own clock, with a season scrubber in the viewer.
8. **Hand-off to Codex** for refinement, and for the world integration in `docs/UI-REDESIGN-BRIEF.md`, updated for floating cards.

## Spending the budget well

- Each session has one goal and ends committed.
- Use the capture scripts in `design-reference/environment/webgl-prototype/perf/`; read crops, not full dumps.
- Build sheets with the PowerShell compositor, one per review.
- Avoid repeated full builds; batch edits before capturing.
- Keep long conversations of options for the paper session, where they are cheap.

## Starting state (2026-11-10)

- **Main** is at f6257ad: round birds, tree placement behind `?copses=on`, far-flower fix, and the UI brief. Not pushed.
- **This plan** is committed on the `worktree-perf-pass` worktree branch; it reaches main only when merged.
- **Preview:** main's dev server on 4174 (`.claude/launch.json` "echelon-landscape-live").
- **Model files are gitignored.** `larch.glb` is copied into main's assets.

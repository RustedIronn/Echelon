# Echelon world spec: the valley

Version 1, 2026-11-11. This is the paper design: it is built backwards from one frame, and nothing here is built yet.

- **Owners:** Claude builds the foundations, Codex refines afterwards.
- **Inputs:** the user's answers and references (`design-reference/world-redesign/refs/`) and `docs/WORLD-REDESIGN-PLAN.md`.
- **Map:** `docs/world-map.svg`.

## 1. The place

The valley is invented, somewhere between the Dolomites and the Swiss Alps.

- **The setting:** a high, open valley at about 1,500 m. Snow peaks and a glacier stand at its head. Spruce and larch forest climbs the slopes, and the valley floor is meadow, kept open by centuries of mowing and grazing.
- **The water:** a milky turquoise glacial river runs over grey stone bars and fills a small still lake at our feet.
- **The people:** families have farmed the valley for generations, in two settlements. A working group sits by the water (mill, farm, barn, bridge, jetty). An older group stands on a sunny terrace above the flood line (chapel, houses, an inn). Hay huts are scattered across the meadows between them.
- **Materials:** grey limestone and granite, larch timber gone silver-brown, stone and shingle roofs, whitewashed chapel walls.
- **The feeling:** a real place you could walk into on any day, at any hour and in any weather, where an ordinary moment is worth a screenshot. It lives on its own and does not perform for the user.

**What the references say:**

| Element | References |
|---|---|
| Peaks and glacier | 11, 13, 28, 29, 31 |
| River | 4, 12 |
| Huts | 5, 14, 28 |
| Backlit meadows | 1, 2, 9, 21, 22 |
| Autumn gold | 4, 13 |
| Mist | 10, 32 |
| Lone hero trees | 5, 21 |

## 2. The frame (everything serves this)

**The window:**
- The primary frame is 2.56:1 (the user's 1864×727 window).
- 16:9 must also work: it shows more sky and ground, and any side cropping must not lose a focal point.
- 4:3 and 16:10 are kept safe by the overlay.

**The camera:**
- It stands on a meadow knoll about 8 m above the lake surface (eye height 1.7 m on top of the knoll).
- It looks roughly south, tilted down 3–5°, with a vertical field of view of about 32°. The FOV and tilt are tuned in the blockout.
- It never moves, apart from optional gentle pointer parallax (at most about 0.3° of yaw and pitch, eased). Focus mode keeps it still.

**Composition** (x is measured from the left edge as a fraction of the 2.56 frame; y from the top):

| Element | Where in frame | Role |
|---|---|---|
| Horizon of the valley floor | y ≈ 0.55 | sky about the upper half, land the lower half |
| Main peak and glacier | x ≈ 0.58–0.72, top at y ≈ 0.12 | the landmark; the sun's noon arc passes above and just left of it |
| Sunrise pass (left) | x ≈ 0.12–0.2, notch at y ≈ 0.42 | the sun and moon rise through it |
| Sunset saddle (right) | x ≈ 0.86–0.94, notch at y ≈ 0.40 | the sun and moon set into it |
| Upper hamlet, chapel tower | x ≈ 0.66, y ≈ 0.50 | the human landmark, against forest and backlit by evening |
| Lower hamlet, mill | x ≈ 0.52, y ≈ 0.58 | the eye's first stop after the water |
| River | enters at the right edge, x ≈ 0.95, y ≈ 0.60; S-curves left across the floor; reaches the lake at x ≈ 0.42, y ≈ 0.70 | leads the eye from the peaks to the viewer |
| Lake | x ≈ 0.0–0.42, y ≈ 0.66–0.86 | **calm zone 1** |
| Upper-left sky | x ≈ 0.0–0.38, y ≈ 0.05–0.40 | **calm zone 2**, clear of the sun's path except at sunrise |
| Foreground flowers | the bottom edge, y > 0.88 | **calm zone 3** (soft focus); detail only centre-right |
| Hay huts | x ≈ 0.45–0.85, scattered on the floor | scale cues, never more than 2 or 3 visible |

**UI zones:** floating cards rest over the lake, the upper-left sky and the soft bottom edge. Nothing may cover the main peak, the sun's path, the chapel or the mill.

**The overlay:** `docs/world-frame-overlay.svg` (made in the blockout session) marks thirds, zones, focal points and the sun and moon tracks. Every capture is checked against it.

## 3. Light: the sun and moon in frame

- **The rule:** the sun and moon must be visible ("how can we look at his radiance"). The look is shot into the light: glowing grass edges, silhouettes, haze.
- **The composed sun:**
  - Times are true: sunrise, sunset and day length follow the real date for about 46.5° N.
  - Positions are composed. The sun rises through the left pass, arcs over the sky band above and left of the main peak, and sets into the right saddle.
  - The arc's height and its rise and set points shift with the season: low and short in winter, higher and longer in summer. It always stays in frame (this extends the current `FRONT_SUN_ARC` approach).
- **The moon** uses the same openings and its real phase. A full moon rising through the pass while the lake reflects it is a signature moment.
- **The reflection:** the lake doubles the sunrise, sunset and moon. This is one reason the lake sits left: the rise is mirrored.
- **Key lighting is backlight.** The hamlet must read in backlight. Warm windows, smoke and pale chapel walls catch rim light, and the buildings sit against darker forest so their edges glow.

## 4. Scale layers (true size)

| Layer | Distance | Contents | Detail approach |
|---|---|---|---|
| Foreground | 0–60 m | knoll, flowers, rocks, the lake's near shore, reeds | hero assets placed by hand, scanned plants, full geometry |
| Near ground | 60–400 m | lake far shore, river mouth, lower hamlet, nearest hay huts, a lone tree | scanned assets, instancing, light LOD |
| Valley floor | 400–1,500 m | river with stone bars, meadows, upper hamlet on its terrace, forest edges | instanced plants with colour driven by land use; tree impostors from about 800 m |
| Slopes | 1–5 km | spruce and larch forest, treeline (about 2,100 m altitude), scree, avalanche paths, high pastures | tree impostor cards plus terrain material; no individual models |
| Backdrop | 5–15 km | peaks of 3,000–3,300 m, glacier, snowfields | real elevation data (for example Copernicus GLO-30, reshaped), rock and snow material, aerial perspective |

- **Relief:** valley floor about 1,500 m, peaks up to about 3,300 m. At 8 km the main peak stands about 12° above the floor, which reads as a real range with no forced perspective.
- **Sizes:**

  | Feature | Size |
  |---|---|
  | Lake | about 160 × 90 m; near shore 15–20 m from the camera |
  | River | 6–15 m wide, stone bars up to 60 m |
  | Valley floor | about 1.2 km wide |
  | Lower hamlet | 250–350 m away |
  | Upper hamlet | 600–800 m away, 40–60 m above the floor |

## 5. Water

- **The river (glacial):**
  - Milky turquoise from glacial flour, clearer in late autumn and winter.
  - It braids over grey stone bars and has riffles with foam (the existing foam and flow systems are reused).
  - It is loud and high in the spring melt, low and clear in autumn, and edged with ice in winter.
- **The lake:**
  - Still and mirror-like, rippled by wind gusts, rising fish and rain.
  - The near shore has reeds, a few stones and a wooden jetty belonging to the lower hamlet.
  - Mist lies on it on cold mornings. In winter it freezes, with snow lying on the ice except near the inlet.
- **The flow** runs from the right of the frame to the left and pools into the lake. The outflow leaves the frame at bottom left, out of sight.

## 6. The hamlet

Claude designs it; Codex's British hamlet is retired, but its procedural methods are reused.

- **The lower group: the working settlement.** It sits on the meadow between the river and the lake.
  - Buildings: a small watermill or sawmill on the river with a wheel or chute, a farmhouse, a barn with a hay loft and a stall.
  - Around them: a timber footbridge, the jetty, firewood stacks, a fenced kitchen garden, a bench by a door.
- **The upper group: the old heart.** It stands on a terrace above the flood line, against the forest edge.
  - The chapel with its bell tower is the landmark. Around it are 4–5 stone-and-timber houses and a small inn.
  - A lime or maple stands by the chapel.
- **Hay huts:** 4–6 across the meadows and slopes, with no more than 2 or 3 prominent in frame.
- **The track** climbs from the mill to the chapel and is worn by use. A side path leads to the huts.
- **Lights** follow the dark, never the user. Windows light at dusk one by one, house by house on their own schedules, and go out late. The chapel bell strikes the hour.
- **Architecture:** stone ground floors, larch timber upper floors and balconies, shallow roofs of stone slab or shingle with deep eaves, whitewashed chapel. Everything is weathered by generations of use.

## 7. Land and plants by condition

| Zone | Ground | Plants | Character |
|---|---|---|---|
| Knoll (foreground) | thin, dry soil with rocks breaking through | short fescues, thyme, pinks, harebells, alpine aster, grasses in seed | rich and varied, with the hand-placed hero flowers |
| Lake shore | wet | reeds and sedges, marsh marigold, cotton grass, meadowsweet | soft verticals, mirrored in the water |
| Hay meadows | deep soil, mown once a year in July | mixed tall grasses with seed heads, buttercups, globeflower, clover, knapweed, ox-eye daisy | flowers by condition: buttercups in damp hollows, daisies on drier ground; never stripes |
| Grazed pasture | short turf, cattle tracks | short grass, clover, plantain, thistles left by the cows, dung, worn patches | low, darker, textured |
| Riverbank | stone bars, sand | willow scrub, grey alder, fireweed, scattered larch seedlings | the river's frame |
| Forest edge | needle litter | spruce and larch, bilberry, ferns, rowan | the dark backdrop for the hamlet's rim light |
| Slopes | | forest belts, avalanche paths of green alder, larch thinning toward the treeline | |
| High ground | | scree, snow patches, rock | |
| Lone trees | | one great larch or sycamore in the meadow (a hero tree, refs 5, 21), the lime by the chapel | |

**Rule:** grass is built from scanned species, mixed in patches with seed heads and dead matter at the base, with soil and stones showing through. Colour comes from land use and conditions, never from saturation.

## 8. Seasons (every zone changes on its own clock)

| | Spring (Mar–May) | Summer (Jun–Aug) | Autumn (Sep–Nov) | Winter (Dec–Feb) |
|---|---|---|---|---|
| Lead | snowmelt and first green | full bloom | **larch gold** (the signature) | snow and stillness |
| Meadows | snow patches retreating, crocus and soldanella, fresh lime green | tall flowers; the hay is cut in July, then stubble and regrowth | tawny, seed heads, a second flush of autumn crocus | under snow, with tracks |
| Trees | larch soft green, alder catkins | deep green | larch gold to orange, rowan berries | larch bare and grey, spruce snow-laden |
| Water | river high, loud, milky; lake full | milky, lively | clear, low, calm; mist on the lake | ice at the edges, lake frozen and snowed over, the inlet open and steaming |
| Peaks | heavy snow down to the forest | snow on the peaks and glacier only | first snow dusting the tops | snow down to the floor |
| Life | lambs, cows coming out, fishing | cows high on the summer pasture, haymaking | cows coming down (the cattle drive), rutting calls | animals in barns, steam at the stalls, smoke from every chimney |

## 9. Weather (designed in from the start, built later)

- **States:** clear, fair-weather cumulus, overcast, valley mist and inversion, showers, thunderstorm over the peaks, snowfall, wind.
- **Character:** clouds catch on the peaks and build on summer afternoons from the west (the right). Mist pools over the lake and river on cold, still mornings.
- **How it changes:** weather comes from a slow seeded process (days, not minutes) and follows the seasons. It is never a random flip.

## 10. Life (real calendars, never reacting to the user)

| Life | Behaviour |
|---|---|
| Cows (all year) | Graze near in spring and autumn, small and high on the slopes in summer, in the barn in winter. Bells drift with their position. |
| Sheep | On the steeper ground; lambs in spring. |
| Birds | Dawn chorus, swallows over the meadow in summer, choughs by the peaks, a buzzard soaring, an owl at night. |
| Butterflies and insects | Warm sunny hours in the meadow, by season. |
| Fish | Rising rings on the lake at dusk; shadows in the clear river shallows in autumn. |
| Signs of people | Chimney smoke by season and hour, lamplight, laundry, haymaking marks, tracks in the snow. |
| People (after the scene is finished) | Small silhouettes, never the focus: fishing in spring, tending cattle in summer, the cattle drive in autumn, a bonfire in winter. |

## 11. Sound (Web Audio, stereo-placed to match the frame)

- **Always:**
  - The river, from the right; its level follows the season and melt.
  - The lake lapping, left and soft.
  - Wind in grass and larch, following the wind system.
- **By the hour:** dawn chorus, daytime birds, crickets at dusk, an owl and the hush at night, the chapel bell on the hour (far off, from the upper group).
- **By the season:** cowbells from wherever the cows are; lambs in spring; haymaking in summer; rutting calls in autumn; muffled stillness in winter.
- **Weather:** rain on leaves and water, distant thunder, the hiss of snowfall.
- **Sources:** cleanly licensed recordings (Freesound CC0 and similar), with the licence logged per file.
- **Behaviour:** muted until the user enables it; one quiet toggle; a focus-friendly level. The user's ears are the judge of every layer.

## 12. Acknowledgements (tiny, rare, deniable)

The world only tilts the odds of things that happen anyway:

- **A task done:** one distant cowbell, a single bird song, or a fish rising.
- **A focus session ends:** the wind drops for a moment and the grass settles.
- **The day's plan is complete:** a shooting star at night, or a breeze through the larch by day.
- **Streaks:** nothing. Some things stay private.

## 13. What is reused

Methods and systems:
- time of day, the composed sun, moon phase and stars, sky and clouds, cloud shadows
- water flow, foam and reflection
- TAA, the optics, the viewer
- capture and compare tooling
- wind, flower and plant instancing, small life (birds and butterflies)
- the procedural building and weathering methods, window lighting
- the copse instancing, which becomes the forest impostor system

Assets: the Norway spruce and the larch fit the valley exactly.

Retired: the current terrain, meadow layout and grass set, the British hamlet's architecture, and the forced-perspective mountains.

## 14. Assets to source

| Category | Candidates |
|---|---|
| Elevation data | Copernicus GLO-30 for the backdrop range (a real Alpine tile, reshaped) |
| Ground and rock | scans from Poly Haven (CC0) |
| Plants | Quixel Megascans and BlendKit (licences checked per asset) |
| Trees | spruce and larch (have); grey alder, rowan, sycamore or lime to find |
| Buildings | built procedurally, with textures from Poly Haven |
| Sound | Freesound CC0 |

Log every source in an `ATTRIBUTION.md` beside the assets.

## 15. Performance

- **Target:** about 8–10 ms GPU per frame at the user's window on an RTX 5050, with headroom for weather and life.
- **While the user works:** the world drops to a reduced rate while typing or scrolling, pauses when the tab is hidden, and renders at full rate when idle.
- **The approach:** detail is spent where the frame looks. Forests are impostors, and distant layers are simplified. The lake's reflection may be planar, at reduced resolution.

## 16. Build order

Each step stays behind a flag until approved, gets a before/after against the references at 2.56:1 and 16:9, and is judged against photos.

1. **Frame and blockout.** The overlay, grey-box terrain at true scale, colour masses for zones, water shapes, hamlet blocks, the composed sun arc through the pass and saddle. Lock the composition at dawn, noon, dusk and night.
2. **Backdrop terrain** from elevation data; rock and snow material; aerial perspective.
3. **Water:** river course with stone bars, the lake and its reflection.
4. **Ground and land use:** scanned ground, meadows, pasture, shore, track.
5. **Grass and plants by condition**, from scans.
6. **Forest:** impostor belts, edges, lone trees.
7. **The hamlet:** lower group, then upper group, then huts.
8. **Seasons**, zone by zone.
9. **Weather.**
10. **Life**, by the calendar.
11. **Sound.**
12. **Acknowledgements, parallax, and the hand-off to Codex** for refinement and UI integration with floating cards.

## 17. How it is judged

- Next to the user's references at the same light, does it feel like a real place you could walk into?
- Is any random moment (hour, season, weather) worth a screenshot?
- Do the calm zones hold floating cards without either side fighting the other?
- Is the sun, or the moon, in frame and glorious?
- Nothing looks repeated or artificial at a glance. Detail is meaningful, not mass.

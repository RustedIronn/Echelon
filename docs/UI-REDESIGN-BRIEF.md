# UI redesign and world integration: brief

Status (2026-11-09): agreed in discussion and not started. The user has handed the UI to Codex. The world (`src/app/environment/AlpinePrototype.jsx` and the modules beside it) is approved art; treat it as fixed.

## Goal

Echelon becomes an app designed around its world. The meadow, stream, hamlet and sky are the canvas, and the UI is a few calm objects resting on it. The world supports the UI and never competes with it, and text is always readable. The user judges by eye in their own window, about 1864×727 (aspect 2.56), as well as 16:9.

## Current state

- `src/app/layout/Layout.jsx` mounts `LandscapeEnvironment`, which still renders the **old** `ThreeLandscapeWorld.jsx` (an early simple scene). The new world exists only in the standalone preview (`landscape-preview.html`).
- `.app-main` has a white gradient wash (70% → 30%) in `environment.css`. It flattens the scene; remove it.
- The sidebar is 15rem on the left and covers the foreground spruce. The font is Arial everywhere.
- The world's assets are about 163 MB in `public/assets/environment/alpine-prototype/`. Model files are gitignored. `larch.glb` must be copied in by hand from `design-reference/environment/asset-auditions/mature-conifers/incoming/larch_tree.glb` (Georgeous, CC BY 4.0).

## World integration (technical)

1. Swap `ThreeLandscapeWorld` for the new world in a production mode: no look-dev panel and no viewer bar, live clock by default, small life on. Keep the error boundary and the gradient fallback; fade the world in once its first frame has rendered.
2. Frame for the UI with a lens shift (`camera.setViewOffset`), not by moving the camera. The approved composition stays intact and only slides, so the hamlet, mountains and sun land in the part of the window that is not covered by UI.
3. Render budget: full rate when idle, a lower rate while scrolling or typing, paused when the tab is hidden (the visibility handling exists). The world must never make the app feel slow.
4. Expose the time-of-day mood (`timeOfDay.js`: `mood` and the evening/night factors) to the UI as CSS custom properties, so the UI's tint follows the light.

## Design direction (proposed; mock it up before building)

- **Places, not eight sections:**

  | Place | What it holds |
  |---|---|
  | Today | mission, next up, focus |
  | Plan | planner, notes, calendar, schedule |
  | Body | habits, workouts |
  | Money | as it is |
  | Reflect | daily review, composure, insights |

  Settings moves into a quiet menu. Stores, data and features stay; only presentation changes.
- **Navigation:** a slim icon rail that widens on hover, or a small floating dock plus a command bar (Ctrl+K). Keep the left third for UI and leave the sky, sun and hamlet (centre-right) clear.
- **Surfaces:** frosted glass (strong blur, tint that follows the time of day, thin bright edge, soft shadow). Text always sits on glass, never directly on the scene.
- **Less on screen:** Today shows one hero card (the current mission) and a small Next Up card. Timeline and summaries go in a drawer or a second scroll section.
- **The light drives the theme:**

  | Time | Glass | Text |
  |---|---|---|
  | Morning | cool, clear | dark slate |
  | Afternoon | neutral | as now |
  | Evening | warm amber | accents warm |
  | Night | dark smoked | soft light |

  There is no manual light/dark switch.
- **Type:** a humanist sans for the UI (for example Inter or Source Sans). A quiet serif could be used for big moments only (mission title, date).
- **World per place:**

  | Places | World |
  |---|---|
  | Today, Focus, Habits | full scene |
  | Plan, Calendar, Workouts | softly dimmed |
  | Money, Insights, Settings | blurred to a backdrop, near-solid glass so charts read |

  The camera never moves between places; only blur and dim fade.
- **Moments:**
  - Focus: the UI fades to the timer and mission, with gentle pointer parallax.
  - Dusk: a "Review the day" card appears when the hamlet's windows light.
  - Scenic mode: one key hides all UI.
  - The world does not react to every checkbox. Keep it calm, not gamified.

## Process

1. Three concept directions for Today, as static mockups over real captures of the scene (afternoon and night) at 1864×727:
   - "Window": glass cards on the left.
   - "Field journal": paper-like panels and a serif.
   - "Almost nothing": a dock and one floating mission line.
2. The user picks one; then mock up the other places in that direction.
3. Build the design system (tokens, glass, type, motion), then rebuild the pages one at a time, each checked in the user's window before the next. The world goes in with the first page.

Open questions for the user: sidebar rail versus glass sidebar; Today density; whether to move off Arial and whether a serif is allowed; how dark night should be; whether the world is blurred on the data pages.

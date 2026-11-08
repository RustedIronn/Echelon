# Integration fixes after Claude's 76d2f42

This pass preserves the current lighting, wind field, cloud-shadow shader, scene composition and materials. It addresses only the reviewed integration regressions.

- Added `haze` and `toe` to live mood interpolation. Live mode no longer passes NaN fog density or an undefined grading uniform to rendering.
- Added shared activity/visibility state. The live clock skips hidden/obscured work, resumes with current lighting, and deferred sky/reflection callbacks check visibility. Wind stops scheduling RAF callbacks while paused instead of polling continuously. Host controls retain their existing scenic/work/obscured API.
- Restored `receiveShadow` on authored flower instances; its assignment had accidentally become part of a comment. Casting/LOD policy is unchanged.
- Split the unchanged cloud-shadow material hook/state into a plain JS module and moved target/diagnostic attachment into an effect with cleanup. This resolves the four cloud-shadow ESLint errors and missing-dependency warning without changing GLSL or shadow strength.

## Actual validation

The fixed-date, fixed-camera before/after check used Edge/ANGLE on RTX 5050 at 2560x1440, 14:00 on 21 June 2026, wind disabled for a stable comparison. Captures and runtime results remain local under `integration-fixes/`.

- Live fog and toe values are finite.
- All 20 authored flower instance meshes receive shadows.
- Obscured live mode: frame count remained 19 during the 3.2-second check; sky/reflection capture counts also stayed unchanged.
- Simulated hidden-document state: frame count remained 69 during the 3-second check.
- Work/scenic modes resumed correctly, including immediate current lighting. Work mode reports the existing 30-fps animation target; no new FPS performance claim is made.
- No browser or shader errors.
- Before/after sky pixels are identical. 23,034 pixels changed (~0.625% of the full image), localized visually to restored flower shading. Mean RGB absolute difference is 0.023/255 over the full frame. Geometry, colors, camera and wind design were not changed.
- 203 application tests plus 69 environment/habitat/community/day-cycle/wind tests pass (272 total).
- Changed files pass ESLint. Full lint retains the two existing unused parameters in untouched `tuftGroup.js`.
- Application and isolated prototype production builds pass; the existing prototype chunk-size advisory remains.

Reproduce with the existing local delivery assets and browser-tools installation:

```powershell
npx vite --config design-reference/environment/webgl-prototype/day-cycle.config.mjs --host 127.0.0.1 --port 5195
node design-reference/environment/webgl-prototype/validate-integration-fixes.mjs
node --test tests/day-cycle.test.mjs tests/wind.test.mjs
```

The comparison harness expects the saved pre-change `integration-fixes/before.png`. Render artifacts and third-party assets are not added to Git. Claude's separate worktrees are untouched.

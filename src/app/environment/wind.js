// Wind through the meadow: grass blades and flowers sway with slow travelling gusts and a quicker flutter, bending more toward their tips.
// One shared time and strength (WIND); every grass and flower material reads them, so turning the wind on or off never recompiles anything.
export const WIND = { time: { value: 0 }, strength: { value: 0 } };

// The user's reduced-motion preference turns vegetation movement off; ?wind=0 also turns it off (for comparisons).
export const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
export const windWanted = (search = typeof window === 'undefined' ? '' : window.location.search) => new URLSearchParams(search).get('wind') !== '0' && !prefersReducedMotion();

// How actively the landscape is being looked at, which sets the animation cadence (frames per second; 0 = paused, redraw only on change):
// 'scenic' the user is looking at the world, 'work' it sits behind UI panels, 'obscured' nothing of it is visible. The tab being hidden always pauses.
export const ACTIVITY_FPS = Object.freeze({ scenic: 60, work: 30, obscured: 0 });
export function animationFps({ activity = 'scenic', hidden = false, wind = true } = {}) {
  if (hidden || !wind) return 0;
  return ACTIVITY_FPS[activity] ?? ACTIVITY_FPS.scenic;
}

// GLSL replacing three.js's <project_vertex> for instanced vegetation: the sway is added in world space, so every blade bends the same way.
// heightExpr: 0 at the root, 1 at the tip (in the mesh's local units).
export const windVertex = (heightExpr) => `
#ifdef USE_INSTANCING
  vec4 windWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  float windH = clamp(${heightExpr}, 0.0, 1.0); float windSize = length((modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec2 windDir = normalize(vec2(0.8, -0.6));
  float gust = 0.55 + 0.45 * sin(uWindTime * 0.55 - dot(windWorld.xz, windDir) * 0.07) * sin(uWindTime * 0.23 + windWorld.x * 0.013);
  float flutter = sin(uWindTime * 2.1 + dot(windWorld.xz, vec2(0.37, 0.23))) * 0.35 + sin(uWindTime * 3.7 + windWorld.x * 0.9 + windWorld.z * 0.6) * 0.15;
  float bend = uWindK * windH * windH * windSize * (gust * 0.16 + flutter * 0.05);
  windWorld.xz += windDir * bend; windWorld.y -= abs(bend) * 0.25 * windH;
  vec4 mvPosition = viewMatrix * windWorld;
#else
  vec4 mvPosition = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    mvPosition = batchingMatrix * mvPosition;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
#endif
  gl_Position = projectionMatrix * mvPosition;`;

export function addWind(shader, heightExpr) {
  shader.uniforms.uWindTime = WIND.time; shader.uniforms.uWindK = WIND.strength;
  shader.vertexShader = 'uniform float uWindTime; uniform float uWindK;\n' + shader.vertexShader.replace('#include <project_vertex>', windVertex(heightExpr));
}

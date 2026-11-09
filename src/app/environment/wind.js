// Wind through the meadow: grass blades and flowers sway with slow travelling gusts and a quicker flutter, bending more toward their tips.
// One shared time and strength (WIND); every grass and flower material reads them, so turning the wind on or off never recompiles anything.
export const WIND = { time: { value: 0 }, strength: { value: 0 } };
// Compare the prior distance response without changing density or the world clock.
export const FIELD_WIND_ENABLED = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('fieldwind') !== 'previous';
export const FIELD_WIND = Object.freeze({ nearStart: 12, nearFull: 38, farStart: 240, farEnd: 360, grassLean: .34, flowerLean: .22, canopyTilt: .24 });

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

// How each kind of plant answers the wind. Grass is light and quick; flowers carry a head, so they sway slower, lag behind the gust and nod a little more.
export const WIND_KINDS = Object.freeze({
  grass: { stiffness: 1.0, rate: 1.0, lag: 0.0, amount: 1.0 },
  flower: { stiffness: 0.75, rate: 0.62, lag: 0.45, amount: 1.15 },
});

// GLSL replacing three.js's <project_vertex> for instanced vegetation. The wind is one field of gusts rolling across the valley at a steady speed
// (all plants feel the same gust as it passes them); every plant then answers it in its own way: its own stiffness, its own natural rate and phase,
// so neighbours never move in lockstep. Motion fades out with distance and with the plant's size on screen: a moving sub-pixel blade does not read
// as wind, only as shimmer. heightExpr: 0 at the root, 1 at the tip (mesh-local units).
export const windVertex = (heightExpr, kind = WIND_KINDS.grass) => `
#ifdef USE_INSTANCING
  vec4 windWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  vec3 windRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float windH = clamp(${heightExpr}, 0.0, 1.0); float windSize = length((modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec2 windDir = normalize(vec2(0.8, -0.6));
  // per plant: a stable random number from its root position
  float seed = fract(sin(dot(windRoot.xz, vec2(12.9898, 78.233))) * 43758.5453); float seed2 = fract(seed * 7.13 + 0.37);
  float stiff = ${kind.stiffness.toFixed(3)} * mix(0.65, 1.35, seed); float rate = ${kind.rate.toFixed(3)} * mix(0.75, 1.3, seed2);
  // the gust field: two layers of soft noise drifting downwind (~4 m/s), sampled a little later for heavier plants
  float t = uWindTime - ${kind.lag.toFixed(3)} * (0.6 + seed);
  vec2 g1 = windRoot.xz * 0.045 - windDir * t * 0.18, g2 = windRoot.xz * 0.11 - windDir * t * 0.42 + 3.7;
  float gust = windValueNoise(g1) * 0.7 + windValueNoise(g2) * 0.3; gust = smoothstep(0.25, 0.85, gust);
  // the plant's own sway around the bent position, at its own rate and phase; stronger when the gust is stronger
  float sway = sin(uWindTime * 1.7 * rate + seed * 6.2832) * 0.6 + sin(uWindTime * 2.9 * rate + seed2 * 6.2832) * 0.25;
  vec2 across = vec2(-windDir.y, windDir.x);
  // shimmer guard: no motion where a plant is too small on screen to show it
  float dist = length(windRoot - cameraPosition); float onScreen = windSize / max(dist, 0.1);
  float fade = (1.0 - smoothstep(12.0, 34.0, dist)) * smoothstep(0.006, 0.016, onScreen);
  float bendAmount = uWindK * fade * ${kind.amount.toFixed(3)} * windH * windH * windSize / stiff;
  vec2 offset = windDir * bendAmount * (0.04 + 0.15 * gust + 0.05 * gust * sway) + across * bendAmount * 0.03 * sway * (0.4 + gust);
  // Middle ground: no per-plant flutter there (sub-pixel blades fluttering only shimmer), but the gusts still visibly sweep across the meadow:
  // whole patches lean together downwind, with their lighting following the canopy tilt.
  ${FIELD_WIND_ENABLED ? `
  // Collective canopy movement survives the fine-blade flutter cutoff. These
  // are the SAME advected gusts as the foreground, not a second scrolling mask.
  // A narrow stiffness range keeps neighbours moving as a soft mass; flower
  // stems stay heavier and retain their existing delayed response.
  float fieldK = uWindK * smoothstep(${FIELD_WIND.nearStart.toFixed(1)}, ${FIELD_WIND.nearFull.toFixed(1)}, dist) * (1.0 - smoothstep(${FIELD_WIND.farStart.toFixed(1)}, ${FIELD_WIND.farEnd.toFixed(1)}, dist));
  float fieldStiff = ${kind.stiffness.toFixed(3)} * mix(0.9, 1.1, seed);
  float fieldBend = fieldK * ${(kind === WIND_KINDS.flower ? FIELD_WIND.flowerLean : FIELD_WIND.grassLean).toFixed(3)} * windH * windH * windSize * gust / fieldStiff;
  offset += windDir * fieldBend;
  // Tilt the low-detail canopy lighting with the actual collective lean.
  // Without this, the strongly upward-smoothed distant normals hide the sway.
  vWindCanopyBend = windDir * fieldK * ${FIELD_WIND.canopyTilt.toFixed(3)} * gust;
  ` : `
  float midK = uWindK * smoothstep(10.0, 34.0, dist) * (1.0 - smoothstep(110.0, 180.0, dist));
  offset += windDir * midK * 0.075 * windH * windH * windSize * gust / stiff;
  vWindCanopyBend = vec2(0.0);
  `}
  vWindSheen = uWindK * smoothstep(0.45, 0.95, gust) * windH * (0.35 + 0.65 * smoothstep(8.0, 30.0, dist));
  windWorld.xz += offset; windWorld.y -= dot(offset, offset) / max(windSize, 0.05) * 0.5 * windH;
  vec4 mvPosition = viewMatrix * windWorld;
#else
  vWindSheen = 0.0; vWindCanopyBend = vec2(0.0);
  vec4 mvPosition = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    mvPosition = batchingMatrix * mvPosition;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
#endif
  gl_Position = projectionMatrix * mvPosition;`;

const NOISE = `float windHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float windValueNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(windHash(i),windHash(i+vec2(1,0)),f.x),mix(windHash(i+vec2(0,1)),windHash(i+vec2(1,1)),f.x),f.y); }`;

// Fragment side of the wind sheen, for grass: a bent blade shows its paler, sky-lit side.
export function addWindSheen(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + mat3(viewMatrix) * vec3(-vWindCanopyBend.x, 0.0, -vWindCanopyBend.y));');
  shader.fragmentShader = 'varying float vWindSheen; varying vec2 vWindCanopyBend;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 1.14, 1.02) + vec3(0.012, 0.016, 0.006), clamp(vWindSheen, 0.0, 1.0) * 0.75);');
}

export function addWind(shader, heightExpr, kind = WIND_KINDS.grass) {
  shader.uniforms.uWindTime = WIND.time; shader.uniforms.uWindK = WIND.strength;
  shader.vertexShader = `uniform float uWindTime; uniform float uWindK; varying float vWindSheen; varying vec2 vWindCanopyBend;\n${NOISE}\n` + shader.vertexShader.replace('#include <project_vertex>', windVertex(heightExpr, kind));
}

import * as THREE from 'three';

// The valley's look at true scale (docs/WORLD-SPEC.md sections 3-4), shared by every opaque surface:
// - air: aerial perspective with height (denser low in the valley, thinner over the summits) and forward scattering, so looking into the light the
//   far layers glow and separate, the way the references shot into the sun do;
// - mountains: above the treeline the block-out colours give way to rock with strata, couloirs and patches, and snow that lies on gentler ground
//   above a seasonal snowline and gathers in hollows, with a crisp edge.
// The old scene's mountainDetail.js had the same ideas tuned to 90 m mountains; these are tuned to kilometres.
export const LOOK = {
  uSunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
  uHaze: { value: new THREE.Color(0.75, 0.8, 0.86) }, uDensity: { value: 1 / 16000 }, uScaleHeight: { value: 1300 }, uGlow: { value: 1.2 },
  uSnowline: { value: 1500 }, uTreeline: { value: 640 }, uRockOn: { value: 1 },
};
const NOISE = `
float vlHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vlNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(vlHash(i),vlHash(i+vec2(1,0)),f.x),mix(vlHash(i+vec2(0,1)),vlHash(i+vec2(1,1)),f.x),f.y); }
float vlFbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vlNoise(p); p=p*2.03+17.1; a*=0.5; } return s; }`;

// Scanned ground (Poly Haven, CC0; design-reference/world-redesign/textures): colour maps that replace the block-out colours, kept in the
// zone's hue by a gentle tint from the vertex colour. Off until approved: ?textures=1 shows them.
const TEX_ROOT = '/design-reference/world-redesign/textures/';
const TEXTURES = { tGrassFar: 'aerial_grass_rock', tGrassNear: 'sparse_grass', tGravel: 'river_small_rocks', tRock: 'aerial_rocks_02', tSnow: 'snow_field_aerial', tTrack: 'grass_path_2', tForest: 'forest_ground_04' };
export const TEX_ON = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('textures') === '1'; // under review: ?textures=1
const loader = new THREE.TextureLoader(); const TEX = {};
for (const [k, id] of Object.entries(TEXTURES)) { const t = loader.load(TEX_ROOT + id + '.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TEX[k] = { value: t }; }
const GROUND = `
vec3 vlTex(sampler2D t, vec2 uv) { return texture2D(t, uv).rgb; }
// two scales of the same texture, blended by a slow noise, so its tiling never lines up
vec3 vlTwo(sampler2D t, vec2 p, float s) { float m = smoothstep(0.35, 0.65, vlFbm(p / (s * 6.0))); return mix(vlTex(t, p / s), vlTex(t, p / (s * 3.7) + 0.37), m * 0.6); }
// rock on steep ground: projected along the face rather than from above, so cliffs are not stretched
vec3 vlTri(sampler2D t, vec3 p, vec3 n, float s) { vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z); return vlTex(t, p.zy / s) * w.x + vlTex(t, p.xz / s) * w.y + vlTex(t, p.xy / s) * w.z; }`;
export function applyValleyLook(material, { mountain = false, ground = false, glow = 0 } = {}) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    Object.assign(shader.uniforms, LOOK); if (ground && TEX_ON) Object.assign(shader.uniforms, TEX);
    const textured = ground && TEX_ON;
    shader.vertexShader = 'varying vec3 vlWorld; varying vec3 vlNormal;' + (ground ? ' attribute vec3 aSurf; varying vec3 vlSurf;' : '') + '\n' + shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
${ground ? 'vlSurf = aSurf;' : ''}
{ vec4 wpv = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wpv = instanceMatrix * wpv;
#endif
  vlWorld = (modelMatrix * wpv).xyz; vlNormal = normalize(mat3(modelMatrix) * objectNormal); }`);
    shader.fragmentShader = `uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uHaze; uniform float uDensity; uniform float uScaleHeight; uniform float uGlow; uniform float uSnowline; uniform float uTreeline; uniform float uRockOn;
varying vec3 vlWorld; varying vec3 vlNormal;${ground ? ' varying vec3 vlSurf;' : ''}${textured ? ' uniform sampler2D tGrassFar, tGrassNear, tGravel, tRock, tSnow, tTrack, tForest;' : ''}\n${NOISE}\n${textured ? GROUND : ''}\n` + shader.fragmentShader;
    // the ground: scanned surfaces chosen by zone (gravel, track, forest floor in aSurf; meadow otherwise) and by distance (the close-up
    // sparse turf near the camera, the aerial grass-and-stone further out); the vertex colour only nudges the hue toward its zone
    if (ground) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 p = vlWorld.xz; float d = length(vlWorld - cameraPosition);
  // fields, per pixel: plots about 110 m across, each mown, grazed or left long on its own rhythm; seams where a fence or ditch runs.
  // Only on the open valley floor (no gravel, track or forest, below the terrace line), fading out with distance.
  float open = (uSnowline < 0.0 ? 0.0 : 1.0) * (1.0 - clamp(vlSurf.x + vlSurf.y + vlSurf.z, 0.0, 1.0)) * (1.0 - smoothstep(60.0, 140.0, vlWorld.y)) * (1.0 - smoothstep(1800.0, 3500.0, d));
  if (open > 0.0) { vec2 c = p / 110.0; vec2 ci = floor(c); float d1 = 9.0, d2 = 9.0, id = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = ci + vec2(float(i), float(j)); vec2 o = g + 0.15 + 0.7 * vec2(vlHash(g), vlHash(g + 17.3)); float dd = length(c - o); if (dd < d1) { d2 = d1; d1 = dd; id = vlHash(g * 3.1 + 7.7); } else if (dd < d2) d2 = dd; }
    vec3 f = diffuseColor.rgb; float lum0 = dot(f, vec3(0.333));
    vec3 mown = mix(f, vec3(0.62, 0.66, 0.36) * lum0 / 0.45, 0.55) * 1.1, lush = f * vec3(0.86, 0.95, 0.82);
    vec3 tone = id < 0.33 ? mown : id < 0.66 ? f : lush; tone *= 0.94 + 0.12 * vlFbm(p / 18.0); /* the sward is never even */
    float seam = 1.0 - smoothstep(0.012, 0.05, d2 - d1);
    diffuseColor.rgb = mix(f, tone * (1.0 - 0.12 * seam), open); }
  // the distant slopes, per pixel: forest where the ground climbs, alpine pasture in the clearings and up the avalanche paths, the forest
  // thinning toward the treeline; canopy drawn as a fine grain of crowns, so far woods read as woods and no vertex grid shows
  float far = smoothstep(1100.0, 1800.0, d) * (1.0 - smoothstep(uTreeline - 40.0, uTreeline + 120.0, vlWorld.y)) * smoothstep(30.0, 70.0, vlWorld.y);
  if (far > 0.0) { vec3 n = normalize(vlNormal); float slope = 1.0 - n.y;
    float wood = smoothstep(0.015, 0.08, slope + 0.05 * (vlFbm(p / 900.0) - 0.5)) * smoothstep(0.12, 0.3, vlFbm(p / 650.0 + 3.1));
    wood *= 1.0 - 0.85 * smoothstep(0.86, 0.95, abs(sin(p.x / 230.0 + vlFbm(p / 480.0) * 7.0))); /* avalanche paths */
    wood *= 1.0 - smoothstep(uTreeline - 260.0, uTreeline + 40.0, vlWorld.y + 90.0 * (vlFbm(p / 300.0) - 0.5));
    float crowns = vlNoise(p / 9.0) * 0.6 + vlNoise(p / 23.0) * 0.4; vec3 canopy = mix(vec3(0.07, 0.12, 0.06), vec3(0.17, 0.24, 0.11), crowns) * (0.9 + 0.25 * vlFbm(p / 400.0));
    vec3 pasture = mix(vec3(0.34, 0.43, 0.19), vec3(0.45, 0.47, 0.26), vlFbm(p / 260.0)) * (0.9 + 0.2 * vlNoise(p / 40.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(pasture, canopy, wood), far * (1.0 - step(0.5, uSnowline < 0.0 ? 1.0 : 0.0))); }
${textured ? `
  vec3 meadow = mix(vlTwo(tGrassNear, p, 2.2), vlTwo(tGrassFar, p, 15.0), smoothstep(25.0, 90.0, d));
  meadow = mix(meadow, vlTwo(tGrassFar, p, 60.0), smoothstep(400.0, 1500.0, d));
  vec3 g = mix(meadow, vlTwo(tForest, p, 3.2), clamp(vlSurf.z, 0.0, 1.0));
  g = mix(g, vlTwo(tGravel, p, 3.0), clamp(vlSurf.x, 0.0, 1.0)); g = mix(g, vlTwo(tTrack, p, 1.6), clamp(vlSurf.y, 0.0, 1.0));
  vec3 base = diffuseColor.rgb; vec3 tint = base / (dot(base, vec3(0.3333)) + 1e-3);
  float lum = dot(g, vec3(0.299, 0.587, 0.114)); vec3 detail = clamp(vec3(lum / 0.32), 0.45, 1.7) * mix(vec3(1.0), g / max(lum, 1e-3), 0.18); /* the scans as detail: their light and dark (soil, stones, tufts) and a touch of their hue over the designed colour */
  diffuseColor.rgb = base * mix(vec3(1.0), detail, 0.85 * (1.0 - smoothstep(1500.0, 4000.0, d)));
  diffuseColor.rgb = mix(diffuseColor.rgb, base, clamp(vlSurf.z, 0.0, 1.0) * smoothstep(150.0, 400.0, d)); /* far forest reads as canopy, not forest floor */` : ''} }
/*vl-ground*/`);
    if (mountain) shader.fragmentShader = shader.fragmentShader.replace(ground ? '/*vl-ground*/' : '#include <color_fragment>', `${ground ? '' : '#include <color_fragment>'}
{ float h = vlWorld.y; vec3 n = normalize(vlNormal); float up = clamp(n.y, 0.0, 1.0); vec2 p = vlWorld.xz;
  float alpine = smoothstep(uTreeline - 80.0, uTreeline + 160.0, h + 120.0 * (vlFbm(p / 400.0) - 0.5)) * uRockOn;
  // rock: grey-brown limestone and gneiss, broken into strata along the height, streaked down the fall line by couloirs, patched warm and cool
  float strata = vlNoise(vec2(h / 22.0 + vlFbm(p / 300.0) * 3.0, 0.5)); float streak = vlFbm(vec2(p.x / 90.0 + n.x * 6.0, p.y / 90.0 + n.z * 6.0) + h / 260.0);
  vec3 rock = mix(vec3(0.33, 0.31, 0.29), vec3(0.47, 0.44, 0.40), vlFbm(p / 700.0)); rock *= 0.78 + 0.32 * strata; rock *= 0.82 + 0.3 * smoothstep(0.35, 0.7, streak);${textured ? "\n  rock = vlTri(tRock, vlWorld, n, 55.0) * (0.72 + 0.4 * strata) * (0.86 + 0.24 * smoothstep(0.35, 0.7, streak));" : ""}
  rock = mix(rock, vec3(0.38, 0.40, 0.33), 0.35 * smoothstep(0.55, 0.85, up) * (1.0 - smoothstep(uSnowline - 300.0, uSnowline + 200.0, h))); // alpine turf on the gentler rock below the snow
  // snow: lies where the ground is gentle enough to hold it, above a snowline that wanders, and gathers in hollows; a crisp edge
  float line = uSnowline + 260.0 * (vlFbm(p / 520.0) - 0.5); float hold = smoothstep(0.42, 0.62, up + 0.12 * (vlFbm(p / 160.0) - 0.5));
  float snow = smoothstep(line - 30.0, line + 30.0, h) * hold; snow = max(snow, smoothstep(line + 600.0, line + 900.0, h) * smoothstep(0.25, 0.45, up));
  vec3 alp = mix(rock, ${textured ? "min(vlTwo(tSnow, p, 80.0) * 1.45 + 0.08, vec3(1.0))" : "vec3(0.93, 0.95, 0.98)"}, snow);
  diffuseColor.rgb = mix(diffuseColor.rgb, alp, alpine); }`);
    // the air: transmittance through height-varying haze, and light scattered into the view (more toward the sun)
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
{ vec3 ray = vlWorld - cameraPosition; float d = length(ray); vec3 v = ray / max(d, 1e-3);
  float h0 = cameraPosition.y, dh = ray.y; float k = dh / uScaleHeight; float shape = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0;
  float depth = uDensity * d * exp(-h0 / uScaleHeight) * shape; float T = exp(-depth);
  float mu = dot(v, normalize(uSunDir)); float g = 0.72; float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) / 12.566;
  vec3 inscatter = uHaze + uSunCol * min(hg, 2.0) * uGlow * 0.32 * smoothstep(-0.1, 0.25, uSunDir.y + 0.2);
  gl_FragColor.rgb = gl_FragColor.rgb * T + inscatter * (1.0 - T); }
#include <fog_fragment>`);
    // into the light: sunlight passing through grass blades and needles lights their edges; strongest where the view faces the sun and the
    // surface is seen edge-on (the glowing meadows and crowns of the references); nothing when the sun is down
    if (glow > 0) shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `{ vec3 vv = normalize(cameraPosition - vlWorld); vec3 nn = normalize(vlNormal); float fwd = pow(max(dot(-vv, normalize(uSunDir)), 0.0), 3.0);
  float edge = pow(1.0 - abs(dot(nn, vv)), 1.5); float day = smoothstep(-0.02, 0.12, uSunDir.y);
  outgoingLight += diffuseColor.rgb * uSunCol * fwd * (0.35 + 0.65 * edge) * ${glow.toFixed(3)} * day; }
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `valley-look-${mountain ? 'mountain' : 'plain'}-${ground ? 'g' : ''}${glow}`;
  return material;
}

// per mood: the haze colour and strength, and the light scattered toward the sun
export function setLook({ sunDir, sunCol, haze, density, glow, snowline, treeline }) {
  if (sunDir) LOOK.uSunDir.value.copy(sunDir); if (sunCol) LOOK.uSunCol.value.set(sunCol); if (haze) LOOK.uHaze.value.set(haze);
  if (density) LOOK.uDensity.value = density; if (glow !== undefined) LOOK.uGlow.value = glow; if (snowline !== undefined) LOOK.uSnowline.value = snowline; if (treeline !== undefined) LOOK.uTreeline.value = treeline;
}

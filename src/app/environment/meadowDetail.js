import * as THREE from 'three';

// Meadow detail for the middle and far ground. The instanced blades give the foreground its richness, but past about 40 m the ground is one baked canopy
// colour. This adds, in the terrain shader and at no geometry cost: patches of different growth (clover, lush, drier tall grass), flower drifts that
// fade in as the real flowers thin out, finer grass breakup, and a little aerial perspective. The same patch pattern tints the distant blades.
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); const fx = x - ix, fy = y - iy; const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; };
// 0..1, smooth, about 30 m features: the growth patches the distant blades follow.
export function meadowPatch(x, z) { return 0.6 * noise(x * 0.035, z * 0.035) + 0.3 * noise(x * 0.07 + 5.1, z * 0.07 + 2.3) + 0.1 * noise(x * 0.14, z * 0.14 + 9.9); }

export const MEADOW = { fromMetres: 32, toMetres: 64, fillDarken: 0.82, bladeVariation: 0.45 };

export function applyMeadowDetail(material) {
  const previous = material.onBeforeCompile; const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uMeadowK = { value: 1 };
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `uniform float uMeadowK;
float mdHash(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p+19.19); return fract(p.x*p.y); }
float mdNoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mdHash(i),mdHash(i+vec2(1.0,0.0)),f.x),mix(mdHash(i+vec2(0.0,1.0)),mdHash(i+vec2(1.0,1.0)),f.x),f.y); }
float mdFbm(vec2 p){ float a=0.5; float s=0.0; for(int i=0;i<4;i++){ s+=a*mdNoise(p); p=p*2.07+11.3; a*=0.5; } return s; }
void main() {`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  float md = length(vViewPosition); vec2 mp = vec2(vCanopyWorld.x, vCanopyWorld.z);
  float mf = smoothstep(${MEADOW.fromMetres.toFixed(1)}, ${MEADOW.toMetres.toFixed(1)}, md) * uMeadowK;
  float patchA = mdFbm(mp * 0.035); float patchB = mdFbm(mp * 0.13 + 7.7);
  vec3 tint = mix(mix(vec3(0.76, 0.95, 0.80), vec3(0.88, 1.12, 0.78), smoothstep(0.28, 0.62, patchA)), vec3(1.18, 1.05, 0.72), smoothstep(0.5, 0.82, patchB) * 0.8);
  float detailFade = 1.0 - smoothstep(110.0, 260.0, md);
  tint *= 1.0 + (mdFbm(mp * 1.6) - 0.5) * 0.5 * detailFade;
  diffuseColor.rgb *= mix(vec3(1.0), tint, mf);
  // flower drifts: small cream, buttercup and pink specks, clustered by a slow noise like real meadows
  vec2 g = mp / 0.85; vec2 cellId = floor(g); vec2 local = fract(g) - 0.5; float h1 = mdHash(cellId); float h2 = mdHash(cellId + 31.7);
  float drift = smoothstep(0.44, 0.7, mdFbm(mp * 0.05 + 3.3)); float present = step(1.0 - 0.55 * drift - 0.04, h1);
  vec2 jitter = (vec2(mdHash(cellId + 5.1), mdHash(cellId + 9.7)) - 0.5) * 0.55; float footprint = max(md * 0.0007, 0.03);
  float spot = 1.0 - smoothstep(0.15, 0.2 + footprint, length(local - jitter) * 0.85);
  vec3 speck = h2 < 0.55 ? vec3(0.93, 0.92, 0.86) : (h2 < 0.8 ? vec3(0.95, 0.8, 0.28) : vec3(0.78, 0.35, 0.5));
  // flower drifts as soft colour, not objects: patches of cream, buttercup, pink and clover, broken into many small flecks. Built in perspective coordinates (angle across, 1/distance down)
  // so every fleck keeps a constant size on screen; world-space noise on ground seen this edge-on would stretch into dashes.
  vec2 pc = vec2((mp.x + 3.0) / max(md, 8.0), 4.0 / max(md, 8.0));
  float driftMask = smoothstep(0.36, 0.58, mdFbm(pc * 15.0 + 3.3)); float kind = mdFbm(pc * 6.0 + 11.0); float fleck = smoothstep(0.34, 0.66, mdNoise(pc * 105.0 + 5.0) * 0.7 + mdNoise(pc * 210.0 + 9.0) * 0.3);
  vec3 wash = kind < 0.4 ? vec3(0.93, 0.91, 0.8) : (kind < 0.62 ? vec3(0.88, 0.74, 0.3) : (kind < 0.8 ? vec3(0.74, 0.4, 0.55) : vec3(0.6, 0.3, 0.42)));
  float washAmount = driftMask * fleck * smoothstep(45.0, 95.0, md) * (1.0 - smoothstep(330.0, 520.0, md)) * uMeadowK * 0.0; // off: the perspective-space drifts smeared into vertical streaks
  // tended ground around the hamlet (yards, lanes, churchyard) stays free of wild flowers
  vec2 hamletEdge = smoothstep(vec2(12.0, -161.0), vec2(17.0, -156.0), mp) * (1.0 - smoothstep(vec2(62.0, -118.0), vec2(67.0, -113.0), mp));
  float tended = hamletEdge.x * hamletEdge.y;
  diffuseColor.rgb = mix(diffuseColor.rgb, speck, present * spot * mf * smoothstep(320.0, 200.0, md) * 0.0 * (1.0 - tended));
  diffuseColor.rgb = mix(diffuseColor.rgb, wash, washAmount * (1.0 - tended));
  #ifdef USE_FOG
  diffuseColor.rgb = mix(diffuseColor.rgb, fogColor * 0.9, smoothstep(160.0, 520.0, md) * 0.07 * uMeadowK);
  #endif
}`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : ''}-meadow-detail-9`;
  return material;
}

// Flowering drifts carried by the blades: where the slow drift noise is high the distant blades take a paler, warmer tint (cream marguerite, buttercup, a little lilac clover), so the middle and
// back read as flowering meadow with no extra objects. Returns { amount 0..1, rgb (linear) }.
const DRIFT_COLOURS = { cream: [0.5, 0.47, 0.26], butter: [0.58, 0.42, 0.08], lilac: [0.46, 0.25, 0.36] };
export function flowerDrift(x, z) {
  const amount = Math.max(0, Math.min(1, (meadowPatch(x * 1.3 + 40, z * 0.42 - 17) - 0.42) / 0.3)) ** 1.2; const kind = meadowPatch(x * 0.5 + 9, z * 0.2 + 3); // stretched in depth: ground seen edge-on compresses depth, so squarer patches read as blobs, not bands
  return { amount, rgb: kind < 0.42 ? DRIFT_COLOURS.cream : kind < 0.64 ? DRIFT_COLOURS.butter : kind < 0.8 ? DRIFT_COLOURS.lilac : DRIFT_COLOURS.cream };
}

export const meadowBladeTint = (x, z, isFill) => (0.86 + MEADOW.bladeVariation * meadowPatch(x, z)) * (isFill ? MEADOW.fillDarken : 1);
void THREE;

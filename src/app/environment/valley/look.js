import * as THREE from 'three';

// The valley's look at true scale (docs/WORLD-SPEC.md sections 3-4), shared by every opaque surface:
// - air: aerial perspective with height (denser low in the valley, thinner over the summits) and forward scattering, so looking into the light the
//   far layers glow and separate, the way the references shot into the sun do;
// - mountains: above the treeline the block-out colours give way to rock with strata, couloirs and patches, and snow that lies on gentler ground
//   above a seasonal snowline and gathers in hollows, with a crisp edge.
// The old scene's mountainDetail.js had the same ideas tuned to 90 m mountains; these are tuned to kilometres.
export const LOOK = {
  uSunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
  uHaze: { value: new THREE.Color(0.75, 0.8, 0.86) }, uDensity: { value: 1 / 16000 }, uScaleHeight: { value: 2300 } /* the haze reaches up the mountains: the far range goes blue */, uGlow: { value: 1.2 },
  uSnowline: { value: 1500 }, uTreeline: { value: 640 }, uRockOn: { value: 1 }, uCover: { value: 0.5 }, uCloudOn: { value: 0 }, uTime: { value: 0 },
};
const NOISE = `
float vlHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vlNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(vlHash(i),vlHash(i+vec2(1,0)),f.x),mix(vlHash(i+vec2(0,1)),vlHash(i+vec2(1,1)),f.x),f.y); }
float vlFbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vlNoise(p); p=p*2.03+17.1; a*=0.5; } return s; }
float vlFb(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<6;i++){ s+=a*vlNoise(p); p=p*2.02+vec2(5.1,1.7); a*=0.5; } return s; } // the cloud layer's own noise
uniform float uCover; uniform float uCloudOn; uniform float uTime;
float vlCloudShade(vec3 w) { if (uCloudOn < 0.5) return 1.0; vec3 L = normalize(uSunDir); if (L.y < 0.03) return 1.0;
  vec2 p = w.xz + L.xz * (2800.0 - w.y) / L.y + vec2(uTime * 6.0, uTime * 2.0); /* the shadows drift with the clouds */ vec2 warp = vec2(vlFb(p / 5000.0), vlFb(p / 5000.0 + 9.2)) - 0.5;
  float dens = smoothstep(uCover, uCover + 0.22, vlFb(p / 3200.0 + warp * 1.6)) * (0.65 + 0.35 * vlFb(p / 700.0 + 3.0));
  return 1.0 - 0.72 * clamp(dens * 1.25, 0.0, 1.0); }`;

// Scanned ground (Poly Haven, CC0; design-reference/world-redesign/textures): colour maps that replace the block-out colours, kept in the
// zone's hue by a gentle tint from the vertex colour. Off until approved: ?textures=1 shows them.
const TEX_ROOT = '/design-reference/world-redesign/textures/';
const TEXTURES = { tGrassFar: 'aerial_grass_rock', tGrassNear: 'sparse_grass', tGravel: 'river_small_rocks', tRock: 'aerial_rocks_02', tSnow: 'snow_field_aerial', tTrack: 'grass_path_2', tForest: 'forest_ground_04' };
export const TEX_ON = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('textures') === '1'; // under review: ?textures=1
const loader = new THREE.TextureLoader(); const TEX = {};
for (const [k, id] of Object.entries(TEXTURES)) { const t = loader.load(TEX_ROOT + id + '.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TEX[k] = { value: t }; }
const EROSION = `
// erosion: fine runnels (14 m apart) joining into wider gullies (55 m), cut down the fall line of every steep face; x-facing faces use z
// as their across-slope coordinate and z-facing faces use x, blended as a triplanar would, so the streaks never swirl
float vlRunnels(vec3 q, float wx) { return mix(vlFbm(vec2(q.x / 14.0, q.y / 210.0)), vlFbm(vec2(q.z / 14.0, q.y / 210.0) + 5.0), wx); }
float vlGullies(vec3 q, float wx) { return mix(vlFbm(vec2(q.x / 55.0, q.y / 600.0) + 2.0), vlFbm(vec2(q.z / 55.0, q.y / 600.0) + 9.0), wx); }`;
const GROUND = `
vec3 vlTex(sampler2D t, vec2 uv) { return texture2D(t, uv).rgb; }
// two scales of the same texture, blended by a slow noise, so its tiling never lines up
vec3 vlTwo(sampler2D t, vec2 p, float s) { float m = smoothstep(0.35, 0.65, vlFbm(p / (s * 6.0))); return mix(vlTex(t, p / s), vlTex(t, p / (s * 3.7) + 0.37), m * 0.6); }
// rock on steep ground: projected along the face rather than from above, so cliffs are not stretched
vec3 vlTri(sampler2D t, vec3 p, vec3 n, float s) { vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z); return vlTex(t, p.zy / s) * w.x + vlTex(t, p.xz / s) * w.y + vlTex(t, p.xy / s) * w.z; }`;
// the scanned rock and snow for the mountains (Poly Haven CC0: cliff_side, snow_02), always on
const PH = '/design-reference/world-redesign/textures/ph/';
export const phTex = (id, srgb = true) => { const t = loader.load(PH + id); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return { value: t }; };
export const MOUNTAIN_TEX = { tCliff: { value: (() => { const t = loader.load('/design-reference/world-redesign/textures/aerial_rocks_02.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; })() }, tSnowS: phTex('snow_02/diff.jpg') }; // grey alpine rock seen from afar (aerial_rocks_02), clean snow
export function applyValleyLook(material, { mountain = false, ground = false, glow = 0, surface = null } = {}) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    Object.assign(shader.uniforms, LOOK); if (ground && TEX_ON) Object.assign(shader.uniforms, TEX); if (ground) shader.uniforms.tGravelB = TEX.tGravel; if (mountain) Object.assign(shader.uniforms, MOUNTAIN_TEX);
    const textured = ground && TEX_ON;
    shader.vertexShader = 'varying vec3 vlWorld; varying vec3 vlNormal;' + (ground ? ' attribute vec3 aSurf; varying vec3 vlSurf; attribute vec3 aLand; varying vec3 vlLand;' : '') + (mountain ? ' attribute float aRelief; varying float vlRelief;' : '') + '\n' + shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
${ground ? 'vlSurf = aSurf; vlLand = aLand;' : ''}${mountain ? ' vlRelief = aRelief;' : ''}
{ vec4 wpv = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wpv = instanceMatrix * wpv;
#endif
  vlWorld = (modelMatrix * wpv).xyz; vlNormal = normalize(mat3(modelMatrix) * objectNormal); }`);
    shader.fragmentShader = `uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uHaze; uniform float uDensity; uniform float uScaleHeight; uniform float uGlow; uniform float uSnowline; uniform float uTreeline; uniform float uRockOn;
varying vec3 vlWorld; varying vec3 vlNormal;${ground ? ' varying vec3 vlSurf; varying vec3 vlLand; uniform sampler2D tGravelB;' : ''}${mountain ? ' varying float vlRelief; uniform sampler2D tCliff; uniform sampler2D tSnowS;' : ''}${textured ? ' uniform sampler2D tGrassFar, tGrassNear, tGravel, tRock, tSnow, tTrack, tForest;' : ''}\n${NOISE}\n${mountain ? EROSION : ''}\n${textured ? GROUND : ''}\n` + shader.fragmentShader;
    // the ground: scanned surfaces chosen by zone (gravel, track, forest floor in aSurf; meadow otherwise) and by distance (the close-up
    // sparse turf near the camera, the aerial grass-and-stone further out); the vertex colour only nudges the hue toward its zone
    // building surfaces, drawn in world space: whitewash with rain streaks and a darker splash zone, coursed stone with mortar, vertical larch
    // planks with grain weathered silver-brown, and roofs in rows of stone slabs or shingles, each tile its own tone
    if (surface) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 n = normalize(vlNormal); float u = abs(n.x) > abs(n.z) ? vlWorld.z : vlWorld.x; float y = vlWorld.y; vec3 c = diffuseColor.rgb;
  ${surface === 'plaster' ? 'c *= 0.9 + 0.12 * vlFbm(vec2(u, y) * 1.7); c *= 1.0 - 0.16 * smoothstep(0.55, 0.8, vlFbm(vec2(u * 2.6, y * 0.25)));' : ''}
  ${surface === 'stone' ? 'float row = floor(y / 0.34); float uu = u + row * 0.21; float colI = floor(uu / 0.52); vec2 f = vec2(fract(uu / 0.52), fract(y / 0.34)); float mortar = 1.0 - smoothstep(0.0, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y))); c *= 0.78 + 0.34 * vlHash(vec2(row, colI)); c = mix(c, c * 1.25, mortar * 0.6);' : ''}
  ${surface === 'timber' ? 'float pk = fract(u / 0.24); float seam = 1.0 - smoothstep(0.0, 0.05, min(pk, 1.0 - pk)); float plank = vlHash(vec2(floor(u / 0.24), 7.0)); c *= 0.8 + 0.3 * plank; c *= 0.85 + 0.25 * vlFbm(vec2(u * 30.0, y * 0.8)); c = mix(c, c * 0.45, seam); c = mix(c, vec3(0.42, 0.38, 0.34), 0.25 * smoothstep(0.5, 0.8, vlFbm(vec2(u, y) * 0.6)));' : ''}
  ${surface === 'roof' ? 'float rr = fract(y / 0.26); float rowI = floor(y / 0.26); float tile = vlHash(vec2(floor((u + rowI * 0.17) / 0.38), rowI)); c *= 0.75 + 0.4 * tile; c = mix(c, c * 0.5, 1.0 - smoothstep(0.0, 0.15, rr)); c = mix(c, c * vec3(0.85, 0.95, 0.75), 0.3 * smoothstep(0.6, 0.85, vlFbm(vec2(u, y) * 0.5)));' : ''}
  diffuseColor.rgb = c; }`);
    if (ground) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 p = vlWorld.xz; float d = length(vlWorld - cameraPosition);
  // fields, per pixel: plots about 110 m across, each mown, grazed or left long on its own rhythm; seams where a fence or ditch runs.
  // Only on the open valley floor (no gravel, track or forest, below the terrace line), fading out with distance.
  float open = (uSnowline < 0.0 ? 0.0 : 1.0) * (1.0 - clamp(vlSurf.x + vlSurf.y + vlSurf.z, 0.0, 1.0)) * (1.0 - smoothstep(60.0, 140.0, vlWorld.y)) * (1.0 - smoothstep(1800.0, 3500.0, d));
  // land use (blockout.js landUse, in aLand: mown, grazed, damp; long flowering hay elsewhere): each plot its own texture and tone
  if (open > 0.0) { vec3 f = diffuseColor.rgb; float fade = 1.0 - smoothstep(600.0, 2200.0, d); /* fine detail gives way to the plot's average tone */
    vec3 mownC = f * vec3(1.2, 1.16, 0.9) * (1.0 + 0.1 * fade * sin(dot(p, vec2(0.83, 0.55)) * 1.1)); /* pale stubble with windrow lines */
    vec3 grazedC = f * vec3(0.94, 1.06, 1.0) * (1.0 + fade * (0.18 * (vlNoise(p / 2.2) - 0.5) - 0.28 * step(0.82, vlNoise(p / 1.6)))); /* short turf, dark tussocks */
    vec3 dampC = f * vec3(0.76, 0.9, 0.96) * (1.0 + fade * 0.3 * (vlNoise(p / 3.5) - 0.5)); /* rushes, darker and bluer */
    float daisies = smoothstep(0.58, 0.72, vlFbm(p / 38.0 + 3.0)), pinks = smoothstep(0.64, 0.76, vlFbm(p / 52.0 + 9.0)); /* flower pockets in the hay */
    vec3 longC = f * (0.93 + 0.14 * vlFbm(p / 9.0)); longC = mix(longC, longC * vec3(1.16, 1.14, 1.2), daisies * 0.45); longC = mix(longC, longC * vec3(1.15, 0.95, 1.08), pinks * 0.35);
    vec3 tone = mix(mix(mix(longC, mownC, vlLand.x), grazedC, vlLand.y), dampC, vlLand.z);
    tone *= 0.88 + 0.24 * vlFbm(p / 26.0 + 5.0); /* patches of richer and thinner sward */
    // terracettes: the little contour paths grazing animals tread into every pasture bank
    float bank = smoothstep(0.08, 0.25, 1.0 - normalize(vlNormal).y); float tread = smoothstep(0.78, 0.96, fract(vlWorld.y / 1.4 + 0.35 * vlNoise(p / 9.0)));
    tone *= 1.0 - 0.2 * bank * tread * (0.4 + 0.6 * vlLand.y + 0.3 * (1.0 - vlLand.x)) * (1.0 - smoothstep(500.0, 1400.0, d));
    diffuseColor.rgb = mix(f, tone, open); }
  // the sward's grain wherever it is grass: clumps, darker damp patches, the odd bush and stone, at scales from 3 to 40 m, on the valley floor
  // and up the near valley walls alike, so nothing reads as a smooth lawn
  { float grassy = (1.0 - clamp(vlSurf.x + vlSurf.y + vlSurf.z, 0.0, 1.0)) * (1.0 - smoothstep(uTreeline - 120.0, uTreeline, vlWorld.y)) * (1.0 - smoothstep(900.0, 1600.0, d)) * (uSnowline < 0.0 ? 0.25 : 1.0);
    float grain = 0.8 + 0.4 * vlFbm(p / 6.0) * (0.7 + 0.6 * vlNoise(p / 40.0)); float bush = step(0.9, vlNoise(p / 3.2)) * step(0.55, vlNoise(p / 60.0)) * smoothstep(120.0, 220.0, d);
    vec3 g2 = diffuseColor.rgb * grain; g2 = mix(g2, g2 * 0.72, bush * 0.6); /* a bush is a darker tuft of the same sward, not a black stain */
    float slopeN = 1.0 - normalize(vlNormal).y; g2 = mix(g2, g2 * vec3(0.78, 0.82, 0.7), smoothstep(0.15, 0.4, slopeN) * smoothstep(0.55, 0.7, vlFbm(p / 25.0 + 4.0))); /* rougher, darker turf on the steeper banks */
    diffuseColor.rgb = mix(diffuseColor.rgb, g2, grassy); }
  // wet ground: darker, glossier soil and gravel at the water's edge (the gravel weight marks the river banks)
  // the gravel banks and bars of the stream in a scanned pebble texture (river_small_rocks), wet and darker at the waterline
  { float gv = clamp(vlSurf.x * 1.3, 0.0, 1.0) * (1.0 - smoothstep(250.0, 900.0, d)); if (gv > 0.0) { vec3 gr = texture2D(tGravelB, p / 2.6).rgb; gr = mix(gr, vec3(dot(gr, vec3(0.333))), 0.45) * vec3(0.62, 0.64, 0.64); diffuseColor.rgb = mix(diffuseColor.rgb, gr, gv); } } /* grey wet stones, not sand */
  diffuseColor.rgb *= 1.0 - 0.35 * clamp(vlSurf.x * 1.4, 0.0, 1.0) * (1.0 - smoothstep(-0.3, 1.2, vlWorld.y - 0.2));
  // under the near blades the ground is the shaded base of the sward: deep green-brown, never the pale top colour
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.8, 0.6), open * (1.0 - smoothstep(55.0, 70.0, d))); /* the sward's own mid-green under the near clumps, until the cards take over */
  // the distant slopes, per pixel: forest where the ground climbs, alpine pasture in the clearings and up the avalanche paths, the forest
  // thinning toward the treeline; canopy drawn as a fine grain of crowns, so far woods read as woods and no vertex grid shows
  float far = smoothstep(520.0, 900.0, d) * (1.0 - smoothstep(uTreeline - 40.0, uTreeline + 120.0, vlWorld.y)) * smoothstep(30.0, 70.0, vlWorld.y);
  if (far > 0.0) { vec3 n = normalize(vlNormal); float slope = 1.0 - n.y;
    float edgeN = vlFbm(p / 70.0 + 11.0) - 0.5; /* ragged edges: a wood ends tree by tree, not in an airbrushed fade */
    float topF = uTreeline - 50.0 + 160.0 * (vlFbm(p / 520.0) - 0.5) + 70.0 * edgeN; /* a ragged treeline, higher on the spurs */
    float wood = smoothstep(0.25, 0.65, vlSurf.z + 0.35 * edgeN); /* the forest where the trees stand (the same zones that plant them), its edge ragged */
    wood = max(wood, step(0.84, vlNoise(p / 12.0)) * smoothstep(topF + 120.0, topF - 40.0, vlWorld.y) * 0.9); /* lone trees above the forest edge and in the clearings */
    float crowns = vlNoise(p / 9.0) * 0.6 + vlNoise(p / 23.0) * 0.4; vec3 canopy = mix(vec3(0.045, 0.075, 0.04), vec3(0.12, 0.16, 0.075), crowns) * (0.9 + 0.25 * vlFbm(p / 400.0));
    vec3 pasture = mix(vec3(0.24, 0.27, 0.14), vec3(0.33, 0.33, 0.2), vlFbm(p / 260.0)) * (0.85 + 0.25 * vlNoise(p / 25.0)); /* alpine pasture: greyer and darker than valley hay */
    if (uSnowline < 0.0) { pasture = vec3(0.88, 0.9, 0.94) * (0.94 + 0.08 * vlNoise(p / 30.0)); canopy = mix(canopy * 1.1, vec3(0.8, 0.83, 0.88), 0.22 + 0.18 * crowns); } /* winter: pastures under snow, the forest dark with snow on its crowns */
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(pasture, canopy, wood), far); }
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
    // Mountains with personality (the references: 11, 13, 28, 29, 31). The real terrain's local relief (aRelief: the height above or below its
    // 200 m surroundings) drives everything: rock ribs and ridges stand out lighter, couloirs and gullies sink darker; snow fills the couloirs
    // far below the snowline and lies on ledges and gentle ground, while the ribs and steep walls stay bare, dark rock. Rock colour and grain
    // come from a scanned cliff (cliff_side, Poly Haven) at two scales, never a flat tint.
    if (mountain) shader.fragmentShader = shader.fragmentShader.replace(ground ? '/*vl-ground*/' : '#include <color_fragment>', `${ground ? '' : '#include <color_fragment>'}
{ float h = vlWorld.y; vec3 n = normalize(vlNormal); float up = clamp(n.y, 0.0, 1.0); vec2 p = vlWorld.xz;
  float alpine = smoothstep(uTreeline - 80.0, uTreeline + 160.0, h + 120.0 * (vlFbm(p / 400.0) - 0.5)) * uRockOn;
  float rib = smoothstep(1.5, 22.0, vlRelief), cav = smoothstep(1.5, 22.0, -vlRelief);
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z); float wx = w.x / max(w.x + w.z, 1e-3);
  float fine = vlRunnels(vlWorld, wx), coarse = vlGullies(vlWorld, wx); float steep = smoothstep(0.2, 0.6, 1.0 - up);
  float cut = 0.55 * fine + 0.45 * coarse; float gully = smoothstep(0.52, 0.7, cut) * steep, spur = smoothstep(0.46, 0.3, cut) * steep;
  vec3 cliff = (texture2D(tCliff, vlWorld.zy / 70.0).rgb * w.x + texture2D(tCliff, vlWorld.xz / 70.0).rgb * w.y + texture2D(tCliff, vlWorld.xy / 70.0).rgb * w.z);
  vec3 cliff2 = (texture2D(tCliff, vlWorld.zy / 290.0).rgb * w.x + texture2D(tCliff, vlWorld.xz / 290.0).rgb * w.y + texture2D(tCliff, vlWorld.xy / 290.0).rgb * w.z);
  vec3 rock = mix(cliff, cliff2, 0.45); rock = mix(rock, vec3(dot(rock, vec3(0.333))) * vec3(0.95, 0.97, 1.02), 0.62); // gneiss grey, not brown
  rock = mix(rock, rock * vec3(0.74, 0.79, 0.88), smoothstep(uSnowline + 150.0, uSnowline + 650.0, h)); // the high granite: dark blue-grey
  rock *= 0.78 + 0.45 * rib - 0.35 * cav;                                           // lit ribs, shadowed gullies: the relief reads even in backlight
  rock *= (1.0 - 0.2 * gully + 0.1 * spur); rock = mix(rock, rock * vec3(0.85, 0.83, 0.8), 0.35 * gully); // the runnels, water-stained, quietly
  // geology: bedding planes dipping gently across the massif; harder beds stand as cliff bands of their own tone, softer ones weather back
  // into dark ledges where snow and turf catch (the horizontal lines of snow on the reference faces)
  float bed = dot(vlWorld, normalize(vec3(0.18, 1.0, -0.1))) + 70.0 * (vlFbm(p / 420.0) - 0.5) + 18.0 * (vlFbm(p / 90.0) - 0.5); float bw = 40.0 + 34.0 * vlFbm(vec2(bed / 300.0, 1.7)); /* beds of uneven thickness */
  float layer = fract(bed / bw), bedId = floor(bed / bw); float soft = step(0.55, vlHash(vec2(bedId, 3.3))); /* only some beds are soft enough to make a ledge */
  float ledge = smoothstep(0.0, 0.08, layer) * smoothstep(0.26, 0.14, layer) * steep * soft * smoothstep(0.35, 0.6, vlFbm(vec2(dot(p, vec2(0.7, 0.7)) / 70.0, bedId))); /* broken along its length */
  rock *= mix(1.0, 0.86 + 0.28 * vlHash(vec2(bedId, 7.7)), steep) * (1.0 - 0.32 * ledge);
  // scree: grey fans of broken rock on the gentler ground at the foot of the cliffs
  float scree = smoothstep(0.48, 0.6, up) * smoothstep(0.86, 0.74, up) * (1.0 - smoothstep(uTreeline + 600.0, uTreeline + 1000.0, h)) * smoothstep(0.56, 0.72, vlFbm(p / 160.0 + 1.3)) * smoothstep(0.4, 0.7, cav + 0.5 * gully); /* fans in the hollows below the gullies */
  rock = mix(rock, vec3(0.44, 0.44, 0.43) * (0.82 + 0.34 * vlNoise(p / 3.0)), scree * 0.7);
  // alpine grassland above the forest: continuous turf on the gentler ground, giving way to rock along the runnels, on the ribs and where it
  // is steep, so the boundary follows the erosion (vertical) instead of blotches; thinning out 350-650 m above the treeline
  float grassBand = 1.0 - smoothstep(uTreeline + 200.0, uTreeline + 520.0, h + 220.0 * (coarse - 0.5));
  float turf = grassBand * smoothstep(0.25, 0.85, up + 0.4 * (fine - 0.5) + 0.25 * (vlNoise(p / 9.0) - 0.5)) * (1.0 - 0.8 * gully) * (1.0 - 0.5 * rib); /* a fine-grained mix of turf and rock, never blotches */
  vec3 turfCol = mix(vec3(0.15, 0.2, 0.08), vec3(0.24, 0.27, 0.12), vlFbm(p / 180.0)) * (0.85 + 0.3 * vlNoise(p / 20.0));
  // the alpine slope given structure: rock ribs running down the fall line break the turf; dwarf pine and green alder darken the gullies
  // between them; the turf itself in richer and thinner patches
  float ribRock = smoothstep(0.54, 0.64, vlFbm(vec2(p.x / 70.0, h / 600.0) + 4.1) + 0.15 * (fine - 0.5)) * smoothstep(0.05, 0.25, 1.0 - up);
  float shrub = smoothstep(0.52, 0.64, vlFbm(vec2(p.x / 50.0 + 3.0, h / 420.0) + 8.3) + 0.2 * (vlNoise(p / 18.0) - 0.5)) * (1.0 - smoothstep(uTreeline + 200.0, uTreeline + 520.0, h));
  turfCol *= 0.72 + 0.45 * vlFbm(p / 70.0 + 2.0); turfCol = mix(turfCol, vec3(0.06, 0.1, 0.05) * (0.85 + 0.3 * vlNoise(p / 8.0)), shrub * 0.85);
  turf = max(turf * (1.0 - 0.85 * scree) * (1.0 - 0.85 * ribRock), ledge * grassBand * 0.8); rock = mix(rock, turfCol, turf); // turf on the gentler ground and along the ledges, not over the scree
  float line = uSnowline + 380.0 * (vlFbm(p / 620.0) - 0.5) + 140.0 * (vlFbm(p / 140.0) - 0.5);
  float hold = smoothstep(0.42, 0.6, up + 0.14 * (vlFbm(p / 70.0) - 0.5)) * (1.0 - 0.8 * rib * smoothstep(0.85, 0.5, up)); // steep ribs shed it; gentle crests keep it
  float couloir = max(cav * smoothstep(0.15, 0.45, up + 0.25), gully);             // snow fills the gullies and couloirs far below the line
  hold *= smoothstep(0.42, 0.58, vlFbm(p / 110.0 + 4.0) + 0.25 * smoothstep(line, line + 330.0, h)); // below the cap, old snow lies in patches on the shelves, never one sheet
  hold = max(hold, gully * 0.7 * smoothstep(0.4, 0.62, vlFbm(vec2(p.x / 40.0, h / 300.0) + 5.0))) * (1.0 - 0.9 * spur * smoothstep(0.55, 0.3, up)); // snow in some of the runnels, broken, dark ribs between
  hold = max(hold, ledge * 0.85); // and broken lines of snow along the soft ledges
  float snow = smoothstep(line - 25.0, line + 25.0, h + 380.0 * couloir + 90.0 * (fine - 0.5)) * max(hold, couloir * 0.9);
  float cap = smoothstep(line + 330.0, line + 520.0, h + 220.0 * (coarse - 0.5)) * smoothstep(0.6, 0.72, up + 0.12 * (vlFbm(p / 50.0) - 0.5)); // the cap: white over the top, but no snow holds on faces steeper than about 60 degrees: the horns stand dark
  cap *= 1.0 - 0.92 * max(spur, rib * 0.7) * smoothstep(0.62, 0.32, up);        // the ribs and steep rock break through it
  snow = max(snow, cap);
  vec3 snowCol = vec3(0.8, 0.83, 0.88) * (0.82 + 0.3 * texture2D(tSnowS, p / 30.0).r) * (0.9 + 0.12 * vlFbm(p / 18.0)); // snow with its own grain
  snowCol *= 0.86 + 0.22 * rib - 0.16 * cav; snowCol = mix(snowCol, snowCol * vec3(0.86, 0.9, 1.0), cav * 0.6);         // bright on the crests, blue-grey in the hollows
  snow *= 1.0 - 0.55 * smoothstep(0.62, 0.8, vlFbm(p / 22.0 + 7.0)) * smoothstep(0.5, 0.3, up); // rocks poke through the steeper snow
  float flat_ = smoothstep(0.62, 0.85, up); float crev = smoothstep(0.62, 0.8, vlNoise(vec2(dot(p, normalize(n.xz + 1e-4)) / 9.0, dot(p, vec2(-n.z, n.x)) / 70.0))) * flat_;
  snowCol *= 1.0 - 0.35 * crev; snowCol = mix(snowCol, snowCol * vec3(0.86, 0.85, 0.83), flat_ * smoothstep(line + 500.0, line + 150.0, h) * (0.5 + 0.5 * vlFbm(p / 60.0))); // crevasses, and old grey snow toward the foot
  { vec2 fl = normalize(n.xz + 1e-4); float across = dot(p, vec2(-fl.y, fl.x)), along = dot(p, fl); /* the glacier: patchy old snow and ice, and dark moraine lines running down its flow */
    float moraine = smoothstep(0.64, 0.7, vlFbm(vec2(across / 110.0, along / 1800.0) + 2.3)) * flat_;
    snowCol *= mix(1.0, 0.82 + 0.26 * vlFbm(p / 240.0), flat_); snowCol = mix(snowCol, vec3(0.32, 0.31, 0.3), moraine * 0.75); }
  vec3 alp = mix(rock, snowCol, snow);
  diffuseColor.rgb = mix(diffuseColor.rgb, alp, alpine); }`);
    if (mountain) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec3 nW = normalize(vlNormal); float steepW = smoothstep(0.2, 0.6, 1.0 - clamp(nW.y, 0.0, 1.0)) * smoothstep(9000.0, 4000.0, length(vlWorld - cameraPosition) - 9000.0);
  if (steepW > 0.0) { vec3 wW = pow(abs(nW), vec3(4.0)); float wxW = wW.x / max(wW.x + wW.z, 1e-3); vec3 e = vec3(4.0, 0.0, 0.0);
    float dx = 0.55 * (vlRunnels(vlWorld + e, wxW) - vlRunnels(vlWorld - e, wxW)) + 0.45 * (vlGullies(vlWorld + e * 3.0, wxW) - vlGullies(vlWorld - e * 3.0, wxW)) * 0.5;
    float dz = 0.55 * (vlRunnels(vlWorld + e.yyx, wxW) - vlRunnels(vlWorld - e.yyx, wxW)) + 0.45 * (vlGullies(vlWorld + e.yyx * 3.0, wxW) - vlGullies(vlWorld - e.yyx * 3.0, wxW)) * 0.5;
    nW = normalize(nW - vec3(dx * (1.0 - wxW), 0.0, dz * wxW) * 2.5 * steepW); normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz); } }`);
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
  float edge = pow(1.0 - abs(dot(nn, vv)), 1.5); float day = smoothstep(-0.06, 0.04, uSunDir.y); float low = 1.0 - smoothstep(0.05, 0.3, uSunDir.y); /* a low sun shines through grass the most */
  outgoingLight += diffuseColor.rgb * uHaze * 0.22 * ${glow.toFixed(3)} * day; /* the bright sky and haze around the low sun light the blades from every side */ }
#include <opaque_fragment>`);
    // the light through the blades and needles is sunlight, so it belongs inside the sun's own lighting, where a shadow cuts it off:
    // that is what draws the long shadows across a meadow seen against the sun
    // and cloud shadows: the sun's light is dimmed where the cloud layer (clouds.js, the same pattern) lies between the ground and the sun
    if (material.isMeshLambertMaterial) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;', `vec3 irradiance = dotNL * directLight.color;
  ${glow > 0 ? `{ float fwdG = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0); float edgeG = pow(1.0 - abs(dot(geometryNormal, geometryViewDir)), 1.5);
    float lowG = 1.0 - smoothstep(0.05, 0.3, uSunDir.y); irradiance += directLight.color * fwdG * (0.35 + 0.65 * edgeG) * ${glow.toFixed(3)} * (1.0 + 1.6 * lowG) * 1.1; }` : ''}
  irradiance *= vlCloudShade(vlWorld);`));
  };
  material.customProgramCacheKey = () => `valley-look-${mountain ? 'mountain' : 'plain'}-${ground ? 'g' : ''}${glow}-${surface ?? ''}`;
  return material;
}

// per mood: the haze colour and strength, and the light scattered toward the sun
export function setLook({ sunDir, sunCol, haze, density, glow, snowline, treeline }) {
  if (sunDir) LOOK.uSunDir.value.copy(sunDir); if (sunCol) LOOK.uSunCol.value.set(sunCol); if (haze) LOOK.uHaze.value.set(haze);
  if (density) LOOK.uDensity.value = density; if (glow !== undefined) LOOK.uGlow.value = glow; if (snowline !== undefined) LOOK.uSnowline.value = snowline; if (treeline !== undefined) LOOK.uTreeline.value = treeline;
}

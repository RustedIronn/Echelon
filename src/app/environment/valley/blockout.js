import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { applyValleyLook, setLook, LOOK } from './look.js';
import { buildForest } from './trees.js';
import { planGrass, buildGrass, planBlades, buildBlades, WIND } from './grass.js';
import { buildClouds } from './clouds.js';
import { buildBirds, buildSmoke } from './motion.js';
import { buildMeadow } from './meadow.js';
import { alpineHouse, chapel } from './buildings.js';
import { buildPath, footbridge } from './paths.js';
let TREE_LIST = [];
const LOOK_ON = Q_LOOK();
function Q_LOOK() { return typeof window === 'undefined' || new URLSearchParams(window.location.search).get('look') !== 'blockout'; } // ?look=blockout for the flat block-out
// the land is exposed for its shadowed faces (the camera looks into the light); the sky keeps its own brightness
const LAND_EXPOSURE = 1.75;
const lookMat = (m, o) => (LOOK_ON ? applyValleyLook(m, o) : m);

// The valley block-out (docs/WORLD-SPEC.md, build step 1): grey-box land at true scale, colour masses for the zones, water shapes, hamlet
// blocks and the composed sun and moon, built backwards from one frame. Nothing here is final art; it exists to lock the composition.
//
// World axes: the camera stands at the origin on its knoll, 8 m above the lake (y = 0 is the lake surface), and looks along -z (roughly
// south). Azimuth is measured from the view direction, positive to the right: a point at (azimuth a, distance r) is (r sin a, h, -r cos a).

const Q = new URLSearchParams(window.location.search);
const DEG = Math.PI / 180;
export const FRAME = { eye: 9.7, vfov: 32, pitch: 1.64 }; // pitch lifts the horizon to y = 0.55 of the frame
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const toXZ = (az, r) => [r * Math.sin(az * DEG), -r * Math.cos(az * DEG)];

// value noise and fbm, for breaking up the designed shapes
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
function noise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), sx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy); }
function fbm(x, y, oct = 5) { let a = 0, f = 1, w = 0.5, n = 0; for (let i = 0; i < oct; i += 1) { a += w * noise(x * f, y * f); n += w; f *= 2.03; w *= 0.5; } return a / n; }
const ridged = (x, y, oct = 5) => { let a = 0, f = 1, w = 0.5, n = 0; for (let i = 0; i < oct; i += 1) { a += w * (1 - Math.abs(noise(x * f, y * f) * 2 - 1)); n += w; f *= 2.1; w *= 0.5; } return a / n; };

// The skyline, designed in the frame: [azimuth, elevation of the crest seen from the camera (degrees), crest distance (m)].
// The sunrise pass is the low notch at -26.5, the main peak stands at +12.4, the sunset saddle is the notch at +30.4.
const RANGE = [[-62, 6, 6000], [-45, 6.5, 6500], [-35, 7.8, 6800], [-29.5, 5.6, 7200], [-26.5, 4.3, 7400], [-23.5, 5.8, 7400], [-18, 8.2, 8000], [-8, 9.6, 9000], [0, 8.4, 9500],
  [6, 10.2, 8800], [10, 12.6, 8200], [12.4, 13.9, 8000], [15, 12.2, 8100], [19, 9.8, 8200], [24, 8.6, 8000], [27.8, 6.4, 7900], [30.4, 5.1, 7800], [33, 6.6, 7400], [38, 7.6, 7000], [48, 7.2, 6500], [62, 6.5, 6000]];
// the forested foothills in front of the range (the slopes layer), kept below the pass and the saddle
const FOOT = [[-62, 7, 2400], [-45, 6, 2600], [-36, 4.8, 2900], [-27, 2.6, 3200], [-18, 3.6, 3300], [-8, 2.6, 3600], [0, 1.4, 4000], [8, 1.3, 3800], [16, 1.6, 3400], [24, 3.2, 3100], [30.5, 3.0, 3000], [38, 5.2, 2700], [62, 7, 2300]];
function profile(table, az) { if (az <= table[0][0]) return table[0]; for (let i = 1; i < table.length; i += 1) if (az <= table[i][0]) { const a = table[i - 1], b = table[i], t = (az - a[0]) / (b[0] - a[0]), s = t * t * (3 - 2 * t); return [az, lerp(a[1], b[1], s), lerp(a[2], b[2], s)]; } return table[table.length - 1]; }

// water and settlements (metres)
export const LAKE = { x: -52, z: -150, rx: 62, rz: 98, rot: -0.18 };
export const RIVER = [[760, -1300], [470, -760], [300, -470], [190, -300], [95, -285], [52, -330], [12, -262], [38, -196], [8, -150], [-14, -118]].map(([x, z]) => new THREE.Vector2(x, z));
const riverCurve = new THREE.SplineCurve(RIVER); const riverPts = riverCurve.getSpacedPoints(400);
export const LOWER = { x: 60, z: -345 }; // the mill stands on the river bank // the working group: mill on the river, farm, barn
export const UPPER = { ...(() => { const [x, z] = toXZ(13.2, 430); return { x, z }; })(), y: 22 }; // the old heart on its terrace, near enough to read as a home
export const HUTS = [[-150, -430], [-260, -760], [255, -560], [372, -410]];
// the building sites (x, z, radius): the ground is levelled under each (heightAt), so no house sinks or stands on a tall plinth, and the
// meadow keeps off them; the same places buildSettlements builds on
export const SITES = [[LOWER.x - 10, LOWER.z + 12, 7], [LOWER.x - 28, LOWER.z + 4, 9], [LOWER.x - 46, LOWER.z - 16, 11], [UPPER.x - 2, UPPER.z + 26, 13],
  ...[[-34, 14], [-60, -2], [28, 18], [54, 2], [-20, -24], [12, -30]].map(([dx, dz]) => [UPPER.x + dx, UPPER.z + dz, 9]), [UPPER.x + 80, UPPER.z - 12, 8], ...HUTS.map(([x, z]) => [x, z, 4.5])];
// the footpath from the foreground through the meadow, along the east bank to the mill, and over the footbridge to the farm
export const FOOTPATH = new THREE.SplineCurve([[6, -40], [30, -110], [60, -200], [72, -260], [60, -316], [44, -330], [33, -337]].map(([x, z]) => new THREE.Vector2(x, z))).getSpacedPoints(200);
export const HERO_TREE = [-118, -360];
// the track: from the mill up the slope to the chapel, worn into the turf
export const TRACK = new THREE.SplineCurve([[LOWER.x + 6, LOWER.z - 8], [LOWER.x + 40, LOWER.z - 30], [LOWER.x + 52, LOWER.z - 60], [UPPER.x - 30, UPPER.z + 90], [UPPER.x - 8, UPPER.z + 40]].map(([x, z]) => new THREE.Vector2(x, z))).getSpacedPoints(120);
function polyDistance(pts, x, z) { let best = Infinity; for (let i = 0; i < pts.length - 1; i += 1) { const a = pts[i], b = pts[i + 1]; const abx = b.x - a.x, abz = b.y - a.y; const t = clamp(((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz), 0, 1); best = Math.min(best, Math.hypot(x - a.x - abx * t, z - a.y - abz * t)); } return best; }
// fields: a mosaic of irregular plots (jittered cells about 110 m across), each mown or grazed on its own rhythm, so the floor reads as land
// that people use rather than one carpet; the seams between plots are slightly darker, the line a fence or a ditch would leave
function fieldAt(x, z) { const s = 110, cx = Math.floor(x / s), cz = Math.floor(z / s); let d1 = Infinity, d2 = Infinity, id = 0;
  for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= 1; i += 1) { const gx = cx + i, gz = cz + j; const px = (gx + 0.15 + 0.7 * hash(gx, gz)) * s, pz = (gz + 0.15 + 0.7 * hash(gz + 17, gx)) * s; const d = Math.hypot(x - px, z - pz); if (d < d1) { d2 = d1; d1 = d; id = hash(gx * 3.1, gz * 7.7); } else if (d < d2) d2 = d; }
  return { id, seam: 1 - smooth(1.5, 6, d2 - d1) }; }
const inLake = (x, z) => { const c = Math.cos(LAKE.rot), s = Math.sin(LAKE.rot), dx = x - LAKE.x, dz = z - LAKE.z; const u = (dx * c - dz * s) / LAKE.rx, v = (dx * s + dz * c) / LAKE.rz; return u * u + v * v; };
function riverDistance(x, z) { let best = Infinity, along = 0; for (let i = 0; i < riverPts.length - 1; i += 1) { const a = riverPts[i], b = riverPts[i + 1]; const abx = b.x - a.x, abz = b.y - a.y; const t = clamp(((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz), 0, 1); const d = Math.hypot(x - a.x - abx * t, z - a.y - abz * t); if (d < best) { best = d; along = (i + t) / (riverPts.length - 1); } } return [best, along]; }

// The land: the valley floor (lake level, rising gently to the south), the camera's knoll, the upper hamlet's terrace, the valley sides,
// the foothills and the range, combined with a smooth maximum; the river and the lake are cut in.
function reshapeAt(az) { if (!RESHAPE) return 1; const f = clamp((az + 60) / 0.25, 0, RESHAPE.length - 1), i = Math.floor(f), t = f - i; return lerp(RESHAPE[i], RESHAPE[Math.min(i + 1, RESHAPE.length - 1)], t); }
const smax = (a, b, k) => (b <= a ? a : a + (b - a) * smooth(0, k, b - a)); // a soft maximum that never lifts the ground where the shapes are level

// The real massif (docs/WORLD-SPEC.md section 4): Copernicus GLO-30 elevation of the Dom/Mischabel group (Valais), placed so that seen from
// our camera it stands exactly where the designed main peak stands, at its true distance of 12 km (from there it rises 13.9 degrees, the
// designed height, at 1:1 scale). World azimuth a maps to the compass bearing 180 + a - 12.4 from a viewpoint 12 km north of the summit;
// the lake is at 1,500 m. Terrain more than about 8 km from the summit is masked off so the real Saas and Matter ridges do not block it.
// ?dem=0 shows the procedural range instead.
export const MASSIF = { az: 12.4, distance: 12000, lakeAltitude: 1500 };
let DEM = null;
let RESHAPE = null; // per-azimuth vertical stretch of the real heights, so the massif's outline follows the designed skyline (RANGE)
export async function loadDem(url = '/design-reference/world-redesign/dem/dom') {
  if (Q.get('dem') === '0') return null;
  try { const [meta, buf] = await Promise.all([fetch(url + '.json').then((r) => r.json()), fetch(url + '.f32').then((r) => r.arrayBuffer())]);
    const mLat = 111320, mLon = 111320 * Math.cos(meta.summit[0] * DEG); DEM = { meta, data: new Float32Array(buf), blur: null, mLat, mLon, vLat: meta.summit[0] + MASSIF.distance / mLat, vLon: meta.summit[1], summit: toXZ(MASSIF.az, MASSIF.distance) }; DEM.blur = blurGrid(DEM.data, meta.width, meta.height, 7); return DEM; } catch { return null; }
}
// the terrain's local relief: the real height minus its smoothed surroundings (about 200 m), exaggerated so ridges stand sharper and
// couloirs cut deeper, the way the eye remembers mountains; the overall shape and the summit stay where the data puts them
const RELIEF = Number(Q.get('relief3d') ?? 2.4);
function blurGrid(src, w, h, r) { const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass += 1) { const a = pass ? out : src;
    for (let y = 0; y < h; y += 1) { let acc = 0; for (let x = -r; x <= r; x += 1) acc += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x += 1) { tmp[y * w + x] = acc / (2 * r + 1); acc += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x += 1) { let acc = 0; for (let y = -r; y <= r; y += 1) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y += 1) { out[y * w + x] = acc / (2 * r + 1); acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } } }
  return out; }
let DEM_RELIEF_OUT = 0;
function demHeight(x, z) {
  if (!DEM) return NaN; const r = Math.hypot(x, z), b = (180 + Math.atan2(x, -z) / DEG - MASSIF.az) * DEG; const lat = DEM.vLat + (r * Math.cos(b)) / DEM.mLat, lon = DEM.vLon + (r * Math.sin(b)) / DEM.mLon;
  const m = DEM.meta, fx = (lon - m.west) / m.dLon, fy = (m.north - lat) / m.dLat, ix = Math.floor(fx), iy = Math.floor(fy); if (ix < 0 || iy < 0 || ix >= m.width - 1 || iy >= m.height - 1) return NaN;
  const tx = fx - ix, ty = fy - iy, i = iy * m.width + ix; const bil = (d) => (d[i] * (1 - tx) + d[i + 1] * tx) * (1 - ty) + (d[i + m.width] * (1 - tx) + d[i + m.width + 1] * tx) * ty;
  const raw = bil(DEM.data), smooth0 = bil(DEM.blur); DEM_RELIEF_OUT = (raw - smooth0) * RELIEF; return smooth0 + DEM_RELIEF_OUT - MASSIF.lakeAltitude;
}
const demWeight = (x, z) => { if (!DEM) return 0; const s = Math.hypot(x - DEM.summit[0], z - DEM.summit[1]); return (1 - smooth(4000, 6500, s)) * smooth(5000, 7000, Math.hypot(x, z)); }; /* the summit block only: the real ridges north of it would stand in front */
export function heightAt(x, z, cheap = false, noPads = false) {
  const r = Math.hypot(x, z), az = Math.atan2(x, -z) / DEG;
  let h = 1.2 + 0.012 * Math.max(0, -z) + 3 * (fbm(x / 140, z / 140, 3) - 0.5); // the floor
  h = smax(h, 8 * (1 - smooth(0, 44, r)), 3); // the knoll under the camera, its foot blending into the meadow without a crease
  { const d = Math.hypot(x - UPPER.x, z - UPPER.z); h = smax(h, UPPER.y * (1 - smooth(62, 140, d)) + 6 * (fbm(x / 60, z / 60, 2) - 0.5) * smooth(55, 95, d) /* a level top to build on */, 12); } // the terrace
  const f = profile(FOOT, az); const fh = Math.tan(f[1] * DEG) * f[2] + FRAME.eye - 8;
  const side = Math.abs(x - 60 - 0.08 * -z) - 560; if (side > 0) h = smax(h, Math.min(side * 0.42, Math.tan(f[1] * DEG) * r * 0.92) * (0.8 + 0.4 * fbm(x / 400, z / 400, 3)), 30); /* valley sides, never above the designed foothill skyline */
  h = smax(h, fh * smooth(f[2] - 2600, f[2], r) * (1 - 0.6 * smooth(f[2] + 600, f[2] + 2600, r)) * (0.82 + 0.36 * fbm(x / 700, z / 700, cheap ? 2 : 4)), 60);
  const m = profile(RANGE, az); const mh = Math.tan(m[1] * DEG) * m[2] + FRAME.eye; const crest = smooth(m[2] - 5200, m[2], r) * (1 - smooth(m[2], m[2] + 3500, r));
  let mountain = mh * crest * (0.74 + 0.3 * ridged(x / 1500, z / 1500, cheap ? 2 : 5)); const wd = demWeight(x, z); if (wd > 0) { const dh = demHeight(x, z); if (Number.isFinite(dh)) mountain = lerp(mountain, dh * reshapeAt(az), wd); }
  h = smax(h, mountain, 120);
  if (!noPads) for (const site of SITES) { const d = Math.hypot(x - site[0], z - site[1]); if (d < site[2] + 16) { if (site[3] === undefined) site[3] = heightAt(site[0], site[1], true, true); h = lerp(site[3], h, smooth(site[2] + 1, site[2] + 16, d)); } } // the building pads
  if (!cheap) { const [d] = riverDistance(x, z); h -= 2.2 * (1 - smooth(5, 16, d)); }
  const l = inLake(x, z); if (l < 1.26) h = Math.min(lerp(-2.5, -0.3, smooth(0.9, 1.26, l)), h); else if (l < 1.9) h = lerp(0.05, Math.max(h, 0.25), smooth(1.26, 1.5, l)); /* under the water inside its outline, a low bank rising just outside */ /* the bed stays under the water to the very edge of the lake, then a low shore */
  return h;
}

const C = (hex) => new THREE.Color(hex);
// the grass zones take the scanned meadow's own albedo (the mean of the baked strips, #5b6439), so the far valley floor is the same
// meadow as the near one, not a lime lawn; the land gets more light instead (LAND_LIGHT)
const ZONE = { meadow: C('#646c3d'), hay: C('#6f6f41'), pasture: C('#56673a'), shore: C('#525e38'), forest: C('#2c4429'), larch: C('#4a6435'), scree: C('#8b8a84'), rock: C('#6f6e6a'), snow: C('#eef1f4'), gravel: C('#a8a49a'), terrace: C('#646c3d'), track: C('#9a8e6c'), wet: C('#4c5f35'), dry: C('#76744a'), mown: C('#7e7c4c') };
const LAND_LIGHT = 1.3;
const SNOWLINE = Q.get('season') === 'winter' ? 120 : Q.get('season') === 'spring' ? 900 : 1500;
export const SURF = [0, 0, 0]; // set by zoneColour: gravel, track and forest-floor weights for the ground textures
function zoneColour(x, h, z, slope) {
  SURF[0] = 0; SURF[1] = 0; SURF[2] = 0;
  const r = Math.hypot(x, z); const n = fbm(x / 90, z / 90, 3);
  if (h > SNOWLINE + 260 * (n - 0.5) && slope < 1.25) return ZONE.snow;
  if (slope > 1.0 || h > 1100) return h > 1100 && slope < 0.7 ? ZONE.scree : ZONE.rock;
  if (h > 640 + 160 * (n - 0.5)) return ZONE.scree.clone().lerp(ZONE.pasture, 0.55); // above the treeline: alpine pasture over scree
  if (Math.hypot(x - UPPER.x - 15, z - UPPER.z + 235) < 135 && Math.hypot(x - UPPER.x, z - UPPER.z) > 125) { SURF[2] = 1; return n > 0.6 ? ZONE.larch : ZONE.forest; } // the wood behind the chapel terrace: a dark ground for the white tower
  if (slope > 0.22 && h > 48) { /* forest from the valley sides up; the terrace banks stay open meadow */ const avalanche = Math.abs(Math.sin(x / 260 + fbm(x / 500, z / 500, 2) * 6)) < 0.12; if (avalanche) return ZONE.meadow.clone().lerp(ZONE.scree, 0.3); SURF[2] = 1; return n > 0.62 || h > 470 ? ZONE.larch : ZONE.forest; }
  if (Q.get('season') === 'winter' && h < 640) { const [dw] = r < 1600 ? riverDistance(x, z) : [Infinity]; if (dw > 9) return ZONE.snow.clone().multiplyScalar(0.94 + 0.06 * n); } // winter: the whole valley floor under snow, the river open
  const [d] = r < 1600 ? riverDistance(x, z) : [Infinity]; if (d < 13) { SURF[0] = 1 - smooth(5, 13, d); return ZONE.gravel.clone().lerp(ZONE.shore, smooth(5, 13, d)); }
  if (inLake(x, z) < 1.5) return ZONE.shore;
  if (Math.hypot(x - UPPER.x, z - UPPER.z) < 110) return ZONE.terrace;
  if (r < 75) return ZONE.dry.clone().lerp(ZONE.meadow, 0.4 * n + 0.6 * smooth(40, 75, r)); // the knoll: thin dry turf, fading into the meadow
  // the plots themselves are drawn per pixel by the ground shader (look.js); here only the broad use and the wet ground along the water,
  // blended smoothly so no vertex grid shows
  const base = ZONE.hay.clone().lerp(ZONE.pasture, smooth(0, 90, x)).lerp(ZONE.meadow, 0.25 * n);
  const wet = Math.max(1 - smooth(18, 85, d), 1 - smooth(1.5, 3.4, inLake(x, z))); return base.lerp(ZONE.wet, 0.75 * wet); // rushes, marsh marigold
}

// a polar grid round the camera: fine near, coarse far, within the view and a margin
function buildTerrain() {
  const A = 561, R = 500, r0 = 3, r1 = 16000; /* finer: about 0.2 degrees and 1.7% in range, so slopes keep their small ridges and gullies */ const trees = []; const pos = new Float32Array(A * R * 3), col = new Float32Array(A * R * 3), surf = new Float32Array(A * R * 3);
  for (let j = 0; j < R; j += 1) { const r = r0 * (r1 / r0) ** (j / (R - 1)); for (let i = 0; i < A; i += 1) { const az = -58 + (116 * i) / (A - 1); const [x, z] = toXZ(az, r); const h = heightAt(x, z) - (r > 5600 && demWeight(x, z) > 0.2 ? 320 * smooth(0.2, 0.4, demWeight(x, z)) : 0); /* under the massif mesh */ const e = Math.max(2, r * 0.004);
    const slope = Math.hypot(heightAt(x + e, z, true) - heightAt(x - e, z, true), heightAt(x, z + e, true) - heightAt(x, z - e, true)) / (2 * e); const k = (j * A + i) * 3; pos[k] = x; pos[k + 1] = h; pos[k + 2] = z; const c = zoneColour(x, h, z, slope); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; surf[k] = SURF[0]; surf[k + 1] = SURF[1]; surf[k + 2] = SURF[2];
    if ((c === ZONE.forest || c === ZONE.larch) && r > 120 && r < 9000 && trees.length < 640000) { const cell = (r * 116 * DEG / (A - 1)) * (r * Math.log(r1 / r0) / (R - 1)); let count = cell / (75 + 0.02 * Math.max(0, r - 2600)); /* the far slopes wooded tree by tree, a little sparser with distance */ while (count > 0) { if (count >= 1 || hash(i * 7.1 + count, j * 3.3) < count) trees.push(x + (hash(i, j + count) - 0.5) * r * 0.005, z + (hash(j, i + count) - 0.5) * r * 0.02, c === ZONE.larch ? 1 : 0, hash(i + count, j)); count -= 1; } } } }
  const idx = []; for (let j = 0; j < R - 1; j += 1) for (let i = 0; i < A - 1; i += 1) { const a = j * A + i, b = a + 1, c = a + A, d = c + 1; idx.push(a, b, c, b, d, c); /* counter-clockwise seen from above */ }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3)); g.setAttribute('aRelief', new THREE.BufferAttribute(new Float32Array(pos.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, lookMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { mountain: true, ground: true, glow: 0.55 })); mesh.name = 'blockout terrain'; TREE_LIST = trees; return mesh;
}

// The still lake: a true mirror where the air is calm, broken where a breath of wind crosses it (cat's-paws), and darker teal water seen
// when looking down near the shore, more mirror toward the far side (Fresnel).
const LAKE_SHADER = {
  name: 'ValleyLake', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
#include <common>
void main() { vUv = textureMatrix * vec4(position, 1.0); vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime; varying vec4 vUv; varying vec3 vWorld;
float lh(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float ln(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(lh(i),lh(i+vec2(1,0)),f.x),mix(lh(i+vec2(0,1)),lh(i+vec2(1,1)),f.x),f.y); }
float lf(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*ln(p); p=p*2.1+3.7; a*=0.5; } return s; }
void main() {
  vec2 p = vWorld.xz; float paws = smoothstep(0.5, 0.72, lf(p * 0.025)); // where a breath of wind is crossing
  vec2 rp = p * vec2(0.9, 2.6) + vec2(uTime * 0.35, uTime * 0.12); vec2 ripple = vec2(lf(rp), lf(rp + 7.3)) - 0.5; /* the ripples move */
  vec4 uv = vUv; uv.xy += ripple * (0.004 + 0.03 * paws) * uv.w;
  vec3 refl = texture2DProj(tDiffuse, uv).rgb;
  vec3 v = normalize(cameraPosition - vWorld); float f = 0.02 + 0.98 * pow(1.0 - clamp(v.y, 0.0, 1.0), 5.0);
  vec3 body = vec3(0.035, 0.07, 0.065);
  gl_FragColor = vec4(mix(body, refl * (0.92 - 0.12 * paws), clamp(f * 1.15 + 0.12, 0.0, 1.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
};
function buildWater() {
  const group = new THREE.Group();
  const lakeGeo = new THREE.CircleGeometry(1, 96); lakeGeo.scale(LAKE.rx * 1.12, LAKE.rz * 1.12, 1); /* the Reflector takes its plane from the mesh: geometry stays in XY, the mesh is laid flat */
  const lake = new Reflector(lakeGeo, { textureWidth: 2048, textureHeight: 1024, color: 0x8a9aa4, shader: LOOK_ON ? LAKE_SHADER : undefined }); lake.position.set(LAKE.x, 0, LAKE.z); lake.name = 'lake'; lake.rotation.set(-Math.PI / 2, 0, LAKE.rot); group.add(lake);
  // the river as a ribbon following the course, wider toward the lake
  const P = [], I = []; for (let i = 0; i < riverPts.length; i += 1) { const p = riverPts[i], q = riverPts[Math.min(i + 1, riverPts.length - 1)], o = riverPts[Math.max(i - 1, 0)]; const tx = q.x - o.x, tz = q.y - o.y, l = Math.hypot(tx, tz) || 1; const w = lerp(3.2, 5.5, i / riverPts.length);
    const y = inLake(p.x, p.y) < 1.15 ? -0.4 : heightAt(p.x, p.y, true) - 0.9; /* where it enters the lake the river sinks under the still water */ const yy = y < -0.1 ? y : Math.max(0.05, y); P.push(p.x - (tz / l) * w, yy, p.y + (tx / l) * w, p.x + (tz / l) * w, yy, p.y - (tx / l) * w); if (i) { const a = (i - 1) * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.setIndex(I); rg.computeVertexNormals();
  const riverMat = lookMat(new THREE.MeshStandardMaterial({ color: 0x4f9c9c, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide }));
  if (LOOK_ON) { const look = riverMat.onBeforeCompile; riverMat.onBeforeCompile = (sh, r) => { look(sh, r); // glacial water: milky turquoise, broken by white water where it runs over stones
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 p = vlWorld.xz; float riffle = smoothstep(0.58, 0.78, vlFbm(p * 0.22 + vec2(0.0, vlFbm(p * 0.05) * 4.0))); float silt = vlFbm(p * 0.04);
  diffuseColor.rgb = mix(diffuseColor.rgb * (0.85 + 0.3 * silt), vec3(0.8, 0.9, 0.9), riffle * 0.45); }`); }; riverMat.customProgramCacheKey = () => 'valley-river'; }
  group.add(new THREE.Mesh(rg, riverMat));
  // stones: the glacial river's grey cobbles and boulders along its banks and on the bars at the bends, and a scatter on the lake shore;
  // rounded, half buried, pale where dry and darker at the waterline
  if (LOOK_ON && Q.get('stones') !== '0') {
    const geo = new THREE.IcosahedronGeometry(1, 1); const pos = geo.attributes.position; for (let i = 0; i < pos.count; i += 1) { const k = 0.82 + 0.3 * hash(i * 1.7, 3.1); pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.62, pos.getZ(i) * k); } geo.computeVertexNormals();
    const sites = []; for (let i = 0; i < riverPts.length - 1; i += 1) { const p = riverPts[i], q = riverPts[i + 1]; const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1; const w = lerp(3.2, 5.5, i / riverPts.length);
      for (let k = 0; k < 5; k += 1) { const side = hash(i, k) < 0.5 ? -1 : 1; const off = side * (w * (0.75 + 0.9 * hash(k, i)) + 2.2 * hash(i + k, 9)); const x = p.x + (-tz / l) * off, z = p.y + (tx / l) * off; if (Math.hypot(x, z) > 1400) continue;
        sites.push([x, z, 0.25 + 1.1 * hash(i * 3 + k, 5) ** 2.2]); } }
    for (let i = 0; i < 90; i += 1) { const a = hash(i, 41) * 6.283; const c = Math.cos(LAKE.rot), s = Math.sin(LAKE.rot); const u = Math.cos(a) * LAKE.rx * (1.08 + 0.12 * hash(i, 42)), v = Math.sin(a) * LAKE.rz * (1.08 + 0.12 * hash(i, 43)); sites.push([LAKE.x + u * c + v * s, LAKE.z - u * s + v * c, 0.2 + 0.7 * hash(i, 44) ** 2]); }
    const mesh = new THREE.InstancedMesh(geo, lookMat(new THREE.MeshLambertMaterial({ color: '#c9c5bb' })), sites.length); const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    sites.forEach(([x, z, r], i) => { e.set(hash(i, 1) * 0.6, hash(i, 2) * 6.28, hash(i, 3) * 0.6); qq.setFromEuler(e); m.compose(new THREE.Vector3(x, Math.max(heightAt(x, z, true), 0) - r * 0.25, z), qq, new THREE.Vector3(r * (0.8 + 0.5 * hash(i, 4)), r, r * (0.8 + 0.5 * hash(i, 5)))); mesh.setMatrixAt(i, m); mesh.setColorAt(i, col.setScalar(0.72 + 0.4 * hash(i, 6))); });
    mesh.instanceMatrix.needsUpdate = true; mesh.name = 'river stones'; group.add(mesh);
  }
  return group;
}

// The hamlet (buildings.js): every building faces the camera, its front with the balcony and windows toward the viewer and turned a little
// each, seated on the highest ground under its footprint, the stone plinth taking up the slope; the windows light when it gets dark
const LAMPS = ["dusk", "night"].includes(Q.get("tod")) ? Q.get("tod") : null;
function buildSettlements() {
  const group = new THREE.Group();
  const place = (o, x, z, turn = 0) => { const yaw = Math.atan2(-x, -z) + turn; const [fw, fd] = o.userData.foot ?? [6, 6]; const c = Math.cos(yaw), s = Math.sin(yaw); let top = -Infinity;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) { const lx = (u * fw) / 2, lz = (v * fd) / 2; top = Math.max(top, heightAt(x + lx * c + lz * s, z - lx * s + lz * c, true)); }
    o.position.set(x, top + 0.05, z); o.rotation.y = yaw; group.add(o); return o; };
  // the lower group by the river: the mill on the water, the farmhouse, the barn
  place(alpineHouse(9, 7, { seed: 1, stoneFloor: true, lamps: LAMPS }), LOWER.x - 10, LOWER.z + 12, 0.25); /* the mill */
  place(alpineHouse(12, 10, { seed: 2, lamps: LAMPS }), LOWER.x - 28, LOWER.z + 4, -0.15); /* the farmhouse */
  place(alpineHouse(15, 11, { seed: 3, barn: true, low: 3.2, high: 4.4 }), LOWER.x - 46, LOWER.z - 16, 0.55); /* the barn and hay loft */
  // the upper group: the chapel at the front of the terrace, the focal point, its tower toward the valley; houses beside and behind it, lower
  place(chapel(), UPPER.x - 2, UPPER.z + 26, 0.1);
  [[-34, 14, 0.2], [-60, -2, -0.15], [28, 18, -0.25], [54, 2, 0.3], [-20, -24, 0.1], [12, -30, -0.2]].forEach(([dx, dz, t], i) => place(alpineHouse(10 + (i % 3) * 2, 8 + (i % 2) * 2, { seed: i + 4, stoneFloor: i % 3 === 1, low: 3 + (i % 2) * 0.4, lamps: LAMPS, wood: i % 2 ? '#e8e2da' : '#ffffff' }), UPPER.x + dx, UPPER.z + dz, t));
  place(alpineHouse(9, 8, { seed: 11, barn: true, low: 2.6, high: 3.6 }), UPPER.x + 80, UPPER.z - 12, 0.5); /* the upper barn */
  HUTS.forEach(([x, z], i) => place(alpineHouse(5, 4, { seed: 20 + i, barn: true, low: 1.0, high: 2.4, pitch: 0.5 }), x, z, (hash(i, 3) - 0.5) * 1.2)); /* hay huts out in the meadows */
  // the hero tree: a dark mass on a trunk
  const tree = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 8), lookMat(new THREE.MeshLambertMaterial({ color: '#4a3c2e' }))); trunk.position.y = 4; tree.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), lookMat(new THREE.MeshLambertMaterial({ color: '#3a5530' }))); crown.scale.set(1, 1.15, 1); crown.position.y = 14; tree.add(crown); tree.name = 'hero placeholder'; place(tree, HERO_TREE[0], HERO_TREE[1]);
  return group;
}

// The sun follows the mountains (the user, 2026-11-11): it rises through the low pass on the left, climbs, and goes down behind the range.
// In summer it sets late into the saddle on the right; in spring behind the right flank of the main peak; in winter, low and short, it
// slips behind the main peak itself in early afternoon. The disc is depth-tested, so ridges hide it. f runs from sunrise to sunset.
export const SUN_ARC = { winter: { rise: -24.5, set: 13, peak: 11.5 }, spring: { rise: -26.5, set: 22, peak: 14.5 }, summer: { rise: -28, set: 31, peak: 16.5 } };
export function sunAt(f, season = 'summer') { const a = SUN_ARC[season] ?? SUN_ARC.summer; const az = lerp(a.rise, a.set, f); const el = a.peak * Math.sin(Math.PI * clamp(f, 0, 1)) ** 0.55 + (f < 0 || f > 1 ? -6 : 0); return { az, el }; }
const dirOf = (az, el) => new THREE.Vector3(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG));

// moods keyed by time: [sun f, sky turbidity, rayleigh, exposure, sun colour, sun intensity, ambient sky, ambient ground, fog colour, fog density]
const MOODS = {
  dawn: [0.035, 6, 2.6, 0.42, '#ffb27a', 1.4, '#9fb4d6', '#5a4a3c', '#d9b9a3', 1.05e-4],
  morning: [0.22, 4, 1.4, 0.36, '#ffe6c8', 2.6, '#b8cbe6', '#5f5a42', '#c8d3de', 0.9e-4],
  noon: [0.5, 3, 1.0, 0.32, '#fff6ea', 3.0, '#c6d6ef', '#626048', '#c4d0dc', 0.85e-4],
  evening: [0.82, 4, 1.6, 0.38, '#ffd3a0', 2.4, '#b2c2de', '#5f5340', '#d2c9c2', 0.95e-4],
  dusk: [0.968, 7, 2.8, 0.45, '#ff9a5a', 1.2, '#93a3c8', '#4b3d33', '#d8a98f', 1.1e-4],
  night: [null, 0, 0, 0.9, '#a9bde6', 0.75, '#2a3858', '#11161e', '#1b2433', 0.9e-4], // moonlight strong enough to read the valley by
};

export async function startBlockout(canvas, overlay) {
  await loadDem(); if (DEM && Q.get('reshape') !== '0') fitSkyline();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(FRAME.vfov, 1, 0.5, 30000); camera.position.set(0, FRAME.eye, 0); camera.rotation.set(FRAME.pitch * DEG, 0, 0, 'YXZ');
  const season = Q.get('season') || 'summer'; const mood = MOODS[Q.get('tod')] ?? MOODS.noon; const night = mood[0] === null;
  const t0 = performance.now(); scene.add(buildTerrain()); if (DEM) scene.add(buildMassif()); scene.add(buildWater()); scene.add(buildSettlements());
  // the paths worn into the meadow, and the footbridge where the footpath crosses the river by the mill
  { const at = (x, z) => heightAt(x, z), wet = (x, z) => riverDistance(x, z)[0] < 6.5; scene.add(buildPath(TRACK, { width: 2.6, at, wet }), buildPath(FOOTPATH, { width: 1.5, at, wet }));
    let a = null, b = null; for (let i = 1; i < FOOTPATH.length && !b; i += 1) { const w = wet(FOOTPATH[i].x, FOOTPATH[i].y); if (w && !a) a = FOOTPATH[i - 1]; if (!w && a) b = FOOTPATH[i]; }
    if (a && b) scene.add(footbridge(a, b, Math.max(heightAt(a.x, a.y), heightAt(b.x, b.y)))); }
  // the forests: impostors baked from the real spruce and larch, or the block-out cones (?trees=cones, or if the models cannot load)
  // trees of the valley floor: alders and spruce along the river banks, and lone trees and small groups on the field boundaries, so the
  // middle distance has the scattered life of a lived-in valley instead of an empty lawn
  for (let i = 0; i < riverPts.length; i += 3) { const p = riverPts[i], q = riverPts[Math.min(i + 1, riverPts.length - 1)]; const r = Math.hypot(p.x, p.y); if (r < 420 || r > 1500 || hash(i, 71) < 0.62) continue;
    const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1; const side = hash(i, 72) < 0.5 ? -1 : 1, off = side * (9 + 14 * hash(i, 73)); TREE_LIST.push(p.x + (-tz / l) * off, p.y + (tx / l) * off, hash(i, 74) < 0.3 ? 1 : 0, hash(i, 75) * 0.3); }
  for (let i = 0; i < 70; i += 1) { const az = (-38 + 76 * hash(i, 81)) * DEG, r = 650 + 1000 * hash(i, 82) ** 0.8; const x = Math.sin(az) * r, z = -Math.cos(az) * r; const h = heightAt(x, z, true);
    if (h > 70 || inLake(x, z) < 2 || riverDistance(x, z)[0] < 12 || Math.hypot(x - UPPER.x, z - UPPER.z) < 90 || Math.hypot(x - LOWER.x, z - LOWER.z) < 60) continue;
    const n = hash(i, 83) < 0.35 ? 3 : 1; for (let k = 0; k < n; k += 1) TREE_LIST.push(x + (hash(i, k + 84) - 0.5) * 18, z + (hash(k, i + 85) - 0.5) * 18, hash(i, 86) < 0.25 ? 1 : 0, 0.35 * hash(i, k + 87)); }
  let forest = null; if (Q.get('trees') !== 'cones') { try { const list = []; for (let i = 0; i < TREE_LIST.length; i += 4) { const x = TREE_LIST[i], z = TREE_LIST[i + 1], v = TREE_LIST[i + 3]; list.push(x, heightAt(x, z, true), z, TREE_LIST[i + 2], (16 + 14 * v) * (1 + 0.25 * smooth(2600, 7000, Math.hypot(x, z))), v); } forest = await buildForest(renderer, list, { x: HERO_TREE[0], y: heightAt(HERO_TREE[0], HERO_TREE[1], true), z: HERO_TREE[1], height: 24 }); scene.getObjectByName('hero placeholder')?.removeFromParent(); } catch (e) { console.warn('forest', e); } }
  scene.add(forest ?? buildTrees(TREE_LIST));
  // the near meadow's grass (grass.js): not on water, gravel, the track or round the buildings; ?grass=0 leaves the bare sward
  if (LOOK_ON && Q.get('grass') !== '0' && season !== 'winter') { /* in winter the meadow lies under snow */ const nearBuilding = (x, z) => SITES.some((site) => Math.hypot(x - site[0], z - site[1]) < site[2] + 2.5) || polyDistance(FOOTPATH, x, z) < 0.55; /* the grass overhangs the worn path */ const skip = (x, z) => inLake(x, z) < 1.27 || riverDistance(x, z)[0] < 9 || polyDistance(TRACK, x, z) < 2.2 || nearBuilding(x, z);
    const zone = (x, z) => (riverDistance(x, z)[0] < 70 || inLake(x, z) < 2.4 ? 'wet' : Math.hypot(x, z) < 75 ? 'dry' : 'hay');
    if (Q.get('blades') !== '0') {
      const blades = Q.get('blades') === '1' ? planBlades({ at: (x, z) => heightAt(x, z), skip, zone }) : []; /* the scanned meadow covers the near ground now */
      // reeds and sedge round the lake: tall, slender clumps in a ragged band at the water's edge, thicker in the bays
      const c = Math.cos(LAKE.rot), sn = Math.sin(LAKE.rot);
      for (let i = 0; i < 900; i += 1) { const a = (i / 900) * 6.283 + hash(i, 91) * 0.01; const k = 1.08 + 0.16 * hash(i, 92) + 0.06 * Math.sin(a * 7.0); if (hash(i, 93) < 0.25 + 0.3 * Math.sin(a * 3.0 + 1.0)) continue;
        const uu = Math.cos(a) * LAKE.rx * k, vv = Math.sin(a) * LAKE.rz * k; const x = LAKE.x + uu * c + vv * sn, z = LAKE.z - uu * sn + vv * c; if (Math.hypot(x, z) > 330) continue;
        blades.push(x, Math.max(heightAt(x, z), 0.05), z, 1.9 + 0.9 * hash(i, 94), hash(i, 95), -1); }
      scene.add(buildBlades(blades)); /* procedural blades from 38 m, cards beyond */
      /* the scanned meadow below */
    }
    const cardSites = planGrass({ at: (x, z) => heightAt(x, z), skip: (x, z) => inLake(x, z) < 1.34 || riverDistance(x, z)[0] < 9 || polyDistance(TRACK, x, z) < 2.2 || nearBuilding(x, z) }, { from: 48 }); let meadow = null;
    if (Q.get('scanned') !== '0') { try { meadow = await buildMeadow({ at: (x, z) => heightAt(x, z), skip, zone }, renderer, { cardSites }); scene.add(meadow); window.__meadowCounts = { ...meadow.userData.counts, cards: meadow.userData.cards }; } catch (e) { console.warn('meadow', e); } } /* real scanned grass and flowers near, cards baked from them beyond */
    if (!meadow) scene.add(buildGrass(cardSites)); } const buildMs = Math.round(performance.now() - t0);
  const sky = new Sky(); sky.scale.setScalar(25000); scene.add(sky); const u = sky.material.uniforms; u.turbidity.value = mood[1]; u.rayleigh.value = mood[2]; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
  const sunPose = night ? sunAt(-0.3, season) : sunAt(Number(Q.get('f') ?? mood[0]), season); u.sunPosition.value.copy(dirOf(sunPose.az, sunPose.el)); renderer.toneMappingExposure = mood[3] * (LOOK_ON ? (night ? 1.25 : LAND_EXPOSURE) : 1); /* night stays night: a moonlit valley, not a dim day */ if (LOOK_ON) sky.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', `gl_FragColor.rgb *= ${(1 / LAND_EXPOSURE).toFixed(3)};
#include <tonemapping_fragment>`); };
  const light = new THREE.DirectionalLight(mood[4], mood[5] * (night ? 1 : LAND_LIGHT)); const hemi = new THREE.HemisphereLight(mood[6], mood[7], night ? 0.55 : LOOK_ON ? 1.7 * LAND_LIGHT : 1.3); /* the open sky is the main light on faces turned from the sun */ scene.add(light, hemi);
  // bounce: the open sky and the sunlit valley behind the camera light the faces turned toward us; without it every slope in front is black
  const bounce = new THREE.DirectionalLight(LOOK_ON && !night ? '#d9dcb4' : mood[6], night ? 0.08 : LOOK_ON ? 1.15 : 0.85); /* warm: light thrown back by the sunlit meadows behind the camera */ bounce.position.set(0, 400, 1000); scene.add(bounce);
  if (LOOK_ON && Q.get('clouds') !== '0') { const cover = Number(Q.get('cover') ?? (night ? 0.58 : 0.5)); scene.add(buildClouds({ coverage: cover, night })); LOOK.uCover.value = cover; LOOK.uCloudOn.value = 1; } // ?clouds=0 for a clear sky, ?cover=0.3..0.7
  if (LOOK_ON) { const dawnish = Q.get('tod') === 'dawn' || Q.get('tod') === 'dusk'; setLook({ sunDir: night ? dirOf(sunAt(Number(Q.get('mf') ?? 0.3), season).az, sunAt(Number(Q.get('mf') ?? 0.3), season).el) : dirOf(sunPose.az, sunPose.el), sunCol: mood[4], haze: mood[8], density: night ? 1 / 40000 : dawnish ? 1 / 19000 : 1 / 30000, glow: night ? 0.15 : dawnish ? 1.6 : 1.1, snowline: season === 'winter' ? -200 : season === 'spring' ? 1000 : 1450 }); } else scene.fog = new THREE.FogExp2(mood[8], mood[9]);
  let moon = null; if (night) { // the moon rides the same arc; stars are a simple field for now
    const mp = sunAt(Number(Q.get('mf') ?? 0.3), season); const d = dirOf(mp.az, mp.el); light.position.copy(d).multiplyScalar(1000);
    scene.background = new THREE.Color('#0b1220'); sky.visible = false;
    moon = new THREE.Mesh(new THREE.CircleGeometry(95, 48), new THREE.MeshBasicMaterial({ color: '#f3efe2', fog: false })); moon.position.copy(d).multiplyScalar(20000); moon.lookAt(0, 0, 0); scene.add(moon);
    const s = []; for (let i = 0; i < 2500; i += 1) { const az = (hash(i, 1) - 0.5) * 160, el = 2 + hash(i, 2) ** 0.7 * 60; s.push(...dirOf(az, el).multiplyScalar(25000).toArray()); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(s, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.4, sizeAttenuation: false, fog: false })));
  } else { light.position.copy(dirOf(sunPose.az, Math.max(sunPose.el, 1.5))).multiplyScalar(1000); sunDisc(scene, dirOf(sunPose.az, sunPose.el), mood[4]); }
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  // shadows: the sun's, over the near and middle valley (about 1.8 km square round the lake, the hamlet and the near woods), soft-edged;
  // everything there casts and receives except the grass (which only receives) and the sky, water and lights. ?shadows=0 to compare.
  if (LOOK_ON && !night && Q.get('shadows') !== '0') {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const centre = new THREE.Vector3(0, 15, -480); light.target.position.copy(centre); scene.add(light.target);
    light.position.copy(centre).addScaledVector(dirOf(sunPose.az, Math.max(sunPose.el, 2)), 5000); light.castShadow = true;
    const sc = light.shadow.camera; sc.left = -950; sc.right = 950; sc.top = 950; sc.bottom = -950; sc.near = 100; sc.far = 12000; sc.updateProjectionMatrix();
    light.shadow.mapSize.set(4096, 4096); light.shadow.bias = -0.0005; light.shadow.normalBias = 0.6; light.shadow.radius = 3;
    scene.traverse((o) => { if (!o.isMesh || o.isSprite) return; const n = o.name || ''; if (/cloud|sky|moon|massif/i.test(n) || o.material?.type === 'ShaderMaterial' || o.material?.isMeshBasicMaterial) return;
      o.receiveShadow = true; o.castShadow = !/meadow/.test(n); });
  }
  // the photographic finish, done by the compositor (no extra GPU pass): a gentle grade, a touch more contrast and colour in the warm hours,
  // and a soft vignette (the page's overlay). ?grade=0 to compare.
  if (LOOK_ON && Q.get('grade') !== '0') { const warm = ['dawn', 'dusk', 'evening'].includes(Q.get('tod')); canvas.style.filter = night ? 'contrast(1.04)' : warm ? 'contrast(1.08) saturate(1.1)' : 'contrast(1.06) saturate(1.05)'; document.body.classList.add('graded'); }
  // motion: birds over the meadows, smoke from the chimneys (more in the cold and the evening), one clock for everything that moves
  scene.updateMatrixWorld(true); const chimneys = []; scene.traverse((o) => { if (o.name === 'chimney') chimneys.push(o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0))); });
  const warmHour = ['dawn', 'dusk', 'evening', 'night'].includes(Q.get('tod')); const smoke = LOOK_ON && Q.get('smoke') !== '0' ? buildSmoke(chimneys.filter((_, i) => season === 'winter' || warmHour || i % 3 === 0), { strength: night ? 0.35 : 1 }) : null; if (smoke) scene.add(smoke.group);
  const birds = LOOK_ON && !night && Q.get('birds') !== '0' ? buildBirds() : null; if (birds) scene.add(birds.mesh);
  const lakeMesh = scene.getObjectByName('lake');
  let frames = 0; renderer.setAnimationLoop(() => { const tNow = performance.now() / 1000 + Number(Q.get('t') ?? 0); WIND.uTime.value = tNow; if (lakeMesh?.material.uniforms?.uTime) lakeMesh.material.uniforms.uTime.value = tNow; birds?.update(tNow); smoke?.update(tNow); renderer.render(scene, camera); frames += 1; window.__blockout.frames = frames; });
  window.__blockout = { ready: true, frames: 0, buildMs, sun: sunPose, season }; window.__renderer = renderer;
  if (overlay) { overlay.style.display = Q.get('overlay') === '0' ? 'none' : ''; window.addEventListener('keydown', (e) => { if (e.key === 'o' || e.key === 'O') overlay.style.display = overlay.style.display === 'none' ? '' : 'none'; }); }
}

// The sun as a disc with a soft glow (Sky.js alone loses the disc in the haze): additive, depth-tested so ridges cut it.
export function sunDisc(scene, dir, colour) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.08, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.25)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: colour, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  glow.scale.setScalar(4600); /* a wide soft halo: the eye and the lens both bloom round the sun */ glow.position.copy(dir).multiplyScalar(20000); scene.add(glow);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(105, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(6), fog: false })); disc.position.copy(dir).multiplyScalar(20000); disc.lookAt(0, 0, 0); scene.add(disc);
}

// The massif at the elevation data's own 60 m spacing (every second sample), so ridges, couloirs and glacier basins keep their shape.
function buildMassif() {
  const m = DEM.meta, step = 1, W = Math.floor(m.width / step), H = Math.floor(m.height / step); const pos = new Float32Array(W * H * 3), col = new Float32Array(W * H * 3), rel = new Float32Array(W * H), ok = new Uint8Array(W * H); /* the full 30 m data */
  for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) { const lat = m.north - j * step * m.dLat, lon = m.west + i * step * m.dLon; const dN = (lat - DEM.vLat) * DEM.mLat, dE = (lon - DEM.vLon) * DEM.mLon;
    const r = Math.hypot(dN, dE), a = ((Math.atan2(dE, dN) / DEG - 180 + MASSIF.az + 540) % 360) - 180; /* wrapped: due south must not jump from +180 to -180 */ const [x, z] = toXZ(a, r); const k = j * W + i; if (r < 5500 || Math.abs(a) > 62) continue;
    const h = heightAt(x, z, true); rel[k] = DEM_RELIEF_OUT * demWeight(x, z); pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; ok[k] = 1; }
  for (let j = 1; j < H - 1; j += 1) for (let i = 1; i < W - 1; i += 1) { const k = j * W + i; if (!ok[k]) continue; const dx = Math.hypot(pos[(k + 1) * 3] - pos[(k - 1) * 3], pos[(k + 1) * 3 + 2] - pos[(k - 1) * 3 + 2]) || 1, dz = Math.hypot(pos[(k + W) * 3] - pos[(k - W) * 3], pos[(k + W) * 3 + 2] - pos[(k - W) * 3 + 2]) || 1;
    const slope = Math.hypot((pos[(k + 1) * 3 + 1] - pos[(k - 1) * 3 + 1]) / dx, (pos[(k + W) * 3 + 1] - pos[(k - W) * 3 + 1]) / dz); const c = zoneColour(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], slope); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
  const idx = []; for (let j = 0; j < H - 1; j += 1) for (let i = 0; i < W - 1; i += 1) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; if (ok[a] && ok[b] && ok[c] && ok[d]) idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(new Float32Array(W * H * 3), 3)); g.setAttribute('aRelief', new THREE.BufferAttribute(rel, 1)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, lookMat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { mountain: true, ground: true })); mesh.name = 'massif (Copernicus GLO-30)'; return mesh;
}

// The hybrid mountain: measure the skyline of the real massif from the camera, then stretch its heights per azimuth so the outline matches the
// designed one (the pyramid peak, the shoulders, the sunset saddle) while every ridge, couloir and buttress keeps its real shape. The stretch is
// smoothed over about 4 degrees (sharper changes shear the rock into false cliffs) and clamped, and refined twice because each stretch moves which ridge forms the outline.
function skylineAt(az) { let best = -90; for (let r = 4500; r < 20000; r *= 1.006) { const [x, z] = toXZ(az, r); const e = Math.atan2(heightAt(x, z, true) - FRAME.eye, r) / DEG; if (e > best) best = e; } return best; }
export function fitSkyline(passes = 2) {
  const n = 481; RESHAPE = new Float32Array(n).fill(1);
  for (let p = 0; p < passes; p += 1) {
    const want = [], k = new Float32Array(n);
    for (let i = 0; i < n; i += 1) { const az = -60 + i * 0.25; const [x, z] = toXZ(az, MASSIF.distance); const w = demWeight(x, z); const have = skylineAt(az); const target = profile(RANGE, az)[1];
      k[i] = w > 0.05 && have > 0.5 ? lerp(1, clamp(RESHAPE[i] * Math.tan(target * DEG) / Math.tan(have * DEG), 0.65, 1.45), smooth(4, 10, Math.abs(az - MASSIF.az))) : RESHAPE[i]; /* the real summit crown stays as it is; only the flanks are reshaped */ want.push(target); }
    for (let i = 0; i < n; i += 1) { let a = 0, s = 0; for (let j = -20; j <= 20; j += 1) { const q = i + j; if (q < 0 || q >= n) continue; const g = Math.exp(-(j * j) / 128); a += k[q] * g; s += g; } RESHAPE[i] = a / s; }
  }
  window.__blockoutReshape = Array.from(RESHAPE.filter((_, i) => i % 8 === 0), (v) => +v.toFixed(2));
}

// Block-out trees at their true size: spruce and larch as simple cones, 16-30 m tall, so the slopes and the wood behind the chapel read at the
// right scale. The final forest replaces these with real trees near and impostors far.
function buildTrees(list) {
  const n = list.length / 4; const geo = new THREE.ConeGeometry(1, 1, 7); geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, lookMat(new THREE.MeshLambertMaterial(), { glow: 0.9 }), n); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (let i = 0; i < n; i += 1) { const x = list[i * 4], z = list[i * 4 + 1], larch = list[i * 4 + 2], v = list[i * 4 + 3]; const h = 16 + 14 * v; const y = heightAt(x, z, true) - 0.5;
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(h * (larch ? 0.26 : 0.21), h, h * (larch ? 0.26 : 0.21))); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(larch ? '#56703a' : '#26391f').multiplyScalar(0.85 + 0.3 * v)); }
  mesh.instanceMatrix.needsUpdate = true; mesh.name = `block-out trees (${n})`; mesh.frustumCulled = false; return mesh;
}

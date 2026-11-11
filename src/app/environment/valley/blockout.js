import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { applyValleyLook, setLook, LOOK } from './look.js';
import { buildForest } from './trees.js';
import { planGrass, buildGrass, planBlades, buildBlades, WIND } from './grass.js';
import { buildClouds } from './clouds.js';
import { buildBirds, buildSmoke } from './motion.js';
import { buildMeadow } from './meadow.js';
import { alpineHouse, chapel, stadel, woodpile, garden, fenceAlong, wallAlong } from './buildings.js';
import { buildPath, footbridge } from './paths.js';
import { buildRocks } from './rocks.js';
let TREE_LIST = [];
const LOOK_ON = Q_LOOK();
function Q_LOOK() { return typeof window === 'undefined' || new URLSearchParams(window.location.search).get('look') !== 'blockout'; } // ?look=blockout for the flat block-out
// the land is exposed for its shadowed faces (the camera looks into the light); the sky keeps its own brightness
const LAND_EXPOSURE = 1.4; // the sky and haze are not blown out (reference 28: a grey-blue sky, not white)
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
  ...[[-34, 14], [-60, -2], [28, 18], [54, 2], [-20, -24], [12, -30]].map(([dx, dz]) => [UPPER.x + dx, UPPER.z + dz, 9]), [UPPER.x + 80, UPPER.z - 12, 8], ...HUTS.map(([x, z]) => [x, z, 4.5]),
  [UPPER.x + 44, UPPER.z + 32, 4], [UPPER.x - 50, UPPER.z + 30, 4], [LOWER.x - 38, LOWER.z + 24, 4]]; // the last three: granaries on stilts
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
    const mLat = 111320, mLon = 111320 * Math.cos(meta.summit[0] * DEG); DEM = { meta, data: new Float32Array(buf), blur: null, mLat, mLon, vLat: meta.summit[0] + MASSIF.distance / mLat, vLon: meta.summit[1], summit: toXZ(MASSIF.az, MASSIF.distance) }; DEM.blur = blurGrid(DEM.data, meta.width, meta.height, 7); DEM.mid = blurGrid(DEM.data, meta.width, meta.height, 2); return DEM; } catch { return null; }
}
// the terrain's local relief: the real height minus its smoothed surroundings (about 200 m), exaggerated so ridges stand sharper and
// couloirs cut deeper, the way the eye remembers mountains; the overall shape and the summit stay where the data puts them
const RELIEF = Number(Q.get('relief3d') ?? 2.4);
const NEEDLES = Number(Q.get('needles') ?? 1); // ?needles=0 for the plain crown
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
  const raw = bil(DEM.data), smooth0 = bil(DEM.blur), mid = bil(DEM.mid);
  // the ridges and couloirs (forms of 90-400 m) are exaggerated, crests more than hollows so they come to an edge; the small bumps under
  // about 90 m stay at their real size, so the crown is not lumpy
  const rel = mid - smooth0; const form = rel > 0 ? rel * Math.min(1.7, 1 + 0.01 * rel) : rel; DEM_RELIEF_OUT = form * RELIEF + 1.1 * (raw - mid);
  // the granite needles (reference: the Chamonix Aiguilles): on the upper crown, sharp spires where two ridged fields cross, notched cols
  // between them; so steep that no snow holds on their faces, only in the couloirs between
  const crown = smooth(1700, 2500, smooth0 - MASSIF.lakeAltitude) * NEEDLES; if (crown > 0) { const u = x / 340, v = z / 340;
    const rn = ridged(u, v, 2) * ridged(u * 1.55 + 7.3, v * 1.55 - 2.1, 2); const spire = Math.pow(rn, 3.4); const notch = Math.pow(1 - ridged(u * 0.8 + 3.1, v * 0.8, 2), 2);
    DEM_RELIEF_OUT += crown * (spire * 560 - notch * 180); }
  return smooth0 + DEM_RELIEF_OUT - MASSIF.lakeAltitude;
}
const demWeight = (x, z) => { if (!DEM) return 0; const s = Math.hypot(x - DEM.summit[0], z - DEM.summit[1]); return (1 - smooth(4000, 6500, s)) * smooth(5000, 7000, Math.hypot(x, z)); }; /* the summit block only: the real ridges north of it would stand in front */
// the lake's outline with its wandering shore: bays and little points instead of an ellipse
const lakeL = (x, z) => { const l = inLake(x, z); return l > 2.2 ? l : l + 0.2 * (fbm(x / 40, z / 40, 2) - 0.5) + 0.05 * (fbm(x / 9, z / 9, 2) - 0.5); };
// the valley floor's small rises (dry) and hollows (damp), in metres
const microAt = (x, z) => 1.1 * (fbm(x / 34, z / 34, 2) - 0.5) + 0.35 * (fbm(x / 9, z / 9, 2) - 0.5);
// the terrace's edge wanders: a glacial terrace is never a circle
const terraceEdge = (a) => 58 + 16 * fbm(Math.cos(a) * 1.6 + 2, Math.sin(a) * 1.6 + 7, 3);
export function heightAt(x, z, cheap = false, noPads = false) {
  const r = Math.hypot(x, z), az = Math.atan2(x, -z) / DEG;
  let h = 1.2 + 0.012 * Math.max(0, -z) + 3 * (fbm(x / 140, z / 140, 3) - 0.5) + (r > 60 ? microAt(x, z) * Math.min(1, (r - 60) / 60) : 0); // the floor, with its small rises and hollows
  const floorH = h;
  h = smax(h, 8 * (1 - smooth(0, 44, r)), 3); // the knoll under the camera, its foot blending into the meadow without a crease
  { const d = Math.hypot(x - UPPER.x, z - UPPER.z); if (d < 190) { const a = Math.atan2(x - UPPER.x, z - UPPER.z); const R = terraceEdge(a), W = 34 + 18 * fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2, 2);
      const t = clamp((d - R) / W, 0, 1); const gully = 0.7 * Math.max(0, fbm(a * 7 + 3, 1.3, 2) - 0.52) * Math.sin(Math.PI * t) * 4; /* small gullies down the bank */
      h = smax(h, UPPER.y * (1 - t * t * (3 - 2 * t)) - gully + 2 * (fbm(x / 60, z / 60, 2) - 0.5) * smooth(R - 10, R + 20, d), 8); } } // the terrace: a level top, a steeper bank // the terrace
  const f = profile(FOOT, az); const fh = Math.tan(f[1] * DEG) * f[2] + FRAME.eye - 8;
  const side = Math.abs(x - 60 - 0.08 * -z) - 560; if (side > 0) h = smax(h, Math.min(side * 0.42, Math.tan(f[1] * DEG) * r * 0.92) * (0.8 + 0.4 * fbm(x / 400, z / 400, 3)), 30); /* valley sides, never above the designed foothill skyline */
  h = smax(h, fh * smooth(f[2] - 2600, f[2], r) * (1 - 0.6 * smooth(f[2] + 600, f[2] + 2600, r)) * (0.82 + 0.36 * fbm(x / 700, z / 700, cheap ? 2 : 4)), 60);
  const m = profile(RANGE, az); const mh = Math.tan(m[1] * DEG) * m[2] + FRAME.eye; const crest = smooth(m[2] - 5200, m[2], r) * (1 - smooth(m[2], m[2] + 3500, r));
  let mountain = mh * crest * (0.74 + 0.3 * ridged(x / 1500, z / 1500, cheap ? 2 : 5)); const wd = demWeight(x, z); if (wd > 0) { const dh = demHeight(x, z); if (Number.isFinite(dh)) mountain = lerp(mountain, dh * reshapeAt(az), wd); }
  h = smax(h, mountain, 120);
  if (!noPads) for (const site of SITES) { const d = Math.hypot(x - site[0], z - site[1]); if (d < site[2] + 16) { if (site[3] === undefined) site[3] = heightAt(site[0], site[1], true, true); h = lerp(site[3], h, smooth(site[2] + 1, site[2] + 16, d)); } } // the building pads
  if (!cheap || noPads === 'river') { const [d] = riverDistance(x, z); h = lerp(Math.min(h, floorH + 0.6), h, smooth(7, 24, d)) - 2.2 * (1 - smooth(5, 16, d)); } // the channel cuts through whatever rises across it, down to the valley floor
  const l = lakeL(x, z); if (l < 1.26) h = Math.min(lerp(-2.5, -0.3, smooth(0.9, 1.26, l)), h); else if (l < 1.9) h = lerp(0.05, Math.max(h, 0.25), smooth(1.26, 1.5, l)); /* under the water inside its outline, a low bank rising just outside */ /* the bed stays under the water to the very edge of the lake, then a low shore */
  return h;
}

const C = (hex) => new THREE.Color(hex);
// the grass zones take the scanned meadow's own albedo (the mean of the baked strips, #5b6439), so the far valley floor is the same
// meadow as the near one, not a lime lawn; the land gets more light instead (LAND_LIGHT)
const ZONE = { meadow: C('#5e6b3a'), hay: C('#6a6c3c'), pasture: C('#53643a'), shore: C('#4e5a3c'), forest: C('#2c4429'), larch: C('#4a6435'), scree: C('#8b8a84'), rock: C('#6f6e6a'), snow: C('#eef1f4'), gravel: C('#8a877f'), terrace: C('#5e6b3a'), track: C('#9a8e6c'), wet: C('#4a5838'), dry: C('#76744a'), mown: C('#7e7c4c') };
const LAND_LIGHT = 1.45; // the land is lit to make up for the lower exposure
const SNOWLINE = Q.get('season') === 'winter' ? 120 : Q.get('season') === 'spring' ? 900 : 1500;
export const SURF = [0, 0, 0]; // set by zoneColour: gravel, track and forest-floor weights for the ground textures
function zoneColour(x, h, z, slope) {
  SURF[0] = 0; SURF[1] = 0; SURF[2] = 0;
  const r = Math.hypot(x, z); const n = fbm(x / 90, z / 90, 3);
  if (h > SNOWLINE + 260 * (n - 0.5) && slope < 1.25 && !(SNOWLINE < 600 && h < 600 && h > 48 && slope > 0.22)) return ZONE.snow; // in winter the woods stay: dark against the snow
  if ((slope > 1.0 && h > 70) || h > 1100) return h > 1100 && slope < 0.7 ? ZONE.scree : ZONE.rock; // steep banks down on the valley floor stay turf
  if (h > 640 + 160 * (n - 0.5)) return ZONE.scree.clone().lerp(ZONE.pasture, 0.55); // above the treeline: alpine pasture over scree
  if (Math.hypot(x - UPPER.x - 15, z - UPPER.z + 235) < 135 && Math.hypot(x - UPPER.x, z - UPPER.z) > 125) { SURF[2] = 1; return n > 0.6 ? ZONE.larch : ZONE.forest; } // the wood behind the chapel terrace: a dark ground for the white tower
  if ((slope > 0.22 && h > 48) || (slope > 0.1 && h > 160 && fbm(x / 420 + 9, z / 420, 2) > 0.38)) { /* the foothills wooded too, with clearings */ /* forest from the valley sides up; the terrace banks stay open meadow */ const avalanche = Math.abs(Math.sin(x / 260 + fbm(x / 500, z / 500, 2) * 6)) < 0.05 && h > 220; if (avalanche) return ZONE.pasture.clone().lerp(ZONE.forest, 0.25); /* narrow avalanche lanes, high up, grassed and dark */ SURF[2] = 1; return n > 0.62 || h > 470 ? ZONE.larch : ZONE.forest; }
  if (Q.get('season') === 'winter' && h < 640) { const [dw] = r < 1600 ? riverDistance(x, z) : [Infinity]; if (dw > 9) return ZONE.snow.clone().multiplyScalar(0.94 + 0.06 * n); } // winter: the whole valley floor under snow, the river open
  const [d] = r < 1600 ? riverDistance(x, z) : [Infinity]; if (d < 9) { SURF[0] = 1 - smooth(4.5, 8, d); return ZONE.gravel.clone().lerp(ZONE.shore, smooth(4.5, 8, d)); } // a narrow stony margin, not a beach
  { const lk = lakeL(x, z); if (lk < 1.5) { SURF[0] = 0.75 * (1 - smooth(1.24, 1.36, lk)) * (0.5 + 0.5 * fbm(x / 14, z / 14, 2)); /* stony patches in the mud at the waterline */ } if (lk < 1.5) return ZONE.shore.clone().lerp(C('#4a4434'), 0.75 * (1 - smooth(1.24, 1.44, lk))); } // a muddy wet margin at the waterline
  if (Math.hypot(x - UPPER.x, z - UPPER.z) < 110) return ZONE.terrace;
  if (r < 75) return ZONE.dry.clone().lerp(ZONE.meadow, 0.4 * n + 0.6 * smooth(40, 75, r)); // the knoll: thin dry turf, fading into the meadow
  // the plots themselves are drawn per pixel by the ground shader (look.js); here only the broad use and the wet ground along the water,
  // blended smoothly so no vertex grid shows
  const base = ZONE.hay.clone().lerp(ZONE.pasture, smooth(0, 90, x)).lerp(ZONE.meadow, 0.25 * n);
  const wet = Math.max(1 - smooth(18, 85, d), 1 - smooth(1.5, 3.4, inLake(x, z))); return base.lerp(ZONE.wet, 0.75 * wet); // rushes, marsh marigold
}

// Land use, the farmer's year seen from the knoll: the valley floor in plots about 120 m across, each long hay meadow in flower, freshly
// mown, or grazed short; their margins left long; damp rushes along the water and in the hollows; worn short round the houses and along
// the paths. The foreground stays the long flowering meadow. Returns [mown, grazed, damp].
function landUse(x, z) {
  const r = Math.hypot(x, z); const cx = x / 120, cz = z / 120, ix = Math.floor(cx), iz = Math.floor(cz); let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= 1; i += 1) { const gx = ix + i, gz = iz + j; const ox = gx + 0.15 + 0.7 * hash(gx, gz + 0.5), oz = gz + 0.15 + 0.7 * hash(gz + 3.1, gx); const d = Math.hypot(cx - ox, cz - oz); if (d < d1) { d2 = d1; d1 = d; id = hash(gx * 3.1 + 7.7, gz * 1.3); } else if (d < d2) d2 = d; }
  const edge = smooth(0.015, 0.06, d2 - d1); const keep = 1 - smooth(150, 230, r);
  let mown = (id < 0.3 ? 1 : 0) * edge * (1 - keep), grazed = (id >= 0.3 && id < 0.58 ? 1 : 0) * edge * (1 - keep);
  if (r < 1600) { let near = Infinity; for (const s of SITES) near = Math.min(near, Math.hypot(x - s[0], z - s[1]) - s[2]); const path = Math.min(polyDistance(FOOTPATH, x, z), polyDistance(TRACK, x, z));
    const worn = Math.max(1 - smooth(4, 26, near), 1 - smooth(1.5, 6, path)); grazed = Math.max(grazed, worn); mown *= 1 - worn; }
  const [dr] = r < 1600 ? riverDistance(x, z) : [Infinity]; const hollow = smooth(0.42, 0.3, fbm(x / 34, z / 34, 2)) * (r > 80 ? 1 : 0);
  const damp = Math.max(1 - smooth(10, 42, dr), 1 - smooth(1.15, 1.55, inLake(x, z)), hollow * 0.7); return [mown * (1 - damp), grazed * (1 - damp), damp];
}

// a polar grid round the camera: fine near, coarse far, within the view and a margin
function buildTerrain() {
  const A = 561, R = 500, r0 = 3, r1 = 16000; /* finer: about 0.2 degrees and 1.7% in range, so slopes keep their small ridges and gullies */ const trees = []; const pos = new Float32Array(A * R * 3), col = new Float32Array(A * R * 3), surf = new Float32Array(A * R * 3), land = new Float32Array(A * R * 3);
  for (let j = 0; j < R; j += 1) { const r = r0 * (r1 / r0) ** (j / (R - 1)); for (let i = 0; i < A; i += 1) { const az = -58 + (116 * i) / (A - 1); const [x, z] = toXZ(az, r); const h = heightAt(x, z) - (r > 5600 && demWeight(x, z) > 0.2 ? 320 * smooth(0.2, 0.4, demWeight(x, z)) : 0); /* under the massif mesh */ const e = Math.max(2, r * 0.004);
    const slope = Math.hypot(heightAt(x + e, z, true) - heightAt(x - e, z, true), heightAt(x, z + e, true) - heightAt(x, z - e, true)) / (2 * e); const k = (j * A + i) * 3; pos[k] = x; pos[k + 1] = h; pos[k + 2] = z; const c = zoneColour(x, h, z, slope); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; surf[k] = SURF[0]; surf[k + 1] = SURF[1]; surf[k + 2] = SURF[2]; if (r < 3500 && h < 140 && Q.get("land") !== "0") { const L = landUse(x, z); land[k] = L[0]; land[k + 1] = L[1]; land[k + 2] = L[2]; }
    if (c !== ZONE.forest && c !== ZONE.larch && r > 300 && r < 6000 && h > 40 && trees.length < 640000 && ((slope > 0.12 && h < 600 && hash(i * 1.3, j * 2.1) < 0.045) || (h > 600 && h < 780 && slope < 0.9 && hash(i * 2.7, j * 0.9) < 0.03 * (1 - (h - 600) / 180)))) trees.push(x, z, h > 600 ? 1 : 0, h > 600 ? 0.05 * hash(i, j) : 0.2 + 0.5 * hash(j, i)); /* lone trees breaking the forest edge; a few stunted larches above the treeline */
    if ((c === ZONE.forest || c === ZONE.larch) && r > 120 && r < 9000 && trees.length < 900000) { const cell = (r * 116 * DEG / (A - 1)) * (r * Math.log(r1 / r0) / (R - 1)); let count = cell / (75 + 0.02 * Math.max(0, r - 2600)) * (0.25 + 1.5 * smooth(0.32, 0.62, fbm(x / 210 + 5, z / 210, 3))); /* the far slopes wooded tree by tree, gathered into stands and thinning into glades, never an even stipple */ while (count > 0) { if (count >= 1 || hash(i * 7.1 + count, j * 3.3) < count) trees.push(x + (hash(i, j + count) - 0.5) * r * 0.005, z + (hash(j, i + count) - 0.5) * r * 0.02, c === ZONE.larch ? 1 : 0, hash(i + count, j)); count -= 1; } } } }
  const idx = []; for (let j = 0; j < R - 1; j += 1) for (let i = 0; i < A - 1; i += 1) { const a = j * A + i, b = a + 1, c = a + A, d = c + 1; idx.push(a, b, c, b, d, c); /* counter-clockwise seen from above */ }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3)); g.setAttribute('aLand', new THREE.BufferAttribute(land, 3)); g.setAttribute('aRelief', new THREE.BufferAttribute(new Float32Array(pos.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, lookMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { mountain: true, ground: true, glow: 0.55 })); mesh.name = 'blockout terrain'; TREE_LIST = trees; return mesh;
}

// The still lake: a true mirror where the air is calm, broken where a breath of wind crosses it (cat's-paws), and darker teal water seen
// when looking down near the shore, more mirror toward the far side (Fresnel).
const LAKE_SHADER = {
  name: 'ValleyLake', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 }, uLake: { value: new THREE.Vector4(LAKE.x, LAKE.z, LAKE.rx, LAKE.rz) }, uRot: { value: LAKE.rot }, uDay: { value: ['night'].includes(Q.get('tod')) ? 0.06 : ['dusk', 'dawn'].includes(Q.get('tod')) ? 0.55 : 1 } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
#include <common>
void main() { vUv = textureMatrix * vec4(position, 1.0); vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime; uniform vec4 uLake; uniform float uRot; uniform float uDay; varying vec4 vUv; varying vec3 vWorld;
float lh(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float ln(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(lh(i),lh(i+vec2(1,0)),f.x),mix(lh(i+vec2(0,1)),lh(i+vec2(1,1)),f.x),f.y); }
float lf(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*ln(p); p=p*2.1+3.7; a*=0.5; } return s; }
void main() {
  vec2 p = vWorld.xz; float paws = smoothstep(0.5, 0.72, lf(p * 0.025)); // where a breath of wind is crossing
  vec2 rp = p * vec2(0.9, 2.6) + vec2(uTime * 0.35, uTime * 0.12); vec2 ripple = vec2(lf(rp), lf(rp + 7.3)) - 0.5; /* the ripples move */
  float fw = length(fwidth(rp)); /* ripples finer than a pixel would only shake the reflection row by row: let them fade with distance */
  vec4 uv = vUv; uv.xy += ripple * (0.004 + 0.03 * paws) / (1.0 + 2.5 * fw) * uv.w;
  vec3 refl = texture2DProj(tDiffuse, uv).rgb;
  vec3 v = normalize(cameraPosition - vWorld); float f = 0.02 + 0.98 * pow(1.0 - clamp(v.y, 0.0, 1.0), 5.0);
  // the shallows: near the shore the lake bed shows through (stones and silt, brown-green), the reflection weaker
  vec2 q = vWorld.xz - uLake.xy; float cr = cos(uRot), sr = sin(uRot); vec2 e = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr) / uLake.zw; float l = length(e);
  float shallow = smoothstep(1.0, 1.24, l + 0.05 * (lf(p * 0.15) - 0.5));
  vec3 bed = mix(vec3(0.16, 0.15, 0.1), vec3(0.24, 0.22, 0.16), lf(p * 0.6)) * (0.8 + 0.3 * lf(p * 2.3));
  vec3 body = mix(vec3(0.04, 0.08, 0.07), bed, shallow) * uDay; /* the lake bed is lit by the day, dark at night */
  gl_FragColor = vec4(mix(body, refl * vec3(0.9, 0.94, 0.97) * (1.0 - 0.1 * paws), clamp(f * 1.05 + 0.08, 0.0, 1.0) * (1.0 - 0.6 * shallow)), 1.0); /* the reflection a little darker and greener than the sky it shows: the water sits in the land */
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
};
function buildWater() {
  const group = new THREE.Group();
  const lakeGeo = new THREE.CircleGeometry(1, 96); lakeGeo.scale(LAKE.rx * 1.42, LAKE.rz * 1.42, 1); /* the Reflector takes its plane from the mesh: geometry stays in XY, the mesh is laid flat */
  const lake = new Reflector(lakeGeo, { textureWidth: 2048, textureHeight: 1024, color: 0x8a9aa4, shader: LOOK_ON ? LAKE_SHADER : undefined }); lake.position.set(LAKE.x, 0, LAKE.z); lake.name = 'lake'; lake.rotation.set(-Math.PI / 2, 0, LAKE.rot); group.add(lake);
  // the river as a ribbon following the course, wider toward the lake
  // the stream: five strips across, so the water is deep in the middle and shallow at the edges; aFlow carries (across, along in metres)
  let riverY = Infinity, along = 0; const P = [], F = [], I = []; const X = 5;
  for (let i = 0; i < riverPts.length; i += 1) { const p = riverPts[i], q = riverPts[Math.min(i + 1, riverPts.length - 1)], o = riverPts[Math.max(i - 1, 0)]; const tx = q.x - o.x, tz = q.y - o.y, l = Math.hypot(tx, tz) || 1; const w = lerp(3.2, 5.5, i / riverPts.length) * (0.72 + 0.56 * fbm(p.x / 28, p.y / 28, 2)); /* pools and narrows */
    if (i) along += p.distanceTo(riverPts[i - 1]);
    const y = inLake(p.x, p.y) < 1.15 ? -0.4 : Math.min(riverY, heightAt(p.x, p.y, true, 'river') + 1.3); riverY = y; /* the water only ever runs downhill; where it enters the lake it sinks under the still water */ const yy = y < -0.1 ? y : Math.max(0.05, y);
    for (let k = 0; k < X; k += 1) { const u = k / (X - 1), off = (u * 2 - 1) * w; P.push(p.x + (tz / l) * off, yy, p.y - (tx / l) * off); F.push(u, along); }
    if (i) { const a0 = (i - 1) * X, a1 = i * X; for (let k = 0; k < X - 1; k += 1) I.push(a0 + k, a0 + k + 1, a1 + k, a0 + k + 1, a1 + k + 1, a1 + k); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.setAttribute('aFlow', new THREE.Float32BufferAttribute(F, 2)); rg.setIndex(I); rg.computeVertexNormals();
  const riverMat = lookMat(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  if (LOOK_ON) { const bed = new THREE.TextureLoader().load('/design-reference/world-redesign/textures/river_small_rocks.jpg'); bed.colorSpace = THREE.SRGBColorSpace; bed.wrapS = bed.wrapT = THREE.RepeatWrapping; bed.anisotropy = 8;
    const look = riverMat.onBeforeCompile; riverMat.onBeforeCompile = (sh, r) => { look(sh, r); sh.uniforms.tBed = { value: bed }; sh.uniforms.uTime = LOOK.uTime;
      sh.vertexShader = 'attribute vec2 aFlow; varying vec2 vlFlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vlFlow = aFlow;');
      // a glacial stream (references 3, 7, 11): milky turquoise where it is deep, the pebble bed (scanned) showing through the shallows at
      // its edges, white water streaming downstream over the stones, strongest on the rapid reaches; the sun glints on it
      sh.fragmentShader = 'uniform sampler2D tBed; varying vec2 vlFlow;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 fl = vlFlow; float edge = abs(fl.x * 2.0 - 1.0); if (edge > 0.8 + 0.18 * vlNoise(vec2(fl.y * 0.4, fl.x * 3.0 + 1.7))) discard; /* ragged banks, never a ruled edge */ float depth = 1.0 - smoothstep(0.3, 0.85, edge);
  vec3 bedC = texture2D(tBed, vlWorld.xz / 2.4).rgb * vec3(0.8, 0.92, 0.95);
  vec3 water = mix(vec3(0.5, 0.6, 0.62), vec3(0.17, 0.32, 0.4), depth); /* glacial meltwater: blue-grey with silt, the sky in it */ water = mix(bedC, water, 0.3 + 0.62 * depth);
  float sp = 1.2 + 1.6 * depth; float rapid = smoothstep(0.42, 0.66, vlFbm(vec2(fl.y * 0.045, 3.0)));
  float streak = vlNoise(vec2(fl.x * 8.0, fl.y * 0.3 - uTime * sp)) * vlNoise(vec2(fl.x * 21.0 + 3.0, fl.y * 0.8 - uTime * sp * 1.3));
  float foam = smoothstep(0.34 - 0.16 * rapid, 0.62, streak) * (0.3 + 0.7 * rapid) * (0.5 + 0.5 * depth);
  diffuseColor.rgb = mix(water, vec3(0.84, 0.88, 0.87), foam * 0.6);
  float glint = step(0.965, vlNoise(vec2(fl.x * 40.0, fl.y * 2.0 - uTime * sp * 2.0))) * pow(max(dot(normalize(vlWorld - cameraPosition), normalize(uSunDir)), 0.0), 6.0) * smoothstep(0.0, 0.15, uSunDir.y);
  diffuseColor.rgb += vec3(1.6, 1.5, 1.3) * glint; /* the sun sparkling on the moving water */ }`); }; riverMat.customProgramCacheKey = () => 'valley-river-2'; }
  group.add(new THREE.Mesh(rg, riverMat));
  // stones: the glacial river's grey cobbles and boulders along its banks and on the bars at the bends, and a scatter on the lake shore;
  // rounded, half buried, pale where dry and darker at the waterline
  if (LOOK_ON && Q.get('stones') === 'ico') { /* the block-out stones; the scanned rocks (rocks.js) replace them */
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

// Where the rocks lie (rocks.js): where water and ice would have left them, not in a line. On the outside of each river bend the bank is
// cut and its boulders stand exposed; on the inside a bar of cobbles; one boulder stands in the lake's shallows and groups of stones mark
// the shore; erratics lie out in the meadow, one beside the footpath, and a mossy group sits in the foreground, half in the grass.
let ROCKS = [];
function rockSites() {
  const out = []; const add = (x, z, size, set = 'moss', sink = 0.3, y = null) => { if (Math.hypot(x, z) > 1500) return; out.push({ x, y: y ?? Math.max(heightAt(x, z), -0.4), z, size, set, sink }); };
  const step = 7; for (let i = step; i < riverPts.length - step; i += step) { const o = riverPts[i - step], p = riverPts[i], q = riverPts[i + step]; if (Math.hypot(p.x, p.y) > 1500) continue;
    const ax = p.x - o.x, az = p.y - o.y, bx = q.x - p.x, bz = q.y - p.y; const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1; const turn = (ax * bz - az * bx) / (la * lb);
    const tx = (ax / la + bx / lb) / 2, tz = (az / la + bz / lb) / 2, tl = Math.hypot(tx, tz) || 1; const nx = -tz / tl, nz = tx / tl; const w = lerp(3.2, 5.5, i / riverPts.length); const out_ = turn > 0 ? -1 : 1;
    if (Math.abs(turn) > 0.12) { const n = 3 + Math.floor(hash(i, 1) * 3); for (let k = 0; k < n; k += 1) { const off = out_ * (w + 0.8 + 2.4 * hash(i, k + 2)), along = (hash(k, i) - 0.5) * 8; add(p.x + nx * off + tx / tl * along, p.y + nz * off + tz / tl * along, 1.2 + 1.6 * hash(i + k, 5) ** 1.5, 'moss', 0.3); } // the cut bank
      for (let k = 0; k < 7; k += 1) { const off = -out_ * (w * 0.5 + 3.5 * hash(i, k + 20)), along = (hash(k + 20, i) - 0.5) * 12; add(p.x + nx * off + tx / tl * along, p.y + nz * off + tz / tl * along, 0.45 + 0.5 * hash(i, k + 30), 'moss', 0.4); } } // the bar
    else if (hash(i, 9) < 0.55) add(p.x + nx * (w + 0.5) * (hash(i, 10) < 0.5 ? -1 : 1), p.y + nz * (w + 0.5), 0.6 + 0.6 * hash(i, 11), 'moss', 0.35); } // the odd stone on a straight reach
  // the lake: one boulder in the shallows on the near side, groups of stones on the shore
  const c = Math.cos(LAKE.rot), sn = Math.sin(LAKE.rot); const onLake = (a, k) => { const u = Math.cos(a) * LAKE.rx * k, v = Math.sin(a) * LAKE.rz * k; return [LAKE.x + u * c + v * sn, LAKE.z - u * sn + v * c]; };
  const shoreK = (a, at = 1.26) => { let lo = 0.95, hi = 1.6; for (let it = 0; it < 18; it += 1) { const mid = (lo + hi) / 2; const [x, z] = onLake(a, mid); if (lakeL(x, z) < at) lo = mid; else hi = mid; } return lo; }; /* where the wandering shore really is */
  let best = null; for (let a = 0; a < 6.283; a += 0.05) { const [x, z] = onLake(a, shoreK(a, 1.16)); if (z < -70 && x > -45 && (!best || Math.hypot(x, z) < Math.hypot(best[0], best[1]))) best = [x, z]; }
  if (best) { add(best[0], best[1], 3.0, 'boulder', 0.35, 0); for (let k = 0; k < 5; k += 1) add(best[0] + (hash(k, 3) - 0.5) * 7, best[1] + (hash(k, 4) - 0.5) * 5, 0.35 + 0.4 * hash(k, 5), 'moss', 0.5, 0); /* the boulder in the shallows near the shore, small stones round its foot */ add(best[0] + 3.2, best[1] - 1.5, 1.2, 'moss', 0.5, 0); }
  // the terrace bank: rock showing through in outcrops, some half buried, none straight in front of the chapel
  { const dir = Math.atan2(-UPPER.x, -UPPER.z); for (let i = 0; i < 14; i += 1) { const a = dir + (hash(i, 61) - 0.5) * 2.4; if (Math.abs(a - dir) < 0.16) continue; const R = terraceEdge(a) + 8 + 30 * hash(i, 62); const x = UPPER.x + Math.sin(a) * R, z = UPPER.z + Math.cos(a) * R; if (polyDistance(TRACK, x, z) < 6) continue; add(x, z, 2.0 + 3.0 * hash(i, 63) ** 1.5, hash(i, 64) < 0.5 ? 'boulder' : 'moss', 0.45); } }
  // stones standing in the stream, breaking its surface into riffles
  for (let i = 10; i < riverPts.length - 6; i += 9) { const p = riverPts[i]; if (Math.hypot(p.x, p.y) > 900 || hash(i, 51) < 0.45) continue; const w = lerp(3.2, 5.5, i / riverPts.length);
    const off = (hash(i, 52) - 0.5) * w; add(p.x + off, p.y + (hash(i, 53) - 0.5) * 3, 0.9 + 0.8 * hash(i, 54), 'moss', 0.5, heightAt(p.x, p.y, true, 'river') + 1.3); }
  // pebbles and small stones along the near shore of the lake, at the waterline, in little groups
  for (let gi = 0; gi < 7; gi += 1) { const a0 = 0.5 + gi * 0.42; for (let k = 0; k < 6; k += 1) { const aa = a0 + (hash(gi, k) - 0.5) * 0.08; const [x, z] = onLake(aa, shoreK(aa, 1.22 + 0.08 * hash(k, gi))); if (z < LAKE.z) continue; add(x, z, 0.3 + 0.55 * hash(gi * 3, k), 'moss', 0.45, Math.max(heightAt(x, z), -0.05)); } }
  for (const a of [2.2, 3.4, 4.6]) for (let k = 0; k < 4; k += 1) { const ag = a + (hash(a, k) - 0.5) * 0.12; const [x, z] = onLake(ag, shoreK(ag, 1.27 + 0.06 * hash(k, a))); add(x, z, 0.6 + 1.0 * hash(a * 3, k), 'moss', 0.35, Math.max(heightAt(x, z), 0)); }
  // erratics in the meadow; one beside the footpath; the foreground group
  add(-140, -320, 5.2, 'boulder', 0.3); add(-134, -316, 1.6, 'moss', 0.4); /* one great erratic across the lake, the left's counterweight to the hamlet */
  { const p = FOOTPATH[46], q = FOOTPATH[47]; const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1; add(p.x - tz / l * 3.4, p.y + tx / l * 3.4, 3.6, 'boulder', 0.3); add(p.x - tz / l * 6.2, p.y + tx / l * 6.2 - 2.0, 1.4, 'moss', 0.38); add(p.x - tz / l * 2.6, p.y + tx / l * 2.6 + 3.0, 0.8, 'moss', 0.45); /* a boulder beside the footpath, a waymark that leads the eye on toward the mill */ }
  add(27, -47, 3.2, 'moss', 0.28); add(31, -44.6, 1.6, 'moss', 0.35); add(23.6, -51, 1.1, 'moss', 0.4); add(29.5, -51.5, 0.7, 'moss', 0.45); /* the foreground group, half in the grass */
  return out;
}

// The hamlet (buildings.js): every building faces the camera, its front with the balcony and windows toward the viewer and turned a little
// each, seated on the highest ground under its footprint, the stone plinth taking up the slope; the windows light when it gets dark
const LAMPS = ["dusk", "night"].includes(Q.get("tod")) ? Q.get("tod") : null;
function buildSettlements() {
  const group = new THREE.Group();
  const place = (o, x, z, turn = 0) => { const yaw = Math.atan2(-x, -z) + turn; const [fw, fd] = o.userData.foot ?? [6, 6]; const c = Math.cos(yaw), s = Math.sin(yaw); let top = -Infinity;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) { const lx = (u * fw) / 2, lz = (v * fd) / 2; top = Math.max(top, heightAt(x + lx * c + lz * s, z - lx * s + lz * c, true)); }
    o.position.set(x, top + 0.05, z); o.rotation.y = yaw; group.add(o); return o; };
  // life round each house: a woodpile against the side wall, and in front of some a vegetable garden behind a rail fence
  const lived = (house, i) => { const [w, d] = house.userData.size; const wp = woodpile(2.4 + hash(i, 1) * 1.6); wp.position.set(w / 2 + 0.5, 0, 0.6 - d * 0.2); wp.rotation.y = Math.PI / 2; house.add(wp);
    if (hash(i, 2) > 0.35) { const gd = garden(5, 3.6); const gx = (hash(i, 3) < 0.5 ? -1 : 1) * (w / 2 - 1), gz = d / 2 + 4.6; gd.position.set(gx, 0, gz); house.add(gd); const fx = [[-2.8, -2.1], [2.8, -2.1], [2.8, 2.1], [-2.8, 2.1], [-2.8, -1.2]].map(([u, v]) => [gx + u, gz + v]); house.add(fenceAlong(fx, () => 0)); }
    return house; };
  // the lower group by the river: the mill on the water, the farmhouse, the barn, a granary
  place(lived(alpineHouse(9, 7, { seed: 1, stoneFloor: true, lamps: LAMPS, pitch: 0.48 }), 1), LOWER.x - 10, LOWER.z + 12, 0.25); /* the mill */
  place(lived(alpineHouse(13, 10, { seed: 2, lamps: LAMPS, pitch: 0.36, eaves: 1.8, white: true, plaster: 'plastered_wall', slate: '#8c8c8c' }), 2), LOWER.x - 28, LOWER.z + 4, -0.15); /* the farmhouse, low and broad */
  place(alpineHouse(15, 11, { seed: 3, barn: true, low: 3.2, high: 4.4, pitch: 0.5 }), LOWER.x - 46, LOWER.z - 16, 0.55); /* the barn and hay loft */
  place(stadel(1), LOWER.x - 38, LOWER.z + 24, 0.3);
  // the upper group: the chapel at the front of the terrace, the focal point, its tower toward the valley, in its churchyard wall; tall
  // village houses and low farmhouses beside and behind it; two granaries in front
  const ch = chapel(); ch.add(wallAlong([[11, 3], [11, 16], [-8, 16], [-8, -14], [11, -14], [11, -1.5]], () => 0.4, { height: 1.0 })); place(ch, UPPER.x - 2, UPPER.z + 26, -Math.PI / 2 + 0.12); /* side-on: the long nave toward the valley, the tower at its end */
  const UP = [[-34, 14, 0.2, 9, 8, 2, 0.52], [-60, -2, -0.15, 13, 10, 1, 0.36], [28, 18, -0.25, 10, 9, 2, 0.46], [54, 2, 0.3, 12, 9, 1, 0.4], [-20, -24, 0.1, 9, 8, 2, 0.56], [12, -30, -0.2, 11, 9, 1, 0.38]];
  UP.forEach(([dx, dz, t, w, d, storeys, pitch], i) => place(lived(alpineHouse(w, d, { seed: i + 4, storeys, pitch, stoneFloor: i === 4, low: 3 + (i % 2) * 0.4, lamps: LAMPS, wood: i % 2 ? '#e8e2da' : '#ffffff', eaves: storeys > 1 ? 1.2 : 1.7, white: i !== 1 && i !== 5, plaster: 'plastered_wall', slate: '#8c8c8c' }), i + 4), UPPER.x + dx, UPPER.z + dz, t));
  place(alpineHouse(9, 8, { seed: 11, barn: true, low: 2.6, high: 3.6 }), UPPER.x + 80, UPPER.z - 12, 0.5); /* the upper barn */
  place(stadel(2), UPPER.x + 44, UPPER.z + 32, -0.2); place(stadel(3), UPPER.x - 50, UPPER.z + 30, 0.25);
  HUTS.forEach(([x, z], i) => place(alpineHouse(5, 4, { seed: 20 + i, barn: true, low: 1.0, high: 2.4, pitch: 0.5 }), x, z, (hash(i, 3) - 0.5) * 1.2)); /* hay huts out in the meadows */
  // a dry-stone wall along the front of the terrace, broken where the track comes up; a rail fence beside the track
  { const at = (x, z) => heightAt(x, z, true); const dir = Math.atan2(-UPPER.x, -UPPER.z); let run = [];
    for (let k = -14; k <= 14; k += 1) { const a = dir + k * 0.06; const R = terraceEdge(a) + 2; const x = UPPER.x + Math.sin(a) * R, z = UPPER.z + Math.cos(a) * R; if (polyDistance(TRACK, x, z) < 7) { if (run.length > 1) group.add(wallAlong(run, at)); run = []; continue; } run.push([x, z]); }
    if (run.length > 1) group.add(wallAlong(run, at));
    const rail = []; for (let i = 6; i < TRACK.length - 8; i += 6) { const p = TRACK[i], q = TRACK[i + 1]; const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1; rail.push([p.x - tz / l * 2.6, p.y + tx / l * 2.6]); }
    group.add(fenceAlong(rail, at)); }
  // the hero tree: a dark mass on a trunk
  const tree = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 8), lookMat(new THREE.MeshLambertMaterial({ color: '#4a3c2e' }))); trunk.position.y = 4; tree.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), lookMat(new THREE.MeshLambertMaterial({ color: '#3a5530' }))); crown.scale.set(1, 1.15, 1); crown.position.y = 14; tree.add(crown); tree.name = 'hero placeholder'; place(tree, HERO_TREE[0], HERO_TREE[1]);
  return group;
}

// The sun follows the mountains (the user, 2026-11-11): it rises through the low pass on the left, climbs, and goes down behind the range.
// In summer it sets late into the saddle on the right; in spring behind the right flank of the main peak; in winter, low and short, it
// slips behind the main peak itself in early afternoon. The disc is depth-tested, so ridges hide it. f runs from sunrise to sunset.
// A real sun's arc across the view (the user, 2026-11-12: it should look good, behave like a real sun and be in the frame most of the time):
// it rises at the left, climbs to a modest height (just above the frame at midday in summer, so the valley is lit from in front and above),
// and goes down behind the peaks and the saddle on the right; in frame through the morning and the afternoon; in winter low and in view
// nearly all day, as a real winter sun is.
export const SUN_ARC = { winter: { rise: -26, set: 15, peak: 14 }, spring: { rise: -34, set: 26, peak: 21 }, summer: { rise: -40, set: 33, peak: 26 } };
export function sunAt(f, season = 'summer') { const a = SUN_ARC[season] ?? SUN_ARC.summer; const az = lerp(a.rise, a.set, f); const el = a.peak * Math.sin(Math.PI * clamp(f, 0, 1)) ** 0.7 + (f < 0 || f > 1 ? -6 : 0); return { az, el }; }
const dirOf = (az, el) => new THREE.Vector3(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG));

// moods keyed by time: [sun f, sky turbidity, rayleigh, exposure, sun colour, sun intensity, ambient sky, ambient ground, fog colour, fog density]
const MOODS = {
  dawn: [0.06, 5, 2.4, 0.42, '#ffb27a', 1.4, '#9fb4d6', '#5a4a3c', '#d9b9a3', 1.05e-4],
  morning: [0.15, 1.6, 3.0, 0.4, '#ffe6c8', 2.6, '#b8cbe6', '#5f5a42', '#c8d3de', 0.9e-4],
  noon: [0.5, 1.2, 3.0, 0.355, '#ffe8c6', 3.4, '#adc6ee', '#6b6540', '#b0c2da', 0.85e-4], // warm sun, cool sky fill: the lit and the shaded sides part // a clear blue sky, warm sun
  evening: [0.85, 2.0, 2.8, 0.42, '#ffd3a0', 2.4, '#b2c2de', '#5f5340', '#d2c9c2', 0.95e-4],
  dusk: [0.968, 7, 2.8, 0.45, '#ff9a5a', 1.2, '#93a3c8', '#4b3d33', '#d8a98f', 1.1e-4],
  night: [null, 0, 0, 0.9, '#a9bde6', 0.75, '#2a3858', '#11161e', '#1b2433', 0.9e-4], // moonlight strong enough to read the valley by
};

export async function startBlockout(canvas, overlay) {
  await loadDem(); if (DEM && Q.get('reshape') !== '0') fitSkyline();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(FRAME.vfov, 1, 0.5, 30000); camera.position.set(0, FRAME.eye, 0); camera.rotation.set(FRAME.pitch * DEG, 0, 0, 'YXZ');
  const season = Q.get('season') || 'summer'; const mood = MOODS[Q.get('tod')] ?? MOODS.noon; const night = mood[0] === null;
  const t0 = performance.now(); scene.add(buildTerrain()); if (DEM) scene.add(buildMassif()); scene.add(buildWater()); scene.add(buildSettlements());
  if (LOOK_ON && Q.get('stones') !== '0') { try { ROCKS = rockSites(); scene.add(await buildRocks(ROCKS)); } catch (e) { console.warn('rocks', e); } } // the scanned rocks
  // the paths worn into the meadow, and the footbridge where the footpath crosses the river by the mill
  { const at = (x, z) => heightAt(x, z), wet = (x, z) => riverDistance(x, z)[0] < 6.5; if (season !== 'winter') { /* paths between the houses: from the chapel door to each house and to the head of the track */ const door = new THREE.Vector2(UPPER.x - 2, UPPER.z + 40);
      for (const [dx, dz] of [[-34, 14], [-60, -2], [28, 18], [54, 2], [-20, -24], [12, -30], [44, 32], [-50, 30]]) { const end = new THREE.Vector2(UPPER.x + dx, UPPER.z + dz + 6); const mid = door.clone().lerp(end, 0.5).add(new THREE.Vector2((hash(dx, dz) - 0.5) * 8, 4)); scene.add(buildPath(new THREE.QuadraticBezierCurve(door, mid, end).getSpacedPoints(30), { width: 1.1, at: (x, z) => heightAt(x, z, true), strength: 0.75 })); }
      scene.add(buildPath(new THREE.LineCurve(door, TRACK[TRACK.length - 1]).getSpacedPoints(12), { width: 1.6, at: (x, z) => heightAt(x, z, true), strength: 0.8 })); }
    if (season !== 'winter') scene.add(buildPath(TRACK, { width: 2.6, at, wet }), buildPath(FOOTPATH, { width: 1.5, at, wet }), buildPath(FOOTPATH, { width: 3.8, at, wet, strength: 0.28, tile: 3.4 })); /* the worn line, and round it the faint trampled margin */ /* in winter the paths lie under the snow */
    let a = null, b = null; for (let i = 1; i < FOOTPATH.length && !b; i += 1) { const w = wet(FOOTPATH[i].x, FOOTPATH[i].y); if (w && !a) a = FOOTPATH[i - 1]; if (!w && a) b = FOOTPATH[i]; }
    if (a && b) scene.add(footbridge(a, b, Math.max(heightAt(a.x, a.y), heightAt(b.x, b.y)))); }
  // the forests: impostors baked from the real spruce and larch, or the block-out cones (?trees=cones, or if the models cannot load)
  // trees of the valley floor: alders and spruce along the river banks, and lone trees and small groups on the field boundaries, so the
  // middle distance has the scattered life of a lived-in valley instead of an empty lawn
  // galleries of trees along stretches of the river (where the bank is wet and uncut), not single trees dotted along it
  for (let i = 0; i < riverPts.length; i += 2) { const p = riverPts[i], q = riverPts[Math.min(i + 1, riverPts.length - 1)]; const r = Math.hypot(p.x, p.y); if (r < 380 || r > 1600) continue;
    if (fbm(i / 40, 3.7, 2) < 0.52 || hash(i, 71) < 0.35) continue; const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1;
    for (const side of [-1, 1]) { if (hash(i, side + 72) < 0.3) continue; const off = side * (7 + 9 * hash(i, 73 + side)); TREE_LIST.push(p.x + (-tz / l) * off, p.y + (tx / l) * off, hash(i, 74 + side) < 0.35 ? 1 : 0, 0.15 + 0.5 * hash(i, 75 + side)); } }
  // groups in the fields: a tight organic clump round one big old tree, smaller ones leaning out from it
  for (let i = 0; i < 46; i += 1) { const az = (-38 + 76 * hash(i, 81)) * DEG, r = 520 + 1200 * hash(i, 82) ** 0.8; const x = Math.sin(az) * r, z = -Math.cos(az) * r; const h = heightAt(x, z, true);
    if (h > 70 || inLake(x, z) < 2 || riverDistance(x, z)[0] < 14 || SITES.some((st) => Math.hypot(x - st[0], z - st[1]) < st[2] + 20)) continue;
    const n = hash(i, 83) < 0.3 ? 1 : 3 + Math.floor(hash(i, 84) * 8); const spread = 5 + n * 1.6; const larch = hash(i, 86) < 0.3 ? 1 : 0;
    for (let k = 0; k < n; k += 1) { const ang = hash(i, k + 85) * 6.283, rr = k === 0 ? 0 : spread * Math.sqrt(hash(k, i + 85)) * (0.7 + 0.6 * Math.abs(Math.cos(ang - i))); /* lopsided, never a circle */
      TREE_LIST.push(x + Math.cos(ang) * rr, z + Math.sin(ang) * rr, larch, k === 0 ? 0.85 + 0.15 * hash(i, 87) : 0.1 + 0.45 * hash(i, k + 87)); } }
  // shrubby groups of trees on the flanks of the terrace bank, leaving the chapel's front open
  { const dir = Math.atan2(-UPPER.x, -UPPER.z); for (let g = 0; g < 7; g += 1) { const side = g % 2 ? 1 : -1; const a = dir + side * (0.45 + 0.9 * hash(g, 95)); const R = terraceEdge(a) + 14 + 24 * hash(g, 96); const cx = UPPER.x + Math.sin(a) * R, cz = UPPER.z + Math.cos(a) * R;
    if (polyDistance(TRACK, cx, cz) < 10) continue; const n = 3 + Math.floor(hash(g, 97) * 5); for (let k = 0; k < n; k += 1) TREE_LIST.push(cx + (hash(g, k + 98) - 0.5) * 16, cz + (hash(k, g + 98) - 0.5) * 12, hash(g, 99) < 0.4 ? 1 : 0, 0.05 + 0.35 * hash(g, k + 99)); } }
  // a line of trees beside the track up to the terrace
  for (let i = 4; i < TRACK.length * 0.4; i += 7) { if (hash(i, 91) < 0.3) continue; const p = TRACK[i], q = TRACK[i + 1]; if (Math.hypot(p.x - UPPER.x, p.y - UPPER.z) < 150) continue; /* never in front of the chapel */ const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1; TREE_LIST.push(p.x + tz / l * 6, p.y - tx / l * 6, 0, 0.3 + 0.4 * hash(i, 92)); }
  let forest = null; if (Q.get('trees') !== 'cones') { try { const list = []; for (let i = 0; i < TREE_LIST.length; i += 4) { const x = TREE_LIST[i], z = TREE_LIST[i + 1], v = TREE_LIST[i + 3]; list.push(x, heightAt(x, z, true), z, TREE_LIST[i + 2], (16 + 14 * v) * (1 + 0.25 * smooth(2600, 7000, Math.hypot(x, z))), v); } forest = await buildForest(renderer, list, { x: HERO_TREE[0], y: heightAt(HERO_TREE[0], HERO_TREE[1], true), z: HERO_TREE[1], height: 24 }); scene.getObjectByName('hero placeholder')?.removeFromParent(); } catch (e) { console.warn('forest', e); } }
  scene.add(forest ?? buildTrees(TREE_LIST));
  // the near meadow's grass (grass.js): not on water, gravel, the track or round the buildings; ?grass=0 leaves the bare sward
  if (LOOK_ON && Q.get('grass') !== '0' && season !== 'winter') { /* in winter the meadow lies under snow */ const nearBuilding = (x, z) => SITES.some((site) => Math.hypot(x - site[0], z - site[1]) < site[2] + 2.5) || ROCKS.some((k) => Math.abs(x - k.x) < k.size * 0.42 && Math.abs(z - k.z) < k.size * 0.42) || polyDistance(FOOTPATH, x, z) < 0.55; /* the grass overhangs the worn path */ const skip = (x, z) => lakeL(x, z) < 1.4 + 0.1 * hash(x * 1.7, z * 2.3) || riverDistance(x, z)[0] < 9 || polyDistance(TRACK, x, z) < 2.2 || nearBuilding(x, z);
    const zone = (x, z) => (riverDistance(x, z)[0] < 70 || inLake(x, z) < 2.4 ? 'wet' : Math.hypot(x, z) < 75 ? 'dry' : 'hay');
    let reeds = []; if (Q.get('blades') !== '0') {
      const blades = Q.get('blades') === '1' ? planBlades({ at: (x, z) => heightAt(x, z), skip, zone }) : []; /* the scanned meadow covers the near ground now */
      // reeds and sedge round the lake: tall, slender clumps in a ragged band at the water's edge, thicker in the bays
      const c = Math.cos(LAKE.rot), sn = Math.sin(LAKE.rot);
      reeds = []; for (let i = 0; i < 900; i += 1) { const a = (i / 900) * 6.283 + hash(i, 91) * 0.01; const k = 1.06 + 0.12 * hash(i, 92) + 0.05 * Math.sin(a * 7.0); if (hash(Math.floor(a * 9), 93) < 0.55 || hash(i, 94) < 0.35) continue; /* stands, not a wall */
        const uu = Math.cos(a) * LAKE.rx * k, vv = Math.sin(a) * LAKE.rz * k; const x = LAKE.x + uu * c + vv * sn, z = LAKE.z - uu * sn + vv * c; if (Math.hypot(x, z) > 330) continue;
        if (z < LAKE.z - 30) continue; /* only the near and side shores: on the far shore a reed line reads as a row of dashes */ reeds.push({ x, y: Math.max(heightAt(x, z), 0.05), z }); }
      if (blades.length) scene.add(buildBlades(blades)); /* procedural blades only with ?blades=1 */
      /* the scanned meadow below */
    }
    const cardSites = planGrass({ at: (x, z) => heightAt(x, z), skip: (x, z) => lakeL(x, z) < 1.48 || riverDistance(x, z)[0] < 9 || polyDistance(TRACK, x, z) < 2.2 || nearBuilding(x, z) }, { from: 48, to: 240 }); /* beyond, the ground in the scans' own colour carries the meadow */ let meadow = null;
    if (Q.get('scanned') !== '0') { try { // the cards follow the land use: none on the mown plots, short plain grass where it is grazed or damp; in the hay, flowers in pockets
      const cards = []; for (let i = 0; i < cardSites.length; i += 5) { const x = cardSites[i], z = cardSites[i + 2]; const [mw, gz, dp] = landUse(x, z); const pick = hash(x * 1.3, z * 0.7);
        if (mw > 0.5 && pick > 0.08) continue; const short = gz > 0.5 || dp > 0.5; if (short && pick > 0.7) continue;
        const fl = fbm(x / 40 + 3, z / 40, 3) + 0.3 * (pick - 0.5); const mix = Math.min(0.999, Math.max(0, (fbm(x / 90 + 11, z / 90, 2) - 0.3) / 0.4 + 0.25 * (hash(z, x * 1.7) - 0.5))); /* the pockets feather out at their edges */ const fl2 = fl * 0.5 + fbm(x / 13 + 7, z / 13, 2) * 0.5; const dry = microAt(x, z) > 0.1, damp = microAt(x, z) < -0.15 || dp > 0.3; const nearPath = polyDistance(FOOTPATH, x, z) < 6;
        const bloom = smooth(0.47, 0.66, fl2) * 0.85; /* the chance of flowering rises gently into a cluster: varied density, soft edges */ const kind = short || mw > 0.5 || nearPath || hash(x * 0.37, z * 1.91) > bloom ? 0 : damp ? 2 : dry ? (mix < 0.6 ? 1 : 4) : (mix < 0.45 ? 1 : mix < 0.8 ? 3 : 4); /* plant communities in small clusters by the ground: yellow and pink bistort in the damp, cranesbill and clover between, daisies and harebells on the dry */ /* flowering pockets, each its own colour: daisies, yellow, violet-blue, pink */
        cards.push(cardSites[i], cardSites[i + 1], z, cardSites[i + 3], cardSites[i + 4], short ? 0.42 : 1, kind); }
      meadow = await buildMeadow({ at: (x, z) => heightAt(x, z), skip, zone, path: (x, z) => polyDistance(FOOTPATH, x, z), moist: (x, z) => clamp(0.5 - microAt(x, z) * 1.1 + (zone(x, z) === 'wet' ? 0.3 : 0), 0, 1) }, renderer, { cardSites: cards, reeds }); scene.add(meadow); window.__meadowCounts = { ...meadow.userData.counts, cards: meadow.userData.cards }; } catch (e) { console.warn('meadow', e); } } /* real scanned grass and flowers near, cards baked from them beyond */
    if (!meadow) scene.add(buildGrass(cardSites)); } const buildMs = Math.round(performance.now() - t0);
  const sky = new Sky(); sky.scale.setScalar(25000); scene.add(sky); { const gain = night ? 1 : ['dawn', 'dusk'].includes(Q.get('tod')) ? 0.8 : 0.33; sky.material.fragmentShader = sky.material.fragmentShader.replace('vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor', `vec3 texColor = ( Lin + L0 ) * 0.04 * ${gain.toFixed(2)} + sundiscColor * 1.6`); /* the sky dimmed, the sun's disc not */ sky.material.needsUpdate = true; } /* the sky's own exposure: deep blue overhead instead of a clipped white */ const u = sky.material.uniforms; u.turbidity.value = mood[1]; u.rayleigh.value = mood[2]; u.mieCoefficient.value = night ? 0.005 : 0.0009; /* less milky glare round the sun */ u.mieDirectionalG.value = night ? 0.8 : 0.9; /* a tighter glow round the sun, so the sky does not wash over the frame */
  const sunPose = night ? sunAt(-0.3, season) : sunAt(Number(Q.get('f') ?? mood[0]), season); u.sunPosition.value.copy(dirOf(sunPose.az, sunPose.el)); renderer.toneMappingExposure = mood[3] * (LOOK_ON ? (night ? 1.25 : LAND_EXPOSURE) : 1); /* night stays night: a moonlit valley, not a dim day */ if (LOOK_ON) sky.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', `gl_FragColor.rgb *= ${(1 / LAND_EXPOSURE).toFixed(3)};
#include <tonemapping_fragment>`); };
  const light = new THREE.DirectionalLight(mood[4], mood[5] * (night ? 1 : LAND_LIGHT)); const hemi = new THREE.HemisphereLight(mood[6], mood[7], night ? 0.55 : LOOK_ON ? 1.7 * LAND_LIGHT : 1.3); /* the open sky is the main light on faces turned from the sun */ scene.add(light, hemi);
  // bounce: the open sky and the sunlit valley behind the camera light the faces turned toward us; without it every slope in front is black
  const bounce = new THREE.DirectionalLight(LOOK_ON && !night ? '#e6dfb8' : mood[6], night ? 0.08 : LOOK_ON ? 1.5 * LAND_LIGHT / 1.3 : 0.85); /* warm: light thrown back by the sunlit meadows behind the camera */ bounce.position.set(0, 400, 1000); scene.add(bounce);
  if (LOOK_ON && Q.get('clouds') !== '0') { const cover = Number(Q.get('cover') ?? (night ? 0.58 : 0.5)); scene.add(buildClouds({ coverage: cover, night })); LOOK.uCover.value = cover; LOOK.uCloudOn.value = 1; } // ?clouds=0 for a clear sky, ?cover=0.3..0.7
  if (LOOK_ON) { const dawnish = Q.get('tod') === 'dawn' || Q.get('tod') === 'dusk'; setLook({ sunDir: night ? dirOf(sunAt(Number(Q.get('mf') ?? 0.3), season).az, sunAt(Number(Q.get('mf') ?? 0.3), season).el) : dirOf(sunPose.az, sunPose.el), sunCol: mood[4], haze: mood[8], density: night ? 1 / 40000 : dawnish ? 1 / 24000 : 1 / 32000, /* clean mountain air: the haze only tells on the far range */ /* the far range goes blue with distance, as in the references */ glow: night ? 0.15 : dawnish ? 1.6 : 1.1, snowline: season === 'winter' ? -200 : season === 'spring' ? 1000 : 1450 }); } else scene.fog = new THREE.FogExp2(mood[8], mood[9]);
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
      o.receiveShadow = true; o.castShadow = !/meadow|terrain|path|lake|river/.test(n); });
    // the terrace-top buildings throw their long shadows straight down the bank toward the viewer: they read as stripes, so they cast none
    { const w = new THREE.Vector3(); scene.traverse((o) => { if (!o.isMesh) return; o.getWorldPosition(w); if (Math.hypot(w.x - UPPER.x, w.z - UPPER.z) < 120 && w.y > UPPER.y - 4) o.castShadow = false; }); } /* the ground does not shadow itself: at this grazing sun that only draws stripes on the banks */
  }
  // the photographic finish, done by the compositor (no extra GPU pass): a gentle grade, a touch more contrast and colour in the warm hours,
  // and a soft vignette (the page's overlay). ?grade=0 to compare.
  if (LOOK_ON && Q.get('grade') !== '0') { const warm = ['dawn', 'dusk', 'evening'].includes(Q.get('tod')); canvas.style.filter = night ? 'contrast(1.04)' : warm ? 'contrast(1.05) saturate(1.2)' : 'contrast(1.04) saturate(1.22)' /* colour, not contrast on top of a bright sky: the sun's disc must survive */; document.body.classList.add('graded'); }
  // motion: birds over the meadows, smoke from the chimneys (more in the cold and the evening), one clock for everything that moves
  scene.updateMatrixWorld(true); const chimneys = []; scene.traverse((o) => { if (o.name === 'chimney') chimneys.push(o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0))); });
  const warmHour = ['dawn', 'dusk', 'evening', 'night'].includes(Q.get('tod')); const smoke = LOOK_ON && Q.get('smoke') !== '0' ? buildSmoke(chimneys.filter((_, i) => season === 'winter' || warmHour || i % 3 === 0), { strength: night ? 0.35 : 1 }) : null; if (smoke) scene.add(smoke.group);
  const birds = LOOK_ON && !night && Q.get('birds') !== '0' ? buildBirds() : null; if (birds) scene.add(birds.mesh);
  const lakeMesh = scene.getObjectByName('lake');
  let frames = 0; renderer.setAnimationLoop(() => { const tNow = performance.now() / 1000 + Number(Q.get('t') ?? 0); WIND.uTime.value = tNow; if (lakeMesh?.material.uniforms?.uTime) lakeMesh.material.uniforms.uTime.value = tNow; birds?.update(tNow); smoke?.update(tNow); renderer.render(scene, camera); frames += 1; window.__blockout.frames = frames; });
  if (LOOK_ON && !night) sunDisc(scene, dirOf(sunPose.az, sunPose.el), mood[4]); /* the sun's own disc and halo, hidden by the peaks when it is behind them */
  window.__blockout = { ready: true, frames: 0, buildMs, sun: sunPose, season }; window.__renderer = renderer;
  if (overlay) { overlay.style.display = Q.get('overlay') === '0' ? 'none' : ''; window.addEventListener('keydown', (e) => { if (e.key === 'o' || e.key === 'O') overlay.style.display = overlay.style.display === 'none' ? '' : 'none'; }); }
}

// The sun as a disc with a soft glow (Sky.js alone loses the disc in the haze): additive, depth-tested so ridges cut it.
export function sunDisc(scene, dir, colour) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.04, 'rgba(255,255,255,0.95)'); grad.addColorStop(0.12, 'rgba(255,255,255,0.4)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.1)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); /* a bright core falling off smoothly, as the eye sees the sun */ g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: colour, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  glow.scale.setScalar(1700); /* a wide soft halo: the eye and the lens both bloom round the sun */ glow.position.copy(dir).multiplyScalar(20000); scene.add(glow);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(95, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(6), fog: false })); disc.position.copy(dir).multiplyScalar(20000); disc.lookAt(0, 0, 0); scene.add(disc);
}

// The massif at the elevation data's own 60 m spacing (every second sample), so ridges, couloirs and glacier basins keep their shape.
function buildMassif() {
  const m = DEM.meta, step = 1, W = Math.floor(m.width / step), H = Math.floor(m.height / step); const pos = new Float32Array(W * H * 3), col = new Float32Array(W * H * 3), surfM = new Float32Array(W * H * 3), rel = new Float32Array(W * H), ok = new Uint8Array(W * H); /* the full 30 m data */ let planted = 0;
  for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) { const lat = m.north - j * step * m.dLat, lon = m.west + i * step * m.dLon; const dN = (lat - DEM.vLat) * DEM.mLat, dE = (lon - DEM.vLon) * DEM.mLon;
    const r = Math.hypot(dN, dE), a = ((Math.atan2(dE, dN) / DEG - 180 + MASSIF.az + 540) % 360) - 180; /* wrapped: due south must not jump from +180 to -180 */ const [x, z] = toXZ(a, r); const k = j * W + i; if (r < 5500 || Math.abs(a) > 62) continue;
    const h = heightAt(x, z, true); rel[k] = DEM_RELIEF_OUT * demWeight(x, z); pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; ok[k] = 1; }
  for (let j = 1; j < H - 1; j += 1) for (let i = 1; i < W - 1; i += 1) { const k = j * W + i; if (!ok[k]) continue; const dx = Math.hypot(pos[(k + 1) * 3] - pos[(k - 1) * 3], pos[(k + 1) * 3 + 2] - pos[(k - 1) * 3 + 2]) || 1, dz = Math.hypot(pos[(k + W) * 3] - pos[(k - W) * 3], pos[(k + W) * 3 + 2] - pos[(k - W) * 3 + 2]) || 1;
    const slope = Math.hypot((pos[(k + 1) * 3 + 1] - pos[(k - 1) * 3 + 1]) / dx, (pos[(k + W) * 3 + 1] - pos[(k - W) * 3 + 1]) / dz); const c = zoneColour(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], slope); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; surfM[k * 3 + 2] = SURF[2];
    if ((c === ZONE.forest || c === ZONE.larch) && planted < 160000 && hash(i * 0.37, j * 1.13) < 0.75) { const n = 1 + (hash(j, i) < 0.6 ? 1 : 0); for (let t = 0; t < n; t += 1) { TREE_LIST.push(pos[k * 3] + (hash(i + t, j) - 0.5) * 30, pos[k * 3 + 2] + (hash(j + t, i) - 0.5) * 30, c === ZONE.larch ? 1 : 0, hash(i * 3 + t, j)); planted += 1; } } } /* the massif's lower slopes wooded tree by tree, as the rest of the range */
  const idx = []; for (let j = 0; j < H - 1; j += 1) for (let i = 0; i < W - 1; i += 1) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; if (ok[a] && ok[b] && ok[c] && ok[d]) idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(surfM, 3)); g.setAttribute('aLand', new THREE.BufferAttribute(new Float32Array(W * H * 3), 3)); g.setAttribute('aRelief', new THREE.BufferAttribute(rel, 1)); g.setIndex(idx); g.computeVertexNormals();
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

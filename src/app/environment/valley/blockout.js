import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { applyValleyLook, setLook } from './look.js';
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
const FOOT = [[-62, 7, 2400], [-45, 6, 2600], [-36, 4.8, 2900], [-27, 2.6, 3200], [-18, 3.6, 3300], [-8, 2.6, 3600], [0, 1.9, 4000], [8, 2.6, 3800], [16, 3.4, 3400], [24, 3.8, 3100], [30.5, 3.0, 3000], [38, 5.2, 2700], [62, 7, 2300]];
function profile(table, az) { if (az <= table[0][0]) return table[0]; for (let i = 1; i < table.length; i += 1) if (az <= table[i][0]) { const a = table[i - 1], b = table[i], t = (az - a[0]) / (b[0] - a[0]), s = t * t * (3 - 2 * t); return [az, lerp(a[1], b[1], s), lerp(a[2], b[2], s)]; } return table[table.length - 1]; }

// water and settlements (metres)
export const LAKE = { x: -52, z: -150, rx: 62, rz: 98, rot: -0.18 };
export const RIVER = [[760, -1300], [470, -760], [300, -470], [190, -300], [95, -285], [52, -330], [12, -262], [38, -196], [8, -150], [-14, -118]].map(([x, z]) => new THREE.Vector2(x, z));
const riverCurve = new THREE.SplineCurve(RIVER); const riverPts = riverCurve.getSpacedPoints(400);
export const LOWER = { x: 60, z: -345 }; // the mill stands on the river bank // the working group: mill on the river, farm, barn
export const UPPER = { ...(() => { const [x, z] = toXZ(13.2, 430); return { x, z }; })(), y: 22 }; // the old heart on its terrace, near enough to read as a home
export const HUTS = [[-150, -430], [-260, -760], [255, -560], [372, -410]];
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
    const mLat = 111320, mLon = 111320 * Math.cos(meta.summit[0] * DEG); DEM = { meta, data: new Float32Array(buf), mLat, mLon, vLat: meta.summit[0] + MASSIF.distance / mLat, vLon: meta.summit[1], summit: toXZ(MASSIF.az, MASSIF.distance) }; return DEM; } catch { return null; }
}
function demHeight(x, z) {
  if (!DEM) return NaN; const r = Math.hypot(x, z), b = (180 + Math.atan2(x, -z) / DEG - MASSIF.az) * DEG; const lat = DEM.vLat + (r * Math.cos(b)) / DEM.mLat, lon = DEM.vLon + (r * Math.sin(b)) / DEM.mLon;
  const m = DEM.meta, fx = (lon - m.west) / m.dLon, fy = (m.north - lat) / m.dLat, ix = Math.floor(fx), iy = Math.floor(fy); if (ix < 0 || iy < 0 || ix >= m.width - 1 || iy >= m.height - 1) return NaN;
  const tx = fx - ix, ty = fy - iy, i = iy * m.width + ix, d = DEM.data; return (d[i] * (1 - tx) + d[i + 1] * tx) * (1 - ty) + (d[i + m.width] * (1 - tx) + d[i + m.width + 1] * tx) * ty - MASSIF.lakeAltitude;
}
const demWeight = (x, z) => { if (!DEM) return 0; const s = Math.hypot(x - DEM.summit[0], z - DEM.summit[1]); return (1 - smooth(4000, 6500, s)) * smooth(5000, 7000, Math.hypot(x, z)); }; /* the summit block only: the real ridges north of it would stand in front */
export function heightAt(x, z, cheap = false) {
  const r = Math.hypot(x, z), az = Math.atan2(x, -z) / DEG;
  let h = 1.2 + 0.012 * Math.max(0, -z) + 3 * (fbm(x / 140, z / 140, 3) - 0.5); // the floor
  h = smax(h, 8 - (r / 34) ** 2 * 8, 3); // the knoll under the camera
  { const d = Math.hypot(x - UPPER.x, z - UPPER.z); h = smax(h, UPPER.y * (1 - smooth(62, 140, d)) + 6 * (fbm(x / 60, z / 60, 2) - 0.5), 12); } // the terrace
  const f = profile(FOOT, az); const fh = Math.tan(f[1] * DEG) * f[2] + FRAME.eye - 8;
  const side = Math.abs(x - 60 - 0.08 * -z) - 560; if (side > 0) h = smax(h, Math.min(side * 0.42, Math.tan(f[1] * DEG) * r * 0.92) * (0.8 + 0.4 * fbm(x / 400, z / 400, 3)), 30); /* valley sides, never above the designed foothill skyline */
  h = smax(h, fh * smooth(f[2] - 2600, f[2], r) * (1 - 0.6 * smooth(f[2] + 600, f[2] + 2600, r)) * (0.82 + 0.36 * fbm(x / 700, z / 700, cheap ? 2 : 4)), 60);
  const m = profile(RANGE, az); const mh = Math.tan(m[1] * DEG) * m[2] + FRAME.eye; const crest = smooth(m[2] - 5200, m[2], r) * (1 - smooth(m[2], m[2] + 3500, r));
  let mountain = mh * crest * (0.74 + 0.3 * ridged(x / 1500, z / 1500, cheap ? 2 : 5)); const wd = demWeight(x, z); if (wd > 0) { const dh = demHeight(x, z); if (Number.isFinite(dh)) mountain = lerp(mountain, dh * reshapeAt(az), wd); }
  h = smax(h, mountain, 120);
  if (!cheap) { const [d] = riverDistance(x, z); h -= 2.2 * (1 - smooth(5, 16, d)); }
  const l = inLake(x, z); if (l < 1.6) h = lerp(-2.5, h, smooth(0.8, 1.6, l));
  return h;
}

const C = (hex) => new THREE.Color(hex);
const ZONE = { meadow: C('#93a85a'), hay: C('#a8b462'), pasture: C('#6f9447'), shore: C('#6b7d4a'), forest: C('#2c4429'), larch: C('#4a6435'), scree: C('#8b8a84'), rock: C('#6f6e6a'), snow: C('#eef1f4'), gravel: C('#a8a49a'), terrace: C('#8fa456'), track: C('#9a8e6c'), wet: C('#5d7a43'), dry: C('#a3a66a'), mown: C('#b4b878') };
const SNOWLINE = Q.get('season') === 'winter' ? 120 : Q.get('season') === 'spring' ? 900 : 1500;
export const SURF = [0, 0, 0]; // set by zoneColour: gravel, track and forest-floor weights for the ground textures
function zoneColour(x, h, z, slope) {
  SURF[0] = 0; SURF[1] = 0; SURF[2] = 0;
  const r = Math.hypot(x, z); const n = fbm(x / 90, z / 90, 3);
  if (h > SNOWLINE + 260 * (n - 0.5) && slope < 1.25) return ZONE.snow;
  if (slope > 1.0 || h > 1100) return h > 1100 && slope < 0.7 ? ZONE.scree : ZONE.rock;
  if (h > 640 + 160 * (n - 0.5)) return ZONE.scree.clone().lerp(ZONE.larch, 0.35); // above the treeline
  if (Math.hypot(x - UPPER.x - 15, z - UPPER.z + 235) < 135 && Math.hypot(x - UPPER.x, z - UPPER.z) > 125) { SURF[2] = 1; return n > 0.6 ? ZONE.larch : ZONE.forest; } // the wood behind the chapel terrace: a dark ground for the white tower
  if (slope > 0.22 && h > 48) { /* forest from the valley sides up; the terrace banks stay open meadow */ const avalanche = Math.abs(Math.sin(x / 260 + fbm(x / 500, z / 500, 2) * 6)) < 0.12; if (avalanche) return ZONE.meadow.clone().lerp(ZONE.scree, 0.3); SURF[2] = 1; return n > 0.62 || h > 470 ? ZONE.larch : ZONE.forest; }
  const [d] = r < 1600 ? riverDistance(x, z) : [Infinity]; if (d < 22) { SURF[0] = 1 - smooth(8, 22, d); return ZONE.gravel.clone().lerp(ZONE.shore, smooth(8, 22, d)); }
  if (inLake(x, z) < 1.5) return ZONE.shore;
  if (r < 1600 && polyDistance(TRACK, x, z) < 2.6) { SURF[1] = 1; return ZONE.track; }
  if (Math.hypot(x - UPPER.x, z - UPPER.z) < 110) return ZONE.terrace;
  if (d < 70 || inLake(x, z) < 2.4) return ZONE.wet.clone().lerp(ZONE.meadow, 0.35 * n); // wet ground along the water: rushes, marsh marigold
  if (r < 75) return ZONE.dry.clone().lerp(ZONE.meadow, 0.4 * n + 0.6 * smooth(40, 75, r)); // the knoll: thin dry turf, fading into the meadow
  const f = fieldAt(x, z); const base = x > 40 ? ZONE.pasture : ZONE.hay; const tone = f.id < 0.33 ? ZONE.mown : f.id < 0.66 ? base : ZONE.meadow;
  return base.clone().lerp(tone, 0.75).lerp(ZONE.meadow, 0.25 * n).multiplyScalar(1 - 0.12 * f.seam);
}

// a polar grid round the camera: fine near, coarse far, within the view and a margin
function buildTerrain() {
  const A = 401, R = 320, r0 = 12, r1 = 16000; const trees = []; const pos = new Float32Array(A * R * 3), col = new Float32Array(A * R * 3), surf = new Float32Array(A * R * 3);
  for (let j = 0; j < R; j += 1) { const r = r0 * (r1 / r0) ** (j / (R - 1)); for (let i = 0; i < A; i += 1) { const az = -58 + (116 * i) / (A - 1); const [x, z] = toXZ(az, r); const h = heightAt(x, z) - (r > 5600 && demWeight(x, z) > 0.001 ? 320 : 0); /* under the massif mesh */ const e = Math.max(2, r * 0.004);
    const slope = Math.hypot(heightAt(x + e, z, true) - heightAt(x - e, z, true), heightAt(x, z + e, true) - heightAt(x, z - e, true)) / (2 * e); const k = (j * A + i) * 3; pos[k] = x; pos[k + 1] = h; pos[k + 2] = z; const c = zoneColour(x, h, z, slope); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; surf[k] = SURF[0]; surf[k + 1] = SURF[1]; surf[k + 2] = SURF[2];
    if ((c === ZONE.forest || c === ZONE.larch) && r > 120 && r < 2600 && trees.length < 160000) { const cell = (r * 116 * DEG / (A - 1)) * (r * Math.log(r1 / r0) / (R - 1)); let count = cell / 75; while (count > 0) { if (count >= 1 || hash(i * 7.1 + count, j * 3.3) < count) trees.push(x + (hash(i, j + count) - 0.5) * r * 0.005, z + (hash(j, i + count) - 0.5) * r * 0.02, c === ZONE.larch ? 1 : 0, hash(i + count, j)); count -= 1; } } } }
  const idx = []; for (let j = 0; j < R - 1; j += 1) for (let i = 0; i < A - 1; i += 1) { const a = j * A + i, b = a + 1, c = a + A, d = c + 1; idx.push(a, b, c, b, d, c); /* counter-clockwise seen from above */ }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, lookMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { mountain: true, ground: true, glow: 0.55 })); mesh.name = 'blockout terrain'; if (trees.length) mesh.add(buildTrees(trees)); return mesh;
}

function buildWater() {
  const group = new THREE.Group();
  const lakeGeo = new THREE.CircleGeometry(1, 96); lakeGeo.scale(LAKE.rx * 1.12, LAKE.rz * 1.12, 1); /* the Reflector takes its plane from the mesh: geometry stays in XY, the mesh is laid flat */
  const lake = new Reflector(lakeGeo, { textureWidth: 1024, textureHeight: 512, color: 0x8a9aa4 }); lake.position.set(LAKE.x, 0, LAKE.z); lake.rotation.set(-Math.PI / 2, 0, LAKE.rot); group.add(lake);
  // the river as a ribbon following the course, wider toward the lake
  const P = [], I = []; for (let i = 0; i < riverPts.length; i += 1) { const p = riverPts[i], q = riverPts[Math.min(i + 1, riverPts.length - 1)], o = riverPts[Math.max(i - 1, 0)]; const tx = q.x - o.x, tz = q.y - o.y, l = Math.hypot(tx, tz) || 1; const w = lerp(3.2, 5.5, i / riverPts.length);
    const y = heightAt(p.x, p.y, true) - 0.9 + 0.0; P.push(p.x - (tz / l) * w, Math.max(0.05, y), p.y + (tx / l) * w, p.x + (tz / l) * w, Math.max(0.05, y), p.y - (tx / l) * w); if (i) { const a = (i - 1) * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.setIndex(I); rg.computeVertexNormals();
  group.add(new THREE.Mesh(rg, lookMat(new THREE.MeshStandardMaterial({ color: 0x6fa9a6, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide }))));
  return group;
}

// a block building: walls with a gabled roof; stone below, timber above is only a colour split at block-out stage
function house(w, d, wall, roof, eave, ridge, colour = '#cfc6b6') {
  const g = new THREE.Group(); const walls = new THREE.Mesh(new THREE.BoxGeometry(w, eave, d), lookMat(new THREE.MeshLambertMaterial({ color: colour }))); walls.position.y = eave / 2; g.add(walls);
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.6, 0), new THREE.Vector2(w / 2 + 0.6, 0), new THREE.Vector2(0, ridge - eave)]); const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 1.2, bevelEnabled: false }); rg.translate(0, eave, -(d + 1.2) / 2);
  g.add(new THREE.Mesh(rg, lookMat(new THREE.MeshLambertMaterial({ color: roof })))); return g;
}
function buildSettlements() {
  const group = new THREE.Group(); const place = (o, x, z, yaw = 0) => { o.position.set(x, heightAt(x, z, true) - 0.3, z); o.rotation.y = yaw; group.add(o); };
  // lower group: mill on the water, farmhouse, barn
  place(house(9, 7, 0, '#5a4b3f', 4.5, 8, '#b7aa94'), LOWER.x - 10, LOWER.z + 12, 0.4); place(house(12, 9, 0, '#4f4136', 5, 9.5, '#cfc3ad'), LOWER.x + 14, LOWER.z - 4, -0.2); place(house(16, 11, 0, '#4a3b2f', 5.5, 10.5, '#8a6a4c'), LOWER.x + 34, LOWER.z - 22, 0.1);
  // upper group: chapel with its tower, houses, the inn
  const chapel = house(8, 15, 0, '#5a5550', 7, 12, '#f1eee6'); const tower = new THREE.Mesh(new THREE.BoxGeometry(4.6, 27, 4.6), lookMat(new THREE.MeshLambertMaterial({ color: '#f1eee6' }))); tower.position.set(0, 13.5, 8.5); chapel.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.5, 10, 4), lookMat(new THREE.MeshLambertMaterial({ color: '#4c4a48' }))); spire.position.set(0, 32, 8.5); spire.rotation.y = Math.PI / 4; chapel.add(spire); place(chapel, UPPER.x - 4, UPPER.z + 30, 0.25); /* the chapel stands at the front of the terrace, the focal point; the houses sit behind and beside it, lower */
  [[-38, -2], [-20, -30], [30, -6], [44, -28], [8, -44], [-46, -32]].forEach(([dx, dz], i) => place(house(10 + (i % 3) * 2, 8 + (i % 2) * 2, 0, '#4f4640', 5 + (i % 2), 9.5 + (i % 2), i % 2 ? '#c9bea9' : '#a58566'), UPPER.x + dx, UPPER.z + dz, 0.3 + i * 0.4));
  HUTS.forEach(([x, z], i) => place(house(5, 4, 0, '#3e3329', 2.6, 4.6, '#6e5640'), x, z, i * 1.1));
  // the hero tree: a dark mass on a trunk
  const tree = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 8), lookMat(new THREE.MeshLambertMaterial({ color: '#4a3c2e' }))); trunk.position.y = 4; tree.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), lookMat(new THREE.MeshLambertMaterial({ color: '#3a5530' }))); crown.scale.set(1, 1.15, 1); crown.position.y = 14; tree.add(crown); place(tree, HERO_TREE[0], HERO_TREE[1]);
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
  night: [null, 0, 0, 0.9, '#9fb4e0', 0.35, '#1d2740', '#0e1218', '#1b2433', 0.9e-4],
};

export async function startBlockout(canvas, overlay) {
  await loadDem(); if (DEM && Q.get('reshape') !== '0') fitSkyline();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(FRAME.vfov, 1, 0.5, 30000); camera.position.set(0, FRAME.eye, 0); camera.rotation.set(FRAME.pitch * DEG, 0, 0, 'YXZ');
  const season = Q.get('season') || 'summer'; const mood = MOODS[Q.get('tod')] ?? MOODS.noon; const night = mood[0] === null;
  const t0 = performance.now(); scene.add(buildTerrain()); if (DEM) scene.add(buildMassif()); scene.add(buildWater()); scene.add(buildSettlements()); const buildMs = Math.round(performance.now() - t0);
  const sky = new Sky(); sky.scale.setScalar(25000); scene.add(sky); const u = sky.material.uniforms; u.turbidity.value = mood[1]; u.rayleigh.value = mood[2]; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
  const sunPose = night ? sunAt(-0.3, season) : sunAt(Number(Q.get('f') ?? mood[0]), season); u.sunPosition.value.copy(dirOf(sunPose.az, sunPose.el)); renderer.toneMappingExposure = mood[3] * (LOOK_ON ? (night ? 0.75 : LAND_EXPOSURE) : 1); /* night stays night: a moonlit valley, not a dim day */ if (LOOK_ON) sky.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', `gl_FragColor.rgb *= ${(1 / LAND_EXPOSURE).toFixed(3)};
#include <tonemapping_fragment>`); };
  const light = new THREE.DirectionalLight(mood[4], mood[5]); const hemi = new THREE.HemisphereLight(mood[6], mood[7], night ? 0.35 : LOOK_ON ? 1.7 : 1.3); /* the open sky is the main light on faces turned from the sun */ scene.add(light, hemi);
  // bounce: the open sky and the sunlit valley behind the camera light the faces turned toward us; without it every slope in front is black
  const bounce = new THREE.DirectionalLight(LOOK_ON && !night ? '#d9dcb4' : mood[6], night ? 0.08 : LOOK_ON ? 1.15 : 0.85); /* warm: light thrown back by the sunlit meadows behind the camera */ bounce.position.set(0, 400, 1000); scene.add(bounce);
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
  let frames = 0; renderer.setAnimationLoop(() => { renderer.render(scene, camera); frames += 1; window.__blockout.frames = frames; });
  window.__blockout = { ready: true, frames: 0, buildMs, sun: sunPose, season };
  if (overlay) { overlay.style.display = Q.get('overlay') === '0' ? 'none' : ''; window.addEventListener('keydown', (e) => { if (e.key === 'o' || e.key === 'O') overlay.style.display = overlay.style.display === 'none' ? '' : 'none'; }); }
}

// The sun as a disc with a soft glow (Sky.js alone loses the disc in the haze): additive, depth-tested so ridges cut it.
export function sunDisc(scene, dir, colour) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.08, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.25)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: colour, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  glow.scale.setScalar(2600); glow.position.copy(dir).multiplyScalar(20000); scene.add(glow);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(105, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(6), fog: false })); disc.position.copy(dir).multiplyScalar(20000); disc.lookAt(0, 0, 0); scene.add(disc);
}

// The massif at the elevation data's own 60 m spacing (every second sample), so ridges, couloirs and glacier basins keep their shape.
function buildMassif() {
  const m = DEM.meta, step = 2, W = Math.floor(m.width / step), H = Math.floor(m.height / step); const pos = new Float32Array(W * H * 3), col = new Float32Array(W * H * 3), ok = new Uint8Array(W * H);
  for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) { const lat = m.north - j * step * m.dLat, lon = m.west + i * step * m.dLon; const dN = (lat - DEM.vLat) * DEM.mLat, dE = (lon - DEM.vLon) * DEM.mLon;
    const r = Math.hypot(dN, dE), a = ((Math.atan2(dE, dN) / DEG - 180 + MASSIF.az + 540) % 360) - 180; /* wrapped: due south must not jump from +180 to -180 */ const [x, z] = toXZ(a, r); const k = j * W + i; if (r < 5500 || Math.abs(a) > 62) continue;
    const h = heightAt(x, z, true); const e = 60; const slope = Math.hypot(heightAt(x + e, z, true) - heightAt(x - e, z, true), heightAt(x, z + e, true) - heightAt(x, z - e, true)) / (2 * e);
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; const c = zoneColour(x, h, z, slope); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; ok[k] = 1; }
  const idx = []; for (let j = 0; j < H - 1; j += 1) for (let i = 0; i < W - 1; i += 1) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; if (ok[a] && ok[b] && ok[c] && ok[d]) idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(new Float32Array(W * H * 3), 3)); g.setIndex(idx); g.computeVertexNormals();
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

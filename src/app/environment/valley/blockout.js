import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

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
export const LOWER = { x: 34, z: -345 }; // the working group: mill on the river, farm, barn
export const UPPER = { ...(() => { const [x, z] = toXZ(13.2, 720); return { x, z }; })(), y: 46 }; // the old heart on its terrace
export const HUTS = [[-150, -430], [-260, -760], [255, -560], [372, -410]];
export const HERO_TREE = [-118, -360];
const inLake = (x, z) => { const c = Math.cos(LAKE.rot), s = Math.sin(LAKE.rot), dx = x - LAKE.x, dz = z - LAKE.z; const u = (dx * c - dz * s) / LAKE.rx, v = (dx * s + dz * c) / LAKE.rz; return u * u + v * v; };
function riverDistance(x, z) { let best = Infinity, along = 0; for (let i = 0; i < riverPts.length - 1; i += 1) { const a = riverPts[i], b = riverPts[i + 1]; const abx = b.x - a.x, abz = b.y - a.y; const t = clamp(((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz), 0, 1); const d = Math.hypot(x - a.x - abx * t, z - a.y - abz * t); if (d < best) { best = d; along = (i + t) / (riverPts.length - 1); } } return [best, along]; }

// The land: the valley floor (lake level, rising gently to the south), the camera's knoll, the upper hamlet's terrace, the valley sides,
// the foothills and the range, combined with a smooth maximum; the river and the lake are cut in.
const smax = (a, b, k) => (b <= a ? a : a + (b - a) * smooth(0, k, b - a)); // a soft maximum that never lifts the ground where the shapes are level
export function heightAt(x, z, cheap = false) {
  const r = Math.hypot(x, z), az = Math.atan2(x, -z) / DEG;
  let h = 1.2 + 0.012 * Math.max(0, -z) + 3 * (fbm(x / 140, z / 140, 3) - 0.5); // the floor
  h = smax(h, 8 - (r / 34) ** 2 * 8, 3); // the knoll under the camera
  { const d = Math.hypot(x - UPPER.x, z - UPPER.z); h = smax(h, UPPER.y * (1 - smooth(130, 260, d)) + 6 * (fbm(x / 60, z / 60, 2) - 0.5), 12); } // the terrace
  const f = profile(FOOT, az); const fh = Math.tan(f[1] * DEG) * f[2] + FRAME.eye - 8;
  const side = Math.abs(x - 60 - 0.08 * -z) - 560; if (side > 0) h = smax(h, Math.min(side * 0.42, Math.tan(f[1] * DEG) * r * 0.92) * (0.8 + 0.4 * fbm(x / 400, z / 400, 3)), 30); /* valley sides, never above the designed foothill skyline */
  h = smax(h, fh * smooth(f[2] - 2600, f[2], r) * (1 - 0.6 * smooth(f[2] + 600, f[2] + 2600, r)) * (0.82 + 0.36 * fbm(x / 700, z / 700, cheap ? 2 : 4)), 60);
  const m = profile(RANGE, az); const mh = Math.tan(m[1] * DEG) * m[2] + FRAME.eye; const crest = smooth(m[2] - 5200, m[2], r) * (1 - smooth(m[2], m[2] + 3500, r));
  h = smax(h, mh * crest * (0.74 + 0.3 * ridged(x / 1500, z / 1500, cheap ? 2 : 5)), 120);
  if (!cheap) { const [d] = riverDistance(x, z); h -= 2.2 * (1 - smooth(5, 16, d)); }
  const l = inLake(x, z); if (l < 1.6) h = lerp(-2.5, h, smooth(0.8, 1.6, l));
  return h;
}

const C = (hex) => new THREE.Color(hex);
const ZONE = { meadow: C('#93a85a'), hay: C('#a8b462'), pasture: C('#6f9447'), shore: C('#6b7d4a'), forest: C('#2c4429'), larch: C('#4a6435'), scree: C('#8b8a84'), rock: C('#6f6e6a'), snow: C('#eef1f4'), gravel: C('#a8a49a'), terrace: C('#8fa456') };
const SNOWLINE = Q.get('season') === 'winter' ? 120 : Q.get('season') === 'spring' ? 900 : 1500;
function zoneColour(x, h, z, slope) {
  const r = Math.hypot(x, z); const n = fbm(x / 90, z / 90, 3);
  if (h > SNOWLINE + 260 * (n - 0.5) && slope < 1.25) return ZONE.snow;
  if (slope > 1.0 || h > 1100) return h > 1100 && slope < 0.7 ? ZONE.scree : ZONE.rock;
  if (h > 640 + 160 * (n - 0.5)) return ZONE.scree.clone().lerp(ZONE.larch, 0.35); // above the treeline
  if (slope > 0.22 && h > 18) { const avalanche = Math.abs(Math.sin(x / 260 + fbm(x / 500, z / 500, 2) * 6)) < 0.12; if (avalanche) return ZONE.meadow.clone().lerp(ZONE.scree, 0.3); return n > 0.62 || h > 470 ? ZONE.larch : ZONE.forest; }
  const [d] = r < 1600 ? riverDistance(x, z) : [Infinity]; if (d < 22) return ZONE.gravel.clone().lerp(ZONE.shore, smooth(8, 22, d));
  if (inLake(x, z) < 1.5) return ZONE.shore;
  if (Math.hypot(x - UPPER.x, z - UPPER.z) < 200) return ZONE.terrace;
  return x > 40 ? ZONE.pasture.clone().lerp(ZONE.meadow, n) : ZONE.hay.clone().lerp(ZONE.meadow, n);
}

// a polar grid round the camera: fine near, coarse far, within the view and a margin
function buildTerrain() {
  const A = 401, R = 300, r0 = 12, r1 = 16000; const pos = new Float32Array(A * R * 3), col = new Float32Array(A * R * 3);
  for (let j = 0; j < R; j += 1) { const r = r0 * (r1 / r0) ** (j / (R - 1)); for (let i = 0; i < A; i += 1) { const az = -58 + (116 * i) / (A - 1); const [x, z] = toXZ(az, r); const h = heightAt(x, z); const e = Math.max(2, r * 0.004);
    const slope = Math.hypot(heightAt(x + e, z, true) - heightAt(x - e, z, true), heightAt(x, z + e, true) - heightAt(x, z - e, true)) / (2 * e); const k = (j * A + i) * 3; pos[k] = x; pos[k + 1] = h; pos[k + 2] = z; const c = zoneColour(x, h, z, slope); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; } }
  const idx = []; for (let j = 0; j < R - 1; j += 1) for (let i = 0; i < A - 1; i += 1) { const a = j * A + i, b = a + 1, c = a + A, d = c + 1; idx.push(a, b, c, b, d, c); /* counter-clockwise seen from above */ }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.name = 'blockout terrain'; return mesh;
}

function buildWater() {
  const group = new THREE.Group();
  const lakeGeo = new THREE.CircleGeometry(1, 96); lakeGeo.scale(LAKE.rx * 1.12, LAKE.rz * 1.12, 1); /* the Reflector takes its plane from the mesh: geometry stays in XY, the mesh is laid flat */
  const lake = new Reflector(lakeGeo, { textureWidth: 1024, textureHeight: 512, color: 0x8a9aa4 }); lake.position.set(LAKE.x, 0, LAKE.z); lake.rotation.set(-Math.PI / 2, 0, LAKE.rot); group.add(lake);
  // the river as a ribbon following the course, wider toward the lake
  const P = [], I = []; for (let i = 0; i < riverPts.length; i += 1) { const p = riverPts[i], q = riverPts[Math.min(i + 1, riverPts.length - 1)], o = riverPts[Math.max(i - 1, 0)]; const tx = q.x - o.x, tz = q.y - o.y, l = Math.hypot(tx, tz) || 1; const w = lerp(5, 9, i / riverPts.length);
    const y = heightAt(p.x, p.y, true) - 0.9 + 0.0; P.push(p.x - (tz / l) * w, Math.max(0.05, y), p.y + (tx / l) * w, p.x + (tz / l) * w, Math.max(0.05, y), p.y - (tx / l) * w); if (i) { const a = (i - 1) * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.setIndex(I); rg.computeVertexNormals();
  group.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0x8fcfca, roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide })));
  return group;
}

// a block building: walls with a gabled roof; stone below, timber above is only a colour split at block-out stage
function house(w, d, wall, roof, eave, ridge, colour = '#cfc6b6') {
  const g = new THREE.Group(); const walls = new THREE.Mesh(new THREE.BoxGeometry(w, eave, d), new THREE.MeshLambertMaterial({ color: colour })); walls.position.y = eave / 2; g.add(walls);
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.6, 0), new THREE.Vector2(w / 2 + 0.6, 0), new THREE.Vector2(0, ridge - eave)]); const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 1.2, bevelEnabled: false }); rg.translate(0, eave, -(d + 1.2) / 2);
  g.add(new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: roof }))); return g;
}
function buildSettlements() {
  const group = new THREE.Group(); const place = (o, x, z, yaw = 0) => { o.position.set(x, heightAt(x, z, true) - 0.3, z); o.rotation.y = yaw; group.add(o); };
  // lower group: mill on the water, farmhouse, barn
  place(house(9, 7, 0, '#5a4b3f', 4.5, 8, '#b7aa94'), LOWER.x - 10, LOWER.z + 12, 0.4); place(house(12, 9, 0, '#4f4136', 5, 9.5, '#cfc3ad'), LOWER.x + 14, LOWER.z - 4, -0.2); place(house(16, 11, 0, '#4a3b2f', 5.5, 10.5, '#8a6a4c'), LOWER.x + 34, LOWER.z - 22, 0.1);
  // upper group: chapel with its tower, houses, the inn
  const chapel = house(8, 15, 0, '#5a5550', 7, 12, '#f1eee6'); const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 22, 4), new THREE.MeshLambertMaterial({ color: '#f1eee6' })); tower.position.set(0, 11, 8.5); chapel.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.1, 7, 4), new THREE.MeshLambertMaterial({ color: '#4c4a48' })); spire.position.set(0, 25.5, 8.5); spire.rotation.y = Math.PI / 4; chapel.add(spire); place(chapel, UPPER.x, UPPER.z, 0.3);
  [[-34, 18], [-22, -26], [26, 16], [40, -20], [12, 38], [-48, -6]].forEach(([dx, dz], i) => place(house(10 + (i % 3) * 2, 8 + (i % 2) * 2, 0, '#4f4640', 5 + (i % 2), 9.5 + (i % 2), i % 2 ? '#c9bea9' : '#a58566'), UPPER.x + dx, UPPER.z + dz, 0.3 + i * 0.4));
  HUTS.forEach(([x, z], i) => place(house(5, 4, 0, '#3e3329', 2.6, 4.6, '#6e5640'), x, z, i * 1.1));
  // the hero tree: a dark mass on a trunk
  const tree = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 8), new THREE.MeshLambertMaterial({ color: '#4a3c2e' })); trunk.position.y = 4; tree.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), new THREE.MeshLambertMaterial({ color: '#3a5530' })); crown.scale.set(1, 1.15, 1); crown.position.y = 14; tree.add(crown); place(tree, HERO_TREE[0], HERO_TREE[1]);
  return group;
}

// The composed sun (docs/WORLD-SPEC.md section 3): it rises through the pass, arcs above the main peak and sets into the saddle. The arc is
// higher and longer in summer, lower in winter, and always inside the frame. f is the fraction of the day between sunrise and sunset.
export const SUN_ARC = { winter: { rise: -26.0, set: 29.8, peak: 15.0 }, spring: { rise: -26.8, set: 30.6, peak: 15.8 }, summer: { rise: -27.6, set: 31.4, peak: 16.4 } };
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

export function startBlockout(canvas, overlay) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(FRAME.vfov, 1, 0.5, 30000); camera.position.set(0, FRAME.eye, 0); camera.rotation.set(FRAME.pitch * DEG, 0, 0, 'YXZ');
  const season = Q.get('season') || 'summer'; const mood = MOODS[Q.get('tod')] ?? MOODS.noon; const night = mood[0] === null;
  const t0 = performance.now(); scene.add(buildTerrain()); scene.add(buildWater()); scene.add(buildSettlements()); const buildMs = Math.round(performance.now() - t0);
  const sky = new Sky(); sky.scale.setScalar(25000); scene.add(sky); const u = sky.material.uniforms; u.turbidity.value = mood[1]; u.rayleigh.value = mood[2]; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
  const sunPose = night ? sunAt(-0.3, season) : sunAt(Number(Q.get('f') ?? mood[0]), season); u.sunPosition.value.copy(dirOf(sunPose.az, sunPose.el)); renderer.toneMappingExposure = mood[3];
  const light = new THREE.DirectionalLight(mood[4], mood[5]); const hemi = new THREE.HemisphereLight(mood[6], mood[7], night ? 0.35 : 1.1); scene.add(light, hemi);
  scene.fog = new THREE.FogExp2(mood[8], mood[9]);
  let moon = null; if (night) { // the moon rides the same arc; stars are a simple field for now
    const mp = sunAt(Number(Q.get('mf') ?? 0.3), season); const d = dirOf(mp.az, mp.el); light.position.copy(d).multiplyScalar(1000);
    scene.background = new THREE.Color('#0b1220'); sky.visible = false;
    moon = new THREE.Mesh(new THREE.CircleGeometry(95, 48), new THREE.MeshBasicMaterial({ color: '#f3efe2', fog: false })); moon.position.copy(d).multiplyScalar(20000); moon.lookAt(0, 0, 0); scene.add(moon);
    const s = []; for (let i = 0; i < 2500; i += 1) { const az = (hash(i, 1) - 0.5) * 160, el = 2 + hash(i, 2) ** 0.7 * 60; s.push(...dirOf(az, el).multiplyScalar(25000).toArray()); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(s, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.4, sizeAttenuation: false, fog: false })));
  } else { light.position.copy(dirOf(sunPose.az, Math.max(sunPose.el, 1.5))).multiplyScalar(1000); }
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  let frames = 0; renderer.setAnimationLoop(() => { renderer.render(scene, camera); frames += 1; window.__blockout.frames = frames; });
  window.__blockout = { ready: true, frames: 0, buildMs, sun: sunPose, season };
  if (overlay) { overlay.style.display = Q.get('overlay') === '0' ? 'none' : ''; window.addEventListener('keydown', (e) => { if (e.key === 'o' || e.key === 'O') overlay.style.display = overlay.style.display === 'none' ? '' : 'none'; }); }
}

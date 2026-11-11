import * as THREE from 'three';
import { applyValleyLook } from './look.js';

// The hamlet's buildings (docs/WORLD-SPEC.md section 6; reference 30, the Valais hamlet): a stone plinth that takes up the slope, a
// whitewashed or stone ground floor, dark larch above in horizontal planks, a balcony along the front, a shallow roof of grey stone slates
// with deep eaves and a timber gable, small windows with shutters, a chimney. Every surface is a scanned material (Poly Haven, CC0) with its
// colour, normal and ambient-occlusion maps, mapped in metres so a stone is a stone's size on every wall.
const PH = '/design-reference/world-redesign/textures/ph/';
const TILE = { worn_mossy_plasterwall: 3.2, plastered_wall: 2.6, rustic_stone_wall: 2.4, weathered_planks: 2.2, roof_slates_02: 2.2 }; // metres per repeat
// the larch scan is near black and the stone deep in shade: lifted a little, so the fronts read when the sun is behind the houses
const GAIN = { weathered_planks: 1.45, rustic_stone_wall: 1.15 };
const loader = new THREE.TextureLoader(); const textures = new Map();
function maps(id) {
  if (!textures.has(id)) { const t = (name, srgb) => { const x = loader.load(`${PH}${id}/${name}.jpg`); if (srgb) x.colorSpace = THREE.SRGBColorSpace; x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; x.repeat.set(1 / TILE[id], 1 / TILE[id]); return x; };
    textures.set(id, { map: t('diff', true), normalMap: t('nor', false), aoMap: t('arm', false) }); }
  return textures.get(id);
}
const materials = new Map();
export function surface(id, tint = '#ffffff') {
  const key = id + tint; if (!materials.has(key)) { const m = new THREE.MeshLambertMaterial({ ...maps(id), color: new THREE.Color(tint).multiplyScalar(GAIN[id] ?? 1), aoMapIntensity: 0.8 });  materials.set(key, applyValleyLook(m, {})); }
  return materials.get(key);
}
const plain = new Map(); const flat = (col) => { if (!plain.has(col)) plain.set(col, applyValleyLook(new THREE.MeshLambertMaterial({ color: col }), {})); return plain.get(col); };

// UVs in metres, projected along each face's own normal: walls take (along, up), roofs (along the ridge, down the slope); `across` turns
// the pattern a quarter (horizontal planks from a texture of vertical boards)
export function metricUV(geo, across = false) {
  const p = geo.attributes.position, n = geo.attributes.normal; const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 1) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v;
    if (ay > ax && ay > az) { u = p.getX(i); v = p.getZ(i) / Math.max(ay, 0.3); } else if (ax > az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    if (across) [u, v] = [v, u]; uv[i * 2] = u; uv[i * 2 + 1] = v; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}

// A house: w along the ridge (local x), d deep; its front (balconies, most windows, the geraniums) faces local +z. storeys: timber floors
// over the stone or whitewashed ground floor (1 for a farmhouse, 2 for the tall village houses); a barn is boarded, with a hay door.
export function alpineHouse(w, d, { low = 3.0, high = 3.2, pitch = 0.42, seed = 0, stoneFloor = false, barn = false, lamps = null, plaster = 'worn_mossy_plasterwall', wood = '#ffffff', slate = '#ffffff', storeys = 1, eaves = 1.4 } = {}) {
  const g = new THREE.Group(); const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const box = (sx, sy, sz, mat, x, y, z, across = false) => { const geo = metricUV(new THREE.BoxGeometry(sx, sy, sz), across); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const stone = surface('rustic_stone_wall'), planks = surface('weathered_planks', wood), lower = stoneFloor || barn ? stone : surface(plaster);
  box(w + 0.3, 4.0, d + 0.3, stone, 0, -1.8, 0); // the plinth: down into the slope, so no house floats or sinks
  box(w, low, d, lower, 0, low / 2, 0);
  const timber = high * storeys; box(w * 0.995, timber, d * 0.995, planks, 0, low + timber / 2, 0, !barn); // horizontal larch planks on a house, vertical boards on a barn
  const eave = low + timber, rise = (d / 2 + eaves) * pitch; const shape = new THREE.Shape([new THREE.Vector2(-d / 2 - eaves, 0), new THREE.Vector2(d / 2 + eaves, 0), new THREE.Vector2(0, rise)]);
  const rg = new THREE.ExtrudeGeometry(shape, { depth: w + 1.8, bevelEnabled: false }); rg.rotateY(Math.PI / 2); rg.translate(-(w + 1.8) / 2, eave - 0.1, 0); rg.computeVertexNormals(); metricUV(rg);
  const roof = new THREE.Mesh(rg, [surface('weathered_planks', wood), surface('roof_slates_02', slate)]); roof.castShadow = true; roof.receiveShadow = true; g.add(roof); // timber gables, slate roof
  const soffit = box(w + 1.8, 0.12, d + eaves * 2, planks, 0, eave - 0.16, 0); soffit.castShadow = false; // the dark underside of the eaves
  if (!barn) for (let st = 0; st < storeys; st += 1) { const by = low + st * high; const bw = st === storeys - 1 ? w * 0.82 : w * 0.6; box(bw, 0.12, 1.3, planks, 0, by + 0.3, d / 2 + 0.65); box(bw, 1.0, 0.1, planks, 0, by + 0.85, d / 2 + 1.28, false); } // balconies along the front
  const shut = ['#3d5a3a', '#6a4a2c', '#5a2e26', '#3a4a5a'][seed % 4]; const n = barn ? 1 : Math.max(2, Math.floor(w / 3.0)); const bloom = ['#c4262e', '#d23a5c', '#c4262e'][seed % 3];
  const rows = barn ? [[low + timber * 0.5, 1.6]] : [[low * 0.55, 1.0], ...Array.from({ length: storeys }, (_, st) => [low + st * high + high * 0.55, 0.95])];
  for (let k = 0; k < n; k += 1) { const x = -w / 2 + (k + 0.5) * (w / n);
    for (const [y, s] of rows) {
      if (barn) { box(1.8, 2.2, 0.08, flat('#2a211a'), x, y, d / 2 + 0.03); continue; } // the hay door
      box(1.12 * s, 1.32 * s, 0.06, flat('#ece9e2'), x, y, d / 2 + 0.03); const pane = box(0.9 * s, 1.1 * s, 0.08, new THREE.MeshLambertMaterial({ color: '#1d1916' }), x, y, d / 2 + 0.05); applyValleyLook(pane.material, {});
      if (lamps && hash(seed * 7.3 + k, y) > 0.38) { pane.material.emissive.set('#ffae55'); pane.material.emissiveIntensity = lamps === 'night' ? 2.6 : 1.4; } // lamplight: most windows lit when it gets dark, not all
      box(0.4 * s, 1.3 * s, 0.06, flat(shut), x - 0.78 * s, y, d / 2 + 0.06); box(0.4 * s, 1.3 * s, 0.06, flat(shut), x + 0.78 * s, y, d / 2 + 0.06);
      if (y > low && hash(seed, k + y) > 0.25) { box(1.0 * s, 0.22, 0.28, planks, x, y - 0.72 * s, d / 2 + 0.18); box(0.96 * s, 0.24, 0.34, flat(bloom), x, y - 0.52 * s, d / 2 + 0.2); } // geraniums in a window box
      box(0.9 * s, 1.1 * s, 0.08, flat('#1d1916'), x, y, -d / 2 - 0.03); } }
  if (!barn) box(0.8, 2.0, 0.8, surface(plaster), w * 0.25, eave + rise * 0.6, -d * 0.15).name = 'chimney';
  g.userData.foot = [w + 1.8, d + eaves * 2]; g.userData.size = [w, d]; return g;
}

// A Valais granary (stadel): a small timber store raised on posts capped with flat round stones, so no mouse climbs in
export function stadel(seed = 0) {
  const g = new THREE.Group(); const planks = surface('weathered_planks'), stone = surface('rustic_stone_wall');
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(metricUV(geo), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(4.6, 1.6, 4.0), stone, 0, -0.4, 0);
  for (const [x, z] of [[-1.7, -1.4], [1.7, -1.4], [-1.7, 1.4], [1.7, 1.4], [0, -1.4], [0, 1.4]]) { add(new THREE.BoxGeometry(0.3, 0.75, 0.3), planks, x, 0.75, z); add(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12), stone, x, 1.18, z); }
  add(new THREE.BoxGeometry(4.2, 3.2, 3.6), planks, 0, 2.85, 0);
  const shape = new THREE.Shape([new THREE.Vector2(-2.6, 0), new THREE.Vector2(2.6, 0), new THREE.Vector2(0, 1.7)]); const rg = new THREE.ExtrudeGeometry(shape, { depth: 5.2, bevelEnabled: false }); rg.rotateY(Math.PI / 2); rg.translate(-2.6, 4.4, 0); rg.computeVertexNormals();
  const roof = new THREE.Mesh(metricUV(rg), [planks, surface('roof_slates_02')]); roof.castShadow = true; g.add(roof);
  add(new THREE.BoxGeometry(0.9, 1.6, 0.08), flat('#241c16'), 0.4, 2.6, 1.82);
  g.userData.foot = [5.2, 4.6]; return g;
}

// signs of life: a woodpile, a vegetable garden, timber rail fences and dry-stone walls along a line of points on the ground
export function woodpile(len = 3) { const g = new THREE.Group(); const m = new THREE.Mesh(metricUV(new THREE.BoxGeometry(len, 1.5, 0.7), true), surface('weathered_planks', '#d8b48a')); m.position.y = 0.75; m.castShadow = true; g.add(m); const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 0.06, 0.9), surface('weathered_planks')); cap.position.y = 1.53; g.add(cap); return g; }
export function garden(w = 6, d = 4) { const g = new THREE.Group(); const soil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), flat('#4a3626')); soil.position.y = 0.06; g.add(soil);
  for (let i = 0; i < Math.floor(d / 0.6); i += 1) { const row = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.22, 0.28), flat(i % 3 === 2 ? '#7a8a3a' : '#3f6a2a')); row.position.set(0, 0.2, -d / 2 + 0.4 + i * 0.6); g.add(row); } return g; }
export function fenceAlong(points, at, { post = 2.6 } = {}) { const g = new THREE.Group(); const wood = surface('weathered_planks', '#e8d8c4');
  for (let i = 0; i < points.length - 1; i += 1) { const a = points[i], b = points[i + 1]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(len / post)); const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (let k = 0; k <= n; k += 1) { if (k === n && i < points.length - 2) continue; const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), wood); p.position.set(x, at(x, z) + 0.55, z); p.castShadow = true; g.add(p); }
    for (const ry of [0.55, 1.0]) { const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2; const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, len), wood); r.position.set(x, (at(a[0], a[1]) + at(b[0], b[1])) / 2 + ry, z); r.rotation.y = yaw; r.castShadow = true; g.add(r); } }
  g.name = 'fence'; return g; }
export function wallAlong(points, at, { height = 0.9 } = {}) { const g = new THREE.Group(); const stone = surface('rustic_stone_wall');
  for (let i = 0; i < points.length - 1; i += 1) { const a = points[i], b = points[i + 1]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    const m = new THREE.Mesh(metricUV(new THREE.BoxGeometry(0.7, height + 1.2, len + 0.3)), stone); m.position.set(x, Math.max(at(a[0], a[1]), at(b[0], b[1])) + height / 2 - 0.6, z); m.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.name = 'dry-stone wall'; return g; }

// The chapel: a white nave with a choir apse behind, a slate roof, its tower at the front toward the valley with stone quoins at the
// corners, the belfry open, a clock, a slate spire
export function chapel() {
  const g = new THREE.Group(); const white = surface('plastered_wall', '#fbfaf6'), stone = surface('rustic_stone_wall'), slate = surface('roof_slates_02', '#d8d6d2');
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(metricUV(new THREE.BoxGeometry(9.6, 4, 17.6)), stone, 0, -1.8, 0);
  add(metricUV(new THREE.BoxGeometry(9, 8, 17)), white, 0, 4, 0);
  const shape = new THREE.Shape([new THREE.Vector2(-5.2, 0), new THREE.Vector2(5.2, 0), new THREE.Vector2(0, 5.4)]); const rg = new THREE.ExtrudeGeometry(shape, { depth: 18.2, bevelEnabled: false }); rg.translate(0, 7.9, -9.1); rg.computeVertexNormals(); metricUV(rg);
  add(rg, [white, slate], 0, 0, 0);
  const apse = add(metricUV(new THREE.CylinderGeometry(3.6, 3.6, 7, 16, 1, false, Math.PI / 2, Math.PI)), white, 0, 3.5, -8.5); // the choir
  add(metricUV(new THREE.ConeGeometry(4.1, 2.6, 16, 1, false, Math.PI / 2, Math.PI)), slate, 0, 8.2, -8.5);
  for (const sx of [-1, 1]) for (const z of [-4.5, 0, 4.5]) add(new THREE.BoxGeometry(0.08, 2.6, 1.1), flat('#2a2622'), sx * 4.52, 4.6, z); // tall windows along the nave
  add(metricUV(new THREE.BoxGeometry(5.6, 4, 5.6)), stone, 0, -1.8, 10.6);
  add(metricUV(new THREE.BoxGeometry(5.2, 29, 5.2)), white, 0, 14.5, 10.6);
  for (const [x, z] of [[-2.55, 2.55], [2.55, 2.55], [-2.55, -2.55], [2.55, -2.55]]) for (let k = 0; k < 14; k += 1) add(new THREE.BoxGeometry(k % 2 ? 0.75 : 0.5, 0.95, k % 2 ? 0.5 : 0.75), stone, x, 0.6 + k * 1.9, 10.6 + z); // the quoins
  for (const [x, z, sx, sz] of [[0, 2.62, 1.5, 0.06], [0, -2.62, 1.5, 0.06], [2.62, 0, 0.06, 1.5], [-2.62, 0, 0.06, 1.5]]) add(new THREE.BoxGeometry(sx, 3.0, sz), flat('#221e1b'), x, 25.2, 10.6 + z); // the belfry openings
  const face = add(new THREE.CylinderGeometry(1.15, 1.15, 0.06, 28), flat('#26324a'), 0, 21.2, 13.24); face.rotation.x = Math.PI / 2; const ring = add(new THREE.TorusGeometry(1.15, 0.08, 6, 28), flat('#c9a24a'), 0, 21.2, 13.27); // the clock
  const spire = add(metricUV(new THREE.ConeGeometry(3.9, 12, 4).toNonIndexed().rotateY(Math.PI / 4)), surface('roof_slates_02', '#bdbab5'), 0, 35, 10.6); spire.geometry.computeVertexNormals(); metricUV(spire.geometry);
  add(new THREE.BoxGeometry(1.6, 3.0, 0.1), flat('#3a2a1e'), 0, 1.5, 13.25); // the door, under the tower
  g.userData.foot = [10.4, 24]; return g;
}

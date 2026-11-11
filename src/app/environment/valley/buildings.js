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

// A house: w along the ridge (local x), d deep; its front (balcony, most windows) faces local +z
export function alpineHouse(w, d, { low = 3.0, high = 3.2, pitch = 0.42, seed = 0, stoneFloor = false, barn = false, lamps = null, plaster = 'worn_mossy_plasterwall', wood = '#ffffff', slate = '#ffffff' } = {}) {
  const g = new THREE.Group(); const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const box = (sx, sy, sz, mat, x, y, z, across = false) => { const geo = metricUV(new THREE.BoxGeometry(sx, sy, sz), across); geo.translate(0, 0, 0); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const stone = surface('rustic_stone_wall'), planks = surface('weathered_planks', wood), lower = stoneFloor || barn ? stone : surface(plaster);
  box(w + 0.3, 4.0, d + 0.3, stone, 0, -1.8, 0); // the plinth: down into the slope, so no house floats or sinks
  box(w, low, d, lower, 0, low / 2, 0);
  box(w * 0.995, high, d * 0.995, planks, 0, low + high / 2, 0, !barn); // horizontal larch planks on a house, vertical boards on a barn
  const eave = low + high, rise = (d / 2 + 1.4) * pitch; const shape = new THREE.Shape([new THREE.Vector2(-d / 2 - 1.4, 0), new THREE.Vector2(d / 2 + 1.4, 0), new THREE.Vector2(0, rise)]);
  const rg = new THREE.ExtrudeGeometry(shape, { depth: w + 1.8, bevelEnabled: false }); rg.rotateY(Math.PI / 2); rg.translate(-(w + 1.8) / 2, eave - 0.1, 0); rg.computeVertexNormals(); metricUV(rg);
  const roof = new THREE.Mesh(rg, [surface('weathered_planks', wood), surface('roof_slates_02', slate)]); roof.castShadow = true; roof.receiveShadow = true; g.add(roof); // timber gables, slate roof
  const soffit = box(w + 1.8, 0.12, d + 2.8, planks, 0, eave - 0.16, 0); soffit.castShadow = false; // the dark underside of the eaves
  if (!barn) { box(w * 0.6, 0.12, 1.3, planks, 0, low + 0.3, d / 2 + 0.65); box(w * 0.6, 1.0, 0.1, planks, 0, low + 0.85, d / 2 + 1.28, false); } // the balcony along the front
  const shut = seed % 2 ? '#3d5a3a' : '#6a4a2c'; const n = barn ? 1 : Math.max(2, Math.floor(w / 3.0));
  for (let k = 0; k < n; k += 1) { const x = -w / 2 + (k + 0.5) * (w / n);
    for (const [y, s] of barn ? [[low + high * 0.5, 1.6]] : [[low * 0.55, 1.0], [low + high * 0.5, 0.95]]) {
      if (barn) { box(1.6, 2.0, 0.08, flat('#2a211a'), x, y, d / 2 + 0.03); continue; } // the hay door
      box(1.12 * s, 1.32 * s, 0.06, flat('#e9e6df'), x, y, d / 2 + 0.03); const pane = box(0.9 * s, 1.1 * s, 0.08, new THREE.MeshLambertMaterial({ color: '#1d1916' }), x, y, d / 2 + 0.05); applyValleyLook(pane.material, {});
      if (lamps && hash(seed * 7.3 + k, y) > 0.38) { pane.material.emissive.set('#ffae55'); pane.material.emissiveIntensity = lamps === 'night' ? 2.6 : 1.4; } // lamplight: most windows lit when it gets dark, not all
      box(0.4 * s, 1.3 * s, 0.06, flat(shut), x - 0.78 * s, y, d / 2 + 0.06); box(0.4 * s, 1.3 * s, 0.06, flat(shut), x + 0.78 * s, y, d / 2 + 0.06);
      box(0.9 * s, 1.1 * s, 0.08, flat('#1d1916'), x, y, -d / 2 - 0.03); } }
  if (!barn) box(0.8, 2.0, 0.8, surface(plaster), w * 0.25, eave + rise * 0.6, -d * 0.15).name = 'chimney';
  g.userData.foot = [w + 1.8, d + 2.8]; return g;
}

// The chapel: a white nave with a slate roof, its tower at the front gable toward the valley, a slate spire
export function chapel() {
  const g = new THREE.Group(); const white = surface('plastered_wall', '#fbfaf6'), stone = surface('rustic_stone_wall');
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(metricUV(new THREE.BoxGeometry(8.6, 4, 15.6)), stone, 0, -1.8, 0);
  add(metricUV(new THREE.BoxGeometry(8, 7, 15)), white, 0, 3.5, 0);
  const shape = new THREE.Shape([new THREE.Vector2(-4.6, 0), new THREE.Vector2(4.6, 0), new THREE.Vector2(0, 4.2)]); const rg = new THREE.ExtrudeGeometry(shape, { depth: 16.2, bevelEnabled: false }); rg.translate(0, 6.9, -8.1); rg.computeVertexNormals(); metricUV(rg);
  add(rg, [white, surface('roof_slates_02', '#d8d6d2')], 0, 0, 0);
  add(metricUV(new THREE.BoxGeometry(5, 4, 5)), stone, 0, -1.8, 9.2);
  add(metricUV(new THREE.BoxGeometry(4.6, 27, 4.6)), white, 0, 13.5, 9.2);
  for (const [x, z] of [[0, 2.32], [0, -2.32], [2.32, 0], [-2.32, 0]]) add(new THREE.BoxGeometry(Math.abs(x) > 0 ? 0.06 : 1.0, 2.0, Math.abs(z) > 0 ? 0.06 : 1.0), flat('#2a2622'), x, 23.5, 9.2 + z); // the belfry openings
  const clock = add(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 24), flat('#2d2f33'), 0, 19.5, 11.53); clock.rotation.x = Math.PI / 2;
  const spire = add(metricUV(new THREE.ConeGeometry(3.5, 11, 4).toNonIndexed().rotateY(Math.PI / 4)), surface('roof_slates_02', '#bdbab5'), 0, 32.5, 9.2); spire.geometry.computeVertexNormals(); metricUV(spire.geometry);
  add(new THREE.BoxGeometry(1.4, 2.6, 0.1), flat('#3a2a1e'), 0, 1.3, 11.55); // the door, under the tower
  g.userData.foot = [9.2, 20]; return g;
}

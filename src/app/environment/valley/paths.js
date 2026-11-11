import * as THREE from 'three';
import { applyValleyLook } from './look.js';
import { surface, metricUV } from './buildings.js';

// Paths worn into the meadow: a ribbon laid on the ground along the path, textured with a scanned dirt path (Poly Haven grass_path_2,
// CC0) in metres along its length, its edges fading into the sward. Where the path meets the river a timber footbridge carries it over.
const PATH_TEX = '/design-reference/world-redesign/textures/grass_path_2.jpg';
let pathMaps = null;
function maps() {
  if (pathMaps) return pathMaps; const t = new THREE.TextureLoader().load(PATH_TEX); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.22, 'rgba(255,255,255,1)'); grad.addColorStop(0.78, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = grad; g.fillRect(0, 0, 4, 64);
  const a = new THREE.CanvasTexture(c); a.wrapS = THREE.RepeatWrapping; pathMaps = { map: t, alphaMap: a }; return pathMaps;
}

// points: Vector2 (x, z) spaced along the path; at(x, z): ground height; wet(x, z): true where the river is (no ribbon there)
export function buildPath(points, { width = 1.8, at, wet = () => false, tile = 2.6 } = {}) {
  const P = [], U = [], A = [], I = [], C = []; const wn = (a) => { const v = Math.sin(a * 0.37) * 0.5 + Math.sin(a * 0.13 + 1.7) * 0.3 + Math.sin(a * 1.1 + 0.4) * 0.2; return v; }; let along = 0; let open = false;
  for (let i = 0; i < points.length; i += 1) { const p = points[i], q = points[Math.min(i + 1, points.length - 1)], o = points[Math.max(i - 1, 0)]; const dx = q.x - o.x, dz = q.y - o.y, l = Math.hypot(dx, dz) || 1; const nx = -dz / l, nz = dx / l;
    if (i > 0) along += p.distanceTo(points[i - 1]); const w = width * (0.85 + 0.3 * Math.sin(i * 0.7) * Math.sin(i * 0.23)); /* a worn path is never one width */
    if (wet(p.x, p.y)) { open = false; continue; }
    const base = P.length / 3; for (const s of [-1, 0, 1]) { const x = p.x + nx * s * w / 2, z = p.y + nz * s * w / 2; P.push(x, at(x, z) + 0.12, z); U.push(along / tile, (s + 1) / 2); A.push(along, (s + 1) / 2); C.push(1, 1, 1, Math.min(0.7, Math.max(0.15, 0.48 + 0.45 * wn(along + s * 3.1)))); } /* worn bare in places, grassed over in others */
    if (open) { const b = base - 3; I.push(b, base, b + 1, b + 1, base, base + 1, b + 1, base + 1, b + 2, b + 2, base + 1, base + 2); } open = true; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 4)); geo.setIndex(I); geo.computeVertexNormals(); if (geo.attributes.normal.getY(1) < 0) { for (let k = 0; k < I.length; k += 3) [I[k + 1], I[k + 2]] = [I[k + 2], I[k + 1]]; geo.setIndex(I); geo.computeVertexNormals(); } /* face up */
  const { map, alphaMap } = maps(); const m = applyValleyLook(new THREE.MeshLambertMaterial({ map, alphaMap, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { ground: false });
  const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; mesh.renderOrder = 1; mesh.name = 'path'; return mesh;
}

// A timber footbridge: a plank deck on two log beams, a hand rail on each side, stone abutments on the banks. from/to: Vector2 on each bank
export function footbridge(from, to, y) {
  const g = new THREE.Group(); const len = from.distanceTo(to) + 3, yaw = Math.atan2(to.x - from.x, to.y - from.y); const wood = surface('weathered_planks'), stone = surface('rustic_stone_wall');
  const add = (geo, mat, x, yy, z) => { const m = new THREE.Mesh(metricUV(geo), mat); m.position.set(x, yy, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(1.7, 0.14, len), wood, 0, 0.62, 0); // the deck
  for (const s of [-0.65, 0.65]) { add(new THREE.BoxGeometry(0.26, 0.32, len), wood, s, 0.4, 0); add(new THREE.BoxGeometry(0.09, 0.09, len - 0.6), wood, s * 1.18, 1.62, 0); // beams and rails
    for (let k = 0; k <= 4; k += 1) add(new THREE.BoxGeometry(0.1, 1.0, 0.1), wood, s * 1.18, 1.15, -len / 2 + 0.3 + (k * (len - 0.6)) / 4); }
  for (const e of [-1, 1]) add(new THREE.BoxGeometry(2.4, 1.6, 1.6), stone, 0, -0.2, e * (len / 2 - 0.6)); // the abutments
  g.position.set((from.x + to.x) / 2, y, (from.y + to.y) / 2); g.rotation.y = yaw; g.name = 'footbridge'; return g;
}

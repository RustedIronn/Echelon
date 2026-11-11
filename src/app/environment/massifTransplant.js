import * as THREE from 'three';
import { invalidate } from '@react-three/fiber';

// Transplant, step 2: the new valley's summit group (the Everest-shaped massif built on real terrain; valley/blockout.js, baked by
// perf/bakemassif.mjs into massif-heights.bin) stands behind the old scene's range, at the old scene's scale and in the old scene's own
// mountain material (the display transform and the mountain surface pass), so it wears the same skin. The old range stays as it is and
// becomes the middle range in front of it. ?massif=0 removes it; ?massifd= distance, ?massifh= height factor, ?massifaz= degrees right.
const Q = typeof window === 'undefined' ? new URLSearchParams('') : new URLSearchParams(window.location.search);
export const MASSIF_WANTED = Q.get('massif') === '1'; // off: the user chose the old range grown in place; ?massif=1 to see this option
const ROOT = '/assets/environment/alpine-prototype';
const VALLEY_DISTANCE = 12000; // the summit's distance from the valley's camera, metres

export function addMassif(group, camera, dress) {
  if (!MASSIF_WANTED) return;
  Promise.all([fetch(`${ROOT}/massif-heights.json`).then((r) => r.json()), fetch(`${ROOT}/massif-heights.bin`).then((r) => r.arrayBuffer())]).then(([meta, buf]) => {
    const H = new Float32Array(buf); const N = meta.n, cell = meta.cell, half = ((N - 1) / 2) * cell; const [sx, sz] = meta.summit;
    const D = Number(Q.get('massifd') ?? 820), hk = Number(Q.get('massifh') ?? 0.8), A = (Number(Q.get('massifaz') ?? 2) * Math.PI) / 180; const s = D / VALLEY_DISTANCE; const az0 = Math.atan2(sx, -sz);
    const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3); const c = new THREE.Color();
    const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) { const k = j * N + i; const x = sx - half + i * cell, z = sz - half + j * cell; const edge = Math.hypot(x - sx, z - sz) / half; const h = H[k] * (1 - Math.min(1, Math.max(0, (edge - 0.55) / 0.4)) ** 2); /* the flanks sink away toward the grid's edge, behind the old range: no cut edge shows */
      const az = Math.atan2(x, -z) - az0 + A, r = Math.hypot(x, z) * s; pos[k * 3] = camera.position.x + Math.sin(az) * r; pos[k * 3 + 1] = -8 + h * s * hk; pos[k * 3 + 2] = camera.position.z - Math.cos(az) * r;
      const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, N - 1), j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, N - 1); const slope = Math.hypot(H[j * N + i1] - H[j * N + i0], H[j1 * N + i] - H[j0 * N + i]) / (2 * cell);
      // the old range's palette: meadow green on the foothills, cool grey rock, clean snow where it can lie
      const n = hash(i * 0.37, j * 0.53); const rock = Math.min(1, Math.max(0, (slope - 0.35) / 0.4)) + Math.min(1, Math.max(0, (h - 1100) / 500));
      c.setRGB(0.2, 0.33, 0.12).lerp(new THREE.Color(0.2 + 0.05 * n, 0.22 + 0.05 * n, 0.27 + 0.05 * n), Math.min(1, rock)); /* darker than the old range's rock: the air between lightens it again */
      const snow = Math.min(1, Math.max(0, (h - 1750 - 300 * n) / 250)) * Math.min(1, Math.max(0, (1.15 - slope) / 0.3)); c.lerp(new THREE.Color(0.88, 0.9, 0.94), snow);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    const idx = []; for (let j = 0; j < N - 1; j += 1) for (let i = 0; i < N - 1; i += 1) { const a = j * N + i, b = a + 1, d = a + N, e = d + 1; idx.push(a, d, b, b, d, e); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }); dress(material);
    material.userData.lookRole = 'mountains'; material.userData.baseColor = material.color.clone();
    const mesh = new THREE.Mesh(geo, material); mesh.name = 'massif transplant'; mesh.frustumCulled = false; group.add(mesh); invalidate();
  }).catch((e) => console.warn('massif transplant', e));
}

// Scale, step 2: a forested ridge between the meadow hills and the peaks (about 400-620 m out), dark with conifers and set with small
// trees whose tops break its skyline. Things of a known size, this small, tell the eye the peaks behind stand kilometres off. It dips
// where the river's valley runs through, so the view up the valley to the range stays open. ?ridge=0 removes it.
export const RIDGE_WANTED = Q.get('ridge') !== '0';
export function addForestRidge(group, camera, dress) {
  if (!RIDGE_WANTED) return;
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const noise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, 7.3) * (1 - u) + hash(i + 1, 7.3) * u; };
  const fbm = (x) => 0.55 * noise(x) + 0.3 * noise(x * 2.3 + 5) + 0.15 * noise(x * 5.1 + 9);
  const A0 = -52, A1 = 52, NA = 261, NR = 13, R0 = 400, R1 = 640; const gapAz = Number(Q.get('ridgegap') ?? -6);
  const crest = (az) => { const gap = Math.min(1, Math.abs(az - gapAz) / 11); return (9 + 30 * fbm(az / 9 + 3)) * (0.12 + 0.88 * gap * gap * (3 - 2 * gap)); }; // metres above the base
  const at = (az, r) => { const t = (r - R0) / (R1 - R0); return -1 + crest(az) * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.8 * (0.85 + 0.3 * noise(az * 0.7 + r * 0.02)); };
  const xz = (az, r) => { const a = (az * Math.PI) / 180; return [camera.position.x + Math.sin(a) * r, camera.position.z - Math.cos(a) * r]; };
  const pos = new Float32Array(NA * NR * 3), col = new Float32Array(NA * NR * 3);
  for (let j = 0; j < NR; j += 1) for (let i = 0; i < NA; i += 1) { const az = A0 + ((A1 - A0) * i) / (NA - 1), r = R0 + ((R1 - R0) * j) / (NR - 1); const [x, z] = xz(az, r); const k = (j * NA + i) * 3;
    pos[k] = x; pos[k + 1] = at(az, r); pos[k + 2] = z; const n = hash(i * 0.7, j * 1.3); col[k] = 0.08 + 0.04 * n; col[k + 1] = 0.15 + 0.05 * n; col[k + 2] = 0.07 + 0.03 * n; }
  const idx = []; for (let j = 0; j < NR - 1; j += 1) for (let i = 0; i < NA - 1; i += 1) { const a = j * NA + i, b = a + 1, d = a + NA, e = d + 1; idx.push(a, d, b, b, d, e); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const ground = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }); dress(ground, true);
  const ridge = new THREE.Mesh(geo, ground); ridge.name = 'forest ridge'; ridge.frustumCulled = false; group.add(ridge);
  // the trees: small spruce shapes over the whole ridge, thickest toward its crest
  const count = 5200; const cone = new THREE.ConeGeometry(1, 1, 6); cone.translate(0, 0.5, 0); const treeMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }); dress(treeMat, true); /* the same air as the ridge and the range: they sit in the distance, not on top of it */
  const trees = new THREE.InstancedMesh(cone, treeMat, count); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let n = 0;
  for (let i = 0; i < count * 3 && n < count; i += 1) { const az = A0 + (A1 - A0) * hash(i, 1.7), r = R0 + 12 + (R1 - R0 - 24) * hash(i, 2.9); const y = at(az, r); if (y < 2.5 || hash(i, 4.1) > 0.35 + y / 30) continue;
    const [x, z] = xz(az, r); const h = (5 + 9 * hash(i, 5.3) ** 1.6) * (0.8 + 0.4 * noise(az * 0.9)); /* mixed ages, taller and shorter stands */ m.compose(new THREE.Vector3(x, y - 0.5, z), q, new THREE.Vector3(h * 0.3, h, h * 0.3)); trees.setMatrixAt(n, m); const g = hash(i, 6.7); trees.setColorAt(n, c.setRGB(0.07 + 0.05 * g, 0.13 + 0.07 * g, 0.06 + 0.03 * g)); n += 1; }
  trees.count = n; trees.instanceMatrix.needsUpdate = true; trees.frustumCulled = false; trees.name = 'forest ridge trees'; group.add(trees);
}

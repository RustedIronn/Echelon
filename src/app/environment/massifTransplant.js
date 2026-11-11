import * as THREE from 'three';
import { invalidate } from '@react-three/fiber';

// Transplant, step 2: the new valley's summit group (the Everest-shaped massif built on real terrain; valley/blockout.js, baked by
// perf/bakemassif.mjs into massif-heights.bin) stands behind the old scene's range, at the old scene's scale and in the old scene's own
// mountain material (the display transform and the mountain surface pass), so it wears the same skin. The old range stays as it is and
// becomes the middle range in front of it. ?massif=0 removes it; ?massifd= distance, ?massifh= height factor, ?massifaz= degrees right.
const Q = typeof window === 'undefined' ? new URLSearchParams('') : new URLSearchParams(window.location.search);
export const MASSIF_WANTED = Q.get('massif') !== '0';
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

import * as THREE from 'three';
// The new valley's near ground (baked by perf/bakenear.mjs: heights in metres above the lake surface, on a 2 m grid round the valley's camera),
// laid over the old scene's ground at a uniform scale about the camera, so the lake bowl, the hamlet's rise and the valley sides come across
// while everything the old scene grows or places on the ground follows. ?shape=0 removes it; ?shapek= the scale (valley metres -> old metres).
const Q = typeof window === 'undefined' ? new URLSearchParams('') : new URLSearchParams(window.location.search);
export const SHAPE_ON = Q.get('shape') !== '0';
export const SHAPE_K = Number(Q.get('shapek') ?? 0.4);
let data = null, meta = null;
if (SHAPE_ON && typeof window !== 'undefined') {
  try {
    const root = '/assets/environment/alpine-prototype';
    const [m, b] = await Promise.all([fetch(`${root}/near-heights.json`).then((r) => r.json()), fetch(`${root}/near-heights.bin`).then((r) => r.arrayBuffer())]);
    meta = m; data = new Float32Array(b);
  } catch (e) { console.warn('near shape', e); }
}
export const shapeReady = () => !!data;
// the valley's height (metres above its lake) at a valley position, bilinear
function valleyHeight(vx, vz) {
  const fx = (vx - meta.minX) / meta.cell, fz = (vz - meta.minZ) / meta.cell; const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i + 1 >= meta.w || j + 1 >= meta.h) return NaN; const u = fx - i, v = fz - j; const a = data[j * meta.w + i], b = data[j * meta.w + i + 1], c = data[(j + 1) * meta.w + i], d = data[(j + 1) * meta.w + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// camera: the old hero camera's (x, z); waterY: the old stream's surface height. Returns { mask, height } in old metres at old (x, z).
export function shapeAt(x, z, camera = [-3, 10], waterY = 0) {
  if (!data) return { mask: 0, height: 0 };
  const near = smooth(34, 80, Math.hypot(x - camera[0], z - camera[1])); const far = 1 - smooth(Number(Q.get('shapefar') ?? 190), 260, camera[1] - z); const mask = near * far; if (mask <= 0) return { mask: 0, height: 0 };
  const h = valleyHeight((x - camera[0]) / SHAPE_K, (z - camera[1]) / SHAPE_K); if (h !== h) return { mask: 0, height: 0 };
  return { mask, height: waterY + h * SHAPE_K * Number(Q.get('shapeh') ?? 1) };
}

// The valley's lake as a water surface for the old scene's water material: every grid cell of the bowl (ground below the lake surface) becomes
// two triangles at the old stream's level, with waterDepth rising from the shore to the middle. Returns null when the valley ground isn't loaded.
export function buildLakeGeometry(camera = [-3, 10], waterY = 0) {
  if (!data) return null; const step = 3; const x0 = -180, x1 = 120, z0 = -330, z1 = -20; const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
  const H = new Float32Array(nx * nz); for (let j = 0; j < nz; j += 1) for (let i = 0; i < nx; i += 1) { const h = valleyHeight(x0 + i * step, z0 + j * step); H[j * nx + i] = h === h ? h : 9; }
  const P = [], D = [], U = [], idx = []; const vid = new Map(); const vert = (i, j) => { const key = j * nx + i; if (vid.has(key)) return vid.get(key); const vx = x0 + i * step, vz = z0 + j * step; const id = P.length / 3; P.push(camera[0] + vx * SHAPE_K, waterY, camera[1] + vz * SHAPE_K); D.push(Math.max(0.01, -H[key] * SHAPE_K * 7 + 0.05)); U.push(P[P.length - 3] * 0.25, -P[P.length - 1] * 0.25); vid.set(key, id); return id; };
  for (let j = 0; j < nz - 1; j += 1) for (let i = 0; i < nx - 1; i += 1) { const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1]; if (Math.min(a, b, c, d) > 0.05) continue; const v0 = vert(i, j), v1 = vert(i + 1, j), v2 = vert(i, j + 1), v3 = vert(i + 1, j + 1); idx.push(v0, v2, v1, v1, v2, v3); }
  if (!idx.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length / 3).fill([0, 1, 0]).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('waterDepth', new THREE.Float32BufferAttribute(D, 1)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); g.setIndex(idx); return g;
}

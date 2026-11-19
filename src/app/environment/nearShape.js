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

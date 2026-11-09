import * as THREE from 'three';

// The visible drift runs from the camera side away up the valley (the user's art direction, 2026-11-09), so the field is reversed.
const FLOW_SIGN = -1;

// The stream's daily rhythm, like a snowmelt-fed alpine stream: lowest before dawn, rising through the day as the snow melts, fullest in the late
// afternoon, easing off through the night. Multiplies every flow speed; driven by the time of day (timeOfDay.js).
export const FLOW = { rate: { value: 1 } };
export const flowRateAt = (hour) => 0.95 + 0.3 * Math.cos(((hour - 16.5) / 24) * 2 * Math.PI);

// Which way and how fast the stream flows at every water vertex, from the water mesh itself. The stream falls from about 9.6 m in the far valley to
// 1.7 m in the foreground pool. Direction: the water is rasterised (1 m cells) and a distance-along-the-channel is spread from its highest reach; the
// flow follows that distance downstream, so it bends with the channel (and drifts slowly through the flat pool). Speed: from the local fall of the
// water surface, quick on the steep reaches, a slow drift on the level pool. Returns a Float32Array (x, z velocity in m/s per vertex).
export function computeWaterFlow(geometry, matrixWorld, { cell = 1 } = {}) {
  const p = geometry.attributes.position, index = geometry.index; const n = p.count; const v = new THREE.Vector3(); const world = new Float32Array(n * 3);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i += 1) { v.fromBufferAttribute(p, i).applyMatrix4(matrixWorld); world.set([v.x, v.y, v.z], i * 3); minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z); }
  minX -= 2; minZ -= 2; const w = Math.ceil((maxX - minX) / cell) + 3, h = Math.ceil((maxZ - minZ) / cell) + 3;
  const level = new Float32Array(w * h).fill(NaN);
  const tris = index ? index.count : n;
  for (let t = 0; t < tris; t += 3) {
    const ia = index ? index.getX(t) : t, ib = index ? index.getX(t + 1) : t + 1, ic = index ? index.getX(t + 2) : t + 2;
    const ax = world[ia * 3], ay = world[ia * 3 + 1], az = world[ia * 3 + 2], bx = world[ib * 3], by = world[ib * 3 + 1], bz = world[ib * 3 + 2], cx = world[ic * 3], cy = world[ic * 3 + 1], cz = world[ic * 3 + 2];
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-9) continue;
    const i0 = Math.floor((Math.min(ax, bx, cx) - minX) / cell), i1 = Math.ceil((Math.max(ax, bx, cx) - minX) / cell), j0 = Math.floor((Math.min(az, bz, cz) - minZ) / cell), j1 = Math.ceil((Math.max(az, bz, cz) - minZ) / cell);
    for (let j = Math.max(0, j0); j <= Math.min(h - 1, j1); j += 1) for (let i = Math.max(0, i0); i <= Math.min(w - 1, i1); i += 1) {
      const x = minX + i * cell, z = minZ + j * cell; const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, vv = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
      if (u >= -0.05 && vv >= -0.05 && u + vv <= 1.05) level[j * w + i] = u * ay + vv * by + (1 - u - vv) * cy;
    }
  }
  // distance along the channel from its highest reach (chamfer passes restricted to water cells)
  let top = -Infinity; for (const l of level) if (l === l && l > top) top = l;
  const along = new Float32Array(w * h).fill(Infinity); for (let q = 0; q < level.length; q += 1) if (level[q] === level[q] && level[q] > top - 0.15) along[q] = 0;
  const relax = (q, r, c) => { if (level[r] === level[r] && along[r] + c < along[q]) along[q] = along[r] + c; };
  for (let pass = 0; pass < 6; pass += 1) {
    for (let j = 1; j < h - 1; j += 1) for (let i = 1; i < w - 1; i += 1) { const q = j * w + i; if (level[q] !== level[q]) continue; relax(q, q - 1, 1); relax(q, q - w, 1); relax(q, q - w - 1, 1.414); relax(q, q - w + 1, 1.414); }
    for (let j = h - 2; j > 0; j -= 1) for (let i = w - 2; i > 0; i -= 1) { const q = j * w + i; if (level[q] !== level[q]) continue; relax(q, q + 1, 1); relax(q, q + w, 1); relax(q, q + w + 1, 1.414); relax(q, q + w - 1, 1.414); }
  }
  const at = (arr, i, j, fallback) => { if (i < 0 || j < 0 || i >= w || j >= h) return fallback; const v2 = arr[j * w + i]; return v2 === v2 && v2 !== Infinity ? v2 : fallback; };
  const flow = new Float32Array(n * 2);
  for (let k = 0; k < n; k += 1) {
    const i = Math.round((world[k * 3] - minX) / cell), j = Math.round((world[k * 3 + 2] - minZ) / cell); const c = at(along, i, j, NaN); if (c !== c) continue;
    // downstream direction: averaged over a 5x5 window so it follows the channel smoothly
    let gx = 0, gz = 0, ls = 0, ln = 0;
    for (let dj = -2; dj <= 2; dj += 1) for (let di = -2; di <= 2; di += 1) {
      const a = at(along, i + di, j + dj, NaN); if (a === a) { gx += di * (a - c); gz += dj * (a - c); }
      const l1 = at(level, i + di + 1, j + dj, NaN), l0 = at(level, i + di - 1, j + dj, NaN), m1 = at(level, i + di, j + dj + 1, NaN), m0 = at(level, i + di, j + dj - 1, NaN);
      if (l1 === l1 && l0 === l0 && m1 === m1 && m0 === m0) { ls += Math.hypot(l1 - l0, m1 - m0) / (2 * cell); ln += 1; }
    }
    const len = Math.hypot(gx, gz); if (len < 1e-6) continue; const slope = ln ? ls / ln : 0;
    const speed = Math.min(1.6, 0.18 + 14 * slope); // m/s: a slow drift on the level pool, quicker where the stream falls
    flow[k * 2] = FLOW_SIGN * gx / len * speed; flow[k * 2 + 1] = FLOW_SIGN * gz / len * speed;
  }
  return flow;
}

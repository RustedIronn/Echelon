import * as THREE from 'three';
import { HeightField } from './hamletGeometry.js';

// The delivered near-terrain colour texture has dirt tracks painted into it (the old hamlet's ground and a long track), and the authored grass
// roots leave those strips thin. With the procedural hamlet the settlement's own road network is the only road, so (1) those texels are repainted
// from the meadow on both sides, with the mask grown so no pale fringe remains, and (2) grass roots from the neighbouring meadow are mirrored into
// the old track's corridor. The mask is 1024x1024 in the texture file's pixel space (see make-path-mask.mjs).
const cache = new WeakMap();
const GROW = 4; // mask cells (3 texels each) added around the marked track
export function clearBakedPath(texture, mask) {
  if (cache.has(texture)) return cache.get(texture);
  const image = texture.image; const W = image.width, H = image.height; const M = 1024;
  const grown = new Uint8Array(M * M); const tmp = new Uint8Array(M * M);
  for (let y = 0; y < M; y += 1) for (let x = 0; x < M; x += 1) if (mask[y * M + x]) for (let k = -GROW; k <= GROW; k += 1) { const xx = x + k; if (xx >= 0 && xx < M) tmp[y * M + xx] = 1; }
  for (let y = 0; y < M; y += 1) for (let x = 0; x < M; x += 1) if (tmp[y * M + x]) for (let k = -GROW; k <= GROW; k += 1) { const yy = y + k; if (yy >= 0 && yy < M) grown[yy * M + x] = 1; }
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const source = ctx.getImageData(0, 0, W, H); const out = ctx.createImageData(W, H); out.data.set(source.data);
  const masked = (x, y) => grown[Math.floor((y * M) / H) * M + Math.floor((x * M) / W)] === 1;
  const edge = (x, y, dir) => { let n = x + dir; let steps = 0; while (n > 0 && n < W - 1 && steps < 160 && masked(n, y)) { n += dir; steps += 1; } return n; };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!masked(x, y)) continue; const hash = (x * 73856093) ^ (y * 19349663); const first = (hash & 1) ? -1 : 1;
    let nx = edge(x, y, first); if (masked(nx, y)) nx = edge(x, y, -first); nx = Math.max(0, Math.min(W - 1, nx + (nx < x ? -30 : 30)));
    const ny = Math.max(0, Math.min(H - 1, y + (((hash >> 3) & 15) - 8))); const s = (ny * W + nx) * 4; const o = (y * W + x) * 4;
    out.data[o] = source.data[s]; out.data[o + 1] = source.data[s + 1]; out.data[o + 2] = source.data[s + 2]; out.data[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const result = new THREE.CanvasTexture(canvas); result.colorSpace = texture.colorSpace; result.flipY = texture.flipY; result.wrapS = texture.wrapS; result.wrapT = texture.wrapT; result.anisotropy = texture.anisotropy; result.channel = texture.channel;
  cache.set(texture, result); return result;
}

// Centre line of the old track (Three x, z) and the strip around it that gets mirrored grass.
export const BAKED_TRACK = [[34, -51], [29, -61], [26, -71], [22.5, -81], [21, -91], [20, -101], [18, -111], [15.5, -121], [14, -126]];
export function heightFieldFrom(meta, raw) { return new HeightField(meta, new Float32Array(raw)); }

// Copies of the grass roots that stand 5.5..10.5 m from the track are moved onto it (distance minus 6.5 m), keeping their shape and re-seated on the terrain.
export function fillTrackGrass(records, count, stride, field) {
  const extra = []; const o2 = (i) => i * stride;
  for (let i = 0; i < count; i += 1) {
    const o = o2(i); const x = records[o], z = -records[o + 1]; if (x < 2 || x > 46 || z < -140 || z > -44) continue;
    let best = 1e9, cx = 0, cz = 0;
    for (let k = 0; k < BAKED_TRACK.length - 1; k += 1) { const [ax, az] = BAKED_TRACK[k], [bx, bz] = BAKED_TRACK[k + 1]; const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); const px = ax + dx * t, pz = az + dz * t; const d = Math.hypot(x - px, z - pz); if (d < best) { best = d; cx = px; cz = pz; } }
    if (best < 5.5 || best > 10.5) continue;
    const nx = (x - cx) / best, nz = (z - cz) / best; const nd = best - 6.5; const px = cx + nx * nd, pz = cz + nz * nd;
    for (let k = 0; k < stride; k += 1) extra.push(records[o + k]);
    const base = extra.length - stride; extra[base] = px; extra[base + 1] = -pz; extra[base + 2] = records[o + 2] + field.at(px, pz) - field.at(x, z);
  }
  const out = new Float32Array(count * stride + extra.length); out.set(records.subarray(0, count * stride)); out.set(extra, count * stride); return out;
}

// Marks the dark tracks baked into the near-terrain colour texture (the old hamlet's dirt and the two long tracks) so the runtime can paint them
// out and let the procedural hamlet's road network be the only road. Output: terrain-path-mask.bin (1024x1024 bytes, image-pixel space, 1 = repaint).
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
const R = new URL('../../../public/assets/environment/alpine-prototype/', import.meta.url);
const glb = readFileSync(new URL('geography.glb', R)); const jl = glb.readUInt32LE(12); const j = JSON.parse(glb.subarray(20, 20 + jl).toString()); const bin = 20 + jl + 8;
const prim = j.meshes.find((m) => m.name === 'terrain-near').primitives[0];
const view = (i) => { const a = j.accessors[i]; const v = j.bufferViews[a.bufferView]; return { a, off: bin + (v.byteOffset || 0) + (a.byteOffset || 0) }; };
const rd = (acc, n) => { const v = view(acc); const out = new Float32Array(v.a.count * n); for (let i = 0; i < out.length; i += 1) out[i] = glb.readFloatLE(v.off + i * 4); return out; };
const P = rd(prim.attributes.POSITION, 3), UV = rd(prim.attributes.TEXCOORD_0, 2); const q = view(prim.indices); const I = new Uint32Array(q.a.count);
for (let k = 0; k < I.length; k += 1) I[k] = q.a.componentType === 5125 ? glb.readUInt32LE(q.off + k * 4) : glb.readUInt16LE(q.off + k * 2);
const mat = j.materials.find((m) => m.name === 'terrain-near PBR'); const im = j.images[j.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source]; const bv = j.bufferViews[im.bufferView];
const jpg = glb.subarray(bin + (bv.byteOffset || 0), bin + (bv.byteOffset || 0) + bv.byteLength);
const tris = []; for (let t = 0; t < I.length; t += 3) { const ids = [I[t], I[t + 1], I[t + 2]]; const xs = ids.map((i) => P[i * 3]), zs = ids.map((i) => P[i * 3 + 2]); if (Math.max(...xs) < -5 || Math.min(...xs) > 85 || Math.max(...zs) < -185 || Math.min(...zs) > -45) continue; for (const i of ids) tris.push(P[i * 3], P[i * 3 + 2], UV[i * 2], UV[i * 2 + 1]); }
const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage(); await page.goto('about:blank');
const result = await page.evaluate(async ({ jpg, tris }) => {
  const bm = await createImageBitmap(new Blob([Uint8Array.from(atob(jpg), (c) => c.charCodeAt(0))], { type: 'image/jpeg' })); const W = bm.width, H = bm.height;
  const c = new OffscreenCanvas(W, H); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, W, H).data; const M = 1024; const mask = new Uint8Array(M * M);
  const line = [[34, -51], [29, -61], [26, -71], [22.5, -81], [21, -91], [20, -101], [18, -111], [15.5, -121], [14, -126]];
  const dist = (px, pz) => { let best = 1e9; for (let i = 0; i < line.length - 1; i += 1) { const [ax, az] = line[i], [bx, bz] = line[i + 1]; const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); best = Math.min(best, Math.hypot(px - (ax + dx * t), pz - (az + dz * t))); } return best; };
  const zone = (px, pz) => dist(px, pz) < 5 || (px >= 46 && px <= 85 && pz >= -142 && pz <= -96) || (px >= 44 && px <= 62 && pz >= -152 && pz <= -128) || (px >= 38 && px <= 85 && pz >= -100 && pz <= -58);
  let painted = 0;
  for (let t = 0; t < tris.length; t += 12) {
    const v = [0, 1, 2].map((k) => ({ x: tris[t + k * 4], z: tris[t + k * 4 + 1], px: tris[t + k * 4 + 2] * W, py: (1 - tris[t + k * 4 + 3]) * H }));
    const minx = Math.max(0, Math.floor(Math.min(...v.map((a) => a.px)))), maxx = Math.min(W - 1, Math.ceil(Math.max(...v.map((a) => a.px)))), miny = Math.max(0, Math.floor(Math.min(...v.map((a) => a.py)))), maxy = Math.min(H - 1, Math.ceil(Math.max(...v.map((a) => a.py))));
    const den = (v[1].py - v[2].py) * (v[0].px - v[2].px) + (v[2].px - v[1].px) * (v[0].py - v[2].py); if (Math.abs(den) < 1e-9) continue;
    for (let py = miny; py <= maxy; py += 1) for (let px = minx; px <= maxx; px += 1) {
      const a = ((v[1].py - v[2].py) * (px + 0.5 - v[2].px) + (v[2].px - v[1].px) * (py + 0.5 - v[2].py)) / den, b = ((v[2].py - v[0].py) * (px + 0.5 - v[2].px) + (v[0].px - v[2].px) * (py + 0.5 - v[2].py)) / den, g = 1 - a - b;
      if (a < 0 || b < 0 || g < 0) continue; const wx = a * v[0].x + b * v[1].x + g * v[2].x, wz = a * v[0].z + b * v[1].z + g * v[2].z; if (!zone(wx, wz)) continue;
      const o = (py * W + px) * 4; const r = d[o], gg = d[o + 1]; if (gg - r < 26 && r > 40 && r < 170) { mask[Math.floor((py * M) / H) * M + Math.floor((px * M) / W)] = 1; painted += 1; }
    }
  }
  const dil = new Uint8Array(M * M); for (let y = 1; y < M - 1; y += 1) for (let x2 = 1; x2 < M - 1; x2 += 1) if (mask[y * M + x2] || mask[y * M + x2 - 1] || mask[y * M + x2 + 1] || mask[(y - 1) * M + x2] || mask[(y + 1) * M + x2]) dil[y * M + x2] = 1;
  let n = 0; for (const b of dil) n += b; return { W, H, n, painted, mask: btoa(String.fromCharCode(...dil.subarray(0, 0))), raw: Array.from(dil) };
}, { jpg: jpg.toString('base64'), tris });
await browser.close();
writeFileSync(new URL('terrain-path-mask.bin', R), Buffer.from(Uint8Array.from(result.raw)));
console.log(JSON.stringify({ texture: [result.W, result.H], maskCells: result.n }));

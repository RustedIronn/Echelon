// Cuts a square around a summit from the decoded tile (native 30 m spacing), as float32 rows north first plus a json with its bounds.
// Usage: node dem-crop.mjs tile.f32 out lat lon halfKm
import { readFileSync, writeFileSync } from 'node:fs';
const [f32, out, lat, lon, half] = process.argv.slice(2).map((v, i) => (i < 2 ? v : Number(v)));
const meta = JSON.parse(readFileSync(f32.replace(/\.f32$/, '.json'))); const raw = readFileSync(f32); const dem = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const mLat = 111320, mLon = 111320 * Math.cos(lat * Math.PI / 180); const dy = Math.round(half * 1000 / mLat / meta.dLat), dx = Math.round(half * 1000 / mLon / meta.dLon);
const cx = Math.round((lon - meta.west) / meta.dLon), cy = Math.round((meta.north - lat) / meta.dLat); const x0 = Math.max(0, cx - dx), x1 = Math.min(meta.width - 1, cx + dx), y0 = Math.max(0, cy - dy), y1 = Math.min(meta.height - 1, cy + dy);
const w = x1 - x0 + 1, h = y1 - y0 + 1; const crop = new Float32Array(w * h); for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) crop[y * w + x] = dem[(y0 + y) * meta.width + x0 + x];
writeFileSync(out + '.f32', Buffer.from(crop.buffer)); writeFileSync(out + '.json', JSON.stringify({ width: w, height: h, west: meta.west + x0 * meta.dLon, north: meta.north - y0 * meta.dLat, dLon: meta.dLon, dLat: meta.dLat, summit: [lat, lon], source: 'Copernicus GLO-30 DEM (N46 E007), (c) DLR/ESA, Copernicus programme; free licence' }));
console.log(w, 'x', h, 'clipped at tile edge:', x1 === meta.width - 1 || x0 === 0 || y0 === 0 || y1 === meta.height - 1);

// A quick panorama from a viewpoint over the decoded DEM (voxel-space style: nearer ridges darker, sky white), for choosing a massif.
// Usage: node dem-view.mjs tile.f32 out.png lat lon eyeAboveGround headingDeg [hfov=72] [vtop=18] [vbottom=-6]
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const [f32, out, lat0, lon0, eyeAlt, heading, cLat, cLon, radiusKm = 9, hfov = 72, vtop = 18, vbot = -6] = process.argv.slice(2).map((v, i) => (i < 2 ? v : Number(v)));
// the massif only: terrain further than radiusKm from (cLat, cLon) sinks to a 1,400 m floor, as if transplanted into our valley
const meta = JSON.parse(readFileSync(f32.replace(/\.f32$/, '.json'))); const raw = readFileSync(f32); const dem = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const mLat = 111320, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
const at0 = (lat, lon) => { const fx = (lon - meta.west) / meta.dLon, fy = (meta.north - lat) / meta.dLat; const x = Math.floor(fx), y = Math.floor(fy); if (x < 0 || y < 0 || x >= meta.width - 1 || y >= meta.height - 1) return NaN; const tx = fx - x, ty = fy - y, i = y * meta.width + x; return (dem[i] * (1 - tx) + dem[i + 1] * tx) * (1 - ty) + (dem[i + meta.width] * (1 - tx) + dem[i + meta.width + 1] * tx) * ty; };
const at = (lat, lon) => { const h = at0(lat, lon); const r = Math.hypot((lat - cLat) * mLat, (lon - cLon) * mLon) / 1000; const k = Math.min(1, Math.max(0, (radiusKm - r) / 3)); return 1400 + (Math.max(1400, h) - 1400) * k * k * (3 - 2 * k); };
const eye = eyeAlt; const W = 1100, H = Math.round(W * (vtop - vbot) / hfov); const img = new Uint8Array(W * H).fill(255);
for (let c = 0; c < W; c += 1) { const az = (heading + (c / (W - 1) - 0.5) * hfov) * Math.PI / 180; let maxRow = H; // rows filled from the bottom up
  for (let d = 30; d < 40000; d *= 1.004) { const lat = lat0 + (Math.cos(az) * d) / mLat, lon = lon0 + (Math.sin(az) * d) / mLon; const h = at(lat, lon); if (!Number.isFinite(h)) break; const drop = d * d / (2 * 6371000) * 0.87;
    const el = Math.atan2(h - drop - eye, d) * 180 / Math.PI; const row = Math.round(((vtop - el) / (vtop - vbot)) * H); if (row < maxRow) { const shade = Math.round(40 + 170 * Math.min(1, d / 25000)); for (let r = Math.max(0, row); r < maxRow; r += 1) img[r * W + c] = shade; maxRow = Math.max(0, row); } } }
const png = (w, h, px) => { const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; }); const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0; const rows = Buffer.alloc((w + 1) * h); for (let y = 0; y < h; y += 1) { rows[y * (w + 1)] = 0; Buffer.from(px.buffer, y * w, w).copy(rows, y * (w + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]); };
writeFileSync(out, png(W, H, img)); console.log('eye', Math.round(eye), 'm');

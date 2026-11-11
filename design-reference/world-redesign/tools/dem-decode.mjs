// Decodes a Copernicus GLO-30 GeoTIFF (tiled, deflate or LZW, optional floating-point predictor) to raw float32 rows (north first),
// writes <name>.f32 and <name>.json, and lists the highest summits. Usage: node dem-decode.mjs path/to/tile.tif
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
const file = process.argv[2]; const buf = readFileSync(file); const le = buf.toString('ascii', 0, 2) === 'II';
const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)), u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o)), f64 = (o) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
if (u16(2) !== 42) throw new Error('BigTIFF not supported');
const ifd = u32(4); const n = u16(ifd); const tags = {}; const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 };
for (let i = 0; i < n; i += 1) { const e = ifd + 2 + i * 12; const tag = u16(e), type = u16(e + 2), count = u32(e + 4); const bytes = SIZE[type] * count; const at = bytes <= 4 ? e + 8 : u32(e + 8);
  const read = (k) => type === 3 ? u16(at + k * 2) : type === 4 ? u32(at + k * 4) : type === 12 ? f64(at + k * 8) : type === 2 ? buf[at + k] : u32(at + k * 4); tags[tag] = Array.from({ length: Math.min(count, 1 << 20) }, (_, k) => read(k)); }
const W = tags[256][0], H = tags[257][0], comp = tags[259][0], pred = tags[317]?.[0] ?? 1, tw = tags[322][0], th = tags[323][0], offs = tags[324], cnts = tags[325], bps = tags[258][0];
const scale = tags[33550], tie = tags[33922]; console.log({ W, H, comp, pred, tw, th, bps, scale: scale?.slice(0, 2), tie: tie?.slice(3, 5) });
function lzw(input, outSize) { const out = new Uint8Array(outSize); let op = 0, bitPos = 0, codeLen = 9; let dict = []; const reset = () => { dict = []; for (let i = 0; i < 256; i += 1) dict[i] = [i]; dict[256] = null; dict[257] = null; codeLen = 9; };
  const next = () => { let v = 0; for (let i = 0; i < codeLen; i += 1) { const byte = input[(bitPos + i) >> 3]; v = (v << 1) | ((byte >> (7 - ((bitPos + i) & 7))) & 1); } bitPos += codeLen; return v; };
  reset(); let prev = null; while ((bitPos + codeLen) <= input.length * 8) { const code = next(); if (code === 257) break; if (code === 256) { reset(); prev = null; continue; }
    let entry = code < dict.length && dict[code] ? dict[code] : prev ? [...prev, prev[0]] : null; if (!entry) break; for (const b of entry) out[op++] = b; if (prev) dict.push([...prev, entry[0]]); prev = entry;
    if (dict.length + 1 >= (1 << codeLen) && codeLen < 12) codeLen += 1; }
  return out; }
const data = new Float32Array(W * H); const across = Math.ceil(W / tw);
for (let t = 0; t < offs.length; t += 1) { const raw = buf.subarray(offs[t], offs[t] + cnts[t]); const size = tw * th * (bps / 8);
  let bytes = comp === 8 || comp === 32946 ? new Uint8Array(inflateSync(raw)) : comp === 5 ? lzw(raw, size) : comp === 1 ? new Uint8Array(raw) : null; if (!bytes) throw new Error('compression ' + comp);
  const tile = new Float32Array(tw * th); const row = tw * 4;
  if (pred === 3) { for (let y = 0; y < th; y += 1) { const r = bytes.subarray(y * row, (y + 1) * row); for (let i = 1; i < row; i += 1) r[i] = (r[i] + r[i - 1]) & 255; const dv = new DataView(tile.buffer); for (let x = 0; x < tw; x += 1) { dv.setUint8((y * tw + x) * 4 + 3, r[x]); dv.setUint8((y * tw + x) * 4 + 2, r[tw + x]); dv.setUint8((y * tw + x) * 4 + 1, r[2 * tw + x]); dv.setUint8((y * tw + x) * 4, r[3 * tw + x]); } } }
  else { const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); for (let i = 0; i < tw * th; i += 1) tile[i] = dv.getFloat32(i * 4, le); if (pred === 2) for (let y = 0; y < th; y += 1) for (let x = 1; x < tw; x += 1) tile[y * tw + x] += tile[y * tw + x - 1]; }
  const ox = (t % across) * tw, oy = Math.floor(t / across) * th; for (let y = 0; y < th && oy + y < H; y += 1) for (let x = 0; x < tw && ox + x < W; x += 1) data[(oy + y) * W + ox + x] = tile[y * tw + x]; }
const name = file.replace(/\.tif$/, ''); writeFileSync(name + '.f32', Buffer.from(data.buffer)); const meta = { width: W, height: H, west: tie[3], north: tie[4], dLon: scale[0], dLat: scale[1] }; writeFileSync(name + '.json', JSON.stringify(meta));
// summits: the highest point in each 2 km cell, kept if it is the highest within 4 km
const cell = 60, peaks = []; for (let cy = 0; cy < H; cy += cell) for (let cx = 0; cx < W; cx += cell) { let best = -1e9, bx = 0, by = 0; for (let y = cy; y < Math.min(H, cy + cell); y += 1) for (let x = cx; x < Math.min(W, cx + cell); x += 1) if (data[y * W + x] > best) { best = data[y * W + x]; bx = x; by = y; } peaks.push({ h: best, x: bx, y: by }); }
const top = peaks.filter((p) => peaks.every((q) => q === p || Math.hypot(q.x - p.x, q.y - p.y) > 130 || q.h <= p.h)).sort((a, b) => b.h - a.h).slice(0, 15);
console.log(top.map((p) => `${Math.round(p.h)} m  lat ${(meta.north - p.y * meta.dLat).toFixed(3)} lon ${(meta.west + p.x * meta.dLon).toFixed(3)}`).join('\n'));

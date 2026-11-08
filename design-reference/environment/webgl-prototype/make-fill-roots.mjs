// Fills the authored void in the far-left middle ground (Blender x -150..-30, y 100..150) with roots resampled from the well-populated
// meadow beside it. Deterministic, no Blender needed, never touches the master. Output: public/assets/environment/alpine-prototype/
//   grass-fill-2.bin  (stride 9, same record layout as grass-canopy-2.bin)   fill-roots.json (counts, bounds, method)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../public/assets/environment/alpine-prototype/', import.meta.url));
const STRIDE = 9; const CELL = 10;
const FILL = { x0: -150, x1: -30, y0: 100, y1: 150 };          // Blender metres, cell aligned; x -30 stays far from the hamlet clearing (x >= 20)
const SOURCE = { x0: -80, x1: -40, y0: 60, y1: 100 };           // dense mid-meadow used as the pattern source
const SEED = 20260101;

const rng = (() => { let a = SEED; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();

// ---- terrain height under the roots: rasterise the delivered near-terrain mesh (what is actually rendered) ----
function readTerrain() {
  const glb = readFileSync(`${ROOT}geography.glb`); const jsonLength = glb.readUInt32LE(12); const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString()); const bin = 20 + jsonLength + 8;
  const primitive = json.meshes.find((m) => m.name === 'terrain-near').primitives[0];
  const view = (index) => { const a = json.accessors[index]; const v = json.bufferViews[a.bufferView]; return { a, offset: bin + (v.byteOffset || 0) + (a.byteOffset || 0) }; };
  const p = view(primitive.attributes.POSITION); const positions = new Float32Array(p.a.count * 3); for (let i = 0; i < positions.length; i += 1) positions[i] = glb.readFloatLE(p.offset + i * 4);
  const q = view(primitive.indices); const indices = new Uint32Array(q.a.count); for (let k = 0; k < indices.length; k += 1) indices[k] = q.a.componentType === 5125 ? glb.readUInt32LE(q.offset + k * 4) : glb.readUInt16LE(q.offset + k * 2);
  return { positions, indices };
}
const terrain = readTerrain();
const H = { minX: FILL.x0 - 15, maxX: FILL.x1 + 15, minZ: -(FILL.y1 + 15), maxZ: -(FILL.y0 - 15), res: 0.25 };
H.w = Math.ceil((H.maxX - H.minX) / H.res); H.h = Math.ceil((H.maxZ - H.minZ) / H.res); H.data = new Float32Array(H.w * H.h).fill(NaN);
for (let t = 0; t < terrain.indices.length; t += 3) {
  const [a, b, c] = [terrain.indices[t] * 3, terrain.indices[t + 1] * 3, terrain.indices[t + 2] * 3]; const P = terrain.positions;
  const minx = Math.min(P[a], P[b], P[c]), maxx = Math.max(P[a], P[b], P[c]), minz = Math.min(P[a + 2], P[b + 2], P[c + 2]), maxz = Math.max(P[a + 2], P[b + 2], P[c + 2]);
  if (maxx < H.minX || minx > H.maxX || maxz < H.minZ || minz > H.maxZ) continue;
  const den = (P[b + 2] - P[c + 2]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 2] - P[c + 2]); if (Math.abs(den) < 1e-12) continue;
  for (let iz = Math.max(0, Math.floor((minz - H.minZ) / H.res)); iz <= Math.min(H.h - 1, Math.ceil((maxz - H.minZ) / H.res)); iz += 1) for (let ix = Math.max(0, Math.floor((minx - H.minX) / H.res)); ix <= Math.min(H.w - 1, Math.ceil((maxx - H.minX) / H.res)); ix += 1) {
    const x = H.minX + (ix + 0.5) * H.res, z = H.minZ + (iz + 0.5) * H.res;
    const u = ((P[b + 2] - P[c + 2]) * (x - P[c]) + (P[c] - P[b]) * (z - P[c + 2])) / den, v = ((P[c + 2] - P[a + 2]) * (x - P[c]) + (P[a] - P[c]) * (z - P[c + 2])) / den, w = 1 - u - v;
    if (u >= 0 && v >= 0 && w >= 0) H.data[iz * H.w + ix] = u * P[a + 1] + v * P[b + 1] + w * P[c + 1];
  }
}
const heightAt = (x, yBlender) => { const ix = Math.floor((x - H.minX) / H.res), iz = Math.floor((-yBlender - H.minZ) / H.res); const v = ix >= 0 && ix < H.w && iz >= 0 && iz < H.h ? H.data[iz * H.w + ix] : NaN; return v; };

// ---- authored roots (canopy layers 2 and 3) ----
const load = (name) => { const b = readFileSync(`${ROOT}${name}`); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const layers = [load('grass-canopy-2.bin'), load('grass-canopy-3.bin')]; const cellKey = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
const cells = new Map(); const sourceCells = new Map();
for (const records of layers) for (let i = 0; i < records.length / STRIDE; i += 1) {
  const x = records[i * STRIDE], y = records[i * STRIDE + 1]; const key = cellKey(x, y); cells.set(key, (cells.get(key) || 0) + 1);
  if (x >= SOURCE.x0 && x < SOURCE.x1 && y >= SOURCE.y0 && y < SOURCE.y1) { if (!sourceCells.has(key)) sourceCells.set(key, []); sourceCells.get(key).push(records.subarray(i * STRIDE, (i + 1) * STRIDE)); }
}
const sourceCounts = [...sourceCells.values()].map((v) => v.length).sort((a, b) => a - b); const TARGET = sourceCounts[Math.floor(sourceCounts.length / 2)];
const sourceList = [...sourceCells.entries()].filter(([, v]) => v.length >= TARGET * 0.8);

// ---- fill every deficient cell inside the void ----
const out = []; const report = [];
for (let cy = FILL.y0 / CELL; cy < FILL.y1 / CELL; cy += 1) for (let cx = FILL.x0 / CELL; cx < FILL.x1 / CELL; cx += 1) {
  const existing = cells.get(`${cx},${cy}`) || 0; const deficit = Math.round(TARGET - existing); if (deficit < TARGET * 0.25) continue;
  const [skey, srcRecords] = sourceList[Math.floor(rng() * sourceList.length)]; const [sx, sy] = skey.split(',').map(Number);
  const theta = Math.floor(rng() * 4) * (Math.PI / 2); const cos = Math.cos(theta), sin = Math.sin(theta); let placed = 0;
  for (let n = 0; n < deficit; n += 1) {
    const src = srcRecords[Math.floor(rng() * srcRecords.length)];
    const lx = src[0] - (sx * CELL + CELL / 2), ly = src[1] - (sy * CELL + CELL / 2);              // offset from the source cell centre
    const x = cx * CELL + CELL / 2 + (lx * cos - ly * sin) + (rng() - 0.5) * 1.2, y = cy * CELL + CELL / 2 + (lx * sin + ly * cos) + (rng() - 0.5) * 1.2;
    const z = heightAt(x, y); if (!Number.isFinite(z)) continue;
    const record = Float32Array.from(src); record[0] = x; record[1] = y; record[2] = z; record[3] = src[3] + theta; out.push(record); placed += 1;
  }
  report.push({ cell: [cx * CELL, cy * CELL], existing, placed });
}
const bin = new Float32Array(out.length * STRIDE); out.forEach((r, i) => bin.set(r, i * STRIDE));
writeFileSync(`${ROOT}grass-fill-2.bin`, Buffer.from(bin.buffer));
const meta = {
  grass: [{ layer: 2, source: 'Midground meadow continuation', file: 'grass-fill-2.bin', stride: STRIDE, count: out.length, representation: 'Fill of the authored void; roots resampled from the adjacent mid meadow, grounded on the delivered near terrain' }],
  method: 'Deterministic resample (seeded) of authored layer 2/3 roots from cells x -80..-40, y 60..100 into deficient 10 m cells of the void; each cell rotated by a multiple of 90 degrees with 0.6 m jitter; heights from the delivered terrain-near mesh',
  seed: SEED, fill: FILL, source: SOURCE, targetPerCell: TARGET, cellsFilled: report.length, roots: out.length,
};
writeFileSync(`${ROOT}fill-roots.json`, JSON.stringify(meta, null, 2));
console.log(`target ${TARGET} roots per ${CELL} m cell; filled ${report.length} cells with ${out.length} roots`);
console.log(report.map((r) => `(${r.cell}) had ${r.existing} +${r.placed}`).slice(0, 12).join('  '));

// Terrain heights under the hamlet site, rasterised from the delivered near-terrain mesh (what is actually rendered), so procedural
// buildings, walls, fences and lanes can be grounded without raycasting at runtime. Output (Three coordinates, metres):
//   public/assets/environment/alpine-prototype/hamlet-heights.bin   Float32 grid, row-major, rows run along +z
//   public/assets/environment/alpine-prototype/hamlet-heights.json  { minX, minZ, resolution, width, height }
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../public/assets/environment/alpine-prototype/', import.meta.url));
const SITE = { minX: 0, maxX: 80, minZ: -180, maxZ: -50, resolution: 0.5 };

const glb = readFileSync(`${ROOT}geography.glb`); const jsonLength = glb.readUInt32LE(12); const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString()); const bin = 20 + jsonLength + 8;
const primitive = json.meshes.find((m) => m.name === 'terrain-near').primitives[0];
const view = (index) => { const a = json.accessors[index]; const v = json.bufferViews[a.bufferView]; return { a, offset: bin + (v.byteOffset || 0) + (a.byteOffset || 0) }; };
const p = view(primitive.attributes.POSITION); const P = new Float32Array(p.a.count * 3); for (let i = 0; i < P.length; i += 1) P[i] = glb.readFloatLE(p.offset + i * 4);
const q = view(primitive.indices); const I = new Uint32Array(q.a.count); for (let k = 0; k < I.length; k += 1) I[k] = q.a.componentType === 5125 ? glb.readUInt32LE(q.offset + k * 4) : glb.readUInt16LE(q.offset + k * 2);

const width = Math.ceil((SITE.maxX - SITE.minX) / SITE.resolution); const height = Math.ceil((SITE.maxZ - SITE.minZ) / SITE.resolution);
const data = new Float32Array(width * height).fill(NaN);
for (let t = 0; t < I.length; t += 3) {
  const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
  const minx = Math.min(P[a], P[b], P[c]), maxx = Math.max(P[a], P[b], P[c]), minz = Math.min(P[a + 2], P[b + 2], P[c + 2]), maxz = Math.max(P[a + 2], P[b + 2], P[c + 2]);
  if (maxx < SITE.minX || minx > SITE.maxX || maxz < SITE.minZ || minz > SITE.maxZ) continue;
  const den = (P[b + 2] - P[c + 2]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 2] - P[c + 2]); if (Math.abs(den) < 1e-12) continue;
  for (let iz = Math.max(0, Math.floor((minz - SITE.minZ) / SITE.resolution)); iz <= Math.min(height - 1, Math.ceil((maxz - SITE.minZ) / SITE.resolution)); iz += 1) for (let ix = Math.max(0, Math.floor((minx - SITE.minX) / SITE.resolution)); ix <= Math.min(width - 1, Math.ceil((maxx - SITE.minX) / SITE.resolution)); ix += 1) {
    const x = SITE.minX + (ix + 0.5) * SITE.resolution, z = SITE.minZ + (iz + 0.5) * SITE.resolution;
    const u = ((P[b + 2] - P[c + 2]) * (x - P[c]) + (P[c] - P[b]) * (z - P[c + 2])) / den, v = ((P[c + 2] - P[a + 2]) * (x - P[c]) + (P[a] - P[c]) * (z - P[c + 2])) / den, w = 1 - u - v;
    if (u >= 0 && v >= 0 && w >= 0) data[iz * width + ix] = u * P[a + 1] + v * P[b + 1] + w * P[c + 1];
  }
}
let missing = 0; for (let i = 0; i < data.length; i += 1) if (!Number.isFinite(data[i])) { missing += 1; data[i] = 0; }
writeFileSync(`${ROOT}hamlet-heights.bin`, Buffer.from(data.buffer));
writeFileSync(`${ROOT}hamlet-heights.json`, JSON.stringify({ minX: SITE.minX, minZ: SITE.minZ, resolution: SITE.resolution, width, height, missing, source: 'terrain-near mesh of geography.glb' }, null, 2));
// quick look at the site: coarse height map, x across (0..80 m), z down (-180..-90 m), 5 m cells
const at = (x, z) => data[Math.floor((z - SITE.minZ) / SITE.resolution) * width + Math.floor((x - SITE.minX) / SITE.resolution)];
console.log(`grid ${width}x${height}, missing ${missing}`);
console.log('height (m) at 5 m steps; columns x=0..80, rows z=-180..-90');
for (let z = SITE.minZ; z < SITE.maxZ; z += 5) { let row = String(z).padStart(5) + ' '; for (let x = 0; x <= 80; x += 5) row += at(x, z + 2.5).toFixed(1).padStart(5); console.log(row); }

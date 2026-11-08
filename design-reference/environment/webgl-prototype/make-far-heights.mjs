// Terrain heights for the whole visible meadow (Three coordinates, metres), rasterised from the delivered terrain meshes (near terrain first, range terrain where the
// near mesh has no coverage), so far-field instances can be grounded without raycasting at runtime. Output in public/assets/environment/alpine-prototype/:
//   far-heights.bin   Float32 grid, row-major, rows run along +z
//   far-heights.json  { minX, minZ, resolution, width, height, missing }
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../public/assets/environment/alpine-prototype/', import.meta.url));
const SITE = { minX: -240, maxX: 240, minZ: -330, maxZ: -20, resolution: 1 };
const glb = readFileSync(`${ROOT}geography.glb`); const jsonLength = glb.readUInt32LE(12); const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString()); const bin = 20 + jsonLength + 8;
const width = Math.ceil((SITE.maxX - SITE.minX) / SITE.resolution); const height = Math.ceil((SITE.maxZ - SITE.minZ) / SITE.resolution);
const data = new Float32Array(width * height).fill(NaN);
const view = (index) => { const a = json.accessors[index]; const v = json.bufferViews[a.bufferView]; return { a, offset: bin + (v.byteOffset || 0) + (a.byteOffset || 0) }; };

for (const name of ['terrain-near', 'terrain-range']) {
  const mesh = json.meshes.find((m) => m.name === name); if (!mesh) continue; const primitive = mesh.primitives[0];
  const p = view(primitive.attributes.POSITION); const P = new Float32Array(p.a.count * 3); for (let i = 0; i < P.length; i += 1) P[i] = glb.readFloatLE(p.offset + i * 4);
  const q = view(primitive.indices); const I = new Uint32Array(q.a.count); for (let k = 0; k < I.length; k += 1) I[k] = q.a.componentType === 5125 ? glb.readUInt32LE(q.offset + k * 4) : glb.readUInt16LE(q.offset + k * 2);
  let painted = 0;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    const minx = Math.min(P[a], P[b], P[c]), maxx = Math.max(P[a], P[b], P[c]), minz = Math.min(P[a + 2], P[b + 2], P[c + 2]), maxz = Math.max(P[a + 2], P[b + 2], P[c + 2]);
    if (maxx < SITE.minX || minx > SITE.maxX || maxz < SITE.minZ || minz > SITE.maxZ) continue;
    const den = (P[b + 2] - P[c + 2]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 2] - P[c + 2]); if (Math.abs(den) < 1e-12) continue;
    for (let iz = Math.max(0, Math.floor((minz - SITE.minZ) / SITE.resolution)); iz <= Math.min(height - 1, Math.ceil((maxz - SITE.minZ) / SITE.resolution)); iz += 1) for (let ix = Math.max(0, Math.floor((minx - SITE.minX) / SITE.resolution)); ix <= Math.min(width - 1, Math.ceil((maxx - SITE.minX) / SITE.resolution)); ix += 1) {
      if (Number.isFinite(data[iz * width + ix])) continue; // near terrain wins where it exists
      const x = SITE.minX + (ix + 0.5) * SITE.resolution, z = SITE.minZ + (iz + 0.5) * SITE.resolution;
      const u = ((P[b + 2] - P[c + 2]) * (x - P[c]) + (P[c] - P[b]) * (z - P[c + 2])) / den, v = ((P[c + 2] - P[a + 2]) * (x - P[c]) + (P[a] - P[c]) * (z - P[c + 2])) / den, w = 1 - u - v;
      if (u >= 0 && v >= 0 && w >= 0) { data[iz * width + ix] = u * P[a + 1] + v * P[b + 1] + w * P[c + 1]; painted += 1; }
    }
  }
  console.log(name, 'cells painted', painted);
}
let missing = 0; for (let i = 0; i < data.length; i += 1) if (!Number.isFinite(data[i])) { missing += 1; data[i] = 0; }
writeFileSync(`${ROOT}far-heights.bin`, Buffer.from(data.buffer));
writeFileSync(`${ROOT}far-heights.json`, JSON.stringify({ minX: SITE.minX, minZ: SITE.minZ, resolution: SITE.resolution, width, height, missing, source: 'terrain-near then terrain-range meshes of geography.glb' }, null, 2));
console.log(`grid ${width}x${height}, missing ${missing} (${((missing / data.length) * 100).toFixed(1)}%)`);
const at = (x, z) => data[Math.floor((z - SITE.minZ) / SITE.resolution) * width + Math.floor((x - SITE.minX) / SITE.resolution)];
for (const z of [-60, -100, -150, -200, -250, -300]) console.log('z', z, [-150, -75, -3, 60, 120].map((x) => at(x, z).toFixed(1).padStart(6)).join(' '));

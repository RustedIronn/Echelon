import { smooth, habitatHash } from './meadowHabitat.js';

// Valley relief. The delivered valley is a plane rising about 2.5 degrees, which is nearly edge-on to the camera: the middle ground is a thin band of screen and
// every flower in it is seen almost from the side. This adds a few gentle landforms (rolling swells whose faces turn toward the camera, a shallow hollow) as one shared
// vertical offset, so terrain vertices, grass, flowers and the hamlet ground all agree. It leaves alone everything that must stay as authored: the foreground (to about 42 m),
// the stream and its banks, the hamlet's ground (a flat terrace), and the mountain bases and far valley.
export const RELIEF = Object.freeze({
  camera: [-3, 10],
  // x, z, half-width across the view, half-length along it, height in metres (negative = hollow)
  swells: [
    { x: -46, z: -108, sx: 36, sz: 26, h: 5.0 }, { x: -108, z: -152, sx: 52, sz: 34, h: 6.2 }, { x: 60, z: -94, sx: 30, sz: 20, h: 2.4 },
    { x: 106, z: -132, sx: 44, sz: 30, h: 5.8 }, { x: 22, z: -192, sx: 72, sz: 26, h: 4.2 }, { x: -8, z: -86, sx: 26, sz: 14, h: -1.0 },
  ],
  near: [42, 74], water: [9, 36], hamletFade: 22, far: [172, 238], cell: 2, minX: -240, maxX: 240, minZ: -330, maxZ: -20,
});

const vnoise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = smooth(0, 1, x - i), v = smooth(0, 1, z - j); const a = habitatHash(i, j, 41), b = habitatHash(i + 1, j, 41), c = habitatHash(i, j + 1, 41), d = habitatHash(i + 1, j + 1, 41); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; };

// water: world positions (x, y, z triples) of the water meshes; hamletBounds: { minX, maxX, minZ, maxZ } of the settlement's tended ground.
export function createValleyRelief({ water, hamletBounds, options = RELIEF, amount = 1 }) {
  const { cell, minX, minZ } = options; const w = Math.ceil((options.maxX - minX) / cell), h = Math.ceil((options.maxZ - minZ) / cell);
  const distance = new Float32Array(w * h).fill(1e5);
  for (let i = 0; i < water.length; i += 3) { const gx = Math.floor((water[i] - minX) / cell), gz = Math.floor((water[i + 2] - minZ) / cell); if (gx >= 0 && gz >= 0 && gx < w && gz < h) distance[gz * w + gx] = 0; }
  const relax = (q, p, c) => { if (distance[p] + c < distance[q]) distance[q] = distance[p] + c; };
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) { const q = j * w + i; if (i) relax(q, q - 1, 1); if (j) relax(q, q - w, 1); if (i && j) relax(q, q - w - 1, Math.SQRT2); if (i + 1 < w && j) relax(q, q - w + 1, Math.SQRT2); }
  for (let j = h - 1; j >= 0; j -= 1) for (let i = w - 1; i >= 0; i -= 1) { const q = j * w + i; if (i + 1 < w) relax(q, q + 1, 1); if (j + 1 < h) relax(q, q + w, 1); if (i + 1 < w && j + 1 < h) relax(q, q + w + 1, Math.SQRT2); if (i && j + 1 < h) relax(q, q + w - 1, Math.SQRT2); }
  const waterDistance = (x, z) => { const gx = Math.floor((x - minX) / cell), gz = Math.floor((z - minZ) / cell); if (gx < 0 || gz < 0 || gx >= w || gz >= h) return 1e5; return Math.max(0, distance[gz * w + gx] * cell - 3); };
  const rectDistance = (x, z) => { if (!hamletBounds) return 1e5; const dx = Math.max(hamletBounds.minX - x, 0, x - hamletBounds.maxX), dz = Math.max(hamletBounds.minZ - z, 0, z - hamletBounds.maxZ); return Math.hypot(dx, dz); };
  const mask = (x, z) => {
    const near = smooth(options.near[0], options.near[1], Math.hypot(x - options.camera[0], z - options.camera[1])); if (near <= 0) return 0;
    const far = 1 - smooth(options.far[0], options.far[1], -z); if (far <= 0) return 0;
    return near * far * smooth(options.water[0], options.water[1], waterDistance(x, z)) * smooth(0, options.hamletFade, rectDistance(x, z));
  };
  const shape = (x, z) => {
    let r = 0; for (const s of options.swells) r += s.h * Math.exp(-(((x - s.x) / s.sx) ** 2) - (((z - s.z) / s.sz) ** 2));
    return r + 0.9 * (vnoise(x * 0.035, z * 0.05) - 0.5); // a metre or so of unevenness so no swell is a perfect bump
  };
  const exactAt = (x, z) => { if (!amount) return 0; const m = mask(x, z); return m > 0 ? amount * m * shape(x, z) : 0; };
  // Once the terrain mesh has been displaced, everything standing on it asks for the height of the MESH (its triangles interpolate the vertex offsets linearly), not of the
  // smooth formula: where the mesh is coarser than the landform the two differ by tens of centimetres, which showed as rows of blades floating above or sinking into the slope.
  let raster = null;
  const sampleRaster = (x, z) => {
    const fx = (x - raster.minX) / raster.cell - 0.5, fz = (z - raster.minZ) / raster.cell - 0.5; const i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i + 1 >= raster.w || j + 1 >= raster.h) return NaN;
    const u = fx - i, v = fz - j, a = raster.data[j * raster.w + i], b = raster.data[j * raster.w + i + 1], c = raster.data[(j + 1) * raster.w + i], d = raster.data[(j + 1) * raster.w + i + 1];
    if (a !== a || b !== b || c !== c || d !== d) return NaN; return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  const at = (x, z) => { if (!raster) return exactAt(x, z); const v = sampleRaster(x, z); return v === v ? v : exactAt(x, z); };
  // Slope of the added relief, for correcting vertex normals (always from the formula).
  const gradient = (x, z) => [(exactAt(x + 1, z) - exactAt(x - 1, z)) / 2, (exactAt(x, z + 1) - exactAt(x, z - 1)) / 2];
  // meshes: [{ position: BufferAttribute, index: BufferAttribute | null, values: Float32Array (relief at each vertex) }]
  const bindMesh = (meshes, cellSize = 1) => {
    const w2 = Math.ceil((options.maxX - minX) / cellSize), h2 = Math.ceil((options.maxZ - minZ) / cellSize); const data = new Float32Array(w2 * h2).fill(NaN); let covered = 0;
    for (const { position, index, values } of meshes) {
      const n = index ? index.count : position.count;
      for (let t = 0; t < n; t += 3) {
        const i0 = index ? index.getX(t) : t, i1 = index ? index.getX(t + 1) : t + 1, i2 = index ? index.getX(t + 2) : t + 2;
        const v0 = values[i0], v1 = values[i1], v2 = values[i2]; if (Math.abs(v0) < 1e-4 && Math.abs(v1) < 1e-4 && Math.abs(v2) < 1e-4) continue;
        const x0 = position.getX(i0), z0 = position.getZ(i0), x1 = position.getX(i1), z1 = position.getZ(i1), x2 = position.getX(i2), z2 = position.getZ(i2);
        const den = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2); if (Math.abs(den) < 1e-9) continue;
        const gx0 = Math.max(0, Math.floor((Math.min(x0, x1, x2) - minX) / cellSize) - 1), gx1 = Math.min(w2 - 1, Math.ceil((Math.max(x0, x1, x2) - minX) / cellSize) + 1);
        const gz0 = Math.max(0, Math.floor((Math.min(z0, z1, z2) - minZ) / cellSize) - 1), gz1 = Math.min(h2 - 1, Math.ceil((Math.max(z0, z1, z2) - minZ) / cellSize) + 1);
        for (let gz = gz0; gz <= gz1; gz += 1) for (let gx = gx0; gx <= gx1; gx += 1) {
          const x = minX + (gx + 0.5) * cellSize, z = minZ + (gz + 0.5) * cellSize; const a = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / den, b = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / den, c = 1 - a - b;
          if (a >= -1e-6 && b >= -1e-6 && c >= -1e-6) { if (data[gz * w2 + gx] !== data[gz * w2 + gx]) covered += 1; data[gz * w2 + gx] = a * v0 + b * v1 + c * v2; }
        }
      }
    }
    raster = { data, w: w2, h: h2, cell: cellSize, minX, minZ }; return covered;
  };
  return { at, exactAt, gradient, mask, shape, waterDistance, amount, bindMesh };
}

// Adds the relief to a bank-lowering object so every consumer of offsetAt receives it.
export function withValleyRelief(bank, relief) {
  if (!bank || !relief) return bank;
  return { ...bank, offsetAt: (x, z, y) => bank.offsetAt(x, z, y) + relief.at(x, z), relief };
}

import { smooth, habitatHash } from './meadowHabitat.js';

// Valley relief. The delivered valley is a plane rising about 2.5 degrees, which is nearly edge-on to the camera: the middle ground is a thin band of screen and
// every flower in it is seen almost from the side. This adds a few gentle landforms (rolling swells whose faces turn toward the camera, a shallow hollow) as one shared
// vertical offset, so terrain vertices, grass, flowers and the hamlet ground all agree. It leaves alone everything that must stay as authored: the foreground (to about 42 m),
// the stream and its banks, the hamlet's ground (a flat terrace), and the mountain bases and far valley.
export const RELIEF = Object.freeze({
  camera: [-3, 10],
  // x, z, half-width across the view, half-length along it, height in metres (negative = hollow)
  swells: [
    { x: -74, z: -128, sx: 48, sz: 30, h: 5.4 }, { x: 96, z: -124, sx: 42, sz: 30, h: 5.2 }, { x: -120, z: -198, sx: 64, sz: 38, h: 5.6 },
    { x: 16, z: -178, sx: 56, sz: 24, h: 3.4 }, { x: -24, z: -92, sx: 30, sz: 18, h: -1.2 }, { x: 74, z: -88, sx: 36, sz: 22, h: 2.8 },
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
  const at = (x, z) => { if (!amount) return 0; const m = mask(x, z); return m > 0 ? amount * m * shape(x, z) : 0; };
  // Slope of the added relief, for correcting vertex normals.
  const gradient = (x, z) => [(at(x + 1, z) - at(x - 1, z)) / 2, (at(x, z + 1) - at(x, z - 1)) / 2];
  return { at, gradient, mask, shape, waterDistance, amount };
}

// Adds the relief to a bank-lowering object so every consumer of offsetAt receives it.
export function withValleyRelief(bank, relief) {
  if (!bank || !relief) return bank;
  return { ...bank, offsetAt: (x, z, y) => bank.offsetAt(x, z, y) + relief.at(x, z), relief };
}

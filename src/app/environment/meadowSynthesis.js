import { meadowPatch } from './meadowDetail.js';

// The authored tall, arching foreground grass exists only in a corridor about 50 m wide, and it is thinned beyond 32 m. Everywhere else the meadow is short strips.
// This synthesizes more of the same grass for the barren middle ground: it reuses the authored blades as templates (same shapes, lengths, palette and variants,
// slightly varied), places them on a jittered grid with a density that follows growth patches and tapers with distance, and skips the existing corridor.
const hash = (x, y, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const SYNTH = { camera: [-3, 10], halfAngle: 0.7, from: 34, to: 112, cell: 0.2, maxSlope: 0.42, minHeight: 1, nearDensity: 28, farDensity: 15 };

// A coarse map of where the authored tall grass already stands (3 m cells), so the synthesized grass does not pile onto it.
export function occupancyMap(templates, stride = 9, cell = 3, minCount = 10) {
  const counts = new Map(); const key = (x, z) => `${Math.floor(x / cell)}_${Math.floor(z / cell)}`;
  for (let i = 0; i < templates.length; i += stride) { const k = key(templates[i], -templates[i + 1]); counts.set(k, (counts.get(k) ?? 0) + 1); }
  return (x, z) => (counts.get(key(x, z)) ?? 0) >= minCount;
}

// Returns a Float32Array of records in the delivery's layout (stride 9, Blender coordinates): x, y, height, angle, length, height scale, palette, variant, width.
export function synthesizeMeadow(templates, field, { exclude = () => false, occupied = () => false, options = SYNTH } = {}) {
  const stride = 9; const count = Math.floor(templates.length / stride); if (!count) return new Float32Array(0);
  const [cx, cz] = options.camera; const out = []; const cell = options.cell; const area = cell * cell;
  for (let gz = Math.floor((cz - options.to) / cell); gz <= Math.floor((cz - options.from) / cell); gz += 1) {
    for (let gx = Math.floor((cx - options.to) / cell); gx <= Math.floor((cx + options.to) / cell); gx += 1) {
      const x = (gx + hash(gx, gz, 1)) * cell, z = (gz + hash(gx, gz, 2)) * cell; const dx = x - cx, dz = z - cz; const distance = Math.hypot(dx, dz);
      if (distance < options.from || distance > options.to || Math.atan2(Math.abs(dx), -dz) > options.halfAngle) continue;
      // density per m2: dense near, tapering with distance, and modulated by growth patches so it never reads as an even carpet
      const taper = 1 - smooth(options.from, options.to, distance); const density = (options.farDensity + (options.nearDensity - options.farDensity) * taper ** 1.2) * (0.45 + 1.1 * meadowPatch(x * 1.0, z * 1.0));
      const ramp = smooth(options.from, options.from + 14, distance); // soft start so the new grass joins the corridor without a seam
      if (hash(gx, gz, 3) > density * area * ramp) continue;
      if (occupied(x, z) || exclude(x, z)) continue;
      const y = field.at(x, z); if (y < options.minHeight) continue;
      if (Math.hypot(field.at(x + 1, z) - field.at(x - 1, z), field.at(x, z + 1) - field.at(x, z - 1)) / 2 > options.maxSlope) continue;
      const t = Math.floor(hash(gx, gz, 4) * count) * stride; const jitter = 0.85 + 0.35 * hash(gx, gz, 5);
      // distant blades are a little wider and taller so fewer of them still close into a carpet
      // scale compensation: the eye reads the meadow by the size of its features, so blades and tufts grow with distance (measured from the same point for every layer) instead of shrinking into fine noise
      const growth = smooth(options.growFrom ?? 32, options.growTo ?? 112, distance); const wide = 1 + (options.growWide ?? 2.0) * growth, tall = 1 + (options.growTall ?? 1.1) * growth;
      // height variety: tall-grass clumps in some patches (broad, slow noise), a few individual tall stems everywhere, and shorter blades in the gaps, so the skyline is broken
      const clump = smooth(0.5, 0.72, meadowPatch(x * 0.55 + 21, z * 0.35 - 8)); const stem = hash(gx, gz, 7) > 0.94 ? 1.5 + 0.9 * hash(gx, gz, 8) : 1;
      const variety = (options.heightVariety ?? 1) ? (0.8 + 0.9 * clump) * stem * (0.9 + 0.2 * hash(gx, gz, 9)) : 1;
      out.push(x, -z, y, templates[t + 3] + hash(gx, gz, 6) * 1.2, templates[t + 4] * jitter * wide, templates[t + 5] * jitter * tall * variety, templates[t + 6], templates[t + 7], templates[t + 8] * wide);
    }
  }
  return Float32Array.from(out);
}

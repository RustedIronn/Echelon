import { meadowPatch, meadowBladeTint } from './meadowDetail.js';

// Placement of tuft cards (see tuftBake.js) across the middle and far meadow, 30 m to about 230 m, inside the camera's view. Deterministic and irregular: a jittered
// grid for grass (density follows growth patches and tapers with distance while the cards grow, so coverage stays even), a low understory mixed in, and flower
// clumps (a dominant kind with strays) that gather in drifts with a thin scatter of singles. Heights come from far-heights.bin.
const hash = (x, y, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (a, b) => Math.sqrt(-2 * Math.log(Math.max(1e-6, a))) * Math.cos(2 * Math.PI * b);

export const TUFTS = { camera: [-3, 10], halfAngle: 0.72, from: 30, to: 230, cell: 0.34, maxSlope: 0.42, minHeight: 1, nearDensity: 3.2, farDensity: 0.45, cells: 9, cardMetres: 0.62 };
const PALETTE_WEIGHTS = [0.06, 0.6, 0.1, 0.22, 0.02]; // as used by the authored foreground blades

// palette: the delivery's grassPalette (linear rgb triples). Returns { counts[9], matrices[9] (16 floats per instance), colors[9] (3 floats per instance) }.
export function buildTufts(field, { palette, exclude = () => false, occupied = () => false, groundOffset = () => 0, options = TUFTS } = {}) {
  const [cx, cz] = options.camera; const matrices = Array.from({ length: options.cells }, () => []); const colors = Array.from({ length: options.cells }, () => []);
  const area = options.cell * options.cell;
  const place = (cell, x, z, size, key, tint) => {
    if (exclude(x, z) || (cell >= 6 && occupied(x, z))) return false; let y = field.at(x, z); if (y < options.minHeight) return false; // flowers also keep out of the authored corridor, which has its own
    if (Math.hypot(field.at(x + 1, z) - field.at(x - 1, z), field.at(x, z + 1) - field.at(x, z - 1)) / 2 > options.maxSlope) return false;
    y += groundOffset(x, z, y); const yaw = hash(key, 1, 3) * Math.PI * 2; const c = Math.cos(yaw) * size, s = Math.sin(yaw) * size;
    matrices[cell].push(c, 0, -s, 0, 0, size, 0, 0, s, 0, c, 0, x, y - 0.02, z, 1); colors[cell].push(tint[0], tint[1], tint[2]); return true;
  };
  const grassTint = (x, z, key) => {
    let r = hash(key, 9, 5), acc = 0, index = 1; for (let i = 0; i < PALETTE_WEIGHTS.length; i += 1) { acc += PALETTE_WEIGHTS[i]; if (r <= acc) { index = i; break; } }
    const base = palette[index] ?? palette[1]; const k = 1.9 * meadowBladeTint(x, z, false) * (0.9 + 0.2 * hash(key, 11, 6)); return [base[0] * k, base[1] * k, base[2] * k];
  };
  for (let gz = Math.floor((cz - options.to) / options.cell); gz <= Math.floor((cz - options.from) / options.cell); gz += 1) {
    for (let gx = Math.floor((cx - options.to) / options.cell); gx <= Math.floor((cx + options.to) / options.cell); gx += 1) {
      const x = (gx + hash(gx, gz, 1)) * options.cell, z = (gz + hash(gx, gz, 2)) * options.cell; const dx = x - cx, dz = z - cz; const distance = Math.hypot(dx, dz);
      if (distance < options.from || distance > options.to || Math.atan2(Math.abs(dx), -dz) > options.halfAngle) continue;
      const taper = 1 - smooth(options.from, options.to, distance); const patch = meadowPatch(x, z);
      const density = (options.farDensity + (options.nearDensity - options.farDensity) * taper ** 1.5) * (0.5 + 1.0 * patch) * smooth(options.from, options.from + 38, distance) * (1 - smooth(options.to - 40, options.to, distance));
      if (hash(gx, gz, 3) > density * area) continue; if (occupied(x, z)) continue;
      const key = gx * 977 + gz * 131; const size = options.cardMetres * (0.65 + 0.35 * smooth(options.from, options.from + 40, distance)) * (1 + Math.min(1.1, (distance - options.from) / 160)) * (0.8 + 0.45 * hash(gx, gz, 4));
      const r = hash(gx, gz, 5); let cell;
      if (r < 0.1) cell = 4 + (hash(gx, gz, 6) < 0.5 ? 0 : 1); // understory
      else { const tall = patch > 0.62 && hash(gx, gz, 7) < 0.45; cell = tall ? 3 : Math.floor(hash(gx, gz, 8) * 3); }
      const tint = cell >= 4 ? grassTint(x, z, key).map((v) => v * 0.92) : grassTint(x, z, key);
      place(cell, x, z, size, key, tint);
    }
  }
  // flowers: coarse cells; clumps in drifts plus scattered singles
  const flowerCell = 3.2;
  for (let gz = Math.floor((cz - options.to) / flowerCell); gz <= Math.floor((cz - options.from) / flowerCell); gz += 1) {
    for (let gx = Math.floor((cx - options.to) / flowerCell); gx <= Math.floor((cx + options.to) / flowerCell); gx += 1) {
      const x0 = (gx + hash(gx, gz, 21)) * flowerCell, z0 = (gz + hash(gx, gz, 22)) * flowerCell; const distance = Math.hypot(x0 - cx, z0 - cz);
      if (distance < options.from || distance > options.to || Math.atan2(Math.abs(x0 - cx), -(z0 - cz)) > options.halfAngle) continue;
      const fade = smooth(options.from, options.from + 50, distance) * (1 - smooth(options.to - 60, options.to, distance)); const drift = Math.max(0, (meadowPatch(x0 * 1.3 + 40, z0 * 1.3 - 17) - 0.42) / 0.38);
      const dominant = 6 + Math.floor(hash(gx >> 1, gz >> 1, 29) * 3); const sizeBase = options.cardMetres * (1 + Math.min(1.8, (distance - options.from) / 60)) * (0.85 + 0.4 * hash(gx, gz, 23));
      if (hash(gx, gz, 24) < (0.05 + 0.55 * Math.min(1, drift) ** 1.3) * fade) {
        const n = 1 + Math.floor(hash(gx, gz, 25) * 3 * (0.6 + drift)); const radius = 0.8 + 1.4 * hash(gx, gz, 26);
        for (let k = 0; k < n; k += 1) place(hash(gx, gz, 100 + k) < 0.8 ? dominant : 6 + Math.floor(hash(gx, gz, 110 + k) * 3), x0 + gauss(hash(gx, gz, 30 + k), hash(gx, gz, 50 + k)) * radius * 0.5, z0 + gauss(hash(gx, gz, 70 + k), hash(gx, gz, 90 + k)) * radius * 0.5, sizeBase * (0.8 + 0.4 * hash(gx, gz, 120 + k)), gx * 311 + gz * 577 + k, [1.25 + 0.2 * hash(gx, gz, 130 + k), 1.25 + 0.2 * hash(gx, gz, 130 + k), 1.2 + 0.2 * hash(gx, gz, 130 + k)]);
      }
      if (hash(gx, gz, 27) < 0.12 * fade) place(6 + Math.floor(hash(gx, gz, 28) * 3), x0, z0, sizeBase * 0.8, gx * 421 + gz * 83 + 9000, [1.3, 1.3, 1.25]);
    }
  }
  return { counts: matrices.map((l) => l.length / 16), matrices: matrices.map((l) => Float32Array.from(l)), colors: colors.map((l) => Float32Array.from(l)) };
}

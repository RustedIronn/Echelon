import { widenFarWater } from './waterWiden.js';

// The distant stream sits in a shallow channel with higher banks, so it shows as a ribbon a few pixels tall. This lowers the terrain along it (and
// everything standing on that terrain) so the water surface is exposed, and the water's outer edge is widened to match. One shared function gives every
// consumer (terrain vertices, grass, flowers, hamlet ground) the same vertical offset, so nothing floats or sinks.
export const BANK = { camera: [-3, 10], lowerFrom: 14, lowerTo: 48, reach: 6.5, flat: 1.6, cell: 4 };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const bankLowering = { current: null };

// water: the (unmodified) water mesh positions as world x, y, z.
export function createBankLowering(positions, options = BANK) {
  const cells = new Map(); const key = (cx, cz) => (cx + 4096) * 16384 + (cz + 4096); /* numeric keys: called hundreds of thousands of times at load */ const reach = options.reach;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (Math.hypot(x - options.camera[0], z - options.camera[1]) < options.lowerFrom - reach) continue;
    const k = key(Math.floor(x / options.cell), Math.floor(z / options.cell)); const list = cells.get(k); if (list) list.push(x, y, z); else cells.set(k, [x, y, z]);
  }
  const span = Math.ceil(reach / options.cell);
  // The vertical offset (usually negative or zero) to apply at a ground point (x, z) whose current height is y.
  function offsetAt(x, z, y) {
    const away = smooth(options.lowerFrom, options.lowerTo, Math.hypot(x - options.camera[0], z - options.camera[1])); if (away <= 0) return 0;
    const cx = Math.floor(x / options.cell), cz = Math.floor(z / options.cell); let best = reach * reach, waterY = 0, found = false;
    for (let dx = -span; dx <= span; dx += 1) for (let dz = -span; dz <= span; dz += 1) {
      const list = cells.get(key(cx + dx, cz + dz)); if (!list) continue;
      for (let i = 0; i < list.length; i += 3) { const d2 = (list[i] - x) ** 2 + (list[i + 2] - z) ** 2; if (d2 < best) { best = d2; waterY = list[i + 1]; found = true; } }
    }
    if (!found) return 0; const strength = (1 - smooth(options.flat, reach, Math.sqrt(best))) * away; const target = waterY + 0.05; // banks come down to just above the waterline (the water keeps its authored width)
    return y > target ? -(y - target) * strength : 0;
  }
  // True when a water vertex of the far stream lies within r metres of (x, z).
  function nearWater(x, z, r) {
    const cx = Math.floor(x / options.cell), cz = Math.floor(z / options.cell); const reachCells = Math.ceil(r / options.cell); const r2 = r * r;
    for (let dx = -reachCells; dx <= reachCells; dx += 1) for (let dz = -reachCells; dz <= reachCells; dz += 1) {
      const list = cells.get(key(cx + dx, cz + dz)); if (!list) continue;
      for (let i = 0; i < list.length; i += 3) if ((list[i] - x) ** 2 + (list[i + 2] - z) ** 2 < r2) return true;
    }
    return false;
  }
  return { offsetAt, nearWater };
}

// Widening is done after the bank is lowered; see waterWiden.js.
export { widenFarWater };

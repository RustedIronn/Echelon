// Meadow character: what makes a field look grazed, walked and weathered rather than evenly sown. Applied once, when the grass and flowers are
// placed (no runtime cost). ?meadowcharacter=off compares.
//  - a worn path: from the foreground meadow to the pool's outflow, across it on the riffle stones, and on up through the meadow to the hamlet
//  - dry, straw-coloured patches on the drier ground, and a richer, darker green where the ground is wet
export const MEADOW_CHARACTER = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('meadowcharacter') !== 'off';

// The path's centre line (x, z), from where the viewer stands to the hamlet's lane.
export const PATH = [[-6.5, 8], [-4.2, 3.5], [-1.2, -1.5], [1.6, -6.4], [3.3, -9.0], [5.8, -13.5], [7.6, -22], [9.2, -34], [11.5, -50], [13.2, -66], [15.2, -84], [17.6, -100], [19.6, -114]];
const segs = PATH.slice(1).map((b, i) => { const a = PATH[i]; const dx = b[0] - a[0], dz = b[1] - a[1]; return { a, dx, dz, len2: dx * dx + dz * dz }; });

// 0 off the path .. 1 on the trodden centre. The tread widens a little with distance (a single line of trampled blades would vanish).
export function pathAt(x, z) {
  if (!MEADOW_CHARACTER) return 0;
  let best = 1e9;
  for (const s of segs) { const t = Math.max(0, Math.min(1, ((x - s.a[0]) * s.dx + (z - s.a[1]) * s.dz) / s.len2)); const ex = x - (s.a[0] + s.dx * t), ez = z - (s.a[1] + s.dz * t); best = Math.min(best, ex * ex + ez * ez); }
  const d = Math.sqrt(best); const wobble = 0.08 * Math.sin(x * 1.7 + z * 0.9); const half = 0.32 + 0.004 * Math.hypot(x + 3, z - 10) + wobble;
  return 1 - smooth(half * 0.55, half * 1.5, d);
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const noise = (x, z) => { const v = Math.sin(x * 0.071 + 1.3) * Math.cos(z * 0.083 - 0.7) + 0.6 * Math.sin((x - z) * 0.047 + 2.1) + 0.35 * Math.sin(x * 0.19 + z * 0.13 + 4.2); return v / 1.95 * 0.5 + 0.5; };

// Dry patches: soft-edged straw drifts where the ground is driest (little moisture); none close to the water.
export function strawAt(x, z, moisture = 0) { if (!MEADOW_CHARACTER) return 0; return smooth(0.62, 0.8, noise(x, z)) * (1 - smooth(0.15, 0.45, moisture)); }

// The blade colour: straw in the dry patches, richer and darker in the wet, trampled and paler on the path.
export function characterTint(tint, x, z, moisture = 0) {
  if (!MEADOW_CHARACTER) return tint;
  const straw = strawAt(x, z, moisture); if (straw > 0) tint.lerp(STRAW, straw * 0.55);
  const wet = smooth(0.35, 0.8, moisture); if (wet > 0) { tint.r *= 1 - 0.12 * wet; tint.g *= 1 - 0.04 * wet; tint.b *= 1 - 0.1 * wet; }
  const p = pathAt(x, z); if (p > 0) tint.lerp(PATH_DEBUG ? { r: 1, g: 0, b: 0, isColor: true } : TRODDEN, PATH_DEBUG ? p : p * 0.75);
  return tint;
}
const PATH_DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('pathdebug');
const STRAW = { r: 0.62, g: 0.55, b: 0.3, isColor: true }; const TRODDEN = { r: 0.58, g: 0.53, b: 0.34, isColor: true }; // flattened, sun-bleached blades over bare earth
// Blade height: trodden down on the path, a touch taller and rangier in the dry patches.
export function characterHeight(x, z, moisture = 0) { if (!MEADOW_CHARACTER) return 1; return (1 - 0.72 * pathAt(x, z)) * (1 + 0.12 * strawAt(x, z, moisture)); }
// Thinning: on the tread a good share of the blades are simply gone (worn to earth).
export function pathThins(x, z, roll) { return MEADOW_CHARACTER && roll < 0.5 * smooth(0.45, 0.85, pathAt(x, z)); }

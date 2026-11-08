import { habitatHash, smooth } from './meadowHabitat.js';

// Flowering communities. Real meadows are not an even scatter of flowers: each species gathers into its own drift (a buttercup carpet, a pink campion stand, a froth of
// ox-eye), the drifts overlap at their edges and sit where the ground suits them (buttercups wet, ox-eye dry). This places those drifts as an artist would, as
// elongated cells that run across the view like contour lines, and feeds the same field to the flower models and to the colour of the blades around them.
export const COMMUNITIES = Object.freeze([
  { name: 'buttercup', cell: 8, rgb: [0.82, 0.60, 0.03] },
  { name: 'campion', cell: 7, rgb: [0.66, 0.10, 0.32] },
  { name: 'oxeye', cell: 6, rgb: [0.76, 0.74, 0.60] },
  { name: 'cranesbill', cell: 7, rgb: [0.34, 0.18, 0.62] },
]);
export const COMMUNITY_MIX = Object.freeze({ 6: [['Marguerite', 0.92], ['Carthusian Pink', 0.08]], 7: [['Carthusian Pink', 0.72], ['Red Clover', 0.28]], 8: [['Dandelion', 1]] });
// The first area to be made beautiful: the far bank between the river and the hamlet. Widening this window carries the same look through the valley.
export const VIGNETTE = { x0: -125, x1: 125, z0: -165, z1: -26, soft: 12 }; // the whole visible valley (the camera's view cone limits it further)

const CELL = [26, 24]; // the visible middle ground is a thin band of screen (depth is foreshortened), so a drift must be deep to be seen as a drift
const value = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = smooth(0, 1, x - i), v = smooth(0, 1, z - j); const a = habitatHash(i, j, 7), b = habitatHash(i + 1, j, 7), c = habitatHash(i, j + 1, 7), d = habitatHash(i + 1, j + 1, 7); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; };

const OFF = typeof globalThis.location !== 'undefined' && new URLSearchParams(globalThis.location.search).get('communities') === 'off'; // ?communities=off: compare with the meadow without them

export function communityAt(x, z, moisture = 0, window = VIGNETTE) {
  if (OFF) return { strength: 0, kind: 0 };
  const mask = smooth(window.x0, window.x0 + window.soft, x) * (1 - smooth(window.x1 - window.soft, window.x1, x)) * smooth(window.z0, window.z0 + window.soft, z) * (1 - smooth(window.z1 - window.soft, window.z1, z));
  if (mask <= 0) return { strength: 0, kind: 0 };
  // warp the plane before cutting it into drifts, so their outlines meander instead of lining up with the contours of a slope
  const wx = x + 11 * (value(x * 0.028 + 5, z * 0.034) - 0.5) * 2, wz = z + 12 * (value(x * 0.031, z * 0.026 + 9) - 0.5) * 2;
  const gi = Math.floor(wx / CELL[0]), gj = Math.floor(wz / CELL[1]); let d1 = 9, id = [0, 0];
  for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= 1; i += 1) {
    const ci = gi + i, cj = gj + j; const px = (ci + 0.15 + 0.7 * habitatHash(ci, cj, 101)) * CELL[0], pz = (cj + 0.15 + 0.7 * habitatHash(ci, cj, 102)) * CELL[1];
    const d = Math.hypot((wx - px) / CELL[0], (wz - pz) / CELL[1]); if (d < d1) { d1 = d; id = [ci, cj]; }
  }
  d1 += 0.16 * (value(x * 0.11, z * 0.23) - 0.5) + 0.07 * (value(x * 0.5, z * 0.8) - 0.5); // ragged, irregular edges
  const present = habitatHash(id[0], id[1], 103) < 0.88 ? 0.62 + 0.38 * habitatHash(id[0], id[1], 105) : 0; /* each drift has its own richness: some lavish, some sparse */ const core = 1 - smooth(0.3, 0.7, d1);
  const r = habitatHash(id[0], id[1], 104); const wet = smooth(0.12, 0.5, moisture);
  const t0 = 0.28 + 0.3 * wet, t1 = t0 + 0.21 * (1 - 0.3 * wet), t2 = t1 + 0.27; /* campion stands are 30% fewer than before */ const kind = r < t0 ? 0 : r < t1 ? 1 : r < t2 ? 2 : 3;
  // a ragged ribbon of buttercup along the wet ground at the water's edge
  const ribbon = smooth(0.3, 0.75, moisture) * smooth(0.25, 0.6, value(x * 0.09, z * 0.3)) * mask;
  return ribbon > present * core * mask ? { strength: ribbon, kind: 0 } : { strength: present * core * mask, kind };
}

// How flowers really scatter: not evenly through a patch but as a clustered point process. Small clumps (a plant and its seedlings, about a metre across) sit in looser
// groups (several metres), with sparse strays between them and bare ground in the gaps. This returns a density multiplier with a mean near 1 (about 0.2 in a gap,
// above 2 at the heart of a clump), used for both the flower models and the blade colour so that the two agree.
const clump = (x, z, size, presence, seed, spread) => {
  const gi = Math.floor(x / size), gj = Math.floor(z / size); let best = 0;
  for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= 1; i += 1) {
    const ci = gi + i, cj = gj + j; if (habitatHash(ci, cj, seed) > presence) continue;
    const px = (ci + 0.1 + 0.8 * habitatHash(ci, cj, seed + 1)) * size, pz = (cj + 0.1 + 0.8 * habitatHash(ci, cj, seed + 2)) * size; const s = size * (spread[0] + spread[1] * habitatHash(ci, cj, seed + 3));
    best = Math.max(best, Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (2 * s * s)) * (0.55 + 0.45 * habitatHash(ci, cj, seed + 4)));
  }
  return best;
};
export function scatterDensity(x, z) {
  const small = clump(x, z, 2.4, 0.64, 201, [0.2, 0.28]), loose = clump(x, z, 8.5, 0.7, 211, [0.22, 0.2]);
  return 0.2 + 2.3 * Math.min(1, small * (0.45 + 0.9 * loose) + 0.35 * loose * small + 0.2 * loose);
}

// 0 on level ground, 1 where the added relief rises away from the camera at about 6 degrees or more. Needs the valley relief (valleyRelief.js); without it, always 0.
export function slopeFacing(bank, x, z) {
  if (!bank?.relief) return 0;
  const gz = bank.relief.gradient(x, z)[1]; return Math.max(0, Math.min(1, -gz / 0.1));
}

// Flower models for the communities: dense in the core of each drift, thinning to scattered singles at its edge, a little larger with distance so they read.
export function placeCommunityFlowers(field, habitat, { bank = null, from = 34, to = 165, cell = 0.55, window = VIGNETTE } = {}) {
  const matrices = Array.from({ length: 9 }, () => []);
  for (let j = Math.floor((10 - to) / cell); j <= Math.floor((10 - from) / cell); j += 1) for (let i = Math.floor((-3 - to) / cell); i <= Math.floor((-3 + to) / cell); i += 1) {
    const x = (i + habitatHash(i, j, 111)) * cell, z = (j + habitatHash(i, j, 112)) * cell, d = Math.hypot(x + 3, z - 10);
    if (d < from || d > to || x < window.x0 || x > window.x1 || z < window.z0 || z > window.z1) continue;
    const h = habitat.sample(x, z); if (h.density < 0.05) continue;
    const c = communityAt(x, z, h.moisture, window); if (c.strength < 0.04) continue;
    const fade = smooth(from, from + 10, d) * (1 - smooth(to - 35, to, d));
    const scatter = scatterDensity(x, z); // clustered, not even: clumps, looser groups, strays and bare gaps
    const facing = slopeFacing(bank, x, z); // ground that rises away from the camera shows its flowers' faces: it is planted more richly
    if (habitatHash(i, j, 113) > c.strength ** 1.1 * (0.5 + 0.5 * h.density) * 0.72 * scatter * (1 + 0.9 * facing) * (1 - 0.6 * smooth(55, 120, d)) * fade) continue; // thinner far away: the blades carry the colour there
    const n = 1 + (habitatHash(i, j, 114) > 0.55 ? 1 : 0) + (scatter > 1.6 && habitatHash(i, j, 116) > 0.5 ? 1 : 0);
    for (let k = 0; k < n; k += 1) {
      const px = x + (habitatHash(i, j, 115 + k) - 0.5) * cell, pz = z + (habitatHash(i, j, 125 + k) - 0.5) * cell; const local = habitat.sample(px, pz);
      let y = field.at(px, pz); if (bank) y += bank.offsetAt(px, pz, y); if (local.waterDistance < 3 && y < local.waterLevel + 0.035) continue;
      // species by the drift's kind, with a few strays of the neighbouring kind so no drift is a perfect monoculture
      let cell8 = COMMUNITIES[c.kind].cell; if (habitatHash(i, j, 135 + k) > (scatter < 0.8 ? 0.62 : 0.86)) cell8 = COMMUNITIES[(c.kind + 1 + Math.floor(3 * habitatHash(i, j, 165 + k))) % 4].cell; /* strays between the clumps are more often another species */
      const size = (1 + 0.3 * smooth(from, 100, d)) * (0.74 + 0.24 * habitatHash(i, j, 145 + k)) * (1 + 0.08 * c.strength); // about 20% lower than the first pass
      const yaw = habitatHash(i, j, 155 + k) * Math.PI * 2, cs = Math.cos(yaw) * size, sn = Math.sin(yaw) * size;
      matrices[cell8].push(cs, 0, -sn, 0, 0, size, 0, 0, sn, 0, cs, 0, px, y - 0.012, pz, 1);
    }
  }
  return { counts: matrices.map((m) => m.length / 16), matrices: matrices.map((m) => Float32Array.from(m)), colors: matrices.map((m) => new Float32Array(m.length / 16 * 3).fill(1)) };
}

import * as THREE from 'three';
import { applyBlenderDisplay, applyFlowerResponse } from './alpineParityMaterials.js';
import { habitatHash, smooth } from './meadowHabitat.js';
import { FRAME_HALF_ANGLE } from './meadowHabitatGrowth.js';

// Wild plants: procedural, instanced, cheap (a few hundred triangles a plant, a few hundred plants of each kind), lit and swayed like the meadow
// (the flower response and wind of alpineParityMaterials.js). Geometry is built once per kind in a few variants; each plant is an instance with its
// own turn and size. ?wildplants=off removes them all.
export const WILD_PLANTS_WANTED = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('wildplants') !== 'off';
const CAMERA = [-3, 10];

// ---------------------------------------------------------------- geometry
const hex = (c) => new THREE.Color(c);
function builder() {
  const P = [], N = [], C = []; const idx = [];
  const vert = (p, n, c) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(c.r, c.g, c.b); return P.length / 3 - 1; };
  return {
    // a tapered, curving blade: root at base, rising to height h, leaning out along dir by lean (m at the tip), width w at the root
    blade(base, dir, h, lean, w, root, tip, segs = 3, tipShade = null) {
      const side = [-dir[1], 0, dir[0]]; let prev = null;
      for (let s = 0; s <= segs; s += 1) {
        const t = s / segs; const out = lean * t * t; const y = h * (t - 0.18 * lean / Math.max(h, 0.01) * t * t);
        const cx = base[0] + dir[0] * out, cz = base[2] + dir[1] * out, cy = base[1] + y; const half = w * 0.5 * (1 - 0.92 * t);
        const n = [dir[0] * 0.35, 1, dir[1] * 0.35]; const col = (tipShade && t > 0.8 ? tipShade : root).clone().lerp(tip, t);
        const a = vert([cx - side[0] * half, cy, cz - side[2] * half], n, col), b = vert([cx + side[0] * half, cy, cz + side[2] * half], n, col);
        if (prev) idx.push(prev[0], prev[1], b, prev[0], b, a); prev = [a, b];
      }
    },
    // a flat disc of n wedges (leaf blades, petals), centred at c, tilted by normal nrm, radius r
    disc(c, nrm, r, n, col, rim = null, stretch = [1, 1]) {
      const up = new THREE.Vector3(...nrm).normalize(); const t1 = new THREE.Vector3(1, 0, 0).cross(up); if (t1.lengthSq() < 1e-4) t1.set(0, 0, 1); t1.normalize(); const t2 = up.clone().cross(t1);
      const centre = vert(c, nrm, col); const ring = [];
      for (let k = 0; k < n; k += 1) { const a = (k / n) * Math.PI * 2; const p = new THREE.Vector3(...c).addScaledVector(t1, Math.cos(a) * r * stretch[0]).addScaledVector(t2, Math.sin(a) * r * stretch[1]); ring.push(vert(p.toArray(), nrm, rim ?? col)); }
      for (let k = 0; k < n; k += 1) idx.push(centre, ring[k], ring[(k + 1) % n]);
    },
    // a tiny round floret: three small discs at right angles, so it reads as a round dot from any side (never a square)
    puff(c, r, col) { for (const n of [[0, 1, 0], [1, 0.2, 0], [0, 0.2, 1]]) this.disc(c, n, r, 6, col); },
    geometry() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g; },
  };
}
const mulberry = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Soft rush (Juncus): a dense upright clump of thin round dark-green stems, a few with a brown flower tuft near the top and straw tips.
function rushGeometry(seed) {
  const r = mulberry(seed), b = builder(); const n = 30 + Math.floor(r() * 12);
  for (let i = 0; i < n; i += 1) {
    const a = r() * Math.PI * 2, spread = 0.02 + r() * 0.07; const dir = [Math.cos(a), Math.sin(a)]; const h = 0.55 + r() * 0.45;
    b.blade([dir[0] * spread, 0, dir[1] * spread], dir, h, 0.04 + r() * 0.16, 0.009, hex('#2f4a22'), hex(r() < 0.3 ? '#8a8455' : '#4d6b2c'), 3, null);
    if (r() < 0.18) for (let k = 0; k < 4; k += 1) b.puff([dir[0] * (spread + 0.03 + k * 0.006), h * (0.76 + k * 0.025), dir[1] * (spread + 0.03 + k * 0.006)], 0.006, hex('#6e5536')); // a small brown flower tuft on the stem
  }
  return b.geometry();
}
// The taller, darker fringe of the bank: tussock sedge, arching, broad-leaved, olive to deep green.
function sedgeGeometry(seed) {
  const r = mulberry(seed), b = builder(); const n = 34 + Math.floor(r() * 14);
  for (let i = 0; i < n; i += 1) {
    const a = r() * Math.PI * 2, spread = 0.03 + r() * 0.1; const dir = [Math.cos(a), Math.sin(a)]; const h = 0.5 + r() * 0.5;
    b.blade([dir[0] * spread, 0, dir[1] * spread], dir, h, 0.15 + r() * 0.35, 0.02, hex('#2b4320'), hex(r() < 0.25 ? '#7d7a45' : '#56702f'), 3);
  }
  return b.geometry();
}
// Meadowsweet: tall stems with a few leaves, each topped by a frothy cream plume.
function meadowsweetGeometry(seed) {
  const r = mulberry(seed), b = builder(); const stems = 2 + Math.floor(r() * 3);
  for (let s = 0; s < stems; s += 1) {
    const a = r() * Math.PI * 2, off = r() * 0.12; const base = [Math.cos(a) * off, 0, Math.sin(a) * off]; const h = 0.75 + r() * 0.45; const lean = (r() - 0.5) * 0.12; const dir = [Math.cos(a), Math.sin(a)];
    b.blade(base, dir, h, lean, 0.012, hex('#3c5a2a'), hex('#5a6e34'), 3);
    b.blade(base, [-dir[1], dir[0]], h, lean, 0.012, hex('#3c5a2a'), hex('#5a6e34'), 3);
    for (let k = 0; k < 4; k += 1) { const t = 0.2 + k * 0.15; const la = a + k * 2.1; b.disc([base[0] + Math.cos(la) * 0.06, h * t, base[2] + Math.sin(la) * 0.06], [Math.cos(la) * 0.6, 1, Math.sin(la) * 0.6], 0.06, 5, hex('#33502a'), hex('#4b6a33'), [1.6, 0.6]); }
    const top = [base[0] + dir[0] * lean, h, base[2] + dir[1] * lean]; const cream = hex('#efe6c8');
    // the plume: many tiny florets in a loose, irregular dome (frothy, not a ball)
    for (let k = 0; k < 26; k += 1) { const fa = r() * Math.PI * 2, fr = Math.sqrt(r()) * 0.08; b.puff([top[0] + Math.cos(fa) * fr, top[1] + (0.07 - fr * 0.7) * r() + 0.01, top[2] + Math.sin(fa) * fr], 0.008 + r() * 0.008, cream.clone().lerp(hex('#d9cc98'), r() * 0.6)); }
  }
  return b.geometry();
}
// Marsh marigold: a low mound of round, glossy, dark leaves with buttery-yellow cups held just above.
function marigoldGeometry(seed) {
  const r = mulberry(seed), b = builder(); const leaves = 7 + Math.floor(r() * 5);
  for (let i = 0; i < leaves; i += 1) { const a = r() * Math.PI * 2, d = 0.04 + r() * 0.1; const y = 0.06 + r() * 0.12; b.blade([0, 0, 0], [Math.cos(a), Math.sin(a)], y, d, 0.006, hex('#2c4a22'), hex('#335426'), 2); b.disc([Math.cos(a) * d, y, Math.sin(a) * d], [Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35], 0.045 + r() * 0.02, 7, hex('#2e5226'), hex('#3d6430')); }
  const flowers = 3 + Math.floor(r() * 4);
  for (let i = 0; i < flowers; i += 1) { const a = r() * Math.PI * 2, d = r() * 0.1; const y = 0.16 + r() * 0.1; b.blade([0, 0, 0], [Math.cos(a), Math.sin(a)], y, d, 0.005, hex('#3a5a2a'), hex('#4a6a30'), 2); b.disc([Math.cos(a) * d, y, Math.sin(a) * d], [0, 1, 0], 0.022, 5, hex('#e7a812'), hex('#f6cf2a')); }
  return b.geometry();
}
// Moor-grass tussock: a dense mound of fine arching blades, the older ones straw-coloured.
function tussockGeometry(seed) {
  const r = mulberry(seed), b = builder(); const n = 46 + Math.floor(r() * 16);
  for (let i = 0; i < n; i += 1) { const a = r() * Math.PI * 2, spread = Math.sqrt(r()) * 0.12; const dir = [Math.cos(a), Math.sin(a)]; const h = 0.28 + r() * 0.3; const dry = r() < 0.35;
    b.blade([dir[0] * spread, 0, dir[1] * spread], dir, h, 0.12 + r() * 0.22, 0.012, hex(dry ? '#7b7448' : '#4b6530'), hex(dry ? '#c2b47c' : '#86954f'), 3); }
  return b.geometry();
}
// Seeding grasses (cocksfoot, Yorkshire fog): a few tall thin stems standing above the meadow, each topped by a soft spike of tiny straw-toned
// florets that catches the low sun.
function seedGrassGeometry(seed) {
  const r = mulberry(seed), b = builder(); const stems = 3 + Math.floor(r() * 4);
  for (let s = 0; s < stems; s += 1) {
    const a = r() * Math.PI * 2, off = r() * 0.06; const dir = [Math.cos(a), Math.sin(a)]; const h = 0.65 + r() * 0.35; const lean = 0.04 + r() * 0.12;
    b.blade([dir[0] * off, 0, dir[1] * off], dir, h, lean, 0.006, hex('#5d7036'), hex('#9a9a5c'), 4);
    const top = [dir[0] * (off + lean), h, dir[1] * (off + lean)]; const tint = r() < 0.5 ? hex('#c9b98a') : hex('#b8a7b0'); // straw, or the pinkish-grey of Yorkshire fog
    for (let k = 0; k < 16; k += 1) b.puff([top[0] + (r() - 0.5) * 0.022 + dir[0] * k * 0.002, top[1] - k * 0.008, top[2] + (r() - 0.5) * 0.022 + dir[1] * k * 0.002], 0.0035 + r() * 0.003, tint.clone().lerp(hex('#8f8a5a'), 0.35 + r() * 0.3));
  }
  return b.geometry();
}
// Bracken: fronds on stiff stalks, each a triangle of paired leaflets along a midrib, arching outward; the green of late summer.
function brackenGeometry(seed) {
  const r = mulberry(seed), b = builder(); const fronds = 3 + Math.floor(r() * 3);
  for (let f = 0; f < fronds; f += 1) {
    const a = r() * Math.PI * 2; const dir = [Math.cos(a), Math.sin(a)]; const side = [-dir[1], dir[0]]; const stalk = 0.35 + r() * 0.25, len = 0.45 + r() * 0.3;
    b.blade([0, 0, 0], dir, stalk, 0.05, 0.01, hex('#5a4a2c'), hex('#5c6a2e'), 2);
    for (let k = 0; k < 8; k += 1) { const t = k / 8; const along = 0.05 + t * len; const y = stalk + 0.06 - t * t * 0.18; const w = (1 - t) * 0.16 + 0.03; const c = [dir[0] * along, y, dir[1] * along]; const green = hex(r() < 0.12 ? '#8a7a3a' : '#4f6b26').lerp(hex('#6f8a34'), t * 0.6);
      for (const sgn of [-1, 1]) b.disc([c[0] + side[0] * sgn * w * 0.5, c[1], c[2] + side[1] * sgn * w * 0.5], [dir[0] * 0.3, 1, dir[1] * 0.3], w * 0.5, 5, green, green, [1.0, 0.35]); }
  }
  return b.geometry();
}
// Gorse: a dense dark spiny mound, flecked all over with coconut-yellow flowers.
function gorseGeometry(seed) {
  const r = mulberry(seed), b = builder(); const n = 120 + Math.floor(r() * 40);
  for (let i = 0; i < n; i += 1) { const a = r() * Math.PI * 2, el = Math.acos(1 - r()); const rad = 0.45 + r() * 0.12; const c = [Math.cos(a) * Math.sin(el) * rad, 0.15 + Math.cos(el) * rad * 0.9, Math.sin(a) * Math.sin(el) * rad];
    b.blade([c[0] * 0.6, c[1] * 0.4, c[2] * 0.6], [Math.cos(a), Math.sin(a)], c[1] * 0.65, rad * 0.45, 0.04, hex('#1f3318'), hex('#34502a'), 2); }
  for (let i = 0; i < 70; i += 1) { const a = r() * Math.PI * 2, el = Math.acos(1 - r() * 0.95); const rad = 0.5 + r() * 0.06; b.puff([Math.cos(a) * Math.sin(el) * rad, 0.15 + Math.cos(el) * rad * 0.9, Math.sin(a) * Math.sin(el) * rad], 0.02, hex('#f0c419').lerp(hex('#e0a510'), r())); }
  return b.geometry();
}
export const WILD_KINDS = {
  rush: { make: rushGeometry, variants: 3 },
  sedge: { make: sedgeGeometry, variants: 3 },
  meadowsweet: { make: meadowsweetGeometry, variants: 3 },
  marigold: { make: marigoldGeometry, variants: 3 },
  tussock: { make: tussockGeometry, variants: 3 },
  seedgrass: { make: seedGrassGeometry, variants: 4 },
  bracken: { make: brackenGeometry, variants: 3 },
  gorse: { make: gorseGeometry, variants: 2 },
};

// The open meadow: tussocks and seeding grasses through it in patches, bracken in stands on the dry, rising ground of the middle distance, and a
// few gorse bushes. Kept off the water's edge (that band has its own plants), the hamlet's tended ground and the worn path.
export function planMeadow({ habitat, groundAt, clearing = null, avoid = () => 0, from = 5, to = 160, cell = 0.7 }) {
  const out = { tussock: [], seedgrass: [], bracken: [], gorse: [] };
  const patch = (x, z, s, k) => { const v = Math.sin(x * s + k) * Math.cos(z * s * 1.3 - k * 0.7) + Math.sin((x + z) * s * 0.6 + k * 2.1) * 0.6; return v * 0.5 + 0.5; };
  for (let j = Math.floor((CAMERA[1] - to) / cell); j <= Math.floor((CAMERA[1] - from) / cell); j += 1) for (let i = Math.floor((CAMERA[0] - to) / cell); i <= Math.floor((CAMERA[0] + to) / cell); i += 1) {
    const x = (i + habitatHash(i, j, 81)) * cell, z = (j + habitatHash(i, j, 82)) * cell, dx = x - CAMERA[0], dz = z - CAMERA[1], d = Math.hypot(dx, dz);
    if (d < from || d > to || Math.atan2(Math.abs(dx), -dz) > FRAME_HALF_ANGLE) continue;
    const h = habitat.sample(x, z); if (h.density < 0.08 || h.waterDistance < 4) continue; if (clearing && clearing.softness(x, z) < 0.9) continue; if (avoid(x, z) > 0.2) continue;
    const roll = habitatHash(i, j, 83), pick = habitatHash(i, j, 84);
    const near = d < 12 ? 0.4 : 1; // keep the first metres open: these stand taller than the meadow
    const cand = [
      ['tussock', 0.25 * smooth(0.55, 0.75, patch(x, z, 0.09, 5.3)) * (0.4 + h.moisture) * near],
      ['seedgrass', 0.42 * smooth(0.4, 0.65, patch(x, z, 0.13, 1.7)) * (1.1 - h.bloom * 0.6) * smooth(9, 14, d)], // they stand above the meadow: not in the first metres
      ['bracken', 0.6 * smooth(0.68, 0.82, patch(x, z, 0.045, 3.3)) * smooth(30, 55, d) * (1 - h.moisture)],
      ['gorse', 0.035 * smooth(0.78, 0.86, patch(x, z, 0.03, 8.1)) * smooth(25, 45, d) * (1 - h.moisture)],
    ];
    const total = cand.reduce((s, c) => s + c[1], 0); if (roll > total * cell * cell * (1 - 0.5 * smooth(60, 160, d))) continue;
    let acc = 0, kind = cand[0][0]; const target = pick * total; for (const [k, w] of cand) { acc += w; if (target <= acc) { kind = k; break; } }
    const y = groundAt(x, z, d); if (!(y === y)) continue;
    const size = (kind === 'gorse' ? 1.6 : kind === 'bracken' ? 1.15 : 0.85) + 0.4 * habitatHash(i, j, 85);
    out[kind].push({ x, y: y - 0.02, z, yaw: habitatHash(i, j, 86) * Math.PI * 2, size, variant: Math.floor(habitatHash(i, j, 87) * WILD_KINDS[kind].variants) });
  }
  return out;
}

// ---------------------------------------------------------------- placement
// The water's edge: the band of dry ground just above the water. The water map also covers dry banks (the delivered mesh runs under them), so the
// bank is found by height: ground a little above the local water level, close to water. Each kind has its own place in that band and grows in
// patches (low-frequency noise), so the bank reads as stands of rush and sedge broken by clumps of marigold and meadowsweet, not an even trim.
export function planWaterEdge({ habitat, groundAt, clearing = null, from = 3.5, to = 150, cell = 0.5 }) {
  const out = { rush: [], sedge: [], meadowsweet: [], marigold: [] };
  const patch = (x, z, s, k) => { const v = Math.sin(x * s + k) * Math.cos(z * s * 1.3 - k * 0.7) + Math.sin((x + z) * s * 0.6 + k * 2.1) * 0.6; return v * 0.5 + 0.5; };
  for (let j = Math.floor((CAMERA[1] - to) / cell); j <= Math.floor((CAMERA[1] - from) / cell); j += 1) for (let i = Math.floor((CAMERA[0] - to) / cell); i <= Math.floor((CAMERA[0] + to) / cell); i += 1) {
    const x = (i + habitatHash(i, j, 71)) * cell, z = (j + habitatHash(i, j, 72)) * cell, dx = x - CAMERA[0], dz = z - CAMERA[1], d = Math.hypot(dx, dz);
    if (d < from || d > to || Math.atan2(Math.abs(dx), -dz) > FRAME_HALF_ANGLE) continue;
    const h = habitat.sample(x, z); if (h.waterDistance > 3.5) continue; if (clearing && clearing.softness(x, z) < 0.7) continue;
    const y = groundAt(x, z, d); if (!(y === y)) continue; const above = y - h.waterLevel; if (above < 0.02 || above > 0.7) continue;
    const thin = (1 - 0.55 * smooth(40, 140, d)) * (d < 9 ? 0.35 : 1); // fewer far away (they merge) and only a few right at the camera, so the pool stays open
    const roll = habitatHash(i, j, 73), pick = habitatHash(i, j, 74);
    const wet = 1 - smooth(0.04, 0.3, above), mid = smooth(0.05, 0.2, above) * (1 - smooth(0.35, 0.65, above));
    const cand = [
      ['sedge', 0.55 * wet * smooth(0.45, 0.7, patch(x, z, 0.21, 1.3))],
      ['rush', 0.5 * (wet * 0.6 + mid * 0.6) * smooth(0.4, 0.68, patch(x, z, 0.17, 4.1))],
      ['marigold', 0.35 * wet * smooth(0.55, 0.75, patch(x, z, 0.33, 7.7))],
      ['meadowsweet', 0.32 * mid * smooth(0.5, 0.72, patch(x, z, 0.12, 2.9)) * smooth(12, 18, d)], // tall plumes: not right at the camera, where they would wall off the view
    ];
    const total = cand.reduce((s, c) => s + c[1], 0) * thin; if (roll > total * cell * cell * 4) continue;
    let acc = 0, kind = cand[0][0]; const target = pick * cand.reduce((s, c) => s + c[1], 0); for (const [k, w] of cand) { acc += w; if (target <= acc) { kind = k; break; } }
    const size = (kind === 'meadowsweet' ? 0.85 : 0.8) + 0.45 * habitatHash(i, j, 75); const yaw = habitatHash(i, j, 76) * Math.PI * 2;
    out[kind].push({ x, y: y - 0.02, z, yaw, size, variant: Math.floor(habitatHash(i, j, 77) * WILD_KINDS[kind].variants) });
  }
  return out;
}

// ---------------------------------------------------------------- build
export function buildWildPlants(plan, resources, name = 'Wild plants') {
  const group = new THREE.Group(); group.name = name; const disposables = []; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const [kind, list] of Object.entries(plan)) {
    if (!list.length || !WILD_KINDS[kind]) continue;
    const spec = WILD_KINDS[kind];
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: kind === 'marigold' ? 0.55 : 0.85, metalness: 0 });
    applyBlenderDisplay(material, resources); applyFlowerResponse(material); material.userData.lookRole = 'flowers'; material.userData.baseColor = material.color.clone(); disposables.push(material);
    for (let v = 0; v < spec.variants; v += 1) {
      const items = list.filter((it) => it.variant === v); if (!items.length) continue;
      const geometry = spec.make(1000 + v * 97 + kind.length * 13); disposables.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, material, items.length); mesh.name = `${name} / ${kind} ${v}`;
      items.forEach((it, k) => { q.setFromAxisAngle(up, it.yaw); s.setScalar(it.size); p.set(it.x, it.y, it.z); m.compose(p, q, s); mesh.setMatrixAt(k, m); });
      mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh); disposables.push(mesh);
    }
  }
  return { group, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}

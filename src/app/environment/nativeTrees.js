import * as THREE from 'three';
import { applyBlenderDisplay, applyFoliageStyle } from './alpineParityMaterials.js';

// A few native broadleaves along the stream and on the rising ground: silver birch, rowan (with its red berries) and alder by the water.
// Procedural: a tapered trunk and branches (five-sided tubes) and a canopy of leaf clumps (small shaded discs) gathered at the twig ends, lit with
// the spruce's foliage style (applyFoliageStyle) so they sit in the same world. Only a handful, so each is its own mesh. ?nativetrees=off.
export const NATIVE_TREES_WANTED = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('nativetrees') !== 'off';

const SPECIES = {
  birch: { height: [9, 12], trunk: 0.16, spread: 0.32, droop: 0.5, levels: 3, children: 4, bark: ['#e7e2d6', '#3d3a36'], marks: 0.35, leaf: ['#5f803a', '#7f9a4c'], clump: 0.32, perTip: 5, berries: null },
  rowan: { height: [5, 7], trunk: 0.13, spread: 0.6, droop: 0.05, levels: 3, children: 4, bark: ['#7b776d', '#5e5a52'], marks: 0, leaf: ['#4f7c33', '#6c9440'], clump: 0.38, perTip: 5, berries: '#c1301c' },
  alder: { height: [8, 10], trunk: 0.2, spread: 0.5, droop: 0.1, levels: 3, children: 5, bark: ['#4b463f', '#38342f'], marks: 0, leaf: ['#355b26', '#4b7230'], clump: 0.42, perTip: 6, berries: null },
};
// [species, x, z, seed]: alders on the stream banks, birches on the left rise, rowans by the path and the far bend (clear of the hamlet and the view)
// Placed to frame the view, not to cover it: the alders at the left edge, the birches small on the far rise, the rowans at the right edge, all clear
// of the hamlet and the peaks' outlines.
export const TREE_SITES = [
  ['alder', -33, -31, 3], ['alder', -28, -40, 7],
  ['birch', -58, -84, 11], ['birch', -52, -90, 13], ['birch', -63, -95, 17],
  ['rowan', 28, -35, 19], ['rowan', 58, -72, 23],
];

const mulberry = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function buildTree(kind, seed) {
  const s = SPECIES[kind], r = mulberry(seed); const height = s.height[0] + r() * (s.height[1] - s.height[0]);
  const wood = { P: [], N: [], C: [], I: [] }, leaf = { P: [], N: [], C: [], I: [] }; const tips = [];
  const barkA = new THREE.Color(s.bark[0]), barkB = new THREE.Color(s.bark[1]); const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  const tube = (a, b, ra, rb) => { // a five-sided tapered tube from a to b
    const axis = b.clone().sub(a).normalize(); const side = Math.abs(axis.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up.clone(); const u = side.clone().cross(axis).normalize(), v = axis.clone().cross(u);
    const base = wood.P.length / 3;
    for (const [p, rad] of [[a, ra], [b, rb]]) for (let k = 0; k < 5; k += 1) { const ang = (k / 5) * Math.PI * 2; const n = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang)); tmp.copy(p).addScaledVector(n, rad); wood.P.push(tmp.x, tmp.y, tmp.z); wood.N.push(n.x, n.y, n.z);
      col.copy(barkA); if (s.marks && r() < s.marks) col.lerp(barkB, 0.7 + r() * 0.3); else col.lerp(barkB, r() * 0.25); wood.C.push(col.r, col.g, col.b); }
    for (let k = 0; k < 5; k += 1) { const k2 = (k + 1) % 5; wood.I.push(base + k, base + k2, base + 5 + k2, base + k, base + 5 + k2, base + 5 + k); }
  };
  const grow = (start, dir, len, rad, depth) => {
    const end = start.clone().addScaledVector(dir, len); const mid = start.clone().lerp(end, 0.5); mid.y -= len * s.droop * 0.15 * depth; // twigs sag
    tube(start, mid, rad, rad * 0.8); tube(mid, end, rad * 0.8, rad * 0.6);
    if (depth >= s.levels) { tips.push(end, mid); return; }
    const n = s.children + (r() < 0.5 ? 1 : 0);
    for (let c = 0; c < n; c += 1) {
      const t = depth === 0 ? 0.45 + 0.5 * (c / n) + r() * 0.05 : 0.3 + 0.65 * r(); const at = start.clone().lerp(end, t);
      const yaw = (c / n) * Math.PI * 2 + r() * 1.2; const tilt = (depth === 0 ? 0.65 + s.spread * 0.6 : 0.4 + s.spread * 0.5) * (0.8 + r() * 0.4);
      const d = new THREE.Vector3(Math.cos(yaw) * Math.sin(tilt), Math.cos(tilt), Math.sin(yaw) * Math.sin(tilt)).lerp(dir, depth === 0 ? 0.15 : 0.35).normalize(); d.y -= s.droop * 0.25 * depth; d.normalize();
      grow(at, d, len * (depth === 0 ? 0.42 : 0.58) * (0.8 + r() * 0.4), rad * 0.45, depth + 1);
    }
  };
  grow(new THREE.Vector3(0, -0.3, 0), new THREE.Vector3((r() - 0.5) * 0.08, 1, (r() - 0.5) * 0.08).normalize(), height * 0.62, s.trunk, 0);
  // the canopy: leaf clumps round the twig ends (and a few berry clusters on a rowan)
  const leafA = new THREE.Color(s.leaf[0]), leafB = new THREE.Color(s.leaf[1]);
  const disc = (c, n, rad, color) => { const t1 = new THREE.Vector3(1, 0, 0).cross(n); if (t1.lengthSq() < 1e-4) t1.set(0, 0, 1); t1.normalize(); const t2 = n.clone().cross(t1); const base = leaf.P.length / 3; leaf.P.push(c.x, c.y, c.z); leaf.N.push(n.x, n.y, n.z); leaf.C.push(color.r, color.g, color.b);
    for (let k = 0; k < 6; k += 1) { const a = (k / 6) * Math.PI * 2; tmp.copy(c).addScaledVector(t1, Math.cos(a) * rad).addScaledVector(t2, Math.sin(a) * rad * 0.7); leaf.P.push(tmp.x, tmp.y, tmp.z); leaf.N.push(n.x, n.y, n.z); leaf.C.push(color.r, color.g, color.b); }
    for (let k = 0; k < 6; k += 1) leaf.I.push(base, base + 1 + k, base + 1 + ((k + 1) % 6)); };
  for (const tip of tips) for (let k = 0; k < s.perTip * 2; k += 1) { // a rounded cloud of clumps round each twig, facing every way: a canopy with depth, not a stack of plates
    const o = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5); if (o.lengthSq() > 0.25) o.multiplyScalar(0.5 / o.length()); const c = tip.clone().addScaledVector(o, 1.7).add(new THREE.Vector3(0, -s.droop * 0.3, 0));
    const n = o.lengthSq() > 1e-4 ? o.clone().normalize().add(new THREE.Vector3(0, 0.35, 0)).normalize() : up.clone(); disc(c, n, s.clump * (0.7 + r() * 0.5), leafA.clone().lerp(leafB, (o.y + 0.5) * 0.7 + r() * 0.3)); // lighter on top
    if (s.berries && r() < 0.06) disc(c.clone().add(new THREE.Vector3(0, -0.1, 0)), new THREE.Vector3(0, 1, 0.3).normalize(), 0.09, new THREE.Color(s.berries));
  }
  const make = (g) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.N, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.C, 3)); geo.setIndex(g.I); geo.computeBoundingSphere(); return geo; };
  return { wood: make(wood), leaves: make(leaf), height };
}

// groundAt(x, z) -> height. Returns { group, dispose }.
export function buildNativeTrees(resources, groundAt) {
  const group = new THREE.Group(); group.name = 'Native trees'; const disposables = [];
  const bark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }); applyBlenderDisplay(bark, resources); disposables.push(bark);
  for (const [kind, x, z, seed] of TREE_SITES) {
    const y = groundAt(x, z); if (!(y === y)) continue; const tree = buildTree(kind, seed);
    const wood = new THREE.Mesh(tree.wood, bark); const center = new THREE.Vector3(x, y + tree.height * 0.68, z);
    const leafMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }); applyBlenderDisplay(leafMaterial, resources); applyFoliageStyle(leafMaterial, center); leafMaterial.userData.lookRole = 'trees'; leafMaterial.userData.baseColor = leafMaterial.color.clone();
    const leaves = new THREE.Mesh(tree.leaves, leafMaterial);
    const t = new THREE.Group(); t.name = `Native tree / ${kind}`; t.position.set(x, y, z); t.rotation.y = seed * 1.7; t.add(wood, leaves); t.userData.echelonRole = 'tree';
    for (const m of [wood, leaves]) { m.castShadow = false; m.receiveShadow = true; } // far enough out that their shadows would be faint; kept out of the shadow pass
    group.add(t); disposables.push(tree.wood, tree.leaves, leafMaterial);
  }
  return { group, dispose: () => disposables.forEach((d) => d.dispose()) };
}

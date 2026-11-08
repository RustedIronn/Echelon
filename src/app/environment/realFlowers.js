import * as THREE from 'three';
import { inheritedMetadata } from './alpinePrototypeData.js';
import { applyBlenderDisplay, applyFlowerResponse } from './alpineParityMaterials.js';
import { TUFTS } from './tufts.js';

// Real flower models (the delivered meshes, at their lowest level of detail) for the middle ground, at the positions of the flower clumps chosen by tufts.js.
// Counts are capped so the triangle budget stays small (the models are 36-900 triangles at their lowest level of detail).
const MIX = { 6: [['Marguerite', 0.8], ['Carthusian Pink', 0.2]], 7: [['Marguerite', 0.55], ['Red Clover', 0.2], ['Dandelion', 0.25]], 8: [['Dandelion', 0.6], ['Marguerite', 0.4]] };
const hash = (x, s = 0) => { const v = Math.sin(x * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

export function planRealFlowers(placed, { maxFlowers = 3500, naturalScale = false, mix = null, keepScale = false } = {}) {
  const speciesMix = mix ? mix : naturalScale ? {6:[['Marguerite',.65],['Carthusian Pink',.35]],7:[['Marguerite',.5],['Red Clover',.12],['Dandelion',.23],['Carthusian Pink',.15]],8:[['Dandelion',.55],['Marguerite',.35],['Carthusian Pink',.10]]} : MIX;
  const total = [6, 7, 8].reduce((a, c) => a + placed.counts[c], 0); const keep = Math.min(1, maxFlowers / Math.max(1, total)); const lists = new Map();
  for (const cell of [6, 7, 8]) {
    for (let k = 0; k < placed.counts[cell]; k += 1) {
      if (hash(k + cell * 100003, 1) > keep) continue; const m = placed.matrices[cell]; const o = k * 16;
      let r = hash(k + cell * 7919, 2), acc = 0, species = speciesMix[cell][0][0]; for (const [name, weight] of speciesMix[cell]) { acc += weight; if (r <= acc) { species = name; break; } }
      const yaw = hash(k + cell * 1301, 3) * Math.PI * 2; const distance = Math.hypot(m[o + 12] - TUFTS.camera[0], m[o + 14] - TUFTS.camera[1]); const grow = Math.max(0, Math.min(1, (distance - 30) / 40)); const authoredScale = Math.hypot(m[o],m[o+1],m[o+2]); const scale = keepScale ? authoredScale : (naturalScale ? authoredScale * (1 + .22 * grow) : 1 + 0.55 * grow * grow * (3 - 2 * grow)) * (0.85 + 0.3 * hash(k, 4)); // authored scale is retained; at most 22% silhouette compensation in the middle distance
      const c = Math.cos(yaw) * scale, s = Math.sin(yaw) * scale; if (!lists.has(species)) lists.set(species, []); lists.get(species).push(c, 0, -s, 0, 0, scale, 0, 0, s, 0, c, 0, m[o + 12], m[o + 13] + 0.02, m[o + 14], 1);
    }
  }
  return lists; // species -> flat instance matrices
}

// Far flowers as tiny proxies. Beyond about 70 m a flower head is one or two pixels wide, yet the delivered models still draw 200-2500 triangles each (a dandelion's
// lowest level of detail is 847): thousands of sub-pixel, alpha-tested triangles that cost several milliseconds and are never seen. A proxy is a stem and a head
// (two crossed quads and one flat one, about eight triangles) in the species' colours, the same size as the model's head, placed by the same instance matrix.
const PROXY = {
  Marguerite: { petal: '#f3f0e6', centre: '#e6b52e', head: 0.1 },
  Dandelion: { petal: '#f2c21a', centre: '#e2a612', head: 0.12 },
  'Carthusian Pink': { petal: '#d6457c', centre: '#9e2958', head: 0.075 },
  'Red Clover': { petal: '#c45486', centre: '#a83c6e', head: 0.09 },
};
let proxyTexture = null;
function proxyAtlas() { // one small texture: a row of round heads (petals and centre), plus a green strip for the stems
  if (proxyTexture) return proxyTexture;
  const names = Object.keys(PROXY); const cell = 32; const canvas = document.createElement('canvas'); canvas.width = cell * (names.length + 1); canvas.height = cell; const g = canvas.getContext('2d');
  names.forEach((name, i) => { const p = PROXY[name]; const cx = i * cell + cell / 2; g.fillStyle = p.petal; g.beginPath(); g.arc(cx, cell / 2, cell * 0.46, 0, Math.PI * 2); g.fill(); g.fillStyle = p.centre; g.beginPath(); g.arc(cx, cell / 2, cell * 0.18, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = '#56733a'; g.fillRect(names.length * cell, 0, cell, cell);
  proxyTexture = new THREE.CanvasTexture(canvas); proxyTexture.colorSpace = THREE.SRGBColorSpace; proxyTexture.anisotropy = 4; return proxyTexture;
}
function proxyGeometry(species, parts) {
  const box = new THREE.Box3(); for (const source of parts) box.union(new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position).applyMatrix4(source.matrixWorld));
  const names = Object.keys(PROXY); const i = names.indexOf(species); const H = box.max.y - box.min.y; const base = box.min.y; const r = H * (PROXY[species]?.head ?? 0.1) * 0.85; /* a touch smaller than the head: a flat-coloured proxy reads stronger than the shaded model */ const y = box.max.y - r; const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const u0 = i / (names.length + 1), u1 = (i + 1) / (names.length + 1), su = (names.length + 0.5) / (names.length + 1); const w = Math.max(H * 0.012, 0.002);
  const P = [], U = [], idx = []; const quad = (a, b, c, d, ua, ub, uc, ud) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...d); U.push(...ua, ...ub, ...uc, ...ud); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  quad([cx - w, base, cz], [cx + w, base, cz], [cx + w, y, cz], [cx - w, y, cz], [su, 0.1], [su, 0.1], [su, 0.9], [su, 0.9]); // stem
  quad([cx - r, y - r, cz], [cx + r, y - r, cz], [cx + r, y + r, cz], [cx - r, y + r, cz], [u0, 0], [u1, 0], [u1, 1], [u0, 1]); // head, two upright crossed quads and one flat one
  quad([cx, y - r, cz - r], [cx, y - r, cz + r], [cx, y + r, cz + r], [cx, y + r, cz - r], [u0, 0], [u1, 0], [u1, 1], [u0, 1]);
  quad([cx - r, y, cz - r], [cx + r, y, cz - r], [cx + r, y, cz + r], [cx - r, y, cz + r], [u0, 0], [u1, 0], [u1, 1], [u0, 1]);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length / 3).fill([0, 1, 0]).flat(), 3)); geometry.setIndex(idx); return geometry;
}
// ?flowerproxy=off keeps the full models everywhere; ?flowerproxy=90 moves the switch distance.
export function proxyDistance(fallback = 70) { if (typeof window === 'undefined') return fallback; const asked = new URLSearchParams(window.location.search).get('flowerproxy'); return asked === 'off' ? Infinity : asked ? Number(asked) : fallback; }

export function buildRealFlowerGroup({ flowerScene, placed, resources, maxFlowers, naturalScale = false, receiveShadow = false, mix = null, keepScale = false, preferLod = 1, name = 'Mid-ground flowers (real models)', proxyBeyond = Infinity }) {
  const planned = planRealFlowers(placed, { maxFlowers, naturalScale, mix, keepScale }); const group = new THREE.Group(); group.name = name; const disposables = []; const matrix = new THREE.Matrix4();
  // split each species into the instances near enough to need the model and the far ones that get a proxy
  const lists = new Map(), far = new Map();
  for (const [species, matrices] of planned) { const near = [], away = []; for (let o = 0; o < matrices.length; o += 16) { const d = Math.hypot(matrices[o + 12] - TUFTS.camera[0], matrices[o + 14] - TUFTS.camera[1]); (d > proxyBeyond && PROXY[species] ? away : near).push(...matrices.slice(o, o + 16)); } if (near.length) lists.set(species, near); if (away.length) far.set(species, away); }
  flowerScene.updateMatrixWorld(true); const sources = new Map();
  flowerScene.traverse((source) => { if (!source.isMesh) return; const species = inheritedMetadata(source, 'species'); const lod = inheritedMetadata(source, 'lod') ?? 0; if (!lists.has(species) && !far.has(species)) return; const known = sources.get(species); const rank = (l) => (l === preferLod ? 0 : l === 1 ? 1 : l === 0 ? 2 : 3); /* prefer the middle level of detail: the lowest one reads as flat litter */ if (!known || rank(lod) < rank(known.lod)) sources.set(species, { lod, parts: [source] }); else if (lod === known.lod) known.parts.push(source); });
  let total = 0;
  for (const [species, matrices] of far) {
    const entry = sources.get(species); if (!entry) continue; const count = matrices.length / 16; const geometry = proxyGeometry(species, entry.parts); disposables.push(geometry);
    const material = new THREE.MeshStandardMaterial({ map: proxyAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 }); applyBlenderDisplay(material, resources); applyFlowerResponse(material); material.userData.lookRole = 'flowers'; material.userData.baseColor = material.color.clone(); disposables.push(material);
    const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = `${species} (far proxy)`;
    for (let k = 0; k < count; k += 1) { matrix.fromArray(matrices, k * 16); mesh.setMatrixAt(k, matrix); }
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = false; mesh.receiveShadow = receiveShadow; mesh.frustumCulled = false; group.add(mesh); disposables.push(mesh); total += count;
  }
  for (const [species, matrices] of lists) {
    const entry = sources.get(species); if (!entry) continue; const count = matrices.length / 16;
    for (const source of entry.parts) {
      const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld); disposables.push(geometry);
      const originals = Array.isArray(source.material) ? source.material : [source.material];
      const materials = originals.map((original) => { const m = original.clone(); m.transparent = false; m.alphaTest = 0.3; m.side = THREE.DoubleSide; m.roughness = 0.8; applyBlenderDisplay(m, resources); applyFlowerResponse(m); m.userData.lookRole = 'flowers'; m.userData.baseColor = m.color.clone(); disposables.push(m); return m; });
      const mesh = new THREE.InstancedMesh(geometry, Array.isArray(source.material) ? materials : materials[0], count); mesh.name = `${species} (mid-ground)`;
      for (let k = 0; k < count; k += 1) { matrix.fromArray(matrices, k * 16); mesh.setMatrixAt(k, matrix); }
      mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = false; mesh.receiveShadow = receiveShadow; mesh.frustumCulled = false; group.add(mesh); disposables.push(mesh);
    }
    total += count;
  }
  return { group, total, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}

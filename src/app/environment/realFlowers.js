import * as THREE from 'three';
import { inheritedMetadata } from './alpinePrototypeData.js';
import { applyBlenderDisplay, applyFlowerResponse } from './alpineParityMaterials.js';
import { TUFTS } from './tufts.js';

// Real flower models (the delivered meshes, at their lowest level of detail) for the middle ground, at the positions of the flower clumps chosen by tufts.js.
// Counts are capped so the triangle budget stays small (the models are 36-900 triangles at their lowest level of detail).
const MIX = { 6: [['Marguerite', 0.8], ['Carthusian Pink', 0.2]], 7: [['Marguerite', 0.55], ['Red Clover', 0.2], ['Dandelion', 0.25]], 8: [['Dandelion', 0.6], ['Marguerite', 0.4]] };
const hash = (x, s = 0) => { const v = Math.sin(x * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

export function planRealFlowers(placed, { maxFlowers = 3500, naturalScale = false, mix = null, keepScale = false } = {}) {
  const speciesMix = mix ? mix : naturalScale ? {6:[['Marguerite',.65],['Carthusian Pink',.35]],7:[['Marguerite',.35],['Red Clover',.4],['Dandelion',.25]],8:[['Dandelion',.55],['Marguerite',.35],['Carthusian Pink',.10]]} : MIX;
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

export function buildRealFlowerGroup({ flowerScene, placed, resources, maxFlowers, naturalScale = false, receiveShadow = false, mix = null, keepScale = false, preferLod = 1, name = 'Mid-ground flowers (real models)' }) {
  const lists = planRealFlowers(placed, { maxFlowers, naturalScale, mix, keepScale }); const group = new THREE.Group(); group.name = name; const disposables = []; const matrix = new THREE.Matrix4();
  flowerScene.updateMatrixWorld(true); const sources = new Map();
  flowerScene.traverse((source) => { if (!source.isMesh) return; const species = inheritedMetadata(source, 'species'); const lod = inheritedMetadata(source, 'lod') ?? 0; if (!lists.has(species)) return; const known = sources.get(species); const rank = (l) => (l === preferLod ? 0 : l === 1 ? 1 : l === 0 ? 2 : 3); /* prefer the middle level of detail: the lowest one reads as flat litter */ if (!known || rank(lod) < rank(known.lod)) sources.set(species, { lod, parts: [source] }); else if (lod === known.lod) known.parts.push(source); });
  let total = 0;
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

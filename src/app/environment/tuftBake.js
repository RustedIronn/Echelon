import * as THREE from 'three';
import { grassMatrix, inheritedMetadata } from './alpinePrototypeData.js';

// Tuft cards for the middle and far meadow. Each card is baked once at load by rendering the real foreground blades (and the real flower models) into a small
// transparent texture: about a dozen blades of the delivered shapes, lengths and widths for a grass tuft; broad basal leaves for the understory; clusters of the
// delivered daisies, clover, dandelions and pinks with their leaves for the flower cards. A card is then two crossed quads standing for the whole tuft.
export const CARD = { size: 512, width: 0.7, height: 0.7, bladeWidth: 1.35 };
export const CELLS = [
  { kind: 'grass', blades: 34, spread: 0.2, tall: 1.0, seed: 1 }, { kind: 'grass', blades: 42, spread: 0.22, tall: 1.2, seed: 2 }, { kind: 'grass', blades: 26, spread: 0.18, tall: 0.85, seed: 3 }, { kind: 'grass', blades: 36, spread: 0.2, tall: 1.55, seed: 4 },
  { kind: 'leaf', blades: 22, spread: 0.18, tall: 1, seed: 5 }, { kind: 'leaf', blades: 16, spread: 0.16, tall: 1, seed: 6, mixed: true },
  { kind: 'flower', seed: 7, mix: [['Marguerite', 10], ['Carthusian Pink', 4]] }, { kind: 'flower', seed: 8, mix: [['Red Clover', 3], ['Marguerite', 6], ['Dandelion', 3]] }, { kind: 'flower', seed: 9, mix: [['Dandelion', 8], ['Marguerite', 4]] },
];
const rand = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

function bladeGroup(prototypes, layer, templates, cell, rng) {
  const group = new THREE.Group(); const stride = 9; const count = Math.floor(templates.length / stride); const record = new Float32Array(stride); const m = new THREE.Matrix4(); const disposables = [];
  const byVariant = new Map();
  for (let b = 0; b < cell.blades; b += 1) {
    const t = Math.floor(rng() * count) * stride; for (let k = 0; k < stride; k += 1) record[k] = templates[t + k];
    const angle = rng() * Math.PI * 2, r = cell.spread * Math.sqrt(rng()); record[0] = Math.cos(angle) * r; record[1] = -Math.sin(angle) * r; record[2] = 0; record[3] = rng() * Math.PI * 2; record[5] *= cell.tall * (0.75 + 0.5 * rng()); record[8] *= CARD.bladeWidth; // a little wider so thin blades survive the smaller texture levels
    const variant = record[7]; if (!byVariant.has(variant)) byVariant.set(variant, []); byVariant.get(variant).push({ m: grassMatrix(record, 0, new THREE.Matrix4(), record[8]).clone(), tone: 0.78 + 0.34 * rng() });
  }
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }); disposables.push(material);
  for (const [variant, list] of byVariant) {
    const source = prototypes.get(`${layer}:${variant}`); if (!source) continue; const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld); disposables.push(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, list.length); const color = new THREE.Color();
    list.forEach((entry, i) => { m.copy(entry.m); mesh.setMatrixAt(i, m); mesh.setColorAt(i, color.setScalar(entry.tone)); }); mesh.frustumCulled = false; group.add(mesh); disposables.push(mesh);
  }
  return { group, disposables };
}

function flowerGroup(flowerScene, cell, rng) {
  const group = new THREE.Group(); const disposables = []; const sources = new Map();
  flowerScene.updateMatrixWorld(true);
  flowerScene.traverse((source) => { if (!source.isMesh) return; const species = inheritedMetadata(source, 'species'); const lod = inheritedMetadata(source, 'lod') ?? 0; const key = `${species}|${lod}`; if (!sources.has(key)) sources.set(key, []); sources.get(key).push(source); });
  const pick = (species) => sources.get(`${species}|1`) ?? sources.get(`${species}|0`) ?? sources.get(`${species}|2`);
  const basic = (original) => { const m = new THREE.MeshBasicMaterial({ map: original.map ?? null, color: original.color?.clone() ?? new THREE.Color('#fff'), alphaTest: 0.3, side: THREE.DoubleSide }); disposables.push(m); return m; };
  let index = 0;
  for (const [species, number] of cell.mix) {
    const parts = pick(species); if (!parts) continue;
    for (let n = 0; n < number; n += 1, index += 1) {
      const angle = rng() * Math.PI * 2, r = 0.24 * Math.sqrt(rng()); const placed = new THREE.Group(); placed.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r); placed.rotation.y = rng() * Math.PI * 2;
      const box = new THREE.Box3(); for (const source of parts) box.expandByObject(source); const size = box.getSize(new THREE.Vector3()); const target = (species === 'Red Clover' ? 0.46 : species === 'Dandelion' ? 0.28 : 0.38) * (0.8 + 0.4 * rng());
      const scale = target / Math.max(size.y, 1e-3); placed.scale.setScalar(scale);
      for (const source of parts) {
        const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld).translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); disposables.push(geometry);
        const material = Array.isArray(source.material) ? source.material.map(basic) : basic(source.material); const mesh = new THREE.Mesh(geometry, material); placed.add(mesh);
      }
      group.add(placed);
    }
  }
  return { group, disposables };
}

// Returns one texture per CELLS entry (linear half-float RGBA with mipmaps) and a dispose function.
export function bakeTuftAtlas(renderer, { prototypes, flowerScene, grassTemplates, basalTemplates, kinds = null }) {
  const camera = new THREE.OrthographicCamera(-CARD.width / 2, CARD.width / 2, CARD.height, 0, 0.1, 20); camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);
  const textures = []; const targets = []; const toDispose = [];
  const previousTarget = renderer.getRenderTarget(); const previousColor = renderer.getClearColor(new THREE.Color()); const previousAlpha = renderer.getClearAlpha(); const previousAuto = renderer.autoClear;
  renderer.autoClear = true; renderer.setClearColor(new THREE.Color(0.2, 0.33, 0.09), 0); // transparent, tinted green so mip levels never bleed black into the edges
  for (const cell of CELLS) {
    if (kinds && !kinds.includes(cell.kind)) { textures.push(null); continue; } // not needed: keep the indices aligned with CELLS
    const rng = rand(cell.seed * 7919); const scene = new THREE.Scene();
    let built;
    if (cell.kind === 'grass') built = bladeGroup(prototypes, 0, grassTemplates, cell, rng);
    else if (cell.kind === 'leaf') { built = bladeGroup(prototypes, 1, basalTemplates, cell, rng); if (cell.mixed) { const extra = bladeGroup(prototypes, 0, grassTemplates, { ...cell, blades: 10, tall: 0.55 }, rng); built.group.add(extra.group); built.disposables.push(...extra.disposables); } }
    else built = flowerGroup(flowerScene, cell, rng);
    scene.add(built.group); toDispose.push(...built.disposables);
    const target = new THREE.WebGLRenderTarget(CARD.size, CARD.size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    target.texture.anisotropy = 8; renderer.setRenderTarget(target); renderer.render(scene, camera); targets.push(target); textures.push(target.texture);
  }
  renderer.setRenderTarget(previousTarget); renderer.setClearColor(previousColor, previousAlpha); renderer.autoClear = previousAuto;
  if (typeof window !== 'undefined') window.__tuftDebug = { renderer, targets }; // lets a diagnostic script dump the baked cards
  return { textures, targets, dispose: () => { targets.forEach((t) => t.dispose()); toDispose.forEach((d) => d.dispose?.()); } };
}

// Two crossed upright quads, base at y = 0, height 1 (so the grass shader's leaf-height gradient works on it), width CARD.width / CARD.height of a unit.
export function cardGeometry(up = false) {
  const w = CARD.width / CARD.height; const positions = [], uvs = [], normals = [], indices = [];
  [0, Math.PI / 2].forEach((yaw, q) => {
    const c = Math.cos(yaw) * w / 2, s = Math.sin(yaw) * w / 2; const base = q * 4;
    positions.push(-c, 0, s, c, 0, -s, c, 1, -s, -c, 1, s); uvs.push(0, 0, 1, 0, 1, 1, 0, 1); for (let i = 0; i < 4; i += 1) { if (up) normals.push(0, 1, 0); else normals.push(0, 0.85, 0.5); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.setIndex(indices); return g;
}

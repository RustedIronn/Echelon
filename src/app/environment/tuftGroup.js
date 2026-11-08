import * as THREE from 'three';
import { applyBlenderDisplay } from './alpineParityMaterials.js';
import { bakeTuftAtlas, cardGeometry, CELLS } from './tuftBake.js';
import { buildTufts, TUFTS } from './tufts.js';
import { bankLowering } from './bankLowering.js';
import { occupancyMap } from './meadowSynthesis.js';

// Builds the tuft cards group: bakes the cards from the real blades and flowers, places them, and returns one instanced mesh per card kind.
export function placeMeadow({ palette, grassTemplates, field, clearing }) {
  const bank = bankLowering.current;
  return buildTufts(field, { palette, occupied: occupancyMap(grassTemplates), exclude: (x, z) => Boolean(clearing && clearing.softness(x, z) < 0.7) || Boolean(bank?.nearWater(x, z, 3.5)), groundOffset: (x, z, y) => (bank ? bank.offsetAt(x, z, y) : 0) });
}

// Splits the flower cells (6-8) of a placement at a distance: nearer flowers become real models, farther ones small baked cards.
export function splitFlowers(placed, metres) {
  const [cx, cz] = TUFTS.camera; const empty = () => ({ counts: placed.counts.map(() => 0), matrices: placed.matrices.map(() => new Float32Array(0)), colors: placed.colors.map(() => new Float32Array(0)) });
  const near = empty(), far = empty();
  for (const cell of [6, 7, 8]) {
    const m = placed.matrices[cell], c = placed.colors[cell]; const parts = { near: { m: [], c: [] }, far: { m: [], c: [] } };
    for (let k = 0; k < placed.counts[cell]; k += 1) { const o = k * 16; const target = Math.hypot(m[o + 12] - cx, m[o + 14] - cz) < metres ? parts.near : parts.far; for (let j = 0; j < 16; j += 1) target.m.push(m[o + j]); target.c.push(c[k * 3], c[k * 3 + 1], c[k * 3 + 2]); }
    for (const [name, out] of [['near', near], ['far', far]]) { out.counts[cell] = parts[name].m.length / 16; out.matrices[cell] = Float32Array.from(parts[name].m); out.colors[cell] = Float32Array.from(parts[name].c); }
  }
  return { near, far };
}

export function buildTuftGroup({ renderer, prototypes, flowerScene, grassTemplates, basalTemplates, palette, field, clearing, resources, refinement, corridor, kinds = null, placed: given = null }) {
  const atlas = bakeTuftAtlas(renderer, { prototypes, flowerScene, grassTemplates, basalTemplates, kinds });
  const bank = bankLowering.current;
  const placed = given ?? buildTufts(field, { palette, occupied: occupancyMap(grassTemplates), exclude: (x, z) => Boolean(clearing && clearing.softness(x, z) < 0.7) || Boolean(bank?.nearWater(x, z, 3.5)), groundOffset: (x, z, y) => (bank ? bank.offsetAt(x, z, y) : 0) });
  const group = new THREE.Group(); group.name = 'Tuft cards'; const geometry = cardGeometry(); const flowerGeometry = cardGeometry(true); const materials = []; const matrix = new THREE.Matrix4(); const color = new THREE.Color();
  CELLS.forEach((cell, i) => {
    if (!placed.counts[i] || !atlas.textures[i]) return;
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map: atlas.textures[i], alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
    material.alphaToCoverage = true; applyBlenderDisplay(material, resources);
    if (cell.kind !== 'flower') { // a light base-to-tip shading of the whole tuft; the foreground's stronger per-blade shading would make a small card read as a dark clump
      const previous = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= mix(0.8, 1.08, smoothstep(0.0, 0.55, vMapUv.y));`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= mix(0.78, 1.0, smoothstep(0.0, 0.5, vMapUv.y));`);
      };
      material.customProgramCacheKey = () => 'echelon-tuft-card-1';
    }
    material.userData.lookRole = cell.kind === 'flower' ? 'flowers' : 'grassFar'; material.userData.baseColor = material.color.clone(); materials.push(material);
    const mesh = new THREE.InstancedMesh(cell.kind === 'flower' ? flowerGeometry : geometry, material, placed.counts[i]); mesh.name = `Tuft cards / ${cell.kind} ${i}`;
    for (let k = 0; k < placed.counts[i]; k += 1) { matrix.fromArray(placed.matrices[i], k * 16); mesh.setMatrixAt(k, matrix); mesh.setColorAt(k, color.fromArray(placed.colors[i], k * 3)); }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
  });
  return { group, counts: placed.counts, dispose: () => { atlas.dispose(); geometry.dispose(); flowerGeometry.dispose(); materials.forEach((m) => m.dispose()); group.children.forEach((o) => o.dispose?.()); } };
}

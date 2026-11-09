import * as THREE from 'three';
import { SKY_UNIFORMS } from './skyShader.js';
import { FLOWER_LIGHT } from './leafLight.js';

// Flowers that behave like flowers: ox-eye daisies and dandelions fold their petals up into a bud at dusk and open again after sunrise, and
// every flower head leans a little toward the sun. Done in the vertex shader on the delivered models, so no new geometry. The time of day
// drives FLOWER_LIGHT (timeOfDay.js). ?flowerclock=off leaves them as they were.
export const FLOWER_CLOCK = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('flowerclock') !== 'off';
export const CLOSING_SPECIES = new Set(['Marguerite', 'Dandelion']);
const HEAD = { Marguerite: 0.1, Dandelion: 0.12, 'Carthusian Pink': 0.075 }; // head radius as a share of the plant's height

// The head of a species, from its model (any level of detail): top height, head radius, and the head's axis (local x, z).
export function flowerHeadInfo(scene, species, match) { // match(mesh): the meshes of this species at the level of detail in use
  const box = new THREE.Box3(); const v = new THREE.Vector3(); scene.updateMatrixWorld(true); const meshes = [];
  scene.traverse((o) => { if (o.isMesh && match(o)) { meshes.push(o); box.union(new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld)); } });
  if (box.isEmpty()) return null;
  const top = box.max.y, head = (box.max.y - box.min.y) * (HEAD[species] ?? 0.1); let sx = 0, sz = 0, n = 0;
  for (const o of meshes) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 1) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y > top - head * 1.5) { sx += v.x; sz += v.z; n += 1; } } }
  return { top, head, cx: n ? sx / n : 0, cz: n ? sz / n : 0 };
}

// The delivered models are clumps: several flowers at different heights in one mesh. So each vertex is given its own head's centre (aHead.xyz;
// aHead.w = 1 on petals and head discs, 0 on stems and leaves): the mesh is split into connected pieces, and pieces lying close together near a
// piece's top (petals round a disc) are grouped into heads. Stems and leaves are long or low, so they never join a head.
export function tagFlowerHeads(geometry, info) {
  if (!info || geometry.attributes.aHead) return geometry;
  const p = geometry.attributes.position, n = p.count, index = geometry.index; const parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }; const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  if (index) for (let t = 0; t < index.count; t += 3) { join(index.getX(t), index.getX(t + 1)); join(index.getX(t), index.getX(t + 2)); }
  else for (let t = 0; t < n; t += 3) { join(t, t + 1); join(t, t + 2); }
  const pieces = new Map(); // root -> bounds
  for (let i = 0; i < n; i += 1) { const r = find(i); let b = pieces.get(r); if (!b) { b = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; pieces.set(r, b); } const v = [p.getX(i), p.getY(i), p.getZ(i)]; for (let k = 0; k < 3; k += 1) { b.min[k] = Math.min(b.min[k], v[k]); b.max[k] = Math.max(b.max[k], v[k]); } }
  const R = info.head; const heads = [];
  for (const [root, b] of pieces) {
    const h = b.max[1] - b.min[1], w = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
    const flat = h < R * 1.6 && w < R * 3.2 && b.max[1] > info.top * 0.35; // petal or disc sized, held up off the ground
    if (!flat) { b.head = -1; continue; }
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    let g = heads.findIndex((hd) => Math.hypot(hd.c[0] - c[0], hd.c[2] - c[2]) < R * 1.4 && Math.abs(hd.c[1] - c[1]) < R);
    if (g < 0) { heads.push({ c: [...c], sum: [...c], n: 1 }); g = heads.length - 1; } else { const hd = heads[g]; for (let k = 0; k < 3; k += 1) hd.sum[k] += c[k]; hd.n += 1; for (let k = 0; k < 3; k += 1) hd.c[k] = hd.sum[k] / hd.n; }
    b.head = g;
  }
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i += 1) { const b = pieces.get(find(i)); if (b.head >= 0) { const c = heads[b.head].c; a[i * 4] = c[0]; a[i * 4 + 1] = c[1]; a[i * 4 + 2] = c[2]; a[i * 4 + 3] = heads[b.head].n > 1 ? 1 : 0; } }
  geometry.setAttribute('aHead', new THREE.BufferAttribute(a, 4)); return geometry;
}

export function applyFlowerBehaviour(material, species, info) {
  if (!FLOWER_CLOCK || !info) return material;
  const closes = CLOSING_SPECIES.has(species); const f = (x) => x.toFixed(4);
  const previous = material.onBeforeCompile; const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms.uFlowerClose = FLOWER_LIGHT.close; shader.uniforms.uFlowerLean = FLOWER_LIGHT.lean; shader.uniforms.uFlowerSun = SKY_UNIFORMS.uSunDir;
    shader.vertexShader = `uniform float uFlowerClose; uniform float uFlowerLean; uniform vec3 uFlowerSun;${closes ? ' attribute vec4 aHead;' : ''}\n` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
{
${closes ? `  vec2 off = transformed.xz - aHead.xz; float c = uFlowerClose * aHead.w;
  transformed.xz = aHead.xz + off * (1.0 - 0.6 * c); transformed.y += c * length(off) * 0.8; /* each head's petals fold up round its own centre: a closed bud */` : ''}
  vec3 ls = transpose(mat3(instanceMatrix)) * uFlowerSun; float lh = length(ls.xz); float hk = clamp(transformed.y / ${f(info.top)}, 0.0, 1.0);
  if (lh > 1e-4) transformed.xz += ls.xz / lh * uFlowerLean * ${f(info.top * 0.1)} * hk * hk * smoothstep(0.0, 0.3, lh); /* the stem bends a little toward the sun */
}
#endif`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : ''}-clock-${species}-${closes ? 1 : 0}`;
  material.needsUpdate = true; return material;
}

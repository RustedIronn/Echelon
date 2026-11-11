import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyValleyLook, LOOK } from './look.js';

// The near meadow from real, scanned plants (references 1, 2, 9, 21, 28, 29: soft, dense, feathery, flowers in drifts): Poly Haven's
// grass_medium_01 and _02 clumps (CC0) close in, and the old scene's real flower models (Carthusian pink, dandelion, ox-eye daisy, red
// clover) in drifts by ground. Each clump or flower is instanced per mesh, kept in its own scanned colours and textures, lit by the valley
// and swaying in the wind. The procedural blades and painted cards take over further out.
const GRASS = ['/design-reference/world-redesign/models/ph/grass_medium_01/grass_medium_01.gltf', '/design-reference/world-redesign/models/ph/grass_medium_02/grass_medium_02.gltf'];
const FLOWERS = '/assets/environment/alpine-prototype/flowers.glb';

// each mesh normalised to stand on the origin; parts that belong together (a flower's stem, leaves and head) share one offset
function partsOf(root) {
  root.updateMatrixWorld(true); const groups = new Map();
  root.traverse((o) => { if (!o.isMesh) return; let top = o; while (top.parent && top.parent !== root && top.parent.parent) top = top.parent; if (!groups.has(top)) groups.set(top, []); groups.get(top).push(o); });
  return [...groups.values()].map((meshes) => { const box = new THREE.Box3(); meshes.forEach((m) => box.expandByObject(m)); const off = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    return { height: box.max.y - box.min.y, parts: meshes.map((m) => ({ geometry: m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(off, m.matrixWorld)), material: m.material })) }; });
}

function plantMaterial(src, { glow = 1.0, sway = 0.08, alphaMap = null } = {}) {
  const m = new THREE.MeshLambertMaterial({ map: src.map ?? null, alphaMap, normalMap: null, /* the scan normal maps on two-sided cards turn them black against the light */ color: src.color ?? new THREE.Color(1, 1, 1), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, vertexColors: false });
  applyValleyLook(m, { glow }); const look = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { sh.uniforms.uTime = LOOK.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec3 wb = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float gust = 0.5 + 0.5 * sin(uTime * 0.6 + wb.x * 0.05 + wb.z * 0.03);
  float s = (sin(uTime * 1.9 + wb.x * 0.7 + wb.z * 0.4) * 0.6 + sin(uTime * 3.1 + wb.z * 1.3) * 0.25) * (0.35 + 0.65 * gust); float k = position.y * position.y;
  transformed.x += s * ${sway.toFixed(3)} * k * 10.0; transformed.z += s * ${(sway * 0.45).toFixed(3)} * k * 10.0; }`); look(sh, r); };
  m.customProgramCacheKey = () => `valley-plant-${glow}-${sway}`; return m;
}

function instance(group, kinds, sites, name) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  kinds.forEach((kind, ki) => { const mine = sites.filter((s) => s.kind === ki); if (!mine.length) return;
    for (const part of kind.parts) { const mesh = new THREE.InstancedMesh(part.geometry, part.mat, mine.length);
      mine.forEach((s, i) => { q.setFromAxisAngle(up, s.yaw); m.compose(new THREE.Vector3(s.x, s.y - 0.02, s.z), q, new THREE.Vector3(s.scale, s.scale * s.stretch, s.scale)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.setRGB(s.tint[0], s.tint[1], s.tint[2])); });
      mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.name = name; group.add(mesh); } });
}

// ground: { at(x,z), skip(x,z), zone(x,z) }; from the frame's edge to `to` metres, in the view
export async function buildMeadow(ground, { from = 9, to = 40, camera = [0, 0] } = {}) {
  const loader = new GLTFLoader(); const group = new THREE.Group(); group.name = 'scanned meadow';
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const [g1, g2, fl] = await Promise.all([...GRASS.map((u) => loader.loadAsync(u)), loader.loadAsync(FLOWERS)]);
  // the scans keep their cut-out in a separate alpha map (the 2K colour maps are JPEG, without alpha)
  const tl = new THREE.TextureLoader(); const alpha = (id) => { const t = tl.load(`/design-reference/world-redesign/models/ph/${id}/textures/${id}_alpha_2k.jpg`); t.flipY = false; return t; };
  const a1 = alpha('grass_medium_01'), a2 = alpha('grass_medium_02'); const mats = new Map();
  const grassMat = (p, a) => { if (!mats.has(p.material)) mats.set(p.material, plantMaterial(p.material, { glow: 1.0, sway: 0.08, alphaMap: a })); return mats.get(p.material); };
  const grassKinds = [...partsOf(g1.scene).map((k) => ({ ...k, a: a1 })), ...partsOf(g2.scene).map((k) => ({ ...k, a: a2 }))].map((k) => ({ ...k, parts: k.parts.map((p) => ({ geometry: p.geometry, mat: grassMat(p, k.a) })) }));
  const flowerKinds = partsOf(fl.scene).map((k) => ({ ...k, parts: k.parts.filter((p) => !/LEAF/i.test(p.material?.name ?? '')).map((p) => ({ /* leaves stay hidden in the sward; their dark material read black against the light */ geometry: p.geometry, mat: plantMaterial(p.material, { glow: 0.6, sway: 0.05 }) })) }));
  const grass = [], flowers = [];
  for (let r = from; r < to; ) { const step = 0.36 + 0.011 * r; const da = (step / r) * (180 / Math.PI);
    for (let az = -40; az <= 40; az += da) { const ja = az + (hash(az, r) - 0.5) * da, jr = r + (hash(r, az) - 0.5) * step; const a = ja * Math.PI / 180; const x = camera[0] + Math.sin(a) * jr, z = camera[1] - Math.cos(a) * jr;
      if (ground.skip(x, z)) continue; const y = ground.at(x, z), t = hash(x * 1.7, z * 2.3);
      const sc = (1.6 + 0.9 * t) * (1 + 0.004 * r); grass.push({ x, y, z, kind: Math.floor(hash(x, z) * grassKinds.length) % grassKinds.length, scale: sc, stretch: 0.9 + 0.5 * hash(z, x), yaw: t * 6.28, tint: [0.9 + 0.15 * t, 0.95 + 0.1 * hash(x, 3), 0.85 + 0.15 * hash(z, 5)] });
      // flowers in drifts: the drift pattern (about 10 m) decides where, the ground decides which
      const drift = hash(Math.floor(x / 9), Math.floor(z / 9)), zone = ground.zone(x, z);
      if (hash(x * 3.1, z * 1.3) < 0.22 * drift) { const kind = zone === 'wet' ? (drift > 0.6 ? 1 : 3) : zone === 'dry' ? (drift > 0.5 ? 2 : 0) : [2, 3, 0, 1, 2][Math.floor(drift * 5)];
        flowers.push({ x: x + (hash(x, 9) - 0.5) * step, y, z: z + (hash(z, 9) - 0.5) * step, kind: kind % flowerKinds.length, scale: 0.85 + 0.45 * hash(x, z * 2), stretch: 1, yaw: hash(z, x * 2) * 6.28, tint: [1, 1, 1] }); } }
    r += step; }
  instance(group, grassKinds, grass, 'meadow scanned grass'); instance(group, flowerKinds, flowers, 'meadow flowers');
  group.userData.counts = { grass: grass.length, flowers: flowers.length }; return group;
}

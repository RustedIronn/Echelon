import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyValleyLook } from './look.js';

// Scanned rocks (Poly Haven, CC0): mossy river and meadow stones (rock_moss_set_01, _02) and two large boulders (boulder_01,
// namaqualand_boulder_03), each in its own colour, normal and occlusion maps. Placed with purpose (blockout.js rockSites): clusters on the
// outside of the river's bends and a bar of cobbles on the inside, one boulder standing in the lake's shallows, a group at the shore, a few
// erratics out in the meadow and one by the footpath, all half sunk into the ground as stones are.
const ROOT = '/design-reference/world-redesign/models/ph/';
const SETS = { moss: ['rock_moss_set_01', 'rock_moss_set_02'], boulder: ['boulder_01', 'namaqualand_boulder_03'] };
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

function kindsOf(root) {
  root.updateMatrixWorld(true); const out = [];
  root.traverse((o) => { if (!o.isMesh) return; const geo = o.geometry.clone().applyMatrix4(o.matrixWorld); geo.computeBoundingBox(); const b = geo.boundingBox; geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    const src = o.material; const m = new THREE.MeshLambertMaterial({ map: src.map, normalMap: src.normalMap, aoMap: src.aoMap ?? null, color: src.color ?? 0xffffff }); applyValleyLook(m, {});
    out.push({ geometry: geo, material: m, size: Math.max(b.max.x - b.min.x, b.max.z - b.min.z), height: b.max.y - b.min.y }); });
  return out;
}

// sites: [{ x, y, z, size (metres across), set: 'moss' | 'boulder', sink (fraction of the height below ground) }]
export async function buildRocks(sites) {
  const loader = new GLTFLoader(); const group = new THREE.Group(); group.name = 'scanned rocks';
  const loaded = {}; for (const [set, ids] of Object.entries(SETS)) loaded[set] = (await Promise.all(ids.map((id) => loader.loadAsync(`${ROOT}${id}/${id}.gltf`)))).flatMap((g) => kindsOf(g.scene));
  const per = new Map(); sites.forEach((s, i) => { const kinds = loaded[s.set]; const k = kinds[Math.floor(hash(i, s.x) * kinds.length) % kinds.length]; if (!per.has(k)) per.set(k, []); per.get(k).push(s); });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [k, list] of per) { const mesh = new THREE.InstancedMesh(k.geometry, k.material, list.length);
    list.forEach((s, i) => { const sc = s.size / k.size; e.set((hash(i, s.z) - 0.5) * 0.25, hash(s.x, i) * 6.283, (hash(s.z, i) - 0.5) * 0.25); q.setFromEuler(e); m.compose(new THREE.Vector3(s.x, s.y - k.height * sc * (s.sink ?? 0.25), s.z), q, new THREE.Vector3(sc, sc * (0.85 + 0.3 * hash(i, 7)), sc)); mesh.setMatrixAt(i, m); });
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh); }
  group.userData.count = sites.length; return group;
}

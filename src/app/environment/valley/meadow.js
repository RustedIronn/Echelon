import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyValleyLook, LOOK } from './look.js';

// The meadow from real, scanned plants (references 1, 2, 9, 21, 23, 28, 29: soft, dense, feathery, flowers in drifts): Poly Haven's
// grass_medium_01 and _02 clumps (CC0) and the old scene's real flower models (Carthusian pink, dandelion, ox-eye daisy, red clover).
// Near the frame's bottom edge (the camera's knoll hides the ground closer than about 37 m) the clumps stand as real geometry, packed into
// a full sward. Further out the same scans are baked, side on, into strips of meadow (as the trees are baked into impostors) and stood up
// as crossed cards: the same grass and flowers, cheap enough to cover the valley floor out to 680 m.
const ROOT = '/design-reference/world-redesign/models/ph/';
const GRASS = ['grass_medium_01', 'grass_medium_02'];
const FLOWERS = '/assets/environment/alpine-prototype/flowers.glb';
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

// each mesh normalised to stand on the origin; parts that belong together (a flower's stem, leaves and head) share one offset
function partsOf(root) {
  root.updateMatrixWorld(true); const groups = new Map();
  root.traverse((o) => { if (!o.isMesh) return; let top = o; while (top.parent && top.parent !== root && top.parent.parent) top = top.parent; if (!groups.has(top)) groups.set(top, []); groups.get(top).push(o); });
  return [...groups.values()].map((meshes) => { const box = new THREE.Box3(); meshes.forEach((m) => box.expandByObject(m)); const off = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    return { height: box.max.y - box.min.y, width: Math.max(box.max.x - box.min.x, box.max.z - box.min.z), parts: meshes.map((m) => ({ geometry: m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(off, m.matrixWorld)), material: m.material })) }; });
}
const tris = (k) => k.parts.reduce((s, p) => s + (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3, 0);

// lit as a sward: normals lean toward the sky (upright cards lit by their own normals read as dark sticks); sways in the wind
function plantMaterial({ map = null, alphaMap = null, color = null, glow = 1.0, sway = 0.08, up = 0.7, alphaTest = 0.5 } = {}) {
  const m = new THREE.MeshLambertMaterial({ map, alphaMap, color: color ?? new THREE.Color(1, 1, 1), alphaTest, alphaToCoverage: true, side: THREE.DoubleSide });
  applyValleyLook(m, { glow }); const look = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { sh.uniforms.uTime = LOOK.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec3 wb = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float gust = 0.5 + 0.5 * sin(uTime * 0.6 + wb.x * 0.05 + wb.z * 0.03);
  float s = (sin(uTime * 1.9 + wb.x * 0.7 + wb.z * 0.4) * 0.6 + sin(uTime * 3.1 + wb.z * 1.3) * 0.25) * (0.35 + 0.65 * gust); float k = position.y * position.y;
  transformed.x += s * ${sway.toFixed(3)} * k * 10.0; transformed.z += s * ${(sway * 0.45).toFixed(3)} * k * 10.0; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), ${up.toFixed(2)}));`).replace('#include <alphatest_fragment>', `
  // thin blades average away in the smaller mip levels and the clumps thin out with distance; restore their coverage by the mip level
  { vec2 auv = vec2(0.0); float asz = 2048.0;
#if defined(USE_ALPHAMAP)
    auv = vAlphaMapUv;
#elif defined(USE_MAP)
    auv = vMapUv; asz = 1024.0;
#endif
    vec2 adx = dFdx(auv * asz), ady = dFdy(auv * asz); float mip = max(0.0, 0.5 * log2(max(dot(adx, adx), dot(ady, ady)))); diffuseColor.a *= 1.0 + mip * 0.32; }
#include <alphatest_fragment>`); look(sh, r); };
  m.customProgramCacheKey = () => `valley-plant-${glow}-${sway}-${up}`; return m;
}

function instance(group, kinds, sites, name) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  kinds.forEach((kind, ki) => { const mine = sites.filter((s) => s.kind === ki); if (!mine.length) return;
    for (const part of kind.parts) { const mesh = new THREE.InstancedMesh(part.geometry, part.mat, mine.length);
      mine.forEach((s, i) => { q.setFromAxisAngle(up, s.yaw); m.compose(new THREE.Vector3(s.x, s.y - 0.03, s.z), q, new THREE.Vector3(s.scale, s.scale * s.stretch, s.scale)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.setRGB(s.tint[0], s.tint[1], s.tint[2])); });
      mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.name = name; group.add(mesh); } });
}

// A strip of meadow, 1 unit wide and 0.56 tall, seen side on: rows of scanned clumps, the back rows a little darker (the sward's depth),
// with flowers of the given kinds standing among them. Baked once into a colour texture with alpha.
function bakeStrip(renderer, grassKinds, flowerKinds, flowerSet, seed) {
  const W = 1024, H = 576; const scene = new THREE.Scene(); const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.56, 0, -5, 5); cam.position.set(0, 0, 2); cam.lookAt(0, 0, 0);
  const basic = new Map(); const mat = (p, shade) => { const key = p.material.uuid + shade.toFixed(2); if (!basic.has(key)) basic.set(key, new THREE.MeshBasicMaterial({ map: p.material.map, alphaMap: p.material.alphaMap ?? null, color: (p.material.color ?? new THREE.Color(1, 1, 1)).clone().multiplyScalar(shade), alphaTest: 0.5, side: THREE.DoubleSide })); return basic.get(key); };
  const add = (kind, x, z, s, yaw, shade) => { for (const p of kind.parts) { const o = new THREE.Mesh(p.geometry, mat(p, shade)); o.position.set(x, 0, z); o.rotation.y = yaw; o.scale.setScalar(s); scene.add(o); } };
  const tallCount = 70;
  const tall = grassKinds.filter((k) => k.height > 0.12), fresh = tall.filter((k) => k.fresh), old = tall.filter((k) => !k.fresh);
  for (let i = 0; i < 70; i += 1) { const z = -0.4 + 0.8 * (i / 70); const x = -0.6 + 1.2 * hash(i, seed); const set = hash(i * 7.7, seed) < 0.86 ? fresh : old; /* a summer hay meadow is mostly green; the dry blades are the minority */ const k = set[Math.floor(hash(seed, i) * set.length) % set.length];
    const s = Math.min(1.9 + 0.8 * hash(i * 3.3, seed), 0.54 / k.height); add(k, x, z, s, hash(i, seed * 2) * 6.28, Math.round((0.78 + 0.22 * (i / 70)) * 10) / 10); }
  const low = fresh.filter((k) => k.height < 0.25); for (let i = 0; i < 40; i += 1) { const k = low[i % low.length]; add(k, -0.55 + 1.1 * hash(i * 2.9, seed + 8), 0.1 + 0.3 * hash(i, seed + 9), 1.3 + 0.6 * hash(i, seed + 10), hash(i * 1.3, seed) * 6.28, 0.9); } /* a dense green base in front: the sward is thick at the foot, not bare straw */
  if (flowerSet.length) for (let i = 0; i < (flowerSet.length <= 3 ? 5 : 12); i += 1) { const k = flowerKinds[flowerSet[i % flowerSet.length]]; if (!k) continue; const s = Math.min(0.8 + 0.35 * hash(i, seed + 5), 0.52 / k.height, 1.15); /* a field in flower: the heads crowd the top of the sward */
    add(k, -0.5 + 1.0 * hash(i * 1.7, seed + 3), -0.35 + 0.7 * hash(i, seed + 4), s, hash(i, seed + 6) * 6.28, 1.0); }
  const rt = new THREE.WebGLRenderTarget(W, H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }); rt.texture.colorSpace = THREE.SRGBColorSpace; rt.texture.anisotropy = 8;
  const prev = { target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), tone: renderer.toneMapping };
  renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x2c3a1c, 0); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
  renderer.setRenderTarget(prev.target); renderer.setClearColor(prev.clear, prev.alpha); renderer.toneMapping = prev.tone; basic.forEach((m) => m.dispose());
  rt.texture.__rt = rt; return rt.texture;
}

// the far meadow: crossed cards of the baked strips. sites: [x, y, z, size, tone] per card (grass.js planGrass)
function buildCards(sites, textures) {
  const geo = new THREE.BufferGeometry(); const P = [], U = [], I = [];
  [[1, 0], [0, 1]].forEach(([dx, dz], k) => { const o = k * 4; P.push(-0.5 * dx, 0, -0.5 * dz, 0.5 * dx, 0, 0.5 * dz, 0.5 * dx, 0.56, 0.5 * dz, -0.5 * dx, 0.56, -0.5 * dz); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(o, o + 1, o + 2, o, o + 2, o + 3); });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I); geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(8).fill([0, 1, 0]).flat(), 3));
  const group = new THREE.Group(); const S = 7, n = sites.length / S; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  textures.forEach((tex, v) => { const mine = []; for (let i = 0; i < n; i += 1) if (sites[i * S + 6] === v) mine.push(i); if (!mine.length) return; /* the flower mixes in drifts */
    const mesh = new THREE.InstancedMesh(geo, plantMaterial({ map: tex, glow: 1.8, sway: 0.03, up: 1.0, alphaTest: 0.45 }), mine.length);
    mine.forEach((i, k) => { const [x, y, z, s, t, hf] = sites.slice(i * S, i * S + S); q.setFromAxisAngle(up, t * Math.PI); m.compose(new THREE.Vector3(x, y - 0.05 * s, z), q, new THREE.Vector3(s, Math.min(s, 1.4) * (0.6 + 0.75 * hash(z * 1.3, x * 0.7)) * hf, s) /* heights vary, so the tops never make a line */); mesh.setMatrixAt(k, m); mesh.setColorAt(k, c.setRGB(0.74 + 0.1 * t, 1.0 + 0.06 * t, 0.96 + 0.1 * t) /* true summer green, not olive */ /* seen from above, a sward shows its lit tips more than the side-on strip does */); });
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.name = 'meadow cards (baked scans)'; group.add(mesh); });
  return group;
}

// ground: { at(x,z), skip(x,z), zone(x,z) }; cardSites from planGrass
export async function buildMeadow(ground, renderer, { from = 9, to = 62, camera = [0, 0], cardSites = null, reeds = [] } = {}) {
  const loader = new GLTFLoader(); const tl = new THREE.TextureLoader(); const group = new THREE.Group(); group.name = 'scanned meadow';
  const alphaOf = async (id) => { const t = await tl.loadAsync(`${ROOT}${id}/textures/${id}_alpha_2k.jpg`); t.flipY = false; return t; }; // the scans keep their cut-out in a separate map
  const paddedOf = async (id) => { const t = await tl.loadAsync(`${ROOT}${id}/textures/${id}_diff_padded_2k.jpg`); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }; // the colour bled out under the cut-out (push-pull), so the mip levels keep the blades' own colour instead of the black behind them
  const [g1, g2, fl, a1, a2, d1, d2] = await Promise.all([...GRASS.map((id) => loader.loadAsync(`${ROOT}${id}/${id}.gltf`)), loader.loadAsync(FLOWERS), ...GRASS.map(alphaOf), ...GRASS.map(paddedOf)]);
  const mats = new Map(); const grassMat = (src, a) => { if (!mats.has(src)) mats.set(src, plantMaterial({ map: src.map, alphaMap: a, glow: 1.8, sway: 0.08 })); return mats.get(src); };
  const grassKinds = [...partsOf(g1.scene).map((k) => ({ ...k, a: a1, d: d1, fresh: true })), ...partsOf(g2.scene).map((k) => ({ ...k, a: a2, d: d2, fresh: false }))] /* 01 is the lush, dark-green scan; 02 pale and part dry */.map((k) => ({ ...k, parts: k.parts.map((p) => { p.material.alphaMap = k.a; p.material.map = k.d; return { geometry: p.geometry, material: p.material, mat: grassMat(p.material, k.a) }; }) }));
  const flowerKinds0 = partsOf(fl.scene).map((k) => ({ ...k, parts: k.parts.filter((p) => !/LEAF/i.test(p.material?.name ?? '')).map((p) => ({ /* leaves stay hidden in the sward */ geometry: p.geometry, material: p.material, mat: plantMaterial({ map: p.material.map, color: p.material.color, glow: 0.6, sway: 0.05, up: 0.5 }) })) }));
  // two more species from the same scans, tinted: violet meadow cranesbill (from the pink) and blue cornflower (from the daisy)
  const tintKind = (k, col) => ({ ...k, parts: k.parts.map((p) => { const m2 = p.material.clone(); m2.color = new THREE.Color(col); return { geometry: p.geometry, material: m2, mat: plantMaterial({ map: m2.map, color: m2.color, glow: 0.6, sway: 0.05, up: 0.5 }) }; }) });
  const flowerKinds = [...flowerKinds0, tintKind(flowerKinds0[0], '#b9a8ff'), tintKind(flowerKinds0[2], '#9db4ff')]; // 0 pink, 1 dandelion, 2 daisy, 3 clover, 4 cranesbill, 5 cornflower
  const vn = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz); const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1); return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz; };
  // the near sward: packed clumps (not the tiny tufts), every 0.42 m, 0.35-0.9 m tall
  const swardOf = (fresh) => grassKinds.map((k, i) => [i, k]).filter(([, k]) => k.height > 0.12 && tris(k) < 1700 && k.fresh === fresh).map(([i]) => i); const swF = swardOf(true), swO = swardOf(false);
  const grass = [], flowers = [];
  for (let r = from; r < to; ) { const step = 0.4; const da = (step / r) * (180 / Math.PI);
    for (let az = -40; az <= 40; az += da) { const ja = az + (hash(az, r) - 0.5) * da, jr = r + (hash(r, az) - 0.5) * step; const a = ja * Math.PI / 180; const x = camera[0] + Math.sin(a) * jr, z = camera[1] - Math.cos(a) * jr;
      if (ground.skip(x, z) || (jr > 50 && hash(x * 2.9, z * 3.7) < (jr - 50) / 12)) continue; /* the clumps thin out into the cards beyond, no seam */ const y = ground.at(x, z), t = hash(x * 1.7, z * 2.3); const sward = hash(x * 5.3, z * 4.1) < 0.84 ? swF : swO; const kind = sward[Math.floor(hash(x, z) * sward.length) % sward.length]; const k = grassKinds[kind];
      const pd = ground.path ? ground.path(x, z) : 99, moist = ground.moist ? ground.moist(x, z) : 0.5; const trod = 1 - Math.min(1, Math.max(0, (pd - 0.8) / 3.2)); /* 1 on the path's margin, 0 a few metres off */
      const patch = (0.8 + 0.4 * hash(Math.floor(x / 7), Math.floor(z / 7))) * (1 - 0.45 * trod) * (0.9 + 0.25 * moist); /* taller in the damp hollows, shorter on the trodden margin */
      grass.push({ x, y, z, kind, scale: Math.min(2.4 + 1.2 * t, (0.5 + 0.4 * hash(z, x)) * patch / k.height), stretch: 0.95 + 0.3 * hash(z, x), yaw: t * 6.28, tint: [0.8 + 0.1 * t, 1.1 + 0.09 * hash(x, 3), 0.86 + 0.1 * hash(z, 5)] }); /* measured against the cards beyond: one sward, no seam */ /* matched to the cards' tone, seen from the same height */
      // flowers as plant communities following the ground (a real alpine meadow, not a flower show): white daisies scattered everywhere,
      // thinly on the dry rises and thicker where it is richer; small irregular clusters where conditions suit - yellow buttercups and pink
      // bistort in the damp hollows, violet cranesbill and clover in the middle ground, blue harebells and daisies on the dry rises; few
      // flowers on the trodden margin of the path
      // a meadow in flower: every square metre has some, finely mixed - white daisies and yellow leading, violet, blue, clover and pink among
      // them; which leads drifts slowly across the field and with the damp, and the density swells and thins gently; thin by the path
      const keep = 1 - 0.9 * trod; const swell = 0.55 + 0.9 * vn(x / 9 + 2.2, z / 9); const lead = vn(x / 26 + 7, z / 26);
      const count = Math.floor(0.55 * swell * keep * (0.8 + 0.5 * moist) + hash(x * 3.1, z * 1.3));
      for (let f = 0; f < count; f += 1) { const u = hash(x * 1.9 + f * 7.3, z * 2.7); const wY = 0.18 + 0.25 * moist + 0.12 * lead, wV = 0.05 + 0.07 * (1 - lead), wB = 0.03 + 0.06 * (1 - moist) * lead, wC = 0.07, wP = 0.04;
        const fk = u < wY ? 1 : u < wY + wV ? 4 : u < wY + wV + wB ? 5 : u < wY + wV + wB + wC ? 3 : u < wY + wV + wB + wC + wP ? 0 : 2;
        flowers.push({ x: x + (hash(x + f, 9) - 0.5) * step * 1.4, y, z: z + (hash(z + f, 9) - 0.5) * step * 1.4, kind: fk, scale: (1.3 + 0.6 * hash(x + f, z * 2)) * (0.85 + 0.25 * moist) * (fk === 3 ? 0.45 : 1), stretch: 1, yaw: hash(z, x * 2 + f) * 6.28, tint: [1, 1, 1] }); } }
    r += step; }
  // sedge at the lake's edge: the tall scanned clumps drawn up into stands, darker and bluer green than the meadow
  const tallK = grassKinds.map((k, i) => [i, k]).filter(([, k]) => k.height > 0.22 && k.fresh).map(([i]) => i);
  reeds.forEach((s, i) => { const kind = tallK[i % tallK.length]; const k = grassKinds[kind]; for (let j = 0; j < 3; j += 1) grass.push({ x: s.x + (hash(i, j) - 0.5) * 1.4, y: s.y, z: s.z + (hash(j, i) - 0.5) * 1.4, kind, scale: (0.7 + 0.3 * hash(i, j + 5)) / k.height * 0.9, stretch: 1.7 + 0.5 * hash(i, j + 7), yaw: hash(i, j + 9) * 6.28, tint: [0.82, 0.98, 1.08] }); });
  instance(group, grassKinds, grass, 'meadow scanned grass'); instance(group, flowerKinds, flowers, 'meadow flowers');
  // the far meadow: four strips, plain grass and three flower mixes
  if (cardSites) { const strips = [[2, 2, 1], [2, 2, 1, 4, 2, 1, 3], [1, 1, 2, 2, 3, 0], [2, 4, 2, 5, 1, 2, 4], [2, 5, 2, 1, 2]].map((set, i) => bakeStrip(renderer, grassKinds, flowerKinds, set, 11 + i * 17)); group.add(buildCards(cardSites, strips)); group.userData.cards = cardSites.length / 7; window.__meadowStrips = strips; }
  group.userData.counts = { grass: grass.length, flowers: flowers.length }; return group;
}

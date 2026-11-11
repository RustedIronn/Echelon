import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyValleyLook } from './look.js';

// The valley's forests from the real spruce and larch (Georgeous, CC BY 4.0; design-reference/world-redesign/models/ATTRIBUTION.md).
// Tens of thousands of trees cannot each draw 10-12 thousand triangles, so every model is baked once into an impostor: its colour and its
// normals rendered from the side into two textures. Each tree is then one quad turned to face the camera, lit per pixel from the baked normals
// by the scene's sun, sky and bounce, and given the valley's air and edge glow (look.js). Trees closer than a few hundred metres will later
// get the full model; at block-out distances the impostor is indistinguishable.
const MODELS = { spruce: '/design-reference/world-redesign/models/spruce_tree.glb', larch: '/design-reference/world-redesign/models/larch_tree.glb' };

function normalise(root) { // a 1 m tree standing on the origin
  root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(root); const h = box.max.y - box.min.y; const s = 1 / h;
  const holder = new THREE.Group(); root.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s); root.scale.multiplyScalar(s); holder.add(root); holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder); return { holder, halfWidth: Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z) };
}

const NORMAL_PASS = new THREE.ShaderMaterial({
  uniforms: { map: { value: null } }, side: THREE.DoubleSide,
  vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D map; varying vec3 vN; varying vec2 vUv; void main(){ if (texture2D(map, vUv).a < 0.4) discard; vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); }',
});

// colour and tangent-space normals seen from the side (the quad faces the camera, so view space here is the quad's own frame)
function bake(renderer, model) {
  const { holder, halfWidth } = normalise(model); const W = 256, H = 512; const aspect = (halfWidth * 2) / 1;
  const cam = new THREE.OrthographicCamera(-halfWidth, halfWidth, 1.0, 0.0, -10, 10); cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0); cam.position.set(0, 0, 5);
  const scene = new THREE.Scene(); scene.add(holder);
  const colour = new THREE.WebGLRenderTarget(W, H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }); colour.texture.colorSpace = THREE.SRGBColorSpace;
  const normal = new THREE.WebGLRenderTarget(W, H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const originals = new Map(); holder.traverse((o) => { if (o.isMesh) originals.set(o, o.material); });
  const prev = { target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), tone: renderer.toneMapping };
  renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x000000, 0);
  for (const [o, m] of originals) { const src = Array.isArray(m) ? m[0] : m; o.material = new THREE.MeshBasicMaterial({ map: src.map, color: src.color, alphaTest: 0.4, side: THREE.DoubleSide }); }
  renderer.setRenderTarget(colour); renderer.clear(); renderer.render(scene, cam);
  for (const [o, m] of originals) { const src = Array.isArray(m) ? m[0] : m; const n = NORMAL_PASS.clone(); n.uniforms.map.value = src.map ?? new THREE.Texture(); o.material = n; }
  renderer.setRenderTarget(normal); renderer.clear(); renderer.render(scene, cam);
  renderer.setRenderTarget(prev.target); renderer.setClearColor(prev.clear, prev.alpha); renderer.toneMapping = prev.tone;
  return { colour: colour.texture, normal: normal.texture, aspect };
}

// one camera-facing quad per tree: turned about the vertical toward the camera, flipped at random so neighbours differ
function impostorMaterial(baked) {
  const m = new THREE.MeshLambertMaterial({ map: baked.colour, normalMap: baked.normal, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide });
  m.normalScale.set(1, 1);
  applyValleyLook(m, { glow: 0.9 });
  const look = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    // instanceMatrix is the tree's position and scale (x negative for a mirrored tree); the local vertex is chosen so that, once scaled, the
    // quad lies across the line of sight
    const face = 'vec3 vlBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec2 vlToCam = normalize(cameraPosition.xz - vlBase.xz + vec2(1e-4)); float vlFlip = sign(instanceMatrix[0][0]);';
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
{ ${face} objectNormal = vec3(vlToCam.x * vlFlip, 0.0, vlToCam.y); }`).replace('#include <begin_vertex>', `#include <begin_vertex>
{ ${face} vec3 right = vec3(vlToCam.y, 0.0, -vlToCam.x); transformed = vec3(right.x * position.x, position.y, right.z * position.x * vlFlip); }`);
    look(shader, renderer);
  };
  m.customProgramCacheKey = () => 'valley-impostor';
  return m;
}

// the impostor's shadow: the same card, turned toward the light (in the shadow pass the camera is the sun) and cut out by the crown's alpha
function impostorDepth(baked) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: baked.colour, alphaTest: 0.45, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => { shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec3 vlBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec2 vlToCam = normalize(cameraPosition.xz - vlBase.xz + vec2(1e-4)); float vlFlip = sign(instanceMatrix[0][0]);
  vec3 right = vec3(vlToCam.y, 0.0, -vlToCam.x); transformed = vec3(right.x * position.x, position.y, right.z * position.x * vlFlip); }`); };
  return m;
}
export async function buildForest(renderer, list, hero = null) { // list: x, y, z, larch(0|1), height, variant per tree
  const loader = new GLTFLoader(); const [spruce, larch] = await Promise.all([loader.loadAsync(MODELS.spruce), loader.loadAsync(MODELS.larch)]);
  const heroModel = hero ? spruce.scene.clone(true) : null; /* cloned before baking: the bake re-parents the model */
  const kinds = { 0: bake(renderer, spruce.scene), 1: bake(renderer, larch.scene) }; const group = new THREE.Group(); group.name = 'forest (impostors)';
  for (const kind of [0, 1]) {
    const mine = []; for (let i = 0; i < list.length; i += 6) if (list[i + 3] === kind) mine.push(i);
    if (!mine.length) continue; const b = kinds[kind]; const geo = new THREE.PlaneGeometry(b.aspect, 1); geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, impostorMaterial(b), mine.length); mesh.customDepthMaterial = impostorDepth(b); /* the shadow is the tree's silhouette seen from the sun */ const m = new THREE.Matrix4(); const c = new THREE.Color();
    mine.forEach((i, k) => { const h = list[i + 4], v = list[i + 5]; m.makeScale(h * 1.2 * (v < 0.5 ? -1 : 1), h, h); /* crowns a little wider: a forest reads as a closed canopy from afar */ m.setPosition(list[i], list[i + 1] - 0.4, list[i + 2]); mesh.setMatrixAt(k, m); mesh.setColorAt(k, c.setRGB(0.62, 0.8, 0.6).multiplyScalar(0.8 + 0.35 * v)); /* deeper, greener needles than the unlit scan */ });
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.name = `${kind ? 'larch' : 'spruce'} impostors (${mine.length})`; group.add(mesh);
  }
  // the lone hero tree in the meadow (a spruce: the summer larch reads pale and leafless at this distance): near enough to deserve the whole model, every branch lit and glowing into the light
  if (heroModel) { const { holder } = normalise(heroModel); holder.traverse((o) => { if (!o.isMesh) return; const src = Array.isArray(o.material) ? o.material[0] : o.material;
      o.material = applyValleyLook(new THREE.MeshLambertMaterial({ map: src.map, color: new THREE.Color(0.6, 0.78, 0.58), alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide }), { glow: 1.0 }); });
    holder.scale.set(hero.height * 1.3, hero.height, hero.height * 1.3); holder.position.set(hero.x, hero.y - 0.3, hero.z); holder.rotation.y = 1.3; holder.name = "hero spruce"; /* an old pasture spruce: broad, branched to the ground */ group.add(holder); }
  return group;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { authoredCamera, grassMatrix, inheritedMetadata } from '../src/app/environment/alpinePrototypeData.js';

const root = new URL('../', import.meta.url);
const delivery = JSON.parse(readFileSync(new URL('public/assets/environment/alpine-prototype/manifest.json', root), 'utf8'));
const source = JSON.parse(readFileSync(new URL('design-reference/environment/webgl-feasibility-audit/scene-audit.json', root), 'utf8'));
const cameraSystems = JSON.parse(readFileSync(new URL('design-reference/environment/webgl-feasibility-audit/camera-and-systems.json', root), 'utf8'));

test('delivery camera preserves the saved Blender projection at independent terrain landmarks', () => {
  const camera = authoredCamera(delivery, 2560 / 1440);
  const sourceWorld = new THREE.Matrix4().set(...source.camera.matrix_world.flat());
  const sourceProjection = new THREE.Matrix4().set(...cameraSystems.projection_matrix.flat());
  const sourceViewProjection = sourceProjection.multiply(sourceWorld.invert());
  for (const point of [[-12, 12, 1], [35, 125, 7], [0, 400, 70], [-100, 300, 25]]) {
    const blender = new THREE.Vector3(...point).applyMatrix4(sourceViewProjection);
    const runtime = new THREE.Vector3(point[0], point[2], -point[1]).project(camera);
    assert.ok(Math.abs(blender.x - runtime.x) < 1e-6, `horizontal mismatch at ${point}`);
    assert.ok(Math.abs(blender.y - runtime.y) < 1e-6, `vertical mismatch at ${point}`);
  }
});

test('grass roots and scales use the same Z-up to Y-up conversion as the terrain', () => {
  const record = Float32Array.from([4, 12, 2, Math.PI / 2, .3, .5, 0, 1]);
  const matrix = grassMatrix(record, 0);
  assert.deepEqual(new THREE.Vector3(0, 0, 0).applyMatrix4(matrix).toArray(), [4, 2, -12]);
  const up = new THREE.Vector3(0, 1, 0).applyMatrix4(matrix);
  assert.ok(Math.abs(up.y - 2.5) < 1e-6);
  const tip = new THREE.Vector3(1, 0, 0).applyMatrix4(matrix);
  assert.ok(Math.abs(tip.z + 12.3) < 1e-6);
});

test('delivery derives from the audited master and includes only the representative authoring region', () => {
  assert.equal(delivery.sourceSha256, source.sha256_after);
  assert.equal(delivery.statistics.masterUnchanged, true);
  assert.deepEqual(Object.keys(delivery.flowers).sort(), ['Carthusian Pink', 'Dandelion', 'Marguerite', 'Red Clover']);
  for (const records of Object.values(delivery.flowers)) {
    assert.ok(records.length > 0);
    for (const record of records) {
      assert.equal(record.length, 16);
      assert.ok(record.every(Number.isFinite));
      assert.ok(-record[14] < 110.001);
    }
  }
});

test('multi-material glTF primitives inherit their species and geography roles', () => {
  const group = new THREE.Group(); group.userData.species = 'Marguerite'; group.userData.echelonRole = 'tree';
  const primitive = new THREE.Mesh(); group.add(primitive);
  assert.equal(inheritedMetadata(primitive, 'species'), 'Marguerite');
  assert.equal(inheritedMetadata(primitive, 'echelonRole'), 'tree');
  primitive.userData.echelonRole = 'stone';
  assert.equal(inheritedMetadata(primitive, 'echelonRole'), 'stone');
});

const parity = JSON.parse(readFileSync(new URL('public/assets/environment/alpine-prototype/parity.json', root), 'utf8'));

test('parity grass preserves existing roots and measures blade width separately from its reach', () => {
  for (let layer = 0; layer < delivery.grass.length; layer += 1) {
    const old = delivery.grass[layer]; const next = parity.grass[layer];
    // Node Buffer offsets need explicit copying before interpreting typed records.
    const read = (file) => { const buffer = readFileSync(new URL(`public/assets/environment/alpine-prototype/${file}`, root)); return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4); };
    const a = read(old.file); const b = read(next.file);
    assert.equal(next.stride, 9);
    assert.ok(next.count > old.count);
    const roots = new Set();
    for (let i = 0; i < next.count; i += 1) {
      const offset = i * 9;
      roots.add(`${b[offset]},${b[offset + 1]},${b[offset + 2]}`);
      assert.ok(b[offset + 8] > 0 && Number.isFinite(b[offset + 8]));
    }
    for (let i = 0; i < old.count; i += 1) assert.ok(roots.has(`${a[i * 8]},${a[i * 8 + 1]},${a[i * 8 + 2]}`));
  }
  const sample = Float32Array.from([0, 0, 0, 0, .3, .5, 0, 0, .012]);
  const matrix = grassMatrix(sample, 0, new THREE.Matrix4(), sample[8]);
  assert.ok(Math.abs(new THREE.Vector3(0, 0, 1).applyMatrix4(matrix).length() - .012) < 1e-6);
});

test('depth and display derivatives are finite and tied to the unchanged authoring source', () => {
  assert.equal(parity.sourceSha256, delivery.sourceSha256);
  const surface = JSON.parse(readFileSync(new URL('design-reference/environment/webgl-prototype/surface-report.json', root), 'utf8'));
  assert.equal(surface.sourceSha256, parity.sourceSha256);
  assert.equal(surface.terrainAfter.triangles, delivery.statistics.terrainAfter.triangles);
  assert.equal(parity.masterUnchanged, true);
  const bytes = readFileSync(new URL(`public/assets/environment/alpine-prototype/${parity.water.depthFile}`, root));
  const depth = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  assert.equal(depth.length, parity.water.count);
  assert.ok(depth.every((v) => Number.isFinite(v) && v >= 0));
  assert.ok(depth.some((v) => v > .3));
  const data = readFileSync(new URL(`public/assets/environment/alpine-prototype/${parity.display.file}`, root));
  assert.equal(data.byteLength, parity.display.size ** 3 * 4 * 2);
  const values = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  assert.ok(values.every((v) => Number.isFinite(THREE.DataUtils.fromHalfFloat(v))));
});

test('display LUT reproduces native OCIO middle grey instead of Three base AgX', () => {
  const file = readFileSync(new URL(`public/assets/environment/alpine-prototype/${parity.display.file}`, root));
  const table = new Uint16Array(file.buffer, file.byteOffset, file.byteLength / 2);
  const n = parity.display.size;
  const x = ((Math.log2(.18) - parity.display.logMin) / (parity.display.logMax - parity.display.logMin)) * (n - 1);
  const low = Math.floor(x); const t = x - low;
  for (let channel = 0; channel < 3; channel += 1) {
    let linear = 0;
    for (let z = 0; z < 2; z += 1) for (let y = 0; y < 2; y += 1) for (let r = 0; r < 2; r += 1) {
      const weight = (z ? t : 1 - t) * (y ? t : 1 - t) * (r ? t : 1 - t);
      const index = (((low + z) * n + low + y) * n + low + r) * 4 + channel;
      linear += THREE.DataUtils.fromHalfFloat(table[index]) * weight;
    }
    const srgb = linear <= .0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - .055;
    // Independent CPU result from Blender 5.2.2's installed OCIO config and saved look.
    assert.ok(Math.abs(srgb - [.4613152146, .4613137245, .4613500237][channel]) < .004);
  }
});
import { createHash } from 'node:crypto';
import { applyGrassHabitat } from '../src/app/environment/alpineParityMaterials.js';

test('ambient occlusion derivatives match the exact delivered geography and authoring source', () => {
  const report = JSON.parse(readFileSync(new URL('design-reference/environment/webgl-prototype/cohesion-bakes.json', root), 'utf8'));
  const geography = readFileSync(new URL('public/assets/environment/alpine-prototype/geography.glb', root));
  assert.equal(report.sourceMasterSha256, delivery.sourceSha256);
  assert.equal(report.sourceGeographySha256, createHash('sha256').update(geography).digest('hex'));
  for (const surface of Object.values(report.surfaces)) {
    const png = readFileSync(new URL(`public/assets/environment/alpine-prototype/${surface.file}`, root));
    assert.equal(png.readUInt32BE(16), surface.resolution);
    assert.equal(png.readUInt32BE(20), surface.resolution);
  }
});

test('thin-leaf lighting remains connected to the installed Three lighting implementation', () => {
  const material = applyGrassHabitat(new THREE.MeshStandardMaterial(), true);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader, {});
  assert.ok(shader.fragmentShader.includes('dot(-geometryNormal, directLight.direction)'), 'Three shader upgrades must not silently remove the transmitted leaf contribution');
  assert.ok(shader.fragmentShader.includes('material.diffuseContribution'));
  assert.equal(material.alphaToCoverage, false, 'Rejected distant-coverage experiment must remain disabled');
  material.dispose();
});
import { keepResolvedGrass } from '../src/app/environment/alpinePrototypeData.js';

test('canopy delivery is unlit and derives from the same authored meadow coordinates', () => {
  const canopy=JSON.parse(readFileSync(new URL('public/assets/environment/alpine-prototype/canopy-material.json',root),'utf8'));
  assert.equal(canopy.sourceSha256,delivery.sourceSha256);
  assert.deepEqual(canopy.bounds,parity.coverage.bounds);
  assert.equal(canopy.masterUnchanged,true);
  for(const file of [canopy.color,canopy.normal]) {
    const png=readFileSync(new URL(`public/assets/environment/alpine-prototype/${file}`,root));
    assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],canopy.resolution);
  }
});

test('middle-distance representation preserves all near-camera blades and uses only stable authored roots', () => {
  let near=0,far=0,keptFar=0;
  for(const layer of parity.grass) {
    const bytes=readFileSync(new URL(`public/assets/environment/alpine-prototype/${layer.file}`,root));const records=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
    for(let i=0;i<layer.count;i++) {
      const offset=i*9;const distance=Math.hypot(records[offset]-delivery.camera.matrix[12],-records[offset+1]-delivery.camera.matrix[14]);
      const kept=keepResolvedGrass(records,offset,delivery.camera);
      if(distance<=32){near++;assert.equal(kept,true);}
      if(distance>=85){far++;if(kept)keptFar++;}
      if(i%500===0)assert.equal(kept,keepResolvedGrass(records,offset,delivery.camera));
    }
  }
  assert.ok(near>50000);assert.ok(far>10000);assert.ok(keptFar/far>.06 && keptFar/far<.10);
});
import { distantBladeGeometry } from '../src/app/environment/alpinePrototypeData.js';

test('distant blades remain narrow curved strips even when their centerline bends sideways', () => {
  const source=new THREE.BufferGeometry();
  source.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.5,0,0,0,0,0,.5,.5,.6,4.5,.5,.6,5,.5,.6,5.5,1,1,0],3));
  const lod=distantBladeGeometry(source);const p=lod.attributes.position;
  assert.equal(lod.index.count,9);assert.equal(p.count,5);
  assert.ok(Math.abs(p.getZ(1)-p.getZ(0)-1)<1e-6);
  assert.ok(Math.abs(p.getZ(3)-p.getZ(2)-1)<1e-6,'Lateral curvature must not become the width of a filled diamond');
  assert.equal(p.getX(4),1);assert.equal(p.getY(4),1);
  source.dispose();lod.dispose();
});

test('native canopy root delivery retains the prior authored middle and foothill anchors', () => {
  const canopy=JSON.parse(readFileSync(new URL('public/assets/environment/alpine-prototype/canopy-material.json',root),'utf8'));
  for(const native of canopy.grass) {
    const previous=parity.grass.find((layer)=>layer.layer===native.layer);
    const load=(file)=>{const b=readFileSync(new URL(`public/assets/environment/alpine-prototype/${file}`,root));return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);};
    const full=load(native.file);const old=load(previous.file);const anchors=new Set();
    assert.equal(full.length,native.count*9);assert.ok(native.count>previous.count);
    for(let i=0;i<native.count;i++)anchors.add(`${full[i*9]},${full[i*9+1]},${full[i*9+2]}`);
    for(let i=0;i<previous.count;i++)assert.ok(anchors.has(`${old[i*9]},${old[i*9+1]},${old[i*9+2]}`));
  }
});

// ---- Strip shading, linear resolve, flower filtering and environment isolation -------------------------------------
import { STRIP_SHADING } from '../src/app/environment/alpineParityMaterials.js';
import { RESOLVE_FRAGMENT, RESOLVE_SAMPLES } from '../src/app/environment/linearResolve.js';
import { FLOWER_ANISOTROPY } from '../src/app/environment/alpinePrototypeData.js';
import EnvironmentBoundary from '../src/app/environment/EnvironmentBoundary.js';

function compileGrassShader(strip) {
  const material = new THREE.MeshStandardMaterial();
  applyGrassHabitat(material, true, true, strip);
  const shader = {
    uniforms: {},
    vertexShader: '#include <begin_vertex>',
    fragmentShader: ['#include <color_fragment>', '#include <aomap_fragment>', '#include <normal_fragment_maps>', '#include <lights_physical_pars_fragment>', '#include <lights_fragment_end>'].join('\n'),
  };
  material.onBeforeCompile(shader, {});
  return { shader: shader.fragmentShader, key: material.customProgramCacheKey() };
}

test('strip shading is applied only to the strip material and leaves the previous grass shader untouched', () => {
  const previous = compileGrassShader(null);
  const calibrated = compileGrassShader(STRIP_SHADING.display);
  assert.ok(previous.shader.includes('canopyDistance * 0.20'));
  assert.ok(!previous.shader.includes('reflectedLight.indirectDiffuse *= 0.680'));
  assert.ok(calibrated.shader.includes('canopyDistance * 0.20'), 'the existing distance blend must remain');
  assert.ok(calibrated.shader.includes(`vec3(0.0, 1.0, 0.0)), ${STRIP_SHADING.display.upBlend.toFixed(2)}));`));
  assert.ok(calibrated.shader.includes(`reflectedLight.indirectDiffuse *= ${STRIP_SHADING.display.gain.toFixed(3)}`));
  assert.notEqual(previous.key, calibrated.key);
  assert.ok(calibrated.key.includes(`${STRIP_SHADING.display.gain}`));
});

test('strip calibration stays inside the swept range and the linear path is darker than the display path', () => {
  for (const mode of ['display', 'linear']) {
    assert.ok(STRIP_SHADING[mode].upBlend >= 0.5 && STRIP_SHADING[mode].upBlend <= 0.9);
    assert.ok(STRIP_SHADING[mode].gain >= 0.5 && STRIP_SHADING[mode].gain <= 0.9);
  }
  assert.ok(STRIP_SHADING.linear.gain < STRIP_SHADING.display.gain);
});

test('linear resolve uses four samples and applies the Blender display LUT exactly once, then output encoding', () => {
  assert.equal(RESOLVE_SAMPLES, 4);
  assert.ok(RESOLVE_FRAGMENT.includes('displayLut') && RESOLVE_FRAGMENT.includes('log2('));
  assert.ok(RESOLVE_FRAGMENT.includes('#include <colorspace_fragment>'));
  assert.ok(!RESOLVE_FRAGMENT.includes('tonemapping_fragment'), 'the stock tone mapper must not be applied on top of the LUT');
  assert.equal(RESOLVE_FRAGMENT.match(/texture\(displayLut/g).length, 1);
});

test('flower atlases request strong anisotropic filtering', () => {
  assert.ok(FLOWER_ANISOTROPY >= 8 && FLOWER_ANISOTROPY <= 16);
});

test('the environment boundary renders children until a child throws, then renders nothing', () => {
  assert.equal(EnvironmentBoundary.getDerivedStateFromError(new Error('asset missing')).failed, true);
  const healthy = new EnvironmentBoundary({ children: 'world' });
  assert.equal(healthy.render(), 'world');
  const failed = new EnvironmentBoundary({ children: 'world' });
  failed.state = EnvironmentBoundary.getDerivedStateFromError(new Error('asset missing'));
  assert.equal(failed.render(), null);
  const warnings = []; const warn = console.warn; console.warn = (...args) => warnings.push(args);
  try { failed.componentDidCatch(new Error('a')); failed.componentDidCatch(new Error('b')); } finally { console.warn = warn; }
  assert.equal(warnings.length, 1, 'a failed backdrop is reported once, not on every retry');
});

test('the application environment stays isolated from the alpine prototype and is wrapped by the boundary', () => {
  const environment = readFileSync(new URL('src/app/environment/LandscapeEnvironment.jsx', root), 'utf8');
  assert.match(environment, /<EnvironmentBoundary>[\s\S]*<ThreeLandscapeWorld[\s\S]*<\/EnvironmentBoundary>/);
  assert.ok(!/AlpinePrototype|alpineParityMaterials|linearResolve/.test(environment));
});

// ---- Water and bank refinement ------------------------------------------------------------------------------------
import { WATER_REFINEMENT, makeShallowWater, applyBankWetness } from '../src/app/environment/alpineParityMaterials.js';
import { BANK_WETNESS, footprintBounds, rasterizeFootprint, blurMask, buildWetnessMask } from '../src/app/environment/bankWetness.js';

function readWaterFootprint() {
  const glb = readFileSync(new URL('public/assets/environment/alpine-prototype/geography.glb', root));
  const jsonLength = glb.readUInt32LE(12); const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString()); const bin = 20 + jsonLength + 8;
  const mesh = json.meshes.find((m) => m.name === 'Authored water surface'); const primitive = mesh.primitives[0];
  const view = (accessor) => { const a = json.accessors[accessor]; const v = json.bufferViews[a.bufferView]; return { a, offset: bin + (v.byteOffset || 0) + (a.byteOffset || 0) }; };
  const p = view(primitive.attributes.POSITION); const positions = new Float32Array(p.a.count * 3);
  for (let i = 0; i < positions.length; i += 1) positions[i] = glb.readFloatLE(p.offset + i * 4);
  const i = view(primitive.indices); const indices = new Uint32Array(i.a.count);
  for (let k = 0; k < indices.length; k += 1) indices[k] = i.a.componentType === 5125 ? glb.readUInt32LE(i.offset + k * 4) : glb.readUInt16LE(i.offset + k * 2);
  return { positions, indices };
}

test('water refinement is opt-in and leaves the approved water shader text untouched', () => {
  const resources = { sky: new THREE.Texture(), displayLut: new THREE.Texture(), metadata: { display: { logMin: -12, logMax: 8, size: 65 } } };
  const approved = makeShallowWater(resources, new THREE.Texture(), true, true, false);
  const refined = makeShallowWater(resources, new THREE.Texture(), true, true, true);
  assert.ok(approved.fragmentShader.includes('vec3 radiance = reflected*fresnel + transmitted*(1.0-fresnel);'));
  assert.ok(approved.fragmentShader.includes('float shore = smoothstep(0.0,max(.012,fwidth(column)),column);'));
  assert.deepEqual(approved.uniforms.extinction.value.toArray().map((v) => +v.toFixed(3)), [0.24, 0.073, 0.113]);
  assert.ok(refined.fragmentShader.includes(`fresnel*${WATER_REFINEMENT.reflectionWeight}`));
  assert.ok(refined.fragmentShader.includes('float shore = smoothstep(0.0, shoreRamp, vDepth);') && refined.fragmentShader.includes(`${WATER_REFINEMENT.shoreDepth} + distanceToCamera`));
  assert.ok(!refined.fragmentShader.includes('fwidth(column)'));
  assert.ok(approved.fragmentShader.includes('mix(3.0,3.5,distanceResponse)'), 'approved reflection blur is unchanged');
  assert.ok(refined.fragmentShader.includes('mix(1.5,2.0,distanceResponse)'));
  assert.ok(Math.abs(refined.uniforms.extinction.value.x - 0.24 * WATER_REFINEMENT.extinctionScale) < 1e-6);
});

test('water refinement parameters stay inside the swept calibration range', () => {
  assert.ok(WATER_REFINEMENT.reflectionWeight >= 0.65 && WATER_REFINEMENT.reflectionWeight <= 0.95);
  assert.ok(WATER_REFINEMENT.extinctionScale >= 0.35 && WATER_REFINEMENT.extinctionScale <= 0.75);
  assert.ok(WATER_REFINEMENT.shoreDepth >= 0.03 && WATER_REFINEMENT.shoreDepth <= 0.1);
  assert.ok(WATER_REFINEMENT.reflectionLod[0] >= 1 && WATER_REFINEMENT.reflectionLod[0] < WATER_REFINEMENT.reflectionLod[1] && WATER_REFINEMENT.reflectionLod[1] <= 3);
});

test('wetness raster fills exactly the triangle footprint and blur only softens it', () => {
  const positions = Float32Array.from([0, 0, 0, 10, 0, 0, 0, 0, 10]); const indices = Uint32Array.from([0, 1, 2]);
  const bounds = footprintBounds(positions, 2); const raster = rasterizeFootprint(positions, indices, bounds, 64);
  const at = (x, z) => raster.data[Math.floor((z - bounds.minZ) / raster.metresPerTexel) * raster.width + Math.floor((x - bounds.minX) / raster.metresPerTexel)];
  assert.equal(at(2, 2), 255); assert.equal(at(8, 8), 0); assert.equal(at(-1.5, -1.5), 0);
  const blurred = blurMask(raster.data, raster.width, raster.height, 3);
  const before = raster.data.reduce((a, v) => a + v, 0); const after = blurred.reduce((a, v) => a + v, 0);
  assert.ok(Math.abs(after - before) / before < 0.05, 'blur must conserve coverage');
});

test('the wet band comes from the delivered authored water surface and stays beside the channel', () => {
  const { positions, indices } = readWaterFootprint();
  assert.equal(indices.length / 3, 47748);
  const mask = buildWetnessMask(positions, indices, BANK_WETNESS);
  assert.ok(mask.metresPerTexel > 0.1 && mask.metresPerTexel < 0.4, `texel ${mask.metresPerTexel}`);
  const covered = mask.data.reduce((a, v) => a + (v > 140 ? 1 : 0), 0) / mask.data.length;
  assert.ok(covered > 0.005 && covered < 0.25, `footprint fraction ${covered}`);
  const texel = (x, z) => mask.data[Math.floor((z - mask.bounds.minZ) / mask.metresPerTexel) * mask.width + Math.floor((x - mask.bounds.minX) / mask.metresPerTexel)];
  let best = 0, bestArea = -1, wet = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3; const b = indices[t + 1] * 3; const c = indices[t + 2] * 3;
    const area = Math.abs((positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2]) - (positions[c] - positions[a]) * (positions[b + 2] - positions[a + 2])) / 2;
    const centroid = texel((positions[a] + positions[b] + positions[c]) / 3, (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3);
    if (centroid > 60) wet += 1; if (area > bestArea) { bestArea = area; best = centroid; }
  }
  assert.ok(best > 200, 'the largest water triangle centroid is wet');
  assert.ok(wet / (indices.length / 3) > 0.9, 'nearly every water triangle centroid lies inside the wet footprint');
  assert.equal(texel(mask.bounds.minX + 1, mask.bounds.minZ + 1), 0, 'padding corner is dry');
});

test('bank wetness runs after the canopy atlas, fades with distance and uses the single-channel map', () => {
  const material = new THREE.MeshStandardMaterial(); material.customProgramCacheKey = () => 'base';
  const wetness = { texture: {}, min: new THREE.Vector2(), span: new THREE.Vector2(10, 10), ...BANK_WETNESS };
  applyBankWetness(material, wetness);
  const shader = { uniforms: {}, vertexShader: '', fragmentShader: 'void main() {\n#include <alphamap_fragment>\n}' };
  material.onBeforeCompile(shader, {});
  assert.ok(shader.fragmentShader.includes('smoothstep(uWetFade.x, uWetFade.y, length(vViewPosition))'));
  assert.ok(shader.fragmentShader.indexOf('uWetMap, wetUV') > shader.fragmentShader.indexOf('#include <alphamap_fragment>'));
  assert.deepEqual(shader.uniforms.uWet.value.toArray().map((v) => +v.toFixed(2)), [BANK_WETNESS.darkness, BANK_WETNESS.saturation, BANK_WETNESS.lo, BANK_WETNESS.hi]);
  assert.equal(material.customProgramCacheKey(), 'base-bank-wet');
  assert.ok(BANK_WETNESS.darkness < 1 && BANK_WETNESS.fadeNear < BANK_WETNESS.fadeFar);
});

// ---- Look-dev controls ---------------------------------------------------------------------------------------------
import { LOOK_CONTROLS, LOOK_DEFAULTS, applyLook, applyLookQuery, changedLook, getLook, holdApproved, lookToQuery, resetLook, setLook } from '../src/app/environment/lookDev.js';

function fakeScene() {
  const sun = { intensity: 3.25, userData: { baseIntensity: 3.25 } };
  const material = (role, extra = {}) => ({ userData: { lookRole: role, baseColor: new THREE.Color(1, 1, 1), ...extra }, color: new THREE.Color(1, 1, 1) });
  const water = { userData: { lookRole: 'water', baseExtinction: new THREE.Vector3(0.12, 0.04, 0.06) }, uniforms: { uReflectK: { value: 1 }, uLodBias: { value: 0 }, uRippleK: { value: 1 }, extinction: { value: new THREE.Vector3(0.12, 0.04, 0.06) } } };
  const wet = { darkness: 0.88, params: new THREE.Vector4(0.88, 0.2, 0.08, 0.55) };
  const terrain = { ...material('ground'), userData: { lookRole: 'ground', baseColor: new THREE.Color(1, 1, 1), bankWet: wet } };
  const meshes = [{ isMesh: true, material: material('hamlet') }, { isMesh: true, material: terrain }, { isMesh: true, material: water }, { isMesh: true, material: [material('flowers'), material('grassFar')] }, { isMesh: false }];
  return { scene: { environmentIntensity: 1, fog: { density: 0.00042 }, getObjectByName: (n) => (n === 'sun' ? sun : null), traverse: (cb) => meshes.forEach(cb) }, gl: { toneMappingExposure: 1.07 }, sun, meshes, water, wet };
}
const BASE = { exposure: 1.07, environmentIntensity: 1, fogDensity: 0.00042 };

test('look-dev defaults are inside every slider range and describe the approved look', () => {
  for (const control of LOOK_CONTROLS) {
    assert.ok(control.key in LOOK_DEFAULTS, control.key);
    assert.ok(LOOK_DEFAULTS[control.key] >= control.min && LOOK_DEFAULTS[control.key] <= control.max, `${control.key} default outside its range`);
  }
  assert.equal(Object.keys(LOOK_DEFAULTS).length, LOOK_CONTROLS.length);
  assert.deepEqual(changedLook(LOOK_DEFAULTS), {});
});

test('look-dev at its defaults leaves the scene exactly as it was', () => {
  const s = fakeScene(); applyLook(s, LOOK_DEFAULTS, BASE);
  assert.equal(s.gl.toneMappingExposure, 1.07); assert.equal(s.scene.environmentIntensity, 1); assert.equal(s.scene.fog.density, 0.00042); assert.equal(s.sun.intensity, 3.25);
  assert.equal(s.meshes[0].material.color.r, 1); assert.equal(s.water.uniforms.uReflectK.value, 1); assert.equal(s.water.uniforms.uLodBias.value, 0);
  assert.ok(Math.abs(s.water.uniforms.extinction.value.x - 0.12) < 1e-9); assert.ok(Math.abs(s.wet.params.x - 0.88) < 1e-9);
});

test('look-dev values scale the matching parts of the scene and nothing else', () => {
  const s = fakeScene();
  applyLook(s, { ...LOOK_DEFAULTS, exposure: 1.2, sun: 0.5, ambient: 1.5, fog: 2, hamlet: 1.6, flowers: 2, grassFar: 0.7, waterReflection: 0.5, waterSharpness: -1, waterRipples: 2, waterMurk: 2, bankWetness: 2 }, BASE);
  assert.ok(Math.abs(s.gl.toneMappingExposure - 1.284) < 1e-9); assert.equal(s.sun.intensity, 1.625); assert.equal(s.scene.environmentIntensity, 1.5); assert.ok(Math.abs(s.scene.fog.density - 0.00084) < 1e-12);
  assert.ok(Math.abs(s.meshes[0].material.color.r - 1.6) < 1e-6, 'hamlet');
  assert.ok(Math.abs(s.meshes[1].material.color.r - 1) < 1e-6, 'ground is untouched');
  assert.ok(Math.abs(s.meshes[3].material[0].color.r - 2) < 1e-6, 'flowers'); assert.ok(Math.abs(s.meshes[3].material[1].color.r - 0.7) < 1e-6, 'far grass');
  assert.equal(s.water.uniforms.uReflectK.value, 0.5); assert.equal(s.water.uniforms.uLodBias.value, -1); assert.equal(s.water.uniforms.uRippleK.value, 2);
  assert.ok(Math.abs(s.water.uniforms.extinction.value.y - 0.08) < 1e-9, 'murkiness scales the original extinction, not the last value');
  assert.ok(Math.abs(s.wet.params.x - (1 - 0.12 * 2)) < 1e-9);
  applyLook(s, LOOK_DEFAULTS, BASE); assert.equal(s.meshes[0].material.color.r, 1); assert.equal(s.sun.intensity, 3.25);
});

test('look-dev store clamps values, holds the approved look on demand and round-trips through a link', () => {
  resetLook();
  setLook('hamlet', 99); assert.equal(getLook().hamlet, LOOK_CONTROLS.find((c) => c.key === 'hamlet').max);
  setLook('hamlet', 1.4); setLook('waterMurk', 0.5); setLook('not-a-control', 3);
  assert.deepEqual(changedLook(getLook()), { hamlet: 1.4, waterMurk: 0.5 });
  holdApproved(true); assert.deepEqual(changedLook(getLook()), {}, 'holding shows the approved look'); holdApproved(false); assert.equal(getLook().hamlet, 1.4);
  const query = lookToQuery(getLook()); assert.equal(query, 'hamlet:1.4,waterMurk:0.5');
  resetLook(); assert.deepEqual(changedLook(getLook()), {});
  applyLookQuery(`?x=1&ld=${query}`); assert.deepEqual(changedLook(getLook()), { hamlet: 1.4, waterMurk: 0.5 });
  resetLook();
});

test('refined water exposes look-dev hooks without altering the approved shader', () => {
  const resources = { sky: new THREE.Texture(), displayLut: new THREE.Texture(), metadata: { display: { logMin: -12, logMax: 8, size: 65 } } };
  const approved = makeShallowWater(resources, new THREE.Texture(), true, true, false); const refined = makeShallowWater(resources, new THREE.Texture(), true, true, true);
  assert.ok(refined.fragmentShader.includes('* uRippleK') && refined.fragmentShader.includes('+ uLodBias') && refined.fragmentShader.includes('*uReflectK'));
  assert.ok(!approved.fragmentShader.includes('* uRippleK') && !approved.fragmentShader.includes('+ uLodBias') && !approved.fragmentShader.includes('*uReflectK'));
  for (const material of [approved, refined]) assert.deepEqual([material.uniforms.uReflectK.value, material.uniforms.uLodBias.value, material.uniforms.uRippleK.value], [1, 0, 1]);
});

// ---- Texture filtering -----------------------------------------------------------------------------------------------
import { TERRAIN_ANISOTROPY, setAnisotropy } from '../src/app/environment/alpinePrototypeData.js';

test('anisotropy helper only touches a texture when the level actually changes', () => {
  const texture = { anisotropy: 1, needsUpdate: false };
  assert.equal(setAnisotropy(texture, 16), true); assert.equal(texture.anisotropy, 16); assert.equal(texture.needsUpdate, true);
  texture.needsUpdate = false; assert.equal(setAnisotropy(texture, 16), false); assert.equal(texture.needsUpdate, false, 'no pointless re-upload');
  assert.equal(setAnisotropy(null, 16), false); assert.equal(setAnisotropy(undefined, 4), false);
  assert.ok(TERRAIN_ANISOTROPY >= 8 && TERRAIN_ANISOTROPY <= 16);
});

// ---- Void fill ------------------------------------------------------------------------------------------------------
test('the void-fill roots are deterministic, grounded on the delivered terrain, and stay clear of the hamlet clearing', () => {
  const dir = 'public/assets/environment/alpine-prototype/';
  const meta = JSON.parse(readFileSync(new URL(`${dir}fill-roots.json`, root), 'utf8'));
  const buffer = readFileSync(new URL(`${dir}grass-fill-2.bin`, root)); const records = new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const stride = meta.grass[0].stride; assert.equal(records.length, meta.grass[0].count * stride); assert.equal(meta.grass[0].layer, 2);
  const canopy = JSON.parse(readFileSync(new URL(`${dir}canopy-material.json`, root), 'utf8')); assert.equal(stride, canopy.grass.find((g) => g.layer === 2).stride);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, bad = 0;
  for (let i = 0; i < records.length; i += stride) {
    const [x, y, z] = [records[i], records[i + 1], records[i + 2]]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    const variant = records[i + 7]; if (!Number.isFinite(z) || z < 0 || z > 15 || !Number.isInteger(variant) || variant < 0 || variant > 11 || !(records[i + 8] > 0)) bad += 1;
  }
  assert.equal(bad, 0, 'every record has a finite terrain height, a valid variant and a positive width');
  assert.ok(minX >= meta.fill.x0 - 1 && maxX <= meta.fill.x1 + 1 && minY >= meta.fill.y0 - 1 && maxY <= meta.fill.y1 + 1, 'roots stay inside the declared void');
  assert.ok(maxX < 0, 'nothing is placed near the hamlet clearing (x >= 20)');
  assert.ok(meta.roots > 20000 && meta.roots < 200000);
});

// ---- Spruce, flower response and far water ---------------------------------------------------------------------------
import { FOLIAGE_STYLE, FLOWER_RESPONSE, applyFoliageStyle, applyFlowerResponse } from '../src/app/environment/alpineParityMaterials.js';

function compile(material) {
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: ['#include <color_fragment>', '#include <normal_fragment_maps>', '#include <lights_physical_pars_fragment>', '#include <lights_fragment_end>'].join('\n') };
  material.onBeforeCompile(shader, {}); return shader;
}

test('foliage style adds back-light, a blended tree normal and tonal lift, and tags the program cache key', () => {
  const material = new THREE.MeshStandardMaterial(); material.customProgramCacheKey = () => 'tree-base';
  const center = new THREE.Vector3(1, 3, 2); applyFoliageStyle(material, center);
  const shader = compile(material);
  assert.equal(shader.uniforms.uTreeCenter.value, center);
  assert.ok(shader.vertexShader.includes('vTreeNormal') && shader.fragmentShader.includes('mix(normal, vTreeNormal,'));
  assert.ok(shader.fragmentShader.includes('dot(-geometryNormal, directLight.direction)'));
  assert.ok(shader.fragmentShader.includes(FOLIAGE_STYLE.brightness.toFixed(3)) && shader.fragmentShader.includes((1 + FOLIAGE_STYLE.ambientWrap).toFixed(3)));
  assert.equal(material.customProgramCacheKey(), 'tree-base-foliage-v1');
  assert.ok(FOLIAGE_STYLE.brightness > 1 && FOLIAGE_STYLE.brightness < 1.5 && FOLIAGE_STYLE.sphericalBlend <= 0.7);
});

test('flower response lets petals glow and fades dark distant parts without touching strongly coloured petals', () => {
  const material = new THREE.MeshStandardMaterial(); material.customProgramCacheKey = () => 'flower-base'; applyFlowerResponse(material);
  const shader = compile(material);
  assert.ok(shader.fragmentShader.includes('dot(-geometryNormal, directLight.direction)') && shader.fragmentShader.includes((1 + FLOWER_RESPONSE.ambientWrap).toFixed(3)));
  assert.ok(shader.fragmentShader.includes('smoothstep(40.0, 110.0, length(vViewPosition))'), 'dark parts fade only with distance');
  assert.ok(shader.fragmentShader.includes('(1.0 - smoothstep(0.25, 0.6, sat))'), 'saturated petals are protected from the fade');
  assert.equal(material.customProgramCacheKey(), 'flower-base-flower-v2');
});

test('far water feathers its shoreline with distance and only in the refined shader', () => {
  const resources = { sky: new THREE.Texture(), displayLut: new THREE.Texture(), metadata: { display: { logMin: -12, logMax: 8, size: 65 } } };
  const approved = makeShallowWater(resources, new THREE.Texture(), true, true, false); const refined = makeShallowWater(resources, new THREE.Texture(), true, true, true);
  assert.ok(refined.fragmentShader.includes('farWater') && refined.fragmentShader.includes('farEdge'));
  assert.ok(!approved.fragmentShader.includes('farWater'));
  assert.ok(WATER_REFINEMENT.farRange[0] < WATER_REFINEMENT.farRange[1] && WATER_REFINEMENT.farEdgeDarken < 1 && WATER_REFINEMENT.farDesaturate <= 0.5);
});

// ---- Real reflections -----------------------------------------------------------------------------------------------
import { REFLECTION_GRASS_NAME, REFLECTION_NEAR_GRASS_NAME, REFLECTION_FLOWER_NAME, reflectionSize } from '../src/app/environment/alpinePrototypeData.js';

test('reflection size follows the drawing buffer at 16:9 inside sane limits', () => {
  assert.deepEqual(reflectionSize(2560), [1920, 1080]);
  assert.deepEqual(reflectionSize(1280), [1024, 576]);
  assert.deepEqual(reflectionSize(3840), [2048, 1152]);
  for (const width of [800, 1707, 2560, 5120]) { const [w, h] = reflectionSize(width); assert.ok(w >= 1024 && w <= 2048 && Math.abs(w / h - 16 / 9) < 0.02); assert.equal(h % 2, 0); }
});

test('the full reflection contains every grass layer and the flowers, the near mode only the two foreground layers', () => {
  const layers = ['Foreground arching grass', 'Low basal meadow foliage', 'Midground meadow continuation', 'Meadow to foothill transition'];
  for (const [i, name] of layers.entries()) { assert.ok(REFLECTION_GRASS_NAME.test(`${name} / shape 3`), name); assert.equal(REFLECTION_NEAR_GRASS_NAME.test(`${name} / shape 3`), i < 2, name); }
  for (const name of ['Marguerite LOD 1', 'Carthusian Pink LOD 0', 'Red Clover LOD 2']) assert.ok(REFLECTION_FLOWER_NAME.test(name), name);
  assert.ok(!REFLECTION_GRASS_NAME.test('hamlet') && !REFLECTION_FLOWER_NAME.test('Authored sediment'));
});

test('real reflection switches the water to a mip-chain lookup only in the refined shader', () => {
  const resources = { sky: new THREE.Texture(), displayLut: new THREE.Texture(), metadata: { display: { logMin: -12, logMax: 8, size: 65 } } };
  const real = makeShallowWater(resources, new THREE.Texture(), true, true, true, true); const cached = makeShallowWater(resources, new THREE.Texture(), true, true, true, false); const approved = makeShallowWater(resources, new THREE.Texture(), true, true, false, true);
  assert.ok(real.fragmentShader.includes('texture2D(reflectionMap,reflectionUV,uLodBias)') && !real.fragmentShader.includes('texture2DLodEXT(reflectionMap'));
  assert.ok(cached.fragmentShader.includes('texture2DLodEXT(reflectionMap,reflectionUV,mix(1.5,2.0,distanceResponse) + uLodBias)'));
  assert.ok(approved.fragmentShader.includes('mix(3.0,3.5,distanceResponse)') && !approved.fragmentShader.includes('texture2D(reflectionMap'), 'the approved water ignores the real-reflection request');
});

// ---- procedural hamlet ----
import { HAMLET_BUILDINGS, HAMLET_LANES, HAMLET_APRON, HAMLET_DOORS, HAMLET_TERRAIN_BOUNDS, sampleCurve, distanceToSegment, createHamletClearing, footprint, pointInPolygon, yardPolygon } from '../src/app/environment/hamletLayout.js';
import {buildHamletGroundMask} from '../src/app/environment/hamletGround.js';
import { HeightField, buildHamlet } from '../src/app/environment/hamletGeometry.js';

const heightMeta = JSON.parse(readFileSync(new URL('public/assets/environment/alpine-prototype/hamlet-heights.json', root), 'utf8'));
const heightBytes = readFileSync(new URL('public/assets/environment/alpine-prototype/hamlet-heights.bin', root));
const heightField = new HeightField(heightMeta, new Float32Array(heightBytes.buffer, heightBytes.byteOffset, heightBytes.byteLength / 4));

test('hamlet buildings keep clear of each other and sit on the site raster with no missing cells', () => {
  assert.equal(heightMeta.missing, 0);
  for (let i = 0; i < HAMLET_BUILDINGS.length; i += 1) for (let j = i + 1; j < HAMLET_BUILDINGS.length; j += 1) {
    const a = HAMLET_BUILDINGS[i], b = HAMLET_BUILDINGS[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 9, `${a.id} and ${b.id} are at least 9 m apart (settlement, not a cluster)`);
    for (const pa of footprint(a, 1)) for (const pb of footprint(b, 1)) for (const p of pa) assert.ok(!pointInPolygon(p[0], p[1], pb), `${a.id} footprint overlaps ${b.id}`);
  }
});

test('hamlet clearing removes grass from buildings and lanes but preserves the open meadow', () => {
  const clearing = createHamletClearing();
  for (const b of HAMLET_BUILDINGS) assert.ok(clearing.contains(b.x, b.z), `${b.id} centre is cleared`);
  assert.ok(clearing.contains(HAMLET_APRON.x, HAMLET_APRON.z));
  for (const lane of HAMLET_LANES) { const [x, z] = lane.points[Math.floor(lane.points.length / 2)]; assert.ok(clearing.contains(x, z), `${lane.id} lane is cleared`); }
  assert.ok(!clearing.contains(0, -100) && !clearing.contains(80, -170) && !clearing.contains(120, -140), 'far meadow keeps its grass');
});

test('hamlet geometry builds deterministic, grounded, budgeted triangles per material', () => {
  const a = buildHamlet(heightField), b = buildHamlet(heightField);
  assert.equal(a.triangles, b.triangles); assert.ok(a.triangles > 1000 && a.triangles < 40000, `triangle budget ${a.triangles}`);
  for (const [key, g] of Object.entries(a.geometries)) { const p = g.attributes.position.array; assert.ok(p.every(Number.isFinite), `${key} finite`); assert.equal(g.attributes.normal.count, g.attributes.position.count); assert.ok(g.index.count % 3 === 0); }
  for (const placed of a.placed) assert.ok(Math.abs(placed.floorY - heightField.at(placed.x, placed.z)) < 1.2, `${placed.id} floor sits near the terrain`);
  assert.ok(Object.keys(a.geometries).length <= 13, 'about a dozen draw calls');
});

test('every entrance reaches the shared lane network without roads crossing buildings',()=>{
  const paths=HAMLET_LANES.map(l=>({...l,samples:sampleCurve(l.points,.2)}));
  const distance=(point,path)=>Math.min(...path.samples.slice(1).map((p,i)=>distanceToSegment(...point,path.samples[i],p)));
  const connected=new Set(['main']);
  for(let pass=0;pass<paths.length;pass++)for(const p of paths)if(!connected.has(p.id)&&paths.some(other=>connected.has(other.id)&&distance(p.samples.at(-1),other)<.25))connected.add(p.id);
  assert.equal(connected.size,paths.length,'all access paths merge into the one lane');
  for(const b of HAMLET_BUILDINGS){
    const path=paths.find(p=>p.id==='door-'+b.id);assert.deepEqual(path.samples[0],HAMLET_DOORS[b.id]);
    for(const route of paths)for(const p of route.samples)assert.ok(!footprint(b,.05).some(poly=>pointInPolygon(...p,poly)),`${route.id} crosses ${b.id}`);
  }
});
test('hamlet ground treatment joins continuously and keeps geography protection independent of road layout',()=>{
  const m=buildHamletGroundMask(),at=([x,z],channel=0)=>{const i=Math.floor((x-m.minX)/m.spanX*m.width),j=Math.floor((z-m.minZ)/m.spanZ*m.height);return m.data[(j*m.width+i)*4+channel];};
  for(const l of HAMLET_LANES.filter(p=>p.id!=='main'))for(const p of sampleCurve(l.points,.2))assert.ok(at(p)>85,`${l.id} has a visible joined ground surface`);
  assert.ok(m.width<512&&m.height<512,'local mask, not a whole-world texture');
  const clearing=createHamletClearing();assert.deepEqual(clearing.terrainBounds,HAMLET_TERRAIN_BOUNDS);
  assert.deepEqual(clearing.terrainBounds,{minX:8.2,maxX:80.35089297217868,minZ:-182,maxZ:-25},'approved relief mask is unchanged');
  for(const b of HAMLET_BUILDINGS.filter(b=>b.yard)){
    const points=yardPolygon(b);let found=false;
    for(let x=Math.min(...points.map(p=>p[0]));x<Math.max(...points.map(p=>p[0]));x+=.5)for(let z=Math.min(...points.map(p=>p[1]));z<Math.max(...points.map(p=>p[1]));z+=.5)if(pointInPolygon(x,z,points)&&!clearing.contains(x,z)&&clearing.softness(x,z)>0&&clearing.softness(x,z)<1)found=true;
    assert.ok(found,`${b.id} retains living tended grass rather than a bare rectangular yard`);
  }
});

test('hamlet is a gated flag: preview default is procedural and pass=previous restores the authored mesh', () => {
  const preview = readFileSync(new URL('src/app/environment/landscapePreview.jsx', root), 'utf8'); const scene = readFileSync(new URL('src/app/environment/AlpinePrototype.jsx', root), 'utf8');
  assert.ok(preview.includes("params.get('hamlet') || (previousPass ? 'previous' : 'procedural')"));
  assert.ok(scene.includes("if (hamletNew && role === 'hamlet') object.visible = false") && scene.includes("hamletStyle !== 'previous'"));
});

// ---- time of day
import { applyTodQuery, currentMoment, formatHour, getTod, moodState, moonIllumination, moonPhase, setTod, solarDay, sunPose, wrapHour } from '../src/app/environment/timeOfDay.js';
const at = (y, mo, d, h) => new Date(y, mo - 1, d, Math.floor(h), Math.round((h % 1) * 60));

test('the solar day follows the calendar: longer in summer, sun rises behind the camera and sets in front', () => {
  const summer = solarDay(at(2026, 6, 21, 12)), winter = solarDay(at(2026, 12, 21, 12));
  assert.ok(summer.dayLength > winter.dayLength + 1.8 && summer.maxElevation > winter.maxElevation);
  const noon = sunPose(at(2026, 6, 21, summer.noon)); assert.ok(noon.elevation > 55);
  assert.ok(Math.abs(sunPose(at(2026, 6, 21, summer.sunrise)).elevation) < 1 && Math.abs(sunPose(at(2026, 6, 21, summer.sunset - 0.001)).elevation) < 1.5);
  assert.ok(sunPose(at(2026, 6, 21, 0.5)).elevation < -30);
});

test('the moon follows the calendar phase, rises near sunset when full, and is shaded by the phase', () => {
  assert.ok(Math.min(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14))), 1 - moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)))) < 0.01);
  const full = moonPhase(new Date(Date.UTC(2000, 0, 21, 4, 40))); assert.ok(Math.abs(full - 0.5) < 0.02 && moonIllumination(full) > 0.97);
  assert.ok(moonIllumination(0) < 0.001 && Math.abs(moonIllumination(0.25) - 0.5) < 1e-9);
});

test('four moods: afternoon is clear and neutral (not golden), evening is peach and rose, night is navy with stars and moon, morning is pale and misty', () => {
  const d = (y, m, dd, h) => moodState(at(y, m, dd, h)); const solar = solarDay(at(2026, 5, 10, 12));
  const afternoon = d(2026, 5, 10, solar.noon + 1.2), evening = d(2026, 5, 10, solar.sunset + 0.2), night = d(2026, 5, 10, 23.5), morning = d(2026, 5, 10, solar.sunrise + 0.9);
  assert.ok(afternoon.zen.b > afternoon.zen.r * 1.4 && afternoon.sunC.r - afternoon.sunC.b < 0.25, 'afternoon sky is blue and the light is ivory, not orange');
  assert.ok(evening.hor.r > evening.hor.b && evening.cloud.r > evening.cloud.g, 'evening horizon and clouds are warm pink');
  assert.ok(night.stars > 0.9 && night.zen.b > night.zen.r && night.zen.r + night.zen.g + night.zen.b < 0.3 && night.sunK === 0);
  assert.ok(morning.fogK > afternoon.fogK, 'morning carries mist');
  assert.ok(afternoon.stars === 0 && afternoon.glow === 0 && night.glow > 0.9);
});

test('the cycle is continuous: nothing jumps between ten-minute steps on any season, including the day boundary and noon', () => {
  const colourKeys = ['zen', 'hor', 'sunC', 'hemiSky', 'ground', 'fog', 'cloud']; const numKeys = ['sunK', 'hemiK', 'env', 'exp', 'fogK', 'stars', 'glow', 'glowK', 'beltK'];
  for (const [m, dd] of [[1, 15], [4, 20], [6, 21], [9, 22], [11, 7]]) {
    let previous = null;
    for (let step = 0; step <= 24 * 6; step += 1) {
      const s = moodState(new Date(2026, m - 1, dd, 0, step * 10)); // rolls past midnight into the next day on the last step
      if (previous) {
        for (const k of colourKeys) assert.ok(Math.max(Math.abs(s[k].r - previous[k].r), Math.abs(s[k].g - previous[k].g), Math.abs(s[k].b - previous[k].b)) < 0.3, k + ' jumps at step ' + step + ' on ' + m + '/' + dd);
        for (const k of numKeys) assert.ok(Math.abs(s[k] - previous[k]) < 0.35, k + ' jumps at step ' + step + ' on ' + m + '/' + dd);
      }
      previous = s;
    }
  }
});

test('time of day store: approved by default, manual and live modes, query parsing and wrapping', () => {
  assert.equal(getTod().mode, 'approved'); assert.equal(currentMoment(), null);
  setTod({ mode: 'manual', hour: 25.5, date: '2026-06-21' }); const m = currentMoment(); assert.equal(m.getHours(), 1); assert.equal(m.getDate(), 21); assert.equal(formatHour(13.75), '13:45');
  setTod({ mode: 'live' }); const now = new Date(2026, 0, 1, 7, 30); assert.equal(currentMoment(now), now);
  applyTodQuery('?tod=19.5&date=2026-12-24'); assert.equal(getTod().mode, 'manual'); assert.equal(getTod().hour, 19.5); assert.equal(getTod().date, '2026-12-24');
  setTod({ mode: 'approved' }); assert.equal(wrapHour(-1), 23);
});

test('generated sky has clouds, stars and a phase-shaded moon, and the approved panorama is kept for comparison', () => {
  const sky = readFileSync(new URL('src/app/environment/skyShader.js', root), 'utf8'); const scene = readFileSync(new URL('src/app/environment/AlpinePrototype.jsx', root), 'utf8');
  assert.ok(sky.includes('uMoonPhase') && sky.includes('uStarK') && sky.includes('float fbm(vec2 p)') && sky.includes('cirrus') && sky.includes('uBeltK'));
  assert.ok(scene.includes('name="panorama-sky"') && scene.includes('currentMoment()') && scene.includes('GeneratedSky'));
});


// ---- far stream: lowered banks and widened water
import { createBankLowering } from '../src/app/environment/bankLowering.js';
import { widenFarWater } from '../src/app/environment/waterWiden.js';
test('bank lowering is zero near the camera and far from the water, and pulls high ground down to just under the water level beside the far stream', () => {
  const water = []; for (let i = 0; i < 30; i += 1) water.push(20 + i * 0.3, 3, -120);
  const bank = createBankLowering(Float32Array.from(water), { camera: [-3, 10], lowerFrom: 14, lowerTo: 48, reach: 6.5, flat: 1.6, cell: 4 });
  assert.equal(bank.offsetAt(25, -120 + 1.0, 3.4) < -0.25, true, 'a bank 40 cm above the water is lowered');
  assert.equal(bank.offsetAt(25, -120 + 20, 3.4), 0, 'ground far from the water is untouched');
  assert.equal(bank.offsetAt(25, -120, 2.5), 0, 'ground already below the water level is not raised');
  const near = createBankLowering(Float32Array.from([-2, 1.7, 5, -1, 1.7, 5]), { camera: [-3, 10], lowerFrom: 14, lowerTo: 48, reach: 6.5, flat: 1.6, cell: 4 });
  assert.equal(near.offsetAt(-1.5, 6, 2.2), 0, 'the foreground pool bank is never lowered');
});
test('far water widening moves only boundary vertices, outward and only with distance, and keeps the vertex count', () => {
  const rows = 12, cols = 5; const positions = []; const indices = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) positions.push((c - 2) * 1, 3, -r * 20);
  for (let r = 0; r < rows - 1; r += 1) for (let c = 0; c < cols - 1; c += 1) { const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1; indices.push(a, d, b, b, d, e); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  const before = geometry.attributes.position.array.slice(); const moved = widenFarWater(geometry, { camera: [0, 0], from: 45, to: 150, maxMetres: 2 });
  const after = geometry.attributes.position.array; assert.equal(after.length, before.length); assert.ok(moved > 0);
  const x = (arr, r, c) => arr[(r * cols + c) * 3];
  assert.equal(x(after, 1, 0), x(before, 1, 0)); assert.ok(x(after, 10, 0) < x(before, 10, 0) - 1.5 && x(after, 10, 4) > x(before, 10, 4) + 1.5); assert.equal(x(after, 10, 2), x(before, 10, 2));
});

// ---- meadow detail (middle and far ground)
import { meadowPatch, meadowBladeTint, MEADOW } from '../src/app/environment/meadowDetail.js';
test('meadow patches are smooth, bounded and varied, and the fill patch is darkened to match its neighbours', () => {
  let min = 1, max = 0; for (let x = -200; x < 200; x += 7) for (let z = -300; z < 100; z += 7) { const v = meadowPatch(x, z); min = Math.min(min, v); max = Math.max(max, v); assert.ok(v >= 0 && v <= 1); }
  assert.ok(max - min > 0.35, 'patches differ enough to read');
  assert.ok(Math.abs(meadowPatch(10, 10) - meadowPatch(10.5, 10)) < 0.05, 'neighbouring points are similar (smooth)');
  assert.ok(meadowBladeTint(10, 10, true) < meadowBladeTint(10, 10, false) && Math.abs(meadowBladeTint(10, 10, true) / meadowBladeTint(10, 10, false) - MEADOW.fillDarken) < 1e-9);
});
test('meadow detail is a gated flag and keeps the foreground untouched (it only acts beyond the near-field fade)', () => {
  const scene = readFileSync(new URL('src/app/environment/AlpinePrototype.jsx', root), 'utf8'); const preview = readFileSync(new URL('src/app/environment/landscapePreview.jsx', root), 'utf8'); const detail = readFileSync(new URL('src/app/environment/meadowDetail.js', root), 'utf8');
  assert.ok(preview.includes("params.get('meadow') || (previousPass ? 'previous' : 'habitat')") && scene.includes("meadowStyle !== 'previous'") && scene.includes('meadowDetail && corridor'));
  assert.ok(detail.includes('smoothstep(32.0, 64.0, md)') || detail.includes('MEADOW.fromMetres'));
});

// ---- tuft cards
import { buildTufts, TUFTS } from '../src/app/environment/tufts.js';
import { CELLS, CARD } from '../src/app/environment/tuftBake.js';
const farMeta = JSON.parse(readFileSync(new URL('public/assets/environment/alpine-prototype/far-heights.json', root), 'utf8'));
const farBytes = readFileSync(new URL('public/assets/environment/alpine-prototype/far-heights.bin', root));
const farField = new HeightField(farMeta, new Float32Array(farBytes.buffer, farBytes.byteOffset, farBytes.byteLength / 4));
test('tuft cards: deterministic, in view and band, grounded, irregular, cheap, with a natural mix of grass, understory and flower cards', () => {
  const palette = delivery.grassPalette; const a = buildTufts(farField, { palette }), b = buildTufts(farField, { palette }); const total = a.counts.reduce((x, y) => x + y, 0);
  assert.deepEqual(a.counts, b.counts); assert.equal(a.counts.length, CELLS.length); assert.ok(total > 6000 && total < 260000, 'budget ' + total);
  const grass = a.counts.slice(0, 4).reduce((x, y) => x + y, 0), leaves = a.counts[4] + a.counts[5], flowers = a.counts.slice(6).reduce((x, y) => x + y, 0);
  assert.ok(grass > leaves * 4 && leaves > 0 && flowers > total * 0.01 && flowers < total * 0.3, 'mix ' + [grass, leaves, flowers]);
  const [cx, cz] = TUFTS.camera; let outside = 0, lowest = 99, dashes = 0; const xs = [];
  a.matrices.forEach((mat, c) => { for (let k = 0; k < a.counts[c]; k += 1) { const x = mat[k * 16 + 12], y = mat[k * 16 + 13], z = mat[k * 16 + 14]; const d = Math.hypot(x - cx, z - cz); if (d < TUFTS.from - 4 || d > TUFTS.to + 4 || Math.atan2(Math.abs(x - cx), -(z - cz)) > TUFTS.halfAngle + 0.1) outside += 1; lowest = Math.min(lowest, y); if (xs.length < 5000) xs.push(x); } });
  assert.equal(outside, 0); assert.ok(lowest > 0.8); assert.ok(dashes === 0);
  const snapped = xs.filter((x) => Math.abs(x / TUFTS.cell - Math.round(x / TUFTS.cell)) < 0.03).length / xs.length; assert.ok(snapped < 0.15, 'not locked to a grid');
  for (let c = 0; c < a.counts.length; c += 1) assert.equal(a.colors[c].length, a.counts[c] * 3);
  assert.equal(buildTufts(farField, { palette, exclude: () => true }).counts.reduce((x, y) => x + y, 0), 0); assert.equal(buildTufts(farField, { palette, occupied: () => true }).counts.reduce((x, y) => x + y, 0), 0);
  assert.ok(CARD.size >= 128);
});

import { resolveSamples } from '../src/app/environment/linearResolve.js';
test('anti-aliasing: 8 samples by default (capped by the GPU), ?msaa=4 restores the earlier setting', () => {
  assert.equal(resolveSamples(8, ''), 8); assert.equal(resolveSamples(16, ''), 8); assert.equal(resolveSamples(4, ''), 4); assert.equal(resolveSamples(16, '?msaa=4'), 4); assert.equal(resolveSamples(16, '?msaa=nonsense'), 8);
});

// ---- real blades and flowers for the middle ground
import { planRealFlowers } from '../src/app/environment/realFlowers.js';
test('real mid-ground flowers: capped, deterministic, only the three flower kinds, positioned at the clump positions', () => {
  const placed = buildTufts(farField, { palette: delivery.grassPalette }); const a = planRealFlowers(placed, { maxFlowers: 3500 }), b = planRealFlowers(placed, { maxFlowers: 3500 });
  const total = [...a.values()].reduce((x, m) => x + m.length / 16, 0); assert.ok(total > 400 && total <= 3700, 'flowers ' + total); assert.deepEqual([...a.keys()], [...b.keys()]);
  for (const k of a.keys()) assert.ok(['Marguerite', 'Carthusian Pink', 'Red Clover', 'Dandelion'].includes(k));
  const all = [...a.values()].flatMap((m) => { const out = []; for (let i = 0; i < m.length; i += 16) out.push([m[i + 12], m[i + 14]]); return out; }); const cx = TUFTS.camera[0], cz = TUFTS.camera[1];
  assert.ok(all.every(([x, z]) => Math.hypot(x - cx, z - cz) >= TUFTS.from - 4 && Math.hypot(x - cx, z - cz) <= TUFTS.to + 4));
  assert.ok(planRealFlowers(placed, { maxFlowers: 100 }).size >= 1 && [...planRealFlowers(placed, { maxFlowers: 100 }).values()].reduce((x, m) => x + m.length / 16, 0) <= 160);
});
test('the meadow has two modes: real blades and flowers by default, ?meadow=cards for the baked cards', () => {
  const scene = readFileSync(new URL('src/app/environment/AlpinePrototype.jsx', root), 'utf8');
  assert.ok(scene.includes("meadowStyle === 'cards' ? 'cards' : 'blades'") && scene.includes("meadowMode === 'blades'") && scene.includes('buildRealFlowerGroup') && scene.includes('silhouette'));
});

import { flowerDrift } from '../src/app/environment/meadowDetail.js';
test('flowering drifts through blade colour: bounded, patchy, smooth, warm-pale colours only', () => {
  let present = 0, absent = 0; for (let x = -150; x < 150; x += 5) for (let z = -250; z < -30; z += 5) { const f = flowerDrift(x, z); assert.ok(f.amount >= 0 && f.amount <= 1); assert.equal(f.rgb.length, 3); f.amount > 0.3 ? present += 1 : absent += 1; }
  assert.ok(present > 200 && absent > 200, 'drifts are patchy: ' + present + ' / ' + absent); assert.ok(Math.abs(flowerDrift(20, -100).amount - flowerDrift(20.5, -100).amount) < 0.12, 'smooth');
});

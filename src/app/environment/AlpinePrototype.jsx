import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { ALPINE_ASSET_ROOT as ROOT, FLOWER_ANISOTROPY, TERRAIN_ANISOTROPY, REFLECTION_GRASS_NAME, REFLECTION_NEAR_GRASS_NAME, REFLECTION_FLOWER_NAME, reflectionSize, setAnisotropy, authoredCamera, grassMatrix, percentile, staticWaterNormal, inheritedMetadata, keepResolvedGrass, distantBladeGeometry } from './alpinePrototypeData.js';
import { applyBlenderDisplay, applyGrassHabitat, applyWetSediment, makeSkyMaterial, makeShallowWater, applyDistantCanopy, applyBankWetness, applyFoliageStyle, applyFlowerResponse, STRIP_SHADING } from './alpineParityMaterials.js';
import { createBankWetness } from './bankWetness.js';
import { applyLook, getLook, subscribeLook, isApprovedHeld } from './lookDev.js';
import Hamlet from './Hamlet.jsx';
import { applyTimeOfDay, currentMoment, subscribeTod, getTod } from './timeOfDay.js';
import GeneratedSky from './GeneratedSky.jsx';
import { buildTuftGroup, placeMeadow, splitFlowers } from './tuftGroup.js';
import { buildRealFlowerGroup } from './realFlowers.js';
import { createMeadowHabitat, applyHabitatMaterial, smooth as habitatSmooth, habitatHash } from './meadowHabitat.js';
import { communityAt, scatterDensity, slopeFacing, placeCommunityFlowers, COMMUNITIES, COMMUNITY_MIX } from './meadowCommunities.js';
import { growHabitatGrass, placeHabitatFlowers, tintHabitatBlade } from './meadowHabitatGrowth.js';
import { occupancyMap, synthesizeMeadow, SYNTH } from './meadowSynthesis.js';
import { HeightField } from './hamletGeometry.js';
import { applyMeadowDetail, meadowBladeTint, flowerDrift } from './meadowDetail.js';
import { bankLowering, createBankLowering, widenFarWater } from './bankLowering.js';
import { createValleyRelief, withValleyRelief } from './valleyRelief.js';
import { clearBakedPath, fillTrackGrass, heightFieldFrom } from './bakedPath.js';
import { createHamletClearing } from './hamletLayout.js';
import { createLinearResolve } from './linearResolve.js';

function configureDataMap(texture) {
  texture.flipY = false; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  return texture;
}

function useParityResources() {
  const metadata = useLoader(THREE.FileLoader, `${ROOT}/parity.json`, (loader) => loader.setResponseType('json'));
  const [lut, depth, wetness, coverageData] = useLoader(THREE.FileLoader, [metadata.display.file, metadata.water.depthFile, metadata.water.sedimentWetnessFile, metadata.coverage.file].map((file) => `${ROOT}/${file}`), (loader) => loader.setResponseType('arraybuffer'));
  const canopyMetadata = useLoader(THREE.FileLoader, `${ROOT}/canopy-material.json`, (loader) => loader.setResponseType('json'));
  // Roots that fill the authored void in the far-left middle ground (make-fill-roots.mjs).
  const fillMetadata = useLoader(THREE.FileLoader, `${ROOT}/fill-roots.json`, (loader) => loader.setResponseType('json'));
  const canopyMaps = useLoader(THREE.TextureLoader, ['meadow-canopy-color.png', 'meadow-canopy-normal.png'].map((file) => `${ROOT}/${file}`));
  const sky = useLoader(EXRLoader, `${ROOT}/${metadata.sky.file}`);
  const maps = useLoader(THREE.TextureLoader, ['terrain-near-normal.png', 'terrain-range-normal.png', 'terrain-near-roughness.png', 'terrain-range-roughness.png', 'terrain-near-ao.png', 'terrain-range-ao.png', 'hamlet-ao.png'].map((file) => `${ROOT}/${file}`));
  const resources = useMemo(() => {
    const displayLut = new THREE.Data3DTexture(new Uint16Array(lut), metadata.display.size, metadata.display.size, metadata.display.size);
    displayLut.format = THREE.RGBAFormat; displayLut.type = THREE.HalfFloatType;
    displayLut.minFilter = displayLut.magFilter = THREE.LinearFilter; displayLut.unpackAlignment = 1; displayLut.needsUpdate = true;
    const panorama = sky.clone(); panorama.mapping = THREE.EquirectangularReflectionMapping; panorama.needsUpdate = true;
    const coverage = new THREE.DataTexture(new Uint8Array(coverageData), metadata.coverage.size, metadata.coverage.size, THREE.RedFormat);
    coverage.generateMipmaps = true; coverage.minFilter = THREE.LinearMipmapLinearFilter; coverage.magFilter = THREE.LinearFilter; coverage.needsUpdate = true;
    maps.forEach(configureDataMap);
    const canopyColor=canopyMaps[0].clone(); const canopyNormal=canopyMaps[1].clone();
    canopyColor.colorSpace=THREE.SRGBColorSpace; canopyNormal.colorSpace=THREE.NoColorSpace;
    [canopyColor,canopyNormal].forEach((texture) => { texture.flipY=true;texture.anisotropy=2;texture.needsUpdate=true; });
    return { metadata, canopyMetadata, fillMetadata, canopyColor, canopyNormal, displayLut, coverage, sky: panorama, waterDepth: new Float32Array(depth), sedimentWetness: new Float32Array(wetness), nearNormal: maps[0], rangeNormal: maps[1], nearRoughness: maps[2], rangeRoughness: maps[3], nearAO: maps[4], rangeAO: maps[5], hamletAO: maps[6] };
  }, [metadata, canopyMetadata, fillMetadata, canopyMaps, lut, depth, wetness, coverageData, sky, maps]);
  useEffect(() => () => { resources.displayLut.dispose(); resources.sky.dispose(); resources.coverage.dispose(); resources.canopyColor.dispose(); resources.canopyNormal.dispose(); }, [resources]);
  return resources;
}

function applyRendererExposure(renderer, exposure) {
  renderer.toneMappingExposure = exposure;
}

function SourceExposure({ resources, baseline }) {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => { applyRendererExposure(gl, baseline ? .7 : resources.metadata.display.exposure); }, [gl, baseline, resources]);
  return null;
}

function Camera({ manifest }) {
  const set = useThree((state) => state.set);
  const size = useThree((state) => state.size);
  const camera = useMemo(() => authoredCamera(manifest, size.width / size.height), [manifest, size.width, size.height]);
  useLayoutEffect(() => { set({ camera }); }, [camera, set]);
  return null;
}

function BaselineSky({ manifest }) {
  const { gl } = useThree();
  const sky = useMemo(() => {
    const object = new Sky(); object.scale.setScalar(1400);
    object.material.uniforms.radianceScale = { value: .45 };
    object.material.fragmentShader = 'uniform float radianceScale;\n' + object.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * radianceScale, 1.0 );');
    const uniforms = object.material.uniforms;
    uniforms.turbidity.value = 2; uniforms.rayleigh.value = 2.3; uniforms.mieCoefficient.value = .003;
    uniforms.mieDirectionalG.value = .75; uniforms.cloudCoverage.value = 0; uniforms.cloudDensity.value = 0;
    uniforms.sunPosition.value.fromArray(manifest.sun.direction).multiplyScalar(1000);
    return object;
  }, [manifest]);
  const environment = useMemo(() => {
    const environmentScene = new THREE.Scene(); environmentScene.add(sky.clone());
    const generator = new THREE.PMREMGenerator(gl); const target = generator.fromScene(environmentScene, .02, .1, 2000, { size: 256 }); generator.dispose(); return target;
  }, [gl, sky]);
  useEffect(() => () => environment.dispose(), [environment]);
  useEffect(() => () => { sky.geometry.dispose(); sky.material.dispose(); }, [sky]);
  return <><primitive object={sky} /><primitive object={environment.texture} attach="environment" /><hemisphereLight args={['#c3d9eb', '#818868', .5]} /></>;
}

function SourceSky({ resources }) {
  const material = useMemo(() => makeSkyMaterial(resources), [resources]);
  useEffect(() => () => material.dispose(), [material]);
  return <><mesh name="panorama-sky" scale={1400} material={material}><sphereGeometry args={[1, 64, 32]} /></mesh><primitive object={resources.sky} attach="environment" /></>;
}

function Daylight({ manifest, resources, baseline }) {
  const target = useMemo(() => { const object = new THREE.Object3D(); object.position.set(0, 0, -70); return object; }, []);
  const sun = manifest.sun.direction.map((v, i) => v * 180 + (i === 2 ? -70 : 0));
  return <>
    {baseline ? <BaselineSky manifest={manifest} /> : <SourceSky resources={resources} />}
    <primitive object={target} />
    <directionalLight name="sun" userData={{ baseIntensity: manifest.sun.sourceEnergy }} position={sun} target={target} intensity={manifest.sun.sourceEnergy} color={manifest.sun.color} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60}
      shadow-camera-top={60} shadow-camera-bottom={-60} shadow-camera-near={.5} shadow-camera-far={600}
      shadow-normalBias={.025} shadow-bias={-.00006} />
    <directionalLight name="moon" position={[-sun[0], -sun[1], -sun[2]]} target={target} intensity={0} color="#9db4ff" />
    <hemisphereLight name="tod-ambient" args={['#ffffff', '#ffffff', 0]} />
    <fogExp2 attach="fog" args={[baseline ? '#a7b8c3' : '#bacad8', .00042]} />
  </>;
}

function prepareGeography(gltf, waterMode, resources, baseline, surfaceDetail, refinement, corridor, waterRefine, anisotropy, treeStyle, realReflection, hamletNew, pathMask, meadowDetail) {
  const group = gltf.scene.clone(true); const ownedMaterials = []; const ownedGeometry = [];
  group.updateMatrixWorld(true); const treeCenters = new Map();
  // One shading centre per tree, so needles and bark of the same tree blend toward the same cone-like normal.
  const treeCenter = (object) => {
    let node = object; while (node.parent && node.parent !== group && inheritedMetadata(node.parent, 'echelonRole') === 'tree') node = node.parent;
    if (!treeCenters.has(node.uuid)) treeCenters.set(node.uuid, new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()));
    return treeCenters.get(node.uuid);
  };
  // Shared canopy atlases are viewed at the same grazing angles as the terrain they colour.
  if (!baseline) { setAnisotropy(resources.canopyColor, anisotropy.canopy); setAnisotropy(resources.canopyNormal, anisotropy.canopy); }
  const normal = staticWaterNormal();
  // Refined pass only: wet band derived once from the authored water surface (no new geometry or placements).
  let wetness = null;
  if (!baseline && corridor && waterRefine && waterMode === 'fresnel') {
    let waterGeometry = null; group.traverse((o) => { if (o.isMesh && inheritedMetadata(o, 'echelonRole') === 'water') waterGeometry = o.geometry; });
    if (waterGeometry) wetness = createBankWetness(waterGeometry);
  }
  // The distant stream sits in a shallow channel; lower the banks along it (terrain, grass, flowers and hamlet ground share one offset) and widen the water to fill.
  let bank = null, waterWorld = null;
  if (!baseline && corridor && waterRefine && waterMode === 'fresnel') {
    let water = null; group.traverse((o) => { if (o.isMesh && inheritedMetadata(o, 'echelonRole') === 'water') water = o; });
    if (water) { const p = water.geometry.attributes.position; water.updateWorldMatrix(true, false); const world = new Float32Array(p.count * 3); const v = new THREE.Vector3(); for (let i = 0; i < p.count; i += 1) { v.fromBufferAttribute(p, i).applyMatrix4(water.matrixWorld); world[i * 3] = v.x; world[i * 3 + 1] = v.y; world[i * 3 + 2] = v.z; } bank = createBankLowering(world); waterWorld = world; }
  }
  if (bank && waterWorld) { // valley relief (valleyRelief.js): gentle landforms in the middle ground; ?relief=0 compares with the flat valley, ?relief=1.5 exaggerates
    const asked = new URLSearchParams(window.location.search).get('relief'); const amount = asked === null ? 1.2 : Number(asked); // 1.2 by default; ?relief=0 restores the authored flat valley, ?relief=1.8 exaggerates
    if (amount > 0) bank = withValleyRelief(bank, createValleyRelief({ water: waterWorld, hamletBounds: createHamletClearing().terrainBounds, amount }));
  }
  bankLowering.current = bank;
  const reliefMeshes = [];
  group.traverse((object) => {
    if (!object.isMesh) return;
    const role = inheritedMetadata(object, 'echelonRole');
    object.castShadow = role === 'tree' || role === 'hamlet' || role === 'stone'; object.receiveShadow = true;
    if (hamletNew && role === 'hamlet') object.visible = false; // replaced by the procedural settlement
    if (role === 'water') {
      object.geometry = object.geometry.clone(); ownedGeometry.push(object.geometry);
      const position = object.geometry.attributes.position; const uv = new Float32Array(position.count * 2);
      for (let i = 0; i < position.count; i += 1) { uv[i * 2] = position.getX(i) * .25; uv[i * 2 + 1] = -position.getZ(i) * .25; }
      object.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (bank) widenFarWater(object.geometry);
      if (!baseline && waterMode === 'fresnel') {
        if (resources.waterDepth.length !== position.count) throw new Error('Water depth attribute no longer matches delivery geometry');
        object.geometry.setAttribute('waterDepth', new THREE.BufferAttribute(resources.waterDepth, 1));
        object.material = makeShallowWater(resources, normal, refinement, corridor, waterRefine, realReflection);
        object.material.userData.lookRole = 'water'; object.material.userData.baseExtinction = object.material.uniforms.extinction?.value.clone();
      } else {
        const physical = waterMode === 'physical';
        object.material = new THREE.MeshPhysicalMaterial({
          color: baseline ? '#dce7d5' : '#f5faf6', metalness: 0, roughness: .12, ior: 1.333,
          transmission: physical ? 1 : 0, thickness: .45,
          attenuationColor: baseline ? '#a3baa2' : '#d8e6df', attenuationDistance: 5,
          normalMap: normal, normalScale: new THREE.Vector2(.12, .12),
          transparent: !physical, opacity: physical ? 1 : .46, depthWrite: false,
        });
        if (!baseline) applyBlenderDisplay(object.material, resources);
      }
      object.renderOrder = 2; ownedMaterials.push(object.material);
    } else {
      if (!baseline && object.name === 'sediment') {
        object.geometry = object.geometry.clone(); ownedGeometry.push(object.geometry);
        if (object.geometry.attributes.position.count !== resources.sedimentWetness.length) throw new Error('Sediment wetness attribute mismatch');
        object.geometry.setAttribute('wetness', new THREE.BufferAttribute(resources.sedimentWetness, 1));
        object.geometry.deleteAttribute('normal');
        object.geometry = mergeVertices(object.geometry, 1e-5);
        object.geometry.computeVertexNormals();
        ownedGeometry.push(object.geometry);
      }
      if (bank && role === 'terrain') {
        object.geometry = object.geometry.clone(); ownedGeometry.push(object.geometry); const p = object.geometry.attributes.position;
        const nrm = object.geometry.attributes.normal; const tilt = new THREE.Vector3(); const reliefValues = bank.relief ? new Float32Array(p.count) : null;
        for (let i = 0; i < p.count; i += 1) {
          const x = p.getX(i), z = p.getZ(i); const dy = bank.offsetAt(x, z, p.getY(i)); if (dy !== 0) p.setY(i, p.getY(i) + dy); if (reliefValues) reliefValues[i] = bank.relief.exactAt(x, z);
          if (bank.relief && nrm && dy !== 0) { const [gx, gz] = bank.relief.gradient(x, z); const ny = nrm.getY(i); tilt.set(nrm.getX(i) - gx * ny, ny, nrm.getZ(i) - gz * ny).normalize(); nrm.setXYZ(i, tilt.x, tilt.y, tilt.z); }
        }
        if (nrm) nrm.needsUpdate = true; if (reliefValues) reliefMeshes.push({ position: p, index: object.geometry.index, values: reliefValues });
        p.needsUpdate = true; object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
      }
      const originals = Array.isArray(object.material) ? object.material : [object.material];
      const materials = originals.map((source) => {
        const material = source.clone(); material.roughness = role === 'tree' ? .95 : .9;
        if (role === 'tree') { material.transparent = false; material.alphaTest = .3; material.side = THREE.DoubleSide; }
        if (!baseline) {
          if (role === 'terrain' && surfaceDetail) {
            const near = inheritedMetadata(object, 'terrainZone') === 'near';
            material.normalMap = near ? resources.nearNormal : resources.rangeNormal;
            material.normalScale = new THREE.Vector2(.8, .8);
            material.roughnessMap = near ? resources.nearRoughness : resources.rangeRoughness;
            material.roughness = 1;
          }
          if (hamletNew && pathMask && role === 'terrain' && inheritedMetadata(object, 'terrainZone') === 'near' && material.map) material.map = clearBakedPath(material.map, pathMask);
          if (refinement && (role === 'terrain' || role === 'hamlet')) {
            material.aoMap = role === 'hamlet' ? resources.hamletAO : inheritedMetadata(object, 'terrainZone') === 'near' ? resources.nearAO : resources.rangeAO;
            material.aoMapIntensity = .8;
          }
          applyBlenderDisplay(material, resources);
          if (role === 'tree' && treeStyle !== 'previous') { material.alphaToCoverage = true; applyFoliageStyle(material, treeCenter(object)); }
          if (object.name === 'sediment') applyWetSediment(material, refinement, corridor);
          if (role === 'terrain') applyDistantCanopy(material, resources, refinement, corridor);
          if (role === 'terrain' && meadowDetail && corridor && inheritedMetadata(object, 'terrainZone') === 'near') applyMeadowDetail(material); // meadow ground only, never the mountains
          if (role === 'terrain' && wetness) applyBankWetness(material, wetness);
        }
        if (!baseline) for (const slot of ['map', 'normalMap', 'roughnessMap', 'aoMap']) setAnisotropy(material[slot], anisotropy.terrain);
        const zone = inheritedMetadata(object, 'terrainZone');
        const lookRole = role === 'hamlet' ? 'hamlet' : role === 'terrain' ? (zone === 'near' ? 'ground' : 'mountains') : role === 'tree' ? 'trees' : null;
        if (lookRole && !baseline) { material.userData.lookRole = lookRole; material.userData.baseColor = material.color.clone(); }
        ownedMaterials.push(material); return material;
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
    }
  });
  if (bank?.relief && reliefMeshes.length) bank.relief.bindMesh(reliefMeshes); // from here on, anything standing on the ground follows the displaced mesh exactly
  return { group, dispose: () => { ownedMaterials.forEach((m) => m.dispose()); ownedGeometry.forEach((g) => g.dispose()); normal.dispose(); wetness?.texture.dispose(); } };
}

function Grass({ manifest, gltf, resources, baseline, refinement, corridor, stripNormals, resolve, fillRoots, clearing, meadowDetail, meadowMode, flowers, habitat }) {
  const size=useThree((state)=>state.size); const gl = useThree((state) => state.gl);
  const heightMeta = useLoader(THREE.FileLoader, `${ROOT}/hamlet-heights.json`, (loader) => loader.setResponseType('json'));
  const heightRaw = useLoader(THREE.FileLoader, `${ROOT}/hamlet-heights.bin`, (loader) => loader.setResponseType('arraybuffer'));
  const trackField = useMemo(() => (clearing ? heightFieldFrom(heightMeta, heightRaw) : null), [clearing, heightMeta, heightRaw]);
  const farMeta = useLoader(THREE.FileLoader, `${ROOT}/far-heights.json`, (loader) => loader.setResponseType('json'));
  const farRaw = useLoader(THREE.FileLoader, `${ROOT}/far-heights.bin`, (loader) => loader.setResponseType('arraybuffer'));
  const farField = useMemo(() => new HeightField(farMeta, new Float32Array(farRaw)), [farMeta, farRaw]);
  const layers = useMemo(() => {
    const authored = baseline ? manifest.grass : resources.metadata.grass.map((layer) => corridor && layer.layer >= 2 ? resources.canopyMetadata.grass.find((native) => native.layer === layer.layer) : layer);
    return !baseline && corridor && !habitat && fillRoots !== 'off' ? [...authored, ...resources.fillMetadata.grass] : authored;
  }, [baseline, manifest, resources, corridor, fillRoots, habitat]);
  const buffers = useLoader(THREE.FileLoader, layers.map((layer) => `${ROOT}/${layer.file}`), (loader) => loader.setResponseType('arraybuffer'));
  const result = useMemo(() => {
    gltf.scene.updateMatrixWorld(true); const prototypes = new Map();
    gltf.scene.traverse((o) => { if (o.isMesh) prototypes.set(`${o.userData.layer}:${o.userData.variant}`, o); });
    const group = new THREE.Group(); group.name = 'Authored meadow roots';
    const material = new THREE.MeshStandardMaterial({ color: 'white', roughness: .9, side: THREE.DoubleSide });
    if (!baseline) applyGrassHabitat(applyBlenderDisplay(material, resources), refinement, corridor);
    // Layers 2/3 (three-triangle strips) get calibrated shading; foreground layers keep the shared material untouched.
    const stripMaterial = !baseline && corridor && stripNormals !== 'previous' ? new THREE.MeshStandardMaterial({ color: 'white', roughness: .9, side: THREE.DoubleSide }) : null;
    if (stripMaterial) applyGrassHabitat(applyBlenderDisplay(stripMaterial, resources), refinement, corridor, STRIP_SHADING[resolve === 'linear' ? 'linear' : 'display']);
    material.userData.lookRole = 'grassNear'; material.userData.baseColor = material.color.clone();
    if (stripMaterial) { stripMaterial.userData.lookRole = 'grassFar'; stripMaterial.userData.baseColor = stripMaterial.color.clone(); }
    const geometries = []; const matrix = new THREE.Matrix4(); const tint = new THREE.Color(); const driftColor = new THREE.Color();
    const viewCamera=authoredCamera(manifest,size.width/size.height); const viewProjection=new THREE.Matrix4().multiplyMatrices(viewCamera.projectionMatrix,viewCamera.matrixWorldInverse); const projected=new THREE.Vector3();
    const sources = layers.map((layer, i) => ({ layer, buffer: buffers[i] }));
    // 'blades' mode: real foreground blades (full shape up close, the three-triangle silhouette farther out) with the foreground material, tapering in density, plus real flowers.
    if (meadowDetail && meadowMode === 'blades' && corridor && !baseline && !habitat) {
      const base = layers.findIndex((l) => l.layer === 0 && !String(l.file).includes('fill'));
      if (base >= 0) {
        const templates = new Float32Array(buffers[base]); const bank = bankLowering.current; const occupied = occupancyMap(templates);
        const exclude = (x, z) => Boolean(clearing && clearing.softness(x, z) < 0.7) || Boolean(bank?.nearWater(x, z, 3.5));
        const make = (options, silhouette, tag) => { const records = synthesizeMeadow(templates, farField, { occupied, exclude, options: { ...SYNTH, ...options } }); if (records.length) sources.push({ layer: { ...layers[base], source: tag, file: 'synthetic', synthetic: true, silhouette, count: records.length / 9, stride: 9 }, buffer: records.buffer }); };
        make({ from: 32, to: 60, nearDensity: 85, farDensity: 50 }, false, 'Real blades (middle ground)');
        make({ from: 58, to: 112, nearDensity: 50, farDensity: 16 }, true, 'Real blades (far)');
      }
    }
    if(habitat && corridor && !baseline) {
      group.userData.habitat={ mapSize:[habitat.config.width,habitat.config.height] };
      const base=layers.findIndex(l=>l.layer===0 && !String(l.file).includes('fill'));
      const growth=growHabitatGrass(new Float32Array(buffers[base]),farField,habitat,{bank:bankLowering.current});
      group.userData.habitat.nearGrass=growth.near.length/9;group.userData.habitat.farGrass=growth.far.length/9;
      for(const [records,silhouette,tag] of [[growth.near,false,'Shared habitat middle grass'],[growth.far,true,'Shared habitat receding grass']])if(records.length)sources.push({layer:{...layers[base],source:tag,file:'habitat',synthetic:true,silhouette,count:records.length/9,stride:9},buffer:records.buffer});
    }
    // Retain the actual curved source blades in the visible middle meadow.
    // Stagger the handover to the strip LOD instead of reducing an entire layer at once.
    const resolvedSources = habitat ? sources.flatMap(({layer,buffer}) => layer.layer>=2 ? [
      {layer:{...layer,readable:true,lodBand:'middle'},buffer},
      {layer:{...layer,lodBand:'far'},buffer},
    ] : [{layer,buffer}]) : sources;
    resolvedSources.forEach(({ layer, buffer }) => {
      let records = new Float32Array(buffer); let count = layer.count;
      if (trackField && !baseline && !layer.synthetic) { records = fillTrackGrass(records, count, layer.stride || 8, trackField); count = records.length / (layer.stride || 8); }
      for (let variant = 0; variant < 12; variant += 1) {
        const source = prototypes.get(`${layer.layer}:${variant}`);
        if (!source) throw new Error(`Missing grass prototype ${layer.layer}:${variant}`);
        const indices = []; const softs = [];
        for (let i = 0; i < count; i += 1) {
          const offset=i*(layer.stride||8); if(records[offset+7]!==variant)continue;
          if(layer.lodBand){
            const distance=Math.hypot(records[offset]+3,-records[offset+1]-10);
            const cutoff=112+26*habitatHash(records[offset],records[offset+1],73);
            if((distance<cutoff)!==(layer.lodBand==='middle'))continue;
          }
          if(habitat && Math.hypot(records[offset]+3,-records[offset+1]-10)>32) {
            const h=habitat.sample(records[offset],-records[offset+1]);
            if(h.density<.025 && layer.synthetic)continue;
            if(layer.layer>=2 && habitatHash(records[offset],records[offset+1],91)>.40+.92*h.density)continue;
          }
          const soft=clearing?clearing.softness(records[offset],-records[offset+1]):1; if(soft===0)continue; // mown ground (Blender y is Three -z); shorter grass in the ring around it
          if(corridor && !baseline) {
            if(layer.layer>=2 || layer.synthetic) {
              projected.set(records[offset],records[offset+2],-records[offset+1]).applyMatrix4(viewProjection);
              if(Math.abs(projected.x)>1.2 || Math.abs(projected.y)>1.2 || projected.z>1)continue;
            } else if(!keepResolvedGrass(records,offset,manifest.camera))continue;
          }
          indices.push(i); softs.push(soft);
        }
        let geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
        if (!baseline && refinement) {
          geometry.deleteAttribute('normal');
          const smooth = mergeVertices(geometry, 1e-5); geometry.dispose(); geometry = smooth; geometry.computeVertexNormals();
        }
        if (corridor && !baseline && ((layer.layer >= 2 && !layer.readable) || layer.silhouette)) {
          const silhouette = distantBladeGeometry(geometry); geometry.dispose(); geometry = silhouette;
        }
        geometries.push(geometry);
        const mesh = new THREE.InstancedMesh(geometry, layer.layer >= 2 && stripMaterial && !layer.synthetic && !layer.readable ? stripMaterial : material, indices.length); mesh.name = `${layer.source} / shape ${variant}`;
        indices.forEach((record, i) => {
          const offset = record * (layer.stride || 8); const placed = grassMatrix(records, offset, matrix, baseline ? records[offset + 4] : records[offset + 8] * (.75+.25*softs[i]));
          // Only the hamlet's tended ring is shortened; open meadow stays untouched.
          if(!baseline&&softs[i]<1){placed.elements[0]*=softs[i];placed.elements[2]*=softs[i];placed.elements[4]*=softs[i];placed.elements[5]*=softs[i];placed.elements[6]*=softs[i];}
          if (bankLowering.current && !(habitat && layer.synthetic)) placed.elements[13] += bankLowering.current.offsetAt(records[offset], -records[offset + 1], records[offset + 2]);
          if(habitat && !layer.synthetic) {
            const d=Math.hypot(records[offset]+3,-records[offset+1]-10),fade=habitatSmooth(32,60,d),h=habitat.sample(records[offset],-records[offset+1]);
            const scale=1+((.45+1.10*h.height)-1)*fade;
            placed.elements[4]*=scale;placed.elements[5]*=scale;placed.elements[6]*=scale;
          }
          if(habitat){
            // Keep narrow leaves from collapsing into unstable subpixel hair.
            // X is the blade reach; Z is independent leaf width. Near meadow is unchanged.
            const reach=Math.hypot(records[offset]+3,-records[offset+1]-10);
            const leafWidth=1+.55*habitatSmooth(32,125,reach);
            placed.elements[8]*=leafWidth;placed.elements[9]*=leafWidth;placed.elements[10]*=leafWidth;
          }
          mesh.setMatrixAt(i, placed);
          tint.fromArray(manifest.grassPalette[records[offset + 6]]);
          if (meadowDetail && !habitat && (layer.layer >= 2 || layer.synthetic)) tint.multiplyScalar(meadowBladeTint(records[offset], -records[offset + 1], layer.file.includes('fill')));
          if (meadowDetail && !habitat && layer.synthetic) { // flowering drifts through the blade colour, fading in from about 40 m
            const wx = records[offset], wz = -records[offset + 1]; const reach = Math.min(1, Math.max(0, (Math.hypot(wx + 3, wz - 10) - 42) / 60)); const drift = flowerDrift(wx, wz);
            // per-blade breakup: a drift is a scatter of flowering blades among green ones, not a uniform wash (which read as a pale stripe)
            const jitter = Math.sin(i * 12.9898 + records[offset] * 78.233) * 43758.5453; const flecks = Math.max(0, (jitter - Math.floor(jitter)) * 1.6 - 0.45);
            if (drift.amount * reach > 0.01) tint.lerp(driftColor.setRGB(drift.rgb[0], drift.rgb[1], drift.rgb[2]), Math.min(0.5, drift.amount * reach * flecks * 0.8));
          }
          if(habitat && Math.hypot(records[offset]+3,-records[offset+1]-10)>32)tintHabitatBlade(tint,habitat.sample(records[offset],-records[offset+1]),habitatSmooth(32,60,Math.hypot(records[offset]+3,-records[offset+1]-10)));
          if(habitat){ // flowering communities: some of the blades inside a drift take its colour, so the drift reads as colour even where individual flowers are too small
            const bx=records[offset],bz=-records[offset+1];
            if(Math.hypot(bx+3,bz-10)>38){const hs=habitat.sample(bx,bz);const c=communityAt(bx,bz,hs.moisture);if(c.strength>.08&&habitatHash(bx,bz,131)<c.strength*.7*Math.min(1.5,scatterDensity(bx,bz))*(1+.9*slopeFacing(bankLowering.current,bx,bz)))tint.lerp(driftColor.setRGB(...COMMUNITIES[c.kind].rgb),.45+.3*habitatHash(bx,bz,132));}
          }
          mesh.setColorAt(i, tint);
        });
        mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.receiveShadow = new URLSearchParams(window.location.search).get('grassshadow') !== '0';
        mesh.castShadow = layer.layer === 0 && !layer.synthetic; group.add(mesh);
      }
    });
    // Tuft cards for the middle and far meadow, baked from the real foreground blades and flower models (see tuftBake.js).
    let tufts = null;
    if(habitat && flowers) {
      const placed=placeHabitatFlowers(farField,habitat,manifest,{bank:bankLowering.current});
      const real=buildRealFlowerGroup({flowerScene:flowers.scene,placed,resources,maxFlowers:4500,naturalScale:true,receiveShadow:true});group.add(real.group);group.userData.habitat.flowers=real.total;
      const split=splitFlowers(placeCommunityFlowers(farField,habitat,{bank:bankLowering.current}),62); // detailed models close to the camera, the lowest level of detail beyond (a flower there is a few pixels)
      const communityNear=buildRealFlowerGroup({flowerScene:flowers.scene,placed:split.near,resources,maxFlowers:9000,mix:COMMUNITY_MIX,keepScale:true,receiveShadow:true,preferLod:1,name:'Flowering communities (near)'});const communityFar=buildRealFlowerGroup({flowerScene:flowers.scene,placed:split.far,resources,maxFlowers:9000,mix:COMMUNITY_MIX,keepScale:true,receiveShadow:true,preferLod:2,name:'Flowering communities (far)'});
      const community={group:new THREE.Group(),total:communityNear.total+communityFar.total,dispose:()=>{communityNear.dispose();communityFar.dispose();}};community.group.add(communityNear.group,communityFar.group);group.add(community.group);group.userData.habitat.communityFlowers=community.total;
      tufts={group:real.group,dispose:()=>{real.dispose();community.dispose();}};
    } else if (meadowDetail && meadowMode === 'blades' && corridor && !baseline && flowers) {
      const grassIndex = layers.findIndex((l) => l.layer === 0 && !String(l.file).includes('fill'));
      if (grassIndex >= 0) {
        // real flower models where they are big enough to read (to about 60 m); no grass cards in this mode
        const templates = new Float32Array(buffers[grassIndex]); const placed = placeMeadow({ palette: manifest.grassPalette, grassTemplates: templates, field: farField, clearing }); const split = splitFlowers(placed, 60);
        const real = buildRealFlowerGroup({ flowerScene: flowers.scene, placed: split.near, resources, maxFlowers: 1800 });
        // beyond that the flowers are soft colour drifts in the ground shader (meadowDetail.js): flower objects there read as boxes, while a real far meadow reads as colour
        group.add(real.group); tufts = { group: real.group, dispose: () => real.dispose() };
      }
    } else if (meadowDetail && corridor && !baseline && flowers) {
      const grassIndex = layers.findIndex((l) => l.layer === 0 && !String(l.file).includes('fill')); const basalIndex = layers.findIndex((l) => l.layer === 1 && !String(l.file).includes('fill'));
      if (grassIndex >= 0 && basalIndex >= 0) { tufts = buildTuftGroup({ renderer: gl, prototypes, flowerScene: flowers.scene, grassTemplates: new Float32Array(buffers[grassIndex]), basalTemplates: new Float32Array(buffers[basalIndex]), palette: manifest.grassPalette, field: farField, clearing, resources, refinement, corridor }); group.add(tufts.group); }
    }
    return { group, tufts, dispose: () => { tufts?.dispose(); group.children.forEach((o) => o.dispose?.()); geometries.forEach((g) => g.dispose()); material.dispose(); stripMaterial?.dispose(); } };
  }, [layers, manifest, gltf, buffers, resources, baseline, refinement, corridor, stripNormals, resolve, size.width, size.height, clearing, trackField, meadowDetail, meadowMode, farField, gl, flowers, habitat]);
  useEffect(() => () => result.dispose(), [result]);
  return <primitive object={result.group} />;
}

function Flowers({ manifest, gltf, resources, baseline, flowerFilter, flowerStyle, clearing }) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const result = useMemo(() => {
    gltf.scene.updateMatrixWorld(true); const group = new THREE.Group(); const owned = [];
    gltf.scene.traverse((source) => {
      if (!source.isMesh) return;
      const species = inheritedMetadata(source, 'species'); let records = manifest.flowers[species];
      if (!records) return;
      const lod = inheritedMetadata(source, 'lod') ?? 0;
      if (clearing) records = records.filter((record) => clearing.softness(record[12], record[14]) > 0.7);
      if (!baseline && species === 'Red Clover') { // the dark magenta heads were too many: keep a share (?clover=0.4 by default, 0 removes them, 1 restores all)
        const asked = new URLSearchParams(window.location.search).get('clover'); const keep = asked === null ? 0.4 : Number(asked);
        records = records.filter((record, index) => ((Math.sin(index * 12.9898 + record[12] * 78.233 + record[14] * 37.719) * 43758.5453) % 1 + 1) % 1 < keep);
      }
      if (!baseline) records = records.filter((record) => {
        const distance = Math.hypot(record[12] - manifest.camera.matrix[12], record[14] - manifest.camera.matrix[14]);
        return (distance < 26 ? 0 : distance < 65 ? 1 : 2) === lod;
      });
      if (!records.length) return;
      const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
      const originals = Array.isArray(source.material) ? source.material : [source.material];
      const materials = originals.map((original) => {
        const material = original.clone(); material.transparent = false; material.alphaTest = .3; material.side = THREE.DoubleSide; material.roughness = .8;
        if (!baseline) applyBlenderDisplay(material, resources);
        if (!baseline && flowerStyle !== 'previous') applyFlowerResponse(material);
        if (!baseline && material.map) {
          const anisotropy = flowerFilter === 'previous' ? 1 : Math.min(FLOWER_ANISOTROPY, maxAnisotropy);
          if (material.map.anisotropy !== anisotropy) { material.map.anisotropy = anisotropy; material.map.needsUpdate = true; }
        }
        material.userData.lookRole = 'flowers'; material.userData.baseColor = material.color.clone();
        return material;
      });
      const mesh = new THREE.InstancedMesh(geometry, Array.isArray(source.material) ? materials : materials[0], records.length);
      mesh.name = `${species} LOD ${lod}`; const matrix = new THREE.Matrix4();
      records.forEach((record, index) => { matrix.fromArray(record); if (bankLowering.current) matrix.elements[13] += bankLowering.current.offsetAt(record[12], record[14], record[13]); mesh.setMatrixAt(index, matrix); });
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.castShadow = baseline || lod < 2; mesh.receiveShadow = true;
      group.add(mesh); owned.push({ mesh, geometry, materials });
    });
    return { group, dispose: () => owned.forEach(({ mesh, geometry, materials }) => { mesh.dispose(); geometry.dispose(); materials.forEach((m) => m.dispose()); }) };
  }, [gltf, manifest, resources, baseline, flowerFilter, flowerStyle, maxAnisotropy, clearing]);
  useEffect(() => () => result.dispose(), [result]);
  return <primitive object={result.group} />;
}

// The fixed-camera static pass caches only geography/architecture/tree reflections.
// Grass and flowers remain live geometry in the main view; no second ecosystem render per frame.
function captureBankReflection(renderer, scene, camera, group, reflector, content = 'none') {
  scene.updateMatrixWorld(true);
  let water;
  group.traverse((object) => { if (object.isMesh && inheritedMetadata(object, 'echelonRole') === 'water') water = object; });
  if (!water?.material.uniforms?.reflectionReady) return null;
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(.55, -.6), camera);
  const hit = ray.intersectObject(water)[0];
  const height = hit?.point.y ?? new THREE.Box3().setFromObject(water).getCenter(new THREE.Vector3()).y;
  reflector.position.y = height; reflector.updateMatrixWorld(true);
  const hidden = [];
  scene.traverse((object) => {
    // 'full' reflects the real scene (every grass layer and the flowers); 'near' keeps only the two foreground grass layers; 'none' keeps no vegetation.
    const keep = content !== 'none' && object.isInstancedMesh && (content === 'full' ? REFLECTION_GRASS_NAME.test(object.name) || REFLECTION_FLOWER_NAME.test(object.name) : REFLECTION_NEAR_GRASS_NAME.test(object.name));
    if (((object.isInstancedMesh && !keep) || object === water || object.name === 'sediment') && object.visible) { hidden.push(object); object.visible = false; }
  });
  const automatic = renderer.info.autoReset; renderer.info.autoReset = false; renderer.info.reset();
  const context = renderer.getContext(); const timer = context.getExtension('EXT_disjoint_timer_query_webgl2');
  const query = timer ? context.createQuery() : null;
  if (query) context.beginQuery(timer.TIME_ELAPSED_EXT, query);
  try { reflector.onBeforeRender(renderer, scene, camera); }
  finally { if (query) context.endQuery(timer.TIME_ELAPSED_EXT); hidden.forEach((o) => { o.visible = true; }); renderer.info.autoReset = automatic; }
  const uniforms = water.material.uniforms;
  uniforms.reflectionMap.value = reflector.getRenderTarget().texture;
  uniforms.reflectionMatrix.value.copy(reflector.material.uniforms.textureMatrix.value).multiply(new THREE.Matrix4().copy(reflector.matrixWorld).invert());
  uniforms.reflectionHeight.value = height; uniforms.reflectionReady.value = 1;
  return { query, height, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, resolution: [reflector.getRenderTarget().width, reflector.getRenderTarget().height], content, cached: true, captures: 1 };
}

// The elevated stream sits at the camera's own height, so a mirror at its exact plane is unusable; mirroring about a plane just below the camera is visually the same.
function captureTributaryReflection(renderer, scene, camera, group, reflector) {
  scene.updateMatrixWorld(true);
  let water; group.traverse((object) => { if (object.isMesh && inheritedMetadata(object, 'echelonRole') === 'water') water = object; });
  if (!water?.material.uniforms?.reflectionReady2) return null;
  const poolHeight = water.material.uniforms.reflectionHeight.value; const position = water.geometry.attributes.position; const high = []; const v = new THREE.Vector3(); camera.updateMatrixWorld(true); const eye = camera.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < position.count; i += 5) { v.fromBufferAttribute(position, i).applyMatrix4(water.matrixWorld); const d = v.distanceTo(eye); if (v.y > poolHeight + 0.4 && d > 70 && d < 220) high.push(v.y); }
  if (!high.length) return null;
  high.sort((a, b) => a - b); const streamHeight = high[Math.floor(high.length / 2)]; const height = Math.min(streamHeight - 0.02, eye.y - 0.06);
  reflector.position.y = height; reflector.updateMatrixWorld(true);
  const hidden = [];
  scene.traverse((object) => {
    const keep = object.isInstancedMesh && (REFLECTION_GRASS_NAME.test(object.name) || REFLECTION_FLOWER_NAME.test(object.name));
    if (((object.isInstancedMesh && !keep) || object === water || object.name === 'sediment') && object.visible) { hidden.push(object); object.visible = false; }
  });
  try { reflector.onBeforeRender(renderer, scene, camera); } finally { hidden.forEach((o) => { o.visible = true; }); }
  const uniforms = water.material.uniforms; uniforms.reflectionMap2.value = reflector.getRenderTarget().texture;
  uniforms.reflectionMatrix2.value.copy(reflector.material.uniforms.textureMatrix.value).multiply(new THREE.Matrix4().copy(reflector.matrixWorld).invert());
  uniforms.reflectionHeight2.value = height; uniforms.reflectionReady2.value = 1;
  const result = { height, streamHeight, samples: high.length, resolution: [reflector.getRenderTarget().width, reflector.getRenderTarget().height] }; if (window.__echelonPrototype) window.__echelonPrototype.tributary = result; return result;
}

function captureWaterBed(renderer, scene, camera, group, target) {
  let water; group.traverse((o) => { if (o.isMesh && inheritedMetadata(o, 'echelonRole') === 'water') water = o; });
  if (!water?.material.uniforms?.bedReady) return null;
  const context = renderer.getContext(); const timer = context.getExtension('EXT_disjoint_timer_query_webgl2'); const query = timer ? context.createQuery() : null;
  const previous = renderer.getRenderTarget(); const shadows = renderer.shadowMap.autoUpdate; const visible = water.visible;
  renderer.info.reset(); water.visible = false; renderer.shadowMap.autoUpdate = false;
  if(query) context.beginQuery(timer.TIME_ELAPSED_EXT,query);
  try { renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene,camera); }
  finally { if(query) context.endQuery(timer.TIME_ELAPSED_EXT); renderer.setRenderTarget(previous); renderer.shadowMap.autoUpdate=shadows; water.visible=visible; }
  const uniforms=water.material.uniforms; uniforms.bedColor.value=target.texture; uniforms.bedDepth.value=target.depthTexture;
  uniforms.viewportSize.value.copy(renderer.getDrawingBufferSize(new THREE.Vector2())); uniforms.cameraRange.value.set(camera.near,camera.far); uniforms.bedReady.value=1;
  return { query, calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resolution:[target.width,target.height],captures:1,cached:true };
}

function BankReflection({ geography, enabled, corridor, waterRefine, reflectionMode }) {
  const renderer = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const bufferWidth = useThree((state) => Math.round(state.size.width * state.viewport.dpr));
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const real = Boolean(corridor && waterRefine) && reflectionMode !== 'previous';
  const [reflectionWidth, reflectionHeight] = real ? reflectionSize(bufferWidth) : [640, 360];
  const reflector = useMemo(() => {
    const object = new Reflector(new THREE.PlaneGeometry(1, 1), { textureWidth: reflectionWidth, textureHeight: reflectionHeight, multisample: 0, clipBias: .001 });
    object.rotation.x = -Math.PI / 2;
    const texture = object.getRenderTarget().texture; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.anisotropy = real ? Math.min(8, maxAnisotropy) : 1;
    return object;
  }, [reflectionWidth, reflectionHeight, real, maxAnisotropy]);
  const reflector2 = useMemo(() => {
    const object = new Reflector(new THREE.PlaneGeometry(1, 1), { textureWidth: reflectionWidth, textureHeight: reflectionHeight, multisample: 0, clipBias: .001 });
    object.rotation.x = -Math.PI / 2;
    const texture = object.getRenderTarget().texture; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.anisotropy = real ? Math.min(8, maxAnisotropy) : 1;
    return object;
  }, [reflectionWidth, reflectionHeight, real, maxAnisotropy]);
  const bedTarget = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1280,720,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
    target.depthTexture=new THREE.DepthTexture(1280,720,THREE.UnsignedIntType); return target;
  }, []);
  const state = useRef({ frames: 0, result: null, bed: null, captures: 0 });
  useEffect(() => {
    state.current = { frames: 0, result: null, bed: null, captures: 0 }; invalidate();
    return () => { for (const result of [state.current.result,state.current.bed]) if(result?.query) renderer.getContext().deleteQuery(result.query); };
  }, [geography, enabled, corridor, camera, renderer, invalidate, reflector, reflector2]);
  useFrame(({ gl, scene, camera }) => {
    if (!enabled) return;
    const current = state.current; current.frames += 1;
    if(window.__echelonPrototype && !window.__echelonPrototype.refreshWaterOptics) window.__echelonPrototype.refreshWaterOptics=() => {
      for(const result of [current.result,current.bed]) if(result?.query) gl.getContext().deleteQuery(result.query);
      current.frames=0;current.result=null;current.bed=null;invalidate();
    };
    if (current.frames === 1) { invalidate(); return; } // First main pass establishes its shadow map.
    if (current.frames === 2) {
      current.result = captureBankReflection(gl, scene, camera, geography.group, reflector, corridor && waterRefine ? (real ? 'full' : 'near') : 'none');
      if (real) current.tributary = captureTributaryReflection(gl, scene, camera, geography.group, reflector2);
      if(corridor) current.bed=captureWaterBed(gl,scene,camera,geography.group,bedTarget);
      current.captures+=1;
      for(const result of [current.result,current.bed]) if(result) result.captures=current.captures;
    }
    if (window.__echelonPrototype) window.__echelonPrototype.tributary = current.tributary ?? 'not captured';
    for (const [label, result] of [['reflection',current.result],['waterBed',current.bed]]) {
    if (!result) continue;
    const context = gl.getContext(); const timer = context.getExtension('EXT_disjoint_timer_query_webgl2');
    if (result.query && context.getQueryParameter(result.query, context.QUERY_RESULT_AVAILABLE)) {
      if (!context.getParameter(timer.GPU_DISJOINT_EXT)) result.gpuMilliseconds = context.getQueryParameter(result.query, context.QUERY_RESULT) / 1e6;
      context.deleteQuery(result.query); result.query = null;
    }
    if (window.__echelonPrototype) { const diagnostic = { ...result }; delete diagnostic.query; window.__echelonPrototype[label] = diagnostic; }
    }
  });
  useEffect(() => () => { reflector.geometry.dispose(); reflector.dispose(); }, [reflector]);
  useEffect(() => () => { reflector2.geometry.dispose(); reflector2.dispose(); }, [reflector2]);
  useEffect(() => () => { bedTarget.dispose(); }, [bedTarget]);
  return null;
}

function Measurements({ manifest, pipeline, onReady }) {
  const state = useRef({ last: null, frames: 0, durations: [], cpu: [], gpu: [], pending: [], sent: 0 });
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const context = gl.getContext();
    const extension = context.getExtension('WEBGL_debug_renderer_info');
    window.__echelonPrototype = {
      ready: true, manifest, totalFrames: state.current.frames,
      renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER),
      inventory: (() => {
        scene.updateMatrixWorld(true); const trees = [];
        scene.traverse((object) => {
          if (!object.isMesh || inheritedMetadata(object, 'echelonRole') !== 'tree') return;
          const box = new THREE.Box3().setFromObject(object); const projected = [];
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) projected.push(new THREE.Vector3(x, y, z).project(camera).toArray());
          trees.push({ name: object.name, visible: object.visible, worldBounds: [box.min.toArray(), box.max.toArray()], matrixWorld: object.matrixWorld.toArray(), projectedBounds: [0, 1].map((axis) => [Math.min(...projected.map((p) => p[axis])), Math.max(...projected.map((p) => p[axis]))]), alphaTest: object.material.alphaTest });
        });
        const grass = { instances: 0, prototypeVertices: 0, habitat: null };
        scene.traverse((o) => { if(o.userData?.habitat)grass.habitat=o.userData.habitat; if (o.isInstancedMesh && o.parent?.name === 'Authored meadow roots') { grass.instances += o.count; grass.prototypeVertices += o.geometry.attributes.position.count; } });
        return { trees, grass, msaaSamples: context.getParameter(context.SAMPLES) };
      })(),
      timerAvailable: Boolean(context.getExtension('EXT_disjoint_timer_query_webgl2')),
      camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov },
    };
    onReady();
    return () => { delete window.__echelonPrototype; };
  }, [gl, camera, scene, manifest, onReady]);
  useFrame(({ gl: renderer, scene, camera: currentCamera }) => {
    const clock = performance.now();
    const sample = state.current;
    const context = renderer.getContext();
    const timer = context.getExtension('EXT_disjoint_timer_query_webgl2');
    const warming = sample.frames < 60;
    if (sample.last && !warming) {
      sample.durations.push(clock - sample.last);
      if (sample.durations.length > 600) sample.durations.shift();
    }
    sample.last = clock; sample.frames += 1;
    if (window.__echelonPrototype) window.__echelonPrototype.totalFrames = sample.frames;
    let query = null;
    if (timer && sample.frames % 10 === 0 && sample.pending.length < 4) {
      query = context.createQuery(); context.beginQuery(timer.TIME_ELAPSED_EXT, query);
    }
    renderer.info.autoReset = false; renderer.info.reset();
    if (pipeline) pipeline.render(scene, currentCamera); else renderer.render(scene, currentCamera);
    if (query) { context.endQuery(timer.TIME_ELAPSED_EXT); sample.pending.push(query); }
    if (!warming) { sample.cpu.push(performance.now() - clock); if (sample.cpu.length > 600) sample.cpu.shift(); }
    if (timer) {
      const disjoint = context.getParameter(timer.GPU_DISJOINT_EXT);
      sample.pending = sample.pending.filter((item) => {
        if (disjoint) { context.deleteQuery(item); return false; }
        if (!context.getQueryParameter(item, context.QUERY_RESULT_AVAILABLE)) return true;
        if (!disjoint && !warming) { sample.gpu.push(context.getQueryParameter(item, context.QUERY_RESULT) / 1e6); if (sample.gpu.length > 120) sample.gpu.shift(); }
        context.deleteQuery(item); return false;
      });
    }
    if (clock - sample.sent > 1000 && window.__echelonPrototype) {
      sample.sent = clock;
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const metrics = {
        frames: sample.frames, samples: sample.durations.length,
        rafP50ms: percentile(sample.durations, .5), rafP95ms: percentile(sample.durations, .95),
        cpuSubmitP50ms: percentile(sample.cpu, .5), gpuP50ms: percentile(sample.gpu, .5), gpuP95ms: percentile(sample.gpu, .95), gpuSamples: sample.gpu.length,
        callsAllPasses: renderer.info.render.calls, trianglesAllPasses: renderer.info.render.triangles,
        geometryResources: renderer.info.memory.geometries, textureResources: renderer.info.memory.textures,
        programs: renderer.info.programs.length, drawingBuffer: size.toArray(), dpr: renderer.getPixelRatio(),
      };
      window.__echelonPrototype.metrics = metrics;
      window.dispatchEvent(new CustomEvent('echelon-prototype-metrics', { detail: metrics }));
    }
  }, 1);
  useEffect(() => () => { const context = gl.getContext(); state.current.pending.forEach((q) => context.deleteQuery(q)); }, [gl]);
  return null;
}

// Applies the look-dev sliders to the live scene. At the defaults every value equals the scene's own, so nothing changes.
function LookDevBridge({ baseline, resources, manifest }) {
  const gl = useThree((state) => state.gl); const scene = useThree((state) => state.scene); const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const base = { exposure: baseline ? .7 : resources.metadata.display.exposure, environmentIntensity: scene.environmentIntensity, fogDensity: scene.fog?.density ?? 0 };
    let timer = 0; const ref = { sunDir: manifest.sun.direction, sunColor: manifest.sun.color, sunEnergy: manifest.sun.sourceEnergy, fogColor: '#bacad8' };
    const apply = (refreshOptics) => {
      const moment = baseline || isApprovedHeld() ? null : currentMoment();
      applyLook({ scene, gl }, getLook(), applyTimeOfDay(scene, ref, moment, base)); invalidate();
      // The cached reflection and bed capture contain terrain, hamlet and light, so refresh them shortly after a change settles.
      if (refreshOptics) { clearTimeout(timer); timer = setTimeout(() => window.__echelonPrototype?.refreshWaterOptics?.(), 250); }
    };
    apply(false); const unsubscribe = subscribeLook(() => apply(true)); const unsubscribeTod = subscribeTod(() => apply(true));
    const tick = window.setInterval(() => { if (getTod().mode === 'live') apply(true); }, 30000);
    return () => { unsubscribe(); unsubscribeTod(); window.clearInterval(tick); clearTimeout(timer); };
  }, [gl, scene, invalidate, baseline, resources, manifest]);
  return null;
}

function attachSceneHabitat(group,field,clearing,roots) {
  const habitat=createMeadowHabitat({group,field,clearing,roots,bank:bankLowering.current});
  group.traverse(o=>{if(!o.isMesh || inheritedMetadata(o,'echelonRole')!=='terrain')return;for(const material of Array.isArray(o.material)?o.material:[o.material])applyHabitatMaterial(material,habitat);});
  return habitat;
}

function Scene({ vegetation, waterMode, look, surfaceDetail, refinement, corridor, stripNormals, resolve, flowerFilter, waterRefine, terrainFilter, fillRoots, treeStyle, flowerStyle, reflectionMode, hamletStyle, meadowStyle, onReady }) {
  const sharedHabitat = meadowStyle === 'habitat';
  const meadowDetail = meadowStyle !== 'previous' && !(look === 'baseline');
  const meadowMode = meadowStyle === 'cards' ? 'cards' : 'blades'; // real blades and flowers by default; ?meadow=cards uses the baked tuft cards
  const hamletNew = hamletStyle !== 'previous' && !(look === 'baseline');
  const clearing = useMemo(() => (hamletNew ? createHamletClearing() : null), [hamletNew]);
  const pathMaskBuffer = useLoader(THREE.FileLoader, `${ROOT}/terrain-path-mask.bin`, (loader) => loader.setResponseType('arraybuffer'));
  const pathMask = useMemo(() => new Uint8Array(pathMaskBuffer), [pathMaskBuffer]);
  const realReflection = Boolean(corridor && waterRefine) && reflectionMode !== 'previous';
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const terrainAnisotropy = terrainFilter === 'previous' ? 1 : Math.min(TERRAIN_ANISOTROPY, maxAnisotropy);
  const canopyAnisotropy = terrainFilter === 'previous' ? 2 : terrainAnisotropy;
  const manifest = useLoader(THREE.FileLoader, `${ROOT}/manifest.json`, (loader) => loader.setResponseType('json'));
  const resources = useParityResources();
  const baseline = look === 'baseline';
  const [geography, flowers, grass] = useLoader(GLTFLoader, ['geography.glb', baseline ? 'flowers.glb' : 'flowers-lod.glb', baseline ? 'grass.glb' : 'grass-parity.glb'].map((file) => `${ROOT}/${file}`));
  const geometry = useMemo(() => prepareGeography(geography, waterMode, resources, baseline, surfaceDetail, refinement, corridor, waterRefine, { terrain: terrainAnisotropy, canopy: canopyAnisotropy }, treeStyle, realReflection, hamletNew, pathMask, meadowDetail && !sharedHabitat), [geography, waterMode, resources, baseline, surfaceDetail, refinement, corridor, waterRefine, terrainAnisotropy, canopyAnisotropy, treeStyle, realReflection, hamletNew, pathMask, meadowDetail, sharedHabitat]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const farMeta=useLoader(THREE.FileLoader,`${ROOT}/far-heights.json`,loader=>loader.setResponseType('json'));
  const farRaw=useLoader(THREE.FileLoader,`${ROOT}/far-heights.bin`,loader=>loader.setResponseType('arraybuffer'));
  const nativeRoots=useLoader(THREE.FileLoader,`${ROOT}/${resources.metadata.grass[0].file}`,loader=>loader.setResponseType('arraybuffer'));
  const habitat=useMemo(()=>{
    if(!sharedHabitat)return null;
    return attachSceneHabitat(geometry.group,new HeightField(farMeta,new Float32Array(farRaw)),clearing,new Float32Array(nativeRoots));
  },[sharedHabitat,geometry,farMeta,farRaw,clearing,nativeRoots]);
  useEffect(()=>()=>habitat?.dispose(),[habitat]);
  const gl = useThree((state) => state.gl);
  const pipeline = useMemo(() => (resolve === 'linear' && !baseline ? createLinearResolve(gl, resources.displayLut, resources.metadata.display) : null), [gl, resolve, baseline, resources]);
  useEffect(() => () => pipeline?.dispose(), [pipeline]);
  return <>
    <Camera manifest={manifest} />
    <SourceExposure resources={resources} baseline={baseline} />
    <Daylight manifest={manifest} resources={resources} baseline={baseline} />
    <primitive object={geometry.group} />
    {hamletNew && <Hamlet terrain={geometry.group} resources={resources} mode={hamletStyle === 'blockout' ? 'blockout' : 'detailed'} />}
    {vegetation && <><Grass manifest={manifest} gltf={grass} resources={resources} baseline={baseline} refinement={refinement} corridor={corridor} stripNormals={stripNormals} resolve={resolve} fillRoots={fillRoots} clearing={clearing} meadowDetail={meadowDetail} meadowMode={meadowMode} flowers={flowers} habitat={habitat} /><Flowers manifest={manifest} gltf={flowers} resources={resources} baseline={baseline} flowerFilter={flowerFilter} flowerStyle={flowerStyle} clearing={clearing} /></>}
    {!baseline && <GeneratedSky resources={resources} />}
    <LookDevBridge baseline={baseline} resources={resources} manifest={manifest} />
    <BankReflection geography={geometry} corridor={corridor} waterRefine={waterRefine} reflectionMode={reflectionMode} enabled={!baseline && refinement && waterMode === 'fresnel'} />
    <Measurements key={`${vegetation}-${waterMode}-${look}-${surfaceDetail}-${refinement}-${corridor}-${resolve}`} manifest={manifest} pipeline={pipeline} onReady={onReady} />
  </>;
}

// Linear-light resolve is the default: blending MSAA samples after the display transform darkens silhouettes against the bright sky
// (dotted dark fringes along the ridges). resolve='display', stripNormals='previous' and flowerFilter='previous' reproduce the earlier renderer.
export default function AlpinePrototype({ vegetation = true, waterMode = 'fresnel', look = 'parity', surfaceDetail = true, refinement = true, corridor = true, benchmark = false, dpr = 1, stripNormals = 'calibrated', resolve = 'linear', flowerFilter = 'anisotropic', waterPass = 'refined', terrainFilter = 'anisotropic', fillRoots = 'on', treeStyle = 'styled', flowerStyle = 'styled', reflectionMode = 'real', hamletStyle = 'procedural', meadowStyle = 'habitat', onReady }) {
  const baseline = look === 'baseline';
  return <Canvas onCreated={({ gl }) => { gl.debug.checkShaderErrors = new URLSearchParams(window.location.search).has('shaderlog'); /* skipping the blocking link check lets the driver compile programs in parallel; add ?shaderlog=1 to see shader errors */ }} frameloop={benchmark ? 'always' : 'demand'} scene={{ environmentIntensity: baseline ? .12 : 1 }} dpr={dpr} shadows={{ type: THREE.PCFSoftShadowMap }} camera={{ fov: 39.7607076, near: .1, far: 1500 }}
    gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: baseline ? THREE.AgXToneMapping : THREE.CustomToneMapping, toneMappingExposure: baseline ? .7 : 1 }}>
    <Suspense fallback={null}><Scene vegetation={vegetation} waterMode={waterMode} look={look} surfaceDetail={surfaceDetail} refinement={refinement} corridor={corridor} stripNormals={stripNormals} resolve={resolve} flowerFilter={flowerFilter} waterRefine={waterPass !== 'approved'} terrainFilter={terrainFilter} fillRoots={fillRoots} treeStyle={treeStyle} flowerStyle={flowerStyle} reflectionMode={reflectionMode} hamletStyle={hamletStyle} meadowStyle={meadowStyle} onReady={onReady} /></Suspense>
  </Canvas>;
}

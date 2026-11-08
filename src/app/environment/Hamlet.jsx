import { useEffect, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { applyBlenderDisplay } from './alpineParityMaterials.js';
import { ALPINE_ASSET_ROOT } from './alpinePrototypeData.js';
import { HeightField, buildHamlet } from './hamletGeometry.js';
import { bankLowering } from './bankLowering.js';
import { makeHamletTextures } from './hamletTextures.js';
import {applyWindowWarmth} from './hamletWindowLighting.js';
import { attachHamletGround } from './hamletGround.js';

// material key -> [texture key, base colour, roughness, extras]
const SPEC = {
  plaster: ['plaster', '#ffffff', 0.95], timber: ['timber', '#ffffff', 0.85], stone: ['stone', '#ffffff', 0.95], roofSlate: ['roofSlate', '#ffffff', 0.8],
  roofTerracotta: ['roofTerracotta', '#ffffff', 0.8], roofShingle: ['roofShingle', '#ffffff', 0.9], glass: ['plain', '#26313a', 0.18], trim: ['plain', '#ffffff', 0.8],
  wood: ['wood', '#ffffff', 0.85], foliage: ['foliage', '#ffffff', 0.9], bark: ['bark', '#ffffff', 0.95], soil: ['soil', '#ffffff', 1], lane: ['lane', '#716a5e', 0.98],
};

// Ground heights follow the terrain, including any lowered stream bank.
function groundField(meta, raw, bank) {
  const field = new HeightField(meta, new Float32Array(raw)); const base = field.at.bind(field);
  if (bank) field.at = (x, z) => { const h = base(x, z); return h + bank.offsetAt(x, z, h); };
  return field;
}

// The procedural settlement: chapel, homesteads, barn, shed, boundaries and a shared lane, grounded on the delivered terrain heights.
export default function Hamlet({ terrain, resources, mode = 'detailed' }) {
  const invalidate=useThree(state=>state.invalidate);
  const root = ALPINE_ASSET_ROOT;
  const meta = useLoader(THREE.FileLoader, `${root}/hamlet-heights.json`, (loader) => loader.setResponseType('json'));
  const raw = useLoader(THREE.FileLoader, `${root}/hamlet-heights.bin`, (loader) => loader.setResponseType('arraybuffer'));
  const windowGlow = Number(new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('windowglow')) || 0;
  const bank=bankLowering.current;
  const field=useMemo(()=>groundField(meta,raw,bank),[meta,raw,bank]);
  const built = useMemo(() => {
    const textures = makeHamletTextures(); const { geometries, triangles } = buildHamlet(field);
    const group = new THREE.Group(); group.name = 'Procedural hamlet'; const materials = [];
    for (const [key, geometry] of Object.entries(geometries)) {
      const [textureKey, color, roughness] = SPEC[key];
      const blockout = mode === 'blockout'; // flat grey massing for layout review: walls light, roofs dark, ground and lanes neutral
      const material = new THREE.MeshStandardMaterial({ color: blockout ? (key.startsWith('roof') ? '#6c7076' : key === 'lane' ? '#9a8d76' : key === 'foliage' ? '#6d7a62' : '#c3beb4') : color, roughness: blockout ? 1 : roughness, metalness: 0, map: blockout || textureKey === 'plain' ? null : textures[textureKey], vertexColors: !blockout, side: key === 'foliage' || key === 'lane' ? THREE.DoubleSide : THREE.FrontSide });
      if (key === 'lane') { material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -2; }
      if (key === 'glass') { material.emissive = new THREE.Color('#ffb25c'); material.emissiveIntensity = windowGlow; material.userData.windowGlow = true; } // dusk hook: ?windowglow=1
      applyBlenderDisplay(material, resources);
      if(key==='glass')applyWindowWarmth(material);
      material.userData.lookRole = 'hamlet'; material.userData.baseColor = material.color.clone();
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `Hamlet / ${key}`; mesh.castShadow = key !== 'lane' && key !== 'soil'; mesh.receiveShadow = true; group.add(mesh); materials.push(material);
    }
    return { group, triangles, textures, dispose: () => { Object.values(geometries).forEach(g=>g.dispose()); materials.forEach((m) => m.dispose()); Object.values(textures).forEach((t) => t.dispose()); } };
  }, [field, resources, mode, windowGlow]);
  useEffect(() => { if(!terrain)return; const restore=attachHamletGround(terrain,built.textures.lane); invalidate(); return restore; }, [terrain,built,invalidate]);
  useEffect(() => () => built.dispose(), [built]);
  return <primitive object={built.group}/>;
}

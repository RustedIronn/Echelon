import * as THREE from 'three';
import { HAMLET_BUILDINGS, HAMLET_TERRAIN_BOUNDS, footprint } from './hamletLayout.js';

// Makes the hamlet sit in its place rather than on it. Three small, cheap touches, none of which changes the architecture or the layout:
// - walls darken and dirty a little near the ground (rising damp and rain splash), with faint vertical streaks and a slightly different age per building;
// - roofs carry patches of moss and lichen and vary a little from roof to roof;
// - a soft contact shadow skirts every footprint on the ground, so walls meet the earth instead of hovering over clean lawn.

const NOISE_GLSL = `
float hamHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hamNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hamHash(i),hamHash(i+vec2(1,0)),f.x),mix(hamHash(i+vec2(0,1)),hamHash(i+vec2(1,1)),f.x),f.y); }`;

// Ground heights under the hamlet as a small filterable texture (0.5 m cells), so a wall fragment knows how high it is above the earth.
export function makeGroundTexture(field, bounds = HAMLET_TERRAIN_BOUNDS, cell = 0.5) {
  const w = Math.ceil((bounds.maxX - bounds.minX) / cell), h = Math.ceil((bounds.maxZ - bounds.minZ) / cell); const data = new Uint16Array(w * h);
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) data[j * w + i] = THREE.DataUtils.toHalfFloat(field.at(bounds.minX + (i + 0.5) * cell, bounds.minZ + (j + 0.5) * cell));
  const texture = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.HalfFloatType); texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return { texture, bounds: new THREE.Vector4(bounds.minX, bounds.minZ, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) };
}

// kind: 'wall' | 'roof'
export function applyWeathering(material, ground, kind) {
  const previous = material.onBeforeCompile; const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms.uHamGround = { value: ground.texture }; shader.uniforms.uHamBounds = { value: ground.bounds };
    shader.vertexShader = 'varying vec3 vHamWorld;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHamWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = `varying vec3 vHamWorld; uniform sampler2D uHamGround; uniform vec4 uHamBounds;\n${NOISE_GLSL}\n` + shader.fragmentShader;
    const wall = `
{ float ground = texture2D(uHamGround, (vHamWorld.xz - uHamBounds.xy) / uHamBounds.zw).r; float above = vHamWorld.y - ground;
  float damp = 1.0 - smoothstep(0.0, 1.15, above) * (0.75 + 0.25 * hamNoise(vHamWorld.xz * 3.1));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.6, 0.58, 0.5), damp * 0.9);
  float along = vHamWorld.x * 0.71 + vHamWorld.z * 0.71; float streak = hamNoise(vec2(along * 2.6, vHamWorld.y * 0.32 + 4.0));
  diffuseColor.rgb *= 1.0 - 0.11 * smoothstep(0.55, 0.92, streak) * smoothstep(0.4, 1.6, above);
  diffuseColor.rgb *= 0.9 + 0.18 * hamHash(floor(vHamWorld.xz / 7.0)); }`;
    const roof = `
{ float moss = smoothstep(0.52, 0.86, hamNoise(vHamWorld.xz * 0.85 + vHamWorld.y * 0.4)) * (0.6 + 0.4 * hamNoise(vHamWorld.xz * 3.7));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.88, 0.6), moss * 0.5);
  diffuseColor.rgb *= 0.9 + 0.18 * hamHash(floor(vHamWorld.xz / 7.0) + 3.0); }`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${kind === 'roof' ? roof : wall}`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : ''}-hamlet-weathering-${kind}-1`;
  material.needsUpdate = true; return material;
}

// A soft dark band on the ground around every footprint (darkest at the wall, gone 1 m out), following the ground heights.
export function buildContactSkirt(field, { width = 1.4, strength = 0.55, lift = 0.035 } = {}) {
  const P = [], A = [], I = [];
  for (const building of HAMLET_BUILDINGS) for (const polygon of footprint(building, 0)) {
    const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length, cz = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
    for (let k = 0; k < polygon.length; k += 1) {
      const a = polygon[k], b = polygon[(k + 1) % polygon.length]; let nx = b[1] - a[1], nz = -(b[0] - a[0]); const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
      const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz; if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; } // point away from the building
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5)); // follow the ground along long walls
      for (let s = 0; s < steps; s += 1) {
        const t0 = s / steps, t1 = (s + 1) / steps; const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
        const o = P.length / 3;
        for (const [x, z, alpha] of [[p0[0], p0[1], strength], [p1[0], p1[1], strength], [p1[0] + nx * width, p1[1] + nz * width, 0], [p0[0] + nx * width, p0[1] + nz * width, 0]]) { P.push(x, field.at(x, z) + lift, z); A.push(alpha); }
        I.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geometry.setAttribute('aShade', new THREE.Float32BufferAttribute(A, 1)); geometry.setIndex(I);
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    vertexShader: 'attribute float aShade; varying float vShade; void main(){ vShade = aShade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vShade; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, vShade * vShade / 0.55); }' }); // eased so the band fades softly
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Hamlet / contact shadow'; mesh.renderOrder = 1; return mesh;
}

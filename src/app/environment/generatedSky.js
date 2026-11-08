import * as THREE from 'three';
import { applyBlenderDisplay } from './alpineParityMaterials.js';

import { SKY_UNIFORM_GLSL, createSkyUniforms, writeSkyUniforms } from './skyShader.js';
export { SKY_UNIFORM_GLSL, createSkyUniforms, writeSkyUniforms };

const VERTEX = 'varying vec3 vSkyDirection; void main(){vSkyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
export function makeGeneratedSky(resources, uniforms) {
  const material = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms, vertexShader: VERTEX,
    fragmentShader: `#include <common>\n${SKY_UNIFORM_GLSL}\nvarying vec3 vSkyDirection;\nvoid main(){ gl_FragColor=vec4(skyRadiance(normalize(vSkyDirection)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}` });
  return applyBlenderDisplay(material, resources);
}
export function makeRawSky(uniforms) {
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, toneMapped: false, uniforms, vertexShader: VERTEX,
    fragmentShader: `${SKY_UNIFORM_GLSL}\nvarying vec3 vSkyDirection;\nvoid main(){ gl_FragColor=vec4(min(skyRadiance(normalize(vSkyDirection)),vec3(12.0)),1.0); }` });
}

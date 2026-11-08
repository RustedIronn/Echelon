import * as THREE from 'three';

export const CLOUD_SHADOW = { map: { value: null }, bounds: { value: new THREE.Vector4(-420, -1000, 840, 1080) }, strength: { value: 0 } };

const PATCH_KEY = '-cloud-shadow-1';
// Adds the shadow lookup to a standard (lit) material: direct light only, so shadowed ground keeps its blue sky fill.
export function applyCloudShadow(material) {
  if (material.userData.cloudShadow || !(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial)) return false;
  material.userData.cloudShadow = true; const previous = material.onBeforeCompile; const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms.uCloudShadow = CLOUD_SHADOW.map; shader.uniforms.uCloudBounds = CLOUD_SHADOW.bounds; shader.uniforms.uCloudK = CLOUD_SHADOW.strength;
    shader.fragmentShader = 'uniform sampler2D uCloudShadow; uniform vec4 uCloudBounds; uniform float uCloudK;\n' + shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{ vec3 cloudWorld = cameraPosition + transpose(mat3(viewMatrix)) * (-vViewPosition); vec2 cuv = (cloudWorld.xz - uCloudBounds.xy) / uCloudBounds.zw;
  float inside = step(0.0, cuv.x) * step(cuv.x, 1.0) * step(0.0, cuv.y) * step(cuv.y, 1.0); float shade = texture2D(uCloudShadow, clamp(cuv, 0.0, 1.0)).r * uCloudK * inside;
  if (uCloudK > 5.0) { reflectedLight.directDiffuse = vec3(texture2D(uCloudShadow, clamp(cuv, 0.0, 1.0)).r * 3.0, 0.0, 0.0); reflectedLight.indirectDiffuse = vec3(0.0); } else { reflectedLight.directDiffuse *= 1.0 - shade; reflectedLight.indirectDiffuse *= 1.0 - 0.4 * shade; /* a cloud also dims part of the bright sky above a point, and our sky fill is generous */ } reflectedLight.directSpecular *= 1.0 - shade; }`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : ''}${PATCH_KEY}`; material.needsUpdate = true; return true;
}

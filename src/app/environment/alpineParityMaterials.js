import * as THREE from 'three';
import { addWind } from './wind.js';
import { SKY_ACTIVE, SKY_UNIFORMS, SKY_UNIFORM_GLSL } from './skyShader.js';

// Display transform comes from the saved Blender OCIO configuration, not a tint overlay.
export function applyBlenderDisplay(material, resources) {
  const original = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    original.call(material, shader, renderer);
    shader.uniforms.uBlenderDisplay = { value: resources.displayLut };
    shader.uniforms.uDisplayDomain = { value: new THREE.Vector3(resources.metadata.display.logMin, resources.metadata.display.logMax, resources.metadata.display.size) };
    shader.fragmentShader = `
#ifdef TONE_MAPPING
uniform highp sampler3D uBlenderDisplay;
uniform vec3 uDisplayDomain;
vec3 echelonDisplay(vec3 radiance) {
  vec3 coordinate = clamp((log2(max(radiance * toneMappingExposure, vec3(1e-7))) - uDisplayDomain.x) / (uDisplayDomain.y - uDisplayDomain.x), 0.0, 1.0);
  coordinate = (coordinate * (uDisplayDomain.z - 1.0) + 0.5) / uDisplayDomain.z;
  return texture(uBlenderDisplay, coordinate).rgb;
}
#endif
` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', `
#ifdef TONE_MAPPING
  gl_FragColor.rgb = echelonDisplay(gl_FragColor.rgb);
#endif
`);
  };
  material.customProgramCacheKey = () => 'echelon-blender-display-v1';
  material.needsUpdate = true;
  return material;
}

// Layer 2/3 are three-triangle strips. Their per-face normals alternate at sub-pixel scale, which produced hard dark specks
// (far-field local contrast 3.7x the Blender reference). Biasing those normals upward and applying a canopy-occlusion gain
// removes the speckle. Values come from a sweep scored against the saved Blender frame (see
// design-reference/environment/webgl-prototype/diagnostics/DIAGNOSIS.md and STRIP_RESOLVE_FLOWER_REVIEW.md); the gain differs per
// resolve path because resolving in linear light is about 10 percent brighter.
export const STRIP_SHADING = {
  display: { upBlend: 0.8, gain: 0.68 },
  linear: { upBlend: 0.8, gain: 0.62 },
};

export function applyGrassHabitat(material, refinement = true, corridor = false, strip = null) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader = 'varying float vLeafHeight;\n' + shader.vertexShader; addWind(shader, 'position.y');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeafHeight = clamp(position.y, 0.0, 1.0);');
    shader.fragmentShader = 'varying float vLeafHeight;\n' + shader.fragmentShader;
    // Canopy occlusion: inside a real meadow the light falls off steeply toward the ground between the blades, which is where a photograph's darks come from.
    // ?canopy=deep (experiment) deepens it; the default keeps the approved, lighter falloff.
    const deep = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('canopy') === 'deep';
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= mix(${deep ? '0.42' : '0.65'}, 1.03, smoothstep(0.0, ${deep ? '0.85' : '0.75'}, vLeafHeight));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= mix(${deep ? '0.28' : '0.58'}, 1.0, smoothstep(0.0, ${deep ? '0.8' : '0.65'}, vLeafHeight));`);
    if (refinement) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Subpixel foliage should converge toward the canopy response rather than alternate dark face normals.
float canopyDistance = smoothstep(35.0, 110.0, length(vViewPosition));
normal = normalize(mix(normal, normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0)), canopyDistance * ${corridor ? '0.20' : '0.55'}));
`);
      // Reuse each light's already shadowed irradiance; do not add an unshadowed glow or another shadow lookup.
      const leafLighting = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
        `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
         reflectedLight.directDiffuse += directLight.color * max(0.0, dot(-geometryNormal, directLight.direction)) * BRDF_Lambert(material.diffuseContribution) * 0.16 * smoothstep(0.05, 0.7, vLeafHeight);
         // backlight: looking toward the sun, thin blades glow with the light coming through them (a warm-green halo on the tips), shadowed like the rest
         reflectedLight.directDiffuse += directLight.color * pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 4.0) * material.diffuseContribution * vec3(1.05, 1.2, 0.55) * 0.55 * smoothstep(0.25, 0.95, vLeafHeight);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', leafLighting);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.directDiffuse *= mix(${deep ? '0.55' : '0.78'}, 1.0, smoothstep(0.03, ${deep ? '0.9' : '0.8'}, vLeafHeight));
`);
      if (strip) {
        // Runs before the distance-based canopy blend above, so the effective blend is slightly higher than upBlend.
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(mix(normal, normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0)), ${strip.upBlend.toFixed(2)}));`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.directDiffuse *= ${strip.gain.toFixed(3)}; reflectedLight.indirectDiffuse *= ${strip.gain.toFixed(3)};`);
      }
    }
  };

  material.customProgramCacheKey = () => `echelon-blender-grass-habitat-bl1-${corridor ? 3 : refinement ? 2 : 1}${strip ? `-strip-${strip.upBlend}-${strip.gain}` : ''}${typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('canopy') === 'deep' ? '-deep' : ''}`;
  return material;
}

export function applyWetSediment(material, refinement = true, corridor = false) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader = 'attribute float wetness; varying float vWetness; varying vec3 vSedWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWetness = wetness; vSedWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'varying float vWetness; varying vec3 vSedWorld;\nfloat sedHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }\nfloat sedNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(sedHash(i),sedHash(i+vec2(1,0)),f.x),mix(sedHash(i+vec2(0,1)),sedHash(i+vec2(1,1)),f.x),f.y); }\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, ${corridor ? '0.72' : '0.43'}, vWetness);
${corridor ? `// The bed's pebbles were all the same pale grey on a dark bed, so through the clear water they read as polka dots. Real stream stones vary:
// ochre, brown, grey-green and a few dark ones, and in quieter patches silt settles over them. The pebbles are the pale parts of the bed's colour.
{ float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); float pebble = smoothstep(0.1, 0.24, l);
  vec2 cell = floor(vSedWorld.xz * 5.0); float h1 = sedHash(cell), h2 = sedHash(cell + 7.3);
  vec3 tint = mix(vec3(0.68, 0.56, 0.42), vec3(0.47, 0.5, 0.45), h1) * mix(1.0, 0.5, step(0.78, h2));
  float silted = smoothstep(0.38, 0.72, sedNoise(vSedWorld.xz * 0.21 + 1.3));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tint, pebble);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.15, 0.115) * (0.85 + 0.3 * sedNoise(vSedWorld.xz * 0.6)), pebble * silted * 0.8); }` : ''}`);
    if (refinement) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Refraction integrates fine bed relief; retain its silhouette but suppress hard pebble lighting underwater.
normal = normalize(mix(normal, normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0)), vWetness * ${corridor ? '0.6' : '0.65'}));
`);
      if (!corridor) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
// Wavelength-dependent underwater attenuation. Dry banks retain their original material.
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.48, 0.67, 0.76), vWetness);
`);
    }
  };
  material.customProgramCacheKey = () => `echelon-blender-wet-sediment-${corridor ? 4 : refinement ? 2 : 1}`;
  return material;
}

export function makeSkyMaterial(resources) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { panorama: { value: resources.sky }, skyHorizon: { value: new THREE.Vector3(1, 1, 1) }, skyZenith: { value: new THREE.Vector3(1, 1, 1) }, starK: { value: 0 } },
    vertexShader: `varying vec3 vSkyDirection; void main(){vSkyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
#include <common>
uniform sampler2D panorama; uniform vec3 skyHorizon; uniform vec3 skyZenith; uniform float starK; varying vec3 vSkyDirection;
void main(){
  vec3 direction=normalize(vSkyDirection);
  vec2 uv=vec2(atan(direction.z,direction.x)*RECIPROCAL_PI2+0.5,asin(clamp(direction.y,-1.0,1.0))*RECIPROCAL_PI+0.5);
  vec3 sky=texture2D(panorama,uv).rgb*mix(skyHorizon,skyZenith,smoothstep(0.0,0.55,direction.y));
  if(starK>0.0){
    vec3 cell=direction*700.0; vec3 id=floor(cell); float h=fract(sin(dot(id,vec3(12.9898,78.233,37.719)))*43758.5453); vec3 f=fract(cell)-0.5;
    float star=step(0.9965,h)*smoothstep(0.38,0.0,length(f))*(0.5+fract(h*37.0)*0.9);
    sky+=vec3(0.85,0.92,1.0)*star*starK*smoothstep(0.015,0.2,direction.y)*3.0;
  }
  gl_FragColor=vec4(sky,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  return applyBlenderDisplay(material, resources);
}

// Calibrated against the saved Blender frame (design-reference/environment/webgl-prototype/WATER_REFINEMENT_REVIEW.md):
// reflectionWeight restrains the Fresnel term, extinctionScale makes the shallow water more transparent so the bed reads, and
// shoreDepth feathers the shoreline from the authored per-vertex water depth instead of the half-resolution depth capture
// (which produced a visible 2 px stair-step).
// reflectionLod is the mip level at which the cached 640x360 bank reflection is sampled (near, far). The approved 3.0/3.5 blurred the
// spruce and bank reflections into a flat grey; 1.5/2.0 restores them. Resolution is not the lever: 1280x720 at the old blur matches it.
// Far water (the elevated tributary sits level with the camera, so a planar reflection cannot exist for it) read as flat blue paint with a hard
// edge. Beyond 40-120 m the shoreline feathers wider, the colour drifts toward grey and the water darkens where it meets its banks.
export const WATER_REFINEMENT = { reflectionWeight: 0.8, extinctionScale: 0.5, shoreDepth: 0.04, reflectionLod: [1.5, 2.0], farShorePerMetre: 0.0012, farDesaturate: 0.25, farEdgeDarken: 0.72, farRange: [40, 120] };

export function makeShallowWater(resources, normalTexture, refinement = true, corridor = false, waterRefine = false, realReflection = false) {
  if (corridor) return makeDepthResolvedWater(resources, normalTexture, waterRefine, realReflection);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide, fog: true,
    defines: { BANK_REFLECTION: refinement ? 1 : 0 },
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      reflectionMap: { value: resources.sky }, reflectionMatrix: { value: new THREE.Matrix4() }, reflectionReady: { value: 0 }, reflectionHeight: { value: 0 },
      panorama: { value: resources.sky }, ripple: { value: normalTexture },
      rippleScale: { value: refinement ? .60 : .17 }, rippleStrength: { value: refinement ? .085 : .22 },
      absorption: { value: refinement ? .18 : .11 }, scatterColor: { value: new THREE.Color().setRGB(.015, .035, .045) },
    },
    vertexShader: `
#include <common>
#include <fog_pars_vertex>
attribute float waterDepth; varying float vDepth; varying vec3 vWaterWorld; varying vec3 vWaterNormal;
void main(){
  vec4 world=modelMatrix*vec4(position,1.0);vWaterWorld=world.xyz;vWaterNormal=normalize(mat3(modelMatrix)*normal);vDepth=waterDepth;
  vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D panorama;uniform sampler2D reflectionMap;uniform mat4 reflectionMatrix;uniform float reflectionReady;uniform float reflectionHeight;uniform sampler2D ripple;uniform float absorption;uniform vec3 scatterColor; uniform float rippleScale; uniform float rippleStrength;
varying float vDepth; varying vec3 vWaterWorld; varying vec3 vWaterNormal;
void main(){
  vec3 perturb=texture2D(ripple,vWaterWorld.xz*rippleScale).xyz*2.0-1.0;
  vec3 N=normalize(vWaterNormal+vec3(perturb.x,0.0,perturb.y)*rippleStrength);
  vec3 V=normalize(cameraPosition-vWaterWorld);float cosine=clamp(dot(N,V),0.0,1.0);
  float fresnel=0.0204+0.9796*pow(1.0-cosine,5.0);
  vec3 direction=reflect(-V,N);
  vec2 uv=vec2(atan(direction.z,direction.x)*RECIPROCAL_PI2+0.5,asin(clamp(direction.y,-1.0,1.0))*RECIPROCAL_PI+0.5);
  vec3 reflection=texture2D(panorama,uv).rgb;
  #if BANK_REFLECTION
  vec4 projectedReflection=reflectionMatrix*vec4(vWaterWorld,1.0);
  vec2 reflectionUV=projectedReflection.xy/projectedReflection.w + perturb.xy*0.035;
  float validReflection=step(0.002,reflectionUV.x)*step(reflectionUV.x,0.998)*step(0.002,reflectionUV.y)*step(reflectionUV.y,0.998);
  float planarWeight=reflectionReady*validReflection*(1.0-smoothstep(0.25,1.25,abs(vWaterWorld.y-reflectionHeight)));
  vec3 bankReflection=texture2DLodEXT(reflectionMap,reflectionUV,1.8).rgb;
  reflection=mix(reflection,bankReflection,planarWeight);
  #endif
  float lost=1.0-exp(-absorption*max(vDepth,0.0)/max(cosine,0.18));
  float coverage=fresnel+(1.0-fresnel)*lost;
  vec3 radiance=(reflection*fresnel+scatterColor*(1.0-fresnel)*lost)/max(coverage,0.0001);
  float shore=smoothstep(0.0,0.055,vDepth);
  gl_FragColor=vec4(radiance,coverage*shore);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
  return applyBlenderDisplay(material, resources);
}

export function applyDistantCanopy(material, resources, refinement = true, corridor = false) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uNativeCanopy = { value: resources.canopyColor };
    shader.uniforms.uNativeCanopyNormal = { value: resources.canopyNormal };
    shader.uniforms.uCanopyCoverage = { value: resources.coverage };
    shader.uniforms.uCanopyBounds = { value: new THREE.Vector4(...resources.metadata.coverage.bounds) };
    shader.uniforms.uCanopyColor = { value: new THREE.Color().fromArray(resources.metadata.coverage.color) };
    shader.vertexShader = 'varying vec3 vCanopyWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCanopyWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'uniform sampler2D uNativeCanopy; uniform sampler2D uNativeCanopyNormal; uniform sampler2D uCanopyCoverage; uniform vec4 uCanopyBounds; uniform vec3 uCanopyColor; varying vec3 vCanopyWorld;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
vec2 habitatUV = (vec2(vCanopyWorld.x, -vCanopyWorld.z) - uCanopyBounds.xy) / (uCanopyBounds.zw - uCanopyBounds.xy);
float insideHabitat = step(0.0, habitatUV.x) * step(habitatUV.x, 1.0) * step(0.0, habitatUV.y) * step(habitatUV.y, 1.0);
// Blend the finite atlas in metres, not at a rectangular UV step. Colour,
// normals and canopy occlusion must all use the same boundary response.
vec2 canopyEdgeMetres=min(habitatUV,1.0-habitatUV)*(uCanopyBounds.zw-uCanopyBounds.xy);
float canopyEdge=smoothstep(0.0,24.0,min(canopyEdgeMetres.x,canopyEdgeMetres.y));
float canopyCoverage = texture2D(uCanopyCoverage, habitatUV).r * insideHabitat * canopyEdge;
float unresolved = smoothstep(45.0, 105.0, length(vViewPosition));
${corridor ? `
vec4 nativeCanopy = texture2D(uNativeCanopy, habitatUV, 1.0);
float obliqueCoverage = 1.0 - pow(1.0 - clamp(nativeCanopy.a, 0.0, 1.0), 4.0);
float nativeWeight = obliqueCoverage * insideHabitat * canopyEdge * smoothstep(25.0, 75.0, length(vViewPosition));
diffuseColor.rgb = mix(diffuseColor.rgb, nativeCanopy.rgb, nativeWeight * 0.96);
` : `diffuseColor.rgb = mix(diffuseColor.rgb, uCanopyColor, canopyCoverage * unresolved * ${refinement ? '0.92' : '0.78'});`}
`);
    if (corridor) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec3 nativeNormal = texture2D(uNativeCanopyNormal, habitatUV, 1.0).rgb * 2.0 - 1.0;
float canopyOrientation = clamp(length(nativeNormal), 0.55, 1.0);
vec3 canopyBend = mat3(viewMatrix) * vec3(nativeNormal.x, 0.0, -nativeNormal.y);
normal = normalize(normal + canopyBend * nativeWeight * 0.28);
`);
    if (corridor) shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
// Coverage and mean leaf-normal length retain unresolved canopy occlusion/orientation, not random ground noise.
reflectedLight.indirectDiffuse *= mix(1.0, 0.70, nativeWeight);
reflectedLight.directDiffuse *= mix(1.0, canopyOrientation, nativeWeight * 0.8);
`);
  };
  material.customProgramCacheKey = () => `echelon-source-canopy-feathered-${corridor ? 3 : refinement ? 2 : 1}`;
  return material;
}

// Terrain wet band: darkens and slightly saturates the albedo where the terrain lies under the blurred authored water footprint.
// Runs after the canopy atlas mix so the atlas cannot overwrite it. Needs the vCanopyWorld varying from applyDistantCanopy.
export function applyBankWetness(material, wetness) {
  const previous = material.onBeforeCompile; const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uWetMap = { value: wetness.texture };
    shader.uniforms.uWetMin = { value: wetness.min };
    shader.uniforms.uWetSpan = { value: wetness.span };
    if (!wetness.params) wetness.params = new THREE.Vector4(wetness.darkness, wetness.saturation, wetness.lo, wetness.hi);
    shader.uniforms.uWet = { value: wetness.params };
    shader.uniforms.uWetFade = { value: new THREE.Vector2(wetness.fadeNear, wetness.fadeFar) };
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'uniform sampler2D uWetMap; uniform vec2 uWetMin; uniform vec2 uWetSpan; uniform vec4 uWet; uniform vec2 uWetFade;\nvoid main() {');
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
{
  vec2 wetUV = (vCanopyWorld.xz - uWetMin) / uWetSpan;
  float wet = smoothstep(uWet.z, uWet.w, texture2D(uWetMap, wetUV).r) * step(0.0, wetUV.x) * step(wetUV.x, 1.0) * step(0.0, wetUV.y) * step(wetUV.y, 1.0) * (1.0 - smoothstep(uWetFade.x, uWetFade.y, length(vViewPosition)));
  float wetLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 wetColor = mix(vec3(wetLuma), diffuseColor.rgb, 1.0 + uWet.y) * uWet.x;
  diffuseColor.rgb = mix(diffuseColor.rgb, max(wetColor, vec3(0.0)), wet);
}`);
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}-bank-wet`;
  material.userData.bankWet = wetness;
  return material;
}

// Spruce needles were flat dark cards: no backlight, faceted card normals, and aliased cutout edges. Brightness and saturation lift the
// albedo, a cone-like blended normal removes the cardboard faceting, back-lighting lets the sun glow through the needles, and the
// ambient wrap fills the shade. Values were chosen by eye against the live scene; the Spruce brightness slider scales the whole material.
export const FOLIAGE_STYLE = { sphericalBlend: 0.5, translucency: 0.35, ambientWrap: 0.35, brightness: 1.1, saturation: 1.45 };

export function applyFoliageStyle(material, center, style = FOLIAGE_STYLE) {
  const previous = material.onBeforeCompile; const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms.uTreeCenter = { value: center };
    shader.vertexShader = 'uniform vec3 uTreeCenter; varying vec3 vTreeNormal;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 treeDirection = (modelMatrix * vec4(transformed, 1.0)).xyz - uTreeCenter; treeDirection.y *= 0.35;
vTreeNormal = normalize((viewMatrix * vec4(normalize(treeDirection), 0.0)).xyz);`);
    shader.fragmentShader = 'varying vec3 vTreeNormal;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ float needleLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = mix(vec3(needleLuma), diffuseColor.rgb, ${style.saturation.toFixed(3)}) * ${style.brightness.toFixed(3)}; }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(mix(normal, vTreeNormal, ${style.sphericalBlend.toFixed(3)}));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
      `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
       reflectedLight.directDiffuse += directLight.color * max(0.0, dot(-geometryNormal, directLight.direction)) * BRDF_Lambert(material.diffuseContribution) * ${style.translucency.toFixed(3)};
       reflectedLight.directDiffuse += directLight.color * pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 4.0) * material.diffuseContribution * 0.5; /* petals glow when backlit */`));
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= ${(1 + style.ambientWrap).toFixed(3)};`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : 'tree'}-foliage-v1`;
  return material;
}

// Distant flowers read as dark blue-grey speckle: lit white petals lose their light. The same back-light and ambient wrap that the grass uses
// let petals glow when the sun is behind them. The Flower brightness slider scales the albedo on top of this.
export const FLOWER_RESPONSE = { translucency: 0.4, ambientWrap: 0.4 };

export function applyFlowerResponse(material, style = FLOWER_RESPONSE) {
  const previous = material.onBeforeCompile; const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    addWind(shader, 'position.y / 0.45'); // flower models are about 0.3-0.6 m tall in their own units
    // Beyond 40-110 m the dark, desaturated parts (stems, leaves, shaded petals) melt into the meadow; bright and strongly coloured petals stay.
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 fc = diffuseColor.rgb; float fl = dot(fc, vec3(0.2126, 0.7152, 0.0722)); float hi = max(max(fc.r, fc.g), fc.b); float sat = (hi - min(min(fc.r, fc.g), fc.b)) / max(hi, 1e-4);
  float darkPart = (1.0 - smoothstep(0.08, 0.35, fl)) * (1.0 - smoothstep(0.25, 0.6, sat));
  diffuseColor.rgb = mix(fc, vec3(0.16, 0.27, 0.07), smoothstep(40.0, 110.0, length(vViewPosition)) * darkPart * 0.85); }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
      `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
       reflectedLight.directDiffuse += directLight.color * max(0.0, dot(-geometryNormal, directLight.direction)) * BRDF_Lambert(material.diffuseContribution) * ${style.translucency.toFixed(3)};`));
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= ${(1 + style.ambientWrap).toFixed(3)};`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : 'flower'}-flower-v2`;
  return material;
}

// Composite reflected and refracted radiance in linear space, then apply Blender's display transform once.
function makeDepthResolvedWater(resources, normalTexture, refine = false, real = false) {
  const skyUniforms = { ...SKY_UNIFORMS, uTodSky: SKY_ACTIVE };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: {
      panorama: { value: resources.sky }, ripple: { value: normalTexture }, ...skyUniforms,
      reflectionMap: { value: resources.sky }, reflectionMatrix: { value: new THREE.Matrix4() }, reflectionReady: { value: 0 }, reflectionHeight: { value: 0 },
      reflectionMap2: { value: resources.sky }, reflectionMatrix2: { value: new THREE.Matrix4() }, reflectionReady2: { value: 0 }, reflectionHeight2: { value: 0 },
      bedColor: { value: resources.sky }, bedDepth: { value: resources.sky }, bedReady: { value: 0 },
      viewportSize: { value: new THREE.Vector2(2560, 1440) }, cameraRange: { value: new THREE.Vector2(.1, 1500) },
      // Look-dev hooks (neutral by default): reflection weight, reflection mip offset and ripple strength of the refined water.
      uReflectK: { value: 1 }, uLodBias: { value: 0 }, uRippleK: { value: 1 },
      // Native water: absorption density .16, blue-green volume and lightly tinted transmission.
      extinction: { value: new THREE.Vector3(.240, .073, .113).multiplyScalar(refine ? WATER_REFINEMENT.extinctionScale : 1) },
    },
    vertexShader: `
attribute float waterDepth; varying float vDepth; varying vec3 vWaterWorld; varying vec3 vWaterNormal; varying float vSurfaceZ;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0); vWaterWorld = world.xyz;
  vWaterNormal = normalize(mat3(modelMatrix) * normal); vDepth = waterDepth;
  vec4 view = viewMatrix * world; vSurfaceZ = -view.z; gl_Position = projectionMatrix * view;
}`,
    fragmentShader: `
#include <common>
#include <packing>
${SKY_UNIFORM_GLSL}
uniform float uTodSky;
uniform sampler2D panorama; uniform sampler2D ripple; uniform sampler2D reflectionMap; uniform mat4 reflectionMatrix;
uniform float reflectionReady; uniform float reflectionHeight; uniform sampler2D reflectionMap2; uniform mat4 reflectionMatrix2; uniform float reflectionReady2; uniform float reflectionHeight2; uniform sampler2D bedColor; uniform sampler2D bedDepth; uniform float bedReady;
uniform vec2 viewportSize; uniform vec2 cameraRange; uniform vec3 extinction; uniform float uReflectK; uniform float uLodBias; uniform float uRippleK;
varying float vDepth; varying vec3 vWaterWorld; varying vec3 vWaterNormal; varying float vSurfaceZ;
float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(bedDepth, uv).r, cameraRange.x, cameraRange.y); }
vec2 skyUV(vec3 direction) { return vec2(atan(direction.z,direction.x)*RECIPROCAL_PI2+0.5,asin(clamp(direction.y,-1.0,1.0))*RECIPROCAL_PI+0.5); }
void main() {
  vec3 V = normalize(cameraPosition-vWaterWorld); float distanceToCamera = length(cameraPosition-vWaterWorld);
  float distanceResponse = smoothstep(25.0, 130.0, distanceToCamera);
  vec3 waveA = texture2D(ripple, vWaterWorld.xz * vec2(.58, .22)).xyz*2.0-1.0;
  vec3 waveB = texture2D(ripple, vWaterWorld.xz * vec2(1.7, .83)+vec2(.31,.57)).xyz*2.0-1.0;
  vec2 wave = waveA.xy*.72 + waveB.xy*.28;
  ${refine ? 'vec3 N = normalize(vWaterNormal + vec3(wave.x, 0.0, wave.y) * mix(.24, .13, distanceResponse) * uRippleK);' : 'vec3 N = normalize(vWaterNormal + vec3(wave.x, 0.0, wave.y) * mix(.24, .13, distanceResponse));'}
  float cosine = clamp(dot(N,V), .015, 1.0);
  float fresnel = .0204 + .9796*pow(1.0-cosine,5.0);
  ${refine ? 'fresnel = mix(fresnel, min(fresnel, .6), smoothstep(22.0, 80.0, distanceToCamera));' : ''}
  vec3 reflected = texture2D(panorama, skyUV(reflect(-V,N))).rgb;
  if (uTodSky > 0.5) reflected = skyRadiance(normalize(reflect(-V,N))); // the time-of-day sky, not the baked afternoon one
  vec4 projected = reflectionMatrix*vec4(vWaterWorld,1.0);
  vec2 reflectionUV = projected.xy/projected.w + wave*.028/max(cosine,.2);
  float valid = step(.002,reflectionUV.x)*step(reflectionUV.x,.998)*step(.002,reflectionUV.y)*step(reflectionUV.y,.998);
  float planar = reflectionReady*valid*(1.0-smoothstep(.3,1.4,abs(vWaterWorld.y-reflectionHeight)));
  ${refine ? 'planar *= 1.0 - smoothstep(.12, .45, vWaterWorld.y - reflectionHeight) * smoothstep(25.0, 60.0, distanceToCamera);' : ''}
  vec3 banks = ${refine && real ? 'texture2D(reflectionMap,reflectionUV,uLodBias).rgb' : `texture2DLodEXT(reflectionMap,reflectionUV,${refine ? `mix(${WATER_REFINEMENT.reflectionLod[0].toFixed(1)},${WATER_REFINEMENT.reflectionLod[1].toFixed(1)},distanceResponse) + uLodBias` : 'mix(3.0,3.5,distanceResponse)'}).rgb`};
  // Prefiltered local reflection already includes the visible sky; do not add the bright horizon twice.
  vec3 skyOnly = reflected;
  reflected = mix(reflected,banks,planar);
  ${refine ? `// The higher stream gets its own mirror pass (a plane just under the camera, which is level with it).
  float trib = reflectionReady2 * smoothstep(.1, .4, vWaterWorld.y - reflectionHeight) * smoothstep(16.0, 42.0, distanceToCamera);
  vec4 projected2 = reflectionMatrix2*vec4(vWaterWorld.x, reflectionHeight2, vWaterWorld.z, 1.0);
  vec2 reflectionUV2 = projected2.xy/projected2.w + wave*.028/max(cosine,.2);
  float valid2 = step(.002,reflectionUV2.x)*step(reflectionUV2.x,.998)*step(.002,reflectionUV2.y)*step(reflectionUV2.y,.998);
  float planar2 = trib*valid2;
  reflected = mix(reflected, texture2D(reflectionMap2, reflectionUV2, uLodBias + .6).rgb, planar2);
  // Far away the stream mostly mirrors the open sky, as the pale bend does; the dark bank beside the tail must not turn it into a dark line.
  reflected = mix(reflected, skyOnly, .7 * smoothstep(30.0, 100.0, distanceToCamera));
  float farRef = smoothstep(30.0, 110.0, distanceToCamera) * (1.0 - max(planar, planar2));
  vec3 rdir = reflect(-V,N); float rAz = atan(rdir.z, rdir.x); float hills = .004 + .026*fbm(vec2(rAz*5.0, 1.7));
  float landMask = 1.0 - smoothstep(hills - .012, hills + .012, rdir.y + wave.y*.07);
  vec3 land = (uTodSky > .5 ? mix(uHor*vec3(.5,.62,.4), uZen*.4, .3) : vec3(.12,.17,.11)) * (.8 + .6*fbm(vec2(rAz*40.0, rdir.y*60.0)));
  reflected = mix(reflected, mix(reflected, land, landMask*.5), farRef);` : ''}
  vec2 screenUV = gl_FragCoord.xy/viewportSize;
  float rayLength = max(vDepth,0.0)/max(cosine,.18); float column = max(vDepth,0.0);
  vec3 bed = vec3(.09,.12,.10);
  if (bedReady > .5) {
    float behind = max(0.0,viewDepth(screenUV)-vSurfaceZ);
    rayLength = behind * distanceToCamera/max(vSurfaceZ,.1);
    column = rayLength*cosine;
    vec2 refractedUV = clamp(screenUV + wave*.008*smoothstep(0.0,.4,column),vec2(.001),vec2(.999));
    // Reject refraction that would pull an above-water bank across the shoreline.
    if(viewDepth(refractedUV)<vSurfaceZ+.015) refractedUV=screenUV;
    float bedLod = mix(.15,.85,smoothstep(.08,.7,column));
    bed = texture2DLodEXT(bedColor,refractedUV,bedLod).rgb;
  }
  vec3 transmittance = exp(-extinction*min(rayLength,8.0));
  vec3 transmitted = bed*transmittance + vec3(.012,.025,.030)*(vec3(1.0)-transmittance);
  ${refine ? `vec3 radiance = reflected*fresnel*${WATER_REFINEMENT.reflectionWeight}*uReflectK + transmitted*(1.0-fresnel*${WATER_REFINEMENT.reflectionWeight}*uReflectK);` : 'vec3 radiance = reflected*fresnel + transmitted*(1.0-fresnel);'}
  ${refine ? `float shoreRamp = ${WATER_REFINEMENT.shoreDepth} + distanceToCamera * ${WATER_REFINEMENT.farShorePerMetre};
  float shore = smoothstep(0.0, shoreRamp, vDepth);
  float farWater = smoothstep(${WATER_REFINEMENT.farRange[0].toFixed(1)}, ${WATER_REFINEMENT.farRange[1].toFixed(1)}, distanceToCamera);
  float farEdge = (1.0 - smoothstep(0.0, shoreRamp * 4.5, vDepth)) * farWater;
  radiance = mix(radiance, vec3(dot(radiance, vec3(0.2126, 0.7152, 0.0722))), ${WATER_REFINEMENT.farDesaturate} * farWater) * mix(1.0, ${WATER_REFINEMENT.farEdgeDarken}, farEdge);
  radiance *= 1.0 + farWater * (wave.x*.8 + wave.y*.5) * .28;
  float glint = pow(max(dot(normalize(reflect(-V,N)), normalize(uSunDir)), 0.0), 90.0) * uGlowK * step(0.0, uSunDir.y) * uTodSky;
  radiance += uSunC * glint * (.5 + farWater);` : 'float shore = smoothstep(0.0,max(.012,fwidth(column)),column);'}
  gl_FragColor=vec4(radiance,bedReady>.5 ? ${refine ? 'mix(shore, 1.0, smoothstep(18.0, 55.0, distanceToCamera) * .92)' : 'shore'} : .8);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  return applyBlenderDisplay(material, resources);
}

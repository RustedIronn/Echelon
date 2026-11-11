import * as THREE from 'three';

// The valley's look at true scale (docs/WORLD-SPEC.md sections 3-4), shared by every opaque surface:
// - air: aerial perspective with height (denser low in the valley, thinner over the summits) and forward scattering, so looking into the light the
//   far layers glow and separate, the way the references shot into the sun do;
// - mountains: above the treeline the block-out colours give way to rock with strata, couloirs and patches, and snow that lies on gentler ground
//   above a seasonal snowline and gathers in hollows, with a crisp edge.
// The old scene's mountainDetail.js had the same ideas tuned to 90 m mountains; these are tuned to kilometres.
export const LOOK = {
  uSunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
  uHaze: { value: new THREE.Color(0.75, 0.8, 0.86) }, uDensity: { value: 1 / 16000 }, uScaleHeight: { value: 1300 }, uGlow: { value: 1.2 },
  uSnowline: { value: 1500 }, uTreeline: { value: 640 }, uRockOn: { value: 1 },
};
const NOISE = `
float vlHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vlNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(vlHash(i),vlHash(i+vec2(1,0)),f.x),mix(vlHash(i+vec2(0,1)),vlHash(i+vec2(1,1)),f.x),f.y); }
float vlFbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vlNoise(p); p=p*2.03+17.1; a*=0.5; } return s; }`;

export function applyValleyLook(material, { mountain = false } = {}) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    Object.assign(shader.uniforms, LOOK);
    shader.vertexShader = 'varying vec3 vlWorld; varying vec3 vlNormal;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
{ vec4 wpv = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wpv = instanceMatrix * wpv;
#endif
  vlWorld = (modelMatrix * wpv).xyz; vlNormal = normalize(mat3(modelMatrix) * objectNormal); }`);
    shader.fragmentShader = `uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uHaze; uniform float uDensity; uniform float uScaleHeight; uniform float uGlow; uniform float uSnowline; uniform float uTreeline; uniform float uRockOn;
varying vec3 vlWorld; varying vec3 vlNormal;\n${NOISE}\n` + shader.fragmentShader;
    if (mountain) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ float h = vlWorld.y; vec3 n = normalize(vlNormal); float up = clamp(n.y, 0.0, 1.0); vec2 p = vlWorld.xz;
  float alpine = smoothstep(uTreeline - 80.0, uTreeline + 160.0, h + 120.0 * (vlFbm(p / 400.0) - 0.5)) * uRockOn;
  // rock: grey-brown limestone and gneiss, broken into strata along the height, streaked down the fall line by couloirs, patched warm and cool
  float strata = vlNoise(vec2(h / 22.0 + vlFbm(p / 300.0) * 3.0, 0.5)); float streak = vlFbm(vec2(p.x / 90.0 + n.x * 6.0, p.y / 90.0 + n.z * 6.0) + h / 260.0);
  vec3 rock = mix(vec3(0.33, 0.31, 0.29), vec3(0.47, 0.44, 0.40), vlFbm(p / 700.0)); rock *= 0.78 + 0.32 * strata; rock *= 0.82 + 0.3 * smoothstep(0.35, 0.7, streak);
  rock = mix(rock, vec3(0.38, 0.40, 0.33), 0.35 * smoothstep(0.55, 0.85, up) * (1.0 - smoothstep(uSnowline - 300.0, uSnowline + 200.0, h))); // alpine turf on the gentler rock below the snow
  // snow: lies where the ground is gentle enough to hold it, above a snowline that wanders, and gathers in hollows; a crisp edge
  float line = uSnowline + 260.0 * (vlFbm(p / 520.0) - 0.5); float hold = smoothstep(0.42, 0.62, up + 0.12 * (vlFbm(p / 160.0) - 0.5));
  float snow = smoothstep(line - 30.0, line + 30.0, h) * hold; snow = max(snow, smoothstep(line + 600.0, line + 900.0, h) * smoothstep(0.25, 0.45, up));
  vec3 alp = mix(rock, vec3(0.93, 0.95, 0.98), snow);
  diffuseColor.rgb = mix(diffuseColor.rgb, alp, alpine); }`);
    // the air: transmittance through height-varying haze, and light scattered into the view (more toward the sun)
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
{ vec3 ray = vlWorld - cameraPosition; float d = length(ray); vec3 v = ray / max(d, 1e-3);
  float h0 = cameraPosition.y, dh = ray.y; float k = dh / uScaleHeight; float shape = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0;
  float depth = uDensity * d * exp(-h0 / uScaleHeight) * shape; float T = exp(-depth);
  float mu = dot(v, normalize(uSunDir)); float g = 0.72; float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) / 12.566;
  vec3 inscatter = uHaze + uSunCol * min(hg, 2.0) * uGlow * 0.32 * smoothstep(-0.1, 0.25, uSunDir.y + 0.2);
  gl_FragColor.rgb = gl_FragColor.rgb * T + inscatter * (1.0 - T); }
#include <fog_fragment>`);
  };
  material.customProgramCacheKey = () => `valley-look-${mountain ? 'mountain' : 'plain'}`;
  return material;
}

// per mood: the haze colour and strength, and the light scattered toward the sun
export function setLook({ sunDir, sunCol, haze, density, glow, snowline, treeline }) {
  if (sunDir) LOOK.uSunDir.value.copy(sunDir); if (sunCol) LOOK.uSunCol.value.set(sunCol); if (haze) LOOK.uHaze.value.set(haze);
  if (density) LOOK.uDensity.value = density; if (glow !== undefined) LOOK.uGlow.value = glow; if (snowline !== undefined) LOOK.uSnowline.value = snowline; if (treeline !== undefined) LOOK.uTreeline.value = treeline;
}

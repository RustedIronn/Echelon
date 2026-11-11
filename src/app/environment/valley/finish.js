import * as THREE from 'three';
import { createOptics, OPTICS } from '../optics.js';
import { SKY_UNIFORMS } from '../skyShader.js';

// The valley's finishing pipeline, ported from the old scene (linearResolve.js, optics.js): the scene is rendered in linear HDR into a
// multisampled half-float target, and one resolve pass makes the picture - ambient occlusion from the depth buffer (contact shade under
// grass, eaves, trees and stones), bloom and the sun's shafts (optics.js), the filmic display transform, a grade (vibrance, contrast, a
// toe that deepens the darks), a soft vignette and fine grain. ?finish=0 renders straight to the screen as before; ?ao=0, ?bloom=, ?shafts=.
const Q = typeof window === 'undefined' ? new URLSearchParams('') : new URLSearchParams(window.location.search);
export const FINISH_ON = Q.get('finish') !== '0';
const VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// ambient occlusion from depth alone: view-space positions rebuilt from the depth buffer, the normal from their screen derivatives, a
// spiral of samples within a few metres; fading out where that radius is under a pixel
const AO_FRAGMENT = `
uniform sampler2D tDepth; uniform mat4 uProjInv; uniform mat4 uProj; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
vec3 viewPos(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 c = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  float d0 = texture2D(tDepth, vUv).x; if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv); vec3 dx = viewPos(vUv + vec2(uTexel.x, 0.0)) - P, dy = viewPos(vUv + vec2(0.0, uTexel.y)) - P; vec3 N = normalize(cross(dx, dy));
  float pix = uRadius * uProj[1][1] / max(-P.z, 1.0) * 0.5; /* the radius in uv */ float fade = smoothstep(1.5, 5.0, pix / uTexel.y);
  if (fade <= 0.0) { gl_FragColor = vec4(1.0); return; }
  float a0 = ign(gl_FragCoord.xy) * 6.2832, occ = 0.0;
  for (int i = 0; i < 12; i++) { float t = (float(i) + 0.5) / 12.0; float a = a0 + t * 15.08; vec2 o = vec2(cos(a), sin(a)) * pix * sqrt(t) * vec2(uProj[1][1] / uProj[0][0], 1.0);
    vec3 S = viewPos(vUv + o); vec3 v = S - P; float l = length(v); occ += max(dot(N, v / max(l, 1e-3)) - 0.12, 0.0) * smoothstep(uRadius * 1.6, uRadius * 0.4, l); }
  gl_FragColor = vec4(vec3(1.0 - fade * clamp(occ / 12.0 * 2.4, 0.0, 1.0)), 1.0);
}`;

const RESOLVE_FRAGMENT = `
uniform sampler2D radiance; uniform sampler2D tAO; uniform float uAOK; uniform vec2 uTexel; uniform float exposure; uniform float uSat; uniform float uContrast; uniform float uToe;
uniform sampler2D uBloom; uniform float uBloomK; uniform float uBloomLevels; uniform sampler2D uShafts; uniform float uShaftK; uniform float uVignette; uniform float uGrain; uniform float uFrame; uniform float uAspect;
varying vec2 vUv;
float grainHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 color) { /* the same filmic transform the valley was tuned under (three's ACESFilmicToneMapping) */
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6; color = inM * color; color = RRTAndODTFit(color); color = outM * color; return clamp(color, 0.0, 1.0); }
void main() {
  vec3 c = texture2D(radiance, vUv).rgb;
  float ao = 0.0; for (int j = -1; j <= 2; j++) for (int i = -1; i <= 2; i++) ao += texture2D(tAO, vUv + (vec2(float(i), float(j)) - 0.5) * uTexel).r; ao /= 16.0; /* the 4x4 blur removes the sample noise */
  c *= mix(1.0, ao, uAOK);
  c = mix(c, texture2D(uBloom, vUv).rgb / uBloomLevels, uBloomK) + texture2D(uShafts, vUv).rgb * uShaftK;
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float chroma = length(c - vec3(l)) / max(l, 1e-3);
  c = mix(vec3(l), c, 1.0 + (uSat - 1.0) * (1.0 - clamp(chroma * 0.9, 0.0, 1.0))); /* vibrance: muted colours gain more than vivid ones */
  vec3 g = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); g *= 1.0 - uToe * (1.0 - smoothstep(0.0, 0.62, g)); g = clamp((g - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec2 vq = (vUv - 0.5) * vec2(uAspect, 1.0) / (0.5 * sqrt(uAspect * uAspect + 1.0)); g *= 1.0 - uVignette * smoothstep(0.25, 1.05, dot(vq, vq));
  float grain = grainHash(gl_FragCoord.xy + uFrame * vec2(37.0, 17.0)) + grainHash(gl_FragCoord.xy * 1.37 + uFrame * vec2(11.0, 53.0)) - 1.0;
  g = clamp(g + grain * uGrain * (0.0045 + 0.012 * g * (1.0 - g)), 0.0, 1.0); c = pow(g, vec3(2.2));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function createFinish(renderer, { sunDir, sat = 1.25, contrast = 1.05, toe = 0.05, ao = 0.75 } = {}) {
  SKY_UNIFORMS.uSunDir.value.copy(sunDir); // optics.js reads the sun from here (bloom strength by day, the shafts' origin)
  const optics = createOptics(renderer); const size = new THREE.Vector2(); let target = null, aoTarget = null, frame = 0;
  const mat = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const aoMat = mat(AO_FRAGMENT, { tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 2.2 } });
  const resolve = mat(RESOLVE_FRAGMENT, { radiance: { value: null }, tAO: { value: null }, uAOK: { value: Q.get('ao') === '0' ? 0 : Number(Q.get('ao') ?? ao) }, uTexel: { value: new THREE.Vector2() }, exposure: { value: 1 },
    uSat: { value: Number(Q.get('sat') ?? sat) }, uContrast: { value: Number(Q.get('contrast') ?? contrast) }, uToe: { value: Number(Q.get('toe') ?? toe) },
    uBloom: { value: null }, uBloomK: { value: 0 }, uBloomLevels: { value: 6 }, uShafts: { value: null }, uShaftK: { value: 0 }, uVignette: OPTICS.vignette, uGrain: OPTICS.grain, uFrame: { value: 0 }, uAspect: { value: 16 / 9 } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), resolve); quad.frustumCulled = false; const scene = new THREE.Scene(); scene.add(quad); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    render(sourceScene, camera) {
      renderer.getDrawingBufferSize(size);
      if (!target || target.width !== size.x || target.height !== size.y) { target?.dispose(); aoTarget?.dispose();
        target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples), depthBuffer: true, depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType) });
        aoTarget = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); }
      renderer.setRenderTarget(target); renderer.render(sourceScene, camera);
      aoMat.uniforms.tDepth.value = target.depthTexture; aoMat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse); aoMat.uniforms.uProj.value.copy(camera.projectionMatrix); aoMat.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
      quad.material = aoMat; renderer.setRenderTarget(aoTarget); renderer.render(scene, cam); renderer.setRenderTarget(null);
      const o = optics.prepare(target.texture, size.x, size.y, camera); const u = resolve.uniforms;
      u.radiance.value = target.texture; u.tAO.value = aoTarget.texture; u.uTexel.value.set(1 / size.x, 1 / size.y); u.exposure.value = renderer.toneMappingExposure;
      u.uBloom.value = o.bloom; u.uBloomK.value = o.bloomK; u.uBloomLevels.value = o.levels; u.uShafts.value = o.shafts; u.uShaftK.value = o.shaftK; u.uFrame.value = (frame = (frame + 1) % 997); u.uAspect.value = size.x / size.y;
      quad.material = resolve; renderer.render(scene, cam);
    },
  };
}

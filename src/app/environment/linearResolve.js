import { DEFAULT_MSAA } from './antialias.js';
import * as THREE from 'three';
import { REACTIVE } from './taaReactive.js';
import { createOptics, OPTICS } from './optics.js';

// Optional comparison path. The default framebuffer resolves MSAA after the Blender display transform has already been
// applied per fragment, so sub-pixel highlights (petals, blade tips) are averaged in display space and lose energy.
// This path renders scene-linear HDR into a multisampled half-float target, lets the hardware resolve it in linear
// light, and applies the same sampled Blender display LUT exactly once afterwards.
export const RESOLVE_SAMPLES = 4; // the earlier setting, kept as the comparison (?msaa=4)
// Thin cut-out geometry (blade tufts, flower petals) needs more coverage samples than 4 to look smooth: 8 by default, capped by what the GPU offers.
export function resolveSamples(maxSamples, search = typeof window === 'undefined' ? '' : window.location.search) { const asked = Number(new URLSearchParams(search).get('msaa')) || DEFAULT_MSAA; return Math.max(1, Math.min(maxSamples || 4, asked)); }

// The colour grade applied once, after the display transform: a vibrance (muted colours gain more than vivid ones) and a gentle contrast. The time of day drives it, so daylight has presence and dusk stays soft.
// toe: deepens the darks (only below mid grey), which the flat display transform leaves lifted in sunlit scenes.
export const GRADE = { sat: { value: 1 }, contrast: { value: 1 }, toe: { value: 0 } };

export const RESOLVE_VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export const RESOLVE_FRAGMENT = `
uniform sampler2D radiance; uniform highp sampler3D displayLut; uniform vec3 displayDomain; uniform float exposure; uniform float uSat; uniform float uContrast; uniform float uToe;
uniform sampler2D uBloom; uniform float uBloomK; uniform float uBloomLevels; uniform sampler2D uShafts; uniform float uShaftK; uniform float uVignette; uniform float uGrain; uniform float uFrame; uniform float uAspect;
varying vec2 vUv;
float grainHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec3 linearColor = texture2D(radiance, vUv).rgb;
  /* optics (optics.js): bloom as an energy-preserving mix of the blurred image, then the sun's shafts through the haze */
  linearColor = mix(linearColor, texture2D(uBloom, vUv).rgb / uBloomLevels, uBloomK) + texture2D(uShafts, vUv).rgb * uShaftK;
  vec3 coordinate = clamp((log2(max(linearColor * exposure, vec3(1e-7))) - displayDomain.x) / (displayDomain.y - displayDomain.x), 0.0, 1.0);
  coordinate = (coordinate * (displayDomain.z - 1.0) + 0.5) / displayDomain.z;
  vec3 c = texture(displayLut, coordinate).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float chroma = length(c - vec3(l)) / max(l, 1e-3);
  c = mix(vec3(l), c, 1.0 + (uSat - 1.0) * (1.0 - clamp(chroma * 0.9, 0.0, 1.0)));
  vec3 g = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); g *= 1.0 - uToe * (1.0 - smoothstep(0.0, 0.62, g)); g = clamp((g - 0.5) * uContrast + 0.5, 0.0, 1.0);
  /* lens: a soft vignette (the corners fall off gently, like a real lens) and fine grain, which also dithers away banding in the sky */
  vec2 vq = (vUv - 0.5) * vec2(uAspect, 1.0) / (0.5 * sqrt(uAspect * uAspect + 1.0)); g *= 1.0 - uVignette * smoothstep(0.25, 1.05, dot(vq, vq));
  float grain = grainHash(gl_FragCoord.xy + uFrame * vec2(37.0, 17.0)) + grainHash(gl_FragCoord.xy * 1.37 + uFrame * vec2(11.0, 53.0)) - 1.0; /* triangular, -1..1 */
  g = clamp(g + grain * uGrain * (0.0045 + 0.012 * g * (1.0 - g)), 0.0, 1.0); c = pow(g, vec3(2.2));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

// Temporal anti-aliasing, tuned for a fixed camera over swaying foliage. Each frame the projection is nudged by a sub-pixel amount (Halton 2,3), and the
// new frame is blended into a running history, so thin blades and petals are resolved over many frames instead of crawling between pixels.
// Ghosting guard: the history is clamped to the colour range of the current frame's 3x3 neighbourhood (in YCoCg, on tonemapped values), so where a
// blade has moved the stale colour is rejected; the blend weight rises where the clamp had to work hard. The camera never moves, so no velocity
// buffer is needed: everything that moves is wind, which the clamp handles at these sub-pixel to few-pixel distances.
export const TAA_FRAGMENT = `
uniform sampler2D current; uniform sampler2D history; uniform vec2 texel; uniform vec2 unjitter; uniform float historyValid; uniform float baseAlpha; uniform sampler2D reactive; uniform float reactiveOn;
varying vec2 vUv;
vec3 toY(vec3 c){ c = c / (1.0 + max(c.r, max(c.g, c.b))); return vec3(0.25*c.r + 0.5*c.g + 0.25*c.b, 0.5*c.r - 0.5*c.b, -0.25*c.r + 0.5*c.g - 0.25*c.b); }
vec3 fromY(vec3 y){ vec3 c = vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); return c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-4); }
void main() {
  vec3 cur = texture2D(current, vUv + unjitter).rgb; vec3 cy = toY(cur); // sample where this pixel would be without the jitter
  vec3 lo = cy, hi = cy, m1 = vec3(0.0), m2 = vec3(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec3 s = toY(texture2D(current, vUv + vec2(float(i), float(j)) * texel).rgb); lo = min(lo, s); hi = max(hi, s); m1 += s; m2 += s * s; }
  // variance box, a little tighter than min/max: rejects ghosts without letting single-pixel sparkles through
  vec3 mean = m1 / 9.0; vec3 sd = sqrt(max(m2 / 9.0 - mean * mean, 0.0)); lo = max(lo, mean - 1.25 * sd); hi = min(hi, mean + 1.25 * sd);
  vec3 hy = toY(texture2D(history, vUv).rgb); vec3 clamped = clamp(hy, lo, hi);
  float moved = clamp(length(clamped - hy) * 6.0, 0.0, 1.0);
  float alpha = historyValid > 0.5 ? mix(baseAlpha, 0.5, moved) : 1.0;
  if (reactiveOn > 0.5) { vec3 rm = texture2D(reactive, vUv).rgb; alpha = max(alpha, 0.85 * min(1.0, 2.0 * max(rm.r, max(rm.g, rm.b)))); } /* small moving life: trust the current frame (taaReactive.js) */
  gl_FragColor = vec4(fromY(mix(clamped, cy, alpha)), 1.0);
}`;
const UNJITTER_SIGN = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('unj') ? new URLSearchParams(window.location.search).get('unj').split(',').map(Number) : [-1, 1];
const HALTON =(i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

export function createLinearResolve(renderer, displayLut, display, { taa = false, invalidate = null } = {}) {
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      radiance: { value: null }, displayLut: { value: displayLut }, exposure: { value: 1 }, uSat: GRADE.sat, uContrast: GRADE.contrast, uToe: GRADE.toe,
      displayDomain: { value: new THREE.Vector3(display.logMin, display.logMax, display.size) },
      uBloom: { value: null }, uBloomK: { value: 0 }, uBloomLevels: { value: 6 }, uShafts: { value: null }, uShaftK: { value: 0 }, uVignette: OPTICS.vignette, uGrain: OPTICS.grain, uFrame: { value: 0 }, uAspect: { value: 16 / 9 },
    },
    vertexShader: RESOLVE_VERTEX, fragmentShader: RESOLVE_FRAGMENT,
  });
  const optics = createOptics(renderer); let opticsFrame = 0;
  const finish = (radianceTexture, w, h, sceneCamera) => { // optics, then the display transform and grade to the screen
    const o = optics.prepare(radianceTexture, w, h, sceneCamera);
    const u = material.uniforms; u.radiance.value = radianceTexture; u.exposure.value = renderer.toneMappingExposure; u.uBloom.value = o.bloom; u.uBloomK.value = o.bloomK; u.uBloomLevels.value = o.levels;
    u.uShafts.value = o.shafts; u.uShaftK.value = o.shaftK; u.uFrame.value = (opticsFrame = (opticsFrame + 1) % 997); u.uAspect.value = w / h;
    renderer.render(scene, camera);
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new THREE.Vector2(); let target = null;
  // TAA state: two history buffers (ping-pong), a jitter sequence, and a count of frames since the history was valid
  const taaMaterial = taa ? new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false, vertexShader: RESOLVE_VERTEX, fragmentShader: TAA_FRAGMENT,
    uniforms: { current: { value: null }, history: { value: null }, texel: { value: new THREE.Vector2() }, unjitter: { value: new THREE.Vector2() }, historyValid: { value: 0 }, baseAlpha: { value: 0.1 }, reactive: { value: null }, reactiveOn: { value: 0 } } }) : null;
  let reactiveTarget = null; const reactiveMaterial = taa ? new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false }) : null; const clearColor = new THREE.Color();
  const taaQuad = taa ? new THREE.Mesh(new THREE.PlaneGeometry(2, 2), taaMaterial) : null; if (taaQuad) taaQuad.frustumCulled = false;
  const taaScene = taa ? new THREE.Scene() : null; if (taaQuad) taaScene.add(taaQuad);
  let histories = null, frame = 0, settled = 0, lastRender = 0;
  const SETTLE = 24; // frames to accumulate after a still scene changes

  return {
    resetHistory() { settled = 0; frame = 0; if (taaMaterial) taaMaterial.uniforms.historyValid.value = 0; invalidate?.(); },
    render(sourceScene, sourceCamera) {
      if (taa) return this.renderTaa(sourceScene, sourceCamera);
      renderer.getDrawingBufferSize(size);
      if (!target || target.width !== size.x || target.height !== size.y) {
        target?.dispose();
        // ?rt=r11: a packed 32-bit float colour target (R11F_G11F_B10F) instead of 64-bit half floats. It saves memory traffic (12-15% on the integrated GPU,
        // ~4% on the RTX 5050); no banding showed in 1:1 sky crops at noon or dusk, but the gain on the RTX is small, so it stays opt-in until other devices matter.
        const packed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rt') === 'r11';
        target = new THREE.WebGLRenderTarget(size.x, size.y, packed ? { type: THREE.UnsignedInt101111Type, format: THREE.RGBFormat, samples: resolveSamples(renderer.capabilities.maxSamples), depthBuffer: true } : { type: THREE.HalfFloatType, samples: resolveSamples(renderer.capabilities.maxSamples), depthBuffer: true });
      }
      renderer.setRenderTarget(target);
      try { renderer.render(sourceScene, sourceCamera); } finally { renderer.setRenderTarget(null); }
      finish(target.texture, size.x, size.y, sourceCamera);
    },
    renderTaa(sourceScene, sourceCamera) {
      renderer.getDrawingBufferSize(size);
      if (!target || target.width !== size.x || target.height !== size.y) {
        target?.dispose(); histories?.forEach((h) => h.dispose());
        target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: resolveSamples(renderer.capabilities.maxSamples), depthBuffer: true });
        histories = [0, 1].map(() => new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }));
        taaMaterial.uniforms.texel.value.set(1 / size.x, 1 / size.y); taaMaterial.uniforms.historyValid.value = 0; settled = 0;
      }
      // sub-pixel jitter of the projection (a fixed camera, so the history needs no reprojection)
      const k = (frame % 16) + 1; const jx = HALTON(k, 2) - 0.5, jy = HALTON(k, 3) - 0.5; frame += 1;
      const jitter = Boolean(sourceCamera.isPerspectiveCamera);
      if (jitter) sourceCamera.setViewOffset(size.x, size.y, jx, jy, size.x, size.y);
      renderer.setRenderTarget(target);
      try { renderer.render(sourceScene, sourceCamera); } finally { renderer.setRenderTarget(null); if (jitter) sourceCamera.clearViewOffset(); }
      // reactive mask: objects on REACTIVE.layer drawn plain white at half resolution (the linear upsample dilates it a little)
      taaMaterial.uniforms.reactiveOn.value = REACTIVE.active ? 1 : 0;
      if (REACTIVE.active) {
        const w = Math.max(1, size.x >> 1), h = Math.max(1, size.y >> 1);
        if (!reactiveTarget || reactiveTarget.width !== w || reactiveTarget.height !== h) { reactiveTarget?.dispose(); reactiveTarget = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); }
        const shadows = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; const layers = sourceCamera.layers.mask, background = sourceScene.background, override = sourceScene.overrideMaterial, alpha = renderer.getClearAlpha(); renderer.getClearColor(clearColor);
        sourceCamera.layers.set(REACTIVE.layer); sourceScene.background = null; sourceScene.overrideMaterial = reactiveMaterial; renderer.setClearColor(0x000000, 1);
        try { renderer.setRenderTarget(reactiveTarget); renderer.clear(); renderer.render(sourceScene, sourceCamera); }
        finally { renderer.setRenderTarget(null); renderer.shadowMap.autoUpdate = shadows; sourceCamera.layers.mask = layers; sourceScene.background = background; sourceScene.overrideMaterial = override; renderer.setClearColor(clearColor, alpha); }
        taaMaterial.uniforms.reactive.value = reactiveTarget.texture;
      }
      const read = histories[frame % 2], write = histories[(frame + 1) % 2];
      taaMaterial.uniforms.current.value = target.texture; taaMaterial.uniforms.history.value = read.texture;
      taaMaterial.uniforms.unjitter.value.set(jitter ? UNJITTER_SIGN[0] * jx / size.x : 0, jitter ? UNJITTER_SIGN[1] * jy / size.y : 0);
      renderer.setRenderTarget(write); renderer.render(taaScene, camera); renderer.setRenderTarget(null);
      taaMaterial.uniforms.historyValid.value = 1;
      finish(write.texture, size.x, size.y, sourceCamera);
      // a still scene renders only on change: keep accumulating for a moment so it converges
      const now = performance.now(); if (now - lastRender > 120) settled = 0; lastRender = now; // a render after an idle spell is a new change
      settled += 1; if (settled < SETTLE) invalidate?.();
    },
    noteChange() { settled = 0; }, // something changed; the next frames should accumulate again
    dispose() { target?.dispose(); histories?.forEach((h) => h.dispose()); material.dispose(); quad.geometry.dispose(); taaMaterial?.dispose(); taaQuad?.geometry.dispose(); reactiveTarget?.dispose(); reactiveMaterial?.dispose(); optics.dispose(); },
  };
}

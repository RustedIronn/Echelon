import * as THREE from 'three';
import { SKY_UNIFORMS } from './skyShader.js';

// Optical finish: what a lens and the air between it and the scene add to the picture.
//  - Bloom: a little light from every bright thing spills into its surroundings (sky glow around the ridges, the sun and its glints on the water,
//    lit windows at dusk). A mip chain of the linear HDR image (13-tap downsample with a Karis average on the first step so single bright pixels
//    don't flicker, tent upsample), mixed in at a few percent before the display transform, so it is energy-preserving rather than additive glare.
//  - Light shafts: when the sun is low and near the frame, a radial blur from the sun's screen position over the bright sky around it; where
//    ridges and trees cut the sky the blur carries their shadow, so shafts and shadow-rays fall through the haze.
//  - Vignette and grain are applied in the resolve (linearResolve.js), in display space.
// ?optics=off removes all of it; ?bloom=, ?shafts=, ?vignette=, ?grain= override each strength.
const query = typeof window === 'undefined' ? new URLSearchParams('') : new URLSearchParams(window.location.search);
const OFF = query.get('optics') === 'off';
const num = (k, d) => (query.has(k) ? Number(query.get(k)) : OFF ? 0 : d);
export const OPTICS = { bloom: { value: num('bloom', 0.05) }, shafts: { value: num('shafts', 1) }, vignette: { value: num('vignette', 0.12) }, grain: { value: num('grain', 1) } };
export const OPTICS_ON = !OFF;

const VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const DOWN = `
uniform sampler2D src; uniform vec2 texel; uniform float karis; varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(src, vUv + o * texel).rgb; }
float w(vec3 c) { return karis > 0.5 ? 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))) : 1.0; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2)), d = s(vec2(-2, 0)), e = s(vec2(0)), f = s(vec2(2, 0)), g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  /* five overlapping boxes (Jimenez 2014); with karis each box is weighted by 1/(1+luma) so a lone hot pixel can't dominate */
  vec3 b0 = (j + k + l + m) * 0.25, b1 = (a + b + d + e) * 0.25, b2 = (b + c + e + f) * 0.25, b3 = (d + e + g + h) * 0.25, b4 = (e + f + h + i) * 0.25;
  float w0 = 0.5 * w(b0), w1 = 0.125 * w(b1), w2 = 0.125 * w(b2), w3 = 0.125 * w(b3), w4 = 0.125 * w(b4);
  gl_FragColor = vec4((b0 * w0 + b1 * w1 + b2 * w2 + b3 * w3 + b4 * w4) / (w0 + w1 + w2 + w3 + w4), 1.0);
}`;
const UP = `
uniform sampler2D src; uniform vec2 texel; varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(src, vUv + o * texel).rgb; }
void main() { /* 3x3 tent */
  gl_FragColor = vec4((s(vec2(-1, 1)) + s(vec2(1, 1)) + s(vec2(-1, -1)) + s(vec2(1, -1)) + 2.0 * (s(vec2(0, 1)) + s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1))) + 4.0 * s(vec2(0))) / 16.0, 1.0);
}`;
// Shafts: march from each pixel toward the sun, gathering sky brightness near the sun; occluders contribute darkness.
const SHAFTS = `
uniform sampler2D src; uniform vec2 sun; uniform float aspect; uniform float threshold; varying vec2 vUv;
void main() {
  vec2 delta = (sun - vUv) / 40.0; vec2 uv = vUv; float decay = 1.0; vec3 sum = vec3(0.0);
  for (int i = 0; i < 40; i++) {
    uv += delta;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break; /* past the frame edge there is nothing to sample (clamping smeared the corner sky over everything) */
    vec3 c = texture2D(src, uv).rgb;
    vec2 d = (uv - sun) * vec2(aspect, 1.0); float near = exp(-dot(d, d) * 9.0); /* only the sky around the sun throws shafts, not bright walls */
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); sum += c * max(l - threshold, 0.0) / max(l, 1e-4) * near * decay; decay *= 0.965;
  }
  /* every ray ends at the sun, so without a falloff the glow would veil the whole frame: keep it around the sun */
  vec2 fromSun = (vUv - sun) * vec2(aspect, 1.0);
  gl_FragColor = vec4(sum / 40.0 * exp(-length(fromSun) * 2.4), 1.0);
}`;

export function createOptics(renderer) {
  const LEVELS = 6; let chain = []; let shaftTarget = null; const size = new THREE.Vector2(-1, -1);
  const mat = (fragmentShader, uniforms, blending = THREE.NoBlending) => new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending, toneMapped: false });
  const down = mat(DOWN, { src: { value: null }, texel: { value: new THREE.Vector2() }, karis: { value: 0 } });
  const up = mat(UP, { src: { value: null }, texel: { value: new THREE.Vector2() } }, THREE.AdditiveBlending);
  const shafts = mat(SHAFTS, { src: { value: null }, sun: { value: new THREE.Vector2() }, aspect: { value: 1 }, threshold: { value: 1 } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), down); quad.frustumCulled = false; const scene = new THREE.Scene(); scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (material, target) => { quad.material = material; renderer.setRenderTarget(target); renderer.render(scene, camera); };
  const sunWorld = new THREE.Vector3(), sunView = new THREE.Vector3();
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  const out = { bloom: black, shafts: black, shaftK: 0, bloomK: 0, levels: LEVELS };

  return {
    // radiance: the linear HDR texture about to be resolved; w, h: its size; sceneCamera: for the sun's screen position
    prepare(radiance, w, h, sceneCamera) {
      out.bloom = black; out.shafts = black; out.shaftK = 0; out.bloomK = 0;
      const day = smoothstep(0.15, 0.5, SKY_UNIFORMS.uSunDir.value.y); out.bloomK = OPTICS.bloom.value * (1.3 - 0.6 * day); /* lighter at midday so daylight keeps its crispness; a richer glow at dusk and night */
      if (!OPTICS_ON && !query.has('bloom') && !query.has('shafts')) return out;
      if (size.x !== w || size.y !== h) {
        chain.forEach((t) => t.dispose()); shaftTarget?.dispose(); size.set(w, h); chain = [];
        let cw = w, ch = h; for (let i = 0; i < LEVELS; i += 1) { cw = Math.max(1, cw >> 1); ch = Math.max(1, ch >> 1); chain.push(new THREE.WebGLRenderTarget(cw, ch, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })); }
        shaftTarget = new THREE.WebGLRenderTarget(Math.max(1, w >> 2), Math.max(1, h >> 2), { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      }
      const autoClear = renderer.autoClear; renderer.autoClear = false;
      try {
        if (OPTICS.bloom.value > 0) {
          let src = radiance, sw = w, sh = h;
          for (let i = 0; i < LEVELS; i += 1) { down.uniforms.src.value = src; down.uniforms.texel.value.set(1 / sw, 1 / sh); down.uniforms.karis.value = i === 0 ? 1 : 0; pass(down, chain[i]); src = chain[i].texture; sw = chain[i].width; sh = chain[i].height; }
          for (let i = LEVELS - 1; i > 0; i -= 1) { up.uniforms.src.value = chain[i].texture; up.uniforms.texel.value.set(1 / chain[i].width, 1 / chain[i].height); pass(up, chain[i - 1]); } // each level gathers all the coarser ones
          out.bloom = chain[0].texture;
        }
        // shafts: only while the sun is low, ahead of the camera and within reach of the frame
        const sunDir = SKY_UNIFORMS.uSunDir.value; const low = (1 - smoothstep(0.12, 0.5, sunDir.y)) * smoothstep(-0.06, 0.02, sunDir.y);
        if (OPTICS.shafts.value > 0 && low > 0.01 && sceneCamera?.isPerspectiveCamera) {
          sunWorld.copy(sceneCamera.position).addScaledVector(sunDir, 1000); sunView.copy(sunWorld).applyMatrix4(sceneCamera.matrixWorldInverse);
          if (sunView.z < 0) {
            sunWorld.project(sceneCamera); const sx = sunWorld.x * 0.5 + 0.5, sy = sunWorld.y * 0.5 + 0.5;
            const reach = 1 - smoothstep(0.15, 0.7, Math.max(Math.max(-sx, sx - 1), Math.max(-sy, sy - 1), 0)); // fades as the sun leaves the frame
            if (reach > 0.01 && chain.length) {
              shafts.uniforms.src.value = chain[0].texture; shafts.uniforms.sun.value.set(sx, sy); shafts.uniforms.aspect.value = w / h;
              // with the sun inside the frame the bright patch round it is large, and the blur gathered it into a white flood over everything near
              // it: then only the brightest sky feeds the rays, and they are gentler, so the sun stays a crisp disc with faint rays
              const inView = sx > 0.02 && sx < 0.98 && sy > 0.02 && sy < 0.98;
              shafts.uniforms.threshold.value = (inView ? 7.0 : 2.0) * Math.max(0.2, SKY_UNIFORMS.uSkyGain?.value ?? 1); pass(shafts, shaftTarget);
              out.shafts = shaftTarget.texture; out.shaftK = 0.6 * OPTICS.shafts.value * low * reach * (inView ? 0.35 : 1);
            }
          }
        }
      } finally { renderer.setRenderTarget(null); renderer.autoClear = autoClear; }
      return out;
    },
    dispose() { chain.forEach((t) => t.dispose()); shaftTarget?.dispose(); down.dispose(); up.dispose(); shafts.dispose(); quad.geometry.dispose(); black.dispose(); },
  };
}
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

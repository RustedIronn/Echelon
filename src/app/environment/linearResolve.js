import * as THREE from 'three';

// Optional comparison path. The default framebuffer resolves MSAA after the Blender display transform has already been
// applied per fragment, so sub-pixel highlights (petals, blade tips) are averaged in display space and lose energy.
// This path renders scene-linear HDR into a multisampled half-float target, lets the hardware resolve it in linear
// light, and applies the same sampled Blender display LUT exactly once afterwards.
export const RESOLVE_SAMPLES = 4; // the earlier setting, kept as the comparison (?msaa=4)
// Thin cut-out geometry (blade tufts, flower petals) needs more coverage samples than 4 to look smooth: 8 by default, capped by what the GPU offers.
export function resolveSamples(maxSamples, search = typeof window === 'undefined' ? '' : window.location.search) { const asked = Number(new URLSearchParams(search).get('msaa')) || 8; return Math.max(1, Math.min(maxSamples || 4, asked)); }

// The colour grade applied once, after the display transform: a vibrance (muted colours gain more than vivid ones) and a gentle contrast. The time of day drives it, so daylight has presence and dusk stays soft.
// toe: deepens the darks (only below mid grey), which the flat display transform leaves lifted in sunlit scenes.
export const GRADE = { sat: { value: 1 }, contrast: { value: 1 }, toe: { value: 0 } };

export const RESOLVE_VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export const RESOLVE_FRAGMENT = `
uniform sampler2D radiance; uniform highp sampler3D displayLut; uniform vec3 displayDomain; uniform float exposure; uniform float uSat; uniform float uContrast; uniform float uToe;
varying vec2 vUv;
void main() {
  vec3 linearColor = texture2D(radiance, vUv).rgb;
  vec3 coordinate = clamp((log2(max(linearColor * exposure, vec3(1e-7))) - displayDomain.x) / (displayDomain.y - displayDomain.x), 0.0, 1.0);
  coordinate = (coordinate * (displayDomain.z - 1.0) + 0.5) / displayDomain.z;
  vec3 c = texture(displayLut, coordinate).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float chroma = length(c - vec3(l)) / max(l, 1e-3);
  c = mix(vec3(l), c, 1.0 + (uSat - 1.0) * (1.0 - clamp(chroma * 0.9, 0.0, 1.0)));
  vec3 g = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); g *= 1.0 - uToe * (1.0 - smoothstep(0.0, 0.62, g)); g = clamp((g - 0.5) * uContrast + 0.5, 0.0, 1.0); c = pow(g, vec3(2.2));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function createLinearResolve(renderer, displayLut, display) {
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      radiance: { value: null }, displayLut: { value: displayLut }, exposure: { value: 1 }, uSat: GRADE.sat, uContrast: GRADE.contrast, uToe: GRADE.toe,
      displayDomain: { value: new THREE.Vector3(display.logMin, display.logMax, display.size) },
    },
    vertexShader: RESOLVE_VERTEX, fragmentShader: RESOLVE_FRAGMENT,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new THREE.Vector2(); let target = null;

  return {
    render(sourceScene, sourceCamera) {
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
      material.uniforms.radiance.value = target.texture; material.uniforms.exposure.value = renderer.toneMappingExposure;
      renderer.render(scene, camera);
    },
    dispose() { target?.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}

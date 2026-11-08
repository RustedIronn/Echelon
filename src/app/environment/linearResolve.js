import * as THREE from 'three';

// Optional comparison path. The default framebuffer resolves MSAA after the Blender display transform has already been
// applied per fragment, so sub-pixel highlights (petals, blade tips) are averaged in display space and lose energy.
// This path renders scene-linear HDR into a multisampled half-float target, lets the hardware resolve it in linear
// light, and applies the same sampled Blender display LUT exactly once afterwards.
export const RESOLVE_SAMPLES = 4; // the earlier setting, kept as the comparison (?msaa=4)
// Thin cut-out geometry (blade tufts, flower petals) needs more coverage samples than 4 to look smooth: 8 by default, capped by what the GPU offers.
export function resolveSamples(maxSamples, search = typeof window === 'undefined' ? '' : window.location.search) { const asked = Number(new URLSearchParams(search).get('msaa')) || 8; return Math.max(1, Math.min(maxSamples || 4, asked)); }

export const RESOLVE_VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export const RESOLVE_FRAGMENT = `
uniform sampler2D radiance; uniform highp sampler3D displayLut; uniform vec3 displayDomain; uniform float exposure;
varying vec2 vUv;
void main() {
  vec3 linearColor = texture2D(radiance, vUv).rgb;
  vec3 coordinate = clamp((log2(max(linearColor * exposure, vec3(1e-7))) - displayDomain.x) / (displayDomain.y - displayDomain.x), 0.0, 1.0);
  coordinate = (coordinate * (displayDomain.z - 1.0) + 0.5) / displayDomain.z;
  gl_FragColor = vec4(texture(displayLut, coordinate).rgb, 1.0);
  #include <colorspace_fragment>
}`;

export function createLinearResolve(renderer, displayLut, display) {
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      radiance: { value: null }, displayLut: { value: displayLut }, exposure: { value: 1 },
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
        target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: resolveSamples(renderer.capabilities.maxSamples), depthBuffer: true });
      }
      renderer.setRenderTarget(target);
      try { renderer.render(sourceScene, sourceCamera); } finally { renderer.setRenderTarget(null); }
      material.uniforms.radiance.value = target.texture; material.uniforms.exposure.value = renderer.toneMappingExposure;
      renderer.render(scene, camera);
    },
    dispose() { target?.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}

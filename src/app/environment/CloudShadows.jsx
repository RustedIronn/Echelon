import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_UNIFORM_GLSL, SKY_UNIFORMS, SKY_ACTIVE } from './skyShader.js';

// Cloud shadows. The clouds in the generated sky cast soft shadows on the land: big, slow patches of shade drifting over the meadow, the hamlet and the
// mountains, as in any real upland valley on a fair-weather day. They add the darks and the sense of scale a sunlit scene otherwise lacks.
// How: a small map (512x512 over the valley and mountains) is rendered from the SAME cloud field as the visible sky, looking up from each ground point
// along the sun; every lit material then dims its direct sunlight (never its sky light) by that map. One tiny pass and one texture lookup per pixel.
export const CLOUD_SHADOW = { map: { value: null }, bounds: { value: new THREE.Vector4(-420, -1000, 840, 1080) }, strength: { value: 0 } };
const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('cloudshadowdebug');
const SIZE = 512, LAYER = 900; // the cloud layer sits about 900 m above the valley

const FRAGMENT = `${SKY_UNIFORM_GLSL}
uniform vec4 uBounds; uniform vec3 uCam; varying vec2 vUv;
void main(){
  vec3 P = vec3(uBounds.x + vUv.x * uBounds.z, 6.0, uBounds.y + vUv.y * uBounds.w);
  vec3 S = normalize(uSunDir); float up = max(S.y, 0.06);
  vec3 Q = P + S * (${LAYER.toFixed(1)} / up);
  // The same kind of field as the sky's clouds (warped fbm, same cover and drift), laid out over the land at a cloud's real size (a few hundred metres),
  // so the valley gets several patches of shade. It does not trace each visible cloud exactly; nobody can check that from the ground.
  vec2 p = Q.xz / 130.0 + vec2(uCloudShift * 0.35, 0.0);
  vec2 w = vec2(fbm(p * 0.8 + 3.1), fbm(p * 0.8 + 7.7)) - 0.5;
  float detail = fbm(p * 4.5 + w * 1.7); float n = fbm(p + w * 0.9) * 0.65 + detail * 0.35;
  float cm = smoothstep(0.5, 0.64, n); // about a third of the land in shade at a time
  gl_FragColor = vec4(cm, cm, cm, 1.0);
}`;

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

export default function CloudShadows() {
  const gl = useThree((s) => s.gl); const scene = useThree((s) => s.scene); const invalidate = useThree((s) => s.invalidate);
  const off = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cloudshadows') === 'off'; // ?cloudshadows=off compares
  const pass = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    const material = new THREE.ShaderMaterial({ uniforms: { ...SKY_UNIFORMS, uBounds: CLOUD_SHADOW.bounds, uCam: { value: new THREE.Vector3(-3, 3, 10) } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAGMENT, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); quad.frustumCulled = false; const passScene = new THREE.Scene(); passScene.add(quad);
    CLOUD_SHADOW.map.value = target.texture; if (typeof window !== 'undefined') window.__cloudShadow = { CLOUD_SHADOW, target, SKY_ACTIVE, SKY_UNIFORMS, read: () => { const out = new Uint16Array(SIZE * SIZE * 4); gl.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, out); let s = 0, mx = 0; for (let i = 0; i < out.length; i += 4) { const v = THREE.DataUtils.fromHalfFloat(out[i]); s += v; mx = Math.max(mx, v); } return { mean: s / (SIZE * SIZE), max: mx }; } }; // diagnostics
    return { target, material, quad, passScene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, []);
  useEffect(() => () => { pass.target.dispose(); pass.material.dispose(); pass.quad.geometry.dispose(); }, [pass]);
  const state = useRef({ key: '', frames: 0 });
  useFrame(() => {
    const st = state.current; st.frames += 1;
    if (st.frames < 4 || st.frames % 90 === 0) { let patched = false; scene.traverse((o) => { if (!o.isMesh || o.userData.noCloudShadow) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && applyCloudShadow(m)) patched = true; }); if (patched) invalidate(); }
    // strength: only while the generated sky is active and the sun is up; stronger in high, clear daylight, gone below the horizon
    const sunY = SKY_UNIFORMS.uSunDir.value.y; CLOUD_SHADOW.strength.value = DEBUG ? 10 : off || !SKY_ACTIVE.value ? 0 : 0.88 * THREE.MathUtils.smoothstep(sunY, 0.02, 0.25);
    const key = `${SKY_UNIFORMS.uSunDir.value.toArray().map((v) => v.toFixed(3))}|${SKY_UNIFORMS.uCover.value.toFixed(3)}|${SKY_UNIFORMS.uCloudShift.value.toFixed(4)}`;
    if (key !== st.key && CLOUD_SHADOW.strength.value > 0) { st.key = key; const previous = gl.getRenderTarget(); gl.setRenderTarget(pass.target); gl.render(pass.passScene, pass.camera); gl.setRenderTarget(previous); invalidate(); }
  });
  return null;
}

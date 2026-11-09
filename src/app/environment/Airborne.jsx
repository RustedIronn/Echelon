import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WIND } from './wind.js';
import { SKY_UNIFORMS, SKY_UNIFORM_GLSL } from './skyShader.js';
import { OVERLAY } from './overlay.js';

// Light in the air: tiny things that only show when the light catches them.
//  - seed fluff and pollen drifting downwind over the near meadow, glowing when the low sun is behind them (evening backlight), faint otherwise
//  - dew on the grass tips in the first hours after sunrise, sparkling back toward the sun behind the camera (dew drops shine back toward the light)
//  - midges dancing in small swarms over the water at dusk, bright dots against the low sun
// All points, a few thousand in all, drawn over the anti-aliased frame (overlay.js) so they stay crisp. ?airborne=off removes them.
export const airborneWanted = () => typeof window === 'undefined' || new URLSearchParams(window.location.search).get('airborne') !== 'off';
const BOX = { minX: -26, maxX: 22, minZ: -36, maxZ: 7 }; // the near meadow and the pool
const SWARMS = [[4.5, 2.2, -9.5], [-7.5, 2.6, -21], [9, 2.4, -15.5]]; // over the pool and the reach behind the spruce

const VERTEX = `${SKY_UNIFORM_GLSL}
uniform float uTime; uniform float uWind; uniform float uPx; uniform vec4 uBox;
attribute float aKind; attribute vec4 aSeed; varying vec3 vColor; varying float vAlpha;
float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  vec3 p = position; float k = aKind; vec2 windDir = normalize(vec2(0.8, -0.6));
  float sunUp = smoothstep(-0.04, 0.06, uSunDir.y);
  vec3 col = vec3(0.0); float size = 0.0; float alpha = 0.0;
  if (k < 0.5 || (k > 0.5 && k < 1.5)) { // fluff (0) and pollen (1): carried downwind, wrapped round the near meadow, bobbing and drifting in height
    float speed = (k < 0.5 ? 0.5 : 0.25) * (0.5 + uWind) * (0.7 + 0.6 * aSeed.x);
    vec2 drift = windDir * uTime * speed + vec2(sin(uTime * 0.31 + aSeed.y * 9.0), cos(uTime * 0.27 + aSeed.z * 9.0)) * (k < 0.5 ? 0.9 : 0.4);
    vec2 size2 = uBox.zw - uBox.xy; p.xz = uBox.xy + mod(p.xz - uBox.xy + drift, size2); /* uBox: minX, minZ, maxX, maxZ */
    p.y += sin(uTime * (0.4 + aSeed.w * 0.5) + aSeed.x * 20.0) * 0.35 + sin(uTime * 1.3 + aSeed.y * 30.0) * 0.06;
    vec3 v = normalize(p - cameraPosition); float back = pow(max(dot(v, uSunDir), 0.0), 2.0); // looking toward the sun: lit from behind
    float low = 1.0 - smoothstep(0.2, 0.6, uSunDir.y);
    float glow = (0.1 + 3.2 * back * (0.4 + 0.6 * low)) * sunUp;
    col = (k < 0.5 ? mix(vec3(1.0), uSunC, 0.5) : vec3(1.0, 0.86, 0.5) * uSunC) * glow * (k < 0.5 ? 1.2 : 0.8);
    size = k < 0.5 ? 0.02 : 0.008; alpha = 1.0;
  } else if (k < 2.5) { // dew: still, on the grass tips, sparkling back toward the sun behind the camera, only in the early morning
    vec3 v = normalize(p - cameraPosition); float retro = pow(max(dot(-v, uSunDir), 0.0), 2.0);
    float morning = (1.0 - smoothstep(-0.35, 0.1, uSunDir.x)) * smoothstep(-0.02, 0.06, uSunDir.y) * (1.0 - smoothstep(0.25, 0.45, uSunDir.y));
    float twinkle = pow(0.5 + 0.5 * sin(uTime * (1.5 + 3.0 * aSeed.x) + aSeed.y * 40.0), 4.0);
    col = mix(vec3(1.0), uSunC, 0.3) * (0.5 + 9.0 * twinkle) * retro * morning; /* a glint is the sun mirrored: bright enough to bloom */
    size = 0.003 + 0.003 * aSeed.z; alpha = 1.0;
  } else { // midges: dancing in a loose swarm round a fixed point, at dusk
    float t = uTime * (2.0 + aSeed.w * 2.0);
    p += vec3(sin(t + aSeed.x * 30.0), sin(t * 1.37 + aSeed.y * 30.0) * 0.6, cos(t * 0.83 + aSeed.z * 30.0)) * (0.25 + 0.35 * aSeed.w);
    vec3 v = normalize(p - cameraPosition); float back = pow(max(dot(v, uSunDir), 0.0), 2.0);
    float dusk = smoothstep(-0.06, 0.02, uSunDir.y) * (1.0 - smoothstep(0.12, 0.28, uSunDir.y));
    col = uSunC * (0.15 + 2.2 * back) * dusk; size = 0.004; alpha = 1.0;
  }
  vec4 mv = viewMatrix * vec4(p, 1.0); float px = size * uPx / max(-mv.z, 0.1) * 2.5; /* the sprite holds a soft glow 2.5x the mote itself */
  // never smaller than a pixel: shrink the light instead, so sub-pixel points fade rather than flicker
  vColor = col * (k > 1.5 && k < 2.5 ? 1.0 : min(1.0, px * px / 6.25)) * uSkyGain; /* dew glints are specular points: bright even below a pixel */ vAlpha = alpha; gl_PointSize = max(px, k > 1.5 && k < 2.5 ? 2.5 : 1.0); /* a glint is a little star of light even when the drop is far smaller */
  gl_Position = projectionMatrix * mv; if (dot(col, col) < 1e-6) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FRAGMENT = `varying vec3 vColor; varying float vAlpha;
void main() { vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; float soft = exp(-r * r * 9.0); gl_FragColor = vec4(vColor * soft * 2.2, 1.0); /* a soft round glow */ }`;

export default function Airborne({ ground }) {
  const camera = useThree((s) => s.camera); const buffer = useMemo(() => new THREE.Vector2(), []);
  const points = useMemo(() => {
    const groundAt = (x, z) => { const g = ground ? ground.at(x, z) : NaN; return Number.isFinite(g) ? g : 2; };
    const rnd = (() => { let a = 99; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const P = [], K = [], S = [];
    const add = (x, y, z, k) => { P.push(x, y, z); K.push(k); S.push(rnd(), rnd(), rnd(), rnd()); };
    const inBox = () => [BOX.minX + rnd() * (BOX.maxX - BOX.minX), BOX.minZ + rnd() * (BOX.maxZ - BOX.minZ)];
    for (let i = 0; i < 420; i += 1) { const [x, z] = inBox(); add(x, groundAt(x, z) + 0.6 + rnd() * 3.2, z, 0); } // seed fluff
    for (let i = 0; i < 700; i += 1) { const [x, z] = inBox(); add(x, groundAt(x, z) + 0.3 + rnd() * 1.6, z, 1); } // pollen
    for (let i = 0; i < 1800; i += 1) { const x = -14 + rnd() * 20, z = -16 + rnd() * 22; const g = ground ? ground.at(x, z) : NaN; if (!Number.isFinite(g) || g < 1.88) continue; add(x, g + 0.25 + rnd() * 0.3, z, 2); } // dew, on dry meadow only
    for (const [cx, cy, cz] of SWARMS) for (let i = 0; i < 70; i += 1) add(cx + (rnd() - 0.5) * 0.6, cy + (rnd() - 0.5) * 0.5, cz + (rnd() - 0.5) * 0.6, 3); // midges
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aKind', new THREE.Float32BufferAttribute(K, 1)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(S, 4));
    const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...SKY_UNIFORMS, uTime: WIND.time, uWind: WIND.strength, uPx: { value: 1000 }, uBox: { value: new THREE.Vector4(BOX.minX, BOX.minZ, BOX.maxX, BOX.maxZ) } } });
    const pts = new THREE.Points(g, material); pts.name = 'Airborne'; pts.frustumCulled = false; return pts;
  }, [ground]);
  useEffect(() => { OVERLAY.scene.add(points); return () => { OVERLAY.scene.remove(points); points.geometry.dispose(); points.material.dispose(); }; }, [points]);
  useFrame((state) => { // pixels per metre at 1 m: the drawing-buffer height over the view's vertical extent
    const h = state.gl.getDrawingBufferSize(buffer).y; points.material.uniforms.uPx.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  });
  return null;
}

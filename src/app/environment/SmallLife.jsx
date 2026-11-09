import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WIND } from './wind.js';
import { SKY_UNIFORMS } from './skyShader.js';
import { REACTIVE } from './taaReactive.js';
import { createButterflies, createBirds } from './smallLifeMotion.js';

// Small life: a few butterflies wandering over the foreground meadow on sunny hours, now and then a small flock of birds crossing the valley, and a
// thread of smoke from a cottage chimney. All rare and subtle, so the world reads as inhabited rather than busy. Everything runs on the world clock
// (WIND.time), so it pauses with the wind, with the tab hidden and with reduced motion. ?life=0 turns it off.
export const lifeWanted = () => typeof window === 'undefined' || new URLSearchParams(window.location.search).get('life') !== '0';
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- butterflies: two hinged wings, flapping in the vertex shader; paths computed on the CPU (only a handful)
function makeButterflies(count) {
  const g = new THREE.BufferGeometry(); const s = 0.045; // half wingspan: a 9 cm butterfly
  // each wing is a quad (x from the body out to the tip, z along the body, +z the head); the wing outline is cut out in the fragment shader
  const P = [0, 0, -s * 0.8, -s, 0, -s * 0.8, -s, 0, s * 0.8, 0, 0, s * 0.8, 0, 0, -s * 0.8, s, 0, -s * 0.8, s, 0, s * 0.8, 0, 0, s * 0.8];
  const side = [0, -1, -1, 0, 0, 1, 1, 0]; g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(8).fill([0, 1, 0]).flat(), 3)); g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  const wing = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1.45), 1); wing.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aWing', wing); // wing angle, set each frame (smallLifeMotion.js)
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, alphaToCoverage: true });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float aSide; attribute float aWing; varying vec2 vWing;\n` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vWing = vec2(abs(position.x), position.z) / ${s.toFixed(4)};
{ float flap = aWing; float r = abs(transformed.x);
  transformed = vec3(sign(transformed.x) * r * cos(flap), r * sin(flap), transformed.z); }`);
    // wing outline: a broad forewing toward the head and a rounder hindwing behind, a dark border, a dark spot on the forewing, a darker root
    shader.fragmentShader = 'varying vec2 vWing;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 w = vWing; vec2 f = (w - vec2(0.52, 0.28)) / vec2(0.52, 0.5); vec2 hw = (w - vec2(0.36, -0.36)) / vec2(0.38, 0.42);
  float df = length(f), dh = length(hw); float d = min(df, dh);
  float edge = fwidth(d) + 1e-4; float cover = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, d); if (cover < 0.02) discard;
  float border = smoothstep(0.72, 0.9, d); float spot = 1.0 - smoothstep(0.12, 0.2, length(w - vec2(0.62, 0.42)));
  diffuseColor.rgb *= mix(1.0, 0.18, max(border * 0.85, spot * 0.8)) * mix(0.55, 1.0, smoothstep(0.0, 0.25, w.x));
  diffuseColor.a = cover; }`);
  };
  const mesh = new THREE.InstancedMesh(g, material, count); mesh.name = 'Small life / butterflies'; mesh.frustumCulled = false; mesh.castShadow = false;
  const palette = ['#f2d24a', '#e8873a', '#f4f1e6', '#8fa8d6', '#e9b45a', '#f6e27a', '#d9653a']; /* brimstone, orange-tip, white, blue, fritillary... */
  for (let i = 0; i < count; i += 1) mesh.setColorAt(i, new THREE.Color(palette[i % palette.length]));
  return mesh;
}

// ---- birds: a loose flock of dark V shapes, gliding with occasional wingbeats, crossing the valley high up every couple of minutes
function makeBirds(count) {
  const g = new THREE.BufferGeometry(); const s = 0.65; // x1.5 per instance: a 2 m span (a buzzard, a little generous) seen at 140-170 m, a small silhouette
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.09, 0, -s, 0.05, 0, 0, -0.07, 0, 0, 0.09, 0, s, 0.05, 0, 0, -0.07, 0], 3)); // an M seen from behind: wings in the view plane
  g.setAttribute('aSide', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0], 1));
  const wing = new THREE.InstancedBufferAttribute(new Float32Array(count), 1); wing.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aWing', wing); // wing lift, set each frame (smallLifeMotion.js)
  const material = new THREE.MeshBasicMaterial({ color: '#1d2228', side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aSide; attribute float aWing;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
{ float r = abs(transformed.x); if (aSide != 0.0) transformed.y += r * aWing; }`);
  };
  const mesh = new THREE.InstancedMesh(g, material, count); mesh.name = 'Small life / birds'; mesh.frustumCulled = false; mesh.renderOrder = 3;
  return mesh;
}

// ---- chimney smoke: soft camera-facing puffs rising, growing and bending downwind, fading as they go
export function makeChimneySmoke(top, count = 22) {
  const g = new THREE.PlaneGeometry(1, 1); const seed = new Float32Array(count); for (let i = 0; i < count; i += 1) seed[i] = i / count; g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uLifeTime: WIND.time, uWindStrength: WIND.strength, uTop: { value: new THREE.Vector3(...top) }, uColor: { value: new THREE.Color() }, uDensity: { value: 0 } },
    vertexShader: `uniform float uLifeTime; uniform float uWindStrength; uniform vec3 uTop; attribute float aSeed; varying vec2 vUv; varying float vAge;
void main() {
  float age = fract(aSeed + uLifeTime / 14.0); vAge = age; vUv = uv; // each puff takes 14 s to rise and fade
  vec2 dir=normalize(vec2(0.8,-0.6));
  vec2 drift = dir * (age*age*mix(1.4,5.5,clamp(uWindStrength,0.0,1.0)) + age*.6);
  drift += vec2(-dir.y,dir.x)*sin(uLifeTime*.21-aSeed*8.0)*age*.28;
  vec3 p = uTop + vec3(drift.x, age * 5.2 + sin(uLifeTime * 0.45 + aSeed * 31.0) * 0.14 * age, drift.y);
  float size = 0.18 + age * 1.65;
  vec4 mv = viewMatrix * vec4(p, 1.0); mv.xy += position.xy * size; gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform vec3 uColor; uniform float uDensity; varying vec2 vUv; varying float vAge;
float h(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main() {
  vec2 q = vUv - 0.5; float r = length(q) * 2.0; float soft = 1.0 - smoothstep(0.35, 1.0, r);
  float breakup = 0.65 + 0.35 * noise(vUv * 5.0 + vAge * 3.0);
  float a = soft * breakup * smoothstep(0.0, 0.06, vAge) * (1.0 - smoothstep(0.45, 1.0, vAge)) * 0.24 * uDensity;
  gl_FragColor = vec4(uColor, a);
}` });
  const mesh = new THREE.InstancedMesh(g, material, count); mesh.name = 'Small life / chimney smoke'; mesh.frustumCulled = false; mesh.renderOrder = 3;
  const m = new THREE.Matrix4(); for (let i = 0; i < count; i += 1) mesh.setMatrixAt(i, m);
  return mesh;
}

export default function SmallLife({ ground }) {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const group = new THREE.Group(); group.name = 'Small life';
    const butterflies = makeButterflies(7), birds = makeBirds(8); butterflies.layers.enable(REACTIVE.layer); birds.layers.enable(REACTIVE.layer); group.add(butterflies, birds); return { group, butterflies, birds };
  }, []);
  useEffect(() => () => { REACTIVE.active = false; for (const o of [built.butterflies, built.birds]) { o.geometry.dispose(); o.material.dispose(); o.dispose(); } }, [built]);
  // behaviour (smallLifeMotion.js): butterflies keep to the near meadow left of the pool and perch only on dry ground
  const life = useMemo(() => {
    const groundAt = (x, z) => (ground ? ground.at(x, z) : NaN);
    return { butterflies: createButterflies(7, { region: { minX: -9, maxX: 0.5, minZ: -6, maxZ: 2.5 }, groundAt, isLand: (x, z) => groundAt(x, z) > 1.88 }), birds: createBirds({ flockMax: 7, firstPass: 12, firstSoar: 30 }), last: null };
  }, [ground]);
  const smokeRef = useRef(null);
  const m = useMemo(() => new THREE.Matrix4(), []); const q = useMemo(() => new THREE.Quaternion(), []); const e = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []); const v = useMemo(() => new THREE.Vector3(), []); const sc = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const t = WIND.time.value; const sunY = SKY_UNIFORMS.uSunDir.value.y; const dt = life.last === null ? 0 : t - life.last; life.last = t; // the world clock: pauses with the wind
    // butterflies
    life.butterflies.step(dt, t, sunY); let anyB = false; const wingB = built.butterflies.geometry.attributes.aWing;
    life.butterflies.list.forEach(({ out: o }, i) => {
      e.set(o.pitch, o.yaw, o.roll); q.setFromEuler(e); v.set(o.x, o.y, o.z); m.compose(v, q, sc.setScalar(o.scale)); built.butterflies.setMatrixAt(i, m); wingB.setX(i, o.wing); if (o.scale > 0.01) anyB = true;
    });
    built.butterflies.visible = anyB; built.butterflies.instanceMatrix.needsUpdate = true; wingB.needsUpdate = true;
    // birds: wings stay in the view plane, so the roll is a tilt of the silhouette
    life.birds.step(dt, t, sunY, WIND.strength?.value ?? 0.4); let anyBird = false; const wingD = built.birds.geometry.attributes.aWing;
    life.birds.out.forEach((o, i) => {
      e.set(0, 0, o.roll); q.setFromEuler(e); v.set(o.x, o.y, o.z); m.compose(v, q, sc.setScalar(o.scale)); built.birds.setMatrixAt(i, m); wingD.setX(i, o.wing); if (o.scale > 0) anyBird = true;
    });
    built.birds.visible = anyBird; built.birds.instanceMatrix.needsUpdate = true; wingD.needsUpdate = true;
    REACTIVE.active = built.butterflies.visible || built.birds.visible; // keeps TAA from blending them away (taaReactive.js)
    // smoke: denser in the morning, evening and night (fires lit), a thin thread at midday; coloured by the horizon light
    if (!smokeRef.current) scene.traverse((o) => { if (o.name === 'Small life / chimney smoke') smokeRef.current = o; });
    const smoke = smokeRef.current; if (smoke) {
      const midday = smooth(0.35, 0.75, sunY); const hearth=.72+.28*Math.sin(t*.07+.8)*Math.sin(t*.11+1.2);
      const density = (0.28 + 0.62 * (1 - midday))*hearth;
      smoke.material.uniforms.uDensity.value = density; smoke.material.uniforms.uColor.value.copy(SKY_UNIFORMS.uHor.value).multiplyScalar(SKY_UNIFORMS.uSkyGain.value * 0.7);
    }
  });
  built.group.userData.life = life; // for diagnostics scripts
  return <primitive object={built.group} />;
}

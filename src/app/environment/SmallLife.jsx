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

// ---- birds in the round: a body, a tail and two wings, flying along their heading and banking into turns, lit by the scene. Local frame: +x the
// head, y up, z across the span. Rooks are glossy black and narrow-winged; the buzzard has broad fingered wings, a fanned tail and the pale underwing
// with dark wrist patches and dark tips you see from below. Sunlight glows through the thin wing edges when the bird is against the sun.
// ?birds=flat restores the earlier flat silhouettes.
export const ROUND_BIRDS = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('birds') !== 'flat';
const BIRD_KINDS = {
  rook: { span: 0.55, chord: 0.2, fingers: 4, tail: 0.08, body: '#1b1c21', wing: '#1d1e24', tip: '#111216', edge: '#2a2c33', patch: '#1d1e24' },
  buzzard: { span: 0.7, chord: 0.28, fingers: 5, tail: 0.14, body: '#7d6a52', wing: '#8a7559', tip: '#1c1610', edge: '#3f3224', patch: '#241a12' }, // a buzzard from below against a bright sky: mid brown, darker tips and trailing edge
};
function makeRoundBirds(count, kind) {
  const k = BIRD_KINDS[kind]; const P = [], C = [], S = [], E = [], I = [];
  const col = (hex) => new THREE.Color(hex);
  const v = (x, y, z, color, side = 0, edge = 0) => { P.push(x, y, z); C.push(color.r, color.g, color.b); S.push(side); E.push(edge); return P.length / 3 - 1; };
  // body: a slim double cone from beak to tail root, dark on top, the species colour beneath
  const back = col(kind === 'rook' ? '#15161a' : '#3e2f22'), belly = col(k.body);
  const head = v(0.3, 0, 0, back), tailRoot = v(-0.24, 0, 0, belly), top = v(0.02, 0.045, 0, back), under = v(0.02, -0.04, 0, belly), l = v(0.02, 0, -0.05, belly), r = v(0.02, 0, 0.05, belly);
  for (const [a, b] of [[top, l], [l, under], [under, r], [r, top]]) { I.push(head, a, b); I.push(tailRoot, b, a); }
  // tail: a fan behind the body
  const tailCol = col(kind === 'rook' ? '#17181c' : '#6f5c45'); const t0 = v(-0.22, 0, 0, tailCol);
  const tailPts = [-1, -0.5, 0, 0.5, 1].map((u) => v(-0.42 - (1 - Math.abs(u)) * 0.03, 0, u * k.tail, tailCol, 0, 0.6));
  for (let i = 0; i < tailPts.length - 1; i += 1) I.push(t0, tailPts[i], tailPts[i + 1]);
  // wings: an arm from the body to the wrist, then the hand ending in separated fingers; drawn as a fan from a point inside the wing
  for (const s of [-1, 1]) {
    const wingCol = col(k.wing), tip = col(k.tip), edge = col(k.edge), patch = col(k.patch);
    const centre = v(-0.02, 0, s * k.span * 0.32, wingCol, s);
    const ring = [];
    ring.push(v(0.09, 0, s * 0.04, wingCol, s)); // root, leading edge
    ring.push(v(0.08, 0, s * k.span * 0.55, patch, s)); // the wrist (a dark patch on a buzzard)
    for (let f = 0; f < k.fingers; f += 1) { // the fingers: alternating tips and notches
      const u = f / (k.fingers - 1); const x = 0.03 - u * k.chord * 0.85, z = s * k.span * (0.93 + 0.07 * Math.sin(Math.PI * u));
      ring.push(v(x, 0, z, tip, s, 1)); if (f < k.fingers - 1) ring.push(v(x - k.chord * 0.1, 0, s * k.span * 0.86, tip, s, 1));
    }
    ring.push(v(-k.chord * 0.85, 0, s * k.span * 0.7, edge, s, 0.8)); // trailing edge, darker
    ring.push(v(-k.chord * 0.7, 0, s * k.span * 0.3, edge, s, 0.6));
    ring.push(v(-0.12, 0, s * 0.04, wingCol, s));
    for (let i = 0; i < ring.length; i += 1) I.push(centre, ring[i], ring[(i + 1) % ring.length]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(S, 1)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(E, 1)); g.setIndex(I); g.computeVertexNormals();
  const wing = new THREE.InstancedBufferAttribute(new Float32Array(count), 1); wing.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aWing', wing);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: kind === 'rook' ? 0.55 : 0.85, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    // the wings rise and fall about the body (aWing: lift per unit of span); the thin edges let the light through when the bird is against the sun
    shader.vertexShader = 'attribute float aSide; attribute float aWing; attribute float aEdge; varying float vEdge;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vEdge = aEdge; if (aSide != 0.0) { float r = abs(transformed.z); transformed.y += r * aWing; transformed.x -= r * abs(aWing) * 0.15; }`);
    shader.fragmentShader = 'varying float vEdge;\n' + shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
      `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
       reflectedLight.directDiffuse += directLight.color * pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0) * (0.05 + 0.95 * vEdge) * (vec3(0.9, 0.75, 0.55) + material.diffuseContribution) * 0.35;`));
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 1.15; // the underside takes a little light from the sky and the meadow below');
  };
  material.customProgramCacheKey = () => `round-bird-${kind}`;
  const mesh = new THREE.InstancedMesh(g, material, count); mesh.name = `Small life / birds (${kind})`; mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.castShadow = false;
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
    const butterflies = makeButterflies(7); butterflies.layers.enable(REACTIVE.layer); group.add(butterflies);
    // birds: the flock (instances 0-6 of smallLifeMotion's output) and the buzzard (instance 7)
    const flock = ROUND_BIRDS ? makeRoundBirds(7, 'rook') : makeBirds(8); const buzzard = ROUND_BIRDS ? makeRoundBirds(1, 'buzzard') : null;
    for (const b of [flock, buzzard]) if (b) { b.layers.enable(REACTIVE.layer); group.add(b); }
    return { group, butterflies, flock, buzzard, heading: new Float32Array(8), prev: new Float32Array(24).fill(NaN) };
  }, []);
  useEffect(() => () => { REACTIVE.active = false; for (const o of [built.butterflies, built.flock, built.buzzard]) if (o) { o.geometry.dispose(); o.material.dispose(); o.dispose(); } }, [built]);
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
    life.birds.step(dt, t, sunY, WIND.strength?.value ?? 0.4); let anyFlock = false, anyBuzzard = false;
    life.birds.out.forEach((o, i) => {
      const mesh = built.buzzard && i === 7 ? built.buzzard : built.flock; const slot = built.buzzard && i === 7 ? 0 : i; const wing = mesh.geometry.attributes.aWing;
      if (ROUND_BIRDS) { // face along the flight: the heading from the last step (kept while the bird hovers), banked into the turn, a touch nose-down in a glide
        const p = built.prev, dx = o.x - p[i * 3], dz = o.z - p[i * 3 + 2], dy = o.y - p[i * 3 + 1];
        if (dx * dx + dz * dz > 1e-6) built.heading[i] = Math.atan2(-dz, dx);
        const speed = Math.hypot(dx, dz) || 1; e.set(o.roll * 1.4, built.heading[i], Math.max(-0.3, Math.min(0.3, dy / speed)));
        p[i * 3] = o.x; p[i * 3 + 1] = o.y; p[i * 3 + 2] = o.z;
      } else e.set(0, 0, o.roll); // flat silhouettes: wings in the view plane, the roll a tilt
      q.setFromEuler(e); v.set(o.x, o.y, o.z); m.compose(v, q, sc.setScalar(o.scale * (ROUND_BIRDS ? 1.25 : 1))); /* seen side-on the round birds lose span to foreshortening */ mesh.setMatrixAt(slot, m); wing.setX(slot, o.wing);
      if (o.scale > 0) { if (mesh === built.buzzard) anyBuzzard = true; else anyFlock = true; }
    });
    for (const [mesh, any] of [[built.flock, anyFlock || (!built.buzzard && anyBuzzard)], [built.buzzard, anyBuzzard]]) if (mesh) { mesh.visible = any; mesh.instanceMatrix.needsUpdate = true; mesh.geometry.attributes.aWing.needsUpdate = true; }
    REACTIVE.active = built.butterflies.visible || built.flock.visible || Boolean(built.buzzard?.visible); // keeps TAA from blending them away (taaReactive.js)
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

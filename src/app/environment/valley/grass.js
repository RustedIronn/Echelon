import * as THREE from 'three';
import { applyValleyLook } from './look.js';

// The near meadow's grass, from the frame's bottom edge (about 38 m out) to about 230 m: crossed cards of painted grass, each a clump of
// blades of several kinds and heights with seed heads and the odd flower, standing in the sward. Cards grow with distance so coverage stays
// even while their count stays bounded. Lit like everything else, with a strong edge glow: grass seen against the sun shines.
// The texture is drawn once on a canvas: no assets to fetch.
function grassTexture() {
  const W = 512, H = 256; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const greens = ['#5f7f2e', '#6f8f35', '#7c9a3c', '#556f2a', '#8aa147', '#9aa65a', '#7a8a3e'];
  for (let i = 0; i < 420; i += 1) { // blades: tapering curves from the ground, leaning, some bent over
    const x = rnd() * W, h = H * (0.35 + 0.6 * rnd() ** 0.7), lean = (rnd() - 0.5) * 0.6 * h, w = 1.2 + 2.6 * rnd();
    g.fillStyle = greens[Math.floor(rnd() * greens.length)]; g.globalAlpha = 0.85 + 0.15 * rnd();
    g.beginPath(); g.moveTo(x - w, H); g.quadraticCurveTo(x - w * 0.5 + lean * 0.3, H - h * 0.55, x + lean, H - h); g.quadraticCurveTo(x + w * 0.5 + lean * 0.3, H - h * 0.55, x + w, H); g.fill();
  }
  for (let i = 0; i < 70; i += 1) { // flowering grass stems with buff and purple-grey seed heads (the haze over a hay meadow)
    const x = rnd() * W, h = H * (0.6 + 0.38 * rnd()), lean = (rnd() - 0.5) * 30; g.globalAlpha = 1; g.strokeStyle = '#8c8f55'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.4, H - h * 0.6, x + lean, H - h); g.stroke();
    g.fillStyle = rnd() < 0.6 ? '#c2b47c' : '#9a8a92'; g.beginPath(); g.ellipse(x + lean, H - h, 2.2, 7 + 6 * rnd(), lean * 0.01, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 26; i += 1) { // a few flowers: buttercup, ox-eye daisy, clover, knapweed
    const x = rnd() * W, y = H * (0.25 + 0.55 * rnd()); const col = ['#f2d22e', '#f4f1e8', '#d9a0c0', '#9a5aa8'][Math.floor(rnd() * 4)]; g.globalAlpha = 1;
    g.fillStyle = col; g.beginPath(); g.arc(x, y, 2.6 + 2.4 * rnd(), 0, Math.PI * 2); g.fill(); if (col === '#f4f1e8') { g.fillStyle = '#e8b42a'; g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// sites: [x, y, z, size, tone] per card; ground: { at(x,z), skip(x,z) }
export function planGrass(ground, { from = 56, to = 420, camera = [0, 0] } = {}) {
  const out = []; const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let r = from; r < to; ) { const size = 0.9 * (r / 40) ** 0.85; const step = size * 0.55; const da = (step / r) * (180 / Math.PI);
    for (let az = -41; az <= 41; az += da) { const ja = az + (hash(az, r) - 0.5) * da, jr = r + (hash(r, az) - 0.5) * step; const a = ja * Math.PI / 180; const x = camera[0] + Math.sin(a) * jr, z = camera[1] - Math.cos(a) * jr;
      if (ground.skip(x, z)) continue; const fade = 1 - Math.min(1, Math.max(0, (jr - 0.55 * to) / (0.45 * to))); if (fade <= 0.02) continue; out.push(x, ground.at(x, z), z, size * (0.8 + 0.45 * hash(x, z)) * (0.35 + 0.65 * fade), hash(z, x)); /* shorter toward the far edge, so the sward melts into the ground colour */ }
    r += step; }
  return out;
}

export function buildGrass(sites) {
  const n = sites.length / 5; const tex = grassTexture();
  const geo = new THREE.BufferGeometry(); const P = [], U = [], I = []; // two crossed cards, 1 m wide and 0.55 m tall
  [[1, 0], [0, 1]].forEach(([dx, dz], k) => { const o = k * 4; P.push(-0.5 * dx, 0, -0.5 * dz, 0.5 * dx, 0, 0.5 * dz, 0.5 * dx, 0.55, 0.5 * dz, -0.5 * dx, 0.55, -0.5 * dz); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(o, o + 1, o + 2, o, o + 2, o + 3); });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(8).fill([0, 1, 0]).flat(), 3)); // lit as the sward, not as upright cards
  const mat = applyValleyLook(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide }), { glow: 1.1 });
  const mesh = new THREE.InstancedMesh(geo, mat, n); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i += 1) { const [x, y, z, s, t] = sites.slice(i * 5, i * 5 + 5); q.setFromAxisAngle(up, t * Math.PI); m.compose(new THREE.Vector3(x, y - 0.05 * s, z), q, new THREE.Vector3(s, Math.min(s, 1.25) * (0.8 + 0.5 * t), s)); /* cards widen with distance but the grass stays meadow height */ mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.setRGB(0.95 + 0.1 * t, 1.0, 0.85 + 0.2 * t)); }
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.name = `meadow grass (${n} clumps)`; return mesh;
}

// Real grass close to the camera (from the frame's edge to about 60 m), where painted cards would show as flat: clumps of curved, tapering
// blades of several heights and greens, darker at the base and lighter at the tip, with the odd flowering stem. The flowers follow the
// ground: buttercups where it is damp, ox-eye daisies and harebells on the dry knoll, a hay-meadow mix elsewhere. The blades sway in the wind.
export const WIND = { uTime: { value: 0 } };
function clumpGeometry(seed, flowerKind) {
  const rnd = (() => { let s = seed * 9301 + 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const P = [], C = [], N = [], I = []; const greens = [[0.25, 0.38, 0.11], [0.31, 0.43, 0.14], [0.36, 0.45, 0.17], [0.42, 0.47, 0.2], [0.28, 0.35, 0.12]];
  const blade = (x0, z0, h, w, lean, dir, col, tip) => { const seg = 4, base = P.length / 3; const dx = Math.cos(dir), dz = Math.sin(dir), px = -dz, pz = dx;
    for (let k = 0; k <= seg; k += 1) { const t = k / seg, bend = lean * t * t, ww = w * (1 - t * 0.92); const x = x0 + dx * bend, z = z0 + dz * bend, y = h * t * (1 - 0.18 * lean / h * t);
      P.push(x - px * ww, y, z - pz * ww, x + px * ww, y, z + pz * ww); const c = col.map((v, i) => v * (0.42 + 0.45 * t) + (tip[i] - v) * t * t * 0.22); /* dark in the sward, lighter only at the very tip */ C.push(...c, ...c); N.push(dx * 0.3, 1, dz * 0.3, dx * 0.3, 1, dz * 0.3); }
    for (let k = 0; k < seg; k += 1) { const a = base + k * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } };
  for (let b = 0; b < 36; b += 1) { const r = 0.34 * Math.sqrt(rnd()), a = rnd() * 6.283; const h = 0.25 + 0.45 * rnd() ** 1.5; blade(Math.cos(a) * r, Math.sin(a) * r, h, 0.006 + 0.008 * rnd(), (0.05 + 0.25 * rnd()) * h, rnd() * 6.283, greens[Math.floor(rnd() * greens.length)], [0.72, 0.7, 0.4]); }
  for (let b = 0; b < 4; b += 1) { const a = rnd() * 6.283, r = 0.15 * rnd(); blade(Math.cos(a) * r, Math.sin(a) * r, 0.6 + 0.3 * rnd(), 0.003, 0.08, rnd() * 6.283, [0.5, 0.5, 0.3], [0.78, 0.7, 0.5]); } // flowering grass stems
  if (flowerKind >= 0) { const cols = [[0.95, 0.78, 0.1], [0.95, 0.94, 0.88], [0.55, 0.4, 0.75], [0.8, 0.45, 0.65]]; const col = cols[flowerKind];
    for (let f = 0; f < 3; f += 1) { const a = rnd() * 6.283, r = 0.18 * rnd(), h = 0.3 + 0.25 * rnd(); const x = Math.cos(a) * r, z = Math.sin(a) * r; blade(x, z, h, 0.003, 0.02, a, [0.3, 0.42, 0.15], [0.3, 0.42, 0.15]);
      const base = P.length / 3, s = flowerKind === 1 ? 0.03 : 0.02; for (let k = 0; k < 6; k += 1) { const t = (k / 6) * 6.283; P.push(x + Math.cos(t) * s, h + 0.004, z + Math.sin(t) * s); C.push(...col); N.push(0, 1, 0); }
      P.push(x, h + 0.008, z); C.push(...(flowerKind === 1 ? [0.92, 0.72, 0.15] : col)); N.push(0, 1, 0); for (let k = 0; k < 6; k += 1) I.push(base + 6, base + k, base + ((k + 1) % 6)); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C.map((v) => Math.max(0, v) ** 2.2 * 1.6), 3)); /* the colours above are display colours; the renderer wants linear light */ g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I); return g;
}
// sites: [x, y, z, size, tone, flowerKind (-1 none, 0 buttercup, 1 daisy, 2 harebell, 3 knapweed)]
export function planBlades(ground, { from = 9, to = 62, camera = [0, 0] } = {}) {
  const out = []; const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let r = from; r < to; ) { const step = 0.45 + 0.012 * r; const da = (step / r) * (180 / Math.PI);
    for (let az = -40; az <= 40; az += da) { const ja = az + (hash(az, r) - 0.5) * da, jr = r + (hash(r, az) - 0.5) * step; const a = ja * Math.PI / 180; const x = camera[0] + Math.sin(a) * jr, z = camera[1] - Math.cos(a) * jr;
      if (ground.skip(x, z)) continue; const zone = ground.zone(x, z); const fh = hash(x * 1.3, z * 0.7); const patch = hash(Math.floor(x / 6), Math.floor(z / 6));
      const kind = fh > 0.8 && patch > 0.3 ? (zone === 'wet' ? 0 : zone === 'dry' ? (fh > 0.93 ? 2 : 1) : [0, 1, 3, 1][Math.floor(patch * 4)]) : -1;
      out.push(x, ground.at(x, z), z, 0.95 + 0.45 * hash(z, x) + 0.006 * r, hash(x, z), kind); /* meadow height: blades 0.25-0.9 m */ }
    r += step; }
  return out;
}
export function buildBlades(sites) {
  const group = new THREE.Group(); group.name = 'meadow blades';
  const mat = applyValleyLook(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { glow: 1.1 });
  const look = mat.onBeforeCompile; mat.onBeforeCompile = (sh, r) => { sh.uniforms.uTime = WIND.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec3 wb = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float gust = 0.5 + 0.5 * sin(uTime * 0.6 + wb.x * 0.05 + wb.z * 0.03);
  float sway = (sin(uTime * 1.9 + wb.x * 0.7 + wb.z * 0.4) * 0.6 + sin(uTime * 3.1 + wb.z * 1.3) * 0.25) * (0.35 + 0.65 * gust);
  transformed.x += sway * 0.09 * position.y * position.y / 0.25; transformed.z += sway * 0.04 * position.y * position.y / 0.25; }`); look(sh, r); };
  mat.customProgramCacheKey = () => 'valley-blades';
  const kinds = [-1, 0, 1, 2, 3]; const variants = 4;
  for (const kind of kinds) for (let v = 0; v < variants; v += 1) {
    const mine = []; for (let i = 0; i < sites.length; i += 6) if (sites[i + 5] === kind && Math.floor(sites[i + 4] * variants) === v) mine.push(i);
    if (!mine.length) continue; const mesh = new THREE.InstancedMesh(clumpGeometry(v * 13 + kind + 7, kind), mat, mine.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    mine.forEach((i, k) => { const s = sites[i + 3]; q.setFromAxisAngle(up, sites[i + 4] * 40); m.compose(new THREE.Vector3(sites[i], sites[i + 1] - 0.02, sites[i + 2]), q, new THREE.Vector3(s, s * (0.85 + 0.3 * sites[i + 4]), s)); mesh.setMatrixAt(k, m); });
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.name = 'meadow blades'; group.add(mesh);
  }
  return group;
}

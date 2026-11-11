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
export function planGrass(ground, { from = 9, to = 420, camera = [0, 0] } = {}) {
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
  for (let i = 0; i < n; i += 1) { const [x, y, z, s, t] = sites.slice(i * 5, i * 5 + 5); q.setFromAxisAngle(up, t * Math.PI); m.compose(new THREE.Vector3(x, y - 0.05 * s, z), q, new THREE.Vector3(s, s * (0.8 + 0.5 * t), s)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.setRGB(0.95 + 0.1 * t, 1.0, 0.85 + 0.2 * t)); }
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.name = `meadow grass (${n} clumps)`; return mesh;
}

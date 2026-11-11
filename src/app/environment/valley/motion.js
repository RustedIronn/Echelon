import * as THREE from 'three';

// The valley's small motions: a few birds wheeling over the meadows and the river (swifts by day, a pair of choughs high by the rock), and
// smoke from the hamlet's chimneys, rising, widening and drifting with the wind. Both cheap: a dozen instanced birds, a few hundred soft sprites.

const softDot = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.5, 'rgba(255,255,255,0.42)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  t = new THREE.CanvasTexture(c); return t; }; })();

export function buildBirds({ count = 14 } = {}) {
  // a bird: two slender wing triangles meeting at the body; the wings beat by scaling the instance on y and folding on x
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.1, -0.9, 0.12, -0.05, 0, 0, -0.15, 0, 0, 0.1, 0.9, 0.12, -0.05, 0, 0, -0.15], 3));
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#1f2226', side: THREE.DoubleSide, fog: false }), count); mesh.frustumCulled = false; mesh.name = 'birds';
  const birds = Array.from({ length: count }, (_, i) => ({ cx: -220 + 440 * Math.sin(i * 7.1) ** 2, cz: -170 - 240 * Math.cos(i * 3.7) ** 2, h: 22 + 50 * ((i * 0.37) % 1), r: 30 + 70 * ((i * 0.61) % 1), w: 0.25 + 0.2 * ((i * 0.53) % 1), ph: i * 1.7, size: 1.3 + 0.5 * ((i * 0.29) % 1) /* choughs and a buzzard: big enough to read at a few hundred metres */ }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const update = (t) => { birds.forEach((b, i) => { const a = b.ph + t * b.w; p.set(b.cx + Math.cos(a) * b.r, b.h + 6 * Math.sin(t * 0.7 + i), b.cz + Math.sin(a) * b.r * 0.6);
    e.set(0.25 * Math.sin(t * 0.9 + i), -a - Math.PI / 2, 0.35); q.setFromEuler(e); const beat = Math.sin(t * (9 + i % 3) + i) ; const glide = Math.sin(t * 0.5 + i) > 0.3 ? 0.15 : 1; s.set(b.size, b.size * (0.4 + 0.9 * glide * beat), b.size); m.compose(p, q, s); mesh.setMatrixAt(i, m); }); mesh.instanceMatrix.needsUpdate = true; };
  update(0); return { mesh, update };
}

export function buildSmoke(chimneys, { strength = 1, windX = 0.6, windZ = -0.25 } = {}) {
  const group = new THREE.Group(); group.name = 'chimney smoke'; const per = 9; const puffs = [];
  chimneys.forEach((c, k) => { for (let i = 0; i < per; i += 1) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: '#aab0b9', transparent: true, depthWrite: false, opacity: 0 })); group.add(sp); puffs.push({ sp, c, i, seed: k * 13.7 + i }); } });
  const update = (t) => { for (const f of puffs) { const life = 14; const age = ((t + f.i * (life / per) + f.seed) % life) / life; // 0..1 over its life
      const rise = age * 30, spread = 1.4 + age * 11; f.sp.position.set(f.c.x + windX * rise * (0.6 + age) + Math.sin(t * 0.3 + f.seed) * age * 2, f.c.y + rise, f.c.z + windZ * rise * (0.6 + age));
      f.sp.scale.setScalar(spread); f.sp.material.opacity = strength * 0.95 * Math.min(1, age * 6) * (1 - age) ** 1.4; } };
  update(0); return { group, update };
}

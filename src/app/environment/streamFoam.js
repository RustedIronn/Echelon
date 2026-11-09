import * as THREE from 'three';

// Foam at stones: every stone that breaks the water surface gets a waterline circle (centre and radius where the surface cuts it), found once at
// load from the real meshes. The water shader (alpineParityMaterials.js) draws a foam collar hugging each one, a pillow on its upstream face
// and a wake trailing downstream along the local current, broken up by noise carried on the flow. ?foam=off compares.
export const MAX_FOAM_STONES = 16;
export const FOAM_WANTED = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('foam') !== 'off';

// stones: meshes; water: the water mesh (world matrices up to date). Returns [{x, z, r, level}] for stones the surface passes through.
export function findStoneWaterlines(stones, water) {
  const ray = new THREE.Raycaster(); const down = new THREE.Vector3(0, -1, 0); const v = new THREE.Vector3(); const out = [];
  const side = water.material.side; water.material.side = THREE.DoubleSide; // the ray must hit the surface whichever way it faces
  try {
    for (const stone of stones) {
      stone.updateWorldMatrix(true, false); const box = new THREE.Box3().setFromObject(stone); const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      ray.set(new THREE.Vector3(cx, box.max.y + 5, cz), down); const hit = ray.intersectObject(water, false)[0]; if (!hit) continue;
      const level = hit.point.y; if (level <= box.min.y + 0.01 || level >= box.max.y - 0.01) continue; // sits wholly above or below the surface
      // the waterline: stone vertices close to the surface level (the band widens until enough are found)
      const p = stone.geometry.attributes.position; let pts = [];
      for (let band = 0.02; band < 0.2 && pts.length < 8; band *= 1.6) {
        pts = []; for (let i = 0; i < p.count; i += 1) { v.fromBufferAttribute(p, i).applyMatrix4(stone.matrixWorld); if (Math.abs(v.y - level) < band) pts.push([v.x, v.z]); }
      }
      if (pts.length < 3) continue;
      const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, mz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      const r = pts.reduce((s, q) => s + Math.hypot(q[0] - mx, q[1] - mz), 0) / pts.length;
      out.push({ name: stone.name, x: mx, z: mz, r, level });
    }
  } finally { water.material.side = side; }
  return out.sort((a, b) => b.r - a.r).slice(0, MAX_FOAM_STONES);
}

// Riffle stones: the delivered stones all sit on the bank shelves, just clear of the visible water, so nothing broke the current. A few small
// clusters are set into the channel where it runs deep and steady (sites chosen from a survey of the water mesh: depth over 0.4 m, centre of the
// channel), made from the delivered limestone so they match, each turned, tilted and sized differently and standing a little proud of the surface.
// [x, z, waterline radius (m), height above the water as a fraction of the radius]
const RIFFLE_SITES = [
  [3.1, -8.7, 0.2, 0.5], [3.95, -9.5, 0.12, 0.35], // where the pool drains toward the bend
  [-8.0, -20.4, 0.28, 0.45], [-8.85, -21.1, 0.16, 0.4], [-7.25, -21.0, 0.11, 0.3], [-9.9, -22.3, 0.19, 0.5], // the reach behind the spruce
  [-12.7, -47.6, 0.24, 0.45], [-12.15, -48.7, 0.14, 0.35], // the S-bend
  [1.25, -68.4, 0.22, 0.5], [2.05, -69.1, 0.15, 0.4], // the far run, below the older stones
];
const RIFFLE_WANTED = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('riffles') !== 'off';
export function placeRiffleStones(group, water, template, beds) {
  if (!RIFFLE_WANTED || !template || !water) return [];
  const ray = new THREE.Raycaster(); const down = new THREE.Vector3(0, -1, 0); const placed = [];
  const side = water.material.side; water.material.side = THREE.DoubleSide;
  template.geometry.computeBoundingBox(); const tb = template.geometry.boundingBox; const half = Math.max(tb.max.x - tb.min.x, tb.max.z - tb.min.z) / 2;
  const rand = (n) => { const s = Math.sin(n * 91.7 + 13.1) * 43758.5453; return s - Math.floor(s); };
  try {
    RIFFLE_SITES.forEach(([x, z, r, proud], i) => {
      ray.set(new THREE.Vector3(x, 50, z), down); const hit = ray.intersectObject(water, false)[0]; if (!hit) return;
      const bed = ray.intersectObjects(beds, false).find((h) => h.object !== water); if (!bed || hit.point.y - bed.point.y < 0.12) return; // too shallow to read as mid-stream
      const stone = template.clone(); stone.name = `Riffle stone ${i + 1}`; stone.userData = { ...template.userData, echelonRole: 'stone' };
      const k = r * 1.35 / half; stone.scale.set(k * (0.9 + 0.3 * rand(i)), k * (0.75 + 0.35 * rand(i + 9)), k * (0.85 + 0.3 * rand(i + 17)));
      stone.rotation.set((rand(i + 3) - 0.5) * 0.35, rand(i + 5) * Math.PI * 2, (rand(i + 7) - 0.5) * 0.35);
      stone.position.set(x, 0, z); group.add(stone); stone.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(stone); stone.position.y += hit.point.y + r * proud - box.max.y; // stands proud of the water by a fraction of its size
      stone.position.x += x - (box.min.x + box.max.x) / 2; stone.position.z += z - (box.min.z + box.max.z) / 2; stone.updateWorldMatrix(true, false);
      placed.push(stone);
    });
  } finally { water.material.side = side; }
  return placed;
}

// The GLSL: stoneFoam() returns (contact foam hugging the stones, wake foam trailing downstream) at world point p for the local flow (m/s);
// foamStreaks() is breakup noise stretched along the current and carried with it (two copies half a cycle apart, cross-faded). It uses the
// material's ripple texture and uWaterTime.
export const FOAM_GLSL = `
uniform vec4 uStones[${MAX_FOAM_STONES}]; uniform float uStoneCount;
vec2 stoneFoam(vec2 p, vec2 flow) {
  float speed = length(flow); vec2 dir = speed > 1e-3 ? flow / speed : vec2(1.0, 0.0); vec2 side = vec2(-dir.y, dir.x);
  float energy = 0.35 + 0.65 * smoothstep(0.03, 0.4, speed); /* a still pool keeps only a thin ring; a fast run a full collar and a long wake */
  float contact = 0.0, wake = 0.0;
  for (int i = 0; i < ${MAX_FOAM_STONES}; i++) {
    if (float(i) >= uStoneCount) break;
    vec4 s = uStones[i]; vec2 d = p - s.xy; float r = s.z; float dist = length(d) - r;
    if (dist > r * 8.0 + 3.0) continue;
    float along = dot(d, dir) / r, across = dot(d, side) / r; /* in stone radii: + downstream */
    float ring = exp(-max(dist, 0.0) / (0.02 + 0.04 * speed + 0.05 * r));
    float pillow = smoothstep(0.3, -0.9, along) * exp(-max(dist, 0.0) / (0.05 + 0.1 * speed + 0.12 * r)); /* water piles against the upstream face */
    contact = max(contact, max(ring * 0.8, pillow) * mix(0.7, 1.0, energy));
    float spread = 0.6 + 0.5 * clamp(along / 5.0, 0.0, 1.0); /* the wake widens a little as it trails off */
    float tail = smoothstep(-0.3, 0.8, along) * exp(-pow(abs(across) / spread, 2.0)) * exp(-max(along, 0.0) / (2.0 + 7.0 * speed));
    float edges = exp(-pow((abs(across) - 0.85) / 0.35, 2.0)) * smoothstep(-0.5, 0.5, along) * exp(-max(along, 0.0) / (1.5 + 5.0 * speed)); /* brighter lines off each shoulder */
    wake = max(wake, max(tail * 0.65, edges) * energy);
  }
  return vec2(contact, wake);
}
float foamHash(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
float foamNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(foamHash(i), foamHash(i + vec2(1.0, 0.0)), f.x), mix(foamHash(i + vec2(0.0, 1.0)), foamHash(i + vec2(1.0, 1.0)), f.x), f.y); }
// value noise in flow-aligned coordinates (stretched along the current) carried downstream; two copies half a cycle apart, cross-faded
float foamStreaks(vec2 p, vec2 flow, float stretch, float cycle) {
  float speed = length(flow); vec2 dir = speed > 1e-3 ? flow / speed : vec2(1.0, 0.0); vec2 q = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
  float t = uWaterTime / cycle; float a = fract(t), b = fract(t + 0.5); float wa = 1.0 - abs(2.0 * a - 1.0); float adv = max(speed, 0.08) * cycle;
  vec2 ua = vec2((q.x - adv * a) * 2.2, q.y * stretch), ub = vec2((q.x - adv * b) * 2.2 + 17.3, q.y * stretch + 5.1);
  float na = foamNoise(ua) * 0.65 + foamNoise(ua * 2.3) * 0.35, nb = foamNoise(ub) * 0.65 + foamNoise(ub * 2.3) * 0.35;
  return clamp((mix(nb, na, wa) - 0.5) * 2.4 + 0.5, 0.0, 1.0);
}`;

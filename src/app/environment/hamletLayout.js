// Hamlet v2 layout (Three coordinates, metres; +z toward the camera, -z away). Pure data and 2D helpers, no rendering.
// The site is the same hillside shelf as before (x 22..62, z -152..-118) but the buildings are scaled down (about 0.7 of the old size)
// so the settlement reads as farther away, which leaves room for yards, boundaries and lanes that converge on the chapel.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Palette: warm whitewash, honey and ochre plaster, red timber, slate and terracotta roofs. Shutters add small notes of colour.
export const HAMLET_PALETTE = {
  whitewash: '#e6dfcf', cream: '#d9ccae', ochre: '#c6a56a', honeyTimber: '#9a7a52', redTimber: '#6d5846', stone: '#8d887c',
  slate: '#4f5a63', terracotta: '#a9654a', shingle: '#6d5a48', shutterGreen: '#51684a', shutterBlue: '#4f6d86', shutterRed: '#8c3f35', door: '#6b4a32',
};

// Buildings. (x, z) is the centre of the footprint at ground level, yaw turns the front (+z in local space) around +y, w is the width
// across the front, d the depth, eave the wall height, ridge the ridge height above the floor. `facing` yaws are chosen so gables and
// fronts turn gently toward the camera, which sits down-left of the site.
export const HAMLET_BUILDINGS = [
  { id: 'chapel', kind: 'chapel', siding: 'clapboard', x: 38.0, z: -142.0, yaw: -0.1, w: 4.8, d: 8.4, eave: 3.0, ridge: 5.0, tower: { w: 2.1, height: 6.6, spire: 3.6 }, wall: 'whitewash', roof: 'slate', shutter: 'shutterGreen', yard: { w: 13, d: 18, ox: 1.5, oz: -1.5 }, boundary: 'stone' },
  { id: 'cottage-a', kind: 'house', x: 22.0, z: -122.0, yaw: Math.PI / 2, w: 6.8, d: 3.6, eave: 2.3, ridge: 3.7, wall: 'whitewash', siding: 'clapboard', porch: true, dormers: true, roof: 'slate', shutter: 'shutterGreen', chimney: 'right', yard: { w: 11, d: 12, oz: 0 }, boundary: 'stone' },
  { id: 'cottage-b', kind: 'house', x: 44.0, z: -124.0, yaw: -Math.PI / 2, w: 4.2, d: 4.8, eave: 3.5, ridge: 5.9, roofForm: 'crossGable', wall: 'cream', roof: 'slate', shutter: 'shutterGreen', timberUpper: true, chimney: 'left', yard: { w: 12, d: 12, oz: 0 }, boundary: 'fence' },
  { id: 'farm-c', kind: 'farm', x: 52.0, z: -132.0, yaw: -Math.PI / 2, w: 7.2, d: 5.2, eave: 4.0, ridge: 5.5, roofForm: 'chalet', balcony: true, wing: { w: 3.2, d: 3.6, side: 'left' }, stoneBase: true, wall: 'ochre', roof: 'slate', shutter: 'shutterGreen', chimney: 'right', yard: { w: 16, d: 20, ox: -5, oz: -4 }, boundary: 'stone' },
  { id: 'cottage-d', kind: 'house', x: 21.0, z: -142.0, yaw: Math.PI / 2, w: 4.4, d: 4.4, eave: 2.7, ridge: 4.5, roofForm: 'hip', wall: 'ochre', stoneBase: true, wing: { w: 2.6, d: 3.0, side: 'right' }, roof: 'slate', shutter: 'shutterGreen', chimney: 'left', yard: { w: 12, d: 12, oz: 0 }, boundary: 'hedge' },
  { id: 'barn-e', kind: 'barn', x: 60.0, z: -142.0, yaw: -0.8, w: 7.2, d: 4.8, eave: 3.0, ridge: 5.3, wall: 'redTimber', roof: 'slate', shutter: 'door' },
  { id: 'shed-f', kind: 'shed', x: 17.0, z: -151.0, yaw: Math.PI / 2, w: 3.2, d: 2.6, eave: 1.9, ridge: 2.7, wall: 'honeyTimber', roof: 'shingle', shutter: 'door' },
];

// Door position (world x, z) a little way out in front of each building's door; the chapel door is at the foot of its tower.
function doorOut(b, out = 0.9) {
  let x = 0, z = b.d / 2 + out;
  if (b.kind === 'chapel') z = b.d / 2 + b.tower.w - 0.2 + out;
  else if (b.kind !== 'barn' && b.kind !== 'shed') { const n = Math.max(2, Math.floor(b.w / 2.1)); x = -b.w / 2 + ((Math.floor(n / 2) + 0.5) * b.w) / n; }
  const c = Math.cos(b.yaw), sn = Math.sin(b.yaw); return [b.x + x * c + z * sn, b.z - x * sn + z * c];
}
export const HAMLET_DOORS = Object.fromEntries(HAMLET_BUILDINGS.map((b) => [b.id, doorOut(b)]));

// Small forecourt at the chapel door; the lanes meet the spine, not a plaza.
export const HAMLET_APRON = { x: 37.2, z: -133.8, radius: 1.6 };

// One spine runs from the camera past the churchyard and on toward the pass; every door lane merges into it at an acute angle.
const door = (id) => HAMLET_DOORS[id];
export const HAMLET_LANES = [
  // few control points, so the Catmull-Rom curves stay long and smooth: the trunk runs toward the camera in one gentle S, side lanes are single arcs
  { id: 'main', width: 3.3, points: [[14.5, -55], [20.5, -77], [24.4, -100], [31, -117], [33.8, -129], [27, -146], [23, -158]] },
  { id: 'door-chapel', width: 1.6, points: [door('chapel'), [35.4, -133.2], [33.5, -130.4]] },
  { id: 'door-cottage-a', width: 1.4, points: [door('cottage-a'), [29.8, -122.6], [32.7, -121.4]] },
  { id: 'door-cottage-b', width: 1.4, points: [door('cottage-b'), [38.6, -125.2], [33.8, -126.8]] },
  { id: 'door-farm-c', width: 1.6, points: [door('farm-c'), [43.5, -136.8], [33.2, -132.4]] },
  { id: 'door-barn-e', width: 1.4, points: [door('barn-e'), [51.5, -136.4], [43.6, -136.6]] },
  { id: 'door-cottage-d', width: 1.4, points: [door('cottage-d'), [25.8, -141.2], [28.8, -141.9]] },
  { id: 'door-shed-f', width: 1.1, points: [door('shed-f'), [22.4, -147.4], [25.6, -141.5]] },
];

// Trees are removed for now; add new ones here when the settlement is dressed again.
// A small windbreak on the north side of the chapel, where the hill shelters it; nothing else is scattered.
// No trees for now; placement will be decided separately.
export const HAMLET_TREES = [];

export function rotate2(x, z, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); return [x * c + z * s, -x * s + z * c]; }

// Catmull-Rom sampling of a polyline into points about `step` metres apart (endpoints are kept).
export function sampleCurve(points, step = 0.8) {
  if (points.length < 3) { const [a, b] = points; const length = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(length / step)); return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]); }
  const out = []; const P = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let seg = 0; seg < points.length - 1; seg += 1) {
    const [p0, p1, p2, p3] = [P(seg - 1), P(seg), P(seg + 1), P(seg + 2)]; const length = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const n = Math.max(2, Math.ceil(length / step));
    for (let i = 0; i < n; i += 1) { const t = i / n; const t2 = t * t, t3 = t2 * t; out.push([0, 1].map((k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))); }
  }
  out.push([...points[points.length - 1]]); return out;
}

export function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1]; const len2 = dx * dx + dz * dz; const t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

// Footprint of a building (and its wing) as a rotated polygon in world space, expanded by `margin` metres.
export function footprint(building, margin = 0) {
  const parts = [{ w: building.w, d: building.d, ox: 0, oz: 0 }];
  if (building.kind === 'chapel') parts.push({ w: building.tower.w, d: building.tower.w, ox: 0, oz: building.d / 2 + building.tower.w / 2 - 0.2 });
  if (building.wing) parts.push({ w: building.wing.w, d: building.wing.d, ox: (building.wing.side === 'left' ? -1 : 1) * (building.w / 2 + building.wing.w / 2 - 0.2), oz: -building.d / 2 + building.wing.d / 2 });
  return parts.map((p) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => { const [rx, rz] = rotate2(p.ox + (sx * (p.w / 2 + margin)), p.oz + (sz * (p.d / 2 + margin)), building.yaw); return [building.x + rx, building.z + rz]; }));
}

// The mown, tended ground: building footprints with a margin, lanes, the apron and every yard. Grass roots inside are skipped.
export function yardPolygon(building) {
  if (!building.yard) return null; const { w, d, ox = 0 } = building.yard; const oz = building.yard.oz ?? (d / 2 - building.d / 2 + 0.5);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => { const [rx, rz] = rotate2(ox + sx * (w / 2), oz + sz * (d / 2), building.yaw); return [building.x + rx, building.z + rz]; });
}

export function createHamletClearing() {
  const footprints = HAMLET_BUILDINGS.flatMap((b) => footprint(b, 1.5)); const yards = HAMLET_BUILDINGS.map(yardPolygon).filter(Boolean);
  const lanes = HAMLET_LANES.map((lane) => ({ half: lane.width / 2 + 0.7, samples: sampleCurve(lane.points, 1.5) }));
  const all = [...footprints, ...yards, ...HAMLET_LANES.map((l) => l.points)].flat(); const bounds = { minX: Math.min(...all.map((p) => p[0])) - 6, maxX: Math.max(...all.map((p) => p[0])) + 14, minZ: Math.min(...all.map((p) => p[1])) - 24, maxZ: Math.max(...all.map((p) => p[1])) + 30 };
  const api = {
    bounds,
    contains(x, z) {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false;
      if (Math.hypot(x - HAMLET_APRON.x, z - HAMLET_APRON.z) < HAMLET_APRON.radius + 0.8) return true;
      for (const polygon of footprints) if (pointInPolygon(x, z, polygon)) return true;
      for (const polygon of yards) if (pointInPolygon(x, z, polygon)) return true;
      for (const lane of lanes) for (let i = 0; i < lane.samples.length - 1; i += 1) if (distanceToSegment(x, z, lane.samples[i], lane.samples[i + 1]) < lane.half) return true;
      return false;
    },
  };
  // 0 inside the tended ground, rising to 1 about 5 m outside it: grass is cut short near yards and lanes and grows back into the meadow.
  const ring = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
  // softness is asked for every blade, flower and terrain vertex (hundreds of thousands of times at load), so the tended ground is rasterised once (25 cm cells,
  // stamped from the footprints, yards and lane segments) and softness looks the ring probes up in that raster instead of re-testing every polygon and lane.
  const CELL = 0.25, PAD = 4.5; let grid = null, gw = 0, gh = 0, gx0 = 0, gz0 = 0;
  const build = () => {
    gx0 = bounds.minX - PAD; gz0 = bounds.minZ - PAD; gw = Math.ceil((bounds.maxX - bounds.minX + 2 * PAD) / CELL); gh = Math.ceil((bounds.maxZ - bounds.minZ + 2 * PAD) / CELL); grid = new Uint8Array(gw * gh);
    const cx = (i) => gx0 + (i + 0.5) * CELL, cz = (j) => gz0 + (j + 0.5) * CELL;
    const box = (minX, maxX, minZ, maxZ, fn) => { for (let j = Math.max(0, Math.floor((minZ - gz0) / CELL)); j <= Math.min(gh - 1, Math.floor((maxZ - gz0) / CELL)); j += 1) for (let i = Math.max(0, Math.floor((minX - gx0) / CELL)); i <= Math.min(gw - 1, Math.floor((maxX - gx0) / CELL)); i += 1) if (!grid[j * gw + i] && fn(cx(i), cz(j))) grid[j * gw + i] = 1; };
    for (const polygon of [...footprints, ...yards]) box(Math.min(...polygon.map((p) => p[0])), Math.max(...polygon.map((p) => p[0])), Math.min(...polygon.map((p) => p[1])), Math.max(...polygon.map((p) => p[1])), (x, z) => pointInPolygon(x, z, polygon));
    for (const lane of lanes) for (let i = 0; i < lane.samples.length - 1; i += 1) { const a = lane.samples[i], b = lane.samples[i + 1]; box(Math.min(a[0], b[0]) - lane.half, Math.max(a[0], b[0]) + lane.half, Math.min(a[1], b[1]) - lane.half, Math.max(a[1], b[1]) + lane.half, (x, z) => distanceToSegment(x, z, a, b) < lane.half); }
    box(HAMLET_APRON.x - HAMLET_APRON.radius - 1, HAMLET_APRON.x + HAMLET_APRON.radius + 1, HAMLET_APRON.z - HAMLET_APRON.radius - 1, HAMLET_APRON.z + HAMLET_APRON.radius + 1, (x, z) => Math.hypot(x - HAMLET_APRON.x, z - HAMLET_APRON.z) < HAMLET_APRON.radius + 0.8);
  };
  const tended = (x, z) => { const i = Math.floor((x - gx0) / CELL), j = Math.floor((z - gz0) / CELL); return i >= 0 && j >= 0 && i < gw && j < gh && grid[j * gw + i] === 1; };
  api.softness = (x, z) => {
    if (x < bounds.minX - 4.3 || x > bounds.maxX + 4.3 || z < bounds.minZ - 4.3 || z > bounds.maxZ + 4.3) return 1;
    if (!grid) build();
    if (tended(x, z)) return 0;
    for (const [r, k] of [[1.2, 0.35], [2.6, 0.55], [4.2, 0.78]]) for (const [dx, dz] of ring) if (tended(x + dx * r, z + dz * r)) return k;
    return 1;
  };
  return api;
}

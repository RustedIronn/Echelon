// Hamlet layout in metres, Three Y-up. The chapel, cottages and farm share a
// bent lane and green; the terrain protection region remains independent.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Palette: warm whitewash, honey and ochre plaster, red timber, slate and terracotta roofs. Shutters add small notes of colour.
export const HAMLET_PALETTE = {
  whitewash:'#e6deca', cream:'#d9ccb1', ochre:'#cdbb98', honeyTimber:'#a08a6c', redTimber:'#87705b', stone:'#beb49e',
  slate:'#626b70', terracotta:'#9b7660', shingle:'#77796e', shutterGreen:'#626d54', shutterBlue:'#697b80', shutterRed:'#8f6557', door:'#86745a',
};

// One architectural family, staggered around a lane and a small shared green.
export const HAMLET_BUILDINGS = [
 {id:'chapel',kind:'chapel',x:39,z:-124,yaw:-.12,w:5,d:9,eave:3.3,ridge:5.7,tower:{w:2.6,height:7.6,spire:1.65},wall:'whitewash',roof:'slate',shutter:'shutterGreen',yard:{w:12,d:17,ox:0,oz:0},boundary:'stone',boundaryEdges:[0,3]},
 {id:'cottage-a',kind:'house',x:20,z:-131,yaw:-.12,w:6.8,d:5.5,eave:2.8,ridge:5,wall:'cream',roof:'slate',shutter:'shutterGreen',chimney:'right',porch:true,yard:{w:9,d:6,oz:5},boundary:'stone',boundaryEdges:[2,3]},
 {id:'cottage-b',kind:'house',x:29,z:-148,yaw:.22,w:5.4,d:5.8,eave:4.4,ridge:6.3,wall:'stone',roof:'slate',shutter:'shutterGreen',chimney:'left',yard:{w:7,d:5,oz:4.5}},
 {id:'farm-c',kind:'farm',x:55,z:-139,yaw:-.48,w:7.8,d:5.6,eave:3.9,ridge:6.1,wall:'ochre',roof:'slate',shutter:'shutterGreen',chimney:'right',porch:true,wing:{w:3,d:3.6,side:'right'},yard:{w:13,d:11,ox:3,oz:-5},boundary:'fence',boundaryEdges:[0,1]},
 {id:'barn-e',kind:'barn',x:64,z:-155,yaw:-.65,w:8.4,d:5.2,eave:2.7,ridge:4.8,wall:'redTimber',roof:'slate',shutter:'door'},
 {id:'shed-f',kind:'shed',x:17,z:-151,yaw:.35,w:4,d:3,eave:1.9,ridge:2.8,wall:'honeyTimber',roof:'shingle',shutter:'door'},
];

// Door position (world x, z) a little way out in front of each building's door; the chapel door is at the foot of its tower.
function doorOut(b, out = 0.9) {
  let x = 0, z = b.d / 2 + out;
  if (b.kind === 'chapel') z = b.d / 2 + b.tower.w - 0.2 + out;
  else if (b.kind !== 'barn' && b.kind !== 'shed') { const n = Math.max(2, Math.floor(b.w / 2.1)); x = -b.w / 2 + ((Math.floor(n / 2) + 0.5) * b.w) / n; }
  const c = Math.cos(b.yaw), sn = Math.sin(b.yaw); return [b.x + x * c + z * sn, b.z - x * sn + z * c];
}
export const HAMLET_DOORS = Object.fromEntries(HAMLET_BUILDINGS.map((b) => [b.id, doorOut(b)]));

export const HAMLET_APRON={x:39.8,z:-114.6,radius:1.3};
// A grassy shared common, not a paved plaza; no change to the protected landform.
export const HAMLET_COMMON={x:38,z:-116,rx:6.2,rz:3.5};
export function tendedGrowth(x,z){
  let growth=0;
  for(const b of HAMLET_BUILDINGS){
    if(!b.yard)continue;
    const {w,d,ox=0}=b.yard,oz=b.yard.oz??(d/2-b.d/2+.5);
    const [lx,lz]=rotate2(x-b.x,z-b.z,-b.yaw);
    const edge=.13*Math.sin(x*.63+z*.37)+.09*Math.sin(z*.91-x*.4);
    const r=Math.pow(Math.pow(Math.abs((lx-ox)/(w*.5)),4)+Math.pow(Math.abs((lz-oz)/(d*.5)),4),.25);
    const t=Math.max(0,Math.min(1,(1.24+edge-r)/.48));growth=Math.max(growth,t*t*(3-2*t));
  }
  const c=HAMLET_COMMON,r=Math.hypot((x-c.x)/c.rx,(z-c.z)/c.rz);
  const t=Math.max(0,Math.min(1,(1.3-r)/.55));return Math.max(growth,t*t*(3-2*t));
}
// Deliberately retain the approved valley's protection region. Vegetation and
// paths have their own compact bounds; redesigning those must not move relief.
export const HAMLET_TERRAIN_BOUNDS=Object.freeze({minX:8.2,maxX:80.35089297217868,minZ:-182,maxZ:-25});
export const HAMLET_LANE_POINTS=[[79,-91],[71,-104],[57,-112],[43,-114],[29,-120],[19,-122],[12,-129],[8,-143],[14,-163]];
const mainSamples=sampleCurve(HAMLET_LANE_POINTS,.45);
function joinMain(point){let best=Infinity,result=null;for(let i=0;i<mainSamples.length-1;i++){const a=mainSamples[i],b=mainSamples[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/(dx*dx+dz*dz)));const p=[a[0]+dx*t,a[1]+dz*t],d=Math.hypot(p[0]-point[0],p[1]-point[1]);if(d<best){best=d;result=p;}}return result;}
const door=id=>HAMLET_DOORS[id],cottageJunction=[35.5,-120.8];
export const HAMLET_LANES=[
 {id:'main',width:2.45,points:HAMLET_LANE_POINTS,fadeEnd:8},
 {id:'door-chapel',width:1.25,points:[door('chapel'),joinMain(door('chapel'))]},
 {id:'door-cottage-a',width:.95,points:[door('cottage-a'),[28,-120],cottageJunction,joinMain(cottageJunction)]},
 {id:'door-cottage-b',width:.8,points:[door('cottage-b'),[35.5,-139],joinMain([35.5,-139])]},
 {id:'door-farm-c',width:1.1,points:[door('farm-c'),joinMain(door('farm-c'))]},
 {id:'door-barn-e',width:1.5,points:[door('barn-e'),[65,-145],[65,-127],joinMain([65,-127])]},
 {id:'door-shed-f',width:.7,points:[door('shed-f'),[17,-147],[12,-146],joinMain([12,-146])]},
];
// Existing foreground tree is preserved; this pass adds no woodland system.
export const HAMLET_TREES=[];
// One small domestic line off the lane, sheltered beside the cottage.
export const HAMLET_LINEN_LINE={a:[13.8,-131.7],b:[15.1,-127.9],height:1.85};

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

// Footprints and lanes are bare; yards retain short grass and soft meadow edges.
export function yardPolygon(building) {
  if (!building.yard) return null; const { w, d, ox = 0 } = building.yard; const oz = building.yard.oz ?? (d / 2 - building.d / 2 + 0.5);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => { const [rx, rz] = rotate2(ox + sx * (w / 2), oz + sz * (d / 2), building.yaw); return [building.x + rx, building.z + rz]; });
}

export function createHamletClearing() {
  const footprints = HAMLET_BUILDINGS.flatMap((b) => footprint(b, .45)); const yards = HAMLET_BUILDINGS.map(yardPolygon).filter(Boolean);
  const lanes = HAMLET_LANES.map((lane) => ({ half: lane.width / 2 + .25, samples: sampleCurve(lane.points, 1.5) }));
  const all = [...footprints, ...yards, ...HAMLET_LANES.map((l) => l.points)].flat(); const bounds = { minX: Math.min(...all.map((p) => p[0])) - 6, maxX: Math.max(...all.map((p) => p[0])) + 14, minZ: Math.min(...all.map((p) => p[1])) - 24, maxZ: Math.max(...all.map((p) => p[1])) + 30 };
  const api = {
    bounds, terrainBounds:HAMLET_TERRAIN_BOUNDS,
    contains(x, z) {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false;
      if (Math.hypot(x - HAMLET_APRON.x, z - HAMLET_APRON.z) < HAMLET_APRON.radius + 0.8) return true;
      for (const polygon of footprints) if (pointInPolygon(x, z, polygon)) return true;

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
    for (const polygon of footprints) box(Math.min(...polygon.map((p) => p[0])), Math.max(...polygon.map((p) => p[0])), Math.min(...polygon.map((p) => p[1])), Math.max(...polygon.map((p) => p[1])), (x, z) => pointInPolygon(x, z, polygon));
    for (const lane of lanes) for (let i = 0; i < lane.samples.length - 1; i += 1) { const a = lane.samples[i], b = lane.samples[i + 1]; box(Math.min(a[0], b[0]) - lane.half, Math.max(a[0], b[0]) + lane.half, Math.min(a[1], b[1]) - lane.half, Math.max(a[1], b[1]) + lane.half, (x, z) => distanceToSegment(x, z, a, b) < lane.half); }
    box(HAMLET_APRON.x - HAMLET_APRON.radius - 1, HAMLET_APRON.x + HAMLET_APRON.radius + 1, HAMLET_APRON.z - HAMLET_APRON.radius - 1, HAMLET_APRON.z + HAMLET_APRON.radius + 1, (x, z) => Math.hypot(x - HAMLET_APRON.x, z - HAMLET_APRON.z) < HAMLET_APRON.radius + 0.8);
  };
  const tended = (x, z) => { const i = Math.floor((x - gx0) / CELL), j = Math.floor((z - gz0) / CELL); return i >= 0 && j >= 0 && i < gw && j < gh && grid[j * gw + i] === 1; };
  api.softness = (x, z) => {
    if (x < bounds.minX - 4.3 || x > bounds.maxX + 4.3 || z < bounds.minZ - 4.3 || z > bounds.maxZ + 4.3) return 1;
    if (!grid) build();
    if (tended(x, z)) return 0;
    const growth=tendedGrowth(x,z);
    if(growth>.001)return 1-.62*growth;
    for (const [r, k] of [[1.2, 0.35], [2.6, 0.55], [4.2, 0.78]]) for (const [dx, dz] of ring) if (tended(x + dx * r, z + dz * r)) return k;
    return 1;
  };
  return api;
}

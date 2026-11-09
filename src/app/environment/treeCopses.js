import * as THREE from 'three';
import { applyBlenderDisplay, applyFoliageStyle, BACKLIT_CONIFER_STYLE as COPSE_STYLE, CONIFER_DARKEN } from './alpineParityMaterials.js';
import { HAMLET_BUILDINGS } from './hamletLayout.js';

// Trees where trees really stand in an upland valley (the delivered Norway spruce and the audition larch, both by Georgeous, CC BY 4.0 - see
// design-reference/environment/asset-auditions/mature-conifers/ATTRIBUTION.md). The valley floor is hay meadow, cleared and mown for centuries, so
// it stays open; the forest starts where the ground starts to climb:
//  1. (off; ?copses=belt) a montane spruce belt at the foot of the mountains: a ragged lower edge where the mown ground ends, tongues up the hollows,
//     pasture clearings cut into it. The mountains are built smaller than they read, and from the hero camera their foot hides behind the valley's
//     own rise, so real trees there are either giant spikes or invisible: a forest on the mountains belongs in the mountain material instead;
//  2. a small group or two of pasture spruce in the meadow, broad and branched to the ground, as on the wooded pastures of the Jura: grazed and mown round,
//     left for the shade and shelter of the stock (the summer larch read pale and leafless here, so they are kept for the windbreak's edge);
//  3. a shelter wood on the hamlet's windward (south-west) side, behind it from the camera, 26 m and more from the buildings and not ringing them.
// Nothing stands in the sunrise over the low hills left of the mountains (azimuth 236-252).
// ?copses=on to see them.
const COPSES_QUERY = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('copses') : null;
export const COPSES_WANTED = COPSES_QUERY === 'on' || COPSES_QUERY === 'belt';
const BELT_WANTED = COPSES_QUERY === 'belt';
const CAMERA = [-3, 4.36, 10];
const DEG = Math.PI / 180;
const hash = (a, b, s) => { const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// smooth value noise in metres (cell = wavelength), for clearings and the ragged forest edge
function noise(x, z, cell, seed) {
  const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz; const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const h = (i, j) => hash(i, j, seed); return (h(ix, iz) * (1 - sx) + h(ix + 1, iz) * sx) * (1 - sz) + (h(ix, iz + 1) * (1 - sx) + h(ix + 1, iz + 1) * sx) * sz;
}

// The rendered terrain as a height grid: every triangle of the terrain meshes rasterised onto cells (top surface kept), so the far foothills
// (beyond the baked far-heights raster) can be sampled without raycasting a large mesh.
export function rasterTerrain(meshes, { minX, maxX, minZ, maxZ, cell = 4 }) {
  const w = Math.ceil((maxX - minX) / cell) + 1, h = Math.ceil((maxZ - minZ) / cell) + 1; const data = new Float32Array(w * h).fill(NaN);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false); const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index; const n = idx ? idx.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      const x0 = Math.max(0, Math.ceil((Math.min(a.x, b.x, c.x) - minX) / cell)), x1 = Math.min(w - 1, Math.floor((Math.max(a.x, b.x, c.x) - minX) / cell));
      const z0 = Math.max(0, Math.ceil((Math.min(a.z, b.z, c.z) - minZ) / cell)), z1 = Math.min(h - 1, Math.floor((Math.max(a.z, b.z, c.z) - minZ) / cell)); if (x0 > x1 || z0 > z1) continue;
      const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(det) < 1e-9) continue;
      for (let iz = z0; iz <= z1; iz += 1) for (let ix = x0; ix <= x1; ix += 1) {
        const px = minX + ix * cell, pz = minZ + iz * cell; const l1 = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / det, l2 = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / det, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue; const y = l1 * a.y + l2 * b.y + l3 * c.y; const k = iz * w + ix; if (!(data[k] >= y)) data[k] = y;
      }
    }
  }
  const at = (x, z) => { const fx = (x - minX) / cell, fz = (z - minZ) / cell, ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix >= w - 1 || iz >= h - 1) return NaN;
    const tx = fx - ix, tz = fz - iz, k = iz * w + ix; return (data[k] * (1 - tx) + data[k + 1] * tx) * (1 - tz) + (data[k + w] * (1 - tx) + data[k + w + 1] * tx) * tz; };
  return { at };
}

// sites: { x, y, z, kind: 'spruce' | 'larch', height (m), broad (crown width factor), yaw, near }
// ground.at(x, z): the terrain height (NaN off the terrain); habitat: the meadow habitat (water distance); clearing: the hamlet clearing
export function planCopses({ ground, habitat, clearing = null }) {
  const sites = []; const at = ground.at;
  const spaced = (x, z, gap) => sites.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 > gap * gap);
  const slopeAt = (x, z) => { const e = 5, dx = at(x + e, z) - at(x - e, z), dz = at(x, z + e) - at(x, z - e); return Math.hypot(dx, dz) / (2 * e); };
  const hollowAt = (x, z) => { const e = 18; return (at(x + e, z) + at(x - e, z) + at(x, z + e) + at(x, z - e)) / 4 - at(x, z); }; // > 0 in a hollow or gully
  // the camera sees the tree's crown: march the sight line over the terrain grid
  const seen = (x, y, z, height) => { const top = y + height * 0.75, d = Math.hypot(x - CAMERA[0], z - CAMERA[2]);
    for (let s = 30; s < d - 12; s += 8) { const t = s / d; const g = at(CAMERA[0] + (x - CAMERA[0]) * t, CAMERA[2] + (z - CAMERA[2]) * t); if (g > CAMERA[1] + (top - CAMERA[1]) * t + 0.5) return false; } return true; };
  // 1. the montane belt: candidates on a jittered polar grid over the foothills, kept by a probability built from the ground's shape.
  // The mountains are built smaller than they read (a 90 m rise reads as a range), so a forest of real-size trees up their faces turns to giant
  // spikes: the wood keeps to the foot of the slopes, where the scale still holds, and its trees shrink as the ground climbs (forced perspective).
  // From the hero camera that foot is almost hidden behind the valley's own rise, so the belt is off (?copses=belt shows it): a forest on the
  // mountains belongs in the mountain material, as texture, not as tree models.
  if (BELT_WANTED) for (let az = 234; az <= 306; az += 0.3) {
    let floor = Infinity; // the valley floor on this bearing: the lowest ground met on the way out
    for (let d = 380; d <= 1000; d += 6) {
      const ja = az + (hash(az, d, 1) - 0.5) * 0.28, jd = d + (hash(az, d, 2) - 0.5) * 5; const x = CAMERA[0] + Math.cos(ja * DEG) * jd, z = CAMERA[2] + Math.sin(ja * DEG) * jd;
      const y = at(x, z); if (!Number.isFinite(y)) continue; floor = Math.min(floor, y); if (d < 460) continue; const slope = slopeAt(x, z); if (!Number.isFinite(slope)) continue;
      const rel = y - floor, edge = noise(x, z, 40, 3) - 0.5; // the edges wander: here the meadow climbs further, there the wood comes down
      const hollow = hollowAt(x, z); let p = smooth(0.06, 0.22, slope + 0.1 * edge + 0.01 * Math.max(0, hollow)); // forest where the mown ground gives way to the climb, reaching down the hollows
      p *= 1 - smooth(9, 20, rel + 14 * edge + 0.4 * Math.max(0, hollow)); // only the foot of the slope, higher up the gullies
      p *= smooth(0.28, 0.46, noise(x, z, 120, 7)); // pasture clearings cut into the wood
      if (hash(ja, jd, 4) > p) continue; if (!spaced(x, z, 4.2 + 1.6 * hash(ja, jd, 5))) continue;
      const height = (8.5 + 5 * hash(ja, jd, 6)) * (1 - 0.55 * smooth(0, 20, rel)) * (0.75 + 0.25 * p); if (!seen(x, y, z, height)) continue;
      const larch = 0.06 + (1 - p) * 0.22; // spruce in the body of the wood, the odd larch at its edges
      sites.push({ x, y, z, kind: hash(ja, jd, 7) < larch ? 'larch' : 'spruce', height, yaw: hash(ja, jd, 8) * Math.PI * 2, near: false });
    }
  }
  // 2. pasture spruce in the meadow: on level ground, clear of the stream bank, groups far apart
  let meadow = 0;
  for (let i = 0; i < 800 && meadow < 2; i += 1) {
    const az = (246 + 44 * hash(i, 21, 3)) * DEG, d = 230 + 190 * hash(i, 22, 5); const x = CAMERA[0] + Math.cos(az) * d, z = CAMERA[2] + Math.sin(az) * d;
    const y = at(x, z); if (!Number.isFinite(y) || slopeAt(x, z) > 0.09) continue; const h = habitat.sample(x, z); if (h.waterDistance < 14) continue; if (clearing && clearing.softness(x, z) < 1) continue;
    if (!spaced(x, z, 70)) continue; const height = 15 + 6 * hash(i, 23, 7); if (!seen(x, y, z, height)) continue;
    sites.push({ x, y, z, kind: 'spruce', height, broad: 1.25, yaw: hash(i, 24, 9) * Math.PI * 2, near: true }); meadow += 1;
    // pasture spruce stand in small family groups, not alone: the old tree with a few younger ones that seeded in its lee, close enough to share
    // one shadow, uneven in height and spacing
    for (let k = 0, placed = 0; k < 30 && placed < 3; k += 1) {
      const a = hash(i, 40 + k, 3) * Math.PI * 2, r = 4.5 + 6 * hash(i, 50 + k, 5); const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; const py = at(px, pz);
      if (!Number.isFinite(py) || habitat.sample(px, pz).waterDistance < 10 || !spaced(px, pz, 4.5)) continue;
      sites.push({ x: px, y: py, z: pz, kind: 'spruce', height: height * (0.55 + 0.35 * hash(i, 60 + k, 7)), broad: 1.2, yaw: hash(i, 70 + k, 9) * Math.PI * 2, near: true }); placed += 1;
    }
  }
  // 3. the windbreak: two loose staggered rows across the south-west wind (south is azimuth 264 in this scene), 55-65 m out from the middle of the
  //    hamlet and at least 26 m from any building, mostly spruce (evergreen shelter in winter) with a larch or two
  const hx = 40, hz = -140, wind = 309 * DEG, along = (309 - 90) * DEG; const cx = hx + Math.cos(wind) * 60, cz = hz + Math.sin(wind) * 60;
  //    It is a shelter wood, not a hedge: three staggered rows close enough for the crowns to merge into one mass, the tallest in the middle row
  //    and lower trees on the outside rows, tapering at the ends, with an old gap or two.
  for (let row = 0; row < 3; row += 1) for (let k = 0; k < 8; k += 1) {
    const i = row * 8 + k; if (hash(i, 31, 3) < 0.14) continue;
    const s = (k - 3.5 + (row === 1 ? 0.5 : 0)) * 5.2 + (hash(i, 32, 5) - 0.5) * 2.4, o = (row - 1) * 5 + (hash(i, 33, 7) - 0.5) * 2;
    const x = cx + Math.cos(along) * s + Math.cos(wind) * o, z = cz + Math.sin(along) * s + Math.sin(wind) * o;
    if (HAMLET_BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < 26)) continue; if (clearing && clearing.softness(x, z) < 1) continue; const y = at(x, z); if (!Number.isFinite(y)) continue;
    const end = smooth(10, 21, Math.abs(s)); const height = (row === 1 ? 13 + 5 * hash(i, 34, 9) : 9 + 4 * hash(i, 34, 9)) * (1 - 0.35 * end);
    sites.push({ x, y, z, kind: row !== 1 && Math.abs(s) > 14 && hash(i, 35, 11) < 0.3 ? 'larch' : 'spruce', height, yaw: hash(i, 36, 13) * Math.PI * 2, near: true });
  }
  return sites;
}

// The trees as instanced meshes, one per part (needles, bark) per kind: each source is normalised to a 1 m tree standing at the origin, and every
// site is that tree scaled, turned and planted with its base a little below the ground (the models keep root extensions below their zero).
// Materials are styled like the landscape's spruce; the foliage normal bends round each instance's own centre (applyFoliageStyle handles instancing).
export function buildCopses(sites, sources, resources) {
  const group = new THREE.Group(); group.name = 'Copses'; const disposables = [];
  for (const kind of Object.keys(sources)) {
    const source = sources[kind]; const mine = sites.filter((s) => s.kind === kind); if (!source || !mine.length) continue;
    const tree = source.clone(true); tree.position.set(0, 0, 0); tree.quaternion.identity(); tree.scale.setScalar(1); tree.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tree); const height = box.max.y - box.min.y; if (!(height > 0)) continue;
    const normalise = new THREE.Matrix4().makeScale(1 / height, 1 / height, 1 / height).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
    const centre = new THREE.Vector3(0, 0.55, 0); const site = new THREE.Matrix4(), part = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    tree.traverse((o) => {
      if (!o.isMesh) return;
      const local = normalise.clone().multiply(o.matrixWorld); const centreHere = centre.clone().applyMatrix4(local.clone().invert()); // the tree centre in this part's own space
      const style = (original) => { const m = original.clone(); if (original.userData.baseColor) m.color.copy(original.userData.baseColor);
        m.transparent = false; m.alphaTest = 0.3; m.alphaToCoverage = true; m.side = THREE.DoubleSide; m.roughness = 0.95; applyBlenderDisplay(m, resources); applyFoliageStyle(m, centreHere, COPSE_STYLE); if (m.map) m.color.multiplyScalar(CONIFER_DARKEN); /* conifers read dark even far off */
        m.userData.lookRole = 'trees'; m.userData.baseColor = m.color.clone(); disposables.push(m); return m; };
      for (const near of [true, false]) {
        const these = mine.filter((s) => s.near === near); if (!these.length) continue;
        const mesh = new THREE.InstancedMesh(o.geometry, Array.isArray(o.material) ? o.material.map(style) : style(o.material), these.length); mesh.name = `Copse / ${kind} / ${o.name}${near ? '' : ' / belt'}`;
        these.forEach((s, i) => { q.setFromAxisAngle(up, s.yaw); site.compose(new THREE.Vector3(s.x, s.y - s.height * 0.05, s.z), q, new THREE.Vector3(s.height * (s.broad ?? 1), s.height, s.height * (s.broad ?? 1))); mesh.setMatrixAt(i, part.multiplyMatrices(site, local)); });
        mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.castShadow = near; mesh.receiveShadow = true; mesh.frustumCulled = false; disposables.push({ dispose: () => mesh.dispose() });
        group.add(mesh);
      }
    });
  }
  return { group, dispose: () => disposables.forEach((d) => d.dispose()) }; // geometry and textures stay owned by their sources
}

import * as THREE from 'three';
import { applyBlenderDisplay, applyFoliageStyle } from './alpineParityMaterials.js';

// Copses of real conifers (the delivered Norway spruce and the audition larch, both by Georgeous, CC BY 4.0 - see
// design-reference/environment/asset-auditions/mature-conifers/ATTRIBUTION.md). Placed where they give the valley scale without covering the view:
//  - a loose line up the far stream at the foot of the mountains (220-300 m out, a few degrees tall, below the sun's path), so the range has
//    something of known size in front of it;
//  - a small copse on the rising ground right of the hamlet, framing the view.
// Kept clear of the sunrise over the low left-hand hills (azimuth 236-252) and of the sun's path across the middle sky. ?copses=on to see them.
export const COPSES_WANTED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('copses') === 'on';
const CAMERA = [-3, 10];
// Conifers seen against the light: much less glow through the needles than the near spruce's style, a little less lift and saturation.
const COPSE_STYLE = { sphericalBlend: 0.5, translucency: 0.12, ambientWrap: 0.25, brightness: 0.9, saturation: 1.15, backlight: 0.12 };
const DEG = Math.PI / 180;
const hash = (a, b, s) => { const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };

// sites: { x, z, kind: 'spruce' | 'larch', height (m), yaw }
export function planCopses({ habitat, groundAt, clearing = null }) {
  const sites = [];
  const ok = (x, z, minGap) => sites.every((s) => Math.hypot(s.x - x, s.z - z) > minGap);
  // 1. the far stream: search a band of azimuths and distances for bank ground (a few metres from the water), then keep well-spaced points
  for (let i = 0; i < 900 && sites.length < 6; i += 1) {
    const az = (252 + 18 * hash(i, 1, 3)) * DEG, d = 200 + 110 * hash(i, 2, 5); const x = CAMERA[0] + Math.cos(az) * d, z = CAMERA[1] + Math.sin(az) * d;
    const h = habitat.sample(x, z); if (h.waterDistance < 3 || h.waterDistance > 16 || h.density < 0.05) continue; if (clearing && clearing.softness(x, z) < 1) continue;
    if (!ok(x, z, 14 + 18 * hash(i, 12, 37))) continue; /* uneven spacing: a loose scatter, not a row */ const y = groundAt(x, z); if (!Number.isFinite(y)) continue;
    sites.push({ x, y, z, kind: hash(i, 3, 7) < 0.65 ? 'spruce' : 'larch', height: 10 + 6 * hash(i, 4, 9), yaw: hash(i, 5, 11) * Math.PI * 2 });
  }
  // 2. right of the hamlet, on the rising ground: a small group, gathered round a centre, a couple of younger trees at its edge
  const centre = { az: 301 * DEG, d: 135 }; const cx = CAMERA[0] + Math.cos(centre.az) * centre.d, cz = CAMERA[1] + Math.sin(centre.az) * centre.d;
  for (let i = 0; i < 300 && sites.length < 15; i += 1) {
    const a = hash(i, 6, 13) * Math.PI * 2, r = 4 + 14 * Math.sqrt(hash(i, 7, 17)); const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (clearing && clearing.softness(x, z) < 1) continue; const h = habitat.sample(x, z); if (h.waterDistance < 5) continue; if (!ok(x, z, 6)) continue;
    const y = groundAt(x, z); if (!Number.isFinite(y)) continue; const young = r > 13;
    sites.push({ x, y, z, kind: hash(i, 8, 19) < 0.55 ? 'larch' : 'spruce', height: young ? 7 + 3 * hash(i, 9, 23) : 13 + 6 * hash(i, 10, 29), yaw: hash(i, 11, 31) * Math.PI * 2 });
  }
  return sites;
}

// One styled tree from a delivered source (a scene or object): scaled to a height, planted with its base slightly below the ground (the models keep
// root extensions below their zero), materials styled like the landscape's spruce. Materials are shared per source; each tree needs its own foliage
// centre, so the foliage material is per tree.
export function buildCopses(sites, sources, resources) {
  const group = new THREE.Group(); group.name = 'Copses'; const disposables = [];
  for (const site of sites) {
    const source = sources[site.kind]; if (!source) continue;
    const tree = source.clone(true); tree.position.set(0, 0, 0); tree.quaternion.identity(); tree.scale.setScalar(1); tree.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tree); const height = box.max.y - box.min.y; if (!(height > 0)) continue;
    const s = site.height / height; tree.scale.setScalar(s); tree.position.set(-(box.min.x + box.max.x) * 0.5 * s, -box.min.y * s - site.height * 0.05, -(box.min.z + box.max.z) * 0.5 * s);
    const holder = new THREE.Group(); holder.name = `Copse / ${site.kind}`; holder.position.set(site.x, site.y, site.z); holder.rotation.y = site.yaw; holder.add(tree); holder.updateMatrixWorld(true);
    const center = new THREE.Box3().setFromObject(holder).getCenter(new THREE.Vector3()); const made = new Map();
    tree.traverse((o) => {
      if (!o.isMesh) return;
      const copy = (original) => { if (made.has(original)) return made.get(original); const m = original.clone(); if (original.userData.baseColor) m.color.copy(original.userData.baseColor);
        m.transparent = false; m.alphaTest = 0.3; m.alphaToCoverage = true; m.side = THREE.DoubleSide; m.roughness = 0.95; applyBlenderDisplay(m, resources); applyFoliageStyle(m, center, COPSE_STYLE); if (m.map) m.color.multiplyScalar(0.62); /* conifers read dark even far off */
        m.userData.lookRole = 'trees'; m.userData.baseColor = m.color.clone(); made.set(original, m); disposables.push(m); return m; };
      o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material); o.castShadow = site.height > 12 && Math.hypot(site.x - CAMERA[0], site.z - CAMERA[1]) < 180; o.receiveShadow = true;
    });
    group.add(holder);
  }
  return { group, dispose: () => disposables.forEach((d) => d.dispose()) }; // geometry and textures stay owned by their sources
}

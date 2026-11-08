import * as THREE from 'three';

// Heights of the RENDERED terrain (after the bank lowering and the valley relief), rasterised from its triangles. The baked height rasters only start
// 20 m in front of the camera (far-heights) or around the hamlet, so anything planted closer than that must ground itself on the mesh itself.
// Returns { at(x, z) } with NaN outside the covered area or where there is no terrain.
export function terrainRaster(group, { minX = -80, maxX = 80, minZ = -45, maxZ = 14, cell = 0.5 } = {}) {
  const w = Math.ceil((maxX - minX) / cell) + 1, h = Math.ceil((maxZ - minZ) / cell) + 1; const data = new Float32Array(w * h).fill(NaN);
  group.updateMatrixWorld(true); const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh) return; let role; for (let p = o; p; p = p.parent) if (p.userData?.echelonRole) { role = p.userData.echelonRole; break; }
    if (role !== 'terrain' && o.name !== 'sediment') return; // the stream banks are part of the sediment mesh
    const pos = o.geometry.attributes.position, index = o.geometry.index; const n = index ? index.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      a.fromBufferAttribute(pos, index ? index.getX(t) : t).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, index ? index.getX(t + 1) : t + 1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, index ? index.getX(t + 2) : t + 2).applyMatrix4(o.matrixWorld);
      if (Math.max(a.x, b.x, c.x) < minX || Math.min(a.x, b.x, c.x) > maxX || Math.max(a.z, b.z, c.z) < minZ || Math.min(a.z, b.z, c.z) > maxZ) continue;
      const den = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(den) < 1e-9) continue;
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - minX) / cell)), i1 = Math.min(w - 1, Math.ceil((Math.max(a.x, b.x, c.x) - minX) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - minZ) / cell)), j1 = Math.min(h - 1, Math.ceil((Math.max(a.z, b.z, c.z) - minZ) / cell));
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
        const x = minX + i * cell, z = minZ + j * cell; const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / den, v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / den;
        if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) { const y = u * a.y + v * b.y + (1 - u - v) * c.y; const q = j * w + i; if (!(data[q] >= y)) data[q] = y; } // highest surface wins
      }
    }
  });
  return {
    at(x, z) {
      const fx = (x - minX) / cell, fz = (z - minZ) / cell; const i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i + 1 >= w || j + 1 >= h) return NaN;
      const u = fx - i, v = fz - j, p = data[j * w + i], q = data[j * w + i + 1], r = data[(j + 1) * w + i], s = data[(j + 1) * w + i + 1];
      return (p * (1 - u) + q * u) * (1 - v) + (r * (1 - u) + s * u) * v; // NaN if any corner is missing
    },
  };
}

// Widens the water's outer edge with distance from the fixed camera (nothing at 45 m, the full amount by 150 m), so the distant stream reads as the same
// kind of water as the foreground. Boundary vertices move straight outward from the interior; nothing is added, so per-vertex attributes still match.
export const WIDEN = { camera: [-3, 10], from: 45, to: 150, maxMetres: 0 }; // 0 keeps the authored width; raise it to widen the distant water
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function widenFarWater(geometry, options = WIDEN) {
  const position = geometry.attributes.position; const index = geometry.index; if (!index) return 0;
  const edges = new Map(); const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (let t = 0; t < index.count; t += 3) {
    const ids = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    for (let k = 0; k < 3; k += 1) { const a = ids[k], b = ids[(k + 1) % 3], c = ids[(k + 2) % 3]; const id = key(a, b); const record = edges.get(id); if (record) record.count += 1; else edges.set(id, { a, b, c, count: 1 }); }
  }
  const push = new Float32Array(position.count * 2);
  for (const { a, b, c, count } of edges.values()) {
    if (count !== 1) continue; // only edges that belong to a single triangle are on the boundary
    const ax = position.getX(a), az = position.getZ(a), bx = position.getX(b), bz = position.getZ(b), cx = position.getX(c), cz = position.getZ(c);
    let nx = -(bz - az), nz = bx - ax; const length = Math.hypot(nx, nz) || 1; nx /= length; nz /= length;
    if (nx * (cx - ax) + nz * (cz - az) > 0) { nx = -nx; nz = -nz; } // away from the interior
    for (const v of [a, b]) { push[v * 2] += nx; push[v * 2 + 1] += nz; }
  }
  let moved = 0;
  for (let i = 0; i < position.count; i += 1) {
    let nx = push[i * 2], nz = push[i * 2 + 1]; const length = Math.hypot(nx, nz); if (length < 1e-6) continue; nx /= length; nz /= length;
    const x = position.getX(i), z = position.getZ(i); const width = options.maxMetres * smooth(options.from, options.to, Math.hypot(x - options.camera[0], z - options.camera[1]));
    if (width <= 0.01) continue; position.setX(i, x + nx * width); position.setZ(i, z + nz * width); moved += 1;
  }
  position.needsUpdate = true; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return moved;
}

import * as THREE from 'three';
import { HAMLET_BUILDINGS, HAMLET_LANES, HAMLET_APRON, HAMLET_TREES, HAMLET_PALETTE, mulberry32, rotate2, sampleCurve, yardPolygon, distanceToSegment, pointInPolygon } from './hamletLayout.js';

// Procedural hamlet geometry. Everything is built as flat-shaded "soups" (positions, normals, metric UVs, vertex colours that carry the
// palette and a cheap ambient-occlusion shade) grouped by material, so the whole settlement is a dozen draw calls. Pure functions
// of the layout and a height field: no rendering, no DOM, testable in node.

export class HeightField {
  constructor(meta, data) { Object.assign(this, meta); this.data = data; }
  at(x, z) {
    const fx = (x - this.minX) / this.resolution - 0.5; const fz = (z - this.minZ) / this.resolution - 0.5;
    const ix = Math.max(0, Math.min(this.width - 2, Math.floor(fx))); const iz = Math.max(0, Math.min(this.height - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - ix)); const tz = Math.max(0, Math.min(1, fz - iz)); const d = this.data; const w = this.width;
    const a = d[iz * w + ix], b = d[iz * w + ix + 1], c = d[(iz + 1) * w + ix], e = d[(iz + 1) * w + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
  }
}

const hex = (value) => { const c = new THREE.Color(value); return [c.r, c.g, c.b]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const jitterColor = (rgb, rng, amount = 0.06) => { const k = 1 + (rng() - 0.5) * amount * 2; return rgb.map((v) => v * k); };

class Soup {
  constructor() { this.position = []; this.normal = []; this.uv = []; this.color = []; this.index = []; }
  get triangles() { return this.index.length / 3; }
  // Quad a-b-c-d (counter-clockwise from the visible side). `facing` flips the winding when the normal points the wrong way.
  quad(a, b, c, d, { uv, color = [1, 1, 1], shade = [1, 1, 1, 1], facing, scale = 0.5 } = {}) {
    let v = [a, b, c, d]; let sh = shade; let n = cross(sub(b, a), sub(d, a));
    const u = Math.hypot(...sub(b, a)) * scale; const w = Math.hypot(...sub(d, a)) * scale; let uvs = uv ?? [[0, 0], [u, 0], [u, w], [0, w]];
    if (facing && dot(n, facing) < 0) { v = [a, d, c, b]; uvs = [uvs[0], uvs[3], uvs[2], uvs[1]]; sh = [sh[0], sh[3], sh[2], sh[1]]; n = [-n[0], -n[1], -n[2]]; }
    n = norm(n); const base = this.position.length / 3;
    v.forEach((p, i) => { this.position.push(...p); this.normal.push(...n); this.uv.push(...uvs[i]); this.color.push(color[0] * sh[i], color[1] * sh[i], color[2] * sh[i]); });
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  tri(a, b, c, { uv, color = [1, 1, 1], shade = [1, 1, 1], facing, scale = 0.5, normals } = {}) {
    let v = [a, b, c]; let n = cross(sub(b, a), sub(c, a)); let sh = shade; let nn = normals;
    const u = Math.hypot(...sub(b, a)) * scale; const w = Math.hypot(...sub(c, a)) * scale; let uvs = uv ?? [[0, 0], [u, 0], [0, w]];
    if (facing && dot(n, facing) < 0) { v = [a, c, b]; uvs = [uvs[0], uvs[2], uvs[1]]; sh = [sh[0], sh[2], sh[1]]; if (nn) nn = [nn[0], nn[2], nn[1]]; n = [-n[0], -n[1], -n[2]]; }
    n = norm(n); const base = this.position.length / 3;
    v.forEach((p, i) => { const q = nn ? norm(nn[i]) : n; this.position.push(...p); this.normal.push(...q); this.uv.push(...uvs[i]); this.color.push(color[0] * sh[i], color[1] * sh[i], color[2] * sh[i]); });
    this.index.push(base, base + 1, base + 2);
  }
  // Oriented box from basis vectors: centre c, tangent t, up u, normal n, full sizes.
  obox(c, t, u, n, st, su, sn, { color = [1, 1, 1], scale = 0.5, shade = 1, skipBottom = false } = {}) {
    const p = (x, y, z) => [c[0] + t[0] * x * st / 2 + u[0] * y * su / 2 + n[0] * z * sn / 2, c[1] + t[1] * x * st / 2 + u[1] * y * su / 2 + n[1] * z * sn / 2, c[2] + t[2] * x * st / 2 + u[2] * y * su / 2 + n[2] * z * sn / 2];
    const centre = c; const face = (a, b, cc, d) => { const m = [(a[0] + cc[0]) / 2 - centre[0], (a[1] + cc[1]) / 2 - centre[1], (a[2] + cc[2]) / 2 - centre[2]]; this.quad(a, b, cc, d, { color, scale, shade: [shade, shade, shade, shade], facing: m }); };
    face(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)); face(p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1));
    face(p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1)); face(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1));
    face(p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1)); if (!skipBottom) face(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1));
  }
  box(cx, y0, cz, w, h, d, opts) { this.obox([cx, y0 + h / 2, cz], [1, 0, 0], [0, 1, 0], [0, 0, 1], w, h, d, opts); }
  place(x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < this.position.length; i += 3) {
      const px = this.position[i], pz = this.position[i + 2]; this.position[i] = x + px * c + pz * s; this.position[i + 1] += y; this.position[i + 2] = z - px * s + pz * c;
      const nx = this.normal[i], nz = this.normal[i + 2]; this.normal[i] = nx * c + nz * s; this.normal[i + 2] = -nx * s + nz * c;
    }
    return this;
  }
  append(other) { const base = this.position.length / 3; for (const k of ['position', 'normal', 'uv', 'color']) other[k].forEach((v) => this[k].push(v)); other.index.forEach((i) => this.index.push(i + base)); }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3)); g.setIndex(this.index);
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }
}

const KEYS = ['plaster', 'timber', 'stone', 'roofSlate', 'roofTerracotta', 'roofShingle', 'glass', 'trim', 'wood', 'foliage', 'bark', 'soil', 'lane'];
const roofKey = { slate: 'roofSlate', terracotta: 'roofTerracotta', shingle: 'roofShingle' };
const wallKey = (name) => (name === 'redTimber' || name === 'honeyTimber' ? 'timber' : 'plaster');
const PAL = Object.fromEntries(Object.entries(HAMLET_PALETTE).map(([k, v]) => [k, hex(v)]));

// ---- building parts (local space: floor at y = 0, front facing +z) -------------------------------------------------------
function roofSlab(soup, top, thickness, color, scale = 1.1) {
  const [a, b, c, d] = top; const n = norm(cross(sub(b, a), sub(d, a))); const down = (p) => [p[0] - n[0] * thickness, p[1] - n[1] * thickness, p[2] - n[2] * thickness];
  const centre = [(a[0] + c[0]) / 2 - n[0] * thickness / 2, (a[1] + c[1]) / 2 - n[1] * thickness / 2, (a[2] + c[2]) / 2 - n[2] * thickness / 2];
  soup.quad(a, b, c, d, { color, scale, facing: n });
  const under = [down(a), down(b), down(c), down(d)].map((p) => p); soup.quad(under[0], under[1], under[2], under[3], { color: color.map((v) => v * 0.55), scale, facing: [-n[0], -n[1], -n[2]] });
  [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([i, j]) => { const pts = [top[i], top[j], under[j], under[i]]; const m = [(pts[0][0] + pts[2][0]) / 2 - centre[0], (pts[0][1] + pts[2][1]) / 2 - centre[1], (pts[0][2] + pts[2][2]) / 2 - centre[2]]; soup.quad(...pts, { color: color.map((v) => v * 0.7), scale, facing: m }); });
}

function gableRoof(soup, { w, d, eave, ridge, ov = 0.4, gov = 0.3, color }) {
  const hd = d / 2, X = w / 2 + gov, Z = hd + ov; const ey = eave - (ov / hd) * (ridge - eave); const ry = ridge + 0.05;
  roofSlab(soup, [[-X, ey, Z], [X, ey, Z], [X, ry, 0], [-X, ry, 0]], 0.16, color);
  roofSlab(soup, [[X, ey, -Z], [-X, ey, -Z], [-X, ry, 0], [X, ry, 0]], 0.16, color);
  soup.obox([0, ry + 0.04, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], w + gov * 2 + 0.1, 0.14, 0.32, { color: color.map((v) => v * 0.8) });
}

function wallsAndGables(S, b, wallColor, rng) {
  const { w, d, eave, ridge } = b; const hw = w / 2, hd = d / 2; const plain = b.siding === 'clapboard' ? S.wood : S[wallKey(b.wall)]; const ao = [0.6, 0.6, 0.98, 0.98];
  const stoneColor = jitterColor(mix(PAL.stone, [0.5, 0.5, 0.5], 0.1), rng, 0.05); const timberColor = jitterColor(PAL.honeyTimber, rng, 0.04);
  const lower = b.stoneBase ? 1.2 : b.timberUpper ? 1.35 : 0; const lowerSoup = b.stoneBase ? S.stone : plain; const upperSoup = b.timberUpper ? S.timber : plain;
  const lowerColor = b.stoneBase ? stoneColor : wallColor; const upperColor = b.timberUpper ? timberColor : wallColor;
  const wall = (p, q, f) => {
    if (lower) {
      lowerSoup.quad([p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], lower, q[1]], [p[0], lower, p[1]], { color: lowerColor, facing: f, scale: b.stoneBase ? 0.7 : 0.45, shade: ao });
      upperSoup.quad([p[0], lower, p[1]], [q[0], lower, q[1]], [q[0], eave, q[1]], [p[0], eave, p[1]], { color: upperColor, facing: f, scale: 0.45, shade: [0.95, 0.95, 0.98, 0.98] });
    } else plain.quad([p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], eave, q[1]], [p[0], eave, p[1]], { color: wallColor, facing: f, scale: 0.45, shade: ao });
  };
  for (const sgn of [1, -1]) wall([-hw, hd * sgn], [hw, hd * sgn], [0, 0, sgn]);
  for (const sgn of [1, -1]) {
    const x = hw * sgn; wall([x, hd], [x, -hd], [sgn, 0, 0]);
    if (b.roofForm !== 'hip') plain.tri([x, eave, hd], [x, eave, -hd], [x, ridge, 0], { color: wallColor, facing: [sgn, 0, 0], scale: 0.45, shade: [0.98, 0.98, 1, 1] });
  }
}

function porch(S, b, rng) {
  if (!b.porch) return; const n = Math.max(2, Math.floor(b.w / 2.1)); const x = -b.w / 2 + ((Math.floor(n / 2) + 0.5) * b.w) / n; const hd = b.d / 2; const color = jitterColor(PAL.slate, rng, 0.05);
  roofSlab(S.roofSlate, [[x + 1.15, b.eave - 0.5, hd + 0.05], [x - 1.15, b.eave - 0.5, hd + 0.05], [x - 1.15, 2.3, hd + 1.45], [x + 1.15, 2.3, hd + 1.45]], 0.1, color);
  for (const s of [-1, 1]) S.wood.box(x + s * 1.0, 0, hd + 1.3, 0.12, 2.3, 0.12, { color: PAL.whitewash, scale: 1 });
  S.stone.box(x, 0, hd + 0.75, 2.4, 0.12, 1.5, { color: PAL.stone, scale: 0.7 });
}

function hipRoof(soup, { w, d, eave, ridge, ov = 0.45, color }) {
  const X = w / 2 + ov, Z = d / 2 + ov; const ey = eave - (ov / (d / 2)) * (ridge - eave) * 0.6; const ry = ridge; const rl = Math.max(0, (w - d) / 2);
  roofSlab(soup, [[-X, ey, Z], [X, ey, Z], [rl, ry, 0], [-rl, ry, 0]], 0.16, color);
  roofSlab(soup, [[X, ey, -Z], [-X, ey, -Z], [-rl, ry, 0], [rl, ry, 0]], 0.16, color);
  roofSlab(soup, [[-X, ey, -Z], [-X, ey, Z], [-rl, ry, 0], [-rl, ry, 0]], 0.16, color);
  roofSlab(soup, [[X, ey, Z], [X, ey, -Z], [rl, ry, 0], [rl, ry, 0]], 0.16, color);
}

// A small gabled box (projecting bay or dormer) on a house front; the ridge runs front to back.
function gabledBox(S, { x, zFront, zBack, yBase, wallH, half, rise, wallSoup, wallColor, roofColor, window, shutterColor, rng }) {
  const ov = 0.22; const ey = yBase + wallH; const ry = ey + rise; const z0 = zBack, z1 = zFront + ov;
  wallSoup.quad([x - half, yBase, zFront], [x + half, yBase, zFront], [x + half, ey, zFront], [x - half, ey, zFront], { color: wallColor, facing: [0, 0, 1], scale: 0.45, shade: [0.65, 0.65, 0.98, 0.98] });
  wallSoup.tri([x - half, ey, zFront], [x + half, ey, zFront], [x, ry, zFront], { color: wallColor, facing: [0, 0, 1], scale: 0.45 });
  for (const s of [-1, 1]) wallSoup.quad([x + s * half, yBase, zFront], [x + s * half, yBase, z0], [x + s * half, ey, z0], [x + s * half, ey, zFront], { color: wallColor, facing: [s, 0, 0], scale: 0.45, shade: [0.65, 0.65, 0.95, 0.95] });
  const h = half + ov;
  roofSlab(S.roofSlate, [[x + h, ey - 0.05, z1], [x + h, ey - 0.05, z0], [x, ry + 0.05, z0], [x, ry + 0.05, z1]], 0.12, roofColor);
  roofSlab(S.roofSlate, [[x - h, ey - 0.05, z0], [x - h, ey - 0.05, z1], [x, ry + 0.05, z1], [x, ry + 0.05, z0]], 0.12, roofColor);
  if (window) windowOn(S, [x, yBase + wallH / 2 + 0.05, zFront], [1, 0, 0], [0, 0, 1], window[0], window[1], shutterColor, rng, false);
}

function dormers(S, b, rng) {
  if (!b.dormers) return; const hd = b.d / 2; const zf = hd - 0.9; const yBase = b.eave + (b.ridge - b.eave) * (0.9 / hd) - 0.05; const color = jitterColor(PAL.slate, rng, 0.05);
  for (const x of [-b.w / 4 - 0.4, b.w / 4 + 0.4]) gabledBox(S, { x, zFront: zf, zBack: zf - 1.1, yBase, wallH: 0.85, half: 0.5, rise: 0.45, wallSoup: S.wood, wallColor: PAL.whitewash, roofColor: color, window: [0.48, 0.55], shutterColor: PAL.shutterGreen, rng });
}

function crossGableBay(S, b, rng) {
  const hd = b.d / 2; const color = jitterColor(PAL.slate, rng, 0.05); const wallColor = jitterColor(PAL[b.wall], rng, 0.03);
  gabledBox(S, { x: -b.w / 4, zFront: hd + 1.5, zBack: hd - 0.3, yBase: 0, wallH: b.eave, half: 1.05, rise: 1.5, wallSoup: S.plaster, wallColor, roofColor: color, window: [0.7, 0.95], shutterColor: PAL[b.shutter] ?? PAL.shutterBlue, rng });
}

function balcony(S, b, rng) {
  if (!b.balcony) return; const hd = b.d / 2; const w = b.w * 0.86; const wood = jitterColor(mix(PAL.honeyTimber, [0.5, 0.5, 0.5], 0.3), rng, 0.05); const y = 2.45; const z = hd + 0.6;
  S.wood.box(0, y, z, w, 0.1, 1.2, { color: wood, scale: 1 });
  for (let i = 0; i <= 8; i += 1) S.wood.box(-w / 2 + (i * w) / 8, y, hd + 1.15, 0.07, 0.95, 0.07, { color: wood, scale: 1 });
  S.wood.box(0, y + 0.95, hd + 1.15, w, 0.07, 0.09, { color: wood, scale: 1 });
  for (const s of [-1, 1]) { S.wood.box(s * (w / 2 - 0.05), 0, hd + 1.1, 0.14, y, 0.14, { color: wood, scale: 1 }); S.wood.box(s * w / 2, y, z, 0.07, 0.95, 1.2, { color: wood, scale: 1 }); }
}

function plinth(S, b, floorY, minGround) {
  const depth = floorY - minGround + 0.55; const hw = b.w / 2 + 0.1, hd = b.d / 2 + 0.1; const color = mix(PAL.stone, [0.5, 0.5, 0.5], 0.15);
  S.stone.box(0, -depth, 0, hw * 2, depth + 0.5, hd * 2, { color, scale: 0.6 });
}

function windowOn(S, c, t, n, width, height, shutterColor, rng, shutters = true) {
  const up = [0, 1, 0]; const at = (ox, oy, oz) => [c[0] + t[0] * ox + up[0] * oy + n[0] * oz, c[1] + t[1] * ox + up[1] * oy + n[1] * oz, c[2] + t[2] * ox + up[2] * oy + n[2] * oz];
  const frame = mix(PAL.whitewash, PAL.cream, 0.4);
  S.glass.quad(at(-width / 2 + 0.07, -height / 2 + 0.07, 0.025), at(width / 2 - 0.07, -height / 2 + 0.07, 0.025), at(width / 2 - 0.07, height / 2 - 0.07, 0.025), at(-width / 2 + 0.07, height / 2 - 0.07, 0.025), { facing: n, color: [1, 1, 1] });
  S.trim.obox(at(0, height / 2, 0.03), t, up, n, width + 0.1, 0.08, 0.1, { color: frame }); S.trim.obox(at(0, -height / 2, 0.03), t, up, n, width + 0.1, 0.08, 0.1, { color: frame });
  S.trim.obox(at(-width / 2, 0, 0.03), t, up, n, 0.08, height, 0.1, { color: frame }); S.trim.obox(at(width / 2, 0, 0.03), t, up, n, 0.08, height, 0.1, { color: frame });
  S.trim.obox(at(0, 0, 0.03), t, up, n, 0.05, height, 0.09, { color: frame }); S.trim.obox(at(0, -height / 2 - 0.08, 0.07), t, up, n, width + 0.3, 0.07, 0.18, { color: PAL.stone });
  if (shutters) for (const s of [-1, 1]) S.trim.obox(at(s * (width / 2 + 0.22), 0, 0.045), t, up, n, 0.36, height, 0.05, { color: jitterColor(shutterColor, rng, 0.05) });
}

function door(S, c, t, n, width, height, color, stepColor) {
  const up = [0, 1, 0]; const at = (ox, oy, oz) => [c[0] + t[0] * ox + n[0] * oz, c[1] + oy, c[2] + t[2] * ox + n[2] * oz];
  S.wood.obox(at(0, height / 2, 0.03), t, up, n, width, height, 0.07, { color }); S.trim.obox(at(0, height + 0.05, 0.04), t, up, n, width + 0.3, 0.1, 0.1, { color: PAL.whitewash });
  for (const s of [-1, 1]) S.trim.obox(at(s * (width / 2 + 0.07), height / 2, 0.04), t, up, n, 0.1, height, 0.1, { color: PAL.whitewash });
  S.stone.obox(at(0, 0.08, 0.35), t, up, n, width + 0.6, 0.16, 0.7, { color: PAL.stone, scale: 0.7 });
}

function chimney(S, b, rng) {
  if (!b.chimney) return; const x = (b.chimney === 'left' ? -1 : 1) * (b.w / 2 - 0.85); const color = jitterColor(mix(PAL.stone, PAL.terracotta, 0.2), rng, 0.04);
  S.stone.box(x, b.ridge - 1.0, 0, 0.62, 1.95, 0.62, { color, scale: 0.8 }); S.stone.box(x, b.ridge + 0.9, 0, 0.78, 0.14, 0.78, { color: color.map((v) => v * 0.8), scale: 0.8 });
}

function windowsFor(S, b, shutterColor, rng) {
  const f = [0, 0, 1], t = [1, 0, 0]; const hd = b.d / 2; const n = Math.max(2, Math.floor(b.w / 2.1)); const doorSlot = Math.floor(n / 2);
  for (let i = 0; i < n; i += 1) {
    const x = -b.w / 2 + ((i + 0.5) * b.w) / n;
    if (i === doorSlot && b.kind !== 'shed') door(S, [x, 0, hd], t, f, 0.95, 1.95, PAL.door, PAL.stone);
    else if (b.kind !== 'barn' && b.kind !== 'shed') windowOn(S, [x, 1.5, hd], t, f, 0.78, 1.05, shutterColor, rng);
    if (b.eave >= 3.3 && b.kind !== 'barn' && b.kind !== 'shed') windowOn(S, [x, b.eave - 0.7, hd], t, f, 0.7, 0.95, shutterColor, rng);
  }
  if (b.kind === 'house' || b.kind === 'farm') {
    for (let i = 0; i < n; i += 1) windowOn(S, [-b.w / 2 + ((i + 0.5) * b.w) / n, 1.5, -hd], t, [0, 0, -1], 0.7, 0.95, shutterColor, rng, false);
    for (const s of [1, -1]) { windowOn(S, [s * b.w / 2, b.eave + 0.55, 0], [0, 0, -s], [s, 0, 0], 0.5, 0.6, shutterColor, rng, false); windowOn(S, [s * b.w / 2, 1.5, 0], [0, 0, -s], [s, 0, 0], 0.6, 0.9, shutterColor, rng, true); }
  }
}

function buildHouse(S, b, rng) {
  const wallColor = jitterColor(PAL[b.wall], rng, 0.04); const roofColor = jitterColor(PAL[b.roof], rng, 0.07); const shutterColor = PAL[b.shutter] ?? PAL.shutterGreen;
  wallsAndGables(S, b, wallColor, rng);
  if (b.roofForm === 'hip') hipRoof(S[roofKey[b.roof]], { w: b.w, d: b.d, eave: b.eave, ridge: b.ridge, color: roofColor });
  else gableRoof(S[roofKey[b.roof]], { w: b.w, d: b.d, eave: b.eave, ridge: b.ridge, color: roofColor, ...(b.roofForm === 'chalet' ? { ov: 1.1, gov: 0.95 } : {}) });
  chimney(S, b, rng); windowsFor(S, b, shutterColor, rng); porch(S, b, rng); dormers(S, b, rng); balcony(S, b, rng); if (b.roofForm === 'crossGable') crossGableBay(S, b, rng);
  if (b.wing) {
    const wing = { ...b, w: b.wing.w, d: b.wing.d, eave: b.eave - 0.2, ridge: b.ridge - 0.7, kind: 'shed', chimney: null, wing: null };
    const sub = new Soup(); const subs = Object.fromEntries(KEYS.map((k) => [k, new Soup()]));
    wallsAndGables(subs, wing, wallColor, rng); gableRoof(subs[roofKey[b.roof]], { w: wing.w, d: wing.d, eave: wing.eave, ridge: wing.ridge, color: roofColor }); windowsFor(subs, { ...wing, kind: 'house' }, shutterColor, rng);
    const ox = (b.wing.side === 'left' ? -1 : 1) * (b.w / 2 + b.wing.w / 2 - 0.2); const oz = -b.d / 2 + b.wing.d / 2;
    for (const k of KEYS) { subs[k].place(ox, 0, oz, 0); S[k].append(subs[k]); } void sub;
  }
}

function buildBarn(S, b, rng) {
  const wallColor = jitterColor(PAL.redTimber, rng, 0.05); wallsAndGables(S, b, wallColor, rng); gableRoof(S.roofSlate, { w: b.w, d: b.d, eave: b.eave, ridge: b.ridge, color: jitterColor(PAL.slate, rng, 0.06), ov: 0.5, gov: 0.4 });
  const hd = b.d / 2; const f = [0, 0, 1], t = [1, 0, 0];
  S.wood.obox([0, 1.35, hd + 0.03], t, [0, 1, 0], f, 2.6, 2.7, 0.08, { color: mix(PAL.door, PAL.redTimber, 0.4) }); S.trim.obox([0, 2.78, hd + 0.05], t, [0, 1, 0], f, 2.9, 0.12, 0.1, { color: PAL.whitewash });
  for (const s of [-1, 1]) S.trim.obox([s * 1.4, 1.35, hd + 0.05], t, [0, 1, 0], f, 0.12, 2.7, 0.1, { color: PAL.whitewash });
  S.glass.quad([-0.5, b.eave + 0.7, hd + 0.02], [0.5, b.eave + 0.7, hd + 0.02], [0.5, b.eave + 1.3, hd + 0.02], [-0.5, b.eave + 1.3, hd + 0.02], { facing: f });
  { const hw = b.w / 2; roofSlab(S.roofSlate, [[hw + 2.4, 1.9, hd], [hw + 2.4, 1.9, -hd], [hw, b.eave - 0.4, -hd], [hw, b.eave - 0.4, hd]], 0.12, jitterColor(PAL.slate, rng, 0.06)); for (const z of [-hd + 0.2, 0, hd - 0.2]) S.wood.box(hw + 2.3, 0, z, 0.14, 1.9, 0.14, { color: PAL.honeyTimber, scale: 1 }); S.wood.box(hw + 1.2, 0, 0, 2.2, 0.9, 1.4, { color: PAL.honeyTimber, scale: 1 }); }
}

function buildShed(S, b, rng) {
  const hw = b.w / 2, hd = b.d / 2; const color = jitterColor(PAL.honeyTimber, rng, 0.05); const roofColor = jitterColor(PAL.shingle, rng, 0.06); const back = b.eave, front = b.eave - 0.45;
  const wall = (p0, p1, p2, p3, f) => S.timber.quad(p0, p1, p2, p3, { color, facing: f, scale: 0.45, shade: [0.6, 0.6, 0.98, 0.98] });
  wall([-hw, 0, hd], [hw, 0, hd], [hw, front, hd], [-hw, front, hd], [0, 0, 1]); wall([hw, 0, -hd], [-hw, 0, -hd], [-hw, back, -hd], [hw, back, -hd], [0, 0, -1]);
  S.timber.quad([hw, 0, hd], [hw, 0, -hd], [hw, back, -hd], [hw, front, hd], { color, facing: [1, 0, 0], scale: 0.45 }); S.timber.quad([-hw, 0, -hd], [-hw, 0, hd], [-hw, front, hd], [-hw, back, -hd], { color, facing: [-1, 0, 0], scale: 0.45 });
  roofSlab(S.roofShingle, [[-hw - 0.3, front - 0.05, hd + 0.35], [hw + 0.3, front - 0.05, hd + 0.35], [hw + 0.3, back + 0.12, -hd - 0.3], [-hw - 0.3, back + 0.12, -hd - 0.3]], 0.12, roofColor);
  S.wood.obox([0, 0.9, hd + 0.03], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.95, 1.7, 0.06, { color: PAL.door });
  for (let i = 0; i < 3; i += 1) S.wood.box(-hw + 0.4 + i * 0.28, 0, hd + 1.0, 0.24, 0.24, 1.2, { color: mix(PAL.honeyTimber, [0.3, 0.2, 0.1], 0.5), scale: 1 }); // stacked logs
}

function buildChapel(S, b, rng) {
  const { w, d, eave, ridge, tower } = b; const hw = w / 2, hd = d / 2; const wallColor = jitterColor(PAL.whitewash, rng, 0.02); const roofColor = PAL.slate; const ao = [0.62, 0.62, 0.98, 0.98];
  // nave: ridge along z, front gable at +z
  for (const sgn of [1, -1]) { const x = hw * sgn; S.wood.quad([x, 0, -hd], [x, 0, hd], [x, eave, hd], [x, eave, -hd], { color: wallColor, facing: [sgn, 0, 0], scale: 0.45, shade: ao }); }
  for (const sgn of [1, -1]) { const z = hd * sgn; S.wood.quad([-hw, 0, z], [hw, 0, z], [hw, eave, z], [-hw, eave, z], { color: wallColor, facing: [0, 0, sgn], scale: 0.45, shade: ao }); S.wood.tri([-hw, eave, z], [hw, eave, z], [0, ridge, z], { color: wallColor, facing: [0, 0, sgn], scale: 0.45 }); }
  const ov = 0.4, gov = 0.35; const ey = eave - (ov / hw) * (ridge - eave); const X = hw + ov, Z = hd + gov, ry = ridge + 0.05;
  roofSlab(S.roofSlate, [[X, ey, -Z], [X, ey, Z], [0, ry, Z], [0, ry, -Z]], 0.16, roofColor); roofSlab(S.roofSlate, [[-X, ey, Z], [-X, ey, -Z], [0, ry, -Z], [0, ry, Z]], 0.16, roofColor);
  // tall windows with pointed heads along both sides, small round window above the door
  for (const sgn of [1, -1]) for (let i = 0; i < 3; i += 1) {
    const z = -hd + ((i + 0.8) * (d - 1.2)) / 3; const c = [hw * sgn, 1.75, z], t = [0, 0, -sgn], n = [sgn, 0, 0]; windowOn(S, c, t, n, 0.62, 1.55, PAL.shutterGreen, rng, false);
    const top = [c[0] + n[0] * 0.03, c[1] + 0.78, c[2]]; const half = 0.31; S.glass.tri([top[0], top[1], top[2] - half], [top[0], top[1], top[2] + half], [top[0], top[1] + 0.42, top[2]], { facing: n });
  }
  // tower on the front gable with belfry louvres and a slate spire
  const tw = tower.w, th = tower.height, tz = hd + tw / 2 - 0.2; const thw = tw / 2;
  for (const [f, p] of [[[0, 0, 1], [[-thw, 0, tz + thw], [thw, 0, tz + thw], [thw, th, tz + thw], [-thw, th, tz + thw]]], [[1, 0, 0], [[thw, 0, tz + thw], [thw, 0, tz - thw], [thw, th, tz - thw], [thw, th, tz + thw]]], [[-1, 0, 0], [[-thw, 0, tz - thw], [-thw, 0, tz + thw], [-thw, th, tz + thw], [-thw, th, tz - thw]]], [[0, 0, -1], [[thw, 0, tz - thw], [-thw, 0, tz - thw], [-thw, th, tz - thw], [thw, th, tz - thw]]]]) S.wood.quad(...p, { color: wallColor, facing: f, scale: 0.45, shade: [0.62, 0.62, 0.98, 0.98] });
  const belfry = th - 1.25; for (const [f, c, t] of [[[0, 0, 1], [0, belfry, tz + thw], [1, 0, 0]], [[1, 0, 0], [thw, belfry, tz], [0, 0, -1]], [[-1, 0, 0], [-thw, belfry, tz], [0, 0, 1]], [[0, 0, -1], [0, belfry, tz - thw], [-1, 0, 0]]]) {
    S.glass.quad([c[0] + t[0] * -0.28 + f[0] * 0.02, belfry - 0.45, c[2] + t[2] * -0.28 + f[2] * 0.02], [c[0] + t[0] * 0.28 + f[0] * 0.02, belfry - 0.45, c[2] + t[2] * 0.28 + f[2] * 0.02], [c[0] + t[0] * 0.28 + f[0] * 0.02, belfry + 0.45, c[2] + t[2] * 0.28 + f[2] * 0.02], [c[0] + t[0] * -0.28 + f[0] * 0.02, belfry + 0.45, c[2] + t[2] * -0.28 + f[2] * 0.02], { facing: f, color: [0.5, 0.5, 0.5] });
  }
  const base = [[-thw - 0.18, th, tz - thw - 0.18], [thw + 0.18, th, tz - thw - 0.18], [thw + 0.18, th, tz + thw + 0.18], [-thw - 0.18, th, tz + thw + 0.18]]; const apex = [0, th + tower.spire, tz];
  for (let i = 0; i < 4; i += 1) { const a = base[i], bb = base[(i + 1) % 4]; const m = [(a[0] + bb[0]) / 2, th + tower.spire / 3, (a[2] + bb[2]) / 2]; S.roofSlate.tri(a, bb, apex, { color: roofColor, facing: [m[0] - 0, 0, m[2] - tz], scale: 1.2 }); }
  S.trim.box(0, th + tower.spire, tz, 0.08, 0.9, 0.08, { color: PAL.whitewash }); S.trim.box(0, th + tower.spire + 0.45, tz, 0.5, 0.08, 0.08, { color: PAL.whitewash });
  door(S, [0, 0, tz + thw], [1, 0, 0], [0, 0, 1], 1.35, 2.15, PAL.door, PAL.stone); windowOn(S, [0, 3.45, tz + thw], [1, 0, 0], [0, 0, 1], 0.5, 0.7, PAL.shutterGreen, rng, false);
}

// ---- ground-following elements --------------------------------------------------------------------------------------------
function stoneWall(S, samples, field, rng, { height = 0.78, thickness = 0.42 } = {}) {
  const rows = samples.map((p, i) => {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)]; const tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; const nx = -tz / l, nz = tx / l;
    const g = field.at(p[0], p[1]); const hgt = height + (rng() - 0.5) * 0.16; const j = (rng() - 0.5) * 0.08;
    return { l: [p[0] + nx * (thickness / 2 + j), p[1] + nz * (thickness / 2 + j)], r: [p[0] - nx * (thickness / 2 + j), p[1] - nz * (thickness / 2 + j)], g, top: g + hgt, n: [nx, nz] };
  });
  const color = mix(PAL.stone, [0.45, 0.43, 0.4], 0.2);
  for (let i = 0; i < rows.length - 1; i += 1) {
    const a = rows[i], b = rows[i + 1]; const c = jitterColor(color, rng, 0.07); const V = (p, y) => [p[0], y, p[1]]; const shade = [0.6, 0.6, 0.95, 0.95];
    S.quad(V(a.l, a.g - 0.25), V(b.l, b.g - 0.25), V(b.l, b.top), V(a.l, a.top), { color: c, facing: [a.n[0], 0, a.n[1]], shade, scale: 0.7 });
    S.quad(V(b.r, b.g - 0.25), V(a.r, a.g - 0.25), V(a.r, a.top), V(b.r, b.top), { color: c, facing: [-a.n[0], 0, -a.n[1]], shade, scale: 0.7 });
    S.quad(V(a.l, a.top), V(b.l, b.top), V(b.r, b.top), V(a.r, a.top), { color: c.map((v) => v * 1.08), facing: [0, 1, 0], scale: 0.7 });
  }
}

function rail(S, p, q, half, color) {
  const t = norm(sub(q, p)); const up = [0, 1, 0]; const side = norm(cross(t, up)); const u2 = norm(cross(side, t)); const length = len(sub(q, p));
  S.obox([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], t, u2, side, length, half * 2, half * 2, { color, scale: 1.2 });
}
function fence(S, samples, field, rng) {
  const posts = []; let acc = 0; for (let i = 0; i < samples.length; i += 1) { if (i > 0) acc += Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]); if (i === 0 || acc >= 2.3 || i === samples.length - 1) { posts.push(samples[i]); acc = 0; } }
  const wood = mix(PAL.honeyTimber, [0.5, 0.5, 0.5], 0.35);
  posts.forEach((p, i) => { const g = field.at(p[0], p[1]); S.box(p[0], g - 0.15, p[1], 0.11, 1.2, 0.11, { color: jitterColor(wood, rng, 0.08), scale: 1.2 });
    if (i > 0) { const q = posts[i - 1]; const gq = field.at(q[0], q[1]); for (const h of [0.5, 0.92]) rail(S, [q[0], gq + h, q[1]], [p[0], g + h, p[1]], 0.035, jitterColor(wood, rng, 0.06)); } });
}
function hedge(S, samples, field, rng) {
  const ico = new THREE.IcosahedronGeometry(0.6, 2); const pos = ico.attributes.position; let acc = 0;
  for (let i = 0; i < samples.length; i += 1) {
    if (i > 0) acc += Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]); if (i > 0 && acc < 0.85) continue; acc = 0;
    const p = samples[i]; const g = field.at(p[0], p[1]); const s = 0.9 + rng() * 0.35; const green = jitterColor([0.07, 0.16, 0.045], rng, 0.2);
    for (let t = 0; t < pos.count; t += 3) { const v = [0, 1, 2].map((k) => [p[0] + pos.getX(t + k) * s * 1.1, g + 0.55 + pos.getY(t + k) * s * 0.9, p[1] + pos.getZ(t + k) * s * 1.1]); const mid = [(v[0][0] + v[1][0] + v[2][0]) / 3 - p[0], (v[0][1] + v[1][1] + v[2][1]) / 3 - (g + 0.55), (v[0][2] + v[1][2] + v[2][2]) / 3 - p[1]];
      const vn = [0, 1, 2].map((k) => [pos.getX(t + k), pos.getY(t + k) * 0.7 + 0.4, pos.getZ(t + k)]); S.tri(v[0], v[1], v[2], { color: green, facing: mid, shade: vn.map((m) => 0.62 + 0.4 * Math.max(0, Math.min(1, m[1] / 1.1))), normals: vn, scale: 1 }); }
  }
}

function lane(S, spec, field, rng) {
  const samples = sampleCurve(spec.points, 0.9); let travelled = 0; const rows = samples.map((p, i) => {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)]; const tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; if (i > 0) travelled += Math.hypot(p[0] - samples[i - 1][0], p[1] - samples[i - 1][1]);
    const half = (spec.width / 2) * (1 + 0.06 * Math.sin(i * 0.16 + spec.width * 3)) + 0.4; const nx = -tz / l, nz = tx / l;
    const L = [p[0] + nx * half, p[1] + nz * half], R = [p[0] - nx * half, p[1] - nz * half];
    return { L: [L[0], field.at(L[0], L[1]) + 0.07, L[1]], R: [R[0], field.at(R[0], R[1]) + 0.07, R[1]], v: travelled / 3.2 };
  });
  for (let i = 0; i < rows.length - 1; i += 1) { const a = rows[i], b = rows[i + 1]; S.quad(a.L, b.L, b.R, a.R, { uv: [[0, a.v], [0, b.v], [1, b.v], [1, a.v]], facing: [0, 1, 0], color: [1, 1, 1] }); }
}
function apron(S, field) {
  const { x, z, radius } = HAMLET_APRON; const n = 28; const ring = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; const r = radius * (1 + 0.1 * Math.sin(i * 2.3)); return [x + Math.cos(a) * r, z + Math.sin(a) * r]; });
  const centre = [x, field.at(x, z) + 0.07, z];
  for (let i = 0; i < n; i += 1) { const a = ring[i], b = ring[(i + 1) % n]; S.tri(centre, [b[0], field.at(b[0], b[1]) + 0.07, b[1]], [a[0], field.at(a[0], a[1]) + 0.07, a[1]], { uv: [[0.5, 0], [0.5 + (b[0] - x) / 6, (b[1] - z) / 6], [0.5 + (a[0] - x) / 6, (a[1] - z) / 6]], facing: [0, 1, 0] }); }
}

function broadleaf(S, field, tree) {
  const rng = mulberry32(tree.seed * 7919); const base = field.at(tree.x, tree.z) - 0.15; const h = tree.height; const trunk = mix([0.18, 0.12, 0.08], [0.3, 0.22, 0.15], rng());
  const sides = 6; for (let i = 0; i < sides; i += 1) { const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2; const r0 = 0.24, r1 = 0.1; const P = (a, r, y) => [tree.x + Math.cos(a) * r, y, tree.z + Math.sin(a) * r];
    S.bark.quad(P(a0, r0, base), P(a1, r0, base), P(a1, r1, base + h * 0.55), P(a0, r1, base + h * 0.55), { color: trunk, facing: [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], scale: 0.6 }); }
  const ico = new THREE.IcosahedronGeometry(1, 2); const pos = ico.attributes.position; const blobs = 6;
  for (let k = 0; k < blobs; k += 1) {
    const ang = rng() * Math.PI * 2, rad = (k === 0 ? 0 : 0.45 + rng() * 0.35) * tree.spread; const c = [tree.x + Math.cos(ang) * rad, base + h * (0.62 + 0.2 * rng() + (k === 0 ? 0.08 : 0)), tree.z + Math.sin(ang) * rad]; const r = tree.spread * (0.62 + rng() * 0.22);
    const green = jitterColor(mix([0.07, 0.17, 0.045], [0.13, 0.24, 0.06], rng()), rng, 0.15);
    for (let t = 0; t < pos.count; t += 3) { const v = [0, 1, 2].map((q) => { const nx = pos.getX(t + q), ny = pos.getY(t + q), nz = pos.getZ(t + q); const bump = 1 + 0.12 * Math.sin(nx * 5 + ny * 3 + k) * Math.cos(nz * 4 - k); return [c[0] + nx * r * bump, c[1] + ny * r * 0.82 * bump, c[2] + nz * r * bump]; });
      const mid = [(v[0][0] + v[1][0] + v[2][0]) / 3 - c[0], (v[0][1] + v[1][1] + v[2][1]) / 3 - c[1], (v[0][2] + v[1][2] + v[2][2]) / 3 - c[2]]; const lift = 0.65 + 0.4 * Math.max(0, mid[1] / r);
      const vn = [0, 1, 2].map((q) => { const nx = pos.getX(t + q), ny = pos.getY(t + q), nz = pos.getZ(t + q); return [nx, ny * 0.8 + 0.45, nz]; });
      S.foliage.tri(v[0], v[1], v[2], { color: green, facing: mid, shade: vn.map((m) => 0.62 + 0.45 * Math.max(0, Math.min(1, m[1] / 1.2))), normals: vn, scale: 1 }); }
  }
}

// ---- assembly -------------------------------------------------------------------------------------------------------------
export function buildHamlet(field, { seed = 20260107 } = {}) {
  const S = Object.fromEntries(KEYS.map((k) => [k, new Soup()])); const rng = mulberry32(seed); const placed = [];
  for (const b of HAMLET_BUILDINGS) {
    const local = Object.fromEntries(KEYS.map((k) => [k, new Soup()])); const br = mulberry32(seed + b.id.length * 131 + Math.round(b.x * 10));
    ({ house: buildHouse, farm: buildHouse, barn: buildBarn, shed: buildShed, chapel: buildChapel })[b.kind](local, b, br);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([sx, sz]) => { const [rx, rz] = rotate2(sx * b.w / 2, sz * b.d / 2, b.yaw); return field.at(b.x + rx, b.z + rz); });
    const floorY = corners.reduce((s, v) => s + v, 0) / corners.length + 0.14; const minGround = Math.min(...corners);
    plinth(local, b, floorY, minGround);
    for (const k of KEYS) { local[k].place(b.x, floorY, b.z, b.yaw); S[k].append(local[k]); }
    placed.push({ id: b.id, x: b.x, z: b.z, floorY });
    const yard = yardPolygon(b); if (yard) {
      // The gate is where this building's own door lane leaves the yard.
      let gateEdge = -1, gateT = 0.5; const laneSpec = HAMLET_LANES.find((l) => l.id === 'door-' + b.id);
      const exit = laneSpec && sampleCurve(laneSpec.points, 0.4).find((p) => !pointInPolygon(p[0], p[1], yard));
      if (exit) { let best = Infinity; for (let i = 0; i < 4; i += 1) { const e0 = yard[i], e1 = yard[(i + 1) % 4]; const dd = distanceToSegment(exit[0], exit[1], e0, e1); if (dd < best) { best = dd; gateEdge = i; const l2 = (e1[0] - e0[0]) ** 2 + (e1[1] - e0[1]) ** 2; gateT = Math.max(0.1, Math.min(0.9, ((exit[0] - e0[0]) * (e1[0] - e0[0]) + (exit[1] - e0[1]) * (e1[1] - e0[1])) / l2)); } } }
      for (let i = 0; i < 4; i += 1) {
        const a = yard[i], c = yard[(i + 1) % 4]; const length = Math.hypot(c[0] - a[0], c[1] - a[1]); const gap = 1.3 / length; const pieces = i === gateEdge ? [[0, gateT - gap], [gateT + gap, 1]] : [[0, 1]];
        for (const [t0, t1] of pieces) { if (t1 <= t0) continue; const pts = sampleCurve([[a[0] + (c[0] - a[0]) * t0, a[1] + (c[1] - a[1]) * t0], [a[0] + (c[0] - a[0]) * t1, a[1] + (c[1] - a[1]) * t1]], b.boundary === 'hedge' ? 0.9 : 0.7);
          if (b.boundary === 'stone') stoneWall(S.stone, pts, field, rng); else if (b.boundary === 'fence') fence(S.wood, pts, field, rng); else hedge(S.foliage, pts, field, rng); }
      }
    }
    if (b.id === 'cottage-a' || b.id === 'cottage-d') { // kitchen garden behind the house
      const [bx, bz] = rotate2(0, -b.d / 2 - 3.2, b.yaw); const cx = b.x + bx, cz = b.z + bz; const gy = field.at(cx, cz) + 0.06; const [ax, az] = rotate2(2.2, 1.6, b.yaw), [dx, dz] = rotate2(-2.2, 1.6, b.yaw), [ex, ez] = rotate2(-2.2, -1.6, b.yaw), [fx, fz] = rotate2(2.2, -1.6, b.yaw);
      S.soil.quad([cx + ax, gy, cz + az], [cx + dx, gy, cz + dz], [cx + ex, gy, cz + ez], [cx + fx, gy, cz + fz], { facing: [0, 1, 0], color: [0.34, 0.27, 0.2], scale: 0.9 });
    }
  }
  { const fx = 43.2, fz = -136.6, gy = field.at(fx, fz); S.wood.box(fx, gy - 0.1, fz, 0.09, 7.6, 0.09, { color: PAL.whitewash, scale: 1 }); const top = gy + 7.4;
    for (const f of [[0, 0, 1], [0, 0, -1]]) S.trim.quad([fx + 0.05, top, fz], [fx + 1.45, top - 0.05, fz + 0.15], [fx + 1.45, top - 0.8, fz + 0.15], [fx + 0.05, top - 0.8, fz], { color: [0.55, 0.22, 0.17], facing: f, scale: 1 }); }
  for (const spec of HAMLET_LANES) lane(S.lane, spec, field, rng); apron(S.lane, field);
  for (const tree of HAMLET_TREES) broadleaf(S, field, tree);
  const geometries = {}; let triangles = 0; for (const k of KEYS) { if (S[k].triangles) { geometries[k] = S[k].toGeometry(); triangles += S[k].triangles; } }
  return { geometries, placed, triangles };
}

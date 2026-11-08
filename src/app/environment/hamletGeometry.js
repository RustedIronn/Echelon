import * as THREE from 'three';
import {windowWarmth} from './hamletWindowLighting.js';
import { HAMLET_BUILDINGS, HAMLET_LANES, HAMLET_PALETTE, mulberry32, sampleCurve, footprint, yardPolygon, distanceToSegment, pointInPolygon } from './hamletLayout.js';

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
const wallKey = name => name === 'stone' ? 'stone' : /Timber/.test(name) ? 'timber' : 'plaster';
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


// Each opening is cut out of the wall, with a deep reveal. Windows are not
// decals floating on an opaque wall: the shadowed jamb is part of the architecture.
function facade(S, {origin, tangent, normal, width, height, color, material='plaster', openings=[]}) {
  const at=(x,y,d=0)=>[origin[0]+tangent[0]*x+normal[0]*d,origin[1]+y,origin[2]+tangent[2]*x+normal[2]*d];
  const rect=(s,x0,x1,y0,y1,d,col,f=normal)=>s.quad(at(x0,y0,d),at(x1,y0,d),at(x1,y1,d),at(x0,y1,d),{color:col,facing:f,uv:[[x0*.42,y0*.42],[x1*.42,y0*.42],[x1*.42,y1*.42],[x0*.42,y1*.42]],shade:[.86+.14*y0/height,.86+.14*y0/height,.86+.14*y1/height,.86+.14*y1/height]});
  const xs=[-width/2,width/2,...openings.flatMap(o=>[o.x-o.w/2,o.x+o.w/2])].sort((a,b)=>a-b);
  const ys=[0,height,...openings.flatMap(o=>[o.y,o.y+o.h])].sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
    const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
    if(xs[i+1]-xs[i]<.001||ys[j+1]-ys[j]<.001||openings.some(o=>Math.abs(x-o.x)<o.w/2&&y>o.y&&y<o.y+o.h))continue;
    rect(S[material],xs[i],xs[i+1],ys[j],ys[j+1],0,color);
  }
  for(const o of openings){
    const l=o.x-o.w/2,r=o.x+o.w/2,b=o.y,t=b+o.h,depth=.19;
    const stone=mix(PAL.stone,color,.25), dark=color.map(v=>v*.62);
    S.stone.quad(at(l,b),at(l,b,-depth),at(l,t,-depth),at(l,t),{color:dark,facing:tangent});
    S.stone.quad(at(r,b,-depth),at(r,b),at(r,t),at(r,t,-depth),{color:dark,facing:tangent.map(v=>-v)});
    S.stone.quad(at(l,t),at(r,t),at(r,t,-depth),at(l,t,-depth),{color:dark,facing:[0,-1,0]});
    S.stone.quad(at(l,b,-depth),at(r,b,-depth),at(r,b),at(l,b),{color:stone,facing:[0,1,0]});
    const up=[0,1,0],box=(x,y,w,h,d,col,soup=S.trim)=>soup.obox(at(x,y,d),tangent,up,normal,w,h,.065,{color:col});
    if(o.door){
      rect(S.wood,l+.025,r-.025,b,t,-depth,PAL.door);
      box(o.x,t+.09,o.w+.27,.16,.015,stone,S.stone);
      S.stone.obox(at(o.x,.035,.16),tangent,up,normal,o.w+.35,.09,.46,{color:stone});
      if(!o.barn)box(o.x+o.w*.33,b+o.h*.48,.045,.075,-.14,PAL.honeyTimber);
      else box(o.x,(b+t)/2,.07,o.h,-.14,PAL.honeyTimber,S.wood);
    }else{
      rect(S.glass,l+.05,r-.05,b+.05,t-.05,-depth,[1,1,1]);
      const frame=mix(PAL.cream,PAL.honeyTimber,.27);
      for(const x of[l+.04,r-.04])box(x,(b+t)/2,.065,o.h,-.13,frame);
      for(const y of[b+.04,t-.04])box(o.x,y,o.w,.065,-.13,frame);
      box(o.x,(b+t)/2,.045,o.h,-.13,frame);
      if(o.h>.8)box(o.x,b+o.h*.55,o.w,.04,-.13,frame);
      box(o.x,t+.075,o.w+.22,.12,.01,stone,S.stone);
      S.stone.obox(at(o.x,b-.045,.04),tangent,up,normal,o.w+.22,.09,.28,{color:stone});
      if(o.louver)for(let y=b+.1;y<t;y+=.15)box(o.x,y,o.w-.1,.08,-.1,PAL.door,S.wood);
    }
  }
}
const newSoups=()=>Object.fromEntries(KEYS.map(k=>[k,new Soup()]));
function appendAt(S,local,x,y,z,yaw=0){for(const k of KEYS){local[k].place(x,y,z,yaw);S[k].append(local[k]);}}
function cottageShell(S,b,rng){
  const col=jitterColor(PAL[b.wall],rng,.025), roof=jitterColor(PAL[b.roof],rng,.045);
  const n=Math.max(2,Math.floor(b.w/2.1)),slot=Math.floor(n/2),front=[];
  if(b.kind==='barn'||b.kind==='shed')front.push({x:0,y:0,w:b.kind==='barn'?2.4:1.1,h:b.kind==='barn'?2.35:1.75,door:true,barn:true});
  else for(let i=0;i<n;i++){
    const x=-b.w/2+(i+.5)*b.w/n;
    front.push(i===slot?{x,y:0,w:.94,h:1.98,door:true}:{x,y:.92,w:.83,h:1.13});
    if(b.eave>4)front.push({x,y:2.95,w:.76,h:1.02});
  }
  const material=wallKey(b.wall),hw=b.w/2,hd=b.d/2;
  facade(S,{origin:[0,0,hd],tangent:[1,0,0],normal:[0,0,1],width:b.w,height:b.eave,color:col,material,openings:front});
  facade(S,{origin:[0,0,-hd],tangent:[-1,0,0],normal:[0,0,-1],width:b.w,height:b.eave,color:col,material,openings:b.kind==='house'||b.kind==='farm'?[{x:-b.w*.24,y:1,w:.7,h:1}]:[]});
  for(const sign of[-1,1]){
    facade(S,{origin:[sign*hw,0,0],tangent:[0,0,-sign],normal:[sign,0,0],width:b.d,height:b.eave,color:col,material,openings:b.kind==='house'||b.kind==='farm'?[{x:0,y:1,w:.72,h:1.1}]:[]});
    S[material].tri([sign*hw,b.eave,hd],[sign*hw,b.eave,-hd],[sign*hw,b.ridge,0],{color:col,facing:[sign,0,0],scale:.42});
  }
  gableRoof(S[roofKey[b.roof]],{...b,ov:.27,gov:.22,color:roof});
  if(b.chimney){const x=(b.chimney==='left'?-1:1)*(hw-.68);S.stone.box(x,b.ridge-.75,0,.67,1.5,.62,{color:PAL.stone,scale:.7});S.stone.box(x,b.ridge+.7,0,.81,.13,.77,{color:PAL.stone});for(const z of[-.16,.16])S.timber.box(x,b.ridge+.83,z,.22,.27,.22,{color:PAL.terracotta});}
  if(b.porch){const x=front.find(o=>o.door).x;roofSlab(S.roofSlate,[[x-1.05,2.2,hd+1.25],[x+1.05,2.2,hd+1.25],[x+1.05,2.63,hd],[x-1.05,2.63,hd]],.09,roof);for(const s of[-1,1])S.wood.box(x+s*.92,0,hd+1.12,.1,2.2,.1,{color:PAL.honeyTimber});}
  if(b.wing){const local=newSoups(),w=b.wing; cottageShell(local,{...b,w:w.w,d:w.d,eave:2.4,ridge:3.8,kind:'shed',wing:null,chimney:null,porch:false},rng);appendAt(S,local,(b.w/2+w.w/2-.2)*(w.side==='left'?-1:1),0,-b.d/2+w.d/2);}
}
function chapel(S,b){
  const col=PAL.whitewash,hw=b.w/2,hd=b.d/2,roof=PAL.slate;
  for(const sign of[-1,1]){
    facade(S,{origin:[sign*hw,0,0],tangent:[0,0,-sign],normal:[sign,0,0],width:b.d,height:b.eave,color:col,openings:[-2.6,0,2.6].map(x=>({x,y:.9,w:.72,h:1.82}))});
    facade(S,{origin:[0,0,sign*hd],tangent:[sign,0,0],normal:[0,0,sign],width:b.w,height:b.eave,color:col});
    S.plaster.tri([-hw,b.eave,sign*hd],[hw,b.eave,sign*hd],[0,b.ridge,sign*hd],{color:col,facing:[0,0,sign]});
  }
  roofSlab(S.roofSlate,[[hw+.28,b.eave-.1,hd+.23],[hw+.28,b.eave-.1,-hd-.23],[0,b.ridge,-hd-.23],[0,b.ridge,hd+.23]],.12,roof);
  roofSlab(S.roofSlate,[[-hw-.28,b.eave-.1,-hd-.23],[-hw-.28,b.eave-.1,hd+.23],[0,b.ridge,hd+.23],[0,b.ridge,-hd-.23]],.12,roof);
  const tw=b.tower.w,th=b.tower.height,tz=hd+tw/2-.2;
  for(const [origin,tangent,normal,front] of[[[0,0,tz+tw/2],[1,0,0],[0,0,1],true],[[tw/2,0,tz],[0,0,-1],[1,0,0]],[[0,0,tz-tw/2],[-1,0,0],[0,0,-1]],[[-tw/2,0,tz],[0,0,1],[-1,0,0]]]){
    const openings=[{x:0,y:th-1.65,w:.83,h:1.05,louver:true}];if(front)openings.push({x:0,y:0,w:1.3,h:2.25,door:true},{x:0,y:3.3,w:.54,h:.88});
    facade(S,{origin,tangent,normal,width:tw,height:th,color:col,openings});
    for(const sign of[-1,1])S.stone.obox([origin[0]+tangent[0]*sign*(tw/2-.12),th/2,origin[2]+tangent[2]*sign*(tw/2-.12)],tangent,[0,1,0],normal,.24,th,.09,{color:PAL.stone,scale:.7});
  }
  S.stone.box(0,th-.22,tz,tw+.19,.22,tw+.19,{color:PAL.stone});
  const h=tw/2+.2,apex=[0,th+b.tower.spire,tz],base=[[-h,th,tz-h],[h,th,tz-h],[h,th,tz+h],[-h,th,tz+h]];
  for(let i=0;i<4;i++)S.roofSlate.tri(base[i],base[(i+1)%4],apex,{color:roof,facing:[(base[i][0]+base[(i+1)%4][0])/2,0,(base[i][2]+base[(i+1)%4][2])/2-tz]});
  S.wood.box(0,th+b.tower.spire,tz,.065,.65,.065,{color:PAL.door});S.wood.box(0,th+b.tower.spire+.35,tz,.36,.065,.065,{color:PAL.door});
}
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

// Shared lanes are blended onto the terrain material (hamletGround.js), so no
// lifted road ribbon, junction overlap or disconnected apron is generated here.
export function buildHamlet(field,{seed=20260107}={}){
  const S=newSoups(),placed=[],windowWeights=[],rng=mulberry32(seed);
  const routes=HAMLET_LANES.map(l=>({half:l.width/2+.28,samples:sampleCurve(l.points,.5)}));
  for(const b of HAMLET_BUILDINGS){
    const local=newSoups(),br=mulberry32(seed+b.id.length*131+Math.round(b.x*10));
    if(b.kind==='chapel')chapel(local,b);else cottageShell(local,b,br);
    const glazing=local.glass.position;
    for(let i=0;i<glazing.length;i+=12){const centre=[0,0,0];for(let v=0;v<4;v++)for(let axis=0;axis<3;axis++)centre[axis]+=glazing[i+v*3+axis]/4;
      const weight=windowWarmth(b,centre);windowWeights.push(weight,weight,weight,weight);}
    const corners=footprint(b).flat().map(([x,z])=>field.at(x,z));
    const floorY=Math.max(...corners)+.025,minGround=Math.min(...corners),depth=floorY-minGround+.2;
    // Low masonry footings disappear into the actual terrain; no raised podium.
    local.stone.box(0,-depth,0,b.w+.08,depth+.055,b.d+.08,{color:PAL.stone,scale:.7});
    if(b.wing){const w=b.wing;local.stone.box((b.w/2+w.w/2-.2)*(w.side==='left'?-1:1),-depth,-b.d/2+w.d/2,w.w+.08,depth+.055,w.d+.08,{color:PAL.stone,scale:.7});}
    if(b.kind==='chapel'){const tw=b.tower.w;local.stone.box(0,-depth,b.d/2+tw/2-.2,tw+.08,depth+.055,tw+.08,{color:PAL.stone});}
    appendAt(S,local,b.x,floorY,b.z,b.yaw);placed.push({id:b.id,x:b.x,z:b.z,floorY});
    const yard=yardPolygon(b);if(!yard||!b.boundary)continue;
    const lane=HAMLET_LANES.find(l=>l.id==='door-'+b.id),exit=lane&&sampleCurve(lane.points,.3).find(p=>!pointInPolygon(...p,yard));
    let gateEdge=-1,gateT=.5,best=Infinity;
    if(exit)for(let i=0;i<4;i++){const a=yard[i],c=yard[(i+1)%4],d=distanceToSegment(...exit,a,c);if(d<best){best=d;gateEdge=i;gateT=Math.max(.12,Math.min(.88,((exit[0]-a[0])*(c[0]-a[0])+(exit[1]-a[1])*(c[1]-a[1]))/((c[0]-a[0])**2+(c[1]-a[1])**2)));}}
    for(const i of b.boundaryEdges??[0,1,2,3]){
      const a=yard[i],c=yard[(i+1)%4],length=Math.hypot(c[0]-a[0],c[1]-a[1]),gap=1.15/length;
      for(const [t0,t1]of i===gateEdge?[[0,gateT-gap],[gateT+gap,1]]:[[0,1]]){
        if(t1<=t0)continue;const pts=sampleCurve([[a[0]+(c[0]-a[0])*t0,a[1]+(c[1]-a[1])*t0],[a[0]+(c[0]-a[0])*t1,a[1]+(c[1]-a[1])*t1]],.65);
        // Any route can open a boundary, not only this cottage's own spur.
        // Split the wall/fence instead of leaving a rail across a joined lane.
        const runs=[];let run=[];
        for(let k=0;k<pts.length-1;k++){
          const a=pts[k],c=pts[k+1],x=(a[0]+c[0])/2,z=(a[1]+c[1])/2;
          const gate=routes.some(route=>route.samples.slice(1).some((p,i)=>distanceToSegment(x,z,route.samples[i],p)<route.half));
          if(gate){if(run.length>1)runs.push(run);run=[];}else{if(!run.length)run.push(a);run.push(c);}
        }
        if(run.length>1)runs.push(run);
        for(const section of runs)if(b.boundary==='stone')stoneWall(S.stone,section,field,rng,{height:.65,thickness:.38});else fence(S.wood,section,field,rng);
      }
    }
  }
  // A bench at the chapel green and a working timber rack by the farm imply
  // habitation with a few coherent silhouettes rather than scattered props.
  for(const [x,z]of[[34,-117.2],[53,-133.5]]){
    const y=field.at(x,z);S.wood.box(x,y+.43,z,1.7,.09,.42,{color:PAL.honeyTimber});
    for(const s of[-1,1])S.wood.box(x+s*.61,y,z,.1,.47,.34,{color:PAL.door});
    S.wood.box(x,y+.75,z-.2,1.7,.25,.06,{color:PAL.honeyTimber});
  }
  const geometries={};let triangles=0;for(const k of KEYS)if(S[k].triangles){geometries[k]=S[k].toGeometry();triangles+=S[k].triangles;}
  if(geometries.glass)geometries.glass.setAttribute('aWindowWarmth',new THREE.Float32BufferAttribute(windowWeights,1));
  return{geometries,placed,triangles};
}

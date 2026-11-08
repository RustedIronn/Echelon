import { smooth, habitatHash, habitatTint } from './meadowHabitat.js';

// The foreground assets continue at their real scale; no distance-based size inflation.
export function growHabitatGrass(templates,field,habitat,{bank=null,from=32,to=220,cell=.16}={}) {
  const near=[],far=[];const count=templates.length/9;const camera=[-3,10];
  for(let j=Math.floor((camera[1]-to)/cell);j<=Math.floor((camera[1]-from)/cell);j++)for(let i=Math.floor((camera[0]-to)/cell);i<=Math.floor((camera[0]+to)/cell);i++) {
    const x=(i+habitatHash(i,j,1))*cell,z=(j+habitatHash(i,j,2))*cell,dx=x-camera[0],dz=z-camera[1],distance=Math.hypot(dx,dz);
    if(distance<from||distance>to||Math.atan2(Math.abs(dx),-dz)>.74)continue;
    const h=habitat.sample(x,z);if(h.density<.04)continue;
    const begin=smooth(from,from+15,distance),end=1-smooth(Math.min(170,to-20),to,distance);
    // Wider, readable leaf silhouettes need less overlapping subpixel geometry.
    const density=(34+24*h.density)*(0.4+1.05*h.density)*(1-.93*h.presence)*begin*end*(1-.48*smooth(85,175,distance));
    if(habitatHash(i,j,3)>density*cell*cell)continue;
    const t=Math.floor(habitatHash(i,j,4)*count)*9,jitter=.88+.24*habitatHash(i,j,5);
    const height=(.45+1.10*h.height)*jitter*(habitatHash(i,j,8)>.975?1.18:1);
    const width=.92+.14*h.density;let y=field.at(x,z);if(bank)y+=bank.offsetAt(x,z,y);
    if(h.waterDistance<3 && y<h.waterLevel+.025)continue;
    const out=distance<105?near:far;
    out.push(x,-z,y,templates[t+3]+habitatHash(i,j,6)*Math.PI*2,templates[t+4]*jitter,templates[t+5]*height,templates[t+6],templates[t+7],templates[t+8]*width);
  }
  return {near:Float32Array.from(near),far:Float32Array.from(far)};
}

export function placeHabitatFlowers(field,habitat,manifest,{bank=null,from=42,to=175}={}) {
  const matrices=Array.from({length:9},()=>[]),colors=Array.from({length:9},()=>[]);const occupied=new Set();
  for(const records of Object.values(manifest.flowers))for(const m of records)occupied.add(`${Math.floor(m[12])}:${Math.floor(m[14])}`);
  const cell=1.25;
  for(let j=Math.floor((10-to)/cell);j<=Math.floor((10-from)/cell);j++)for(let i=Math.floor((-3-to)/cell);i<=Math.floor((-3+to)/cell);i++) {
    const x=(i+habitatHash(i,j,11))*cell,z=(j+habitatHash(i,j,12))*cell,d=Math.hypot(x+3,z-10);
    if(d<from||d>to||Math.atan2(Math.abs(x+3),10-z)>.74)continue;
    const h=habitat.sample(x,z);const fade=smooth(from,55,d)*(1-smooth(Math.min(140,to-20),to,d));
    if(h.density<.06 || habitatHash(i,j,13)>(.035+1.55*Math.max(0,h.bloom-.19))*h.density*fade)continue;
    const n=1+Math.floor(habitatHash(i,j,14)*(1+3*h.bloom));
    for(let k=0;k<n;k++) {
      const px=x+(habitatHash(i,j,15+k)-.5)*1.5,pz=z+(habitatHash(i,j,25+k)-.5)*1.5;const local=habitat.sample(px,pz);
      if(local.density<.06||occupied.has(`${Math.floor(px)}:${Math.floor(pz)}`))continue;
      let y=field.at(px,pz);if(bank)y+=bank.offsetAt(px,pz,y);
      if(local.waterDistance<3 && y<local.waterLevel+.035)continue;
      const r=habitatHash(i,j,35+k);const kind=r<.43?6:r<.80?7:8;const size=.85+.28*habitatHash(i,j,45+k);
      const yaw=habitatHash(i,j,55+k)*Math.PI*2,c=Math.cos(yaw)*size,s=Math.sin(yaw)*size;
      matrices[kind].push(c,0,-s,0,0,size,0,0,s,0,c,0,px,y-.012,pz,1);colors[kind].push(1,1,1);
    }
  }
  return {counts:matrices.map(m=>m.length/16),matrices:matrices.map(m=>Float32Array.from(m)),colors:colors.map(c=>Float32Array.from(c))};
}

export function tintHabitatBlade(tint,h,weight=1) { const c=habitatTint(h);tint.r*=1+(c[0]-1)*weight;tint.g*=1+(c[1]-1)*weight;tint.b*=1+(c[2]-1)*weight;return tint; }

import { smooth, habitatHash, habitatTint } from './meadowHabitat.js';

// The delivered foreground meadow was planted only inside the 16:9 hero frustum: every authored root lies within about +/-35 degrees of the camera
// axis. In a wider window (a browser side panel, an ultrawide screen) the frame reaches past that, and the sides showed bare terrain with a straight
// edge. So growth covers any reasonable frame (FRAME_HALF_ANGLE, 60 degrees: windows up to about 4.5:1 at this lens), and below 32 m it fills only
// the band outside the authored corridor, at the authored density, weaving into it through the feathered presence map.
export const FRAME_HALF_ANGLE = 1.05; export const AUTHORED_HALF_ANGLE = 0.61;
// The foreground assets continue at their real scale; no distance-based size inflation.
export function growHabitatGrass(templates,field,habitat,{bank=null,from=32,to=220,cell=.16,nearFrom=2.5,nearGround=null}={}) {
  const near=[],far=[];const count=templates.length/9;const camera=[-3,10];
  for(let j=Math.floor((camera[1]-to)/cell);j<=Math.floor((camera[1]-nearFrom)/cell);j++)for(let i=Math.floor((camera[0]-to)/cell);i<=Math.floor((camera[0]+to)/cell);i++) {
    const x=(i+habitatHash(i,j,1))*cell,z=(j+habitatHash(i,j,2))*cell,dx=x-camera[0],dz=z-camera[1],distance=Math.hypot(dx,dz);const angle=Math.atan2(Math.abs(dx),-dz);
    if(distance<nearFrom||distance>to||angle>FRAME_HALF_ANGLE)continue;
    if(distance<from){ // near band: outside the authored corridor only, at the authored foreground's density (about 70 blades per square metre)
      const outside=smooth(AUTHORED_HALF_ANGLE-.02,AUTHORED_HALF_ANGLE+.02,angle);if(outside<=0)continue;
      const h=habitat.sample(x,z);const yg=nearGround?nearGround.at(x,z):NaN;if(!(yg===yg))continue; // grounded on the rendered mesh: the baked rasters do not reach this close
      const density=72*outside*(1-smooth(.35,.5,Math.abs(yg-nearGround.at(x+.6,z))+Math.abs(yg-nearGround.at(x,z+.6))));
      if(habitatHash(i,j,3)>density*cell*cell)continue;
      const y=yg;if(h.waterDistance<2.5 && y<h.waterLevel+.06) /* the delivered water mesh runs under the banks: its map marks dry land as water, so test the ground height instead */continue;
      const t=Math.floor(habitatHash(i,j,4)*count)*9,jitter=.88+.24*habitatHash(i,j,5);
      near.push(x,-z,y,templates[t+3]+habitatHash(i,j,6)*Math.PI*2,templates[t+4]*jitter,templates[t+5]*jitter*(.9+.3*h.height),templates[t+6],templates[t+7],templates[t+8]);
      continue;
    }
    const h=habitat.sample(x,z);if(h.density<.04)continue;
    const sideOut=smooth(AUTHORED_HALF_ANGLE-.02,AUTHORED_HALF_ANGLE+.02,angle); // outside the authored corridor nothing overlaps this band, so no fade-in there
    const begin=Math.max(smooth(from,from+15,distance),sideOut),end=1-smooth(Math.min(170,to-20),to,distance);
    // Wider, readable leaf silhouettes need less overlapping subpixel geometry.
    const baseDensity=(34+24*h.density)*(0.4+1.05*h.density)*(1-.93*h.presence)*begin*end*(1-.48*smooth(85,175,distance));
    const density=Math.max(baseDensity,72*sideOut*(1-smooth(from,from+18,distance))*end); // continue the near band's density on the sides, easing into the middle ground
    if(habitatHash(i,j,3)>density*cell*cell)continue;
    const t=Math.floor(habitatHash(i,j,4)*count)*9,jitter=.88+.24*habitatHash(i,j,5);
    const height=(.45+1.10*h.height)*jitter*(habitatHash(i,j,8)>.975?1.18:1);
    const width=.92+.14*h.density;let y=field.at(x,z);if(bank)y+=bank.offsetAt(x,z,y);
    if(h.waterDistance<3 && y<h.waterLevel+.01)continue; // height test only (the water map also covers dry banks; lowered banks sit 5 cm above the water)
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
    if(d<from||d>to||Math.atan2(Math.abs(x+3),10-z)>FRAME_HALF_ANGLE)continue;
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

// Foreground flowers for the same near frame-edge band, copied from the authored foreground so they match it: each new flower takes the orientation and
// size of a random authored flower of the same species near the camera, the species in the authored proportions, at the authored density (about
// 1.4 per square metre) and in clumps (scatterDensity). Returns { species: [16-number matrices] } in the delivery's convention (no bank offset applied).
export function extendForegroundFlowers(flowers,field,habitat,{enabled=()=>true,scatter=()=>1,clearing=null,from=3,to=40,cell=.7,nearGround=null}={}) {
  const camera=[-3,10];const templates=new Map();let total=0;
  for(const [species,records] of Object.entries(flowers)){if(!enabled(species))continue;const near=records.filter(r=>Math.hypot(r[12]-camera[0],r[14]-camera[1])<32&&Math.atan2(Math.abs(r[12]-camera[0]),camera[1]-r[14])<.52);if(near.length){templates.set(species,near);total+=near.length;}}
  const out={};if(!total)return out;const pick=(r)=>{let acc=0;for(const [species,list] of templates){acc+=list.length/total;if(r<=acc)return species;}return [...templates.keys()].pop();};
  for(let j=Math.floor((camera[1]-to)/cell);j<=Math.floor((camera[1]-from)/cell);j++)for(let i=Math.floor((camera[0]-to)/cell);i<=Math.floor((camera[0]+to)/cell);i++){
    const x=(i+habitatHash(i,j,61))*cell,z=(j+habitatHash(i,j,62))*cell,dx=x-camera[0],dz=z-camera[1],d=Math.hypot(dx,dz),angle=Math.atan2(Math.abs(dx),-dz);
    if(d<from||d>to||angle>FRAME_HALF_ANGLE)continue;
    const outside=smooth(AUTHORED_HALF_ANGLE-.02,AUTHORED_HALF_ANGLE+.03,angle)*(1-smooth(to-8,to,d));if(outside<=0)continue;
    if(habitatHash(i,j,63)>1.4*cell*cell*outside*scatter(x,z))continue;
    const h=habitat.sample(x,z);if(clearing&&clearing.softness(x,z)<.7)continue;
    const y=nearGround?nearGround.at(x,z):NaN;if(!(y===y))continue;if(h.waterDistance<2.5&&y<h.waterLevel+.08)continue; // on the rendered mesh (bank and relief included)
    const species=pick(habitatHash(i,j,64));const list=templates.get(species);const src=list[Math.floor(habitatHash(i,j,65)*list.length)];
    const yaw=habitatHash(i,j,66)*Math.PI*2,c=Math.cos(yaw),s=Math.sin(yaw);const m=[...src];
    for(let col=0;col<3;col++){const a=src[col*4],b=src[col*4+2];m[col*4]=c*a+s*b;m[col*4+2]=-s*a+c*b;} // turn the copied flower about the vertical
    m[12]=x;m[13]=y;m[14]=z;m.grounded=true;(out[species]||=[]).push(m); // grounded: Flowers must not add the bank offset again
  }
  return out;
}

export function tintHabitatBlade(tint,h,weight=1) { const c=habitatTint(h);tint.r*=1+(c[0]-1)*weight;tint.g*=1+(c[1]-1)*weight;tint.b*=1+(c[2]-1)*weight;return tint; }

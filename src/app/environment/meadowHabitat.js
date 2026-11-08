import * as THREE from 'three';

export const HABITAT = Object.freeze({ minX: -220, minZ: -320, width: 440, height: 304, cell: 1, protectNear: 32 });
// Long, overlapping growth sweeps follow the valley. Noise only softens their edges.
export const GROWTH_SWEEPS = Object.freeze([
  { x: -34, z: -64, across: 22, along: 58, bend: -.35, strength: .85 },
  { x: 28, z: -91, across: 28, along: 64, bend: .28, strength: .72 },
  { x: -24, z: -183, across: 62, along: 95, bend: -.24, strength: .50 },
]);
export const smooth = (a,b,x) => { const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t); };
export const habitatHash = (x,z,s=0) => { const v=Math.sin(x*127.1+z*311.7+s*74.7)*43758.5453;return v-Math.floor(v); };
const noise=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(habitatHash(i,j),habitatHash(i+1,j),u),THREE.MathUtils.lerp(habitatHash(i,j+1),habitatHash(i+1,j+1),u),v);};
const clamp=(v)=>THREE.MathUtils.clamp(v,0,1);

function rasterWater(group,config) {
  const {width:w,height:h,cell,minX,minZ}=config; const mask=new Uint8Array(w*h); const levels=new Float32Array(w*h);
  group.updateMatrixWorld(true); const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  group.traverse((o)=>{
    if(!o.isMesh)return;
    let role;for(let p=o;p;p=p.parent)if(p.userData?.echelonRole){role=p.userData.echelonRole;break;}
    if(role!=='water')return;
    const p=o.geometry.attributes.position,ix=o.geometry.index;const n=ix?ix.count:p.count;
    for(let k=0;k<n;k+=3){
      a.fromBufferAttribute(p,ix?ix.getX(k):k).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,ix?ix.getX(k+1):k+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,ix?ix.getX(k+2):k+2).applyMatrix4(o.matrixWorld);
      const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-8)continue;
      const x0=Math.max(0,Math.floor((Math.min(a.x,b.x,c.x)-minX)/cell)),x1=Math.min(w-1,Math.ceil((Math.max(a.x,b.x,c.x)-minX)/cell));
      const z0=Math.max(0,Math.floor((Math.min(a.z,b.z,c.z)-minZ)/cell)),z1=Math.min(h-1,Math.ceil((Math.max(a.z,b.z,c.z)-minZ)/cell));
      for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){
        const x=minX+(i+.5)*cell,z=minZ+(j+.5)*cell;const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;
        if(u>=0&&v>=0&&u+v<=1){const q=j*w+i;mask[q]=1;levels[q]=u*a.y+v*b.y+(1-u-v)*c.y;}
      }
    }
  });
  const distance=new Float32Array(w*h);distance.fill(1e5);for(let i=0;i<mask.length;i++)if(mask[i])distance[i]=0;
  const relax=(i,j,cost)=>{if(j>=0&&j<distance.length&&distance[j]+cost<distance[i]){distance[i]=distance[j]+cost;levels[i]=levels[j];}};
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const q=j*w+i;if(i)relax(q,q-1,1);if(j)relax(q,q-w,1);if(i&&j)relax(q,q-w-1,Math.SQRT2);if(i+1<w&&j)relax(q,q-w+1,Math.SQRT2);}
  for(let j=h-1;j>=0;j--)for(let i=w-1;i>=0;i--){const q=j*w+i;if(i+1<w)relax(q,q+1,1);if(j+1<h)relax(q,q+w,1);if(i+1<w&&j+1<h)relax(q,q+w+1,Math.SQRT2);if(i&&j+1<h)relax(q,q+w-1,Math.SQRT2);}
  return {mask,levels,distance};
}

export function createMeadowHabitat({group,field,clearing,roots,bank=null,config=HABITAT}) {
  const {width:w,height:h,cell,minX,minZ}=config; const water=rasterWater(group,config);const data=new Uint8Array(w*h*4);const presence=new Float32Array(w*h);const ground=new Float32Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const x=minX+(i+.5)*cell,z=minZ+(j+.5)*cell,y=field.at(x,z);ground[j*w+i]=y+(bank?bank.offsetAt(x,z,y):0);}
  if(roots)for(let k=0;k<roots.length;k+=9){const i=Math.floor((roots[k]-minX)/cell),j=Math.floor((-roots[k+1]-minZ)/cell);if(i>=0&&i<w&&j>=0&&j<h)presence[j*w+i]+=1;}
  // Feather existing grass presence, so new growth interweaves instead of ending at an occupancy-cell boundary.
  const tmp=new Float32Array(presence.length);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){let sum=0,n=0;for(let k=-3;k<=3;k++){const x=i+k;if(x>=0&&x<w){sum+=presence[j*w+x];n++;}}tmp[j*w+i]=sum/n;}
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){let sum=0,n=0;for(let k=-3;k<=3;k++){const z=j+k;if(z>=0&&z<h){sum+=tmp[z*w+i];n++;}}presence[j*w+i]=clamp(sum/n/35);}
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const q=j*w+i,x=minX+(i+.5)*cell,z=minZ+(j+.5)*cell,y=ground[q],d=water.distance[q]*cell;
    const slope=Math.hypot(ground[j*w+Math.min(w-1,i+1)]-ground[j*w+Math.max(0,i-1)],ground[Math.min(h-1,j+1)*w+i]-ground[Math.max(0,j-1)*w+i])/(2*cell);
    const tended=clearing?clearing.softness(x,z):1;
    const damp=Math.exp(-d/7)*(1-smooth(.15,2.0,y-water.levels[q]));
    const warp=(noise(x*.027,z*.027)-.5)*8;
    let rich=0;for(const s of GROWTH_SWEEPS){const u=(x-s.x+s.bend*(z-s.z)+warp)/s.across,v=(z-s.z)/s.along;rich=Math.max(rich,Math.exp(-u*u-v*v)*s.strength);}
    const quiet=Math.exp(-(((x+4+(z+105)*.22)/27)**2)-((z+105)/48)**2);
    const detail=noise(x*.085+3,z*.085+7),broad=noise(x*.022,z*.022);
    const shore=smooth(.35,1.6,d);const valid=(y>.6?1:0)*(1-smooth(.30,.58,slope))*shore*tended;
    const density=clamp(.49+.23*rich+.15*damp+.17*(broad-.5)-.23*quiet+.08*(detail-.5))*valid;
    const height=clamp(.40+.31*rich+.16*damp-.20*quiet+.14*(detail-.5))*Math.sqrt(tended);
    const blooms=clamp(.20+.58*rich+.20*(broad-.5)+.10*damp-.22*quiet)*valid;
    data.set([Math.round(density*255),Math.round(height*255),Math.round(blooms*255),Math.round(damp*255)],q*4);
  }
  const texture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  const sample=(x,z)=>{
    const fx=(x-minX)/cell-.5,fz=(z-minZ)/cell-.5;if(fx<0||fz<0||fx>w-1||fz>h-1)return {density:0,height:0,bloom:0,moisture:0,presence:0,waterDistance:1e5,waterLevel:0};
    const i=Math.min(w-2,Math.floor(fx)),j=Math.min(h-2,Math.floor(fz)),u=fx-i,v=fz-j;const ids=[j*w+i,j*w+i+1,(j+1)*w+i,(j+1)*w+i+1],weights=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];const out=[0,0,0,0];let existing=0,waterDistance=0,waterLevel=0;
    for(let k=0;k<4;k++){for(let c=0;c<4;c++)out[c]+=data[ids[k]*4+c]/255*weights[k];existing+=presence[ids[k]]*weights[k];waterDistance+=water.distance[ids[k]]*cell*weights[k];waterLevel+=water.levels[ids[k]]*weights[k];}
    return {density:out[0],height:out[1],bloom:out[2],moisture:out[3],presence:existing,waterDistance,waterLevel};
  };
  return {texture,data,presence,water,config,sample,dispose:()=>texture.dispose()};
}

export function habitatTint(h){const value=.93+.14*h.density;return [value*(1-.045*h.moisture+.025*(h.height-.5)),value*(1+.025*h.moisture+.035*(h.density-.5)),value*(1-.035*h.moisture+.02*(h.height-.5))];}

export function applyHabitatMaterial(material,habitat) {
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);const c=habitat.config;
    shader.uniforms.uHabitat={value:habitat.texture};shader.uniforms.uHabitatBounds={value:new THREE.Vector4(c.minX,c.minZ,c.width*c.cell,c.height*c.cell)};
    shader.fragmentShader='uniform sampler2D uHabitat; uniform vec4 uHabitatBounds;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec2 habitatUV2=(vCanopyWorld.xz-uHabitatBounds.xy)/uHabitatBounds.zw;
vec4 growth=texture2D(uHabitat,habitatUV2);
vec2 habitatEdgeMetres=min(habitatUV2,1.0-habitatUV2)*uHabitatBounds.zw;
float habitatInside=smoothstep(0.0,24.0,min(habitatEdgeMetres.x,habitatEdgeMetres.y));
float habitatFade=smoothstep(32.0,60.0,length(vViewPosition))*habitatInside*(1.0-smoothstep(17.0,24.0,vCanopyWorld.y))*smoothstep(.02,.16,growth.r);
vec3 growthTint=(.93+.14*growth.r)*vec3(1.0-.045*growth.a+.025*(growth.g-.5),1.0+.025*growth.a+.035*(growth.r-.5),1.0-.035*growth.a+.02*(growth.g-.5));
diffuseColor.rgb*=mix(vec3(1.0),growthTint,habitatFade);
// Distant blossoms contribute their mixed canopy colour, with the same abundance as modelled middle blooms.
float distantBloom=smoothstep(90.0,155.0,length(vViewPosition))*growth.b*habitatFade*.035;
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.62,.60,.45),distantBloom);
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
reflectedLight.indirectDiffuse*=mix(1.0,.88,habitatFade*growth.r);
`);
  };
  material.customProgramCacheKey=()=>`${previousKey?previousKey.call(material):''}-shared-habitat-2`;material.needsUpdate=true;return material;
}

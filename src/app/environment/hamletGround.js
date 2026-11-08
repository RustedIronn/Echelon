import * as THREE from 'three';
import {HAMLET_LANES,HAMLET_BUILDINGS,sampleCurve,yardPolygon,pointInPolygon} from './hamletLayout.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Local, linear-data mask: R worn lane, G tended turf. All branches use the
// same union, so junctions merge rather than overlapping lifted ribbon meshes.
export function buildHamletGroundMask(cell=.2){
  const routes=HAMLET_LANES.map(l=>({...l,samples:sampleCurve(l.points,.4)}));
  const all=routes.flatMap(l=>l.samples),minX=Math.min(...all.map(p=>p[0]))-10,minZ=Math.min(...all.map(p=>p[1]))-10;
  const width=Math.ceil((Math.max(...all.map(p=>p[0]))+10-minX)/cell),height=Math.ceil((Math.max(...all.map(p=>p[1]))+10-minZ)/cell);
  const data=new Uint8Array(width*height*4);
  for(const l of routes){
    let along=0;const total=l.samples.slice(1).reduce((v,p,i)=>v+Math.hypot(p[0]-l.samples[i][0],p[1]-l.samples[i][1]),0);
    for(let k=0;k<l.samples.length-1;k++){
      const a=l.samples[k],b=l.samples[k+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),reach=l.width/2+1.1;
      for(let j=Math.max(0,Math.floor((Math.min(a[1],b[1])-reach-minZ)/cell));j<Math.min(height,Math.ceil((Math.max(a[1],b[1])+reach-minZ)/cell));j++)for(let i=Math.max(0,Math.floor((Math.min(a[0],b[0])-reach-minX)/cell));i<Math.min(width,Math.ceil((Math.max(a[0],b[0])+reach-minX)/cell));i++){
        const x=minX+(i+.5)*cell,z=minZ+(j+.5)*cell,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(length*length||1))),d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
        const edge=.08*Math.sin(x*1.3+z*.4)+.05*Math.sin(z*2.7-x*.9),half=l.width/2+edge;
        const end=l.id==='main'?smooth(0,l.fadeEnd,Math.min(along+t*length,total-along-t*length)):1;
        const coverage=(1-smooth(half-.2,half+.4,d))*end;
        const wheel=l.id==='main'?.72+.28*smooth(.05,.55,d):1;
        const at=(j*width+i)*4;data[at]=Math.max(data[at],Math.round(255*coverage*wheel));data[at+1]=Math.max(data[at+1],Math.round(100*(1-smooth(half,half+1,d))*end));
      }
      along+=length;
    }
  }
  for(const yard of HAMLET_BUILDINGS.map(yardPolygon).filter(Boolean)){
    for(let j=Math.max(0,Math.floor((Math.min(...yard.map(p=>p[1]))-minZ)/cell));j<Math.min(height,Math.ceil((Math.max(...yard.map(p=>p[1]))-minZ)/cell));j++)for(let i=Math.max(0,Math.floor((Math.min(...yard.map(p=>p[0]))-minX)/cell));i<Math.min(width,Math.ceil((Math.max(...yard.map(p=>p[0]))-minX)/cell));i++)if(pointInPolygon(minX+(i+.5)*cell,minZ+(j+.5)*cell,yard))data[(j*width+i)*4+1]=100;
  }
  return{data,width,height,minX,minZ,spanX:width*cell,spanZ:height*cell};
}
export function attachHamletGround(terrain,gravel){
  const mask=buildHamletGroundMask(),texture=new THREE.DataTexture(mask.data,mask.width,mask.height,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  const restores=[];
  terrain.traverse(object=>{
    if(!object.isMesh)return;
    let zone,role;for(let p=object;p;p=p.parent){zone??=p.userData.terrainZone;role??=p.userData.echelonRole;}
    if(role!=='terrain'||zone!=='near')return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
      material.onBeforeCompile=function(shader,renderer){
        previous.call(this,shader,renderer);
        if(!shader.vertexShader.includes('varying vec3 vCanopyWorld')){
          shader.vertexShader='varying vec3 vCanopyWorld;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCanopyWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader='varying vec3 vCanopyWorld;\n'+shader.fragmentShader;
        }
        Object.assign(shader.uniforms,{uHamletMask:{value:texture},uHamletGravel:{value:gravel},uHamletBounds:{value:new THREE.Vector4(mask.minX,mask.minZ,mask.spanX,mask.spanZ)}});
        shader.fragmentShader='uniform sampler2D uHamletMask; uniform sampler2D uHamletGravel; uniform vec4 uHamletBounds;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`
vec2 hamletUV=(vCanopyWorld.xz-uHamletBounds.xy)/uHamletBounds.zw;
float hamletInside=step(0.0,hamletUV.x)*step(hamletUV.x,1.0)*step(0.0,hamletUV.y)*step(hamletUV.y,1.0);
vec2 hamletGround=texture2D(uHamletMask,hamletUV).rg*hamletInside;
vec3 hamletGravel=texture2D(uHamletGravel,vCanopyWorld.xz*.36).rgb*vec3(.46,.39,.28);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.155,.055),hamletGround.g*.65);
diffuseColor.rgb=mix(diffuseColor.rgb,hamletGravel,hamletGround.r);
roughnessFactor=mix(roughnessFactor,.98,hamletGround.r);
normal=normalize(mix(normal,nonPerturbedNormal,hamletGround.r*.85));
#include <lights_physical_fragment>`);
      };
      material.customProgramCacheKey=()=>previousKey.call(material)+'-hamlet-ground-1';material.needsUpdate=true;
      restores.push(()=>{material.onBeforeCompile=previous;material.customProgramCacheKey=previousKey;material.needsUpdate=true;});
    }
  });
  return()=>{restores.forEach(fn=>fn());texture.dispose();};
}

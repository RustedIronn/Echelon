import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {moodState,createLiveMoodSampler,applyTimeOfDay} from '../src/app/environment/timeOfDay.js';
import {GRADE} from '../src/app/environment/linearResolve.js';
import {LEAF_LIGHT,FLOWER_LIGHT} from '../src/app/environment/leafLight.js';
import {HAMLET_BUILDINGS} from '../src/app/environment/hamletLayout.js';
import {windowWarmth} from '../src/app/environment/hamletWindowLighting.js';
import {HeightField,buildHamlet} from '../src/app/environment/hamletGeometry.js';

const near=(a,b,tolerance=1e-4)=>assert.ok(Math.abs(a-b)<tolerance,`${a} versus ${b}`);
test('live samples follow subsecond time continuously through sample boundaries and midnight',()=>{
 const sample=createLiveMoodSampler();
 for(const base of[new Date(2026,5,21,6,30),new Date(2026,11,31,23,59,45)]){
  let prior=null;
  for(let ms=0;ms<45000;ms+=250){
   const date=new Date(+base+ms),s=sample(date),exact=moodState(date);
   near(s.sun.elevation,exact.sun.elevation,.001);near(Math.hypot(...s.sun.dir),1);near(Math.hypot(...s.moon.dir),1);
   near(s.sunK,exact.sunK,.001);near(s.hor.r,exact.hor.r,.001);near(s.haze,exact.haze,.001);near(s.toe,exact.toe,.001);
   if(prior){assert.ok(Math.abs(s.cloudShift-prior.cloudShift)<.00001);assert.ok(Math.abs(s.sun.elevation-prior.sun.elevation)<.01);}
   prior=s;
  }
 }
});
test('daylight grading stays restrained and moon illumination has no artificial new-moon floor',()=>{
 for(let hour=0;hour<24;hour+=.25){const s=moodState(new Date(2026,5,21,0,hour*60));assert.ok(s.sat>=0.7&&s.sat<=1.27); /* below 1 only at night: moonlit colours are muted on purpose */assert.ok(s.contrast>=1&&s.contrast<=1.28001); /* option B (2026-11-09): daylight contrast up to 1.28 */near(s.moonLight,s.moonVisible*s.moon.illumination,1e-10);}
});
test('only selected rooms glow; chapel belfry and service buildings remain dark',()=>{
 const chapel=HAMLET_BUILDINGS.find(b=>b.kind==='chapel');assert.equal(windowWarmth(chapel,[0,6.5,6]),0);assert.ok(windowWarmth(chapel,[0,3.74,6])>0);
 const root=new URL('../public/assets/environment/alpine-prototype/',import.meta.url),meta=JSON.parse(readFileSync(new URL('hamlet-heights.json',root)));
 const bytes=readFileSync(new URL('hamlet-heights.bin',root));const field=new HeightField(meta,new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4));
 const built=buildHamlet(field),glass=built.geometries.glass,weights=glass.getAttribute('aWindowWarmth');
 assert.equal(weights.count,glass.getAttribute('position').count);
 let lit=0;for(let i=0;i<weights.count;i+=4){const w=weights.getX(i);assert.ok(w>=0&&w<=1);for(let v=1;v<4;v++)assert.equal(weights.getX(i+v),w);if(w>.01)lit++;}
 assert.ok(lit>2&&lit<weights.count/4*.6,'a minority of windows imply occupied rooms');
 for(const g of Object.values(built.geometries))g.dispose();
});
test('the approved look restores lighting, grade, mist and window emission after a timed mood',()=>{
 const scene=new THREE.Scene(),sun=new THREE.DirectionalLight(),moon=new THREE.DirectionalLight(),hemi=new THREE.HemisphereLight();
 sun.name='sun';moon.name='moon';hemi.name='tod-ambient';scene.add(sun,moon,hemi);scene.fog=new THREE.FogExp2('#ffffff',.001);
 const material=new THREE.MeshStandardMaterial({emissive:'#ffb25c'});material.userData.windowGlow=true;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(),material);scene.add(mesh);
 let active=false,refresh=null,mist;
 scene.userData.todRig={setActive:value=>{active=value;},update:(_s,value)=>{refresh=value;}};
 const layer=new THREE.Group();layer.name='valley-mist';layer.userData.update=s=>{mist=s;};scene.add(layer);
 const base={exposure:.7,environmentIntensity:1,fogDensity:.00042},ref={sunDir:[-.7,.49,.52],sunColor:[1,.975,.935],sunEnergy:3.25,fogColor:'#bacad8'};
 const date=new Date(2026,5,21,21,30);const applied=applyTimeOfDay(scene,ref,date,base,{state:createLiveMoodSampler()(date),refreshEnvironment:false});
 assert.ok(Number.isFinite(applied.fogDensity));assert.ok(Number.isFinite(GRADE.toe.value));
 assert.ok(active);assert.equal(refresh,false);assert.ok(material.emissiveIntensity>0);
 assert.ok(LEAF_LIGHT.backlight.value<1,'night suppresses daytime leaf glow');
 assert.ok(FLOWER_LIGHT.close.value>0,'flowers close at dusk');
 const restored=applyTimeOfDay(scene,ref,null,base);
 assert.equal(LEAF_LIGHT.backlight.value,1);assert.equal(FLOWER_LIGHT.close.value,0);assert.equal(FLOWER_LIGHT.lean.value,0);
 assert.equal(restored,base);assert.equal(active,false);assert.equal(mist,null);assert.equal(material.emissiveIntensity,0);assert.equal(moon.intensity,0);assert.equal(hemi.intensity,0);assert.equal(GRADE.sat.value,1);assert.equal(GRADE.contrast.value,1);assert.equal(scene.fog.color.getHexString(),'bacad8');assert.deepEqual(sun.color.toArray(),ref.sunColor);
 mesh.geometry.dispose();material.dispose();
});

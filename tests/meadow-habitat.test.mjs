import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMeadowHabitat} from '../src/app/environment/meadowHabitat.js';
import {growHabitatGrass,placeHabitatFlowers,AUTHORED_HALF_ANGLE} from '../src/app/environment/meadowHabitatGrowth.js';

function fixture(){
 const group=new THREE.Group();
 const water=new THREE.Mesh(new THREE.PlaneGeometry(8,30).rotateX(-Math.PI/2));water.position.set(0,1,-45);water.userData.echelonRole='water';group.add(water);
 const config={minX:-30,minZ:-70,width:60,height:60,cell:1};
 const field={at:(x)=>Math.abs(x)<4?.8:1.4};
 const habitat=createMeadowHabitat({group,field,config,clearing:{softness:(x)=>x>20?0:1}});
 return {habitat,field};
}
test('shared habitat raster excludes flowing water and settlement clearing, with feathered dry-to-damp banks',()=>{
 const {habitat:h}=fixture();
 assert.equal(h.sample(0,-45).density,0);
 assert.equal(h.sample(24,-45).density,0);
 assert.ok(h.sample(6,-45).density>0);
 assert.ok(h.sample(6,-45).moisture>h.sample(16,-45).moisture);
 // CPU interpolation agrees with the actual quantized texture at a texel centre.
 const q=25*60+38,s=h.sample(8.5,-44.5);
 assert.equal(s.density,h.data[q*4]/255);assert.equal(s.bloom,h.data[q*4+2]/255);
 h.dispose();
});
test('new vegetation is deterministic, above the stream and absent from protected foreground',()=>{
 const {habitat,field}=fixture(),template=Float32Array.from([0,0,0,0,1,1,0,1,1]);
 const a=growHabitatGrass(template,field,habitat,{from:32,to:65,cell:.4}),b=growHabitatGrass(template,field,habitat,{from:32,to:65,cell:.4});
 assert.deepEqual(a,b);assert.ok(a.near.length>0);
 for(const records of [a.near,a.far])for(let k=0;k<records.length;k+=9){const x=records[k],z=-records[k+1],y=records[k+2],h=habitat.sample(x,z);const dd=Math.hypot(x+3,z-10);assert.ok(dd>=32-1e-5||Math.atan2(Math.abs(x+3),10-z)>=AUTHORED_HALF_ANGLE-.05,"below 32 m only outside the authored corridor");assert.ok(h.waterDistance>=3||y>=h.waterLevel+.024);assert.ok(Math.abs(y-field.at(x,z))<1e-6);}
 const flowers=placeHabitatFlowers(field,habitat,{flowers:{}},{from:42,to:65});
 for(const m of flowers.matrices)for(let k=0;k<m.length;k+=16){const h=habitat.sample(m[k+12],m[k+14]);assert.ok(h.waterDistance>=3||m[k+13]+.012>=h.waterLevel+.034);}
 habitat.dispose();
});
import {planRealFlowers} from '../src/app/environment/realFlowers.js';
test('natural flower placement preserves authored size differences and root positions',()=>{
 const placed=size=>({counts:[0,0,0,0,0,0,1,0,0],matrices:[[],[],[],[],[],[],[size,0,0,0,0,size,0,0,0,0,size,0,-8,2,-78,1],[],[]]});
 const small=planRealFlowers(placed(.75),{naturalScale:true}),large=planRealFlowers(placed(1.5),{naturalScale:true});
 assert.deepEqual([...small.keys()],[...large.keys()]);
 for(const [species,a] of small){const b=large.get(species);for(const i of [0,1,2,4,5,6,8,9,10])assert.ok(Math.abs(b[i]-2*a[i])<1e-10);assert.deepEqual(a.slice(12,16),b.slice(12,16));assert.deepEqual(a.slice(12,16),[-8,2.02,-78,1]);}
});

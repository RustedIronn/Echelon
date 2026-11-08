import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const base=process.env.ECHELON_PREVIEW_URL || 'http://127.0.0.1:4174';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist','--use-angle=d3d11']});
const results=[];
const cases=[['cohesion-previous','refinement=previous'],['cohesion-refined',''],['cohesion-refined-repeat',''],['cohesion-previous-repeat','refinement=previous'],['cohesion-physical','water=physical'],['cohesion-high-dpr','dpr=1.5']];
try {
for(const [name,query] of cases) {
 const page=await browser.newPage({viewport:{width:2560,height:1440}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${base}/landscape-preview.html?capture=1&benchmark=1&${query}`);
 await page.waitForFunction(()=>window.__echelonPrototype?.metrics?.samples>=600,null,{timeout:180000});
 await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,import.meta.url))});
 const stats=await page.evaluate(()=>{const {manifest,...rest}=window.__echelonPrototype;return rest;});
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(stats.inventory.trees.length,2);
 for(const tree of stats.inventory.trees) {assert.equal(tree.visible,true);assert.ok(tree.projectedBounds[0][1]<0,'Spruce must project into the formerly hidden left half');}
 const height=Math.max(...stats.inventory.trees.map(t=>t.worldBounds[1][1]))-Math.min(...stats.inventory.trees.map(t=>t.worldBounds[0][1]));assert.ok(Math.abs(height-6.300394535)<.00001);
 if(name==='cohesion-refined') {
  assert.equal(stats.reflection.captures,1);
  for(const [suffix,clip] of [['water',{x:1550,y:1030,width:950,height:400}],['meadow',{x:100,y:970,width:1000,height:450}],['mountains-hamlet',{x:300,y:450,width:2000,height:400}],['spruce',{x:200,y:470,width:350,height:500}]]) await page.screenshot({path:fileURLToPath(new URL(`cohesion-${suffix}.png`,import.meta.url)),clip});
 }
 results.push({name,query,...stats,errors});console.log(name,JSON.stringify({metrics:stats.metrics,reflection:stats.reflection,errors}));await page.close();
 await writeFile(new URL('cohesion-browser-results.json',import.meta.url),JSON.stringify(results,null,2));
}
const page=await browser.newPage({viewport:{width:2560,height:720}});
await page.goto(`${base}/landscape-preview.html?capture=1&compare=1&benchmark=1`);
await page.waitForFunction(()=>window.__echelonPrototype?.metrics?.samples>=30,null,{timeout:120000});
assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('canvas').clientWidth/document.querySelector('canvas').clientHeight)-16/9)<.001);
await page.screenshot({path:fileURLToPath(new URL('cohesion-blender-comparison.png',import.meta.url))});await page.close();
const idle=await browser.newPage({viewport:{width:2560,height:1440}});await idle.goto(`${base}/landscape-preview.html?capture=1`);await idle.waitForFunction(()=>window.__echelonPrototype?.ready,null,{timeout:120000});await idle.waitForTimeout(1500);
const before=await idle.evaluate(()=>window.__echelonPrototype.totalFrames);await idle.waitForTimeout(1500);const after=await idle.evaluate(()=>window.__echelonPrototype.totalFrames);
const idleData={before,after,observationMilliseconds:1500,stoppedRenderingWhenStatic:before===after};assert.equal(idleData.stoppedRenderingWhenStatic,true);await writeFile(new URL('cohesion-idle.json',import.meta.url),JSON.stringify(idleData,null,2));console.log('idle',JSON.stringify(idleData));await idle.close();
} finally { await browser.close(); }

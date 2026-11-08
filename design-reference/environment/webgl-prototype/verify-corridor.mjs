import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const base=process.env.ECHELON_PREVIEW_URL || 'http://127.0.0.1:4174';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist','--use-angle=d3d11']});
const results=[];
const cases=[['corridor-before','corridor=0'],['corridor-refined',''],['corridor-refined-repeat',''],['corridor-before-repeat','corridor=0'],['corridor-physical','water=physical']];
try {
for(const [name,query] of cases) {
 const page=await browser.newPage({viewport:{width:2560,height:1440}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${base}/landscape-preview.html?capture=1&benchmark=1&${query}`);
 await page.waitForFunction(()=>window.__echelonPrototype?.metrics?.samples>=600,null,{timeout:180000});
 const stats=await page.evaluate(()=>{const rest={...window.__echelonPrototype};delete rest.manifest;delete rest.refreshWaterOptics;return rest;});
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(stats.inventory.trees.length,2);
 await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,import.meta.url))});
 if(name==='corridor-refined') {
  assert.equal(stats.waterBed.captures,1);
  for(const [suffix,clip] of [['water-close',{x:1200,y:900,width:1300,height:500}],['middle-close',{x:450,y:630,width:1800,height:420}]]) await page.screenshot({path:fileURLToPath(new URL(`corridor-${suffix}.png`,import.meta.url)),clip});
 }
 let warmOptics;
 if(name.includes('refined')) {
  await page.evaluate(()=>window.__echelonPrototype.refreshWaterOptics());
  await page.waitForFunction(()=>window.__echelonPrototype?.waterBed?.captures===2 && Number.isFinite(window.__echelonPrototype.waterBed.gpuMilliseconds),null,{timeout:120000});
  warmOptics=await page.evaluate(()=>({reflection:window.__echelonPrototype.reflection,waterBed:window.__echelonPrototype.waterBed}));
 }
 results.push({name,query,...stats,warmOptics,errors});console.log(name,JSON.stringify({metrics:stats.metrics,grass:stats.inventory.grass,firstReflection:stats.reflection,firstBed:stats.waterBed,warmOptics,errors}));await page.close();
 await writeFile(new URL('corridor-browser-results.json',import.meta.url),JSON.stringify(results,null,2));
}
const page=await browser.newPage({viewport:{width:5120,height:1440}});
await page.goto(`${base}/landscape-preview.html?capture=1&compare=1&benchmark=1`);
await page.waitForFunction(()=>window.__echelonPrototype?.metrics?.samples>=30,null,{timeout:120000});
assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('canvas').clientWidth/document.querySelector('canvas').clientHeight)-16/9)<.001);
await page.screenshot({path:fileURLToPath(new URL('corridor-blender-comparison.png',import.meta.url))});await page.close();
const idle=await browser.newPage({viewport:{width:2560,height:1440}});await idle.goto(`${base}/landscape-preview.html?capture=1`);await idle.waitForFunction(()=>window.__echelonPrototype?.waterBed?.captures===1,null,{timeout:120000});await idle.waitForTimeout(1500);
const before=await idle.evaluate(()=>window.__echelonPrototype.totalFrames);await idle.waitForTimeout(1500);const after=await idle.evaluate(()=>window.__echelonPrototype.totalFrames);
const idleData={before,after,observationMilliseconds:1500,stoppedRenderingWhenStatic:before===after};assert.equal(idleData.stoppedRenderingWhenStatic,true);await writeFile(new URL('corridor-idle.json',import.meta.url),JSON.stringify(idleData,null,2));console.log('idle',JSON.stringify(idleData));await idle.close();
} finally { await browser.close(); }

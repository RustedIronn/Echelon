import {chromium} from './browser-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist','--use-angle=d3d11']});
const folder=new URL('./day-cycle/',import.meta.url);
try{
 const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const root='http://127.0.0.1:5195',base=root+'/landscape-preview.html?capture=1&dpr=1';
 await page.goto(base+'&tod=14&date=2026-06-21',{timeout:120000});
 await page.waitForFunction(()=>window.__echelonPrototype?.skyEnvironment?.captures>=1,null,{timeout:120000});
 const moduleUrl=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).find(s=>s.includes('/timeOfDay.js')));
 assert.ok(moduleUrl);
 const mode=await page.evaluate(async url=>{window.testTod=await import(url);return window.testTod.getTod().mode;},moduleUrl);assert.equal(mode,'manual');
 await page.evaluate(()=>window.testTod.setTod({mode:'live'}));await page.waitForTimeout(2000);
 const snapshot=()=>page.evaluate(()=>({frames:window.__echelonPrototype.totalFrames,sky:window.__echelonPrototype.skyEnvironment?.captures,reflection:window.__echelonPrototype.reflection?.captures}));
 const start=await snapshot();await page.waitForTimeout(8000);const middle=await snapshot();
 assert.equal(middle.sky,start.sky,'interpolated ticks must not rebuild the environment');assert.ok(middle.frames-start.frames>=20&&middle.frames-start.frames<65,'live view advances calmly in demand mode');
 await page.waitForTimeout(23500);const end=await snapshot();assert.ok(end.sky>middle.sky&&end.sky<=middle.sky+2,'lighting cache refreshes near the 30-second cadence');
 await page.evaluate(()=>window.testTod.setTod({mode:'approved'}));await page.waitForTimeout(2200);await page.screenshot({path:new URL('restored-approved.png',folder).pathname.slice(1)});
 await page.goto(base,{timeout:120000});await page.waitForFunction(()=>window.__echelonPrototype?.ready,null,{timeout:120000});await page.waitForTimeout(2200);await page.screenshot({path:new URL('fresh-approved.png',folder).pathname.slice(1)});
 const imageRoot=root+'/design-reference/environment/webgl-prototype/day-cycle/';
 const difference=await page.evaluate(async prefix=>{
  const load=async name=>{const im=new Image();im.src=prefix+name;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
  const a=await load('restored-approved.png'),b=await load('fresh-approved.png');let changed=0,max=0,sum=0;for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);if(d)changed++;max=Math.max(max,d);sum+=d;}return{changedChannels:changed,max,mean:sum/(a.length/4*3)};
 },imageRoot);
 assert.ok(difference.mean<.05,'restoring approved must visually match a fresh approved view');
 assert.deepEqual(errors,[]);
 const report={start,middle,end,difference,errors};fs.writeFileSync(new URL('live-validation.json',folder),JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}

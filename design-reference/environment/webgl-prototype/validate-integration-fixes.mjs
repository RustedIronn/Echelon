import {chromium} from './browser-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist','--use-angle=d3d11']});
const folder=new URL('./integration-fixes/',import.meta.url);
try{
 const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const root='http://127.0.0.1:5195';
 await page.goto(root+'/landscape-preview.html?capture=1&tod=14&date=2026-06-21&wind=0&shaderlog=1',{timeout:120000});
 await page.waitForFunction(()=>window.__echelonPrototype?.ready,null,{timeout:120000});await page.waitForTimeout(2500);
 await page.screenshot({path:new URL('after.png',folder).pathname.slice(1)});
 const flowers=await page.evaluate(()=>{const found=[];window.__echelonPrototype.scene.traverse(o=>{if(o.isInstancedMesh&&/ LOD \d$/.test(o.name))found.push({name:o.name,receiveShadow:o.receiveShadow});});return found;});
 assert.ok(flowers.length>0&&flowers.every(f=>f.receiveShadow),'all authored flower meshes receive shadows');
 const moduleUrls=await page.evaluate(()=>{const urls=performance.getEntriesByType('resource').map(e=>e.name);return {tod:urls.find(s=>s.includes('/timeOfDay.js')),resolve:urls.find(s=>s.includes('/linearResolve.js'))};});
 await page.evaluate(async urls=>{window.integrationTod=await import(urls.tod);window.integrationGrade=(await import(urls.resolve)).GRADE;window.integrationTod.setTod({mode:'live'});},moduleUrls);
 const snapshot=()=>page.evaluate(()=>({frames:window.__echelonPrototype.totalFrames,finiteFog:Number.isFinite(window.__echelonPrototype.scene.fog.density),finiteToe:Number.isFinite(window.integrationGrade.toe.value),animation:window.__echelonWorld.animation,sky:window.__echelonPrototype.skyEnvironment?.captures,reflection:window.__echelonPrototype.reflection?.captures}));
 await page.waitForTimeout(1800);const live=await snapshot();assert.ok(live.finiteFog&&live.finiteToe);
 await page.evaluate(()=>{window.__echelonWorld.setWind(true);window.__echelonWorld.setActivity('obscured');});await page.waitForTimeout(1800);
 const obscuredStart=await snapshot();await page.waitForTimeout(3200);const obscuredEnd=await snapshot();assert.equal(obscuredStart.frames,obscuredEnd.frames,'obscured live backdrop must stop rendering');assert.equal(obscuredStart.sky,obscuredEnd.sky);assert.equal(obscuredStart.reflection,obscuredEnd.reflection);
 await page.evaluate(()=>window.__echelonWorld.setActivity('work'));await page.waitForTimeout(1400);const resumed=await snapshot();assert.ok(resumed.frames>obscuredEnd.frames&&resumed.finiteFog&&resumed.finiteToe);assert.equal(resumed.animation.fps,30);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(1500);const hiddenStart=await snapshot();await page.waitForTimeout(3000);const hiddenEnd=await snapshot();assert.equal(hiddenStart.frames,hiddenEnd.frames,'hidden-document live backdrop must stop rendering');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));window.__echelonWorld.setWind(false);window.__echelonWorld.setActivity('scenic');});await page.waitForTimeout(1300);const visibleAgain=await snapshot();assert.ok(visibleAgain.frames>hiddenEnd.frames&&visibleAgain.finiteFog&&visibleAgain.finiteToe);
 const difference=await page.evaluate(async prefix=>{
  const load=async name=>{const image=new Image();image.src=prefix+name;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
  const before=await load('before.png'),after=await load('after.png');let sum=0,max=0,sky=0,skyCount=0,changedPixels=0;
  for(let p=0;p<before.length;p+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(before[p+c]-after[p+c]);sum+=d;max=Math.max(max,d);if(d)changed=true;if(p<2560*420*4){sky+=d;skyCount++;}}if(changed)changedPixels++;}
  return{mean:sum/(before.length/4*3),max,changedPixels,skyMean:sky/skyCount};
 },root+'/design-reference/environment/webgl-prototype/integration-fixes/');
 assert.ok(difference.skyMean<.01,'sky and scene lighting must be preserved');assert.deepEqual(errors,[]);
 const report={flowers:flowers.length,live,obscuredStart,obscuredEnd,resumed,hiddenStart,hiddenEnd,visibleAgain,difference,errors};fs.writeFileSync(new URL('validation.json',folder),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}

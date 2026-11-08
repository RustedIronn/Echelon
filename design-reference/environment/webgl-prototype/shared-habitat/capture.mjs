import { chromium } from '../browser-tools/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const name=process.argv[2]||'before';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist','--use-angle=d3d11']});
try { const page=await browser.newPage({viewport:{width:2560,height:1440}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:5180/landscape-preview.html?capture=1&benchmark=1&dpr=1&shaderlog=1');
await page.waitForFunction(()=>window.__echelonPrototype?.metrics?.samples>=600,null,{timeout:300000});
await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,import.meta.url))});
for(const [suffix,clip] of [['middle',{x:120,y:680,width:2300,height:380}],['foreground',{x:80,y:1050,width:1000,height:350}]])await page.screenshot({path:fileURLToPath(new URL(`${name}-${suffix}.png`,import.meta.url)),clip});
const stats=await page.evaluate(()=>{const r={...window.__echelonPrototype};delete r.manifest;delete r.refreshWaterOptics;return r});
await writeFile(new URL(`${name}.json`,import.meta.url),JSON.stringify({...stats,errors},null,2));console.log(name,JSON.stringify({metrics:stats.metrics,grass:stats.inventory.grass,errors}));
}finally{await browser.close();}

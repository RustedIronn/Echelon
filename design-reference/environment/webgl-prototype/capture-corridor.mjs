import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist','--use-angle=d3d11']});
for(const [name,query] of [['corridor-before','corridor=0'],['corridor-test','']]){
 const page=await browser.newPage({viewport:{width:2560,height:1440}});const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('ERROR',m.text())}});
 await page.goto(`http://127.0.0.1:5174/landscape-preview.html?capture=1&benchmark=1&${query}`);
 await page.waitForFunction(()=>window.__echelonPrototype?.metrics?.samples>60,null,{timeout:120000});
 await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,import.meta.url))});
 console.log(name,JSON.stringify(await page.evaluate(()=>({metrics:window.__echelonPrototype.metrics,reflection:window.__echelonPrototype.reflection,bed:window.__echelonPrototype.waterBed}))),errors);
 await page.close();
}await browser.close();

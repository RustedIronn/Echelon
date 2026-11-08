import {chromium} from './browser-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const sheetOnly=process.argv.includes('--sheet');
const label=process.argv[2]||'before',origin=process.argv[3]||'http://127.0.0.1:5195';
const folder=new URL('./day-cycle/',import.meta.url),date='2026-06-21';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist','--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1});
 const hours=[['morning',6.5],['afternoon',14],['sunset',19.2],['blue-hour',20.1],['night',21.5]];
 const reports=[];let errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const [name,hour]of sheetOnly?[]:hours){
  errors=[];await page.goto(`${origin}/landscape-preview.html?capture=1&benchmark=1&dpr=1&tod=${hour}&date=${date}`,{timeout:120000});
  await page.waitForFunction(()=>window.__echelonPrototype?.metrics?.samples>=180,null,{timeout:180000});
  await page.screenshot({path:new URL(`${label}-${name}.png`,folder).pathname.slice(1)});
  reports.push({name,hour,errors,...await page.evaluate(()=>JSON.parse(JSON.stringify(window.__echelonPrototype,(k,v)=>k==='manifest'||typeof v==='function'?undefined:v)))});
 }
 if(!sheetOnly)fs.writeFileSync(new URL(`${label}-measurements.json`,folder),JSON.stringify({date,frames:reports},null,2));
 await page.setViewportSize({width:1600,height:1420});
 const images=hours.map(([name,hour])=>`<section><h3>${name} · ${hour}</h3><img src="${origin}/design-reference/environment/webgl-prototype/day-cycle/${label}-${name}.png"></section>`).join('');
 await page.setContent(`<html><style>body{margin:0;background:#202827;color:#eee;font:16px system-ui;display:grid;grid-template-columns:1fr 1fr;gap:12px}h3{margin:8px 12px;font-weight:400}img{width:100%;display:block}</style>${images}</html>`);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
 await page.screenshot({path:new URL(`${label}-sheet.png`,folder).pathname.slice(1),fullPage:true});
 console.log(reports.map(r=>({name:r.name,errors:r.errors,gpu:r.metrics.gpuP50ms,calls:r.metrics.callsAllPasses})));
}finally{await browser.close();}

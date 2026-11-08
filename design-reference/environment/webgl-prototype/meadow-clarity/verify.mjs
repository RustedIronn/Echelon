import {chromium} from '../browser-tools/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist','--use-angle=d3d11']});
const results=[];
try{
 for(const [label,query] of [['after-a','habitat'],['after-b','habitat']]){
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:4181/landscape-preview.html?capture=1&benchmark=1&dpr=1&shaderlog=1&meadow=${query}`);
  await page.waitForFunction(()=>window.__echelonPrototype?.metrics?.samples>=600,null,{timeout:300000});
  const result=await page.evaluate(()=>{const r={...window.__echelonPrototype};delete r.manifest;delete r.refreshWaterOptics;return r});results.push({label,...result,errors});
  if(label==='after-a'){
 await page.screenshot({path:fileURLToPath(new URL('after.png',import.meta.url))});
 await page.screenshot({path:fileURLToPath(new URL('middle.png',import.meta.url)),clip:{x:0,y:680,width:2560,height:380}});
}
  console.log(label,JSON.stringify(result.metrics));await page.close();
 }
 await writeFile(new URL('benchmark.json',import.meta.url),JSON.stringify(results,null,2));
 const before=(await readFile(new URL('before.png',import.meta.url))).toString('base64'),after=(await readFile(new URL('after.png',import.meta.url))).toString('base64');
 const p=await browser.newPage({viewport:{width:2560,height:760},deviceScaleFactor:1});
 await p.setContent(`<body style="margin:0;background:#172026;color:white;font:20px sans-serif"><div style="display:flex"><div style="width:50%"><p style="margin:12px">Before — prior habitat pass</p><img style="width:100%" src="data:image/png;base64,${before}"></div><div style="width:50%"><p style="margin:12px">After — clearer meadow</p><img style="width:100%" src="data:image/png;base64,${after}"></div></div></body>`);
 await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 await p.screenshot({path:fileURLToPath(new URL('before-after.png',import.meta.url))});
 await p.setViewportSize({width:2560,height:360});
 await p.setContent('<body style="margin:0;background:#172026;color:white;font:20px sans-serif"><div style="display:flex">'+[ ['Before', ''], ['After', ''] ].map((x,i)=>'<div style="width:50%;position:relative;height:360px;overflow:hidden"><span style="position:absolute;z-index:2;background:#172026;padding:6px">'+x[0]+'</span><img style="position:absolute;width:2560px;left:0;top:-650px" src="data:image/png;base64,'+[before,after][i]+'"></div>').join('')+'</div></body>');
 await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 await p.screenshot({path:fileURLToPath(new URL('coverage-comparison.png',import.meta.url))});
 const diff=await p.evaluate(()=>{const imgs=[...document.images];const cs=imgs.map(i=>{const c=document.createElement('canvas');c.width=2560;c.height=1440;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return ctx.getImageData(0,0,2560,1440).data});const out={};for(const [name,x,y,w,h] of [['foreground',80,1050,1000,350],['sky',0,0,2560,400],['hamlet',1450,650,700,180]]){let sum=0,n=0;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)for(let k=0;k<3;k++){sum+=Math.abs(cs[0][(j*2560+i)*4+k]-cs[1][(j*2560+i)*4+k]);n++;}out[name]=sum/n;}return out;});
 await writeFile(new URL('pixel-comparison.json',import.meta.url),JSON.stringify(diff,null,2));console.log('pixel-difference',diff);
}finally{await browser.close();}

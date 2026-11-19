// Exports the new valley's hamlet (glb, with its textures) and its layout (river, lake, paths) for the Blender composition: node exportvalley.mjs
import { chromium } from '../browser-tools/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const OUT = 'D:/Projects/Echelon/design-reference/environment/valley-composition-01/';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try { const page = await browser.newPage({ viewport: { width: 800, height: 400 } }); page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
  await page.goto('http://127.0.0.1:4197/valley-blockout.html?tod=noon&overlay=0&grass=0'); await page.waitForFunction(() => window.__blockout?.frames >= 2, null, { timeout: 180000 });
  const res = await page.evaluate(async () => {
    
    const v = window.__valley; const hamlet = window.__scene.getObjectByName('export:hamlet');
    const glb = await window.__exportGLB(hamlet);
    let bin = ''; const u8 = new Uint8Array(glb); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    const ry = v.river.map(([x, z]) => v.heightAt(x, z, true));
    return { glb: btoa(bin), layout: { lake: v.LAKE, upper: v.UPPER, lower: v.LOWER, river: v.river, riverGround: ry, track: v.track, footpath: v.footpath } };
  });
  writeFileSync(OUT + 'valley-hamlet.glb', Buffer.from(res.glb, 'base64')); writeFileSync(OUT + 'valley-layout.json', JSON.stringify(res.layout)); console.log('ok', res.layout.river.length, Buffer.from(res.glb, 'base64').length);
} finally { await browser.close(); }

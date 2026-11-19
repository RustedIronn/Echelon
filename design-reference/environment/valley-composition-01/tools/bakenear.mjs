// Bakes the new valley's near ground (heights relative to the lake surface) on a regular grid in the valley's own metres: node bakenear.mjs
import { chromium } from '../browser-tools/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try { const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
  await page.goto('http://127.0.0.1:4197/valley-blockout.html?tod=noon&overlay=0&grass=0&trees=cones'); await page.waitForFunction(() => window.__blockout?.frames >= 2, null, { timeout: 180000 });
  const res = await page.evaluate(() => { const v = window.__valley; const minX = -500, maxX = 500, minZ = -900, maxZ = 60, cell = 2; const w = Math.ceil((maxX - minX) / cell), h = Math.ceil((maxZ - minZ) / cell); const a = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) a[j * w + i] = v.heightAt(minX + i * cell, minZ + j * cell, true);
    let bin = ''; const u8 = new Uint8Array(a.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { meta: { minX, maxX, minZ, maxZ, cell, w, h }, b64: btoa(bin) }; });
  const dir = new URL('../../../../public/assets/environment/alpine-prototype/', import.meta.url);
  writeFileSync(new URL('near-heights.bin', dir), Buffer.from(res.b64, 'base64')); writeFileSync(new URL('near-heights.json', dir), JSON.stringify(res.meta)); console.log(JSON.stringify(res.meta));
} finally { await browser.close(); }

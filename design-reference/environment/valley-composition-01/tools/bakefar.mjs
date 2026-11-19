// Bakes the new valley's far terrain (a polar grid of heights round the valley's camera) for the old scene: node bakefar.mjs
import { chromium } from '../browser-tools/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try { const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
  await page.goto('http://127.0.0.1:4197/valley-blockout.html?tod=noon&overlay=0&grass=0&trees=cones'); await page.waitForFunction(() => window.__blockout?.frames >= 2, null, { timeout: 180000 });
  const res = await page.evaluate(() => { const v = window.__valley; const NA = 601, NR = 380, a0 = -70, a1 = 70, r0 = 480, r1 = 14500; const h = new Float32Array(NA * NR);
    for (let j = 0; j < NR; j++) { const r = r0 * (r1 / r0) ** (j / (NR - 1)); for (let i = 0; i < NA; i++) { const a = (a0 + (a1 - a0) * i / (NA - 1)) * Math.PI / 180; h[j * NA + i] = v.heightAt(Math.sin(a) * r, -Math.cos(a) * r, true); } }
    let bin = ''; const u8 = new Uint8Array(h.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    let max = 0; for (const x of h) max = Math.max(max, x); return { meta: { na: NA, nr: NR, a0, a1, r0, r1, max }, b64: btoa(bin) }; });
  const dir = new URL('../../../../public/assets/environment/alpine-prototype/', import.meta.url);
  writeFileSync(new URL(process.env.OUT_BIN ?? 'far-terrain.bin', dir), Buffer.from(res.b64, 'base64')); writeFileSync(new URL(process.env.OUT_JSON ?? 'far-terrain.json', dir), JSON.stringify(res.meta)); console.log(JSON.stringify(res.meta));
} finally { await browser.close(); }

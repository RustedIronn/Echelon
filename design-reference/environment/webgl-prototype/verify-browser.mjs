import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const baseUrl = process.env.ECHELON_PREVIEW_URL || 'http://127.0.0.1:4174';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const cases = [
  { name: 'baseline-physical', query: 'look=baseline&water=physical' },
  { name: 'baseline-alpha', query: 'look=baseline&water=alpha' },
  { name: 'parity-physical', query: 'water=physical' },
  { name: 'parity-alpha', query: 'water=alpha' },
  { name: 'parity-fresnel', query: 'water=fresnel' },
  { name: 'parity-no-surface-detail', query: 'water=fresnel&detail=0' },
  { name: 'parity-high-dpr', query: 'water=fresnel&dpr=1.5' },
];
const results = [];
for (const item of cases) {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const started = performance.now();
  try {
    await page.goto(`${baseUrl}/landscape-preview.html?capture=1&benchmark=1&${item.query}`);
    await page.waitForFunction(() => window.__echelonPrototype?.ready, { timeout: 120000 });
    const readyMilliseconds = performance.now() - started;
    await page.waitForFunction(() => window.__echelonPrototype?.metrics?.samples >= 600, { timeout: 180000 });
    const data = await page.evaluate(() => {
      const { manifest, ...stats } = window.__echelonPrototype;
      return { ...stats, requests: performance.getEntriesByType('resource').filter((r) => r.name.includes('/assets/environment/alpine-prototype/')).map((r) => ({ name: r.name.split('/').pop(), duration: r.duration, transferSize: r.transferSize, decodedBodySize: r.decodedBodySize })) };
    });
    await page.screenshot({ path: fileURLToPath(new URL(`${item.name}.png`, root)) });
    if (item.name === 'parity-fresnel') {
      for (const [name, clip] of [
        ['parity-water-detail', { x: 1550, y: 1030, width: 950, height: 400 }],
        ['parity-foreground-detail', { x: 100, y: 970, width: 1000, height: 450 }],
        ['parity-mountain-detail', { x: 200, y: 450, width: 2000, height: 300 }],
      ]) await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, root)), clip });
    }
    results.push({ ...item, readyMilliseconds, data, errors });
    console.log(item.name, JSON.stringify({ renderer: data.renderer, metrics: data.metrics, errors }));
  } catch (error) {
    results.push({ ...item, failure: error.message, errors });
    await page.screenshot({ path: fileURLToPath(new URL(`${item.name}-failure.png`, root)) });
    console.log('FAILURE', item.name, error.message, errors);
  }
  await page.close();
  await writeFile(new URL('parity-browser-results.json', root), JSON.stringify(results, null, 2));
}
const idle = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await idle.goto(`${baseUrl}/landscape-preview.html?capture=1`);
await idle.waitForFunction(() => window.__echelonPrototype?.ready, { timeout: 120000 });
await idle.waitForTimeout(1500);
const before = await idle.evaluate(() => window.__echelonPrototype.totalFrames);
await idle.waitForTimeout(1500);
const after = await idle.evaluate(() => window.__echelonPrototype.totalFrames);
await writeFile(new URL('idle-render-check.json', root), JSON.stringify({ before, after, observationMilliseconds: 1500, stoppedRenderingWhenStatic: Number.isFinite(before) && Number.isFinite(after) && before === after }, null, 2));
await idle.screenshot({ path: fileURLToPath(new URL('parity-idle-hero.png', root)) });
await idle.close();
const comparison = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await comparison.goto(`${baseUrl}/landscape-preview.html?capture=1&compare=1&benchmark=1`);
await comparison.waitForFunction(() => window.__echelonPrototype?.metrics?.samples >= 30, { timeout: 120000 });
await comparison.screenshot({ path: fileURLToPath(new URL('parity-blender-comparison.png', root)) });
await comparison.close();
await browser.close();

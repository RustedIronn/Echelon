// GPU A/B/B/A for the meadow detail pass: same method as verify-reflection.mjs (2560x1440 DPR1, 4x MSAA, 60 warm-up frames, 600 samples, disjoint-checked timer queries).
import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const base = process.env.ECHELON_PREVIEW_URL || 'http://127.0.0.1:4174';
const cases = [['previous', 'meadow=previous'], ['detailed', ''], ['detailed-repeat', ''], ['previous-repeat', 'meadow=previous']];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] }); const results = [];
try {
  for (const [name, query] of cases) {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } }); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/landscape-preview.html?capture=1&benchmark=1&${query}`);
    await page.waitForFunction(() => window.__echelonPrototype?.metrics?.samples >= 600, null, { timeout: 300000 });
    const stats = await page.evaluate(() => { const rest = { ...window.__echelonPrototype }; delete rest.manifest; delete rest.refreshWaterOptics; return rest; });
    results.push({ name, query, gpuP50: stats.metrics.gpuP50ms, gpuP95: stats.metrics.gpuP95ms, rafP50: stats.metrics.rafP50ms, draws: stats.metrics.callsAllPasses, triangles: stats.metrics.trianglesAllPasses, errors });
    console.log(name, JSON.stringify(results[results.length - 1])); await page.close();
  }
  await writeFile(new URL('meadow-benchmark.json', import.meta.url), JSON.stringify(results, null, 2));
} finally { await browser.close(); }

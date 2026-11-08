// GPU A/B/C/C/B/A across the three meadow modes at 4x MSAA (same method as verify-meadow.mjs).
import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
const base = process.env.ECHELON_PREVIEW_URL || 'http://127.0.0.1:4174';
const cases = [['previous', 'msaa=4&meadow=previous'], ['cards', 'msaa=4&meadow=cards'], ['blades', 'msaa=4'], ['blades repeat', 'msaa=4'], ['cards repeat', 'msaa=4&meadow=cards'], ['previous repeat', 'msaa=4&meadow=previous']];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try {
  for (const [name, query] of cases) {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    await page.goto(`${base}/landscape-preview.html?capture=1&benchmark=1&${query}`);
    await page.waitForFunction(() => window.__echelonPrototype?.metrics?.samples >= 500, null, { timeout: 420000 });
    const m = await page.evaluate(() => window.__echelonPrototype.metrics);
    console.log(name.padEnd(16), 'gpu p50', m.gpuP50ms?.toFixed(2), 'p95', m.gpuP95ms?.toFixed(2), '| draws', m.callsAllPasses, '| triangles', (m.trianglesAllPasses / 1e6).toFixed(2) + 'M');
    await page.close();
  }
} finally { await browser.close(); }

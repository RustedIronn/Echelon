// GPU cost of rendering at a higher internal resolution (same method as verify-meadow.mjs; the viewport stays 2560x1440, dpr scales the drawing buffer).
import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
const base = process.env.ECHELON_PREVIEW_URL || 'http://127.0.0.1:4174';
const cases = [['dpr 1', 'dpr=1'], ['dpr 1.5', 'dpr=1.5'], ['dpr 2', 'dpr=2'], ['dpr 1 repeat', 'dpr=1']];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try {
  for (const [name, query] of cases) {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    await page.goto(`${base}/landscape-preview.html?capture=1&benchmark=1&${query}`);
    await page.waitForFunction(() => window.__echelonPrototype?.metrics?.samples >= 400, null, { timeout: 420000 });
    const m = await page.evaluate(() => window.__echelonPrototype.metrics);
    console.log(name.padEnd(14), 'buffer', (m.drawingBuffer || []).join('x'), 'gpu p50', m.gpuP50ms?.toFixed(2), 'p95', m.gpuP95ms?.toFixed(2), 'raf p50', m.rafP50ms?.toFixed(1));
    await page.close();
  }
} finally { await browser.close(); }

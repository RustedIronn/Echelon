// GPU benchmark for the strip-normal / linear-resolve / flower-filter pass, on the production preview build.
// Same method as verify-corridor.mjs: 2560x1440 DPR1, 4x MSAA, 60 warm-up frames, 600 RAF samples, disjoint-checked GPU timer queries,
// A/B/C/C/B/A ordering. 'previous' is the renderer exactly as it was before this pass (pass=previous).
import { chromium } from './browser-tools/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.ECHELON_PREVIEW_URL || 'http://127.0.0.1:4174';
const cases = [['previous', 'pass=previous'], ['now', ''], ['now-dpr1.5', 'dpr=1.5'], ['now-dpr2', 'dpr=2'], ['now-repeat', ''], ['previous-repeat', 'pass=previous']];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const results = [];
try {
  for (const [name, query] of cases) {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } }); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}/landscape-preview.html?capture=1&benchmark=1&${query}`);
    await page.waitForFunction(() => window.__echelonPrototype?.metrics?.samples >= 600, null, { timeout: 240000 });
    const stats = await page.evaluate(() => { const rest = { ...window.__echelonPrototype }; delete rest.manifest; delete rest.refreshWaterOptics; return rest; });
    assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(stats.inventory.trees.length, 2);
    let warm; if (name.startsWith('refined') || name.startsWith('approved')) { await page.evaluate(() => window.__echelonPrototype.refreshWaterOptics()); await page.waitForFunction(() => window.__echelonPrototype?.waterBed?.captures === 2 && Number.isFinite(window.__echelonPrototype.waterBed.gpuMilliseconds) && Number.isFinite(window.__echelonPrototype.reflection.gpuMilliseconds), null, { timeout: 120000 }); warm = await page.evaluate(() => ({ reflection: window.__echelonPrototype.reflection, waterBed: window.__echelonPrototype.waterBed })); }
    results.push({ name, query, ...stats, warm, errors });
    console.log(name, JSON.stringify({ gpuP50: stats.metrics.gpuP50ms, gpuP95: stats.metrics.gpuP95ms, rafP50: stats.metrics.rafP50ms, cpuSubmitP50: stats.metrics.cpuSubmitP50ms, draws: stats.metrics.callsAllPasses, triangles: stats.metrics.trianglesAllPasses, textures: stats.metrics.textureResources, programs: stats.metrics.programs, grass: stats.inventory.grass, warm: warm && { reflectionMs: warm.reflection.gpuMilliseconds, reflectionDraws: warm.reflection.calls, reflectionTriangles: warm.reflection.triangles, bedMs: warm.waterBed.gpuMilliseconds }, errors }));
    await page.close();
    await writeFile(new URL('pass5-browser-results.json', import.meta.url), JSON.stringify(results, null, 2));
  }
  // static demand rendering must still settle and stop for the default and the linear path
  for (const [label, query] of [['default', ''], ['linear', 'resolve=linear']]) {
    const idle = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    await idle.goto(`${base}/landscape-preview.html?capture=1&${query}`); await idle.waitForFunction(() => window.__echelonPrototype?.waterBed?.captures === 1, null, { timeout: 120000 });
    await idle.waitForTimeout(1500); const a = await idle.evaluate(() => window.__echelonPrototype.totalFrames); await idle.waitForTimeout(1500); const b = await idle.evaluate(() => window.__echelonPrototype.totalFrames);
    console.log('idle', label, JSON.stringify({ before: a, after: b, stoppedRenderingWhenStatic: a === b })); assert.equal(a, b); await idle.close();
  }
} finally { await browser.close(); }

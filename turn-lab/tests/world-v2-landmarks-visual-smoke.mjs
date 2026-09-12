import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('world-v2-landmarks-visual-artifact');
await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));

try {
  await page.goto('http://127.0.0.1:8000/turn-lab/world-v2-landmarks-visual.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => globalThis.__turnWorldV2LandmarkVisual?.ready === true, null, { timeout: 20000 });
  const state = await page.evaluate(() => ({
    length: globalThis.__turnWorldV2LandmarkVisual.approximateLength,
    revision: globalThis.__turnWorldV2LandmarkVisual.revision,
    classicAssetsReady: globalThis.__turnWorldV2LandmarkVisual.classicAssetsReady
  }));
  assert.equal(state.revision, 'r216-macro-landmarks');
  assert.ok(state.length > 5600, `World V2 should keep the long map-scale loop, got ${state.length}`);

  const views = ['overview', 'harbor', 'cliffside', 'mountain', 'countryside', 'airport', 'city', 'crossworld'];
  for (const view of views) {
    assert.equal(await page.evaluate((name) => globalThis.__turnWorldV2LandmarkVisual.setView(name), view), true);
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(outputDir, `${view}.png`), fullPage: false });
  }

  const files = await fs.readdir(outputDir);
  assert.equal(files.length, views.length);
  const sizes = await Promise.all(files.map(async (name) => (await fs.stat(path.join(outputDir, name))).size));
  assert.ok(sizes.every((size) => size > 25_000), 'Every macro-landmark inspection frame should contain rendered scene detail');
  assert.deepEqual(consoleErrors, [], `World V2 macro landmark page should render without console errors:\n${consoleErrors.join('\n')}`);
  console.log(`TURN World V2 macro landmark visual smoke passed: ${state.length.toFixed(0)} units, ${views.length} views, classic assets ${state.classicAssetsReady ? 'ready' : 'fallback-safe'}.`);
} finally {
  await browser.close();
}

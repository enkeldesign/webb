import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('world-v2-environment-r2-visual-artifact');
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
  await page.goto('http://127.0.0.1:8000/turn-lab/world-v2-environment-r2-visual.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => globalThis.__turnWorldV2Visual?.ready === true, null, { timeout: 15000 });
  const state = await page.evaluate(() => ({
    length: globalThis.__turnWorldV2Visual.approximateLength,
    revision: globalThis.__turnWorldV2Visual.revision
  }));
  assert.equal(state.revision, 'r2-grounded-terrain');
  assert.ok(state.length > 5600, `World V2 r2 should keep the long map-scale loop, got ${state.length}`);

  const views = ['overview', 'coast', 'cliffroad', 'mountain', 'summitroad', 'east', 'city', 'harborroad'];
  for (const view of views) {
    assert.equal(await page.evaluate((name) => globalThis.__turnWorldV2Visual.setView(name), view), true);
    await page.waitForTimeout(160);
    await page.screenshot({ path: path.join(outputDir, `${view}.png`), fullPage: false });
  }

  const files = await fs.readdir(outputDir);
  assert.equal(files.length, views.length);
  const sizes = await Promise.all(files.map(async (name) => (await fs.stat(path.join(outputDir, name))).size));
  assert.ok(sizes.every((size) => size > 25_000), 'Every r2 environment inspection frame should contain rendered scene detail');
  assert.deepEqual(consoleErrors, [], `World V2 r2 visual page should render without console errors:\n${consoleErrors.join('\n')}`);
  console.log(`TURN World V2 r2 visual smoke passed: ${state.length.toFixed(0)} units, ${views.length} inspection views.`);
} finally {
  await browser.close();
}

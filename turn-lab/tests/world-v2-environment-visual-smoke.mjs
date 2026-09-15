import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('world-v2-environment-visual-artifact');
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
  await page.goto('http://127.0.0.1:8000/turn-lab/world-v2-environment-visual.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => globalThis.__turnWorldV2Visual?.ready === true, null, { timeout: 15000 });
  const approximateLength = await page.evaluate(() => globalThis.__turnWorldV2Visual.approximateLength);
  assert.ok(approximateLength > 5600, `Visual scene should contain the long World V2 loop, got ${approximateLength}`);

  for (const view of ['overview', 'coast', 'mountain', 'east', 'city', 'road']) {
    const changed = await page.evaluate((name) => globalThis.__turnWorldV2Visual.setView(name), view);
    assert.equal(changed, true);
    await page.waitForTimeout(120);
    await page.screenshot({
      path: path.join(outputDir, `${view}.png`),
      fullPage: false
    });
  }

  const sizes = await Promise.all((await fs.readdir(outputDir)).map(async (name) => (await fs.stat(path.join(outputDir, name))).size));
  assert.equal(sizes.length, 6);
  assert.ok(sizes.every((size) => size > 25_000), 'Every environment inspection frame should contain rendered scene detail');
  assert.deepEqual(consoleErrors, [], `World V2 visual page should render without console errors:\n${consoleErrors.join('\n')}`);
  console.log(`TURN World V2 visual smoke passed: ${approximateLength.toFixed(0)} units, six inspection views.`);
} finally {
  await browser.close();
}

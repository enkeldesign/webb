import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'supercar-lot-visual-artifact';
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce'
});
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  const value = message.text();
  if (message.type() === 'error' || /selected car could not load/i.test(value)) {
    browserErrors.push(`console ${message.type()}: ${value}`);
  }
});

let visualFailure = null;
let metrics = null;
let factoryPixels = 0;
let customPixels = 0;
let factoryBrightNeutralPixels = 0;
let whiteBodyPixels = 0;
try {
  const response = await page.goto(`${baseUrl}/turn-lab/supercar-lot-visual.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  });
  assert.equal(response?.ok(), true, 'Supercar Lot visual page must load successfully');
  await page.waitForFunction(
    () => globalThis.__supercarLotVisualReady === true || Boolean(globalThis.__supercarLotVisualFailure),
    null,
    { timeout: 70_000 }
  );
  visualFailure = await page.evaluate(() => globalThis.__supercarLotVisualFailure || null);
  assert.equal(visualFailure, null, `Supercar Lot visual bootstrap failed: ${visualFailure}`);
  metrics = await page.evaluate(() => globalThis.__supercarLotVisualMetrics);

  const canvas = page.locator('.lot-view-host canvas');
  const factory = await canvas.screenshot({ path: path.join(outputDir, 'factory-yellow-rims.png') });
  factoryPixels = countPixels(factory, ({ r, g, b }) => r > 135 && g > 85 && b < 95);
  factoryBrightNeutralPixels = countPixels(factory, brightNeutralPixel);

  const rimInput = page.getByLabel('Rims colour');
  await rimInput.fill('#ff00ff');
  await page.waitForTimeout(250);
  const custom = await canvas.screenshot({ path: path.join(outputDir, 'custom-magenta-rims.png') });
  customPixels = countPixels(custom, ({ r, g, b }) => r > 125 && g < 105 && b > 115);

  await rimInput.fill('#ffbb00');
  const bodyInput = page.getByLabel('Body colour');
  await bodyInput.fill('#ffffff');
  await page.waitForTimeout(250);
  const whiteBody = await canvas.screenshot({ path: path.join(outputDir, 'custom-white-body.png') });
  whiteBodyPixels = countPixels(whiteBody, brightNeutralPixel);

  await page.screenshot({ path: path.join(outputDir, 'lot-preview.png'), fullPage: true });
} catch (error) {
  visualFailure = String(error?.stack || error?.message || error);
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  `${JSON.stringify({
    metrics,
    factoryPixels,
    customPixels,
    factoryBrightNeutralPixels,
    whiteBodyPixels,
    browserErrors,
    visualFailure
  }, null, 2)}\n`
);

if (visualFailure) throw new Error(visualFailure);
assert.equal(metrics?.selected, 'Supercar');
assert.equal(metrics?.bodyColor, '#000000');
assert.equal(metrics?.rimColor, '#ffbb00');
assert.ok(metrics.canvasWidth >= 400 && metrics.canvasHeight >= 200,
  'The test must inspect the real large Lot canvas rather than a static thumbnail');
assert.equal(browserErrors.length, 0,
  `Browser-rendered Supercar Lot produced errors:\n${browserErrors.join('\n')}`);
assert.ok(factoryPixels >= 20,
  `Factory Lot preview must expose visible TURN-yellow pixels, found ${factoryPixels}`);
assert.ok(customPixels >= 20,
  `Changing the actual Rims picker must expose visible magenta rim pixels, found ${customPixels}`);
assert.ok(
  whiteBodyPixels >= factoryBrightNeutralPixels + 500,
  `Changing the actual Body picker to white must visibly brighten the Supercar lacquer; `
    + `factory had ${factoryBrightNeutralPixels} bright neutral pixels and white had ${whiteBodyPixels}`
);

console.log('TURN Supercar Kenney rims and direct TURN-like body paint passed in the actual Lot 3D preview.');

function brightNeutralPixel({ r, g, b }) {
  return r > 175 && g > 175 && b > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 24;
}

function countPixels(buffer, predicate) {
  const image = PNG.sync.read(buffer);
  let count = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] === 0) continue;
    if (predicate({
      r: image.data[offset],
      g: image.data[offset + 1],
      b: image.data[offset + 2]
    })) count += 1;
  }
  return count;
}

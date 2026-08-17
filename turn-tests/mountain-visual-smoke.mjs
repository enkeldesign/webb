import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'mountain-visual-artifact';
const views = ['aerial', 'village', 'summit', 'descent', 'waterfall'];
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  const text = message.text();
  if (message.type() === 'error' || /failed to load|mountain .* failed/i.test(text)) {
    browserErrors.push(`console ${message.type()}: ${text}`);
  }
});

let canonicalMetrics = null;
try {
  for (const view of views) {
    const url = `${baseUrl}/turn-lab/mountain-visual.html?view=${encodeURIComponent(view)}`;
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    assert.equal(response?.ok(), true, `${view} visual page must load successfully`);
    await page.waitForFunction(() => globalThis.__mountainVisualReady === true, null, { timeout: 60_000 });
    const metrics = await page.evaluate(() => globalThis.__mountainVisualMetrics);
    assert.ok(metrics, `${view} must expose MOUNTAIN visual metrics`);
    canonicalMetrics ||= metrics;
    await page.screenshot({ path: path.join(outputDir, `${view}.png`), fullPage: true });
  }
} finally {
  await browser.close();
}

assert.equal(browserErrors.length, 0, `Browser-rendered MOUNTAIN produced errors:\n${browserErrors.join('\n')}`);
const metrics = canonicalMetrics;
assert.equal(metrics.assetsReady, true, 'MOUNTAIN Kenney/Nature assets must finish loading before visual capture');
assert.deepEqual(metrics.assetErrors, [], 'MOUNTAIN asset loaders must not hide failed GLBs/textures');
assert.ok(metrics.terrainBodies >= 1, 'MOUNTAIN needs a continuous terrain body beneath the road');
assert.ok(metrics.roadbedWalls >= 2, 'Both road edges need opaque roadbed side walls');
assert.ok(metrics.roadbedUndersides >= 1, 'The elevated road must have a closed underside');
assert.equal(metrics.windmills, 0, 'A loose Fantasy Town windmill rotor must not return');
assert.ok(metrics.cabins >= 3, `Expected at least 3 grounded Holiday cabin prefabs, got ${metrics.cabins}`);
assert.ok(metrics.marketStalls >= 2, `Expected two Fantasy Town market stalls, got ${metrics.marketStalls}`);
assert.ok(metrics.fountains >= 1, 'The village needs a complete Fantasy Town fountain landmark');
assert.ok(metrics.waterfallCliffModules >= 6, 'The waterfall should use multiple modest Kenney Nature cliff modules');
assert.ok(metrics.waterfallSheets >= 3, 'The river must visibly continue over the cliff to the lake');
assert.ok(metrics.lakes >= 1, 'The waterfall needs a terrain-bounded lake');
assert.ok(metrics.maximumRoadSupportGap <= 0.56,
  `Analytic terrain support under road is too far away: ${metrics.maximumRoadSupportGap.toFixed(2)} m`);
assert.ok(metrics.maximumEdgeSupportGap <= 0.62,
  `Analytic terrain support beneath road edge is too far away: ${metrics.maximumEdgeSupportGap.toFixed(2)} m`);
assert.ok(metrics.maximumRenderedRoadSupportGap <= 4.5,
  `Rendered terrain has a large road-support hole: ${metrics.maximumRenderedRoadSupportGap.toFixed(2)} m`);
assert.ok(metrics.maximumRenderedEdgeSupportGap <= 4.5,
  `Rendered terrain has a large edge-support hole: ${metrics.maximumRenderedEdgeSupportGap.toFixed(2)} m`);
assert.ok(metrics.riverDepthMin >= 0.60,
  `River channel is too shallow/floating against its bed: ${metrics.riverDepthMin.toFixed(2)} m`);
assert.ok(metrics.riverDepthMax <= 2.25,
  `River water is too far above its terrain channel: ${metrics.riverDepthMax.toFixed(2)} m`);
assert.ok(metrics.groundingCount >= 12, 'Imported assets should be grounded through the shared Box3 pipeline');
assert.ok(metrics.maxGroundingDelta <= 0.36,
  `An imported asset is floating or excessively buried: ${metrics.maxGroundingDelta.toFixed(2)} m`);

await fs.writeFile(path.join(outputDir, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
console.log('TURN MOUNTAIN browser visual smoke passed:', JSON.stringify(metrics));

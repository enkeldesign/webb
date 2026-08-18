import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'mountain-visual-artifact';
const views = ['aerial', 'village', 'summit', 'descent', 'waterfall', 'waterfall-road'];
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

const metrics = canonicalMetrics;
await fs.writeFile(path.join(outputDir, 'metrics.json'), `${JSON.stringify({ metrics, browserErrors }, null, 2)}\n`);

assert.equal(browserErrors.length, 0, `Browser-rendered MOUNTAIN produced errors:\n${browserErrors.join('\n')}`);
assert.equal(metrics.assetsReady, true, 'MOUNTAIN Kenney/Nature assets must finish loading before visual capture');
assert.deepEqual(metrics.assetErrors, [], 'MOUNTAIN r3 asset loaders must not hide failed GLBs/textures');
assert.deepEqual(metrics.r4AssetErrors, [], 'MOUNTAIN r4 village polish assets must load without hidden failures');
assert.deepEqual(metrics.r5AssetErrors, [], 'MOUNTAIN r5 Suburban houses and recolored palette must load without hidden failures');
assert.ok(metrics.terrainBodies >= 1, 'MOUNTAIN needs a continuous terrain body beneath the road');
assert.ok(metrics.roadbedWalls >= 2, 'Both road edges need opaque roadbed side walls');
assert.ok(metrics.deepFoundations >= 2, 'Both road edges need deep retaining foundations for close stacked hairpins');
assert.ok(metrics.roadbedUndersides >= 1, 'The elevated road must have a closed underside');
assert.equal(metrics.windmills, 0, 'A loose Fantasy Town windmill rotor must not return');

assert.equal(metrics.assembledCabins, 0,
  'The final MOUNTAIN village must not expose hand-assembled Holiday cabins');
assert.ok(metrics.suburbanHouses >= 8,
  `Expected a substantial village of complete Kenney City Kit Suburban houses, got ${metrics.suburbanHouses}`);
assert.equal(metrics.suburbanHouses, metrics.r5SuburbanReported,
  'Visual scene count and r5 Suburban placement diagnostics must agree');
assert.deepEqual(metrics.r5RequestedTypes, ['a', 'g', 'm', 'n', 'u'],
  'MOUNTAIN must use the requested A/G/M/N/U City Kit Suburban variants');
assert.equal(metrics.r5PaletteMode, 'mountain-brown-snow',
  'Suburban houses should use the MOUNTAIN dark-brown wall / snow-white roof palette');
assert.ok(metrics.r5RemovedCabins >= 1,
  'The Suburban pass must actively remove the old assembled cabin layer');
assert.equal(metrics.fountains, 0, 'The oversized fountain must be removed from the finished village');
assert.ok(metrics.winterMarketAssets >= 5,
  `The fountain replacement should read as a winter market square, got ${metrics.winterMarketAssets} assets`);
assert.ok(metrics.litStreetlights >= 7,
  `The village needs a visible run of grounded Holiday streetlights, got ${metrics.litStreetlights}`);
assert.equal(metrics.litStreetlights, metrics.r4StreetlightsReported,
  'Visual scene count and r4 streetlight diagnostics must agree');
assert.ok(metrics.warmLanternHalos >= 7,
  `Streetlights need warm static glow markers, got ${metrics.warmLanternHalos}`);
assert.ok(metrics.distantLayeredRidges >= 8,
  `The horizon should have a second layer of integrated-snow mountains, got ${metrics.distantLayeredRidges}`);
assert.ok(metrics.decorativeVillageAssets >= 8,
  'Village approaches need benches, carts, fences, sleds and authored Holiday trees');

assert.ok(metrics.marketStalls >= 2, `Expected the original village market stalls to remain, got ${metrics.marketStalls}`);
assert.ok(metrics.waterfallCliffModules >= 4, 'The waterfall should retain four outer Kenney Nature cliff shoulders after opening the driver sightline');
assert.ok(metrics.waterfallSheets >= 3, 'The river must continue over the cliff toward the lake');
assert.ok(metrics.visibleWaterfallCurtains >= 3, 'The waterfall needs the established r3 curtain in front of the cliff mass');
assert.ok(metrics.trackVisibleWaterfallCurtains >= 1,
  'The waterfall must now have an explicitly track-facing visible curtain');
assert.ok(metrics.waterfallSpillways >= 1, 'The river must connect physically to the waterfall curtain');
assert.ok(metrics.lakes >= 1, 'The waterfall needs a terrain-bounded lake');

assert.ok(metrics.maximumRoadSupportGap <= 0.56,
  `Analytic terrain support under road centre is too far away: ${metrics.maximumRoadSupportGap.toFixed(2)} m`);
assert.ok(metrics.roadFoundationDepth >= metrics.maximumEdgeSupportGap + 0.5,
  `Road edge can out-drop its retaining foundation: gap ${metrics.maximumEdgeSupportGap.toFixed(2)} m, foundation ${metrics.roadFoundationDepth.toFixed(2)} m`);
assert.ok(metrics.maximumRenderedRoadSupportGap <= metrics.roadFoundationDepth + 0.7,
  `Rendered terrain has a road-support gap deeper than the retaining foundation: ${metrics.maximumRenderedRoadSupportGap.toFixed(2)} m`);
assert.ok(metrics.maximumRenderedEdgeSupportGap <= metrics.roadFoundationDepth + 0.7,
  `Rendered terrain has an edge-support gap deeper than the retaining foundation: ${metrics.maximumRenderedEdgeSupportGap.toFixed(2)} m`);
assert.ok(metrics.riverDepthMin >= 0.60,
  `River channel is too shallow/floating against its bed: ${metrics.riverDepthMin.toFixed(2)} m`);
assert.ok(metrics.riverDepthMax <= 2.25,
  `River water is too far above its terrain channel: ${metrics.riverDepthMax.toFixed(2)} m`);
assert.ok(metrics.groundingCount >= 20, 'Imported village assets should remain grounded through the shared Box3 pipeline');
assert.ok(metrics.maxGroundingDelta <= 0.36,
  `An imported asset is floating or excessively buried: ${metrics.maxGroundingDelta.toFixed(2)} m`);

console.log('TURN MOUNTAIN browser visual smoke passed:', JSON.stringify(metrics));
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'mountain-long-visual-artifact';
const views = [
  'aerial',
  'summit',
  'bridge',
  'east-tunnel',
  'lower-village',
  'lower-tunnel',
  'forest',
  'final-climb'
];
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
let context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const visualPage = await context.newPage();
const browserErrors = [];

function collectErrors(page, label) {
  page.on('pageerror', (error) => browserErrors.push(`${label} pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /failed to load|mountain .* failed/i.test(text)) {
      browserErrors.push(`${label} console ${message.type()}: ${text}`);
    }
  });
}

collectErrors(visualPage, 'visual');
let metrics;
let runtimeMetrics;
try {
  const response = await visualPage.goto(`${baseUrl}/turn-lab/mountain-long-visual.html`, {
    waitUntil: 'networkidle',
    timeout: 90_000
  });
  assert.equal(response?.ok(), true, 'Long-course visual page must load successfully');
  await visualPage.waitForFunction(() => globalThis.__mountainLongVisualReady === true, null, { timeout: 90_000 });
  metrics = await visualPage.evaluate(() => globalThis.__mountainLongVisualMetrics);
  for (const view of views) {
    await visualPage.evaluate((name) => globalThis.__mountainLongSetView(name), view);
    await visualPage.waitForTimeout(120);
    await visualPage.screenshot({ path: path.join(outputDir, `${view}.png`), fullPage: true });
  }

  await visualPage.close();
  await context.close();

  // The real TURN LAB shell proves that the two import maps compose and that
  // production registry imports resolve to the MOUNTAIN-only LAB overlays.
  // Use a fresh browser context and turn audio/DBE off in this geometry smoke.
  // Current production's optional audio capture can otherwise select a music
  // AudioContext in headless Chromium; audio has its own production regressions
  // and is intentionally outside this MOUNTAIN rendering check.
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const runtimePage = await context.newPage();
  collectErrors(runtimePage, 'runtime');
  const runtimeResponse = await runtimePage.goto(`${baseUrl}/turn-lab/?visual-smoke=mountain-long`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  });
  assert.equal(runtimeResponse?.ok(), true, 'TURN LAB runtime shell must load successfully');
  await runtimePage.evaluate(() => {
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-drive-by-ear-v1', 'off');
  });
  await runtimePage.getByRole('button', { name: 'Play in browser anyway' }).click();
  await runtimePage.waitForFunction(
    () => Boolean(globalThis.__turnRuntime && globalThis.__turnChooseTrack),
    null,
    { timeout: 90_000 }
  );
  await runtimePage.waitForFunction(
    () => document.querySelector('.m8-home .track-card[data-track-id="mountain"]')
      ?.dataset?.trophyLocked === 'false',
    null,
    { timeout: 90_000 }
  );
  const mountainHomeCard = runtimePage.locator('.m8-home .track-card[data-track-id="mountain"]');
  assert.equal(await mountainHomeCard.getAttribute('data-trophy-locked'), 'false',
    'The isolated TURN LAB profile must expose its MOUNTAIN experiment without production trophies');
  assert.notEqual(await mountainHomeCard.getAttribute('aria-disabled'), 'true');
  assert.equal(await runtimePage.locator('html').getAttribute('data-turn-lab-mountain-access'), 'unlocked');
  await runtimePage.screenshot({ path: path.join(outputDir, 'runtime-shell.png'), fullPage: true });
  await runtimePage.evaluate(() => {
    globalThis.__mountainLongChoice = globalThis.__turnChooseTrack();
    return true;
  });
  await runtimePage.locator('.track-select.is-visible .track-card[data-track-id="mountain"]').click();
  await runtimePage.locator('.track-select-continue').click();
  await runtimePage.waitForFunction(
    () => globalThis.__turnRuntime?.trackId === 'mountain'
      && globalThis.__turnRuntime?.activeWorld?.userData?.turnMountainLongExtension,
    null,
    { timeout: 90_000 }
  );
  runtimeMetrics = await runtimePage.evaluate(async () => {
    const runtime = globalThis.__turnRuntime;
    await runtime.activeWorld.ready;
    const resources = performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname);
    const bounds = runtime.samples.reduce((result, sample) => ({
      minX: Math.min(result.minX, sample.point.x),
      maxX: Math.max(result.maxX, sample.point.x),
      minZ: Math.min(result.minZ, sample.point.z),
      maxZ: Math.max(result.maxZ, sample.point.z)
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    return {
      trackId: runtime.trackId,
      sampleCount: runtime.samples.length,
      bounds,
      sampling: runtime.activeWorld.userData.turnMountainLabSampling,
      extension: runtime.activeWorld.userData.turnMountainLongExtension,
      labResources: resources.filter((pathname) => pathname.startsWith('/turn-lab/'))
    };
  });
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  `${JSON.stringify({ metrics, runtimeMetrics, browserErrors }, null, 2)}\n`
);

assert.deepEqual(browserErrors, [], `Browser-rendered long MOUNTAIN produced errors:\n${browserErrors.join('\n')}`);
assert.equal(metrics.assetsReady, true);
assert.deepEqual(metrics.productionAssetErrors, []);
assert.deepEqual(metrics.r4AssetErrors, []);
assert.deepEqual(metrics.r5AssetErrors, []);
assert.deepEqual(metrics.r6AssetErrors, []);
assert.deepEqual(metrics.bridgeAssetErrors, [], 'All three supplied bridge-kit assets must load');
assert.equal(metrics.routeSamples, 2160);
assert.ok(metrics.routeLength > 3750 && metrics.routeLength < 3950);
assert.equal(metrics.runtimeSamples, 2160);
assert.equal(metrics.productionWorldSamples, 1080);
assert.equal(metrics.bridgeDeckModules, 6);
assert.equal(metrics.bridgeRailModules, 12);
assert.equal(metrics.bridgePillars, 6);
assert.equal(metrics.bridgeAbutments, 4);
assert.equal(metrics.bridgeEntryRailLength, 20.5);
assert.equal(metrics.tunnels, 2);
assert.equal(metrics.tunnelPortals, 4);
assert.equal(metrics.carvedMountainMeshes, 2);
assert.ok(metrics.carvedMountainTriangles > 0 && metrics.carvedMountainTriangles <= 800,
  `The two one-time CPU tunnel cuts removed an unexpected triangle count: ${metrics.carvedMountainTriangles}`);
assert.ok(metrics.tunnelLiningTriangles >= 300 && metrics.tunnelLiningTriangles <= 700,
  `Tunnel lining should stay a modest batched mesh, got ${metrics.tunnelLiningTriangles} triangles`);
assert.equal(metrics.tunnelPortalFrames, 12);
assert.equal(metrics.tunnelPortalRocks, 8);
assert.ok(metrics.tunnelReflectors >= 20 && metrics.tunnelReflectors <= 40);
assert.equal(metrics.lowerTerrainVertices, 2755);
assert.equal(metrics.lowerTerrainTriangles, 5264);
assert.equal(metrics.lowerVillageHouses, 8);
assert.ok(metrics.maximumHouseGroundDelta <= 0.06);
assert.equal(metrics.cheapStreetlights, 8);
assert.ok(metrics.forestTrees >= 20, `Expected a substantial occluding forest, got ${metrics.forestTrees}`);
assert.equal(metrics.viewScreens, 3);
assert.ok(metrics.addedDrawCalls > 0 && metrics.addedDrawCalls <= 24,
  `The extension exceeded its draw-call budget: ${metrics.addedDrawCalls}`);
assert.equal(metrics.dynamicPointLightsAdded, 0);
assert.equal(metrics.addedShadowCasters, 0);
assert.equal(metrics.extensionLights, 0);
assert.equal(metrics.extensionShadowCasters, 0);
assert.ok(metrics.instancedMeshes >= 10);
assert.equal(metrics.roadSurfaces, 1);
assert.equal(metrics.roadbedWalls, 2);
assert.equal(metrics.roadbedUndersides, 1);
assert.equal(metrics.deepFoundations, 2);

assert.equal(runtimeMetrics.trackId, 'mountain');
assert.equal(runtimeMetrics.sampleCount, 2160, 'The minimap/physics runtime must receive the long route sample count');
assert.equal(runtimeMetrics.sampling.runtimeSamples, 2160);
assert.equal(runtimeMetrics.sampling.productionWorldSamples, 1080);
assert.equal(runtimeMetrics.extension.bridgeDeckModules, 6);
assert.equal(runtimeMetrics.extension.bridgeEntryRailLength, 20.5);
assert.equal(runtimeMetrics.extension.tunnels, 2);
assert.equal(runtimeMetrics.extension.carvedMountainMeshes, 2);
assert.equal(runtimeMetrics.extension.carvedMountainTriangles, metrics.carvedMountainTriangles);
assert.ok(runtimeMetrics.bounds.minZ < -370 && runtimeMetrics.bounds.maxZ > 190);
for (const resource of [
  '/turn-lab/tracks/definitions.js',
  '/turn-lab/tracks/mountain-layout.js',
  '/turn-lab/tracks/mountain-world-lab-r1.js',
  '/turn-lab/tracks/pace-notes.js',
  '/turn-lab/race/mountain-lap-system.js'
]) {
  assert.ok(runtimeMetrics.labResources.includes(resource), `Scoped runtime did not load ${resource}`);
}

console.log('TURN LAB MOUNTAIN long-course browser visual/runtime smoke passed:', JSON.stringify({
  routeLength: metrics.routeLength,
  addedDrawCalls: metrics.addedDrawCalls,
  forestTrees: metrics.forestTrees,
  sampleCount: runtimeMetrics.sampleCount
}));

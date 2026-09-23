import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'dead-canyon-visual-artifact';
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(`console error: ${message.text()}`);
});

let metrics;
try {
  const response = await page.goto(`${baseUrl}/turn-lab/?visual-smoke=dead-canyon`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  });
  assert.equal(response?.ok(), true, 'TURN LAB must load successfully');

  await page.evaluate(() => {
    localStorage.setItem('turn-audio-enabled-v1', 'off');
    localStorage.setItem('turn-drive-by-ear-v1', 'off');
  });

  await page.getByRole('button', { name: 'Play in browser anyway' }).click();
  await page.waitForFunction(
    () => Boolean(globalThis.__turnRuntime && globalThis.__turnChooseTrack),
    null,
    { timeout: 90_000 }
  );
  await page.waitForFunction(
    () => document.querySelector('.m8-home .track-card[data-track-id="mountain"]')
      ?.dataset?.trophyLocked === 'false',
    null,
    { timeout: 90_000 }
  );

  const homeCard = page.locator('.m8-home .track-card[data-track-id="mountain"]');
  assert.match(await homeCard.textContent(), /Dead Canyon/i);
  assert.equal(await homeCard.getAttribute('data-trophy-locked'), 'false');
  assert.equal(await page.locator('html').getAttribute('data-turn-lab'), 'dead-canyon');
  assert.equal(await page.locator('html').getAttribute('data-turn-lab-experiment-access'), 'unlocked');
  await page.screenshot({ path: path.join(outputDir, 'dead-canyon-home.png'), fullPage: true });

  await page.evaluate(() => {
    globalThis.__deadCanyonChoice = globalThis.__turnChooseTrack();
    return true;
  });
  await page.locator('.track-select.is-visible .track-card[data-track-id="mountain"]').click();
  await page.locator('.track-select-continue').click();

  await page.waitForFunction(
    () => globalThis.__turnRuntime?.trackId === 'mountain'
      && globalThis.__turnRuntime?.activeWorld?.userData?.turnDeadCanyon,
    null,
    { timeout: 90_000 }
  );

  metrics = await page.evaluate(async () => {
    const runtime = globalThis.__turnRuntime;
    await Promise.resolve(runtime.activeWorld?.ready);
    const resources = performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname);
    return {
      trackId: runtime.trackId,
      sampleCount: runtime.samples.length,
      trackLength: runtime.samples.reduce((total, sample, index) => {
        if (index === 0) return total;
        return total + sample.point.distanceTo(runtime.samples[index - 1].point);
      }, runtime.samples.at(-1).point.distanceTo(runtime.samples[0].point)),
      deadCanyon: runtime.activeWorld.userData.turnDeadCanyon,
      retroUrbanSceneObjects: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon Retro Urban')
      ).length,
      cliffBandCount: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon eastern cliff band ')
      ).length,
      skylineMesaCount: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon integrated skyline mesa ')
      ).length,
      hasDistantMesas: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon distant haze mesas')),
      canyonBarrierCount: runtime.activeWorld.getObjectByName('Dead Canyon canyon-edge barriers')?.count ?? 0,
      hasHairpinLandmark: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon hairpin landmark')),
      hasCanyonCrown: Boolean(runtime.activeWorld.getObjectByName('DEAD CANYON CROWN landmark')),
      terrainSkirtCount: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon terrain skirt ')
      ).length,
      hasRoadsideChevrons: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon roadside chevrons')),
      hasStandingRock: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon sentinel standing rock')),
      hasFallenRocks: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon fallen rock formations')),
      hasNeedleBases: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon needle bases')),
      cameraFar: runtime.camera?.far ?? null,
      backgroundColor: runtime.scene?.background?.getHex?.() ?? null,
      fogColor: runtime.scene?.fog?.color?.getHex?.() ?? null,
      fogNear: runtime.activeWorld.parent?.fog?.near ?? null,
      fogFar: runtime.activeWorld.parent?.fog?.far ?? null,
      labResources: resources.filter((pathname) => pathname.startsWith('/turn-lab/'))
    };
  });

  await page.screenshot({ path: path.join(outputDir, 'dead-canyon-active.png'), fullPage: true });
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  `${JSON.stringify({ metrics, browserErrors }, null, 2)}\n`
);

assert.deepEqual(browserErrors, [], `TURN LAB DEAD CANYON produced browser errors:\n${browserErrors.join('\n')}`);
assert.equal(metrics.trackId, 'mountain');
assert.equal(metrics.sampleCount, 2160);
assert.ok(metrics.trackLength > 3150 && metrics.trackLength < 3350,
  `Expected sampled DEAD CANYON length around 3.23 km, got ${metrics.trackLength}`);
assert.equal(metrics.deadCanyon.version, 'dead-canyon-r4');
assert.equal(metrics.deadCanyon.proceduralWorld, true);
assert.equal(metrics.deadCanyon.easternEscarpmentHeight, 220);
assert.equal(metrics.deadCanyon.cliffBands, 4);
assert.equal(metrics.deadCanyon.cliffSegmentsPerBand, 16);
assert.equal(metrics.deadCanyon.cliffFrontX, 715);
assert.equal(metrics.deadCanyon.cliffDepth, 2800);
assert.equal(metrics.deadCanyon.fogFadeNear, 260);
assert.equal(metrics.deadCanyon.fogFadeFar, 760);
assert.equal(metrics.deadCanyon.distantMesaCount, 12);
assert.equal(metrics.deadCanyon.hairpinLandmark, false);
assert.equal(metrics.deadCanyon.roadsideChevronCount, 5);
assert.equal(metrics.deadCanyon.canyonOverhangCount, 4);
assert.equal(metrics.deadCanyon.landmark, 'DEAD CANYON CROWN');
assert.equal(metrics.deadCanyon.standingRockCount, 1);
assert.equal(metrics.deadCanyon.needleCount, 0);
assert.equal(metrics.deadCanyon.geologyArchetypes, 4);
assert.equal(metrics.deadCanyon.solarPanels, 24);
assert.equal(metrics.deadCanyon.retroUrbanAssetsReady, true);
assert.equal(metrics.deadCanyon.retroUrbanLoaded, 5);
assert.ok(metrics.deadCanyon.retroUrbanInstances >= 43);
assert.deepEqual(metrics.deadCanyon.retroUrbanErrors, []);
assert.equal(metrics.deadCanyon.dynamicLights, 0);
assert.equal(metrics.deadCanyon.shadowCasters, 0);
assert.ok(metrics.retroUrbanSceneObjects >= 43,
  `Expected loaded Retro Urban scene objects, got ${metrics.retroUrbanSceneObjects}`);
assert.equal(metrics.cliffBandCount, 4);
assert.equal(metrics.skylineMesaCount, 5);
assert.equal(metrics.hasDistantMesas, true);
assert.ok(metrics.canyonBarrierCount >= 20);
assert.equal(metrics.hasHairpinLandmark, false);
assert.equal(metrics.hasCanyonCrown, true);
assert.equal(metrics.terrainSkirtCount, 2);
assert.equal(metrics.hasRoadsideChevrons, true);
assert.equal(metrics.hasStandingRock, true);
assert.equal(metrics.hasFallenRocks, true);
assert.equal(metrics.hasNeedleBases, false);
assert.equal(metrics.cameraFar, 900);
assert.equal(metrics.backgroundColor, metrics.fogColor,
  'DEAD CANYON sky and terminal haze must share a colour so clipping has no visible seam');
assert.equal(metrics.fogNear, 260);
assert.equal(metrics.fogFar, 760);
assert.ok(metrics.fogFar <= metrics.cameraFar - 100,
  `Fog must reach full opacity before the ${metrics.cameraFar} m camera far plane`);

for (const resource of [
  '/turn-lab/tracks/definitions.js',
  '/turn-lab/tracks/mountain-layout.js',
  '/turn-lab/tracks/registry.js',
  '/turn-lab/render/track-intro-camera.js'
]) {
  assert.ok(metrics.labResources.includes(resource), `Scoped runtime did not load ${resource}`);
}

console.log('TURN LAB DEAD CANYON browser/runtime smoke passed:', JSON.stringify({
  trackLength: metrics.trackLength,
  sampleCount: metrics.sampleCount,
  cliffBands: metrics.deadCanyon.cliffBands,
  fogFar: metrics.fogFar,
  cameraFar: metrics.cameraFar,
  barriers: metrics.canyonBarrierCount,
  landmark: metrics.deadCanyon.landmark,
  terrainSkirts: metrics.terrainSkirtCount,
  retroUrbanInstances: metrics.deadCanyon.retroUrbanInstances
}));

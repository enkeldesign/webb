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
      hasEasternEscarpment: Boolean(
        runtime.activeWorld.getObjectByName('Dead Canyon eastern Grand Canyon escarpment')
      ),
      hasNeedleBases: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon needle bases')),
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
assert.ok(metrics.trackLength > 3050 && metrics.trackLength < 3350,
  `Expected sampled DEAD CANYON length around 3.2 km, got ${metrics.trackLength}`);
assert.equal(metrics.deadCanyon.version, 'dead-canyon-r1');
assert.equal(metrics.deadCanyon.proceduralWorld, true);
assert.equal(metrics.deadCanyon.easternEscarpmentHeight, 210);
assert.equal(metrics.deadCanyon.easternEscarpmentSegments, 31);
assert.equal(metrics.deadCanyon.needleCount, 11);
assert.equal(metrics.deadCanyon.geologyArchetypes, 4);
assert.equal(metrics.deadCanyon.solarPanels, 24);
assert.equal(metrics.deadCanyon.retroUrbanAssetsReady, true);
assert.equal(metrics.deadCanyon.retroUrbanLoaded, 5);
assert.ok(metrics.deadCanyon.retroUrbanInstances >= 30);
assert.deepEqual(metrics.deadCanyon.retroUrbanErrors, []);
assert.equal(metrics.deadCanyon.dynamicLights, 0);
assert.equal(metrics.deadCanyon.shadowCasters, 0);
assert.ok(metrics.retroUrbanSceneObjects >= 36,
  `Expected loaded Retro Urban scene objects, got ${metrics.retroUrbanSceneObjects}`);
assert.equal(metrics.hasEasternEscarpment, true);
assert.equal(metrics.hasNeedleBases, true);

for (const resource of [
  '/turn-lab/tracks/definitions.js',
  '/turn-lab/tracks/mountain-layout.js',
  '/turn-lab/tracks/registry.js'
]) {
  assert.ok(metrics.labResources.includes(resource), `Scoped runtime did not load ${resource}`);
}

console.log('TURN LAB DEAD CANYON browser/runtime smoke passed:', JSON.stringify({
  trackLength: metrics.trackLength,
  sampleCount: metrics.sampleCount,
  needles: metrics.deadCanyon.needleCount,
  retroUrbanInstances: metrics.deadCanyon.retroUrbanInstances
}));

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'badlands-visual-artifact';
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
  const response = await page.goto(`${baseUrl}/turn-lab/?visual-smoke=badlands`, {
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
  assert.match(await homeCard.textContent(), /Badlands/i);
  assert.equal(await homeCard.getAttribute('data-trophy-locked'), 'false');
  assert.equal(await page.locator('html').getAttribute('data-turn-lab'), 'badlands');
  assert.equal(await page.locator('html').getAttribute('data-turn-lab-experiment-access'), 'unlocked');
  await page.screenshot({ path: path.join(outputDir, 'badlands-home.png'), fullPage: true });

  await page.evaluate(() => {
    globalThis.__badlandsChoice = globalThis.__turnChooseTrack();
    return true;
  });
  await page.locator('.track-select.is-visible .track-card[data-track-id="mountain"]').click();
  await page.locator('.track-select-continue').click();

  await page.waitForFunction(
    () => globalThis.__turnRuntime?.trackId === 'mountain'
      && globalThis.__turnRuntime?.activeWorld?.userData?.turnBadlands,
    null,
    { timeout: 90_000 }
  );

  metrics = await page.evaluate(async () => {
    const runtime = globalThis.__turnRuntime;
    await Promise.resolve(runtime.activeWorld?.ready);
    const resources = performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname);
    return {
      trackId: runtime.trackId,
      trackName: runtime.trackDefinition?.name || runtime.definition?.name || null,
      sampleCount: runtime.samples.length,
      trackLength: runtime.trackLength,
      badlands: runtime.activeWorld.userData.turnBadlands,
      labResources: resources.filter((pathname) => pathname.startsWith('/turn-lab/'))
    };
  });

  await page.screenshot({ path: path.join(outputDir, 'badlands-active.png'), fullPage: true });
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  `${JSON.stringify({ metrics, browserErrors }, null, 2)}\n`
);

assert.deepEqual(browserErrors, [], `TURN LAB BADLANDS produced browser errors:\n${browserErrors.join('\n')}`);
assert.equal(metrics.trackId, 'mountain');
assert.equal(metrics.sampleCount, 1440);
assert.ok(metrics.trackLength > 1500 && metrics.trackLength < 1750);
assert.equal(metrics.badlands.version, 'badlands-r1');
assert.equal(metrics.badlands.proceduralWorld, true);
assert.equal(metrics.badlands.solarPanels, 30);
assert.equal(metrics.badlands.telemetryMasts, 4);
assert.equal(metrics.badlands.dynamicLights, 0);
assert.equal(metrics.badlands.shadowCasters, 0);
for (const resource of [
  '/turn-lab/tracks/definitions.js',
  '/turn-lab/tracks/mountain-layout.js',
  '/turn-lab/tracks/registry.js',
  '/turn-lab/tracks/badlands-world.js'
]) {
  assert.ok(metrics.labResources.includes(resource), `Scoped runtime did not load ${resource}`);
}

console.log('TURN LAB BADLANDS browser/runtime smoke passed:', JSON.stringify({
  trackLength: metrics.trackLength,
  sampleCount: metrics.sampleCount,
  world: metrics.badlands.version
}));

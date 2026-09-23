import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'suburbs-visual-artifact';
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', (error) => browserErrors.push('pageerror: ' + error.message));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push('console error: ' + message.text());
});

let metrics;
let introCamera;
try {
  const response = await page.goto(baseUrl + '/turn-lab/?visual-smoke=suburbs', {
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
  assert.match(await homeCard.textContent(), /Suburbs/i);
  assert.equal(await homeCard.getAttribute('data-trophy-locked'), 'false');
  assert.equal(await page.locator('html').getAttribute('data-turn-lab'), 'suburbs');
  assert.equal(await page.locator('html').getAttribute('data-turn-lab-experiment-access'), 'unlocked');
  await page.screenshot({ path: path.join(outputDir, 'suburbs-home.png'), fullPage: true });

  await page.evaluate(() => {
    globalThis.__suburbsChoice = globalThis.__turnChooseTrack();
    return true;
  });
  await page.locator('.track-select.is-visible .track-card[data-track-id="mountain"]').click();
  await page.locator('.track-select-continue').click();

  await page.waitForFunction(
    () => globalThis.__turnRuntime?.trackId === 'mountain'
      && globalThis.__turnRuntime?.activeWorld?.userData?.turnSuburbs,
    null,
    { timeout: 90_000 }
  );
  await page.evaluate(async () => {
    await Promise.resolve(globalThis.__turnRuntime?.activeWorld?.ready);
  });

  await page.setViewportSize({ width: 1800, height: 900 });
  await page.evaluate(async () => {
    const { showTrackIntro } = await import('/turn/ui/track-intro.js?build=20260922-r285');
    globalThis.__suburbsVisualIntro = showTrackIntro('mountain');
  });
  await page.waitForFunction(
    () => document.body.classList.contains('turn-track-intro'),
    null,
    { timeout: 15_000 }
  );
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  introCamera = await page.evaluate(() => ({
    position: globalThis.__turnRuntime.camera.position.toArray(),
    fov: globalThis.__turnRuntime.camera.fov
  }));
  await page.evaluate(() => {
    document.querySelector('.m8-home')?.style.setProperty('display', 'none', 'important');
    document.querySelector('.track-select')?.style.setProperty('display', 'none', 'important');
  });
  await page.screenshot({ path: path.join(outputDir, 'suburbs-intro.png'), fullPage: true });
  await page.evaluate(() => globalThis.__suburbsVisualIntro);
  await page.setViewportSize({ width: 1440, height: 900 });

  metrics = await page.evaluate(() => {
    const runtime = globalThis.__turnRuntime;
    const world = runtime.activeWorld;
    const children = [];
    world.traverse((object) => children.push(object));
    return {
      trackId: runtime.trackId,
      sampleCount: runtime.samples.length,
      trackLength: runtime.samples.reduce((total, sample, index) => {
        if (index === 0) return total;
        return total + sample.point.distanceTo(runtime.samples[index - 1].point);
      }, runtime.samples.at(-1).point.distanceTo(runtime.samples[0].point)),
      suburbs: world.userData.turnSuburbs,
      houses: children.filter((object) => object.name?.startsWith('Suburbs Kenney house ')).length,
      driveways: children.filter((object) => object.name?.startsWith('Suburbs Kenney driveway ')).length,
      fences: children.filter((object) => object.name?.startsWith('Suburbs Kenney garden fence ')).length,
      trees: children.filter((object) => object.name?.includes('Suburbs Kenney') && object.name?.includes('tree ')).length,
      planters: children.filter((object) => object.name?.startsWith('Suburbs Kenney flower planter ')).length,
      parkedCars: children.filter((object) => object.name?.startsWith('Suburbs parked ')).length,
      hasLake: Boolean(world.getObjectByName('Suburbs summer lake')),
      hasDock: Boolean(world.getObjectByName('Suburbs wooden dock')),
      hasBoat: Boolean(world.getObjectByName('Suburbs moored summer boat')),
      playgroundPieces: world.getObjectByName('Suburbs playground')?.children.length || 0,
      backgroundColor: runtime.scene?.background?.getHex?.() ?? null,
      fogColor: runtime.scene?.fog?.color?.getHex?.() ?? null,
      fogNear: runtime.scene?.fog?.near ?? null,
      fogFar: runtime.scene?.fog?.far ?? null,
      cameraFar: runtime.camera?.far ?? null
    };
  });

  await page.screenshot({ path: path.join(outputDir, 'suburbs-active.png'), fullPage: true });

  await page.evaluate(() => {
    const runtime = globalThis.__turnRuntime;
    runtime.renderer?.setAnimationLoop?.(null);
    for (const selector of [
      '.race-hud', '.drive-pad', '.drive-pad-shell', '.minimap-shell',
      '.restart-lap-button', '.lap-result-toast', '.peripheral-hud'
    ]) {
      document.querySelectorAll(selector).forEach((node) => node.style.setProperty('display', 'none', 'important'));
    }
    runtime.camera.position.set(270, 105, 205);
    runtime.camera.up.set(0, 1, 0);
    runtime.camera.lookAt(68, 0, 22);
    runtime.camera.fov = 48;
    runtime.camera.updateProjectionMatrix();
    runtime.camera.updateMatrixWorld(true);
    runtime.renderer?.render?.(runtime.scene, runtime.camera);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(outputDir, 'suburbs-lake-park.png'), fullPage: true });
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  JSON.stringify({ metrics, introCamera, browserErrors }, null, 2) + '\n'
);

assert.deepEqual(browserErrors, [], 'TURN LAB SUBURBS produced browser errors:\n' + browserErrors.join('\n'));
assert.deepEqual(introCamera.position.map((value) => Math.round(value)), [20, 260, -570]);
assert.equal(introCamera.fov, 62);
assert.equal(metrics.trackId, 'mountain');
assert.equal(metrics.sampleCount, 1440);
assert.ok(metrics.trackLength > 1850 && metrics.trackLength < 2000,
  'Expected sampled SUBURBS length around 1.9 km, got ' + metrics.trackLength);
assert.equal(metrics.suburbs.version, 'suburbs-summer');
assert.equal(metrics.suburbs.easyTrack, true);
assert.equal(metrics.suburbs.flatCourse, true);
assert.equal(metrics.suburbs.kenneyKit, 'City Kit Suburban 2.0');
assert.ok(metrics.houses >= 14, 'Expected a dense neighbourhood, got ' + metrics.houses + ' houses');
assert.ok(metrics.driveways >= 14, 'Expected driveways for most houses, got ' + metrics.driveways);
assert.ok(metrics.fences >= 16, 'Expected several fenced gardens, got ' + metrics.fences);
assert.ok(metrics.trees >= 20, 'Expected a leafy summer neighbourhood, got ' + metrics.trees + ' trees');
assert.equal(metrics.planters, 6);
assert.ok(metrics.parkedCars >= 7, 'Expected colourful parked cars, got ' + metrics.parkedCars);
assert.equal(metrics.hasLake, true);
assert.equal(metrics.hasDock, true);
assert.equal(metrics.hasBoat, true);
assert.ok(metrics.playgroundPieces >= 8);
assert.deepEqual(metrics.suburbs.assetErrors, []);
assert.equal(metrics.suburbs.dynamicLights, 0);
assert.equal(metrics.suburbs.shadowCasters, 0);
assert.equal(metrics.fogNear, 480);
assert.equal(metrics.fogFar, 880);
assert.equal(metrics.cameraFar, 900);

console.log('TURN LAB SUBURBS browser/runtime smoke passed:', JSON.stringify({
  trackLength: metrics.trackLength,
  houses: metrics.houses,
  trees: metrics.trees,
  parkedCars: metrics.parkedCars,
  planters: metrics.planters,
  lake: metrics.hasLake,
  dock: metrics.hasDock,
  boat: metrics.hasBoat
}));

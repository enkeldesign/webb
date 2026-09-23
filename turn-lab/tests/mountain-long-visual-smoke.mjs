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
let introCamera;
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

  // Match the wide-phone aspect of the real DEAD CANYON feedback frames when
  // judging the establishing composition; the default 16:10 CI viewport makes
  // the same perspective look artificially ground-heavy.
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.evaluate(async () => {
    const { showTrackIntro } = await import('/turn/ui/track-intro.js?build=20260922-r285');
    globalThis.__deadCanyonVisualIntro = showTrackIntro('mountain');
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
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.screenshot({ path: path.join(outputDir, 'dead-canyon-intro.png'), fullPage: true });
  await page.evaluate(() => globalThis.__deadCanyonVisualIntro);
  await page.setViewportSize({ width: 1440, height: 900 });

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
      tableMesaInstances: runtime.activeWorld.getObjectByName('Dead Canyon table mesas')?.count ?? 0,
      embeddedOverhangCount: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon embedded overhang ')
      ).length,
      embeddedOverhangMinX: Math.min(...runtime.activeWorld.children
        .filter((object) => object.name?.startsWith('Dead Canyon embedded overhang '))
        .map((object) => object.position.x)),
      crownShelfMinX: Math.min(...(runtime.activeWorld.getObjectByName('DEAD CANYON CROWN landmark')
        ?.children || []).map((object) => object.position.x)),
      yellowTreeObjects: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon Retro Urban yellow-tree-')
      ).length,
      openShedParts: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon Retro Urban open-shed-')
      ).length,
      hasRustTruck: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon Retro Urban rust-truck')),
      ruinObjects: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon Retro Urban stone-ruin-')
      ).length,
      yellowStepObjects: runtime.activeWorld.children.filter(
        (object) => object.name?.startsWith('Dead Canyon Retro Urban')
          && object.name?.includes('barrier')
      ).length,
      hasDarkTunnel: Boolean(runtime.activeWorld.getObjectByName('Dead Canyon dark tunnel')),
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

  await page.evaluate(() => {
    const runtime = globalThis.__turnRuntime;
    runtime.renderer?.setAnimationLoop?.(null);
    const target = runtime.activeWorld.getObjectByName('Dead Canyon Retro Urban open-shed-poles');
    if (!target) return;
    for (const selector of [
      '.race-hud', '.drive-pad', '.drive-pad-shell', '.minimap-shell',
      '.restart-lap-button', '.lap-result-toast', '.peripheral-hud'
    ]) {
      document.querySelectorAll(selector).forEach((node) => node.style.setProperty('display', 'none', 'important'));
    }
    runtime.camera.position.set(target.position.x - 82, target.position.y + 42, target.position.z - 92);
    runtime.camera.up.set(0, 1, 0);
    runtime.camera.lookAt(target.position.x, target.position.y + 7, target.position.z);
    runtime.camera.fov = 52;
    runtime.camera.updateProjectionMatrix();
    runtime.camera.updateMatrixWorld(true);
    runtime.renderer?.render?.(runtime.scene, runtime.camera);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(outputDir, 'dead-canyon-retro-grove.png'), fullPage: true });

  await page.evaluate(() => {
    const runtime = globalThis.__turnRuntime;
    const target = runtime.activeWorld.getObjectByName('Dead Canyon Retro Urban stone-ruin-2');
    if (!target) return;
    runtime.camera.position.set(target.position.x - 72, target.position.y + 34, target.position.z - 78);
    runtime.camera.up.set(0, 1, 0);
    runtime.camera.lookAt(target.position.x, target.position.y + 5, target.position.z);
    runtime.camera.fov = 50;
    runtime.camera.updateProjectionMatrix();
    runtime.camera.updateMatrixWorld(true);
    runtime.renderer?.render?.(runtime.scene, runtime.camera);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(outputDir, 'dead-canyon-ruins.png'), fullPage: true });
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  `${JSON.stringify({ metrics, introCamera, browserErrors }, null, 2)}\n`
);

assert.deepEqual(browserErrors, [], `TURN LAB DEAD CANYON produced browser errors:\n${browserErrors.join('\n')}`);
assert.deepEqual(introCamera.position.map((value) => Math.round(value)), [10, 205, -770]);
assert.equal(introCamera.fov, 66);
assert.equal(metrics.trackId, 'mountain');
assert.equal(metrics.sampleCount, 2160);
assert.ok(metrics.trackLength > 3150 && metrics.trackLength < 3350,
  `Expected sampled DEAD CANYON length around 3.23 km, got ${metrics.trackLength}`);
assert.equal(metrics.deadCanyon.version, 'dead-canyon-polish');
assert.equal(metrics.hasDarkTunnel, false, 'The #972/#973 tunnel experiment must be absent');
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
assert.equal(metrics.deadCanyon.tableMesaCount, 1);
assert.equal(metrics.deadCanyon.yellowTreeCount, 6);
assert.equal(metrics.deadCanyon.openShedCount, 1);
assert.equal(metrics.deadCanyon.rustTruckCount, 1);
assert.equal(metrics.deadCanyon.ruinClusterCount, 1);
assert.equal(metrics.deadCanyon.yellowStepBarrierCount, 0);
assert.equal(metrics.deadCanyon.embeddedWallRocks, true);
assert.equal(metrics.deadCanyon.shedRoofSeated, true);
assert.equal(metrics.deadCanyon.needleCount, 0);
assert.equal(metrics.deadCanyon.geologyArchetypes, 4);
assert.equal(metrics.deadCanyon.solarPanels, 24);
assert.equal(metrics.deadCanyon.retroUrbanAssetsReady, true);
assert.equal(metrics.deadCanyon.retroUrbanLoaded, 7);
assert.equal(metrics.deadCanyon.treeTextureLoaded, true);
assert.equal(metrics.deadCanyon.retroUrbanInstances, 34);
assert.deepEqual(metrics.deadCanyon.retroUrbanErrors, []);
assert.equal(metrics.deadCanyon.dynamicLights, 0);
assert.equal(metrics.deadCanyon.shadowCasters, 0);
assert.ok(metrics.retroUrbanSceneObjects >= 37,
  `Expected loaded Retro Urban scene objects, got ${metrics.retroUrbanSceneObjects}`);
assert.equal(metrics.cliffBandCount, 4);
assert.equal(metrics.skylineMesaCount, 5);
assert.equal(metrics.hasDistantMesas, true);
assert.ok(metrics.canyonBarrierCount >= 20);
assert.equal(metrics.hasHairpinLandmark, false);
assert.equal(metrics.hasCanyonCrown, true);
assert.equal(metrics.terrainSkirtCount, 2);
assert.equal(metrics.tableMesaInstances, 1);
assert.equal(metrics.embeddedOverhangCount, 4);
assert.ok(metrics.embeddedOverhangMinX >= 744,
  'Wall overhangs must be pushed into the east cliff face');
assert.ok(metrics.crownShelfMinX >= 748,
  'DEAD CANYON CROWN shelves must remain embedded in the wall');
assert.equal(metrics.yellowTreeObjects, 6);
assert.equal(metrics.openShedParts, 2);
assert.equal(metrics.hasRustTruck, true);
assert.equal(metrics.ruinObjects, 3);
assert.equal(metrics.yellowStepObjects, 0);
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
  tableMesas: metrics.tableMesaInstances,
  yellowTrees: metrics.yellowTreeObjects,
  shedParts: metrics.openShedParts,
  ruins: metrics.ruinObjects,
  yellowSteps: metrics.yellowStepObjects,
  overhangMinX: metrics.embeddedOverhangMinX,
  crownShelfMinX: metrics.crownShelfMinX,
  retroUrbanInstances: metrics.deadCanyon.retroUrbanInstances
}));

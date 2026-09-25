import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'lab-dual-tracks-visual-artifact';
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

let suburbs;
let deadCanyon;
try {
  const response = await page.goto(baseUrl + '/turn-lab/?visual-smoke=dual-lab', {
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

  const mountainHome = page.locator('.m8-home .track-card[data-track-id="mountain"]');
  const suburbsHome = page.locator('.m8-home .track-card[data-track-id="cliffside"]');
  assert.match(await mountainHome.textContent(), /Dead Canyon/i);
  assert.match(await suburbsHome.textContent(), /Beachfront/i);
  assert.equal(await mountainHome.getAttribute('data-trophy-locked'), 'false');
  assert.equal(await mountainHome.evaluate((node) => node.style.getPropertyValue('--track-accent')), '#df3045');
  assert.equal(await mountainHome.evaluate((node) => node.style.getPropertyValue('--track-accent-soft')), '#f3a0a8');
  assert.equal(await page.locator('html').getAttribute('data-turn-lab'), 'dead-canyon-suburbs');
  await page.screenshot({ path: path.join(outputDir, 'lab-home-both-tracks.png'), fullPage: true });

  await page.evaluate(() => {
    globalThis.__suburbsChoice = globalThis.__turnChooseTrack();
    return true;
  });
  await page.locator('.track-select.is-visible .track-card[data-track-id="cliffside"]').click();
  await page.locator('.track-select-continue').click();
  await page.evaluate(() => globalThis.__suburbsChoice);

  await page.waitForFunction(
    () => globalThis.__turnRuntime?.trackId === 'cliffside'
      && globalThis.__turnRuntime?.activeWorld?.userData?.turnBeachfront,
    null,
    { timeout: 90_000 }
  );
  await page.evaluate(async () => {
    await Promise.resolve(globalThis.__turnRuntime?.activeWorld?.ready);
  });

  suburbs = await page.evaluate(async () => {
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
      metrics: world.userData.turnBeachfront,
      houses: children.filter((object) =>
        object.name?.startsWith('Beachfront Kenney house ')
        || object.name?.startsWith('Beachfront Kenney back-row house ')
      ).length,
      parkedCars: children.filter((object) => object.name?.startsWith('Beachfront parked ')).length,
      grassVariationPatches: children.filter((object) => object.name?.startsWith('Beachfront grass variation ')).length,
      houseBounds: await (async () => {
        const THREE = await import('three');
        const houses = children.filter((object) =>
          object.name?.startsWith('Beachfront Kenney house ')
          || object.name?.startsWith('Beachfront Kenney back-row house ')
        );
        return houses.map((object) => {
          object.updateWorldMatrix(true, true);
          const box = new THREE.Box3().setFromObject(object, true);
          const centre = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          let nearestRoadToBounds = Infinity;
          for (const sample of runtime.samples) {
            const dx = sample.point.x < box.min.x
              ? box.min.x - sample.point.x
              : sample.point.x > box.max.x
                ? sample.point.x - box.max.x
                : 0;
            const dz = sample.point.z < box.min.z
              ? box.min.z - sample.point.z
              : sample.point.z > box.max.z
                ? sample.point.z - box.max.z
                : 0;
            nearestRoadToBounds = Math.min(nearestRoadToBounds, Math.hypot(dx, dz));
          }
          return {
            name: object.name,
            x: centre.x,
            z: centre.z,
            width: size.x,
            depth: size.z,
            nearestRoadToBounds
          };
        }).sort((a, b) => a.nearestRoadToBounds - b.nearestRoadToBounds);
      })(),
      island: Boolean(world.getObjectByName('Beachfront island body')),
      sandRim: Boolean(world.getObjectByName('Beachfront island beach rim')),
      surroundingWater: Boolean(world.getObjectByName('Beachfront surrounding water')),
      dock: Boolean(world.getObjectByName('Beachfront wooden dock')),
      boat: Boolean(world.getObjectByName('Beachfront moored summer boat')),
      staleLake: Boolean(world.getObjectByName('Beachfront summer lake')),
      staleCliffsideVillage: Boolean(world.getObjectByName('Cliffside Kenney Inner Village')),
      staleOceanLiner: Boolean(world.getObjectByName('Cliffside Kenney Ocean Liner'))
    };
  });

  await page.evaluate(() => {
    const runtime = globalThis.__turnRuntime;
    runtime.renderer?.setAnimationLoop?.(null);
    document.querySelector('.m8-home')?.style.setProperty('display', 'none', 'important');
    document.querySelector('.track-select')?.style.setProperty('display', 'none', 'important');
    for (const selector of [
      '.race-hud', '.drive-pad', '.drive-pad-shell', '.minimap-shell',
      '.restart-lap-button', '.lap-result-toast', '.peripheral-hud'
    ]) {
      document.querySelectorAll(selector).forEach((node) => node.style.setProperty('display', 'none', 'important'));
    }
    runtime.camera.position.set(390, 135, 245);
    runtime.camera.up.set(0, 1, 0);
    runtime.camera.lookAt(65, 0, 25);
    runtime.camera.fov = 48;
    runtime.camera.updateProjectionMatrix();
    runtime.camera.updateMatrixWorld(true);
    runtime.renderer?.render?.(runtime.scene, runtime.camera);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(outputDir, 'beachfront-island.png'), fullPage: true });

  await page.evaluate(() => {
    document.querySelector('.m8-home')?.style.removeProperty('display');
    document.querySelector('.track-select')?.style.removeProperty('display');
    globalThis.__deadChoice = globalThis.__turnChooseTrack();
    return true;
  });
  await page.locator('.track-select.is-visible .track-card[data-track-id="mountain"]').click();
  await page.locator('.track-select-continue').click();
  await page.evaluate(() => globalThis.__deadChoice);

  await page.waitForFunction(
    () => globalThis.__turnRuntime?.trackId === 'mountain'
      && globalThis.__turnRuntime?.activeWorld?.userData?.turnDeadCanyon,
    null,
    { timeout: 90_000 }
  );
  await page.evaluate(async () => {
    await Promise.resolve(globalThis.__turnRuntime?.activeWorld?.ready);
  });

  deadCanyon = await page.evaluate(async () => {
    const runtime = globalThis.__turnRuntime;
    const world = runtime.activeWorld;
    const THREE = await import('three');
    const children = [];
    world.traverse((object) => children.push(object));
    const shedPoles = world.getObjectByName('Dead Canyon Retro Urban open-shed-poles');
    const shedRoof = world.getObjectByName('Dead Canyon Retro Urban open-shed-roof');
    let shedRoofGap = null;
    if (shedPoles && shedRoof) {
      shedPoles.updateWorldMatrix(true, true);
      shedRoof.updateWorldMatrix(true, true);
      const poleBounds = new THREE.Box3().setFromObject(shedPoles);
      const roofBounds = new THREE.Box3().setFromObject(shedRoof);
      shedRoofGap = roofBounds.min.y - poleBounds.max.y;
    }
    return {
      trackId: runtime.trackId,
      sampleCount: runtime.samples.length,
      trackLength: runtime.samples.reduce((total, sample, index) => {
        if (index === 0) return total;
        return total + sample.point.distanceTo(runtime.samples[index - 1].point);
      }, runtime.samples.at(-1).point.distanceTo(runtime.samples[0].point)),
      centralSweepMinimumRadius: Math.min(...runtime.samples.map((sample) =>
        Math.hypot(sample.point.x, sample.point.z)
      )),
      metrics: world.userData.turnDeadCanyon,
      yellowTrees: children.filter((object) =>
        object.name?.includes('yellow-tree-')
      ).length,
      centralFormation: Boolean(world.getObjectByName('Dead Canyon central badlands formations')),
      overhangs: children.filter((object) =>
        object.name?.startsWith('Dead Canyon embedded overhang ')
      ).map((object) => ({ name: object.name, x: object.position.x, y: object.position.y })),
      crownShelves: children.filter((object) =>
        object.name?.startsWith('DEAD CANYON CROWN shelf ')
      ).map((object) => ({ name: object.name, x: object.position.x, z: object.position.z })),
      shedRoofGap
    };
  });

  await page.evaluate(() => {
    const runtime = globalThis.__turnRuntime;
    document.querySelector('.m8-home')?.style.setProperty('display', 'none', 'important');
    document.querySelector('.track-select')?.style.setProperty('display', 'none', 'important');
    runtime.camera.position.set(-430, 235, -620);
    runtime.camera.up.set(0, 1, 0);
    runtime.camera.lookAt(90, 34, 55);
    runtime.camera.fov = 58;
    runtime.camera.updateProjectionMatrix();
    runtime.camera.updateMatrixWorld(true);
    runtime.renderer?.render?.(runtime.scene, runtime.camera);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(outputDir, 'dead-canyon-restored.png'), fullPage: true });

  await page.evaluate(() => {
    const runtime = globalThis.__turnRuntime;
    runtime.camera.position.set(-260, 125, -260);
    runtime.camera.up.set(0, 1, 0);
    runtime.camera.lookAt(120, 12, 45);
    runtime.camera.fov = 58;
    runtime.camera.updateProjectionMatrix();
    runtime.camera.updateMatrixWorld(true);
    runtime.renderer?.render?.(runtime.scene, runtime.camera);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(outputDir, 'dead-canyon-center.png'), fullPage: true });

  await page.evaluate(() => {
    const runtime = globalThis.__turnRuntime;
    runtime.camera.position.set(610, 120, -180);
    runtime.camera.up.set(0, 1, 0);
    runtime.camera.lookAt(835, 105, 55);
    runtime.camera.fov = 54;
    runtime.camera.updateProjectionMatrix();
    runtime.camera.updateMatrixWorld(true);
    runtime.renderer?.render?.(runtime.scene, runtime.camera);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(outputDir, 'dead-canyon-wall.png'), fullPage: true });
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  JSON.stringify({ suburbs, deadCanyon, browserErrors }, null, 2) + '\n'
);

console.log('BEACHFRONT house bounds:', JSON.stringify(suburbs.houseBounds));

assert.deepEqual(browserErrors, [], 'TURN LAB produced browser errors:\n' + browserErrors.join('\n'));

assert.equal(suburbs.trackId, 'cliffside');
assert.equal(suburbs.sampleCount, 1440);
assert.ok(suburbs.trackLength > 1850 && suburbs.trackLength < 2000);
assert.equal(suburbs.metrics.version, 'beachfront-summer');
assert.equal(suburbs.metrics.islandCourse, true);
assert.equal(suburbs.metrics.easyTrack, false);
assert.ok(suburbs.houses >= 22);
assert.ok(suburbs.parkedCars >= 7);
assert.equal(suburbs.grassVariationPatches, 10);
assert.equal(suburbs.metrics.grassVariationPatches, 10);
const closestHouseToRoad = suburbs.houseBounds[0];
const formerRoadHouse = suburbs.houseBounds.find((house) =>
  house.name === 'Beachfront Kenney back-row house 7'
);
assert.ok(formerRoadHouse, 'BEACHFRONT former road house must exist');
assert.ok(formerRoadHouse.nearestRoadToBounds > 20,
  'BEACHFRONT back-row house 7 footprint must stay clear of the road');
assert.ok(closestHouseToRoad.nearestRoadToBounds > 14,
  'No BEACHFRONT house footprint may overlap the asphalt');
assert.equal(suburbs.island, true);
assert.equal(suburbs.sandRim, true);
assert.equal(suburbs.surroundingWater, true);
assert.equal(suburbs.dock, true);
assert.equal(suburbs.boat, true);
assert.equal(suburbs.staleLake, false);
assert.equal(suburbs.staleCliffsideVillage, false);
assert.equal(suburbs.staleOceanLiner, false);
assert.ok(suburbs.metrics.hotelCount >= 6);
assert.ok(suburbs.metrics.palmCount >= 14);
assert.ok(suburbs.metrics.beachRockCount >= 1);
assert.equal(suburbs.metrics.sailboatCount, 5);
assert.deepEqual(suburbs.metrics.assetErrors, []);

assert.equal(deadCanyon.trackId, 'mountain');
assert.equal(deadCanyon.sampleCount, 2160);
assert.ok(deadCanyon.trackLength > 3150 && deadCanyon.trackLength < 3350);
assert.equal(deadCanyon.metrics.version, 'dead-canyon-polish');
assert.equal(deadCanyon.metrics.yellowStepBarrierCount, 0);
assert.equal(deadCanyon.metrics.shedRoofSeated, true);
assert.equal(deadCanyon.metrics.yellowTreeCount, 20);
assert.equal(deadCanyon.metrics.centralRockFormationCount, 6);
assert.equal(deadCanyon.centralFormation, true);
assert.ok(deadCanyon.centralSweepMinimumRadius < 150,
  'DEAD CANYON route must visibly enter the central basin');
assert.equal(deadCanyon.yellowTrees, 20);
assert.equal(deadCanyon.overhangs.length, 4);
assert.ok(deadCanyon.overhangs[1].x > 780 && deadCanyon.overhangs[2].x > 840,
  'upper canyon-wall rocks must be embedded into their matching cliff bands');
assert.equal(deadCanyon.crownShelves.length, 3);
assert.deepEqual(deadCanyon.crownShelves.map((shelf) => Math.round(shelf.x)), [790, 855, 925]);
assert.ok(deadCanyon.shedRoofGap <= 0,
  'DEAD CANYON shed roof must overlap the support tops rather than float above them');
assert.deepEqual(deadCanyon.metrics.retroUrbanErrors, []);

console.log('TURN LAB dual-track browser smoke passed:', JSON.stringify({
  suburbsLength: suburbs.trackLength,
  suburbsHouses: suburbs.houses,
  suburbsParkedCars: suburbs.parkedCars,
  deadCanyonLength: deadCanyon.trackLength
}));

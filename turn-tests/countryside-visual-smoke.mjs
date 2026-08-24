import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.TURN_VISUAL_BASE_URL || 'http://127.0.0.1:8000';
const outputDir = process.env.TURN_VISUAL_OUTPUT || 'countryside-visual-artifact';
const views = ['aerial', 'first-impression', 'nature', 'village', 'farm-windmill', 'orchard', 'lake', 'bella'];
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', (error) => {
  browserErrors.push(`pageerror: ${error.message}`);
  console.error(`COUNTRYSIDE pageerror: ${error.message}`);
});
page.on('console', (message) => {
  const value = message.text();
  if (message.type() === 'error' || /failed to load|countryside .* failed/i.test(value)) {
    browserErrors.push(`console ${message.type()}: ${value}`);
  }
});

let metrics;
let visualFailure = null;
try {
  const response = await page.goto(`${baseUrl}/turn-lab/countryside-visual.html?view=aerial`, {
    waitUntil: 'networkidle',
    timeout: 90_000
  });
  assert.equal(response?.ok(), true, 'COUNTRYSIDE visual page must load successfully');
  await page.waitForFunction(
    () => globalThis.__countrysideVisualReady === true || Boolean(globalThis.__countrysideVisualFailure),
    null,
    { timeout: 60_000 }
  );
  visualFailure = await page.evaluate(() => globalThis.__countrysideVisualFailure || null);
  assert.equal(visualFailure, null, `COUNTRYSIDE visual bootstrap failed: ${visualFailure}`);
  metrics = await page.evaluate(() => globalThis.__countrysideVisualMetrics);
  assert.ok(metrics, 'COUNTRYSIDE must expose browser-rendered visual metrics');

  for (const view of views) {
    const selected = await page.evaluate((name) => globalThis.__turnSetCountrysideVisualView(name), view);
    assert.equal(selected, view, `Fixed visual camera ${view} must be selectable`);
    await page.screenshot({ path: path.join(outputDir, `${view}.png`), fullPage: true });
  }
} catch (error) {
  visualFailure = String(error?.stack || error?.message || error);
  const diagnostics = await page.evaluate(() => ({
    progress: [...(globalThis.__countrysideVisualProgress || [])],
    failure: globalThis.__countrysideVisualFailure || null,
    ready: globalThis.__countrysideVisualReady === true
  })).catch(() => ({ progress: [], failure: null, ready: false }));
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outputDir, 'failure.json'), `${JSON.stringify({ diagnostics, browserErrors, visualFailure }, null, 2)}\n`);
} finally {
  await browser.close();
}

if (visualFailure) throw new Error(visualFailure);

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  `${JSON.stringify({ metrics, browserErrors }, null, 2)}\n`
);

assert.equal(browserErrors.length, 0, `Browser-rendered COUNTRYSIDE produced errors:\n${browserErrors.join('\n')}`);
assert.equal(metrics.revision, 'r532-countryside-nature-polish');
assert.deepEqual(metrics.assetErrors, [], 'All local COUNTRYSIDE kit assets must load');
assert.deepEqual(metrics.districts, ['paddock', 'forest-edge', 'nature-landscape', 'windmill-farm', 'orchard', 'village', 'lake']);
assert.equal(metrics.villageHouses, 5, 'Birchfield must contain five deliberately planned houses');
assert.equal(metrics.privateDrives, 5, 'Each Birchfield home must have a logical private drive');
assert.equal(metrics.cropBeds, 10, 'The windmill farm must retain its ordered crop grid');
assert.equal(metrics.orchardTrees, 8, 'The orchard must retain two rows of four trees');
assert.equal(metrics.natureCopses, 5, 'Five composed Nature Kit copses should fill the formerly empty stretches');
assert.equal(metrics.natureCanopyTrees, 25, 'Nature copses should provide a substantial full-size canopy');
assert.equal(metrics.natureBushes, 15, 'Nature copses should include a coherent understorey layer');
assert.equal(metrics.natureGrassClumps, 10, 'Nature copses should use real grass geometry instead of coloured dots');
assert.equal(metrics.natureRocks, 5, 'Each Nature copse should have one restrained rock accent');
assert.equal(metrics.legacyPaddockPads, 0, 'The legacy parking slab must remain retired');
assert.equal(metrics.legacyPaddockBarriers, 0, 'The random coloured paddock blocks must remain retired');
assert.equal(metrics.proceduralFlowerDots, 0, 'Procedural coloured flower spheres must remain retired');
assert.equal(metrics.sectionColourOverlays, 0, 'Pink and other coloured verge overlays must remain retired');
assert.equal(metrics.sectionRepeaterPosts, 0, 'Legacy coloured T-shaped posts must remain retired');
assert.equal(metrics.sectionMaterialTints, 0, 'Scenery materials must not receive delayed section tinting');
assert.equal(metrics.parkedCars, 3, 'Only three purposefully parked scenery cars should remain');
assert.equal(metrics.rowBoats, 1, 'The lake should have one restrained moored rowboat');
assert.equal(metrics.windmills, 1, 'The requested windmill must remain as one complete landmark');
assert.equal(metrics.bellaScenes, 1, 'BELLA and her rescue tree must remain present exactly once');
assert.equal(metrics.oldGoldRings, 0, 'The unexplained gold ring must not return');
assert.equal(metrics.oldCrystalLandmarks, 0, 'Random zone crystals must not return');
assert.equal(metrics.oldScatteredBuildings, 0, 'Scattered Starter Kit buildings must not return');
assert.equal(metrics.oversizedFountains, 0, 'The oversized fountain decoration must not return');
assert.ok(metrics.lockedMeshCount >= 30, 'Authored kit palettes need broad scene-level protection');
assert.deepEqual(metrics.lockedPaletteViolations, [], 'Section colour must never recolour palette-locked kit assets');
assert.deepEqual(metrics.bellaPaletteViolations, [], 'BELLA and her tree must not be recoloured');
assert.ok(metrics.closestPlannedGeometryToBella >= 20,
  `New planned scenery intrudes on BELLA's protected composition: ${metrics.closestPlannedGeometryToBella.toFixed(2)} m`);
assert.ok(metrics.plannedTexturedMeshCount >= 8, 'Suburban houses and the boat must render with their supplied palettes');
assert.ok(metrics.windmillTexturedMeshCount >= 1, 'Windmill blades must render from the original Fantasy Town palette texture');
assert.equal(metrics.windmillPaletteLocked, true, 'Every windmill surface must keep its authored colour treatment');
assert.equal(metrics.gameplayGeometryUnchanged, true, 'The browser scene must report scenery-only world changes');

console.log('TURN COUNTRYSIDE browser visual smoke passed:', JSON.stringify(metrics));

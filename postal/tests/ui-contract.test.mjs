import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, main, sim, world, styles, worker, managementSim, managementUi, managementStyles] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('main.mjs', root), 'utf8'),
  readFile(new URL('sim.mjs', root), 'utf8'),
  readFile(new URL('world.mjs', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  readFile(new URL('sw.js', root), 'utf8'),
  readFile(new URL('management-sim.mjs', root), 'utf8'),
  readFile(new URL('management-ui.mjs', root), 'utf8'),
  readFile(new URL('management.css', root), 'utf8')
]);

test('every JavaScript ID selector has a matching unique HTML element', () => {
  const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
  assert.deepEqual(duplicateIds, []);
  const selectorIds = [...main.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(selectorIds)].filter((id) => !htmlIds.includes(id));
  assert.deepEqual(missing, []);
});

test('the primary navigation exposes depot, region and Sweden', () => {
  assert.match(html, /data-scene="terminal"[\s\S]*?<span>Depot<\/span>/);
  assert.match(html, /data-scene="network"[\s\S]*?<span>Region<\/span>/);
  assert.match(html, /data-scene="sweden"[\s\S]*?<span>Sweden<\/span>/);
  assert.match(html, /DEPOT FLOOR/);
  assert.doesNotMatch(html, /TOWN FLOOR/);
});

test('live play keeps package language while the slogan retains promise', () => {
  assert.match(html, /Every package has a promise/);
  assert.match(html, /Waiting and moving package batches/);
  assert.match(html, /before packages become late/);
  assert.doesNotMatch(html, /act before promises expire/);
  assert.doesNotMatch(html, /short express promises/);
});

test('teams and vehicles have a dismissible semantic planner', () => {
  assert.match(managementUi, /class=\"planner-close\"/);
  assert.match(managementUi, /function closePlanner/);
  assert.match(managementUi, /event\.key !== 'Escape'/);
  assert.match(managementUi, /closePlanner\(\{ restoreFocus: true \}\)/);
  assert.match(managementStyles, /\.resource-planner[\s\S]*position: fixed/);
  assert.match(managementSim, /processingDurationWithPlan/);
});

test('communication is separated from the 3D action area', () => {
  assert.match(managementUi, /communication-rail/);
  assert.match(managementUi, /renderCommunication/);
  assert.match(managementStyles, /\.communication-rail/);
  assert.match(managementStyles, /game-shell\[data-play-mode="live"\] \.command-deck[\s\S]*display: none/);
  assert.match(managementStyles, /\.toast[\s\S]*pointer-events: none/);
});

test('individual package investigation uses the existing 3D case scene', () => {
  assert.match(managementUi, /package-investigation/);
  assert.match(managementUi, /Inspect package/);
  assert.match(managementUi, /world\?\.setMode\?\.\('case'\)/);
  assert.match(managementUi, /investigation-history/);
  assert.match(managementUi, /Prioritise correct route/);
  assert.match(world, /buildCase\(\)/);
  assert.match(world, /CAMERA_PRESETS[\s\S]*case:/);
});

test('regional and national trucks remain direct interactions', () => {
  assert.match(managementUi, /ensureTruckHotspots/);
  assert.match(managementUi, /world\.markInteractive\(truck, hotspotId\)/);
  assert.match(managementUi, /postal-resource-activate/);
});

test('completed live shifts can continue into recurring overtime', () => {
  assert.match(managementUi, /continueOperationsButton/);
  assert.match(managementUi, /Keep operating/);
  assert.match(managementSim, /continue-operations/);
  assert.match(managementSim, /state\.overtime = true/);
  assert.match(managementSim, /addOvertimeWave/);
});

test('runtime uses short low-pass synthesized feedback', () => {
  assert.doesNotMatch(main, /new Audio\s*\(/);
  assert.match(main, /oscillator\.type = 'triangle'/);
  assert.match(main, /filter\.type = 'lowpass'/);
});

test('no-WebGL mode preserves semantic controls', () => {
  assert.match(main, /All live batches and destinations remain usable in the controls/);
  assert.match(html, /id="fallbackTargets" aria-label="Destinations in this level" hidden/);
  assert.match(main, /function renderFallbackTargets\(state\)/);
});

test('new build markers and offline assets bypass the previous cache', () => {
  assert.match(html, /build=20260806-layout-r1/);
  assert.match(html, /build=20260806-management-r2/);
  assert.match(worker, /postal-live-20260806-r6/);
  assert.match(worker, /management-ui\.mjs/);
  assert.match(worker, /management\.css/);
});

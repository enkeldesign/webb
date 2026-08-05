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

  const labelledByIds = [...html.matchAll(/aria-labelledby="([^"]+)"/g)]
    .flatMap((match) => match[1].split(/\s+/));
  assert.deepEqual([...new Set(labelledByIds)].filter((id) => !htmlIds.includes(id)), []);
});

test('the primary game navigation exposes town, region and Sweden as live levels', () => {
  assert.match(html, /data-scene="terminal"[\s\S]*?<span>Town<\/span>/);
  assert.match(html, /data-scene="network"[\s\S]*?<span>Region<\/span>/);
  assert.match(html, /data-scene="sweden"[\s\S]*?<span>Sweden<\/span>/);
  assert.match(html, /id="terminalAlert"/);
  assert.match(html, /id="networkAlert"/);
  assert.match(html, /id="swedenAlert"/);
  assert.doesNotMatch(html, /data-scene="case"/);
});

test('post-training play uses live parcel objects and scene destinations rather than answer prompts', () => {
  assert.match(html, /id="operationLayer" aria-labelledby="workQueueTitle"/);
  assert.match(main, /class="parcel-batch"/);
  assert.match(main, /data-action is intentionally absent|simulation\.perform\('select-job'/);
  assert.match(main, /simulation\.perform\('route-selected'/);
  assert.doesNotMatch(main, /Which promises|Choose the road|Repair or bypass|Where is the parcel/);
  assert.doesNotMatch(main, /allocate-truck|choose-recovery|find-similar|fix-rule/);
});

test('the national miniature includes Stockholm, Gothenburg and asset-led hubs', () => {
  assert.match(world, /buildSweden\(\)/);
  assert.match(world, /sweden-stockholm/);
  assert.match(world, /Stockholm hub/);
  assert.match(world, /sweden-gothenburg/);
  assert.match(world, /Gothenburg hub/);
  assert.match(world, /placeAsset\(group, 'roadIntersection'/);
  assert.match(world, /this\.swedenTrucks/);
});

test('NordPost, DLH, Brang and USP are represented as fictional live carriers', () => {
  for (const carrier of ['NordPost', 'DLH', 'Brang', 'USP']) assert.match(sim, new RegExp(carrier));
  assert.match(html, /They are fictional operators created for POSTAL/);
  assert.match(main, /carrier-legend/);
});

test('fresh-player onboarding remains guided while the live command deck has no action buttons', () => {
  assert.match(html, /FIRST SHIFT · CALM PRACTICE/);
  assert.match(main, /onboardingCommand/);
  assert.match(main, /The action happens there, not in this box/);
  assert.match(main, /if \(state\.shiftId === 'first-rounds'\) return onboardingCommand/);
  assert.match(styles, /\.command-content\[data-layout="live"\]/);
});

test('teams and vehicles have a compact semantic planner and matching assignments affect work', () => {
  assert.match(managementUi, /resource-plan-toggle/);
  assert.match(managementUi, /data-resource-id/);
  assert.match(managementUi, /Tap a resource to move it to the next lane or route/);
  assert.match(managementStyles, /\.resource-roster[\s\S]*overflow-x: auto/);
  assert.match(managementStyles, /\.resource-card\[data-busy="true"\]/);
  assert.match(managementSim, /processingDurationWithPlan/);
  assert.match(managementSim, /resource\.assignment === job\.target \? 0\.78 : 1\.22/);
});

test('regional and national trucks are direct canvas interactions with semantic alternatives', () => {
  assert.match(managementUi, /ensureTruckHotspots/);
  assert.match(managementUi, /world\.markInteractive\(truck, hotspotId\)/);
  assert.match(managementUi, /world\.registerHotspot\(hotspotId/);
  assert.match(managementUi, /postal-resource-activate/);
  assert.match(managementSim, /resource-R1|`resource-\$\{shortId\}`/);
});

test('completed live shifts can close the report and continue into recurring overtime', () => {
  assert.match(managementUi, /continueOperationsButton/);
  assert.match(managementUi, /Keep operating/);
  assert.match(managementSim, /continue-operations/);
  assert.match(managementSim, /state\.overtime = true/);
  assert.match(managementSim, /addOvertimeWave/);
  assert.match(html, /After a report, keep operating for endless waves/);
});

test('runtime uses only short low-pass synthesized feedback', () => {
  assert.doesNotMatch(main, /new Audio\s*\(/);
  assert.doesNotMatch(main, /assets\/audio/);
  assert.match(main, /oscillator\.type = 'triangle'/);
  assert.match(main, /filter\.type = 'lowpass'/);
  assert.match(main, /filter\.frequency\.setValueAtTime\(860/);
  assert.match(main, /master\.gain\.value = 0\.5/);
});

test('no-WebGL mode is guarded before all scene groups are dereferenced', () => {
  const setModeStart = world.indexOf('setMode(mode, immediate = false)');
  const guard = world.indexOf('if (!this.camera || !this.terminalGroup', setModeStart);
  const national = world.indexOf("this.swedenGroup.visible = mode === 'sweden'", setModeStart);
  assert.ok(setModeStart > 0);
  assert.ok(guard > setModeStart);
  assert.ok(national > guard);
  assert.match(main, /All live batches and destinations remain usable in the controls/);
  assert.match(html, /id="fallbackTargets" aria-label="Destinations in this level" hidden/);
  assert.match(main, /function renderFallbackTargets\(state\)/);
  assert.match(main, /data-fallback-target/);
  assert.match(styles, /\.fallback-targets button/);
});

test('direct canvas destinations retain projected semantic button alternatives', () => {
  for (const hotspot of [
    'express-lane',
    'standard-lane',
    'network-sundsvall',
    'network-harnosand',
    'network-timra',
    'network-matfors',
    'sweden-sundsvall',
    'sweden-stockholm',
    'sweden-gothenburg',
    'scanner',
    'network-detour',
    'sweden-relief'
  ]) {
    assert.match(world, new RegExp(`registerHotspot\\('${hotspot}'`), hotspot);
  }
  assert.match(world, /button\.type = 'button'/);
  assert.match(world, /button\.setAttribute\('aria-label'/);
});

test('portrait live controls are compact, horizontally scrollable and status-independent', () => {
  assert.match(styles, /\.operation-layer/);
  assert.match(styles, /\.parcel-rack[\s\S]*overflow-x: auto/);
  assert.match(styles, /\.parcel-batch\[aria-pressed="true"\]/);
  assert.match(styles, /\.parcel-cube\[data-service="express"\]/);
  assert.match(styles, /\.parcel-deadline\[data-late="true"\]/);
  assert.match(styles, /\.game-shell\[data-play-mode="live"\] \.command-deck/);
  assert.match(styles, /@media \(max-height: 700px\)[\s\S]*data-play-mode="live"/);
  assert.match(managementStyles, /@media \(max-height: 700px\)/);
});

test('new build markers and offline assets bypass the previous live cache', () => {
  assert.match(html, /build=20260805-live-r4/);
  assert.match(html, /build=20260806-management-r1/);
  assert.match(worker, /postal-live-20260806-r5/);
  assert.match(worker, /management-sim\.mjs/);
  assert.match(worker, /management-ui\.mjs/);
  assert.match(worker, /management\.css/);
});

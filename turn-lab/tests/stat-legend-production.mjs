import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { VEHICLE_STAT_LEGEND } from '../../turn/vehicle/catalog.js';

assert.deepEqual(
  VEHICLE_STAT_LEGEND.map((entry) => entry.label),
  ['TOP SPEED', 'ACCELERATION', 'CONTROL', 'DRIFT', 'BOOST POWER', 'BOOST TANK'],
  'The shared vehicle legend must expose the agreed six player-facing names'
);
assert.match(
  VEHICLE_STAT_LEGEND.find((entry) => entry.key === 'drift')?.description || '',
  /always slower than Gas/,
  'The DRIFT legend must state the permanent speed tradeoff'
);

const [index, releaseSource, wrapper, enhancementRuntime, legendModule, legendCss, lotSource, physicsSource] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(index, new RegExp(`lot-stat-legend\\.css\\?build=${release.cacheKey}`), 'Production must load the stat-legend styling through the current release');
assert.equal(imports['./garage/lot-r10.js?build=20260720-r19'], `./garage/lot-track-select.js?build=${release.cacheKey}`, 'Production must publish the compact Lot wrapper through the current release');
assert.equal(imports['./vehicle/physics.js?build=20260720-r19'], `./vehicle/physics.js?build=${release.cacheKey}`, 'Production must publish the mandatory DRIFT penalty through the current release');
assert.equal(imports['./vehicle/catalog.js?build=20260720-r19'], `./vehicle/catalog.js?build=${release.cacheKey}`, 'Production must publish the shared stat definitions through the current release');
assert.match(wrapper, /const lotResult = showOriginalLot\(options\)/, 'The verified Lot must mount synchronously before enhancement');
assert.ok(
  wrapper.indexOf('showOriginalLot(options)') < wrapper.indexOf('enhanceLotNow()'),
  'Enhancement must connect to the already-created synchronous Lot DOM'
);
assert.match(enhancementRuntime, /installLotStatLegend\(scope\)/, 'Every Lot route must mount the shared stat legend');
assert.ok(
  enhancementRuntime.indexOf('installLotStatLegend(scope)') < enhancementRuntime.indexOf('installLotLayout(scope)'),
  'The legend trigger must exist before the compact layout turns it into an info icon'
);
assert.match(legendModule, /VEHICLE_STAT_LEGEND/, 'The in-game legend must use the shared source of truth');
assert.match(legendModule, /aria-modal/, 'The legend must open as an accessible modal');
assert.match(legendModule, /WHAT DO THE STATS MEAN\?/, 'The legend trigger must be discoverable before the compact layout turns it into an info icon');
assert.doesNotMatch(legendModule, /mountObserver|subtree: true/, 'The legend module must not observe the whole game DOM');
assert.match(legendModule, /statsObserver\.observe\(stats, \{ childList: true \}\)/, 'Only actual car-stat replacement must trigger relabelling');
assert.match(legendModule, /label\.textContent !== definition\.label/, 'Relabelling must not rewrite unchanged labels');
assert.match(legendModule, /trigger\.remove\(\)/, 'Legend cleanup must remove its injected trigger');
assert.match(legendModule, /dialog\.remove\(\)/, 'Legend cleanup must remove its injected dialog');
assert.match(legendCss, /\.lot-stats-dialog\[hidden\]/, 'The closed legend must stay out of layout and interaction');
assert.match(lotSource, /\['ACCELERATION', vehicleStats\.acceleration\]/, 'The Lot renderer must expose the full agreed attribute name');
assert.match(physicsSource, /baseSpeedLimit \* effectiveDriftSpeedMultiplier/, 'Production physics must apply the DRIFT penalty to the active speed limit');
assert.match(physicsSource, /3\.2 \* driftStabilityMultiplier/, 'The DRIFT stat must improve recovery from a slide');
assert.match(physicsSource, /0\.42 \* driftStabilityMultiplier/, 'The DRIFT stat must improve lateral stability while the control is held');

console.log(`TURN ${release.id} route-independent shared vehicle stat legend passed.`);

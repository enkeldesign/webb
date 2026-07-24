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

const [index, wrapper, legendModule, legendCss, lotSource, physicsSource] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8')
]);

assert.match(index, /lot-stat-legend\.css\?build=20260724-r59/, 'Production must load the stat-legend styling');
assert.match(index, /lot-track-select\.js\?build=20260724-r59/, 'Production must cache-bust the enhanced Lot wrapper');
assert.match(index, /vehicle\/physics\.js\?build=20260724-r59/, 'Production must cache-bust the mandatory DRIFT penalty');
assert.match(index, /vehicle\/catalog\.js\?build=20260724-r59/, 'Production must cache-bust the shared stat definitions');
assert.match(wrapper, /installLotStatLegend\(\)/, 'The Lot flow must install the stat legend before car selection');
assert.match(legendModule, /VEHICLE_STAT_LEGEND/, 'The in-game legend must use the shared source of truth');
assert.match(legendModule, /aria-modal/, 'The legend must open as an accessible modal');
assert.match(legendModule, /WHAT DO THE STATS MEAN\?/, 'The legend trigger must be discoverable');
assert.match(legendCss, /\.lot-stats-dialog\[hidden\]/, 'The closed legend must stay out of layout and interaction');
assert.match(lotSource, /\['ACCEL', vehicleStats\.acceleration\]/, 'The stable Lot implementation must remain otherwise untouched');
assert.match(physicsSource, /baseSpeedLimit \* driftSpeedMultiplier/, 'Production physics must apply the DRIFT penalty to the active speed limit');

console.log('TURN shared in-game vehicle stat legend regression passed.');

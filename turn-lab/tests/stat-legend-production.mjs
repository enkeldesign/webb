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

const [
  index,
  releaseSource,
  wrapper,
  enhancementRuntime,
  legendModule,
  legendCss,
  lotCss,
  lotSource,
  physicsSource,
  achievementsEntry,
  homeRewardReplay
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/home-reward-replay-r225.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(index, new RegExp(`lot-stat-legend\\.css\\?build=${release.cacheKey}`), 'Production must load the stat-legend styling through the current release');
assert.equal(
  imports['./garage/lot-r10.js?build=20260720-r19'],
  `./garage/lot-track-select.js?build=${release.cacheKey}&revision=r223-training-car-taxi`,
  'Production must publish the optimized native HTML Lot wrapper through the current release'
);
assert.equal(
  imports['./vehicle/physics.js?build=20260720-r19'],
  `./vehicle/physics.js?build=${release.cacheKey}&revision=r233-graduated`,
  'Production must publish vehicle perks and the mandatory full-angle DRIFT penalty through a fresh release URL'
);
assert.equal(
  imports['./vehicle/catalog.js?build=20260720-r19'],
  '/turn/vehicle/catalog.js?revision=r240-trophy-road-2',
  'Production must publish fresh shared stat definitions through the canonical vehicle catalog'
);
assert.match(wrapper, /const lotResult = showOriginalLot\(options\)/, 'The verified Lot must mount synchronously before enhancement');
assert.ok(
  wrapper.indexOf('showOriginalLot(options)') < wrapper.indexOf('enhanceLotNow()'),
  'Enhancement must connect to the already-created synchronous Lot DOM'
);
assert.match(enhancementRuntime, /installLotStatLegend\(scope\)/, 'Every Lot route must mount the shared stat legend');
assert.match(enhancementRuntime, /lot-stat-legend\.js\?revision=r225-18-point-budget/,
  'The revised attribute explanation must load under a fresh module identity');
assert.ok(
  enhancementRuntime.indexOf('installLotStatLegend(scope)') < enhancementRuntime.indexOf('installLotLayout(scope)'),
  'The legend trigger must exist before the compact layout turns it into an info icon'
);
assert.match(legendModule, /VEHICLE_STAT_LEGEND/, 'The in-game legend must use the shared source of truth');
assert.match(legendModule, /aria-modal/, 'The legend must open as an accessible modal');
assert.match(legendModule, /WHAT DO THE STATS MEAN\?/, 'The legend trigger must be discoverable before the compact layout turns it into an info icon');
assert.match(legendModule, /Every car always has 18 attribute points in total\./,
  'The attribute modal must explain the fixed 18-point budget shared by every car');
assert.match(legendModule, /What changes is how those 18 points are distributed\./,
  'The attribute modal must explain that car identity comes from point distribution');
assert.doesNotMatch(
  legendModule,
  /GAS is fastest|DRIFT turns harder|BOOST is a limited burst/,
  'The yellow attribute summary must stay focused on the shared 18-point budget rather than repeat control behavior'
);
assert.doesNotMatch(legendModule, /mountObserver|subtree: true/, 'The legend module must not observe the whole game DOM');
assert.match(legendModule, /statsObserver\.observe\(stats, \{ childList: true \}\)/, 'Only actual car-stat replacement must trigger relabelling');
assert.match(legendModule, /label\.textContent !== definition\.label/, 'Relabelling must not rewrite unchanged labels');
assert.match(legendModule, /trigger\.remove\(\)/, 'Legend cleanup must remove its injected trigger');
assert.match(legendModule, /dialog\.remove\(\)/, 'Legend cleanup must remove its injected dialog');
assert.match(legendCss, /\.lot-stats-dialog\[hidden\]/, 'The closed legend must stay out of layout and interaction');
assert.match(lotCss, /\.lot-stat b \{[\s\S]*background: #fff;/, 'Empty stat cells must be white');
assert.match(lotCss, /\.lot-stat:nth-child\(1\) b\.is-full,[\s\S]*nth-child\(2\)[\s\S]*--turn-control-gas/, 'Top speed and acceleration must use the GAS green');
assert.match(lotCss, /\.lot-stat:nth-child\(3\) b\.is-full,[\s\S]*nth-child\(4\)[\s\S]*--turn-control-drift/, 'Control and drift must use the DRIFT blue');
assert.match(lotCss, /\.lot-stat:nth-child\(5\) b\.is-full,[\s\S]*nth-child\(6\)[\s\S]*--turn-control-boost/, 'Boost power and boost tank must use the BOOST yellow');
assert.match(lotSource, /\['ACCELERATION', vehicleStats\.acceleration\]/, 'The Lot renderer must expose the full agreed attribute name');
assert.match(physicsSource, /baseSpeedLimit \* effectiveDriftSpeedMultiplier/, 'Production physics must apply the DRIFT penalty to the active speed limit');
assert.match(physicsSource, /3\.2 \* driftStabilityMultiplier/, 'The DRIFT stat must improve recovery from a slide');
assert.match(physicsSource, /0\.42 \* driftStabilityMultiplier/, 'The DRIFT stat must improve lateral stability while the control is held');

assert.match(achievementsEntry, /home-reward-replay-r225\.js\?revision=r240-trophy-road-2/,
  'The achievements entry must install the Home reward reminder persistently');
assert.match(homeRewardReplay, /PENDING_STORAGE_KEY = 'turn-home-reward-replay-v1'/,
  'A reward reminder must survive closing the installed app or browser');
assert.match(homeRewardReplay, /window\.addEventListener\('turn:trophy-road-updated', handleRewardUpdate\)/,
  'New Trophy Road rewards must be captured synchronously when they unlock');
assert.match(homeRewardReplay, /document\.documentElement\.classList\.contains\('turn-home-ready'\)/);
assert.match(homeRewardReplay, /document\.body\.classList\.contains\('turn-home-open'\)/,
  'Reward reminders must be gated to the CHOOSE TRACK\/Home screen');
assert.match(homeRewardReplay, /document\.addEventListener\('turn:home-ready', handleHomeReady\)/,
  'A pending reward from a closed previous session must replay when the next Home becomes ready');
assert.match(homeRewardReplay, /const addedThisSession = new Set\(\)/);
assert.match(homeRewardReplay, /const shownAwayFromHome = new Set\(\)/,
  'The runtime must distinguish a reward already shown during the race from one first shown on Home');
assert.match(homeRewardReplay, /if \(!addedThisSession\.has\(id\)\) return true;/,
  'Rewards carried across sessions must be ready for immediate Home replay');
assert.match(homeRewardReplay, /if \(shownAwayFromHome\.has\(id\)\) return true;/,
  'A reward already shown in-race must be deliberately shown again after returning Home');
assert.match(homeRewardReplay, /consume\(currentIds\)/,
  'If the ordinary reward toast first appears after Home is already open, it must count as the Home reminder instead of duplicating immediately');

console.log(`TURN ${release.id} route-independent vehicle stat legend and persistent Home reward reminder passed.`);

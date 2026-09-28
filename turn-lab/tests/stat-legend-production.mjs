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
  garageSource,
  garageCss,
  physicsSource,
  achievementsEntry,
  homeRewardReplay
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/garage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/garage.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/home-reward-replay-r225.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.equal(
  imports['./vehicle/physics.js?build=20260720-r19'],
  `./vehicle/physics.js?build=${release.cacheKey}&revision=r233-graduated`,
  'Production must publish vehicle perks and the mandatory full-angle DRIFT penalty through a fresh release URL'
);
assert.equal(
  imports['./vehicle/catalog.js?build=20260720-r19'],
  `/turn/vehicle/catalog.js?build=${release.cacheKey}`,
  'Production must publish fresh shared stat definitions through the canonical vehicle catalog'
);

// GARAGE Specifications: the shared legend's names beside each meter; what each means,
// and the 18-point budget, appear (and are announced) once the player turns on
// Show explanations, which starts unchecked and is remembered.
assert.match(garageSource, /VEHICLE_STAT_LEGEND\.map\(\(\{ key, label, description \}\) =>/,
  'GARAGE uses the shared legend as its source of truth');
assert.match(garageSource, /aria-label="\$\{escapeHtml\(titleCase\(label\)\)\}: \$\{value\} out of 5\.\$\{shiftCopy\}\$\{explained \? ` \$\{escapeHtml\(description\)\}` : ''\}"/,
  'Each attribute is announced with its value, and what it means when explanations are on');
assert.match(garageSource, /\$\{explained \? `<small class="garage-spec-help" aria-hidden="true">\$\{escapeHtml\(description\)\}<\/small>` : ''\}/,
  'Each attribute shows what it means beside its meter when explanations are on');
assert.match(garageSource, /<label class="garage-spec-explain">\s*<input type="checkbox" id="garageSpecExplain">\s*<span>Show explanations<\/span>/,
  'Show explanations is a native, labelled checkbox under the Specifications heading');
assert.match(garageSource, /EXPLANATIONS_STORAGE_KEY = 'turn-garage-explanations-v1'/);
assert.match(garageSource, /getItem\(EXPLANATIONS_STORAGE_KEY\) === '1'/, 'Explanations start off');
assert.match(garageSource, /specNote\.hidden = !explained/, 'The 18-point note is an explanation too');
assert.match(garageSource, /Every car has 18 attribute points in total\. What changes is how they are shared out\./,
  'Specifications explain the fixed 18-point budget shared by every car');
assert.doesNotMatch(garageSource, /GAS is fastest|DRIFT turns harder|BOOST is a limited burst/);
assert.match(garageCss, /\.garage-spec-meter i \{[\s\S]*?background: var\(--turn-pr-card\)/, 'Empty stat cells stay light');
assert.match(garageCss, /\[data-stat='speed'\], \[data-stat='acceleration'\]\) \.garage-spec-meter i\.is-full \{\s*background: var\(--turn-control-gas/,
  'Top speed and acceleration use the GAS green');
assert.match(garageCss, /\[data-stat='control'\], \[data-stat='drift'\]\) \.garage-spec-meter i\.is-full \{\s*background: var\(--turn-control-drift/,
  'Control and drift use the DRIFT blue');
assert.match(garageCss, /\[data-stat='boostPower'\], \[data-stat='boostDuration'\]\) \.garage-spec-meter i\.is-full \{\s*background: var\(--turn-control-boost/,
  'Boost power and boost tank use the BOOST yellow');
assert.match(physicsSource, /baseSpeedLimit \* effectiveDriftSpeedMultiplier/, 'Production physics must apply the DRIFT penalty to the active speed limit');
assert.match(physicsSource, /3\.2 \* driftStabilityMultiplier/, 'The DRIFT stat must improve recovery from a slide');
assert.match(physicsSource, /0\.42 \* driftStabilityMultiplier/, 'The DRIFT stat must improve lateral stability while the control is held');

assert.match(achievementsEntry, /home-reward-replay-r225\.js\?revision=r244-reward-toast-guide/,
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
assert.match(homeRewardReplay, /turn:trophy-road-toast-shown/,
  'The ordinary reward toast must explicitly tell Home replay when it has actually been presented');
assert.match(homeRewardReplay, /turn:support-home-feedback-started/,
  'Home reward replay must yield to support completion feedback before replaying a reward');
assert.match(homeRewardReplay, /turn:support-home-feedback-ended/,
  'Home reward replay must resume only after support completion feedback is finished');

console.log(`TURN ${release.id} GARAGE vehicle stat legend and persistent Home reward reminder passed.`);

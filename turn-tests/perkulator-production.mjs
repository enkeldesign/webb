import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TROPHY_ROAD_REWARDS, TROPHY_ROAD_STORAGE_KEY, rewardForFeature } from '../turn/progression/trophy-road.js';
import { VEHICLE_PERKS } from '../turn/vehicle/perks.js';
import {
  PERKULATOR_CHANGE_EVENT,
  PERKULATOR_FEATURE_ID,
  PERKULATOR_STORAGE_KEY,
  cloneablePerkFor,
  clonePerk,
  installPerk,
  installablePerksFor,
  installedPerkFor,
  isPerkCloned,
  isPerkulatorUnlocked,
  normalizePerkulatorState,
  readPerkulatorState,
  removeInstalledPerk
} from '../turn/vehicle/perkulator.js';

// PERKULATOR (#1219): a car's own perk may be cloned, once, from a car you have whose
// perk is unlocked; any other car may install one cloned perk beside its own. Until
// Trophy Road carries the reward, admin profiles alone have it.
function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}
const ADMIN_MARKER = { 'turn-admin-unlock-v1': JSON.stringify({ version: 2 }) };
const rewardState = (ids) => ({ [TROPHY_ROAD_STORAGE_KEY]: JSON.stringify({ version: 10, rewards: { unlocked: ids } }) });
const everyReward = TROPHY_ROAD_REWARDS.map(({ id }) => id);

// Node has CustomEvent; the page's window is stood in for by a recorder.
const events = [];
globalThis.dispatchEvent = (event) => events.push([event.type, event.detail]);

assert.equal(rewardForFeature(PERKULATOR_FEATURE_ID), null, 'Not on Trophy Road yet');
const player = memoryStorage(rewardState(everyReward));
assert.equal(isPerkulatorUnlocked(player), false, 'A player profile has no PERKULATOR before Trophy Road carries it');
assert.equal(clonePerk('vintage-racer', player), false);
assert.equal(installedPerkFor('suv', memoryStorage({
  ...rewardState(everyReward),
  [PERKULATOR_STORAGE_KEY]: JSON.stringify({ cloned: ['driftage'], installed: { suv: 'driftage' } })
})), '', 'Without PERKULATOR, a stored installed perk does not run');

const admin = memoryStorage({ ...ADMIN_MARKER, ...rewardState(everyReward) });
assert.equal(isPerkulatorUnlocked(admin), true, 'Admin profiles have PERKULATOR to try on device');

// Cloning: eight perks may be cloned; LEGENDARY perks, TWITCHY TURNY among them, never.
const cloneable = VEHICLE_PERKS.filter((perk) => perk.cloneable).map(({ id }) => id).sort();
assert.deepEqual(cloneable, ['apex-grip', 'carry-on', 'clean-exit', 'drift-demon', 'driftage', 'full-tank', 'torque', 'traction']);
for (const carId of ['classic', 'toy-racer', 'race-future', 'sedan', 'supercar', 'monster-truck', 'tractor', 'police']) {
  assert.equal(cloneablePerkFor(carId, admin), null, `${carId}: a LEGENDARY perk stays with its car`);
}
assert.equal(clonePerk('vintage-racer', admin), true);
assert.equal(clonePerk('vintage-racer', admin), false, 'A perk is cloned once: a lasting entitlement, not a copy');
assert.equal(isPerkCloned('driftage', admin), true);
assert.deepEqual(events.at(-1), [PERKULATOR_CHANGE_EVENT, { action: 'clone', vehicleId: 'vintage-racer', perkId: 'driftage' }]);
// Only from a car you have, once its perk is unlocked.
const lockedCar = memoryStorage({ ...ADMIN_MARKER, ...rewardState(everyReward.filter((id) => id !== 'vintage-racer')) });
assert.equal(cloneablePerkFor('vintage-racer', lockedCar), null, 'Not from a car still locked on Trophy Road');
const lockedPerk = memoryStorage({ ...ADMIN_MARKER, ...rewardState(everyReward.filter((id) => id !== 'suv-full-tank')) });
assert.equal(cloneablePerkFor('suv', lockedPerk), null, 'Not a perk still locked on Trophy Road');

// Installing: a cloned perk, on any car but its own, one per car; replacing never
// touches the car's own perk.
assert.deepEqual(installablePerksFor('vintage-racer', admin), [], 'A car is never offered its own perk');
assert.deepEqual(installablePerksFor('truck', admin).map(({ id }) => id), ['driftage']);
assert.equal(installPerk('truck', 'full-tank', admin), false, 'Only a cloned perk installs');
assert.equal(installPerk('truck', 'driftage', admin), true);
assert.equal(installPerk('truck', 'driftage', admin), false, 'Installing the installed perk changes nothing');
assert.equal(installedPerkFor('truck', admin), 'driftage');
assert.deepEqual(events.at(-1), [PERKULATOR_CHANGE_EVENT, { action: 'install', vehicleId: 'truck', perkId: 'driftage' }]);
assert.equal(clonePerk('suv', admin), true);
assert.equal(installPerk('truck', 'full-tank', admin), true, 'Installing replaces the installed perk');
assert.equal(installPerk('no-such-car', 'full-tank', admin), false);
assert.equal(installPerk('suv', 'full-tank', admin), false, 'Never the car\'s own perk');
assert.equal(installPerk('race-future', 'full-tank', admin), true, 'FULL TANK on the Future Racer, beside OVERDRIVE');
assert.deepEqual(readPerkulatorState(admin), {
  version: 1,
  cloned: ['driftage', 'full-tank'],
  installed: { truck: 'full-tank', 'race-future': 'full-tank' }
}, 'Each car keeps its own installed perk');
assert.equal(removeInstalledPerk('truck', admin), true);
assert.equal(removeInstalledPerk('truck', admin), false);
assert.deepEqual([installedPerkFor('truck', admin), installedPerkFor('race-future', admin)], ['', 'full-tank'],
  'Removing touches only that car');
assert.deepEqual(events.at(-1), [PERKULATOR_CHANGE_EVENT, { action: 'remove', vehicleId: 'truck', perkId: '' }]);

// A saved state keeps only what may be: cloneable perks, cloned ones installed, never a
// car's own, never on an unknown car.
assert.deepEqual(normalizePerkulatorState(JSON.stringify({
  cloned: ['twitchy-turny', 'overdrive', 'full-tank', 'full-tank', 'nope', 7],
  installed: { suv: 'full-tank', 'race-future': 'full-tank', truck: 'driftage', 'no-car': 'full-tank', van: 'overdrive' }
})), { version: 1, cloned: ['full-tank'], installed: { 'race-future': 'full-tank' } });
assert.deepEqual(normalizePerkulatorState('{broken'), { version: 1, cloned: [], installed: {} });

// The page's own storage: YOUR TURN isolates it, so a challenger races without a TURN
// player's installed perks.
const [perkulatorSource, mainSource, garageSource, garagePerkulatorSource, presentationSource] = await Promise.all([
  fs.readFile(new URL('../turn/vehicle/perkulator.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/garage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/garage-perkulator.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/vehicle/perk-presentation.js', import.meta.url), 'utf8')
]);
assert.match(perkulatorSource, /return globalThis\.localStorage;/);
assert.doesNotMatch(perkulatorSource, /__TURN_SHARED_LOCAL_STORAGE__/, 'Never the storage TURN shares with YOUR TURN');
assert.match(perkulatorSource, /if \(rewardForFeature\(PERKULATOR_FEATURE_ID\)\) return isFeatureUnlocked\(PERKULATOR_FEATURE_ID, target\);/,
  'Once on Trophy Road, the reward unlocks it');

// The race runs the selected car's installed perk, read where the car is chosen and
// again whenever an entitlement or PERKULATOR changes.
assert.match(mainSource, /vehicleInstalledPerkId: installedPerkFor\(initialVehicleSelection\.carId\)/);
assert.match(mainSource, /state\.vehicleInstalledPerkId = installedPerkFor\(saved\.carId\);\s*resetVehiclePerkRuntimeState\(state\);/);
assert.match(mainSource, /const installed = installedPerkFor\(state\.vehicleId\);[\s\S]*state\.vehicleInstalledPerkId = installed;\s*resetVehiclePerkRuntimeState\(state\);/);
assert.match(mainSource, /window\.addEventListener\(PERKULATOR_CHANGE_EVENT, syncSelectedVehiclePerkEntitlement\)/);
// Both slots say when they fill, by perk id.
assert.match(mainSource, /perkId: state\.vehiclePerkRuntimeOriginalId,[\s\S]*\|\| resolveVehiclePerkStatusFeedback\(\{\s*perkId: state\.vehiclePerkRuntimeInstalledId/);
assert.doesNotMatch(presentationSource, /resolveVehiclePerkStatusFeedback[\s\S]*vehicleId === '(suv|truck|sedan-sports)'/);

// GARAGE: PERKULATOR lives in the PERK disclosure and follows every change.
assert.match(garageSource, /createGaragePerkulator\(\{[\s\S]*panel: perkPanel,[\s\S]*copy: perkCopy,/);
assert.match(garageSource, /windowRef\.addEventListener\(PERKULATOR_CHANGE_EVENT, handlePerkulatorChange\)/);
assert.match(garageSource, /windowRef\.removeEventListener\(PERKULATOR_CHANGE_EVENT, handlePerkulatorChange\)/);
assert.match(garageSource, /perkulator\.sync\(car, \{ playable: !selection\.state\(\)\.preview \}\)/, 'Never for a locked preview');
assert.match(garagePerkulatorSource, /const active = Boolean\(own\) && playable && isPerkulatorUnlocked\(\);/);
assert.match(garagePerkulatorSource, /<span class="garage-visually-hidden">Rarity <\/span>\$\{label\}/, 'Rarity is written, never colour alone');

console.log('PERKULATOR clones eight perks, installs one per car beside its own, stays with admin profiles until Trophy Road and never reaches YOUR TURN.');

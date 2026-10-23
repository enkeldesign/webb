import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TROPHY_ROAD_REWARDS, TROPHY_ROAD_STORAGE_KEY, rewardForFeature, rewardForVehicle, rewardForVehiclePerk } from '../turn/progression/trophy-road.js';
import { VEHICLE_PERKS, getVehiclePerk } from '../turn/vehicle/perks.js';
import {
  PERKULATOR_CHANGE_EVENT,
  PERKULATOR_FEATURE_ID,
  PERKULATOR_STORAGE_KEY,
  installPerk,
  installablePerksFor,
  installedPerkFor,
  isPerkAvailable,
  isPerkulatorUnlocked,
  normalizePerkulatorState,
  perkUnlockRequirement,
  perkulatorChoicesFor,
  readPerkulatorState,
  removeInstalledPerk
} from '../turn/vehicle/perkulator.js';

// PERKULATOR (#1219): any car may install one perk beside its own. It holds every perk
// you have unlocked that may leave its car, with nothing to clone first (#1228). It is a
// Trophy Road reward, at 2000 trophies.
function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}
const rewardState = (ids) => ({ [TROPHY_ROAD_STORAGE_KEY]: JSON.stringify({ version: 10, unlocked: { 'first-turn': { unlockedAt: 1 } }, rewards: { unlocked: ids } }) });
const everyReward = TROPHY_ROAD_REWARDS.map(({ id }) => id);

// Node has CustomEvent; the page's window is stood in for by a recorder.
const events = [];
globalThis.dispatchEvent = (event) => events.push([event.type, event.detail]);

assert.equal(rewardForFeature(PERKULATOR_FEATURE_ID)?.id, 'perkulator', 'PERKULATOR is a Trophy Road reward');
assert.equal(rewardForFeature(PERKULATOR_FEATURE_ID)?.threshold, 2000);
assert.equal(isPerkulatorUnlocked(memoryStorage()), false, 'A new player has no PERKULATOR');
// A profile holding other rewards still needs PERKULATOR itself.
const beforePerkulator = { ...rewardState(everyReward.filter((id) => id !== 'perkulator')) };
const player = memoryStorage(beforePerkulator);
assert.equal(isPerkulatorUnlocked(player), false, 'Every other reward, but no PERKULATOR without its own');
assert.equal(isPerkAvailable('carry-on', player), false, 'Without PERKULATOR it holds nothing');
assert.deepEqual(installablePerksFor('truck', player), []);
assert.equal(installPerk('truck', 'carry-on', player), false);
assert.equal(installedPerkFor('suv', memoryStorage({
  ...beforePerkulator,
  [PERKULATOR_STORAGE_KEY]: JSON.stringify({ installed: { suv: 'carry-on' } })
})), '', 'Without PERKULATOR, a stored installed perk does not run');

const admin = memoryStorage({ ...rewardState(everyReward) });
assert.equal(isPerkulatorUnlocked(admin), true, 'Its reward unlocks PERKULATOR');

// PERKULATOR holds the eight perks that may leave their car, each once unlocked, with
// nothing to clone first. LEGENDARY perks, TWITCHY TURNY among them, never leave theirs.
// #1273: SMV (COMMON) may now leave the Tractor; DRIFTAGE (LEGENDARY) stays on the Vintage Racer.
const movable = VEHICLE_PERKS.filter((perk) => perk.installable).map(({ id }) => id).sort();
assert.deepEqual(movable, ['apex-grip', 'carry-on', 'clean-exit', 'drift-demon', 'full-tank', 'smv', 'torque', 'traction']);
assert.deepEqual(VEHICLE_PERKS.filter(({ id }) => isPerkAvailable(id, admin)).map(({ id }) => id).sort(), movable,
  'With every reward, PERKULATOR holds every perk that may move');
for (const perkId of ['graduated', 'twitchy-turny', 'overdrive', 'double-shift', 'flow-shift', 'oversized', 'driftage', 'sirens']) {
  assert.equal(isPerkAvailable(perkId, admin), false, `${perkId}: a LEGENDARY perk stays with its car`);
}
// Each once one of its cars and the perk itself are unlocked.
const lockedCar = memoryStorage({ ...rewardState(everyReward.filter((id) => id !== 'compact')) });
assert.equal(isPerkAvailable('clean-exit', lockedCar), false, 'Not while its car is locked on Trophy Road');
assert.equal(isPerkAvailable('smv', lockedCar), true, 'SMV comes with the Tractor, a starting car');
const lockedPerk = memoryStorage({ ...rewardState(everyReward.filter((id) => id !== 'suv-full-tank')) });
assert.equal(isPerkAvailable('full-tank', lockedPerk), false, 'Not while the perk is locked on Trophy Road');
assert.equal(isPerkAvailable('torque', lockedPerk), true, 'TORQUE comes with the Truck once DRIFT ATTACK is unlocked');
// #1274: PERKULATOR shows a car every perk it may ever install, available or locked,
// in rarity and name order. Never its own, never one that stays with its car. A locked
// choice says how it unlocks and still cannot be installed.
const choiceIds = (choices) => choices.map(({ perk }) => perk.id);
const lockedChoices = perkulatorChoicesFor('truck', lockedCar);
assert.deepEqual(choiceIds(lockedChoices), choiceIds(perkulatorChoicesFor('truck', admin)), 'Locked or not, the same perks in the same order');
assert.deepEqual(choiceIds(lockedChoices),
  ['clean-exit', 'smv', 'carry-on', 'drift-demon', 'hunter', 'traction', 'apex-grip', 'full-tank', 'locked-in', 'precision', 'response-time', 'road-rage', 'turbo']);
assert.equal(choiceIds(lockedChoices).includes('torque'), false, 'Never the car’s own perk');
assert.equal(choiceIds(lockedChoices).includes('driftage'), false, 'Never a perk that stays with its car');
assert.deepEqual(lockedChoices.filter(({ available }) => !available).map(({ perk }) => perk.id),
  ['clean-exit', 'hunter', 'locked-in', 'precision', 'response-time', 'road-rage', 'turbo'],
  'The COMPACT is locked, and no collection is complete');
const compactReward = rewardForVehicle('compact');
assert.equal(perkUnlockRequirement(lockedChoices[0].perk, lockedCar),
  `Unlocks with ${compactReward.title} at ${compactReward.threshold} trophies on Trophy Road.`, 'A locked car says its Trophy Road reward');
const fullTankReward = rewardForVehiclePerk('suv');
assert.equal(perkUnlockRequirement(getVehiclePerk('full-tank'), lockedPerk),
  `Unlocks with ${fullTankReward.title} at ${fullTankReward.threshold} trophies on Trophy Road.`, 'A locked perk says its own reward');
assert.equal(perkUnlockRequirement(getVehiclePerk('precision'), lockedCar), 'Complete DRIFT MASTER to unlock.', 'A collection reward says its master');
assert.equal(installPerk('truck', 'clean-exit', lockedCar), false, 'A locked choice cannot be installed');
assert.equal(installPerk('truck', 'precision', lockedCar), false);

const beforeDriftAttack = memoryStorage({ ...rewardState(everyReward.filter((id) => id !== 'drift-attack')) });
assert.equal(isPerkAvailable('torque', beforeDriftAttack), false,
  'TORQUE works through OVERCHARGE, so it waits for DRIFT ATTACK (#1232)');

// Installing: on any car but the perk's own, one per car; replacing never touches the
// car's own perk.
assert.equal(installablePerksFor('van', admin).some(({ id }) => id === 'carry-on'), false,
  'A car is never offered its own perk');
assert.deepEqual(installablePerksFor('truck', admin).map(({ id }) => id).sort(), movable.filter((id) => id !== 'torque'),
  'The Truck may install every perk PERKULATOR holds but TORQUE');
assert.equal(installPerk('truck', 'graduated', admin), false, 'Never a LEGENDARY perk');
assert.equal(installPerk('truck', 'carry-on', admin), true, 'Nothing to clone first');
assert.equal(installPerk('truck', 'carry-on', admin), false, 'Installing the installed perk changes nothing');
assert.equal(installedPerkFor('truck', admin), 'carry-on');
assert.deepEqual(events.at(-1), [PERKULATOR_CHANGE_EVENT, { action: 'install', vehicleId: 'truck', perkId: 'carry-on' }]);
assert.equal(installPerk('truck', 'full-tank', admin), true, 'Installing replaces the installed perk');
assert.equal(installPerk('no-such-car', 'full-tank', admin), false);
assert.equal(installPerk('suv', 'full-tank', admin), false, 'Never the car\'s own perk');
assert.equal(installPerk('race-future', 'full-tank', admin), true, 'FULL TANK on the Future Racer, beside OVERDRIVE');
assert.equal(installPerk('truck', 'full-tank', lockedPerk), false, 'Never a perk still locked on Trophy Road');
assert.deepEqual(readPerkulatorState(admin), {
  version: 1,
  installed: { truck: 'full-tank', 'race-future': 'full-tank' }
}, 'Each car keeps its own installed perk, and only those are saved');
assert.equal(removeInstalledPerk('truck', admin), true);
assert.equal(removeInstalledPerk('truck', admin), false);
assert.deepEqual([installedPerkFor('truck', admin), installedPerkFor('race-future', admin)], ['', 'full-tank'],
  'Removing touches only that car');
assert.deepEqual(events.at(-1), [PERKULATOR_CHANGE_EVENT, { action: 'remove', vehicleId: 'truck', perkId: '' }]);

// A saved state keeps only what may be: installed perks that may leave their car, never
// a car's own, never on an unknown car. The clone list r464 to r467 saved is let go, and
// the perks they installed keep running.
assert.deepEqual(normalizePerkulatorState(JSON.stringify({
  cloned: ['twitchy-turny', 'overdrive', 'full-tank', 'nope', 7],
  installed: { suv: 'full-tank', 'race-future': 'full-tank', truck: 'carry-on', 'no-car': 'full-tank', van: 'overdrive' }
})), { version: 1, installed: { 'race-future': 'full-tank', truck: 'carry-on' } });
assert.deepEqual(normalizePerkulatorState('{broken'), { version: 1, installed: {} });

// #1273: a DRIFTAGE installed on another car before it became LEGENDARY stops running,
// and the clean state is written back. Every other installed perk stays, SMV included.
const migrated = memoryStorage({
  ...rewardState(everyReward),
  [PERKULATOR_STORAGE_KEY]: JSON.stringify({ version: 1, installed: { suv: 'driftage', van: 'smv', truck: 'full-tank' } })
});
assert.equal(installedPerkFor('suv', migrated), '', 'A foreign DRIFTAGE no longer runs');
assert.deepEqual(JSON.parse(migrated.getItem(PERKULATOR_STORAGE_KEY)),
  { version: 1, installed: { van: 'smv', truck: 'full-tank' } }, 'and is cleaned from storage');
assert.deepEqual([installedPerkFor('van', migrated), installedPerkFor('truck', migrated)], ['smv', 'full-tank']);
assert.equal(installPerk('suv', 'driftage', migrated), false, 'DRIFTAGE cannot be installed again');
assert.equal(installablePerksFor('suv', migrated).some(({ id }) => id === 'driftage'), false, 'PERKULATOR no longer offers DRIFTAGE');
assert.equal(installPerk('suv', 'smv', migrated), true, 'SMV can be installed on another car');
assert.equal(installedPerkFor('toy-racer', memoryStorage({
  ...rewardState(everyReward),
  [PERKULATOR_STORAGE_KEY]: JSON.stringify({ version: 1, cloned: ['carry-on'], installed: { 'toy-racer': 'carry-on' } })
})), 'carry-on', 'A perk installed with a clone keeps running');

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
assert.match(perkulatorSource, /export function isPerkulatorUnlocked\(storage\) \{\s*return isFeatureUnlocked\(PERKULATOR_FEATURE_ID, storageFor\(storage\)\);\s*\}/,
  'Its Trophy Road reward alone unlocks it');
assert.doesNotMatch(perkulatorSource, /turn-admin-unlock-v1/, 'No admin path of its own');

// The race runs the selected car's installed perk, read where the car is chosen and
// again whenever an entitlement or PERKULATOR changes.
assert.match(mainSource, /vehicleInstalledPerkId: installedPerkFor\(initialVehicleSelection\.carId\)/);
assert.match(mainSource, /state\.vehicleInstalledPerkId = installedPerkFor\(saved\.carId\);\s*resetVehiclePerkRuntimeState\(state\);/);
assert.match(mainSource, /const installed = installedPerkFor\(state\.vehicleId\);[\s\S]*state\.vehicleInstalledPerkId = installed;\s*resetVehiclePerkRuntimeState\(state\);/);
assert.match(mainSource, /window\.addEventListener\(PERKULATOR_CHANGE_EVENT, syncSelectedVehiclePerkEntitlement\)/);
// Both slots say when they fill, by perk id.
assert.match(mainSource, /perkId: state\.vehiclePerkRuntimeOriginalId,[\s\S]*!originalPerkFeedback && resolveVehiclePerkStatusFeedback\(\{\s*perkId: state\.vehiclePerkRuntimeInstalledId/);
assert.doesNotMatch(presentationSource, /resolveVehiclePerkStatusFeedback[\s\S]*vehicleId === '(suv|truck|sedan-sports)'/);

// GARAGE: PERKULATOR lives in the PERK disclosure and follows every change.
assert.match(garageSource, /createGaragePerkulator\(\{[\s\S]*panel: perkPanel,[\s\S]*copy: perkCopy,/);
assert.match(garageSource, /windowRef\.addEventListener\(PERKULATOR_CHANGE_EVENT, handlePerkulatorChange\)/);
assert.match(garageSource, /windowRef\.removeEventListener\(PERKULATOR_CHANGE_EVENT, handlePerkulatorChange\)/);
assert.match(garageSource, /perkulator\.sync\(car, \{ playable: !selection\.state\(\)\.preview \}\)/, 'Never for a locked preview');
assert.match(garagePerkulatorSource, /const active = Boolean\(own\) && playable && isPerkulatorUnlocked\(\);/);
assert.match(garagePerkulatorSource, /<span class="garage-visually-hidden">Rarity <\/span>\$\{label\}/, 'Rarity is written, never colour alone');
assert.doesNotMatch(`${perkulatorSource}\n${garagePerkulatorSource}`, /clonePerk|cloneable|CLONE PERK|CLONED/, 'No clone step (#1228)');

console.log('PERKULATOR unlocks at 2000 trophies, holds the eight perks that may move once unlocked, installs one per car beside its own and never reaches YOUR TURN.');

// Collection entitlements survive skipped releases, the old combined master and
// earning before PERKULATOR. Installing still has exactly one slot per car.
const { ACHIEVEMENT_FAMILIES, getAchievement } = await import('../turn/achievements/catalog.js');
const { createAchievementStore, ACHIEVEMENT_STORAGE_KEY } = await import('../turn/achievements/store.js');
const { ACHIEVEMENT_PERKS } = await import('../turn/vehicle/perks.js');
const { achievementRewardMarkup, achievementRewardText } = await import('../turn/achievements/reward-presentation.js');
const { perkSourceLabel } = await import('../turn/vehicle/perk-presentation.js');
const legacyPlayer = memoryStorage({ [ACHIEVEMENT_STORAGE_KEY]: JSON.stringify({
  version: 10, unlocked: {
    'drift-flow-master': { unlockedAt: 42, trackId: 'airport' },
    'faster-than-the-dev': { unlockedAt: 43 }, 'on-course-of-course': { unlockedAt: 44 },
    'an-army-of-me': { unlockedAt: 45 }
  }
}) });
const legacyStore = createAchievementStore(legacyPlayer);
assert.equal(legacyStore.trophyTotal(), 900, 'All historical master trophies survive, including the retired master');
assert.equal(legacyStore.isUnlocked('drift-master'), true);
assert.equal(legacyStore.isUnlocked('flow-master'), true);
assert.equal(legacyStore.state.unlocked['drift-master'].awardedTrophies, 0);
assert.equal(legacyStore.state.unlocked['drift-flow-master'].trackId, 'airport');
assert.equal(isPerkAvailable('precision', legacyPlayer), false, 'Earned before PERKULATOR, unavailable to install');
assert.equal(installPerk('truck', 'precision', legacyPlayer), false);
assert.doesNotMatch(achievementRewardText(getAchievement('drift-master'), { earned: true }), /PRECISION/);
// #1274: a PERK reward gets a row of its own: REWARD:, the rarity in words on its chip,
// the name, and where it goes once earned. Concealed until PERKULATOR, as before.
const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
assert.doesNotMatch(achievementRewardMarkup(getAchievement('drift-master'), { earned: true }), /PRECISION|EPIC/);
assert.equal(plain(achievementRewardMarkup(getAchievement('drift-master'), { earned: true })), 'REWARD: Earned, revealed with PERKULATOR');
assert.equal(plain(achievementRewardMarkup(getAchievement('drift-master'), { revealed: true, earned: true })),
  'REWARD: Rarity EPIC PRECISION perk Install in PERKULATOR');
assert.match(achievementRewardMarkup(getAchievement('drift-master'), { revealed: true }), /class="turn-pr-chip is-epic"/);
assert.equal(achievementRewardMarkup(getAchievement('first-turn'), { revealed: true }), '', 'Trophy achievements keep their trophy count');
legacyStore.grantBonus('perkulator-test', 2000);
legacyStore.syncRewards();
assert.equal(isPerkAvailable('precision', legacyPlayer), true, 'PERKULATOR reveals the old entitlement without replay');
assert.equal(isPerkAvailable('locked-in', legacyPlayer), true);
assert.equal(installPerk('truck', 'precision', legacyPlayer), true);
assert.equal(installPerk('truck', 'turbo', legacyPlayer), true);
assert.deepEqual(readPerkulatorState(legacyPlayer).installed, { truck: 'turbo' });
assert.equal(createAchievementStore(legacyPlayer).trophyTotal(), 2900, 'Migration is idempotent');
for (const family of ACHIEVEMENT_FAMILIES) {
  const storage = memoryStorage();
  const store = createAchievementStore(storage);
  store.batch(() => { for (const id of family.childIds) store.unlock(id); });
  const childTotal = family.childIds.reduce((sum, id) => sum + getAchievement(id).trophies, 0);
  const completed = store.syncCollectionMasters();
  assert.equal(completed.some(({ id }) => id === family.masterId), true);
  assert.equal(store.trophyTotal(), childTotal, 'New mastery grants no additional trophies');
  assert.equal(store.state.unlocked[family.masterId].awardedTrophies, 0);
  assert.deepEqual(store.syncCollectionMasters(), [], 'No repeated master grant');
  const perk = ACHIEVEMENT_PERKS.find(({ achievementId }) => achievementId === family.masterId);
  assert.equal(getAchievement(family.masterId).reward.perkId, perk.id);
  assert.equal(perkSourceLabel(perk), getAchievement(family.masterId).title);
  if (family.masterId === 'drift-master') assert.equal(store.isUnlocked('flow-master'), false, 'DRIFT completes independently');
  if (family.masterId === 'flow-master') assert.equal(store.isUnlocked('drift-master'), false, 'FLOW completes independently');
  store.grantBonus('reveal', 2000); store.syncRewards();
  assert.equal(isPerkAvailable(perk.id, storage), true);
  assert.equal(installPerk('truck', perk.id, storage), true);
  assert.equal(installedPerkFor('truck', storage), perk.id);
}
const allCollections = createAchievementStore(admin);
allCollections.batch(() => { for (const family of ACHIEVEMENT_FAMILIES) for (const id of family.childIds) allCollections.unlock(id); });
allCollections.syncCollectionMasters();
const sortedChoices = installablePerksFor('truck', admin);
const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
assert.deepEqual(sortedChoices, [...sortedChoices].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity] || a.title.localeCompare(b.title, 'en')));
console.log('Collection reward migration, independent masters, delayed reveal, installation, source labels and rarity ordering pass.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createAchievementStore, normalizeAchievementState } from '../../turn/achievements/store.js';
import { ACHIEVEMENTS } from '../../turn/achievements/catalog.js';
import { getCarDefinition } from '../../turn/vehicle/catalog.js';
import {
  TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_STORAGE_KEY,
  TROPHY_ROAD_STORAGE_VERSION,
  getTrophyRoadReward,
  grandfatheredRewardIdsForVersion,
  isFeatureUnlocked,
  isPaintUnlocked,
  isTrackUnlocked,
  isVehiclePerkUnlocked,
  isVehicleUnlocked,
  prepareTrophyRoadProfile,
  readTrophyRoadSnapshot,
  migrateStoredRewardIdsForVersion,
  rewardForFeature,
  rewardForTrack,
  rewardForVehicle,
  rewardForVehiclePerk,
  trophyRoadOverview
} from '../../turn/progression/trophy-road.js';
import {
  TROPHY_ROAD_MAX_THRESHOLD as PRODUCTION_TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS as PRODUCTION_TROPHY_ROAD_REWARDS,
  getTrophyRoadReward as getProductionTrophyRoadReward,
  rewardIdsForTrophies as productionRewardIdsForTrophies
} from '../../turn/progression/trophy-road.js';

const [
  roadSource,
  roadStyles,
  view,
  feedback,
  app,
  workflow,
  perkDisclosure,
  enhancementRuntime,
  perkWrapper,
  homeGate,
  lotGate,
  paintGate
] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/trophy-road.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road-r157.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/trophy-road-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/roadbook/roadbook.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8')
]);

function createMemoryStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  return {
    get length() { return memory.size; },
    key(index) { return [...memory.keys()][index] ?? null; },
    getItem(key) { return memory.get(key) ?? null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); }
  };
}

const productionRewardIds = PRODUCTION_TROPHY_ROAD_REWARDS.map((reward) => reward.id);
const through400 = ['medium-tracks'];
const through500 = [...through400, 'awd-traction'];
const through600 = [...through500, 'drift-attack'];
const through700 = [...through600, 'advanced-tracks'];
const through800 = [...through700, 'paintjob'];
const through900 = [...through800, 'vintage-racer'];
const through1000 = [...through900, 'shift'];
const through1100 = [...through1000, 'race-car'];
const through1200 = [...through1100, 'emergency-pack'];
const through1300 = [...through1200, 'expert-tracks'];
const through1400 = [...through1300, 'van-carry-on'];
// Stored v8 ids from before the tiers: individual track rewards and TRUCK · TORQUE.
const preSwapThrough1300 = ['awd-traction', 'truck-torque', 'drift-attack', 'midnight-city', 'paintjob',
  'vintage-racer', 'shift', 'race-car', 'emergency-pack', 'van-carry-on'];
const through1500 = [...through1400, 'flow'];
const through1600 = [...through1500, 'future-racer'];
const through1700 = [...through1600, 'suv-full-tank'];
const through1800 = [...through1700, 'monster'];
const through1900 = [...through1800, 'sedan-double-shift'];
const through2000 = [...through1900, 'rally-racer'];
const through2100 = [...through2000, 'sports-car-drift-demon'];
const through2200 = [...through2100, 'learner-graduated'];
const through2300 = [...through2200, 'supercar'];
// Pre-SHIFT grandfathering also granted MIDNIGHT CITY and MOUNTAIN; since the
// difficulty tiers those survive as per-track entitlements, not rewards.
const legacyGrandfatheredRewardIds = [
  'vintage-racer',
  'race-car',
  'emergency-pack',
  'monster',
  'paintjob',
  'future-racer',
  'rally-racer'
];
const PRE_TIER_OPEN_TRACKS = ['airport', 'harbor'];

assert.equal(TROPHY_ROAD_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(TROPHY_ROAD_STORAGE_VERSION, 10,
  'Difficulty-tier track rewards require a versioned migration');
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 2300,
  'Trophy Road must end at the Supercar reward');
assert.equal(PRODUCTION_TROPHY_ROAD_MAX_THRESHOLD, 2300,
  'Every production wrapper must expose the canonical Trophy Road endpoint');

assert.deepEqual(
  PRODUCTION_TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['medium-tracks', 400],
    ['awd-traction', 500],
    ['drift-attack', 600],
    ['advanced-tracks', 700],
    ['paintjob', 800],
    ['vintage-racer', 900],
    ['shift', 1000],
    ['race-car', 1100],
    ['emergency-pack', 1200],
    ['expert-tracks', 1300],
    ['van-carry-on', 1400],
    ['flow', 1500],
    ['future-racer', 1600],
    ['suv-full-tank', 1700],
    ['monster', 1800],
    ['sedan-double-shift', 1900],
    ['rally-racer', 2000],
    ['sports-car-drift-demon', 2100],
    ['learner-graduated', 2200],
    ['supercar', 2300]
  ]
);

assert.deepEqual(productionRewardIdsForTrophies(299), []);
assert.deepEqual(productionRewardIdsForTrophies(300), []);
assert.deepEqual(productionRewardIdsForTrophies(400), through400);
assert.deepEqual(productionRewardIdsForTrophies(500), through500);
assert.deepEqual(productionRewardIdsForTrophies(600), through600);
assert.deepEqual(productionRewardIdsForTrophies(700), through700);
assert.deepEqual(productionRewardIdsForTrophies(800), through800);
assert.deepEqual(productionRewardIdsForTrophies(900), through900);
assert.deepEqual(productionRewardIdsForTrophies(999), through900);
assert.deepEqual(productionRewardIdsForTrophies(1000), through1000);
assert.deepEqual(productionRewardIdsForTrophies(1099), through1000);
assert.deepEqual(productionRewardIdsForTrophies(1100), through1100);
assert.deepEqual(productionRewardIdsForTrophies(1200), through1200);
assert.deepEqual(productionRewardIdsForTrophies(1300), through1300);
assert.deepEqual(productionRewardIdsForTrophies(1400), through1400);
assert.deepEqual(productionRewardIdsForTrophies(1499), through1400);
assert.deepEqual(productionRewardIdsForTrophies(1500), through1500);
assert.deepEqual(productionRewardIdsForTrophies(1600), through1600);
assert.deepEqual(productionRewardIdsForTrophies(1700), through1700);
assert.deepEqual(productionRewardIdsForTrophies(1800), through1800);
assert.deepEqual(productionRewardIdsForTrophies(1900), through1900);
assert.deepEqual(productionRewardIdsForTrophies(2000), through2000);
assert.deepEqual(productionRewardIdsForTrophies(2100), through2100);
assert.deepEqual(productionRewardIdsForTrophies(2200), through2200);
assert.deepEqual(productionRewardIdsForTrophies(2299), through2200);
assert.deepEqual(productionRewardIdsForTrophies(2300), through2300);
assert.deepEqual(productionRewardIdsForTrophies(5325), productionRewardIds);

assert.equal(getProductionTrophyRoadReward('mountain'), null, 'MOUNTAIN is no longer an individual reward');
assert.equal(getProductionTrophyRoadReward('midnight-city'), null, 'MIDNIGHT CITY is no longer an individual reward');
assert.equal(getProductionTrophyRoadReward('truck-torque'), null, 'TRUCK · TORQUE is no longer a reward');
assert.equal(getProductionTrophyRoadReward('expert-tracks')?.threshold, 1300);
assert.equal(getProductionTrophyRoadReward('paintjob')?.threshold, 800);
assert.equal(getProductionTrophyRoadReward('future-racer')?.threshold, 1600);
assert.equal(getProductionTrophyRoadReward('rally-racer')?.threshold, 2000);
assert.equal(getProductionTrophyRoadReward('shift')?.threshold, 1000);
assert.equal(getProductionTrophyRoadReward('awd-traction')?.threshold, 500);
assert.equal(getProductionTrophyRoadReward('drift-attack')?.threshold, 600);
assert.equal(getProductionTrophyRoadReward('flow')?.threshold, 1500);
assert.equal(getProductionTrophyRoadReward('learner-graduated')?.threshold, 2200);
assert.equal(getProductionTrophyRoadReward('supercar')?.threshold, 2300);
assert.equal(getProductionTrophyRoadReward('invented'), null);

for (const [trackId, rewardId] of [
  ['countryside', null], ['cliffside', null],
  ['airport', 'medium-tracks'], ['beachfront', 'medium-tracks'],
  ['harbor', 'advanced-tracks'], ['dead-canyon', 'advanced-tracks'],
  ['midnight-city', 'expert-tracks'], ['mountain', 'expert-tracks']
]) {
  assert.equal(rewardForTrack(trackId)?.id ?? null, rewardId, `${trackId} unlocks with its difficulty tier`);
}
assert.equal(rewardForVehicle('firetruck')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('race')?.id, 'race-car');
assert.equal(rewardForVehicle('race-future')?.id, 'future-racer');
assert.equal(rewardForVehicle('monster-truck')?.id, 'monster');
assert.equal(rewardForVehicle('vintage-racer')?.id, 'vintage-racer');
assert.equal(rewardForVehicle('toy-racer')?.id, 'rally-racer');
assert.equal(rewardForVehicle('supercar')?.id, 'supercar');
assert.equal(rewardForFeature('vehicle-paint')?.id, 'paintjob');
assert.equal(rewardForFeature('vehicle-shift')?.id, 'shift');
assert.equal(rewardForVehicle('convertible'), null,
  'A vehicle-perk reward must not lock the already-owned AWD');
assert.equal(rewardForVehicle('truck'), null,
  'A vehicle-perk reward must not lock the already-owned Truck');
assert.equal(rewardForVehiclePerk('convertible')?.id, 'awd-traction');
assert.equal(rewardForVehiclePerk('truck'), null, 'TRUCK ships with TORQUE out of the box');
assert.equal(rewardForVehiclePerk('van')?.id, 'van-carry-on');
assert.equal(rewardForVehiclePerk('suv')?.id, 'suv-full-tank');
assert.equal(rewardForVehiclePerk('sedan')?.id, 'sedan-double-shift');
assert.equal(rewardForVehiclePerk('sedan-sports')?.id, 'sports-car-drift-demon');
assert.equal(rewardForVehiclePerk('classic')?.id, 'learner-graduated');
assert.equal(rewardForVehiclePerk('race'), null,
  'Bundled perks must not gain a Trophy Road entitlement');
assert.equal(getTrophyRoadReward('invented'), null);

for (const [rewardId, title, trackIds, pattern] of [
  ['medium-tracks', 'MEDIUM TRACKS', ['airport', 'beachfront'], /AIRPORT[\s\S]*BEACHFRONT/],
  ['advanced-tracks', 'ADVANCED TRACKS', ['harbor', 'dead-canyon'], /HARBOR[\s\S]*DEAD CANYON/],
  ['expert-tracks', 'EXPERT TRACKS', ['midnight-city', 'mountain'], /MIDNIGHT CITY[\s\S]*≈4\.7 km[\s\S]*MOUNTAIN[\s\S]*≈3\.8 km/]
]) {
  const tier = getProductionTrophyRoadReward(rewardId);
  assert.equal(tier?.title, title);
  assert.equal(tier?.type, 'track');
  assert.equal(tier?.major, true);
  assert.deepEqual(tier?.trackIds, trackIds);
  assert.match(tier?.description || '', pattern);
}

const futurePerk = getProductionTrophyRoadReward('future-racer');
assert.equal(futurePerk?.perkTitle, 'OVERDRIVE');
assert.equal(futurePerk?.perkDescription, 'The longer you drive fast and clean, the higher the speed cap becomes. Leaving the track or colliding resets it.');
assert.match(futurePerk?.description || '', /<strong>OVERDRIVE:<\/strong>/);

const racePerk = getProductionTrophyRoadReward('race-car');
assert.equal(racePerk?.threshold, 1100);
assert.equal(racePerk?.perkTitle, 'APEX GRIP');
assert.equal(racePerk?.perkDescription,
  'OVERCHARGE increases CONTROL and ACCELERATION beyond their ordinary limits.');
assert.match(racePerk?.description || '', /<strong>APEX GRIP:<\/strong>/);
assert.equal(getCarDefinition('race').perk?.title, 'APEX GRIP');
assert.equal(getCarDefinition('race').perk?.description,
  'OVERCHARGE increases CONTROL and ACCELERATION beyond their ordinary limits.');

assert.equal(getCarDefinition('truck').perk?.title, 'TORQUE');
assert.equal(getCarDefinition('truck').perk?.rewardId, undefined, 'TORQUE has no Trophy Road gate');
assert.equal(getCarDefinition('truck').perk?.threshold, undefined);
assert.equal(getCarDefinition('truck').perk?.description,
  'OVERCHARGE increases ACCELERATION and builds BOOST TANK up to 5/5.');

const emergencyPerk = getProductionTrophyRoadReward('emergency-pack');
assert.equal(emergencyPerk?.perkTitle, 'SIRENS');
assert.match(emergencyPerk?.perkDescription || '', /emergency lights and sirens/i);
for (const vehicleId of ['firetruck', 'ambulance', 'police']) {
  assert.equal(getCarDefinition(vehicleId).perk?.title, 'SIRENS');
}

const monsterPerk = getProductionTrophyRoadReward('monster');
assert.equal(monsterPerk?.perkTitle, 'OVERSIZED');
assert.match(monsterPerk?.perkDescription || '', /off-road/i);
assert.equal(getCarDefinition('monster-truck').perk?.title, 'OVERSIZED');

const vintagePerk = getProductionTrophyRoadReward('vintage-racer');
assert.equal(vintagePerk?.perkTitle, 'DRIFTAGE');
assert.match(vintagePerk?.perkDescription || '', /larger slip angles/i);
assert.equal(getCarDefinition('vintage-racer').perk?.title, 'DRIFTAGE');

const rallyPerk = getProductionTrophyRoadReward('rally-racer');
assert.equal(rallyPerk?.perkTitle, 'TWITCHY TURNY');
assert.match(rallyPerk?.perkDescription || '', /fills BOOST even faster/i);
assert.equal(getCarDefinition('toy-racer').name, 'Rally Racer');
assert.equal(getCarDefinition('toy-racer').perk?.title, 'TWITCHY TURNY');

const supercarPerk = getProductionTrophyRoadReward('supercar');
assert.equal(supercarPerk?.threshold, 2300);
assert.equal(supercarPerk?.perkTitle, 'FLOW SHIFT');
assert.match(supercarPerk?.perkDescription || '', /FLOW ×3 or higher/);
assert.match(supercarPerk?.perkDescription || '', /adds three attribute points without reductions/);
assert.equal(getCarDefinition('supercar').perk?.title, 'FLOW SHIFT');
assert.match(supercarPerk?.description || '', /<strong>FLOW SHIFT:<\/strong>/);

assert.equal(getCarDefinition('race-future').perk?.title, 'OVERDRIVE');
for (const reward of [racePerk, futurePerk, emergencyPerk, monsterPerk, vintagePerk, rallyPerk, supercarPerk]) {
  assert.doesNotMatch(reward?.description || '', /<strong>PERK:<\/strong>/,
    'Unlock details must lead with the actual perk title rather than the generic word PERK');
}

const trophyPerks = Object.freeze([
  ['convertible', 'awd-traction', 500, 'TRACTION'],
  ['van', 'van-carry-on', 1400, 'CARRY ON'],
  ['suv', 'suv-full-tank', 1700, 'FULL TANK'],
  ['sedan', 'sedan-double-shift', 1900, 'DOUBLE SHIFT'],
  ['sedan-sports', 'sports-car-drift-demon', 2100, 'DRIFT DEMON'],
  ['classic', 'learner-graduated', 2200, 'GRADUATED']
]);
for (const [vehicleId, rewardId, threshold, title] of trophyPerks) {
  const perk = getCarDefinition(vehicleId).perk;
  const reward = getProductionTrophyRoadReward(rewardId);
  assert.equal(perk?.title, title);
  assert.equal(perk?.rewardId, rewardId);
  assert.equal(perk?.threshold, threshold);
  assert.equal(reward?.type, 'vehicle-perk');
  assert.equal(reward?.vehicleId, vehicleId);
  assert.equal(reward?.threshold, threshold);
  assert.match(reward?.description || '', new RegExp(title.replace(' ', '\\s')));
}

assert.deepEqual(
  grandfatheredRewardIdsForVersion(3),
  ['paintjob', 'monster', 'vintage-racer', 'rally-racer']
);
assert.deepEqual(grandfatheredRewardIdsForVersion(4), ['vintage-racer', 'rally-racer']);
assert.deepEqual(grandfatheredRewardIdsForVersion(2), legacyGrandfatheredRewardIds,
  'Legacy profiles retain historical rewards but must earn SHIFT and every new vehicle perk');
assert.deepEqual(grandfatheredRewardIdsForVersion(5), []);
assert.deepEqual(grandfatheredRewardIdsForVersion(6), []);
assert.deepEqual(grandfatheredRewardIdsForVersion(7), []);
assert.deepEqual(grandfatheredRewardIdsForVersion(8), []);
assert.deepEqual(grandfatheredRewardIdsForVersion(9), []);
assert.deepEqual(grandfatheredRewardIdsForVersion(10), []);
assert.deepEqual(
  migrateStoredRewardIdsForVersion(['vintage-racer', 'future-racer', 'rally-racer'], 5),
  ['vintage-racer']
);
assert.deepEqual(
  migrateStoredRewardIdsForVersion(['vintage-racer', 'future-racer', 'rally-racer'], 6),
  ['vintage-racer', 'future-racer', 'rally-racer']
);
assert.deepEqual(
  migrateStoredRewardIdsForVersion(['paintjob', 'van-carry-on', 'truck-torque', 'midnight-city'], 8),
  ['paintjob', 'van-carry-on'],
  'Retired reward ids never survive as rewards; their tracks become per-track entitlements'
);

const preSwapAchievementIds = [
  'trust-your-ears',
  'beyond-sight',
  'around-the-turn',
  'countryside-sprint',
  'first-turn',
  'night-shift-sheriff',
  'on-course-of-course',
  'ahead-of-yourself',
  'flow-state',
  'faster-than-the-dev'
];
assert.equal(
  preSwapAchievementIds.reduce((total, id) => (
    total + Number(ACHIEVEMENTS.find((achievement) => achievement.id === id)?.trophies || 0)
  ), 0),
  1325,
  'The migration fixture must represent a player just beyond the old 1300-trophy reward'
);
const preSwapProfilePayload = {
  version: 8,
  unlocked: Object.fromEntries(
    preSwapAchievementIds.map((id, index) => [id, { unlockedAt: index + 1 }])
  ),
  seen: preSwapAchievementIds,
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: preSwapThrough1300, seen: preSwapThrough1300 }
};
const preSwapProfile = normalizeAchievementState(preSwapProfilePayload);
assert.equal(preSwapProfile.version, 10);
assert.deepEqual(
  new Set(preSwapProfile.rewards.unlocked),
  new Set([...through1300, 'van-carry-on']),
  'A 1325-trophy player derives every tier through EXPERT and keeps the already-earned Van perk'
);
assert.deepEqual(preSwapProfile.rewards.grandfathered, ['van-carry-on']);
assert.deepEqual(
  preSwapProfile.rewards.tracks,
  [...PRE_TIER_OPEN_TRACKS, 'midnight-city', 'mountain'],
  'Every track the player could use before the tiers stays available'
);
const preSwapSnapshotStorage = createMemoryStorage({
  [TROPHY_ROAD_STORAGE_KEY]: JSON.stringify(preSwapProfilePayload)
});
for (const trackId of ['airport', 'harbor', 'midnight-city', 'mountain']) {
  assert.equal(isTrackUnlocked(trackId, preSwapSnapshotStorage), true,
    `The pre-store startup gate keeps ${trackId} open`);
}
assert.equal(isTrackUnlocked('beachfront', preSwapSnapshotStorage), false,
  'Before its store derives the new tiers, a stored profile gains no new track from legacy access');

const preRoadTwoMountainProfile = normalizeAchievementState({
  version: 7,
  unlocked: {},
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: ['mountain'], seen: ['mountain'] }
});
assert.deepEqual(preRoadTwoMountainProfile.rewards.unlocked, [],
  'A legacy MOUNTAIN entitlement must not grant the EXPERT tier');
assert.deepEqual(preRoadTwoMountainProfile.rewards.tracks, [...PRE_TIER_OPEN_TRACKS, 'mountain'],
  'Players who earned the earlier MOUNTAIN reward keep MOUNTAIN only');

const freshStorage = createMemoryStorage();
assert.equal(prepareTrophyRoadProfile(freshStorage), null);
assert.deepEqual(readTrophyRoadSnapshot(freshStorage).unlockedRewardIds, []);
for (const trackId of ['countryside', 'cliffside']) {
  assert.equal(isTrackUnlocked(trackId, freshStorage), true, `EASY ${trackId} is open from the start`);
}
for (const trackId of ['airport', 'beachfront', 'harbor', 'dead-canyon', 'midnight-city', 'mountain']) {
  assert.equal(isTrackUnlocked(trackId, freshStorage), false, `A fresh profile earns ${trackId} with its tier`);
}
assert.equal(isVehicleUnlocked('classic', freshStorage), true);
assert.equal(isVehicleUnlocked('race', freshStorage), false);
assert.equal(isVehicleUnlocked('firetruck', freshStorage), false);
assert.equal(isVehicleUnlocked('monster-truck', freshStorage), false);
assert.equal(isVehicleUnlocked('vintage-racer', freshStorage), false);
assert.equal(isVehicleUnlocked('toy-racer', freshStorage), false);
assert.equal(isVehicleUnlocked('supercar', freshStorage), false);
assert.equal(isPaintUnlocked(freshStorage), false);
assert.equal(isFeatureUnlocked('vehicle-shift', freshStorage), false);
assert.equal(isFeatureUnlocked('drift-attack', freshStorage), false);
assert.equal(isFeatureUnlocked('flow', freshStorage), false);
assert.equal(isVehicleUnlocked('convertible', freshStorage), true,
  'A locked TRACTION perk must not lock AWD');
assert.equal(isVehicleUnlocked('truck', freshStorage), true,
  'A locked TORQUE perk must not lock Truck');
assert.equal(isVehiclePerkUnlocked('convertible', freshStorage), false);
assert.equal(isVehiclePerkUnlocked('truck', freshStorage), true,
  'TRUCK TORQUE is intrinsic, with no Trophy Road entitlement');
assert.equal(isVehiclePerkUnlocked('van', freshStorage), false);
assert.equal(isVehiclePerkUnlocked('race', freshStorage), true,
  'Existing bundled perks remain owned with their cars');

const tractionStorage = createMemoryStorage({
  'turn-achievements-v1': JSON.stringify({
    version: 7,
    unlocked: {},
    seen: [],
    progress: { tracks: [], blankTracks: [] },
    rewards: { unlocked: ['awd-traction'], seen: [] }
  })
});
assert.equal(isVehiclePerkUnlocked('convertible', tractionStorage), true);
assert.equal(isVehiclePerkUnlocked('van', tractionStorage), false,
  'Vehicle perks must unlock independently');

const priorProductionProfile = createMemoryStorage({
  'turn-achievements-v1': JSON.stringify({
    version: 4,
    unlocked: {},
    seen: [],
    progress: { tracks: [], blankTracks: [] },
    rewards: { unlocked: [], seen: [] }
  })
});
assert.deepEqual(
  readTrophyRoadSnapshot(priorProductionProfile).unlockedRewardIds,
  ['vintage-racer', 'rally-racer'],
  'Every pre-lock v4 profile already owned both formerly unrestricted cars'
);
assert.equal(isVehicleUnlocked('vintage-racer', priorProductionProfile), true);
assert.equal(isVehicleUnlocked('toy-racer', priorProductionProfile), true);
assert.equal(isTrackUnlocked('mountain', priorProductionProfile), false,
  'Existing v4 players must still earn MOUNTAIN');
assert.equal(isTrackUnlocked('airport', priorProductionProfile), true,
  'Existing players keep the formerly unrestricted AIRPORT');
assert.equal(isTrackUnlocked('harbor', priorProductionProfile), true,
  'Existing players keep the formerly unrestricted HARBOR');
assert.equal(isTrackUnlocked('dead-canyon', priorProductionProfile), false,
  'Legacy HARBOR access must not open the rest of the ADVANCED tier');
assert.equal(isTrackUnlocked('beachfront', priorProductionProfile), false,
  'Legacy AIRPORT access must not open the rest of the MEDIUM tier');

const normalizedPriorProduction = normalizeAchievementState({
  version: 4,
  unlocked: {},
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: [], seen: [] }
});
assert.equal(normalizedPriorProduction.version, 10);
assert.deepEqual(normalizedPriorProduction.rewards.tracks, PRE_TIER_OPEN_TRACKS);
assert.deepEqual(normalizedPriorProduction.rewards.unlocked, ['vintage-racer', 'rally-racer']);
assert.deepEqual(normalizedPriorProduction.rewards.seen, ['vintage-racer', 'rally-racer']);
assert.deepEqual(normalizedPriorProduction.rewards.grandfathered, ['vintage-racer', 'rally-racer']);

const newVersionFiveProfile = normalizeAchievementState({
  version: 5,
  unlocked: {},
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: [], seen: [] }
});
assert.deepEqual(newVersionFiveProfile.rewards.unlocked, [],
  'New v5 players must earn Vintage, Rally and Mountain rather than inherit them');

const migratedVersionFiveAt500 = normalizeAchievementState({
  version: 5,
  unlocked: {
    'trust-your-ears': { unlockedAt: 1 },
    'beyond-sight': { unlockedAt: 2 }
  },
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: {
    unlocked: ['vintage-racer', 'midnight-city', 'future-racer', 'rally-racer'],
    seen: ['vintage-racer', 'midnight-city', 'future-racer', 'rally-racer']
  }
});
assert.equal(migratedVersionFiveAt500.version, 10);
assert.deepEqual(
  migratedVersionFiveAt500.rewards.unlocked,
  ['vintage-racer', 'medium-tracks', 'awd-traction'],
  'A 500-trophy profile keeps its old rewards and derives the current rewards through 500'
);
assert.deepEqual(migratedVersionFiveAt500.rewards.seen, ['vintage-racer'],
  'Newly derived Trophy Road rewards must surface once while retained rewards stay seen');
assert.deepEqual(migratedVersionFiveAt500.rewards.grandfathered, ['vintage-racer']);
assert.deepEqual(migratedVersionFiveAt500.rewards.tracks, [...PRE_TIER_OPEN_TRACKS, 'midnight-city'],
  'The old MIDNIGHT CITY reward stays as that one track');

const legacyWithoutAchievements = createMemoryStorage({
  'turn-vehicle-selection-v1': JSON.stringify({ carId: 'police' })
});
const preparedLegacy = prepareTrophyRoadProfile(legacyWithoutAchievements);
assert.equal(preparedLegacy?.version, 2);
assert.deepEqual(readTrophyRoadSnapshot(legacyWithoutAchievements).unlockedRewardIds, legacyGrandfatheredRewardIds);
assert.equal(isPaintUnlocked(legacyWithoutAchievements), true);
assert.equal(isVehicleUnlocked('monster-truck', legacyWithoutAchievements), true);
assert.equal(isVehicleUnlocked('vintage-racer', legacyWithoutAchievements), true);
assert.equal(isVehicleUnlocked('toy-racer', legacyWithoutAchievements), true);

const migratedLegacy = normalizeAchievementState({
  version: 2,
  unlocked: {
    'first-turn': { unlockedAt: 1, trackId: 'countryside', vehicleId: 'classic', time: 20 }
  },
  seen: ['first-turn'],
  progress: { tracks: ['countryside'], blankTracks: [] }
});
assert.equal(migratedLegacy.version, 10);
assert.deepEqual(migratedLegacy.rewards.tracks, [...PRE_TIER_OPEN_TRACKS, 'midnight-city', 'mountain']);
assert.deepEqual(migratedLegacy.rewards.unlocked, legacyGrandfatheredRewardIds);
assert.deepEqual(migratedLegacy.rewards.seen, migratedLegacy.rewards.unlocked);
assert.deepEqual(migratedLegacy.rewards.grandfathered, legacyGrandfatheredRewardIds);

const everyAchievementUnlocked = Object.fromEntries(
  ACHIEVEMENTS.map((achievement, index) => [achievement.id, { unlockedAt: index + 1 }])
);
const historicalVersionSixRewards = [
  'vintage-racer',
  'midnight-city',
  'race-car',
  'emergency-pack',
  'mountain',
  'monster',
  'paintjob',
  'future-racer',
  'rally-racer',
  'shift'
];
const highTrophyStorage = createMemoryStorage({
  'turn-achievements-v1': JSON.stringify({
    version: 6,
    unlocked: everyAchievementUnlocked,
    seen: Object.keys(everyAchievementUnlocked),
    progress: { tracks: [], blankTracks: [] },
    rewards: {
      unlocked: historicalVersionSixRewards,
      seen: historicalVersionSixRewards
    }
  })
});
const migratedHighTrophyStore = createAchievementStore(highTrophyStorage);
assert.equal(migratedHighTrophyStore.state.version, 10);
assert.deepEqual(new Set(migratedHighTrophyStore.state.rewards.unlocked), new Set(productionRewardIds),
  'Existing high-trophy players must derive every new perk entitlement without replaying achievements');
assert.deepEqual(
  new Set(migratedHighTrophyStore.unseenRewardIds()),
  new Set(productionRewardIds.filter((rewardId) => !historicalVersionSixRewards.includes(rewardId))),
  'Every newly derived Trophy Road entitlement remains unseen for one composed announcement'
);

const progressionStorage = createMemoryStorage();
const store = createAchievementStore(progressionStorage);
assert.equal(store.unlock('trust-your-ears', { trackId: 'countryside' })?.trophies, 200);
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('beyond-sight', { trackId: 'countryside' })?.trophies, 300);
assert.deepEqual(
  store.syncRewards().map((reward) => reward.id),
  through500
);
assert.equal(isTrackUnlocked('airport', progressionStorage), true, 'MEDIUM tracks unlock at 400 trophies');
assert.equal(isTrackUnlocked('beachfront', progressionStorage), true, 'MEDIUM tracks unlock at 400 trophies');
assert.equal(isTrackUnlocked('harbor', progressionStorage), false);
assert.equal(store.unlock('around-the-turn', { trackId: 'harbor' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['drift-attack']);
assert.equal(isFeatureUnlocked('drift-attack', progressionStorage), true,
  'DRIFT scoring must activate automatically at 600 trophies');
assert.equal(isFeatureUnlocked('flow', progressionStorage), false,
  'FLOW must remain dormant until its later reward');
assert.equal(store.unlock('countryside-sprint', { trackId: 'countryside' })?.trophies, 100,
  'A sprint must award its rebalanced 100-trophy value');
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['advanced-tracks']);
assert.equal(store.unlock('first-turn', { trackId: 'countryside' })?.trophies, 25);
assert.deepEqual(store.syncRewards(), []);
assert.equal(isTrackUnlocked('harbor', progressionStorage), true, 'ADVANCED tracks unlock at 700 trophies');
assert.equal(isTrackUnlocked('dead-canyon', progressionStorage), true, 'ADVANCED tracks unlock at 700 trophies');
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), false,
  'MIDNIGHT CITY is EXPERT and waits for 1300 trophies');
assert.equal(store.unlock('night-shift-sheriff', { trackId: 'midnight-city', vehicleId: 'police' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['paintjob']);
assert.equal(store.unlock('on-course-of-course', { trackId: 'harbor' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['vintage-racer']);
assert.equal(store.unlock('ahead-of-yourself', { trackId: 'harbor' })?.trophies, 50);
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('flow-state', { trackId: 'countryside' })?.trophies, 50);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['shift']);
assert.equal(store.unlock('faster-than-the-dev', { trackId: 'midnight-city' })?.trophies, 300,
  'FASTER THAN THE DEV must retain its rebalanced 300-trophy value');
assert.deepEqual(
  store.syncRewards().map((reward) => reward.id),
  ['race-car', 'emergency-pack', 'expert-tracks'],
  'Crossing several thresholds at once must announce every newly earned reward in road order'
);
assert.deepEqual(store.syncRewards(), []);
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), true);
assert.equal(isTrackUnlocked('mountain', progressionStorage), true);
assert.equal(isVehicleUnlocked('firetruck', progressionStorage), true);
assert.equal(isVehicleUnlocked('race', progressionStorage), true);
assert.equal(isVehicleUnlocked('monster-truck', progressionStorage), false);
assert.equal(isVehicleUnlocked('vintage-racer', progressionStorage), true);
assert.equal(isVehicleUnlocked('toy-racer', progressionStorage), false);
assert.equal(isVehicleUnlocked('supercar', progressionStorage), false);
assert.equal(isPaintUnlocked(progressionStorage), true);
assert.equal(isVehiclePerkUnlocked('convertible', progressionStorage), true);
assert.equal(isVehiclePerkUnlocked('truck', progressionStorage), true);
assert.equal(isVehiclePerkUnlocked('van', progressionStorage), false);
assert.equal(isFeatureUnlocked('vehicle-shift', progressionStorage), true);
assert.equal(isFeatureUnlocked('flow', progressionStorage), false);

const overviewAt600 = trophyRoadOverview({
  trophies: 600,
  unlockedRewardIds: through600,
  unseenRewardIds: ['awd-traction', 'drift-attack']
});
assert.equal(overviewAt600.earned?.id, 'drift-attack');
assert.equal(overviewAt600.earnedIsNew, true);
assert.deepEqual(overviewAt600.newRewards.map(({ id }) => id), ['awd-traction', 'drift-attack']);
assert.equal(overviewAt600.next?.id, 'advanced-tracks');
assert.equal(overviewAt600.remaining, 100);
assert.equal(overviewAt600.horizon?.id, 'shift');
assert.equal(overviewAt600.progress, 600 / 2300);

assert.match(roadSource, /TROPHY_ROAD_STORAGE_VERSION = 10/);
assert.match(roadSource, /migrateStoredRewardIdsForVersion/);
assert.match(roadSource, /rewardForVehiclePerk/);
assert.match(roadSource, /isVehiclePerkUnlocked/);
assert.match(roadSource, /trophyRoadOverview/);
assert.doesNotMatch(roadSource, /TROPHY_ROAD_VIEWPORT_THRESHOLD/);
assert.doesNotMatch(roadSource, /clearRivals|resetRivals|rival-storage/);
assert.match(view, /aria-valuemax="\$\{TROPHY_ROAD_MAX_THRESHOLD\}"/);
assert.match(view, /trophyRoadOverview\(/);
assert.match(view, /data-trophy-road-highlight="earned"/);
assert.match(view, /data-trophy-road-highlight="next"/);
assert.match(view, /data-trophy-road-highlight="horizon"/);
assert.match(view, /<ol class="turn-trophy-road-markers"/,
  'The complete road must use native reward order rather than a transformed carousel');
assert.match(view, /data-trophy-reward-type="\$\{reward\.type\}"/,
  'Reward styling must be driven by semantic reward type');
assert.doesNotMatch(feedback, /requestAnimationFrame|scrollLeft|scrollBy|scrollWidth|clientWidth/,
  'Trophy Road must not maintain carousel geometry or a layout animation path');
assert.match(app, /withBuild\('\.\/progression\/trophy-road\.js'\)/,
  'app.js prepares the profile through the same canonical Trophy Road module instance as every other consumer');
assert.match(app, /trophy-road-r157\.css\?revision=r244-reward-toast-guide/);
assert.match(workflow, /Run Trophy Road progression regression/);
assert.match(workflow, /node turn-lab\/tests\/trophy-road-production\.mjs/);
assert.match(perkWrapper, /export const TROPHY_ROAD_REWARDS/,
  'Every consumer reads the one canonical Trophy Road definition');
for (const gate of [lotGate, paintGate]) {
  assert.match(gate, /from '\.\/trophy-road\.js'/, 'Trophy gates import the canonical Trophy Road module by its bare path');
}
// ROADBOOK (the Home track gate) imports the same module through its import-mapped path.
assert.match(homeGate, /from '\/turn\/progression\/trophy-road\.js'/,
  'ROADBOOK imports the canonical Trophy Road module instance');
assert.match(homeGate, /rewardForTrack\(trackId\)[\s\S]*isTrackUnlocked\(trackId\)/,
  'ROADBOOK derives every track lock from Trophy Road');
assert.match(paintGate, /reward\(\)\?\.threshold \|\| 800/);

assert.match(perkDisclosure, /getCarDefinition\(vehicleId\)\?\.perk/,
  'The Lot must keep perk identity and copy on the selected car definition');
assert.match(perkDisclosure, /rewardForVehiclePerk\(vehicleId\)/,
  'The Lot must look up the independent entitlement without treating the car as locked');
assert.match(perkDisclosure, /isVehiclePerkUnlocked\(vehicleId\)/);
assert.match(perkDisclosure, /Unlocks at \$\{perkReward\.threshold\} trophies/);
assert.match(perkDisclosure, /className = 'lot-perk-copy'/);
assert.match(perkDisclosure, /className = 'lot-perk-button is-layout-placeholder'/);
assert.match(perkDisclosure, /trigger\.classList\.toggle\('is-layout-placeholder', !available\)/,
  'Only cars that own a perk may expose an interactive PERK action');
assert.match(perkDisclosure, /trigger\.disabled = !available/,
  'The reserved PERK footprint must remain inert for cars without perks');
assert.match(perkDisclosure, /trigger\.setAttribute\('aria-expanded', String\(nextOpen\)\)/,
  'The PERK action must expose its popover state');
assert.match(perkDisclosure, /popover\.setAttribute\('role', 'dialog'\)/,
  'Named perk information must open as a labelled popover dialog');
assert.match(perkDisclosure, /title\.textContent = perkTitle/);
assert.match(perkDisclosure, /copy\.textContent = perkReward && !perkUnlocked/);
assert.match(perkDisclosure, /turn:trophy-road-updated/,
  'An open Lot must refresh when a perk entitlement changes');
assert.match(roadStyles, /data-trophy-reward-type="vehicle-perk"/);
assert.match(roadStyles, /data-trophy-reward-type="feature"/);
assert.match(roadStyles, /data-trophy-reward-type="scoring-system"/);
assert.match(roadStyles, /--turn-reward-feature-locked/);
assert.match(roadStyles, /--turn-reward-feature-unlocked/);
assert.match(roadStyles, /--turn-reward-scoring-locked/);
assert.match(roadStyles, /--turn-reward-scoring-unlocked/);
assert.match(enhancementRuntime, /installLotPerkDisclosure/);
assert.match(enhancementRuntime, /lot-perk-disclosure\.js\?revision=r243-mountain-1300/);
assert.match(enhancementRuntime, /lot-trophy-gate\.js\?revision=r243-mountain-1300/);

console.log('TURN Trophy Road 2300 Supercar, FLOW SHIFT, reward order and perk presentation regression passed.');

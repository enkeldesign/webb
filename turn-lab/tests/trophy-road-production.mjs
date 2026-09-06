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
} from '../../turn/progression/trophy-road-perks-r164.js';

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
  fs.readFile(new URL('../../turn/progression/trophy-road-perks-r164.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8'),
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
const through400 = ['paintjob'];
const through500 = [...through400, 'awd-traction'];
const through600 = [...through500, 'drift-attack'];
const through700 = [...through600, 'midnight-city'];
const through800 = [...through700, 'truck-torque'];
const through900 = [...through800, 'vintage-racer'];
const through1000 = [...through900, 'shift'];
const through1100 = [...through1000, 'race-car'];
const through1200 = [...through1100, 'emergency-pack'];
const through1300 = [...through1200, 'mountain'];
const through1400 = [...through1300, 'van-carry-on'];
const preSwapThrough1300 = [...through1200, 'van-carry-on'];
const through1500 = [...through1400, 'flow'];
const through1600 = [...through1500, 'future-racer'];
const through1700 = [...through1600, 'suv-full-tank'];
const through1800 = [...through1700, 'monster'];
const through1900 = [...through1800, 'sedan-double-shift'];
const through2000 = [...through1900, 'rally-racer'];
const through2100 = [...through2000, 'sports-car-drift-demon'];
const through2200 = [...through2100, 'learner-graduated'];
const legacyGrandfatheredRewardIds = [
  'vintage-racer',
  'midnight-city',
  'race-car',
  'emergency-pack',
  'mountain',
  'monster',
  'paintjob',
  'future-racer',
  'rally-racer'
];

assert.equal(TROPHY_ROAD_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(TROPHY_ROAD_STORAGE_VERSION, 9,
  'Trophy Road reward order and grandfathering require a versioned migration');
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 2200,
  'Trophy Road must end at the Learner Car reward');
assert.equal(PRODUCTION_TROPHY_ROAD_MAX_THRESHOLD, 2200,
  'Every production wrapper must expose the canonical Trophy Road endpoint');

assert.deepEqual(
  PRODUCTION_TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['paintjob', 400],
    ['awd-traction', 500],
    ['drift-attack', 600],
    ['midnight-city', 700],
    ['truck-torque', 800],
    ['vintage-racer', 900],
    ['shift', 1000],
    ['race-car', 1100],
    ['emergency-pack', 1200],
    ['mountain', 1300],
    ['van-carry-on', 1400],
    ['flow', 1500],
    ['future-racer', 1600],
    ['suv-full-tank', 1700],
    ['monster', 1800],
    ['sedan-double-shift', 1900],
    ['rally-racer', 2000],
    ['sports-car-drift-demon', 2100],
    ['learner-graduated', 2200]
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
assert.deepEqual(productionRewardIdsForTrophies(4575), productionRewardIds);

assert.equal(getProductionTrophyRoadReward('mountain')?.threshold, 1300);
assert.equal(getProductionTrophyRoadReward('paintjob')?.threshold, 400);
assert.equal(getProductionTrophyRoadReward('future-racer')?.threshold, 1600);
assert.equal(getProductionTrophyRoadReward('rally-racer')?.threshold, 2000);
assert.equal(getProductionTrophyRoadReward('shift')?.threshold, 1000);
assert.equal(getProductionTrophyRoadReward('awd-traction')?.threshold, 500);
assert.equal(getProductionTrophyRoadReward('drift-attack')?.threshold, 600);
assert.equal(getProductionTrophyRoadReward('flow')?.threshold, 1500);
assert.equal(getProductionTrophyRoadReward('learner-graduated')?.threshold, 2200);
assert.equal(getProductionTrophyRoadReward('invented'), null);

assert.equal(rewardForTrack('midnight-city')?.id, 'midnight-city');
assert.equal(rewardForTrack('mountain')?.id, 'mountain');
assert.equal(rewardForVehicle('firetruck')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('race')?.id, 'race-car');
assert.equal(rewardForVehicle('race-future')?.id, 'future-racer');
assert.equal(rewardForVehicle('monster-truck')?.id, 'monster');
assert.equal(rewardForVehicle('vintage-racer')?.id, 'vintage-racer');
assert.equal(rewardForVehicle('toy-racer')?.id, 'rally-racer');
assert.equal(rewardForFeature('vehicle-paint')?.id, 'paintjob');
assert.equal(rewardForFeature('vehicle-shift')?.id, 'shift');
assert.equal(rewardForVehicle('convertible'), null,
  'A vehicle-perk reward must not lock the already-owned AWD');
assert.equal(rewardForVehicle('truck'), null,
  'A vehicle-perk reward must not lock the already-owned Truck');
assert.equal(rewardForVehiclePerk('convertible')?.id, 'awd-traction');
assert.equal(rewardForVehiclePerk('truck')?.id, 'truck-torque');
assert.equal(rewardForVehiclePerk('van')?.id, 'van-carry-on');
assert.equal(rewardForVehiclePerk('suv')?.id, 'suv-full-tank');
assert.equal(rewardForVehiclePerk('sedan')?.id, 'sedan-double-shift');
assert.equal(rewardForVehiclePerk('sedan-sports')?.id, 'sports-car-drift-demon');
assert.equal(rewardForVehiclePerk('classic')?.id, 'learner-graduated');
assert.equal(rewardForVehiclePerk('race'), null,
  'Bundled perks must not gain a Trophy Road entitlement');
assert.equal(getTrophyRoadReward('invented'), null);

const midnightReward = getProductionTrophyRoadReward('midnight-city');
assert.equal(midnightReward?.threshold, 700);
assert.match(midnightReward?.description || '', /ADVANCED/);
assert.match(midnightReward?.description || '', /≈4\.7 km/);

const mountainReward = getProductionTrophyRoadReward('mountain');
assert.equal(mountainReward?.threshold, 1300);
assert.equal(mountainReward?.type, 'track');
assert.match(mountainReward?.description || '', /EXPERT/);
assert.match(mountainReward?.description || '', /≈3\.8 km/);
assert.match(mountainReward?.description || '', /snowy village/i);
assert.match(mountainReward?.description || '', /waterfall/i);

const futurePerk = getProductionTrophyRoadReward('future-racer');
assert.equal(futurePerk?.perkTitle, 'OVERDRIVE');
assert.match(futurePerk?.perkDescription || '', /few seconds/i);
assert.doesNotMatch(futurePerk?.perkDescription || '', /5\/5|6%|exceeds/i,
  'OVERDRIVE copy should describe the behavior without exposing its beyond-scale tuning');
assert.match(futurePerk?.description || '', /<strong>OVERDRIVE:<\/strong>/);

const racePerk = getProductionTrophyRoadReward('race-car');
assert.equal(racePerk?.threshold, 1100);
assert.equal(racePerk?.perkTitle, 'APEX GRIP');
assert.equal(racePerk?.perkDescription, 'Increased CONTROL when OVERCHARGED.');
assert.match(racePerk?.description || '', /<strong>APEX GRIP:<\/strong>/);
assert.equal(getCarDefinition('race').perk?.title, 'APEX GRIP');
assert.equal(getCarDefinition('race').perk?.description, 'Increased CONTROL when OVERCHARGED.');

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

assert.equal(getCarDefinition('race-future').perk?.title, 'OVERDRIVE');
for (const reward of [racePerk, futurePerk, emergencyPerk, monsterPerk, vintagePerk, rallyPerk]) {
  assert.doesNotMatch(reward?.description || '', /<strong>PERK:<\/strong>/,
    'Unlock details must lead with the actual perk title rather than the generic word PERK');
}

const trophyPerks = Object.freeze([
  ['convertible', 'awd-traction', 500, 'TRACTION'],
  ['truck', 'truck-torque', 800, 'TORQUE'],
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
assert.deepEqual(
  migrateStoredRewardIdsForVersion(['vintage-racer', 'future-racer', 'rally-racer'], 5),
  ['vintage-racer']
);
assert.deepEqual(
  migrateStoredRewardIdsForVersion(['vintage-racer', 'future-racer', 'rally-racer'], 6),
  ['vintage-racer', 'future-racer', 'rally-racer']
);
assert.deepEqual(
  migrateStoredRewardIdsForVersion(['paintjob', 'van-carry-on'], 8),
  ['paintjob', 'van-carry-on', 'mountain'],
  'A pre-swap Van entitlement must also expose MOUNTAIN during the startup gate read'
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
assert.equal(preSwapProfile.version, 9);
assert.deepEqual(
  new Set(preSwapProfile.rewards.unlocked),
  new Set([...through1300, 'van-carry-on']),
  'The MOUNTAIN move must add the track without revoking an already-earned Van perk'
);
assert.deepEqual(preSwapProfile.rewards.grandfathered, ['van-carry-on']);
assert.deepEqual(preSwapProfile.rewards.seen, preSwapThrough1300,
  'MOUNTAIN must surface once as the newly derived reward while the retained Van stays seen');
const preSwapSnapshotStorage = createMemoryStorage({
  [TROPHY_ROAD_STORAGE_KEY]: JSON.stringify(preSwapProfilePayload)
});
assert.deepEqual(
  new Set(readTrophyRoadSnapshot(preSwapSnapshotStorage).unlockedRewardIds),
  new Set([...preSwapThrough1300, 'mountain']),
  'The pre-store startup gate must expose both retained Van and newly eligible MOUNTAIN'
);

const preRoadTwoMountainProfile = normalizeAchievementState({
  version: 7,
  unlocked: {},
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: ['mountain'], seen: ['mountain'] }
});
assert.deepEqual(preRoadTwoMountainProfile.rewards.unlocked, ['mountain'],
  'Players who earned the earlier MOUNTAIN reward must keep it across the skipped v8 migration');
assert.deepEqual(preRoadTwoMountainProfile.rewards.grandfathered, ['mountain']);

const freshStorage = createMemoryStorage();
assert.equal(prepareTrophyRoadProfile(freshStorage), null);
assert.deepEqual(readTrophyRoadSnapshot(freshStorage).unlockedRewardIds, []);
assert.equal(isTrackUnlocked('countryside', freshStorage), true);
assert.equal(isTrackUnlocked('midnight-city', freshStorage), false);
assert.equal(isTrackUnlocked('mountain', freshStorage), false);
assert.equal(isVehicleUnlocked('classic', freshStorage), true);
assert.equal(isVehicleUnlocked('race', freshStorage), false);
assert.equal(isVehicleUnlocked('firetruck', freshStorage), false);
assert.equal(isVehicleUnlocked('monster-truck', freshStorage), false);
assert.equal(isVehicleUnlocked('vintage-racer', freshStorage), false);
assert.equal(isVehicleUnlocked('toy-racer', freshStorage), false);
assert.equal(isPaintUnlocked(freshStorage), false);
assert.equal(isFeatureUnlocked('vehicle-shift', freshStorage), false);
assert.equal(isFeatureUnlocked('drift-attack', freshStorage), false);
assert.equal(isFeatureUnlocked('flow', freshStorage), false);
assert.equal(isVehicleUnlocked('convertible', freshStorage), true,
  'A locked TRACTION perk must not lock AWD');
assert.equal(isVehicleUnlocked('truck', freshStorage), true,
  'A locked TORQUE perk must not lock Truck');
assert.equal(isVehiclePerkUnlocked('convertible', freshStorage), false);
assert.equal(isVehiclePerkUnlocked('truck', freshStorage), false);
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
assert.equal(isVehiclePerkUnlocked('truck', tractionStorage), false,
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
  'Existing v4 players must still earn the Mountain track reward');

const normalizedPriorProduction = normalizeAchievementState({
  version: 4,
  unlocked: {},
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: [], seen: [] }
});
assert.equal(normalizedPriorProduction.version, 9);
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
assert.equal(migratedVersionFiveAt500.version, 9);
assert.deepEqual(
  migratedVersionFiveAt500.rewards.unlocked,
  ['vintage-racer', 'midnight-city', 'paintjob', 'awd-traction'],
  'A 500-trophy profile must keep its old rewards and also derive both current Trophy Road rewards'
);
assert.deepEqual(migratedVersionFiveAt500.rewards.seen, ['vintage-racer', 'midnight-city'],
  'Newly derived Trophy Road rewards must surface once while retained rewards stay seen');
assert.deepEqual(migratedVersionFiveAt500.rewards.grandfathered, ['vintage-racer', 'midnight-city']);

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
assert.equal(migratedLegacy.version, 9);
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
assert.equal(migratedHighTrophyStore.state.version, 9);
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
assert.equal(store.unlock('around-the-turn', { trackId: 'harbor' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['drift-attack']);
assert.equal(isFeatureUnlocked('drift-attack', progressionStorage), true,
  'DRIFT scoring must activate automatically at 600 trophies');
assert.equal(isFeatureUnlocked('flow', progressionStorage), false,
  'FLOW must remain dormant until its later reward');
assert.equal(store.unlock('countryside-sprint', { trackId: 'countryside' })?.trophies, 100,
  'A sprint must award its rebalanced 100-trophy value');
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['midnight-city']);
assert.equal(store.unlock('first-turn', { trackId: 'countryside' })?.trophies, 25);
assert.deepEqual(store.syncRewards(), []);
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), true,
  'Midnight City must unlock at 700 trophies');
assert.equal(store.unlock('night-shift-sheriff', { trackId: 'midnight-city', vehicleId: 'police' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['truck-torque']);
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
  ['race-car', 'emergency-pack', 'mountain'],
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
assert.equal(overviewAt600.next?.id, 'midnight-city');
assert.equal(overviewAt600.remaining, 100);
assert.equal(overviewAt600.horizon?.id, 'shift');
assert.equal(overviewAt600.progress, 600 / 2200);

assert.match(roadSource, /TROPHY_ROAD_STORAGE_VERSION = 9/);
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
assert.match(app, /trophy-road\.js\?revision=r243-mountain-1300/);
assert.match(app, /trophy-road-r157\.css\?revision=r244-reward-toast-guide/);
assert.match(workflow, /Run Trophy Road progression regression/);
assert.match(workflow, /node turn-lab\/tests\/trophy-road-production\.mjs/);
assert.match(perkWrapper, /export \* from '\.\/trophy-road\.js\?revision=r243-mountain-1300'/,
  'Compatibility imports must re-export the one canonical Trophy Road definition');
assert.match(homeGate, /trophy-road\.js\?revision=r243-mountain-1300/);
assert.match(lotGate, /trophy-road\.js\?revision=r243-mountain-1300/);
assert.match(paintGate, /trophy-road\.js\?revision=r243-mountain-1300/);
assert.match(paintGate, /reward\(\)\?\.threshold \|\| 400/);

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

console.log('TURN Trophy Road Race Car slot migration, APEX GRIP, reward order and perk presentation regression passed.');

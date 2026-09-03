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
  TROPHY_ROAD_VIEWPORT_THRESHOLD,
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
  rewardForVehiclePerk
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
  fixedLayout,
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
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
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
const through500 = ['vintage-racer', 'midnight-city', 'race-car'];
const through700 = [...through500, 'emergency-pack', 'mountain'];
const through800 = [...through700, 'monster'];
const through900 = [...through800, 'paintjob'];
const through1000 = [...through900, 'future-racer'];
const through1100 = [...through1000, 'rally-racer'];
const through1200 = [...through1100, 'awd-traction'];
const through1300 = [...through1200, 'truck-torque'];
const through1400 = [...through1300, 'van-carry-on'];
const through1500 = [...through1400, 'shift'];
const through1600 = [...through1500, 'suv-full-tank'];
const through1700 = [...through1600, 'sedan-double-shift'];
const through1800 = [...through1700, 'sports-car-drift-demon'];
const through2000 = [...through1800, 'learner-graduated'];
const legacyGrandfatheredRewardIds = [...through1100];

assert.equal(TROPHY_ROAD_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(TROPHY_ROAD_STORAGE_VERSION, 7,
  'Independent vehicle-perk entitlements require a versioned Trophy Road migration');
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 2000,
  'The base module must cover the final defined perk threshold');
assert.equal(PRODUCTION_TROPHY_ROAD_MAX_THRESHOLD, 3075,
  'Production must expose the complete current achievement-trophy scale');
assert.equal(TROPHY_ROAD_VIEWPORT_THRESHOLD, 600);

assert.deepEqual(
  PRODUCTION_TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['vintage-racer', 300],
    ['midnight-city', 400],
    ['race-car', 500],
    ['emergency-pack', 600],
    ['mountain', 700],
    ['monster', 800],
    ['paintjob', 900],
    ['future-racer', 1000],
    ['rally-racer', 1100],
    ['awd-traction', 1200],
    ['truck-torque', 1300],
    ['van-carry-on', 1400],
    ['shift', 1500],
    ['suv-full-tank', 1600],
    ['sedan-double-shift', 1700],
    ['sports-car-drift-demon', 1800],
    ['learner-graduated', 2000]
  ]
);

assert.deepEqual(productionRewardIdsForTrophies(299), []);
assert.deepEqual(productionRewardIdsForTrophies(300), ['vintage-racer']);
assert.deepEqual(productionRewardIdsForTrophies(400), ['vintage-racer', 'midnight-city']);
assert.deepEqual(productionRewardIdsForTrophies(500), through500);
assert.deepEqual(productionRewardIdsForTrophies(600), [...through500, 'emergency-pack']);
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
assert.deepEqual(productionRewardIdsForTrophies(1900), through1800,
  'The reserved 1900 slot must not create a reward');
assert.deepEqual(productionRewardIdsForTrophies(2000), through2000);
assert.deepEqual(productionRewardIdsForTrophies(3075), productionRewardIds);

assert.equal(getProductionTrophyRoadReward('mountain')?.threshold, 700);
assert.equal(getProductionTrophyRoadReward('paintjob')?.threshold, 900);
assert.equal(getProductionTrophyRoadReward('future-racer')?.threshold, 1000);
assert.equal(getProductionTrophyRoadReward('rally-racer')?.threshold, 1100);
assert.equal(getProductionTrophyRoadReward('shift')?.threshold, 1500);
assert.equal(getProductionTrophyRoadReward('awd-traction')?.threshold, 1200);
assert.equal(getProductionTrophyRoadReward('learner-graduated')?.threshold, 2000);
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
assert.equal(midnightReward?.threshold, 400);
assert.match(midnightReward?.description || '', /ADVANCED/);
assert.match(midnightReward?.description || '', /≈4\.7 km/);

const mountainReward = getProductionTrophyRoadReward('mountain');
assert.equal(mountainReward?.threshold, 700);
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
assert.equal(racePerk?.threshold, 500);
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
  ['convertible', 'awd-traction', 1200, 'TRACTION'],
  ['truck', 'truck-torque', 1300, 'TORQUE'],
  ['van', 'van-carry-on', 1400, 'CARRY ON'],
  ['suv', 'suv-full-tank', 1600, 'FULL TANK'],
  ['sedan', 'sedan-double-shift', 1700, 'DOUBLE SHIFT'],
  ['sedan-sports', 'sports-car-drift-demon', 1800, 'DRIFT DEMON'],
  ['classic', 'learner-graduated', 2000, 'GRADUATED']
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
assert.deepEqual(
  migrateStoredRewardIdsForVersion(['vintage-racer', 'future-racer', 'rally-racer'], 5),
  ['vintage-racer']
);
assert.deepEqual(
  migrateStoredRewardIdsForVersion(['vintage-racer', 'future-racer', 'rally-racer'], 6),
  ['vintage-racer', 'future-racer', 'rally-racer']
);

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
assert.equal(normalizedPriorProduction.version, 7);
assert.deepEqual(normalizedPriorProduction.rewards.unlocked, ['vintage-racer', 'rally-racer']);
assert.deepEqual(normalizedPriorProduction.rewards.seen, ['vintage-racer', 'rally-racer']);

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
assert.equal(migratedVersionFiveAt500.version, 7);
assert.deepEqual(migratedVersionFiveAt500.rewards.unlocked, through500,
  'An existing 500-trophy profile must receive Race Car while Future and Rally move to their new thresholds');
assert.deepEqual(migratedVersionFiveAt500.rewards.seen, ['vintage-racer', 'midnight-city'],
  'Race Car must surface as a new reward while no longer-earned cars leave the seen set');

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
assert.equal(migratedLegacy.version, 7);
assert.deepEqual(migratedLegacy.rewards.unlocked, legacyGrandfatheredRewardIds);
assert.deepEqual(migratedLegacy.rewards.seen, migratedLegacy.rewards.unlocked);

const everyAchievementUnlocked = Object.fromEntries(
  ACHIEVEMENTS.map((achievement, index) => [achievement.id, { unlockedAt: index + 1 }])
);
const historicalVersionSixRewards = [...through1100, 'shift'];
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
assert.equal(migratedHighTrophyStore.state.version, 7);
assert.deepEqual(new Set(migratedHighTrophyStore.state.rewards.unlocked), new Set(productionRewardIds),
  'Existing high-trophy players must derive every new perk entitlement without replaying achievements');
assert.deepEqual(
  new Set(migratedHighTrophyStore.unseenRewardIds()),
  new Set(trophyPerks.map(([, rewardId]) => rewardId)),
  'Derived perks remain unseen so the normal one-time reward feedback can announce them'
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
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['emergency-pack']);
assert.equal(store.unlock('countryside-sprint', { trackId: 'countryside' })?.trophies, 75,
  'A sprint must retain its rebalanced 75-trophy value');
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('first-turn', { trackId: 'countryside' })?.trophies, 25);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['mountain']);
assert.equal(isTrackUnlocked('mountain', progressionStorage), true,
  'Mountain must unlock as soon as the player reaches 700 trophies');
assert.equal(store.unlock('night-shift-sheriff', { trackId: 'midnight-city', vehicleId: 'police' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['monster']);
assert.equal(store.unlock('on-course-of-course', { trackId: 'harbor' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['paintjob']);
assert.equal(store.unlock('ahead-of-yourself', { trackId: 'harbor' })?.trophies, 50);
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('flow-state', { trackId: 'countryside' })?.trophies, 50);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['future-racer']);
assert.equal(store.unlock('faster-than-the-dev', { trackId: 'midnight-city' })?.trophies, 300,
  'FASTER THAN THE DEV must retain its rebalanced 300-trophy value');
assert.deepEqual(
  store.syncRewards().map((reward) => reward.id),
  ['rally-racer', 'awd-traction', 'truck-torque'],
  'Crossing several thresholds at once must announce every newly earned reward in road order'
);
assert.deepEqual(store.syncRewards(), []);
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), true);
assert.equal(isTrackUnlocked('mountain', progressionStorage), true);
assert.equal(isVehicleUnlocked('firetruck', progressionStorage), true);
assert.equal(isVehicleUnlocked('race', progressionStorage), true);
assert.equal(isVehicleUnlocked('monster-truck', progressionStorage), true);
assert.equal(isVehicleUnlocked('vintage-racer', progressionStorage), true);
assert.equal(isVehicleUnlocked('toy-racer', progressionStorage), true);
assert.equal(isPaintUnlocked(progressionStorage), true);
assert.equal(isVehiclePerkUnlocked('convertible', progressionStorage), true);
assert.equal(isVehiclePerkUnlocked('truck', progressionStorage), true);
assert.equal(isVehiclePerkUnlocked('van', progressionStorage), false);

assert.match(roadSource, /TROPHY_ROAD_STORAGE_VERSION = 7/);
assert.match(roadSource, /migrateStoredRewardIdsForVersion/);
assert.match(roadSource, /rewardForVehiclePerk/);
assert.match(roadSource, /isVehiclePerkUnlocked/);
assert.match(roadSource, /TROPHY_ROAD_VIEWPORT_THRESHOLD = 600/);
assert.doesNotMatch(roadSource, /clearRivals|resetRivals|rival-storage/);
assert.match(view, /aria-valuemax="\$\{TROPHY_ROAD_MAX_THRESHOLD\}"/);
assert.match(view, /total \/ TROPHY_ROAD_MAX_THRESHOLD/);
assert.match(view, /data-trophy-reward-type="\$\{reward\.type\}"/,
  'Reward styling must be driven by semantic reward type');
assert.match(feedback, /TROPHY_ROAD_MAX_THRESHOLD/);
assert.match(app, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(fixedLayout, /r166-bella-records/);
assert.match(workflow, /Run Trophy Road progression regression/);
assert.match(workflow, /node turn-lab\/tests\/trophy-road-production\.mjs/);
assert.match(perkWrapper, /TROPHY_ROAD_MAX_THRESHOLD = 3075/);
assert.match(perkWrapper, /\['vintage-racer', 300\]/);
assert.match(perkWrapper, /\['midnight-city', 400\]/);
assert.match(perkWrapper, /\['race-car', 500\]/);
assert.match(perkWrapper, /\['mountain', 700\]/);
assert.match(perkWrapper, /\['paintjob', 900\]/);
assert.match(perkWrapper, /\['future-racer', 1000\]/);
assert.match(perkWrapper, /\['rally-racer', 1100\]/);
assert.match(perkWrapper, /\['awd-traction', 1200\]/);
assert.match(perkWrapper, /\['truck-torque', 1300\]/);
assert.match(perkWrapper, /\['van-carry-on', 1400\]/);
assert.match(perkWrapper, /\['shift', 1500\]/);
assert.match(perkWrapper, /\['suv-full-tank', 1600\]/);
assert.match(perkWrapper, /\['sedan-double-shift', 1700\]/);
assert.match(perkWrapper, /\['sports-car-drift-demon', 1800\]/);
assert.match(perkWrapper, /\['learner-graduated', 2000\]/);
assert.doesNotMatch(perkWrapper, /1900/,
  'The reserved 1900 position must be a real gap with no reward definition');
assert.match(perkWrapper, /rewardIdsForTrophies/);
assert.match(homeGate, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(lotGate, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(paintGate, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(paintGate, /reward\(\)\?\.threshold \|\| 900/);

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
assert.match(roadStyles, /--turn-reward-feature-locked/);
assert.match(roadStyles, /--turn-reward-feature-unlocked/);
assert.match(enhancementRuntime, /installLotPerkDisclosure/);
assert.match(enhancementRuntime, /lot-perk-disclosure\.js\?revision=r230-vehicle-perks/);
assert.match(enhancementRuntime, /lot-trophy-gate\.js\?revision=r164-vintage-rally-perks/);

console.log('TURN Trophy Road Race Car slot migration, APEX GRIP, reward order and perk presentation regression passed.');

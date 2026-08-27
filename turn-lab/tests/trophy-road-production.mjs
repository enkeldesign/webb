import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createAchievementStore, normalizeAchievementState } from '../../turn/achievements/store.js';
import { getCarDefinition } from '../../turn/vehicle/catalog.js';
import {
  TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_STORAGE_KEY,
  TROPHY_ROAD_STORAGE_VERSION,
  TROPHY_ROAD_VIEWPORT_THRESHOLD,
  getTrophyRoadReward,
  grandfatheredRewardIdsForVersion,
  isPaintUnlocked,
  isTrackUnlocked,
  isVehicleUnlocked,
  prepareTrophyRoadProfile,
  readTrophyRoadSnapshot,
  rewardForFeature,
  rewardForTrack,
  rewardForVehicle
} from '../../turn/progression/trophy-road.js';
import {
  TROPHY_ROAD_MAX_THRESHOLD as PRODUCTION_TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS as PRODUCTION_TROPHY_ROAD_REWARDS,
  getTrophyRoadReward as getProductionTrophyRoadReward,
  rewardIdsForTrophies as productionRewardIdsForTrophies
} from '../../turn/progression/trophy-road-perks-r164.js';

const [
  roadSource,
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

const legacyRewardIds = TROPHY_ROAD_REWARDS.map((reward) => reward.id);
const productionRewardIds = PRODUCTION_TROPHY_ROAD_REWARDS.map((reward) => reward.id);
const through700 = ['vintage-racer', 'midnight-city', 'future-racer', 'emergency-pack', 'mountain'];
const through800 = [...through700, 'monster'];
const through900 = [...through800, 'paintjob'];
const through1000 = [...through900, 'rally-racer'];

assert.equal(TROPHY_ROAD_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(TROPHY_ROAD_STORAGE_VERSION, 5,
  'Adding locks to previously unrestricted cars requires a one-time ownership grandfather migration');
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 1700,
  'The legacy base module keeps its historical scale for compatibility');
assert.equal(PRODUCTION_TROPHY_ROAD_MAX_THRESHOLD, 3075,
  'Production must expose the complete current achievement-trophy scale');
assert.equal(TROPHY_ROAD_VIEWPORT_THRESHOLD, 600);

assert.deepEqual(
  PRODUCTION_TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['vintage-racer', 300],
    ['midnight-city', 400],
    ['future-racer', 500],
    ['emergency-pack', 600],
    ['mountain', 700],
    ['monster', 800],
    ['paintjob', 900],
    ['rally-racer', 1000]
  ]
);

assert.deepEqual(productionRewardIdsForTrophies(299), []);
assert.deepEqual(productionRewardIdsForTrophies(300), ['vintage-racer']);
assert.deepEqual(productionRewardIdsForTrophies(400), ['vintage-racer', 'midnight-city']);
assert.deepEqual(productionRewardIdsForTrophies(500), ['vintage-racer', 'midnight-city', 'future-racer']);
assert.deepEqual(productionRewardIdsForTrophies(600), ['vintage-racer', 'midnight-city', 'future-racer', 'emergency-pack']);
assert.deepEqual(productionRewardIdsForTrophies(700), through700);
assert.deepEqual(productionRewardIdsForTrophies(800), through800);
assert.deepEqual(productionRewardIdsForTrophies(900), through900);
assert.deepEqual(productionRewardIdsForTrophies(999), through900);
assert.deepEqual(productionRewardIdsForTrophies(1000), through1000);
assert.deepEqual(productionRewardIdsForTrophies(3075), productionRewardIds);

assert.equal(getProductionTrophyRoadReward('mountain')?.threshold, 700);
assert.equal(getProductionTrophyRoadReward('paintjob')?.threshold, 900);
assert.equal(getProductionTrophyRoadReward('rally-racer')?.threshold, 1000);
assert.equal(getProductionTrophyRoadReward('invented'), null);

assert.equal(rewardForTrack('midnight-city')?.id, 'midnight-city');
assert.equal(rewardForTrack('mountain')?.id, 'mountain');
assert.equal(rewardForVehicle('firetruck')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('race-future')?.id, 'future-racer');
assert.equal(rewardForVehicle('monster-truck')?.id, 'monster');
assert.equal(rewardForVehicle('vintage-racer')?.id, 'vintage-racer');
assert.equal(rewardForVehicle('toy-racer')?.id, 'rally-racer');
assert.equal(rewardForFeature('vehicle-paint')?.id, 'paintjob');
assert.equal(getTrophyRoadReward('invented'), null);

const mountainReward = getProductionTrophyRoadReward('mountain');
assert.equal(mountainReward?.threshold, 700);
assert.equal(mountainReward?.type, 'track');
assert.match(mountainReward?.description || '', /snowy village/i);
assert.match(mountainReward?.description || '', /waterfall/i);

const futurePerk = getProductionTrophyRoadReward('future-racer');
assert.equal(futurePerk?.perkTitle, 'OVERDRIVE');
assert.match(futurePerk?.perkDescription || '', /5 clean seconds/);
assert.match(futurePerk?.description || '', /<strong>OVERDRIVE:<\/strong>/);

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
for (const reward of [futurePerk, emergencyPerk, monsterPerk, vintagePerk, rallyPerk]) {
  assert.doesNotMatch(reward?.description || '', /<strong>PERK:<\/strong>/,
    'Unlock details must lead with the actual perk title rather than the generic word PERK');
}

assert.deepEqual(
  grandfatheredRewardIdsForVersion(3),
  ['paintjob', 'monster', 'vintage-racer', 'rally-racer']
);
assert.deepEqual(grandfatheredRewardIdsForVersion(4), ['vintage-racer', 'rally-racer']);
assert.deepEqual(grandfatheredRewardIdsForVersion(2), legacyRewardIds);
assert.deepEqual(grandfatheredRewardIdsForVersion(5), []);

const freshStorage = createMemoryStorage();
assert.equal(prepareTrophyRoadProfile(freshStorage), null);
assert.deepEqual(readTrophyRoadSnapshot(freshStorage).unlockedRewardIds, []);
assert.equal(isTrackUnlocked('countryside', freshStorage), true);
assert.equal(isTrackUnlocked('midnight-city', freshStorage), false);
assert.equal(isTrackUnlocked('mountain', freshStorage), false);
assert.equal(isVehicleUnlocked('classic', freshStorage), true);
assert.equal(isVehicleUnlocked('firetruck', freshStorage), false);
assert.equal(isVehicleUnlocked('monster-truck', freshStorage), false);
assert.equal(isVehicleUnlocked('vintage-racer', freshStorage), false);
assert.equal(isVehicleUnlocked('toy-racer', freshStorage), false);
assert.equal(isPaintUnlocked(freshStorage), false);

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
assert.equal(normalizedPriorProduction.version, 5);
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

const legacyWithoutAchievements = createMemoryStorage({
  'turn-vehicle-selection-v1': JSON.stringify({ carId: 'police' })
});
const preparedLegacy = prepareTrophyRoadProfile(legacyWithoutAchievements);
assert.equal(preparedLegacy?.version, 2);
assert.deepEqual(readTrophyRoadSnapshot(legacyWithoutAchievements).unlockedRewardIds, legacyRewardIds);
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
assert.equal(migratedLegacy.version, 5);
assert.deepEqual(migratedLegacy.rewards.unlocked, legacyRewardIds);
assert.deepEqual(migratedLegacy.rewards.seen, migratedLegacy.rewards.unlocked);

const progressionStorage = createMemoryStorage();
const store = createAchievementStore(progressionStorage);
assert.equal(store.unlock('trust-your-ears', { trackId: 'countryside' })?.trophies, 200);
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('beyond-sight', { trackId: 'countryside' })?.trophies, 300);
assert.deepEqual(
  store.syncRewards().map((reward) => reward.id),
  ['vintage-racer', 'midnight-city', 'future-racer']
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
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['rally-racer']);
assert.equal(store.unlock('faster-than-the-dev', { trackId: 'midnight-city' })?.trophies, 300,
  'FASTER THAN THE DEV must retain its rebalanced 300-trophy value');
assert.deepEqual(store.syncRewards(), [],
  'No Trophy Road reward should exist beyond the intentional 1000-trophy final reward');
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), true);
assert.equal(isTrackUnlocked('mountain', progressionStorage), true);
assert.equal(isVehicleUnlocked('firetruck', progressionStorage), true);
assert.equal(isVehicleUnlocked('monster-truck', progressionStorage), true);
assert.equal(isVehicleUnlocked('vintage-racer', progressionStorage), true);
assert.equal(isVehicleUnlocked('toy-racer', progressionStorage), true);
assert.equal(isPaintUnlocked(progressionStorage), true);

assert.match(roadSource, /TROPHY_ROAD_STORAGE_VERSION = 5/);
assert.match(roadSource, /TROPHY_ROAD_VIEWPORT_THRESHOLD = 600/);
assert.doesNotMatch(roadSource, /clearRivals|resetRivals|rival-storage/);
assert.match(view, /aria-valuemax="\$\{TROPHY_ROAD_MAX_THRESHOLD\}"/);
assert.match(view, /total \/ TROPHY_ROAD_MAX_THRESHOLD/);
assert.match(feedback, /TROPHY_ROAD_MAX_THRESHOLD/);
assert.match(app, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(fixedLayout, /r166-bella-records/);
assert.match(workflow, /Run Trophy Road progression regression/);
assert.match(workflow, /node turn-lab\/tests\/trophy-road-production\.mjs/);
assert.match(perkWrapper, /TROPHY_ROAD_MAX_THRESHOLD = 3075/);
assert.match(perkWrapper, /\['vintage-racer', 300\]/);
assert.match(perkWrapper, /\['midnight-city', 400\]/);
assert.match(perkWrapper, /\['mountain', 700\]/);
assert.match(perkWrapper, /\['paintjob', 900\]/);
assert.match(perkWrapper, /\['rally-racer', 1000\]/);
assert.match(perkWrapper, /rewardIdsForTrophies/);
assert.match(homeGate, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(lotGate, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(paintGate, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(paintGate, /reward\(\)\?\.threshold \|\| 900/);

assert.match(perkDisclosure, /getCarDefinition\(vehicleId\)\?\.perk/,
  'The Lot must read perk identity directly from the selected car, not from progression ownership');
assert.doesNotMatch(perkDisclosure, /rewardForVehicle|trophy-road/,
  'Vehicle perks must not be free-floating Trophy Road entitlements');
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
assert.match(perkDisclosure, /copy\.textContent = perkDescription/);
assert.match(enhancementRuntime, /installLotPerkDisclosure/);
assert.match(enhancementRuntime, /lot-perk-disclosure\.js\?revision=r164-vintage-rally-perks/);
assert.match(enhancementRuntime, /lot-trophy-gate\.js\?revision=r164-vintage-rally-perks/);

console.log('TURN Trophy Road reward order, 700-trophy Mountain gate, grandfathering and perk presentation regression passed.');

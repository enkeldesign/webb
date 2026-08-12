import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createAchievementStore, normalizeAchievementState } from '../../turn/achievements/store.js';
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
  rewardForVehicle,
  rewardIdsForTrophies
} from '../../turn/progression/trophy-road.js';

const [roadSource, view, feedback, app, fixedLayout, workflow, perkDisclosure, enhancementRuntime, perkWrapper] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/trophy-road.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/trophy-road-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road-perks-r164.js', import.meta.url), 'utf8')
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

assert.equal(TROPHY_ROAD_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(TROPHY_ROAD_STORAGE_VERSION, 4,
  'The extra all-track progress uses its own storage and must not force a Trophy Road migration');
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 1700,
  'The base road must retain room for the complete expanded trophy collection');
assert.equal(TROPHY_ROAD_VIEWPORT_THRESHOLD, 600);
assert.deepEqual(
  TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['midnight-city', 300],
    ['paintjob', 400],
    ['future-racer', 500],
    ['emergency-pack', 600],
    ['monster', 700]
  ]
);

assert.deepEqual(rewardIdsForTrophies(299), []);
assert.deepEqual(rewardIdsForTrophies(300), ['midnight-city']);
assert.deepEqual(rewardIdsForTrophies(400), ['midnight-city', 'paintjob']);
assert.deepEqual(rewardIdsForTrophies(500), ['midnight-city', 'paintjob', 'future-racer']);
assert.deepEqual(rewardIdsForTrophies(600), ['midnight-city', 'paintjob', 'future-racer', 'emergency-pack']);
assert.deepEqual(rewardIdsForTrophies(700), ['midnight-city', 'paintjob', 'future-racer', 'emergency-pack', 'monster']);
assert.deepEqual(rewardIdsForTrophies(1700), TROPHY_ROAD_REWARDS.map((reward) => reward.id));
assert.equal(rewardForTrack('midnight-city')?.id, 'midnight-city');
assert.equal(rewardForVehicle('firetruck')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('race-future')?.id, 'future-racer');
assert.equal(rewardForVehicle('monster-truck')?.id, 'monster');
assert.equal(rewardForFeature('vehicle-paint')?.id, 'paintjob');
assert.equal(getTrophyRoadReward('invented'), null);

const futurePerk = getTrophyRoadReward('future-racer');
assert.equal(futurePerk?.perkTitle, 'OVERDRIVE');
assert.match(futurePerk?.perkDescription || '', /5 clean seconds/);
assert.match(futurePerk?.description || '', /<strong>OVERDRIVE:<\/strong>/);

const emergencyPerk = getTrophyRoadReward('emergency-pack');
assert.equal(emergencyPerk?.perkTitle, 'SIRENS');
assert.match(emergencyPerk?.perkDescription || '', /emergency lights and sirens/i);
assert.match(emergencyPerk?.description || '', /<strong>SIRENS:<\/strong>/);
for (const vehicleId of ['firetruck', 'ambulance', 'police']) {
  assert.equal(rewardForVehicle(vehicleId)?.perkTitle, 'SIRENS');
}

const monsterPerk = getTrophyRoadReward('monster');
assert.equal(monsterPerk?.perkTitle, 'OVERSIZED');
assert.match(monsterPerk?.perkDescription || '', /off-road/i);
assert.match(monsterPerk?.description || '', /<strong>OVERSIZED:<\/strong>/);

for (const reward of [futurePerk, emergencyPerk, monsterPerk]) {
  assert.doesNotMatch(reward?.description || '', /<strong>PERK:<\/strong>/,
    'Unlock details must lead with the actual perk title rather than the generic word PERK');
}

assert.deepEqual(grandfatheredRewardIdsForVersion(3), ['paintjob', 'monster']);
assert.deepEqual(
  grandfatheredRewardIdsForVersion(2),
  ['midnight-city', 'paintjob', 'future-racer', 'emergency-pack', 'monster']
);
assert.deepEqual(grandfatheredRewardIdsForVersion(4), []);

const freshStorage = createMemoryStorage();
assert.equal(prepareTrophyRoadProfile(freshStorage), null);
assert.deepEqual(readTrophyRoadSnapshot(freshStorage).unlockedRewardIds, []);
assert.equal(isTrackUnlocked('countryside', freshStorage), true);
assert.equal(isTrackUnlocked('midnight-city', freshStorage), false);
assert.equal(isVehicleUnlocked('classic', freshStorage), true);
assert.equal(isVehicleUnlocked('firetruck', freshStorage), false);
assert.equal(isVehicleUnlocked('monster-truck', freshStorage), false);
assert.equal(isPaintUnlocked(freshStorage), false);

const legacyWithoutAchievements = createMemoryStorage({
  'turn-vehicle-selection-v1': JSON.stringify({ carId: 'police' })
});
const preparedLegacy = prepareTrophyRoadProfile(legacyWithoutAchievements);
assert.equal(preparedLegacy?.version, 2);
assert.deepEqual(
  readTrophyRoadSnapshot(legacyWithoutAchievements).unlockedRewardIds,
  ['midnight-city', 'paintjob', 'future-racer', 'emergency-pack', 'monster']
);
assert.equal(isPaintUnlocked(legacyWithoutAchievements), true);
assert.equal(isVehicleUnlocked('monster-truck', legacyWithoutAchievements), true);

const migratedLegacy = normalizeAchievementState({
  version: 2,
  unlocked: {
    'first-turn': { unlockedAt: 1, trackId: 'countryside', vehicleId: 'classic', time: 20 }
  },
  seen: ['first-turn'],
  progress: { tracks: ['countryside'], blankTracks: [] }
});
assert.equal(migratedLegacy.version, 4);
assert.deepEqual(
  migratedLegacy.rewards.unlocked,
  ['midnight-city', 'paintjob', 'future-racer', 'emergency-pack', 'monster']
);
assert.deepEqual(migratedLegacy.rewards.seen, migratedLegacy.rewards.unlocked);

const progressionStorage = createMemoryStorage();
const store = createAchievementStore(progressionStorage);
assert.equal(store.unlock('trust-your-ears', { trackId: 'countryside' })?.trophies, 200);
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('beyond-sight', { trackId: 'countryside' })?.trophies, 300);
assert.deepEqual(
  store.syncRewards().map((reward) => reward.id),
  ['midnight-city', 'paintjob', 'future-racer']
);
assert.equal(store.unlock('around-the-turn', { trackId: 'harbor' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['emergency-pack']);
assert.equal(store.unlock('faster-than-the-dev', { trackId: 'midnight-city' })?.trophies, 100);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['monster']);
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), true);
assert.equal(isVehicleUnlocked('firetruck', progressionStorage), true);
assert.equal(isVehicleUnlocked('monster-truck', progressionStorage), true);
assert.equal(isPaintUnlocked(progressionStorage), true);

assert.match(roadSource, /TROPHY_ROAD_STORAGE_VERSION = 4/);
assert.match(roadSource, /TROPHY_ROAD_MAX_THRESHOLD = 1700/);
assert.match(roadSource, /TROPHY_ROAD_VIEWPORT_THRESHOLD = 600/);
for (const threshold of [300, 400, 500, 600, 700]) {
  assert.match(roadSource, new RegExp(`threshold: ${threshold}`));
}
assert.match(roadSource, /id: 'paintjob'/);
assert.match(roadSource, /id: 'future-racer'/);
assert.match(roadSource, /perkTitle: 'OVERDRIVE'/);
assert.match(roadSource, /id: 'emergency-pack'/);
assert.match(roadSource, /perkTitle: 'SIRENS'/);
assert.match(roadSource, /id: 'monster'/);
assert.match(roadSource, /perkTitle: 'OVERSIZED'/);
assert.doesNotMatch(roadSource, /<strong>PERK:<\/strong>/);
assert.match(roadSource, /grandfatheredRewardIdsForVersion/);
assert.doesNotMatch(roadSource, /clearRivals|resetRivals|rival-storage/);

assert.match(view, /aria-valuemax="\$\{TROPHY_ROAD_MAX_THRESHOLD\}"/);
assert.match(view, /total \/ TROPHY_ROAD_MAX_THRESHOLD/);
assert.match(feedback, /TROPHY_ROAD_MAX_THRESHOLD/);
assert.match(app, /trophy-road\.js\?revision=r166-bella-records/);
assert.match(fixedLayout, /r166-bella-records/);
assert.match(workflow, /Run Trophy Road progression regression/);
assert.match(workflow, /node turn-lab\/tests\/trophy-road-production\.mjs/);
assert.match(perkWrapper, /TROPHY_ROAD_MAX_THRESHOLD = 1750/,
  'The production Chromatic-era Trophy Road must keep the full 1,750 trophy scale');
assert.match(perkWrapper, /trophy-road\.js\?revision=r164-perk-titles/);

assert.match(perkDisclosure, /reward\?\.perkTitle/);
assert.match(perkDisclosure, /reward\?\.perkDescription/);
assert.match(perkDisclosure, /className = 'lot-perk-copy'/);
assert.match(perkDisclosure, /color: #2f6f38/,
  'Named vehicle perk copy must use the dark achievement-green treatment');
assert.doesNotMatch(perkDisclosure, /lot-perk-button|aria-expanded/,
  'Named perk information must be inline and must not spend vertical space on a disclosure button');
assert.match(perkDisclosure, /<strong>\$\{perkTitle\}:<\/strong>/);
assert.match(enhancementRuntime, /installLotPerkDisclosure/);
assert.match(enhancementRuntime, /lot-perk-disclosure\.js\?revision=r164-perk-titles-inline/);

console.log('TURN expanded Trophy Road, named vehicle perks and inline Lot perk presentation regression passed.');

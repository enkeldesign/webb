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
  isTrackUnlocked,
  isVehicleUnlocked,
  prepareTrophyRoadProfile,
  readTrophyRoadSnapshot,
  rewardForTrack,
  rewardForVehicle,
  rewardIdsForTrophies
} from '../../turn/progression/trophy-road.js';

const [
  roadSource,
  roadCss,
  homeGate,
  lotGate,
  view,
  feedback,
  runtime,
  app,
  fixedLayout,
  lotEnhancement,
  vehicleCatalog,
  workflow
] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/trophy-road.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/trophy-road-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

function createMemoryStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  return {
    get length() {
      return memory.size;
    },
    key(index) {
      return [...memory.keys()][index] ?? null;
    },
    getItem(key) {
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
    removeItem(key) {
      memory.delete(key);
    }
  };
}

assert.equal(TROPHY_ROAD_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(TROPHY_ROAD_STORAGE_VERSION, 3);
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 1300,
  'The road must retain room for the complete current trophy collection');
assert.equal(TROPHY_ROAD_VIEWPORT_THRESHOLD, 600,
  'The first 600 trophies should fit in the initial road viewport');
assert.deepEqual(
  TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['midnight-city', 300],
    ['future-racer', 400],
    ['emergency-pack', 600]
  ]
);
assert.deepEqual(rewardIdsForTrophies(299), []);
assert.deepEqual(rewardIdsForTrophies(300), ['midnight-city']);
assert.deepEqual(rewardIdsForTrophies(399), ['midnight-city']);
assert.deepEqual(rewardIdsForTrophies(400), ['midnight-city', 'future-racer']);
assert.deepEqual(rewardIdsForTrophies(599), ['midnight-city', 'future-racer']);
assert.deepEqual(rewardIdsForTrophies(600), ['midnight-city', 'future-racer', 'emergency-pack']);
assert.equal(rewardForTrack('midnight-city')?.id, 'midnight-city');
assert.equal(rewardForVehicle('police')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('ambulance')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('firetruck')?.id, 'emergency-pack');
assert.equal(rewardForVehicle('race-future')?.id, 'future-racer');
assert.equal(getTrophyRoadReward('invented'), null);

const freshStorage = createMemoryStorage();
assert.equal(prepareTrophyRoadProfile(freshStorage), null,
  'A genuinely new player must not be mistaken for an existing profile');
assert.deepEqual(readTrophyRoadSnapshot(freshStorage).unlockedRewardIds, []);
assert.equal(isTrackUnlocked('countryside', freshStorage), true);
assert.equal(isTrackUnlocked('midnight-city', freshStorage), false);
assert.equal(isVehicleUnlocked('classic', freshStorage), true);
assert.equal(isVehicleUnlocked('police', freshStorage), false);
assert.equal(isVehicleUnlocked('race-future', freshStorage), false);
freshStorage.setItem('turn-drive-by-ear-v1', 'false');
assert.equal(prepareTrophyRoadProfile(freshStorage), null,
  'A setting created later in a fresh session must not retroactively grandfather the player');
assert.deepEqual(readTrophyRoadSnapshot(freshStorage).unlockedRewardIds, []);

const legacyWithoutAchievements = createMemoryStorage({
  'turn-vehicle-selection-v1': JSON.stringify({ carId: 'police' })
});
const preparedLegacy = prepareTrophyRoadProfile(legacyWithoutAchievements);
assert.equal(preparedLegacy?.version, 2,
  'Existing TURN profiles without achievement storage need a grandfathering shell');
assert.equal(readTrophyRoadSnapshot(legacyWithoutAchievements).isLegacyProfile, true);
assert.deepEqual(
  readTrophyRoadSnapshot(legacyWithoutAchievements).unlockedRewardIds,
  ['midnight-city', 'future-racer', 'emergency-pack']
);

const migrated = normalizeAchievementState({
  version: 2,
  unlocked: {
    'first-turn': { unlockedAt: 1, trackId: 'countryside', vehicleId: 'classic', time: 20 }
  },
  seen: ['first-turn'],
  progress: { tracks: ['countryside'], blankTracks: [] }
});
assert.equal(migrated.version, 3);
assert.deepEqual(migrated.rewards.unlocked, ['midnight-city', 'future-racer', 'emergency-pack']);
assert.deepEqual(migrated.rewards.seen, migrated.rewards.unlocked,
  'Grandfathered content must not create a misleading reward notification');

const progressionStorage = createMemoryStorage();
const store = createAchievementStore(progressionStorage);
assert.equal(store.trophyTotal(), 0);
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('trust-your-ears', { trackId: 'countryside' })?.trophies, 200);
assert.equal(store.trophyTotal(), 200);
assert.deepEqual(store.syncRewards(), [],
  'One introductory 200-trophy lap must not immediately unlock Midnight City');

assert.equal(store.unlock('beyond-sight', { trackId: 'countryside' })?.trophies, 300);
assert.equal(store.trophyTotal(), 500);
assert.deepEqual(
  store.syncRewards().map((reward) => reward.id),
  ['midnight-city', 'future-racer']
);
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), true);
assert.equal(isVehicleUnlocked('race-future', progressionStorage), true);
assert.equal(isVehicleUnlocked('police', progressionStorage), false);

assert.equal(store.unlock('around-the-turn', { trackId: 'harbor' })?.trophies, 100);
assert.equal(store.trophyTotal(), 600);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['emergency-pack']);
assert.equal(isVehicleUnlocked('police', progressionStorage), true);
assert.deepEqual(store.unseenRewardIds(), ['midnight-city', 'future-racer', 'emergency-pack']);
store.markAllSeen();
assert.deepEqual(store.unseenRewardIds(), []);

const previousAchievements = globalThis.__turnAchievements;
const blockedStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); }
};
globalThis.__turnAchievements = { store };
assert.equal(isVehicleUnlocked('police', blockedStorage), true,
  'Session-only rewards must open content even when persistent browser storage is blocked');
if (previousAchievements === undefined) delete globalThis.__turnAchievements;
else globalThis.__turnAchievements = previousAchievements;

const permanentReward = normalizeAchievementState({
  version: 3,
  unlocked: {},
  seen: [],
  progress: { tracks: [], blankTracks: [] },
  rewards: { unlocked: ['emergency-pack'], seen: ['emergency-pack'] }
});
assert.deepEqual(permanentReward.rewards.unlocked, ['emergency-pack'],
  'Once awarded, a reward must remain owned even if thresholds change later');

assert.match(roadSource, /TROPHY_ROAD_VIEWPORT_THRESHOLD = 600/);
assert.match(roadSource, /threshold: 300/);
assert.match(roadSource, /threshold: 400/);
assert.match(roadSource, /threshold: 600/);
assert.match(roadSource, /LOCK_ICON/);
assert.match(roadSource, /showTrophyUnlockNotice/);
assert.match(roadSource, /PREPARED_STORAGE = new WeakSet/);
assert.match(roadSource, /globalThis\.__turnAchievements\?\.store/);
assert.doesNotMatch(roadSource, /clearRivals|resetRivals|rival-storage/);

assert.match(homeGate, /showTrophyUnlockNotice/);
assert.match(homeGate, /continueButton\.disabled = true/);
assert.match(homeGate, /card\.addEventListener\('click'/);
assert.doesNotMatch(homeGate, /fallbackCard\?\.click/,
  'Locked tracks should remain selected and inspectable instead of silently moving selection');

assert.match(lotGate, /raceButton\.disabled = locked/);
assert.match(lotGate, /lot-selected-car-lock/);
assert.match(lotGate, /showTrophyUnlockNotice/);
assert.doesNotMatch(lotGate, /colors\.hidden|carPicker\.hidden/,
  'Locked vehicles must retain their normal information and paint presentation');

assert.match(view, /turn-trophy-road-progress" role="progressbar"/);
assert.match(view, /turn-trophy-road-markers" aria-label="Trophy Road rewards"/);
assert.ok(
  view.indexOf('turn-trophy-road-progress" role="progressbar"')
    < view.indexOf('turn-trophy-road-markers" aria-label="Trophy Road rewards"'),
  'Reward buttons should be siblings of the progressbar rather than descendants hidden by progressbar semantics'
);
assert.match(feedback, /TROPHY_ROAD_VIEWPORT_THRESHOLD/);
assert.match(feedback, /turn-trophy-road-scroll/);
assert.match(feedback, /selectedByPlayer = ''/);
assert.match(feedback, /clearSelection\(\)/);
assert.match(feedback, /resetView\(\)/);
assert.match(feedback, /CATEGORY\.WAYS_TO_PLAY/);
assert.match(feedback, /CATEGORY\.EXPLORATION/);
assert.match(feedback, /CATEGORY\.RACING/);
assert.match(feedback, /dataset\.achievementFilter/);
assert.match(feedback, /activeCategories/);
assert.match(feedback, /activeStatuses/);
assert.match(feedback, /categoryMatch && statusMatch/);
assert.match(feedback, /id: 'locked'/);
assert.match(feedback, /LOCK_ICON/);
assert.match(runtime, /turn:trophy-road-updated/);
assert.match(runtime, /showRewardToastBatch/);
assert.match(runtime, /store\.syncRewards\(\)/);

assert.ok(
  app.indexOf('prepareTrophyRoadProfile();') < app.indexOf("await import(withBuild('./main.js'))"),
  'Grandfathering must be prepared before the runtime loads the saved vehicle selection'
);
assert.match(app, /trophy-road\.js\?revision=r154-trophy-road-feedback/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r121&trophy-road=r154/);
assert.match(fixedLayout, /installM8TrophyGate/);
assert.match(fixedLayout, /installTrophyRoadFeedback/);
assert.ok(
  fixedLayout.indexOf('installM8TrophyGate') < fixedLayout.indexOf('installAchievements'),
  'Track access should be gated before achievement UI is installed'
);
assert.match(lotEnhancement, /gateLotNow/);
assert.ok(
  lotEnhancement.indexOf('gateLotNow(scope)') < lotEnhancement.indexOf('installLotAccessibility(scope)'),
  'The accessibility layer should capture the complete locked vehicle names'
);
assert.match(roadCss, /overflow-x: auto/);
assert.match(roadCss, /translate\(-50%, -50%\)/);
assert.match(roadCss, /turn-trophy-road-marker-lock/);
assert.match(roadCss, /turn-unlock-notice/);
assert.match(roadCss, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(vehicleCatalog, /\['vintage-racer',[\s\S]*speed: 4, acceleration: 4, control: 3, drift: 2, boostPower: 3, boostDuration: 2/);
assert.match(vehicleCatalog, /\['race', 'Race Car',[\s\S]*speed: 5, acceleration: 4, control: 4, drift: 2, boostPower: 2, boostDuration: 1/);
assert.match(workflow, /Run Trophy Road progression regression/);

console.log('TURN Trophy Road feedback and progression regression passed.');

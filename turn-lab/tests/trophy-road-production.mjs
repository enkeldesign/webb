import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createAchievementStore, normalizeAchievementState } from '../../turn/achievements/store.js';
import {
  TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_STORAGE_KEY,
  TROPHY_ROAD_STORAGE_VERSION,
  getTrophyRoadReward,
  isTrackUnlocked,
  isVehicleUnlocked,
  prepareTrophyRoadProfile,
  readTrophyRoadSnapshot,
  rewardForTrack,
  rewardForVehicle,
  rewardIdsForTrophies
} from '../../turn/progression/trophy-road.js';

const [roadSource, roadCss, homeGate, lotGate, view, runtime, app, fixedLayout, lotEnhancement, workflow] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/trophy-road.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
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
  'The visible road should continue through the complete current trophy collection');
assert.deepEqual(
  TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['midnight-city', 200],
    ['emergency-pack', 400],
    ['future-racer', 500]
  ]
);
assert.deepEqual(rewardIdsForTrophies(199), []);
assert.deepEqual(rewardIdsForTrophies(200), ['midnight-city']);
assert.deepEqual(rewardIdsForTrophies(399), ['midnight-city']);
assert.deepEqual(rewardIdsForTrophies(400), ['midnight-city', 'emergency-pack']);
assert.deepEqual(rewardIdsForTrophies(500), ['midnight-city', 'emergency-pack', 'future-racer']);
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
  ['midnight-city', 'emergency-pack', 'future-racer']
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
assert.deepEqual(migrated.rewards.unlocked, ['midnight-city', 'emergency-pack', 'future-racer']);
assert.deepEqual(migrated.rewards.seen, migrated.rewards.unlocked,
  'Grandfathered content must not create a misleading reward notification');

const progressionStorage = createMemoryStorage();
const store = createAchievementStore(progressionStorage);
assert.equal(store.trophyTotal(), 0);
assert.deepEqual(store.syncRewards(), []);
assert.equal(store.unlock('trust-your-ears', { trackId: 'countryside' })?.trophies, 200);
assert.equal(store.trophyTotal(), 200);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['midnight-city']);
assert.equal(store.isRewardUnlocked('midnight-city'), true);
assert.equal(isTrackUnlocked('midnight-city', progressionStorage), true);
assert.equal(isVehicleUnlocked('police', progressionStorage), false);

assert.equal(store.unlock('beyond-sight', { trackId: 'midnight-city' })?.trophies, 300);
assert.equal(store.trophyTotal(), 500);
assert.deepEqual(
  store.syncRewards().map((reward) => reward.id),
  ['emergency-pack', 'future-racer']
);
assert.equal(isVehicleUnlocked('police', progressionStorage), true);
assert.equal(isVehicleUnlocked('race-future', progressionStorage), true);
assert.deepEqual(store.unseenRewardIds(), ['midnight-city', 'emergency-pack', 'future-racer']);
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

assert.match(roadSource, /TROPHY_ROAD_MAX_THRESHOLD = 1300/);
assert.match(roadSource, /threshold: 200/);
assert.match(roadSource, /threshold: 400/);
assert.match(roadSource, /threshold: 500/);
assert.match(roadSource, /turn-drive-by-ear-v1/);
assert.match(roadSource, /PREPARED_STORAGE = new WeakSet/);
assert.match(roadSource, /preparationAlreadyChecked/);
assert.match(roadSource, /globalThis\.__turnAchievements\?\.store/);
assert.match(roadSource, /prepareTrophyRoadProfile/);
assert.match(roadSource, /Number\(state\.version \|\| 0\) < TROPHY_ROAD_STORAGE_VERSION/);
assert.doesNotMatch(roadSource, /clearRivals|resetRivals|rival-storage/);

assert.match(homeGate, /data-track-id="\$\{LOCKED_TRACK_ID\}"/);
assert.match(homeGate, /event\.stopImmediatePropagation\(\)/);
assert.match(homeGate, /fallbackCard\?\.click\(\)/);
assert.match(homeGate, /aria-disabled/);
assert.match(homeGate, /turn:trophy-road-updated/);

assert.match(lotGate, /FALLBACK_VEHICLE_ID = 'classic'/);
assert.match(lotGate, /raceButton\.disabled = locked/);
assert.match(lotGate, /colors\.hidden = locked/);
assert.match(lotGate, /UNLOCKS AT \$\{reward\.threshold\} TROPHIES/);
assert.match(lotGate, /aria-disabled/);

assert.match(view, /turn-trophy-road-progress" role="progressbar"/);
assert.match(view, /turn-trophy-road-markers" aria-label="Trophy Road rewards"/);
assert.ok(
  view.indexOf('turn-trophy-road-progress" role="progressbar"')
    < view.indexOf('turn-trophy-road-markers" aria-label="Trophy Road rewards"'),
  'Reward buttons should be siblings of the progressbar rather than descendants hidden by progressbar semantics'
);
assert.match(view, /TROPHY ROAD REWARD/);
assert.match(view, /store\.unseenCount\(\)/);
assert.match(runtime, /turn:trophy-road-updated/);
assert.match(runtime, /showRewardToastBatch/);
assert.match(runtime, /store\.syncRewards\(\)/);

assert.ok(
  app.indexOf('prepareTrophyRoadProfile();') < app.indexOf("await import(withBuild('./main.js'))"),
  'Grandfathering must be prepared before the runtime loads the saved vehicle selection'
);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r153-trophy-road/);
assert.match(fixedLayout, /installM8TrophyGate/);
assert.ok(
  fixedLayout.indexOf('installM8TrophyGate') < fixedLayout.indexOf('installAchievements'),
  'Track access should be gated before achievement UI is installed'
);
assert.match(lotEnhancement, /gateLotNow/);
assert.ok(
  lotEnhancement.indexOf('gateLotNow(scope)') < lotEnhancement.indexOf('installLotAccessibility(scope)'),
  'The accessibility layer should capture the complete locked vehicle names'
);
assert.match(roadCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(roadCss, /\.track-card\[data-trophy-locked="true"\]/);
assert.match(roadCss, /\.lot-car-option\.is-trophy-locked/);
assert.match(workflow, /Run Trophy Road progression regression/);

console.log('TURN Trophy Road progression regression passed.');

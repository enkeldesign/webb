import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ADMIN_SESSION_KEY,
  ADMIN_UNLOCK_SEQUENCE,
  advanceAdminUnlockSequence,
  completeAdminUnlockFromLot,
  createAdminRewardState,
  repairPersistedAdminState,
  unlockRewardsForTesting
} from '../../turn/testing/admin-unlock-sequence.js';
import { ACHIEVEMENT_STORAGE_KEY } from '../../turn/achievements/store.js';
import { TROPHY_ROAD_REWARDS } from '../../turn/progression/trophy-road.js';

const [source, indexSource, releaseSource] = await Promise.all([
  fs.readFile(new URL('../../turn/testing/admin-unlock-sequence.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.deepEqual(ADMIN_UNLOCK_SEQUENCE, [
  'track:countryside',
  'track:airport',
  'track:countryside',
  'track:airport',
  'track:cliffside',
  'track:countryside',
  'track:airport',
  'track:cliffside',
  'track:harbor',
  'action:race',
  'vehicle:convertible',
  'action:race-this-car'
]);

let index = 0;
for (const irrelevant of ['action:race-this-car', 'track:harbor', 'vehicle:convertible']) {
  index = advanceAdminUnlockSequence(index, irrelevant).nextIndex;
  assert.equal(index, 0, 'Activity before the first Countryside selection must not matter');
}

for (let step = 0; step < ADMIN_UNLOCK_SEQUENCE.length; step += 1) {
  const result = advanceAdminUnlockSequence(index, ADMIN_UNLOCK_SEQUENCE[step]);
  assert.equal(result.completed, step === ADMIN_UNLOCK_SEQUENCE.length - 1);
  index = result.nextIndex;
}
assert.equal(index, 0, 'The recognizer must reset after a completed sequence');
assert.equal(advanceAdminUnlockSequence(4, 'track:harbor').nextIndex, 0);
assert.equal(advanceAdminUnlockSequence(4, 'track:countryside').nextIndex, 1,
  'A mismatch matching the first token should immediately restart the sequence');

let lotEntryIndex = 0;
for (const token of ADMIN_UNLOCK_SEQUENCE.slice(0, 10)) {
  lotEntryIndex = advanceAdminUnlockSequence(lotEntryIndex, token).nextIndex;
}
assert.equal(ADMIN_UNLOCK_SEQUENCE[lotEntryIndex], 'vehicle:convertible');
assert.equal(completeAdminUnlockFromLot(lotEntryIndex, 'convertible').completed, true,
  'AWD already selected on Lot entry must complete without another vehicle click');
assert.equal(completeAdminUnlockFromLot(lotEntryIndex, 'classic').completed, false,
  'RACE THIS CAR must not complete while another vehicle is selected');
const explicitAwdIndex = advanceAdminUnlockSequence(
  lotEntryIndex,
  'vehicle:convertible'
).nextIndex;
assert.equal(completeAdminUnlockFromLot(explicitAwdIndex, 'convertible').completed, true,
  'Selecting AWD after entering The Lot must also complete');

const rewardIds = TROPHY_ROAD_REWARDS.map(({ id }) => id);
const existing = {
  version: 6,
  unlocked: {
    'first-turn': {
      unlockedAt: 123,
      trackId: 'countryside',
      vehicleId: 'classic',
      time: 18
    }
  },
  seen: ['first-turn'],
  progress: { tracks: ['countryside'], blankTracks: [] },
  rewards: { unlocked: [], seen: [] }
};
const temporary = createAdminRewardState(existing).snapshot;
assert.deepEqual(Object.keys(temporary.unlocked), ['first-turn'],
  'The admin sequence must not create achievement records');
assert.deepEqual(temporary.seen, ['first-turn']);
assert.deepEqual(temporary.progress.tracks, ['countryside']);
assert.deepEqual(temporary.progress.blankTracks, []);
assert.deepEqual(temporary.rewards.unlocked, rewardIds,
  'The active testing session still needs every Trophy Road reward');
assert.deepEqual(temporary.rewards.seen, rewardIds);
assert.equal(temporary.unlocked['first-turn'].unlockedAt, 123,
  'Real achievement history must be preserved');

const originalRaw = JSON.stringify(existing);
const storage = memoryStorage({ [ACHIEVEMENT_STORAGE_KEY]: originalRaw });
const activeSession = memoryStorage();
assert.equal(unlockRewardsForTesting(storage, activeSession), true);
assert.equal(activeSession.getItem(ADMIN_SESSION_KEY), '1',
  'Admin mode must be scoped to the current browser/PWA session');
const activeStored = JSON.parse(storage.getItem(ACHIEVEMENT_STORAGE_KEY));
assert.deepEqual(activeStored.rewards.unlocked, rewardIds);
const marker = JSON.parse(storage.getItem('turn-admin-unlock-v1'));
assert.equal(marker.version, 3);
assert.equal(marker.sessionOnly, true);
assert.equal(marker.backup, originalRaw,
  'The exact pre-admin achievement payload must be backed up before rewards are granted');

const sameSessionRepair = repairPersistedAdminState(storage, activeSession);
assert.equal(sameSessionRepair.repaired, false);
assert.equal(sameSessionRepair.activeSession, true);
assert.deepEqual(JSON.parse(storage.getItem(ACHIEVEMENT_STORAGE_KEY)).rewards.unlocked, rewardIds,
  'A normal reload inside the testing session must keep admin rewards available');

const freshSession = memoryStorage();
const freshSessionRepair = repairPersistedAdminState(storage, freshSession);
assert.equal(freshSessionRepair.repaired, true);
assert.equal(freshSessionRepair.activeSession, false);
assert.equal(storage.getItem(ACHIEVEMENT_STORAGE_KEY), originalRaw,
  'A fresh browser/PWA session must restore the exact profile that existed before admin mode');
assert.equal(storage.getItem('turn-admin-unlock-v1'), null);

const pollutedV2 = memoryStorage({
  [ACHIEVEMENT_STORAGE_KEY]: JSON.stringify({
    version: 6,
    unlocked: {},
    seen: [],
    progress: { tracks: [], blankTracks: [] },
    rewards: { unlocked: rewardIds, seen: rewardIds }
  }),
  'turn-admin-unlock-v1': JSON.stringify({
    version: 2,
    activatedAt: 456,
    rewardsOnly: true
  })
});
const repairedV2 = repairPersistedAdminState(pollutedV2, memoryStorage());
assert.equal(repairedV2.repaired, true,
  'Profiles polluted by the previous permanent rewards-only admin path must self-repair');
assert.deepEqual(JSON.parse(pollutedV2.getItem(ACHIEVEMENT_STORAGE_KEY)).rewards.unlocked, [],
  'A zero-trophy profile must not retain admin-granted rewards after repair');
assert.equal(pollutedV2.getItem('turn-admin-unlock-v1'), null);

const allTracks = ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city'];
const legacyTimestamp = 456;
const pollutedV1 = memoryStorage({
  [ACHIEVEMENT_STORAGE_KEY]: JSON.stringify({
    version: 4,
    unlocked: {
      'first-turn': {
        unlockedAt: 123,
        trackId: 'countryside',
        vehicleId: 'classic',
        time: 18
      },
      'save-bella': {
        unlockedAt: legacyTimestamp,
        trackId: '',
        vehicleId: '',
        time: null
      },
      'beyond-sight': {
        unlockedAt: legacyTimestamp,
        trackId: '',
        vehicleId: '',
        time: null
      }
    },
    seen: ['first-turn', 'save-bella', 'beyond-sight'],
    progress: { tracks: allTracks, blankTracks: allTracks },
    rewards: { unlocked: rewardIds, seen: rewardIds }
  }),
  'turn-admin-unlock-v1': JSON.stringify({
    version: 1,
    activatedAt: legacyTimestamp
  })
});
const repairedV1 = repairPersistedAdminState(pollutedV1, memoryStorage());
assert.equal(repairedV1.repaired, true);
const repairedLegacy = JSON.parse(pollutedV1.getItem(ACHIEVEMENT_STORAGE_KEY));
assert.deepEqual(Object.keys(repairedLegacy.unlocked), ['first-turn'],
  'The original full-profile admin path must still have its fabricated achievements removed');
assert.deepEqual(repairedLegacy.seen, ['first-turn']);
assert.deepEqual(repairedLegacy.progress.tracks, []);
assert.deepEqual(repairedLegacy.progress.blankTracks, []);
assert.equal(repairedLegacy.unlocked['save-bella'], undefined,
  'SAVE BELLA! must remain available for real rescue testing');

assert.match(source, /target\.closest\('\.m8-track-continue'\)/,
  'The Home RACE action must be the separator that opens The Lot');
assert.match(source, /aria-checked="true"/,
  'The final action must detect an AWD that was already selected on Lot entry');
assert.match(source, /completeAdminUnlockFromLot\(sequenceIndex, selectedVehicleId\)/);
assert.match(source, /unlockRewardsForTesting\(storage, sessionStore\)/);
assert.match(source, /sessionOnly: true/);
assert.match(source, /backup/,
  'Admin mode must preserve a pre-unlock backup instead of making rewards permanent');
assert.match(source, /repairPersistedAdminState\(storage, sessionStore\)/,
  'Startup must repair previous pollution and restore completed session-scoped admin modes');
assert.match(source, /resetLegacyChallengeProgress\(storage\)/,
  'The corrected path must clear challenge progress polluted by the old all-achievement unlock');
assert.doesNotMatch(source, /ACHIEVEMENTS|TRACK_IDS/,
  'The admin module must not enumerate achievements or fake all-track progress');
assert.doesNotMatch(source, /turn:achievements-updated|turn:trophy-road-updated|turn:secret-achievement/,
  'The admin path must not emit achievement or reward events');
assert.match(source, /documentRef\.addEventListener\('click', handleClick, true\)/);
assert.match(source, /event\.preventDefault\(\)/);
assert.match(source, /event\.stopImmediatePropagation\(\)/);
assert.match(source, /globalThis\.setTimeout\?\.\(reload, 0\)/,
  'The final action must reload so all pre-rendered reward gates rebuild unlocked');
assert.match(source, /installAdminUnlockSequence\(\);\s*$/,
  'The isolated production module must install itself');
assert.match(indexSource,
  /<script type="module" src="\.\/testing\/admin-unlock-sequence\.js\?revision=r224-admin-session-rewards"><\/script>/,
  'Production must publish the self-repairing session-only recognizer under a fresh cache identity');
assert.match(indexSource,
  new RegExp(`src="\\.\\/live-steering-setting\\.js\\?build=${escapeRegex(release.cacheKey)}-live-steering"`),
  'The hidden recognizer must not disturb the canonical steering entry');

console.log('TURN session-scoped admin unlock regression passed.');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

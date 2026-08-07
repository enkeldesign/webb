import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ADMIN_UNLOCK_SEQUENCE,
  advanceAdminUnlockSequence,
  completeAdminUnlockFromLot,
  createAdminRewardState
} from '../../turn/testing/admin-unlock-sequence.js';
import { TROPHY_ROAD_REWARDS } from '../../turn/progression/trophy-road.js';

const [source, indexSource] = await Promise.all([
  fs.readFile(new URL('../../turn/testing/admin-unlock-sequence.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8')
]);

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
  'Convertible already selected on Lot entry must complete without another vehicle click');
assert.equal(completeAdminUnlockFromLot(lotEntryIndex, 'classic').completed, false,
  'RACE THIS CAR must not complete while another vehicle is selected');
const explicitConvertibleIndex = advanceAdminUnlockSequence(
  lotEntryIndex,
  'vehicle:convertible'
).nextIndex;
assert.equal(completeAdminUnlockFromLot(explicitConvertibleIndex, 'convertible').completed, true,
  'Selecting Convertible after entering The Lot must also complete');

const rewardIds = TROPHY_ROAD_REWARDS.map(({ id }) => id);
const existing = {
  version: 4,
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
const preserved = createAdminRewardState(existing).snapshot;
assert.deepEqual(Object.keys(preserved.unlocked), ['first-turn'],
  'The admin sequence must not create achievement records');
assert.deepEqual(preserved.seen, ['first-turn']);
assert.deepEqual(preserved.progress.tracks, ['countryside']);
assert.deepEqual(preserved.progress.blankTracks, []);
assert.deepEqual(preserved.rewards.unlocked, rewardIds);
assert.deepEqual(preserved.rewards.seen, rewardIds);
assert.equal(preserved.unlocked['first-turn'].unlockedAt, 123,
  'Real achievement history must be preserved');

const cleanProfile = createAdminRewardState(null).snapshot;
assert.deepEqual(cleanProfile.unlocked, {},
  'A new testing profile must receive rewards without any achievements');
assert.deepEqual(cleanProfile.seen, []);
assert.deepEqual(cleanProfile.rewards.unlocked, rewardIds);

const allTracks = ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city'];
const legacyAdminProfile = {
  version: 4,
  unlocked: {
    'first-turn': {
      unlockedAt: 123,
      trackId: 'countryside',
      vehicleId: 'classic',
      time: 18
    },
    'save-bella': {
      unlockedAt: 456,
      trackId: '',
      vehicleId: '',
      time: null
    },
    'beyond-sight': {
      unlockedAt: 456,
      trackId: '',
      vehicleId: '',
      time: null
    }
  },
  seen: ['first-turn', 'save-bella', 'beyond-sight'],
  progress: { tracks: allTracks, blankTracks: allTracks },
  rewards: { unlocked: rewardIds, seen: rewardIds }
};
const repaired = createAdminRewardState(legacyAdminProfile, 458);
assert.equal(repaired.repairedLegacyAdminState, true);
assert.deepEqual(Object.keys(repaired.snapshot.unlocked), ['first-turn'],
  'Re-running the corrected sequence must remove achievements fabricated by the old admin path');
assert.deepEqual(repaired.snapshot.seen, ['first-turn']);
assert.deepEqual(repaired.snapshot.progress.tracks, []);
assert.deepEqual(repaired.snapshot.progress.blankTracks, []);
assert.deepEqual(repaired.snapshot.rewards.unlocked, rewardIds);
assert.equal(repaired.snapshot.unlocked['save-bella'], undefined,
  'SAVE BELLA! must remain available for real rescue testing');

assert.match(source, /target\.closest\('\.m8-track-continue'\)/,
  'The Home RACE action must be the separator that opens The Lot');
assert.match(source, /aria-checked="true"/,
  'The final action must detect a Convertible that was already selected on Lot entry');
assert.match(source, /completeAdminUnlockFromLot\(sequenceIndex, selectedVehicleId\)/);
assert.match(source, /unlockRewardsForTesting\(storage\)/);
assert.match(source, /snapshot\.rewards\.unlocked = \[\.\.\.rewardIds\]/);
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
  /<script type="module" src="\.\/testing\/admin-unlock-sequence\.js\?revision=r176-admin-rewards"><\/script>/,
  'The production entry must publish the rewards-only recognizer with a fresh cache identity');
assert.match(indexSource,
  /src="\.\/live-steering-setting\.js\?build=20260806-r161-live-steering"/,
  'The hidden recognizer must not disturb the canonical steering entry');

console.log('TURN rewards-only admin unlock regression passed.');

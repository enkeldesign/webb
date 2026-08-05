import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ADMIN_UNLOCK_SEQUENCE,
  advanceAdminUnlockSequence,
  createAdminUnlockedState
} from '../../turn/testing/admin-unlock-sequence.js';
import { ACHIEVEMENTS, TRACK_IDS } from '../../turn/achievements/catalog.js';
import { TROPHY_ROAD_REWARDS } from '../../turn/progression/trophy-road.js';

const [source, loaderSource] = await Promise.all([
  fs.readFile(new URL('../../turn/testing/admin-unlock-sequence.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/live-steering-setting.js', import.meta.url), 'utf8')
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
  'vehicle:race',
  'vehicle:convertible',
  'action:race-this-car'
]);

let index = 0;
for (let step = 0; step < ADMIN_UNLOCK_SEQUENCE.length; step += 1) {
  const result = advanceAdminUnlockSequence(index, ADMIN_UNLOCK_SEQUENCE[step]);
  assert.equal(result.completed, step === ADMIN_UNLOCK_SEQUENCE.length - 1);
  index = result.nextIndex;
}
assert.equal(index, 0, 'The recognizer must reset after a completed sequence');
assert.equal(advanceAdminUnlockSequence(4, 'track:harbor').nextIndex, 0);
assert.equal(advanceAdminUnlockSequence(4, 'track:countryside').nextIndex, 1,
  'A mismatch matching the first token should immediately restart the sequence');

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
  seen: [],
  progress: { tracks: ['countryside'], blankTracks: [] },
  rewards: { unlocked: [], seen: [] }
};
const unlocked = createAdminUnlockedState(existing, 456);
const achievementIds = ACHIEVEMENTS.map(({ id }) => id);
const rewardIds = TROPHY_ROAD_REWARDS.map(({ id }) => id);

assert.deepEqual(Object.keys(unlocked.unlocked).sort(), [...achievementIds].sort());
assert.deepEqual(unlocked.seen, achievementIds);
assert.deepEqual(unlocked.progress.tracks, TRACK_IDS);
assert.deepEqual(unlocked.progress.blankTracks, TRACK_IDS);
assert.deepEqual(unlocked.rewards.unlocked, rewardIds);
assert.deepEqual(unlocked.rewards.seen, rewardIds);
assert.equal(unlocked.unlocked['first-turn'].unlockedAt, 123,
  'Existing achievement history must be preserved');
assert.equal(unlocked.unlocked['save-bella'].unlockedAt, 456);

assert.match(source, /documentRef\.addEventListener\('click', handleClick, true\)/);
assert.match(source, /event\.preventDefault\(\)/);
assert.match(source, /event\.stopImmediatePropagation\(\)/);
assert.match(source, /globalThis\.setTimeout\?\.\(reload, 0\)/,
  'The final action must reload so all pre-rendered gates rebuild unlocked');
assert.match(source, /CHALLENGE_PROGRESS_STORAGE_KEY/);
assert.match(source, /armyTracks: \[\.\.\.TRACK_IDS\]/);
assert.match(source, /cleanTracks: \[\.\.\.TRACK_IDS\]/);
assert.doesNotMatch(source, /turn:achievements-updated|turn:trophy-road-updated|turn:secret-achievement/,
  'The admin path must not emit achievement or reward events');
assert.match(loaderSource, /admin-unlock-sequence\.js\?revision=r174-admin-unlock/);
assert.match(loaderSource, /installAdminUnlockSequence\(\)/);

console.log('TURN hidden admin unlock sequence regression passed.');

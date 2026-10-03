import assert from 'node:assert/strict';
import { ACHIEVEMENT_STORAGE_KEY, createAchievementStore } from '../turn/achievements/store.js';
import { createAdminRewardState } from '../turn/testing/admin-unlock-sequence.js';

// Two TURN windows share one storage, each with its own store (#1045 A1). Neither may
// erase what the other saved; a deliberate rewrite (the admin profile) wins.
function sharedStorage() {
  const disk = new Map();
  return {
    disk,
    getItem: (key) => disk.get(key) ?? null,
    setItem: (key, value) => disk.set(key, String(value))
  };
}
const stored = (storage) => JSON.parse(storage.getItem(ACHIEVEMENT_STORAGE_KEY));

{
  const storage = sharedStorage();
  const a = createAchievementStore(storage);
  const b = createAchievementStore(storage);
  assert.ok(a.unlock('first-turn', { trackId: 'countryside' }), 'A unlocks FIRST TURN');
  assert.ok(b.unlock('new-wheels'), 'stale B unlocks another');
  assert.deepEqual(Object.keys(stored(storage).unlocked).sort(), ['first-turn', 'new-wheels'],
    'A stale window keeps what the other saved');
  assert.equal(b.isUnlocked('first-turn'), true, 'and takes it in');
  assert.ok(b.addDriveByEarPart('dbe-training-1'));
  assert.ok(a.addTrack('countryside'));
  assert.deepEqual([stored(storage).progress.tracks, stored(storage).progress.driveByEarParts],
    [['countryside'], ['dbe-training-1']], 'Progress from both windows accumulates');
  // The earliest unlock is kept.
  const first = stored(storage).unlocked['first-turn'].unlockedAt;
  a.state.unlocked['first-turn'].unlockedAt = first + 5000;
  a.markAllSeen();
  assert.equal(stored(storage).unlocked['first-turn'].unlockedAt, first, 'The earliest unlock wins');
  b.markAllSeen();
  assert.equal(b.trophyTotal(), a.trophyTotal(), 'Trophy totals agree');
}

{
  // Rewards and bonuses merge too.
  const storage = sharedStorage();
  const a = createAchievementStore(storage);
  const b = createAchievementStore(storage);
  assert.ok(a.grantBonus('support-thanks', 5, { reason: 'test' }));
  b.unlock('first-turn');
  assert.equal(stored(storage).bonuses['support-thanks']?.trophies, 5, 'A bonus survives a stale window');
}

{
  // A deliberate rewrite wins over stale windows.
  const storage = sharedStorage();
  const a = createAchievementStore(storage);
  a.unlock('first-turn');
  const { snapshot } = createAdminRewardState(stored(storage));
  storage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(snapshot));
  const rewrittenGeneration = stored(storage).generation;
  assert.ok(rewrittenGeneration > 0, 'The admin rewrite raises the generation');
  a.unlock('new-wheels');
  assert.equal(stored(storage).generation, rewrittenGeneration, 'A stale window adopts the rewrite');
  assert.equal(a.isUnlocked('first-turn'), Boolean(snapshot.unlocked['first-turn']));
}

{
  // Unreadable stored data: this window's copy stands.
  const storage = sharedStorage();
  const a = createAchievementStore(storage);
  storage.setItem(ACHIEVEMENT_STORAGE_KEY, '{broken');
  a.unlock('first-turn');
  assert.ok(stored(storage).unlocked['first-turn'], 'A corrupt stored copy is replaced, not fatal');
}

console.log('Achievement persistence: two windows merge achievements, bonuses, progress and rewards, keep the earliest unlock, adopt a deliberate rewrite and survive an unreadable stored copy.');

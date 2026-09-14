import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  SUPPORT_CHALLENGE_CONFIG_CACHE_KEY,
  SUPPORT_CHALLENGE_CONFIG_URL,
  loadSupportChallengeConfig,
  normalizeSupportChallengeConfig,
  normalizeSupportChallengeState
} from '../turn/achievements/support-challenges.js';
import { createAchievementStore, normalizeAchievementState } from '../turn/achievements/store.js';

const rawConfig = JSON.parse(await fs.readFile(new URL('../turn/support-challenges.json', import.meta.url), 'utf8'));
const source = await fs.readFile(new URL('../turn/achievements/support-challenges.js', import.meta.url), 'utf8');
const config = normalizeSupportChallengeConfig(rawConfig);

assert.equal(config.enabled, true);
assert.equal(config.offerAfterValidLapsWithoutTrophy, 6);
assert.equal(config.rerollAfterAdditionalValidLaps, 10);
assert.equal(config.stopAtTrophies, 2300);
assert.deepEqual(config.priority, ['winner', 'learning', 'safety', 'drift']);
assert.equal(config.learning.title, 'DID YOU READ ALL OF IT?');
assert.equal(config.learning.rewardPerPart, 5);
assert.doesNotMatch(JSON.stringify(rawConfig), /disclosure/i, 'Player-facing support rules must not call HOW TO PLAY parts disclosures');
assert.match(config.safety.cleanLapExplanation, /staying on the road from start to finish/i);
assert.match(config.safety.cleanLapExplanation, /off-road breaks the clean lap/i);
assert.equal(config.drift.requiredReward, 'drift-attack');
assert.ok(source.includes('achievements.store.isRewardUnlocked(config.drift.requiredReward)'), 'DRIFT support must remain gated behind the DRIFT ATTACK reward');
assert.ok(source.includes('storedRivalCount(trackId, { runtime, storage }) < RIVAL_LIMIT'), 'WINNER support must require all four stored rivals');
assert.ok(source.includes('detail?.onCourseThroughout === true'), 'SAFETY support must consume the physics-owned clean-lap result');
assert.ok(source.includes('baselineParts'), 'HOW TO PLAY support must remember what was already read before the challenge');
assert.ok(source.includes('REROLL CHALLENGE'), 'Continued stalled progress must expose the reroll action');

const normalized = normalizeSupportChallengeState({
  dryValidLaps: 6.9,
  lapsSinceChallengeProgress: 10.4,
  completed: ['winner:countryside', 'winner:countryside'],
  skipped: ['safety:airport']
});
assert.equal(normalized.dryValidLaps, 6);
assert.equal(normalized.lapsSinceChallengeProgress, 10);
assert.deepEqual(normalized.completed, ['winner:countryside']);

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value))
};
const store = createAchievementStore(storage);
assert.equal(store.trophyTotal(), 0);
assert.equal(store.grantBonus('support:test', 5, { reason: 'support-test' })?.trophies, 5);
assert.equal(store.trophyTotal(), 5);
assert.equal(store.grantBonus('support:test', 5), null, 'A support bonus must be idempotent');
assert.equal(store.hasBonus('support:test'), true);
assert.equal(normalizeAchievementState(JSON.parse(memory.get('turn-achievements-v1'))).bonuses['support:test'].trophies, 5);

let requestedUrl = '';
let requestedOptions = null;
const fetched = await loadSupportChallengeConfig({
  storage,
  now: () => 12345,
  fetchImpl: async (url, options) => {
    requestedUrl = String(url);
    requestedOptions = options;
    return { ok: true, json: async () => rawConfig };
  }
});
assert.equal(fetched.enabled, true);
assert.ok(requestedUrl.includes(SUPPORT_CHALLENGE_CONFIG_URL));
assert.ok(requestedUrl.includes('fresh=12345'));
assert.equal(requestedOptions?.cache, 'no-store');
assert.ok(memory.get(SUPPORT_CHALLENGE_CONFIG_CACHE_KEY), 'Fetched rules must retain a last-known-good offline copy');

console.log('TURN Trophy Road support challenge regression passed.');

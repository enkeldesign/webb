import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  SUPPORT_CHALLENGE_CONFIG_CACHE_KEY,
  SUPPORT_CHALLENGE_CONFIG_URL,
  loadSupportChallengeConfig,
  normalizeSupportChallengeConfig,
  normalizeSupportChallengeState
} from '../turn/achievements/support-challenges.js';
import {
  isRaceSupportBonusId
} from '../turn/achievements/support-challenge-feedback.js';
import { createAchievementStore, normalizeAchievementState } from '../turn/achievements/store.js';

const rawConfig = JSON.parse(await fs.readFile(new URL('../turn/support-challenges.json', import.meta.url), 'utf8'));
const source = await fs.readFile(new URL('../turn/achievements/support-challenges.js', import.meta.url), 'utf8');
const feedbackSource = await fs.readFile(new URL('../turn/achievements/support-challenge-feedback.js', import.meta.url), 'utf8');
const facadeSource = await fs.readFile(new URL('../turn/achievements.js', import.meta.url), 'utf8');
const runtimeSource = await fs.readFile(new URL('../turn/achievements/runtime.js', import.meta.url), 'utf8');
const viewSource = await fs.readFile(new URL('../turn/achievements/view.js', import.meta.url), 'utf8');
const homeSource = await fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8');
const homeReplaySource = await fs.readFile(new URL('../turn/achievements/home-reward-replay-r225.js', import.meta.url), 'utf8');
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

assert.equal(isRaceSupportBonusId('support:winner:airport'), true);
assert.equal(isRaceSupportBonusId('support:safety:harbor'), true);
assert.equal(isRaceSupportBonusId('support:drift:mountain'), true);
assert.equal(isRaceSupportBonusId('support:how-to-play:dbe'), false);
assert.match(facadeSource, /import '\.\/achievements\/support-challenge-feedback\.js';/,
  'The production achievement facade must install the challenge feedback coordinator without a manual revision identifier');
assert.doesNotMatch(
  facadeSource.match(/import '\.\/achievements\/support-challenge-feedback\.js[^']*';/)?.[0] || '',
  /revision=/,
  'The support feedback module must use the canonical revision-free import path'
);
assert.match(feedbackSource, /\[data-support-start\]/,
  'START CHALLENGE must arm the recommended vehicle before the existing track navigation runs');
assert.match(feedbackSource, /\.lot-car-option\[data-car-id=/,
  'The recommended owned car must be selected in The Lot');
assert.match(feedbackSource, /turn-support-home-toast/,
  'Challenge completion must replay as a compact success toast on Home');
assert.match(feedbackSource, /turn-support-completion-indicator/,
  'Home completion feedback must animate the challenge notification before it disappears');
assert.match(feedbackSource, /turn:trophy-bonus/,
  'Challenge completion must follow the authoritative support bonus event');
assert.match(feedbackSource, /turn:home-shown/,
  'Home challenge replay must use the canonical Home lifecycle rather than watching DOM state');
assert.match(feedbackSource, /holdRewardPresentation/,
  'Home challenge replay must acquire the achievement runtime reward hold before presenting');
assert.match(feedbackSource, /releaseRewardPresentation/,
  'Home challenge replay must release the runtime reward hold after its pill and notification finish');
assert.doesNotMatch(feedbackSource, /achievementObserver|rewardObserver|supportObserver|bodyObserver/,
  'Support feedback must not coordinate achievement and reward ordering by observing toast DOM');
assert.match(runtimeSource, /rewardPresentationHolds: new Set\(\)/,
  'The achievement runtime must own reward presentation holds');
assert.ok(runtimeSource.includes('if (session.rewardPresentationHolds.size) return;'),
  'Queued Trophy Road rewards must stay queued while a presentation hold is active');
assert.match(viewSource, /turn:trophy-road-toast-shown/,
  'The achievement view must publish reward presentation explicitly');
assert.match(homeSource, /turn:home-shown/,
  'Home navigation must publish a real Home shown lifecycle event');
assert.match(homeReplaySource, /turn:support-home-feedback-started/,
  'Home reward replay must pause while support feedback owns the cue lane');
assert.match(homeReplaySource, /turn:support-home-feedback-ended/,
  'Home reward replay must resume after support feedback ends');
assert.doesNotMatch(homeReplaySource, /new MutationObserver/,
  'Home reward replay must use explicit presentation and Home lifecycle events rather than DOM observation');
assert.match(feedbackSource, /border-radius:\s*999px/,
  'Challenge success feedback must use the compact pill presentation');
assert.doesNotMatch(feedbackSource, /revision=/,
  'The new support feedback module must not invent manual revision identities');

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
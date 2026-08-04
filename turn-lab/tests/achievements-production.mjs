import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_STORAGE_KEY,
  ONBOARDING_ACHIEVEMENT_IDS,
  TIME_TRIALS,
  TIME_TRIAL_ACHIEVEMENT_IDS,
  loadAchievementState,
  normalizeAchievementState,
  totalAvailableTrophies
} from '../../turn/achievements.js';
import { createAchievementStore } from '../../turn/achievements/store.js';
import {
  completedNightShiftSheriff,
  createNightShiftAttempt,
  sampleNightShiftOvertakes
} from '../../turn/achievements/night-shift.js';
import {
  completedAllTimeTrials,
  qualifyingTimeTrial
} from '../../turn/achievements/time-trials.js';

const [catalog, storeSource, runtime, view, nightShiftSource, timeTrialSource, style, fixedLayout, workflow, designTokens] = await Promise.all([
  fs.readFile(new URL('../../turn/achievements/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/store.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/night-shift.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/time-trials.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/design-tokens.css', import.meta.url), 'utf8')
]);

assert.equal(ACHIEVEMENT_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(ACHIEVEMENTS.length, 22, 'TURN should ship twenty-two achievements');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 10, 'Getting Started should remain focused');
assert.equal(TIME_TRIALS.length, 5);
assert.equal(TIME_TRIAL_ACHIEVEMENT_IDS.length, 5);
assert.equal(totalAvailableTrophies(), 1300);
assert.equal(
  ACHIEVEMENTS.reduce((total, achievement) => total + achievement.trophies, 0),
  1300,
  'Achievement values should now be permanent trophies'
);
assert.ok(ACHIEVEMENTS.every((achievement) => Number.isFinite(achievement.trophies)));
assert.ok(ACHIEVEMENTS.every((achievement) => !Object.hasOwn(achievement, 'points')));

assert.deepEqual(
  ACHIEVEMENTS.map((achievement) => achievement.id),
  [
    'first-turn',
    'take-it-from-the-top',
    'charge-through-it',
    'second-wind',
    'flow-state',
    'watch-and-learn',
    'your-own-rival',
    'level-head',
    'new-wheels',
    'new-ground',
    'trust-your-ears',
    'listen-closely',
    'beyond-sight',
    'around-the-turn',
    'ahead-of-yourself',
    'night-shift-sheriff',
    'countryside-sprint',
    'airport-sprint',
    'cliffside-sprint',
    'harbor-sprint',
    'midnight-sprint',
    'faster-than-the-dev'
  ]
);

assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.trophies, 50);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.recommendation || '', /Training Car · Countryside/);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'trust-your-ears')?.trophies, 200);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.trophies, 50);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.description || '', /75% Drive By Ear/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.recommendation || '', /90% Drive By Ear/);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'beyond-sight')?.trophies, 300);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'night-shift-sheriff')?.trophies, 100);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'faster-than-the-dev')?.trophies, 100);

for (const trial of TIME_TRIALS) {
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds - 0.001)?.id, trial.id);
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds), null,
    `${trial.title} must use strict under-target semantics`);
}
assert.equal(completedAllTimeTrials((id) => TIME_TRIAL_ACHIEVEMENT_IDS.includes(id)), true);

const empty = normalizeAchievementState(null);
assert.equal(empty.version, 3);
assert.deepEqual(empty.progress.tracks, []);
assert.deepEqual(empty.progress.blankTracks, []);
assert.deepEqual(empty.rewards.unlocked, []);
assert.deepEqual(empty.rewards.seen, []);
assert.deepEqual(empty.seen, []);
assert.deepEqual(empty.unlocked, {});

const normalized = normalizeAchievementState({
  version: 3,
  unlocked: {
    'first-turn': { unlockedAt: 123, trackId: 'countryside', vehicleId: 'classic', time: 42.5 },
    'trust-your-ears': { unlockedAt: 124, trackId: 'midnight-city', vehicleId: 'police', time: 91.2 },
    invented: { unlockedAt: 456 }
  },
  seen: ['first-turn', 'invented', 'first-turn'],
  progress: {
    tracks: ['airport', 'airport', 'invented'],
    blankTracks: ['countryside', 'countryside', 'invented']
  },
  rewards: { unlocked: [], seen: [] }
});
assert.deepEqual(Object.keys(normalized.unlocked), ['first-turn', 'trust-your-ears']);
assert.deepEqual(normalized.seen, ['first-turn']);
assert.deepEqual(normalized.progress.tracks, ['airport']);
assert.deepEqual(normalized.progress.blankTracks, ['countryside', 'midnight-city']);
assert.deepEqual(normalized.rewards.unlocked, ['midnight-city'],
  'Two hundred earned trophies should unlock the first Trophy Road reward');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value)
};
assert.equal(loadAchievementState(storage).storageAvailable, true);
memory.set(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(normalized));
assert.deepEqual(Object.keys(loadAchievementState(storage).state.unlocked), ['first-turn', 'trust-your-ears']);
assert.equal(loadAchievementState({ getItem: () => { throw new Error('blocked'); } }).storageAvailable, false);

const store = createAchievementStore(storage);
assert.equal(store.addBlankTrack('harbor'), true);
assert.equal(store.addBlankTrack('harbor'), false);
assert.ok(store.state.progress.blankTracks.includes('harbor'));
assert.equal(store.unlock('ahead-of-yourself', { trackId: 'harbor' })?.id, 'ahead-of-yourself');
assert.ok(store.isUnlocked('ahead-of-yourself'));
assert.equal(store.trophyTotal(), 275);
assert.equal(store.isRewardUnlocked('midnight-city'), true);
assert.doesNotMatch(storeSource, /rival-storage|clearRivalsState|clearAllRivalsState/,
  'Rival reset implementation must remain independent from achievements and rewards');

const rivals = [0.1, 0.2, 0.3, 0.4].map((progress, index) => ({
  carId: index === 2 ? 'ambulance' : 'sedan',
  time: 90,
  progress
}));
const nightShift = createNightShiftAttempt({
  trackId: 'midnight-city',
  vehicleId: 'police',
  rivals
});
const replayAt = (rival) => ({ p: rival.progress });
assert.equal(nightShift.eligible, true);
assert.equal(sampleNightShiftOvertakes(nightShift, {
  playerProgress: 0.05,
  lapElapsed: 5,
  boostActive: false
}, replayAt), 0);
for (let index = 0; index < rivals.length; index += 1) {
  assert.equal(sampleNightShiftOvertakes(nightShift, {
    playerProgress: rivals[index].progress + 0.01,
    lapElapsed: 6 + index,
    boostActive: true
  }, replayAt), index + 1);
}
assert.equal(completedNightShiftSheriff(nightShift, { position: 1, total: 5 }), true);
assert.equal(completedNightShiftSheriff(nightShift, { position: 2, total: 5 }), false);
assert.equal(createNightShiftAttempt({
  trackId: 'midnight-city',
  vehicleId: 'police',
  rivals: [...rivals.slice(0, 3), { carId: 'police', time: 90, progress: 0.5 }]
}).eligible, false);

assert.match(catalog, /trophies: 200/);
assert.doesNotMatch(catalog, /points:/);
assert.match(catalog, /id: 'faster-than-the-dev'/);
assert.match(storeSource, /STORAGE_VERSION = TROPHY_ROAD_STORAGE_VERSION/);
assert.match(storeSource, /syncRewards/);
assert.match(storeSource, /unseenRewardIds/);
assert.match(storeSource, /trophyTotal/);
assert.match(runtime, /REWARD_TOAST_OFFSET_MS = 3900/);
assert.match(runtime, /turn:trophy-road-updated/);
assert.match(runtime, /showRewardToastBatch/);
assert.match(runtime, /store\.syncRewards\(\)/);
assert.match(runtime, /LAP_TOAST_DELAY_MS = 4400/);
assert.match(runtime, /LISTEN_CLOSELY_MIN_BALANCE = 0\.75/);
assert.match(runtime, /completedNightShiftSheriff/);
assert.match(runtime, /qualifyingTimeTrial/);
assert.match(view, /TROPHY ROAD REWARD/);
assert.match(view, /turn-trophy-road-track/);
assert.match(view, /achievement\.trophies/);
assert.match(view, /\+\$\{total\} TROPHIES/);
assert.match(view, /store\.unseenCount\(\)/);
assert.match(view, /data-achievement-filter="time-trials"/);
assert.match(view, /feedbackButton\.after\(homeTrigger\)/);
assert.match(view, /createTrigger\('m8-feedback-button m8-achievements-button'/);
assert.match(nightShiftSource, /previousRelation <= 0 && boostActive/);
assert.match(timeTrialSource, /seconds >= trial\.targetSeconds/);
assert.match(style, /@keyframes turn-achievement-pulse/);
assert.match(style, /prefers-reduced-motion: reduce/);
assert.match(designTokens, /--turn-action-success: var\(--turn-green-500\)/);
assert.match(fixedLayout, /installM8TrophyGate/);
assert.match(fixedLayout, /r153-trophy-road/);
assert.match(workflow, /Run achievement system regression/);

console.log('TURN Trophy Road achievement regression passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_STORAGE_KEY,
  ONBOARDING_ACHIEVEMENT_IDS,
  TIME_TRIALS,
  TIME_TRIAL_ACHIEVEMENT_IDS,
  TIME_TRIAL_MASTER_ID,
  completedAllTimeTrials,
  loadAchievementState,
  normalizeAchievementState,
  qualifyingTimeTrial
} from '../../turn/achievements.js';
import { createAchievementStore } from '../../turn/achievements/store.js';
import {
  completedNightShiftSheriff,
  createNightShiftAttempt,
  sampleNightShiftOvertakes
} from '../../turn/achievements/night-shift.js';

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
assert.equal(ACHIEVEMENTS.length, 22, 'TURN should ship twenty-two achievements including the developer time trials');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 10, 'Getting Started should remain a focused ten-achievement collection');
assert.equal(TIME_TRIALS.length, 5, 'Every current track should have one hard time trial');
assert.equal(TIME_TRIAL_ACHIEVEMENT_IDS.length, 5);
assert.equal(TIME_TRIAL_MASTER_ID, 'faster-than-the-dev');
assert.equal(
  ACHIEVEMENTS.reduce((total, achievement) => total + achievement.points, 0),
  1300,
  'Five 25-point trials plus the 100-point developer challenge should bring the collection to 1300 points'
);
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
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.points, 50);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.description || '', /Drift and Boost/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.recommendation || '', /Training Car · Countryside/);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'trust-your-ears')?.points, 200);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'trust-your-ears')?.description || '', /Blank screen mode on from start to finish/);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.points, 50);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.description || '', /75% Drive By Ear/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.recommendation || '', /90% Drive By Ear/);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'beyond-sight')?.points, 300);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'night-shift-sheriff')?.points, 100);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'night-shift-sheriff')?.description || '', /Police Car/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'night-shift-sheriff')?.description || '', /Boost is active/);

assert.deepEqual(
  TIME_TRIALS.map(({ trackId, targetSeconds }) => [trackId, targetSeconds]),
  [
    ['countryside', 13],
    ['airport', 20],
    ['cliffside', 17],
    ['harbor', 25],
    ['midnight-city', 60]
  ]
);
for (const trial of TIME_TRIALS) {
  const achievement = ACHIEVEMENTS.find((item) => item.id === trial.id);
  assert.equal(achievement?.category, 'time-trials');
  assert.equal(achievement?.points, 25);
  assert.match(achievement?.recommendation || '', /Future Racer/);
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds - 0.001)?.id, trial.id);
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds), null,
    `${trial.title} must require a time strictly below the target`);
}
assert.equal(qualifyingTimeTrial('invented', 1), null);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === TIME_TRIAL_MASTER_ID)?.points, 100);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === TIME_TRIAL_MASTER_ID)?.title || '', /FASTER THAN THE DEV/);
assert.equal(completedAllTimeTrials(() => true), true);
assert.equal(completedAllTimeTrials((id) => id !== 'harbor-sprint'), false);
assert.equal(completedAllTimeTrials((id) => id !== 'harbor-sprint', 'harbor-sprint'), true,
  'The final qualifying lap should count while the individual achievement is still pending');

const empty = normalizeAchievementState(null);
assert.deepEqual(empty.progress.tracks, []);
assert.deepEqual(empty.progress.blankTracks, []);
assert.deepEqual(empty.seen, []);
assert.deepEqual(empty.unlocked, {});

const normalized = normalizeAchievementState({
  version: 999,
  unlocked: {
    'first-turn': { unlockedAt: 123, trackId: 'countryside', vehicleId: 'classic', time: 42.5 },
    'trust-your-ears': { unlockedAt: 124, trackId: 'midnight-city', vehicleId: 'police', time: 91.2 },
    'countryside-sprint': { unlockedAt: 125, trackId: 'countryside', vehicleId: 'race-future', time: 12.8 },
    invented: { unlockedAt: 456 }
  },
  seen: ['first-turn', 'invented', 'first-turn'],
  progress: {
    tracks: ['airport', 'airport', 'invented'],
    blankTracks: ['countryside', 'countryside', 'invented']
  }
});
assert.deepEqual(Object.keys(normalized.unlocked), ['first-turn', 'trust-your-ears', 'countryside-sprint']);
assert.deepEqual(normalized.seen, ['first-turn']);
assert.deepEqual(normalized.progress.tracks, ['airport']);
assert.deepEqual(normalized.progress.blankTracks, ['countryside', 'midnight-city'],
  'Existing Trust Your Ears unlocks should seed Beyond Sight progress during migration');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value)
};
assert.equal(loadAchievementState(storage).storageAvailable, true);
memory.set(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(normalized));
assert.deepEqual(
  Object.keys(loadAchievementState(storage).state.unlocked),
  ['first-turn', 'trust-your-ears', 'countryside-sprint']
);
assert.equal(loadAchievementState({ getItem: () => { throw new Error('blocked'); } }).storageAvailable, false);

const store = createAchievementStore(storage);
assert.equal(store.addBlankTrack('harbor'), true);
assert.equal(store.addBlankTrack('harbor'), false);
assert.ok(store.state.progress.blankTracks.includes('harbor'));
assert.equal(store.unlock('ahead-of-yourself', { trackId: 'harbor' })?.id, 'ahead-of-yourself');
assert.ok(store.isUnlocked('ahead-of-yourself'));
assert.doesNotMatch(storeSource, /rival-storage|clearRivalsState|clearAllRivalsState/,
  'Rival reset implementation must remain independent from persistent achievements');

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
}).eligible, false, 'Police rivals should make Night Shift Sheriff ineligible');

assert.match(catalog, /TIME_TRIALS/);
assert.match(catalog, /TIME_TRIAL_ACHIEVEMENT_IDS/);
assert.match(catalog, /TIME_TRIALS: 'time-trials'/);
assert.match(catalog, /id: 'faster-than-the-dev'/);
assert.match(catalog, /title: 'FASTER THAN THE DEV'/);
assert.match(catalog, /points: 100/);
assert.match(catalog, /Recommended: Future Racer/);
assert.match(catalog, /category: CATEGORY\.ONBOARDING/);
assert.match(catalog, /id: 'flow-state'/);
assert.match(catalog, /id: 'trust-your-ears'/);
assert.match(catalog, /id: 'listen-closely'/);
assert.match(catalog, /id: 'beyond-sight'/);
assert.match(catalog, /id: 'around-the-turn'/);
assert.match(catalog, /id: 'ahead-of-yourself'/);
assert.match(catalog, /id: 'night-shift-sheriff'/);
assert.match(storeSource, /ACHIEVEMENT_STORAGE_KEY = 'turn-achievements-v1'/);
assert.match(storeSource, /STORAGE_VERSION = 2/);
assert.match(storeSource, /state\.progress\[key\]/);
assert.match(storeSource, /addBlankTrack/);
assert.match(storeSource, /existingTrustTrack/);
assert.match(storeSource, /markAllSeen/);

assert.match(timeTrialSource, /targetSeconds: 13/);
assert.match(timeTrialSource, /targetSeconds: 20/);
assert.match(timeTrialSource, /targetSeconds: 17/);
assert.match(timeTrialSource, /targetSeconds: 25/);
assert.match(timeTrialSource, /targetSeconds: 60/);
assert.match(timeTrialSource, /seconds >= trial\.targetSeconds/,
  'Matching a developer target exactly must not unlock an under-target achievement');
assert.match(timeTrialSource, /TIME_TRIAL_MASTER_ID = 'faster-than-the-dev'/);

assert.match(nightShiftSource, /RIVAL_COUNT = 4/);
assert.match(nightShiftSource, /MIDNIGHT_CITY_ID/);
assert.match(nightShiftSource, /POLICE_CAR_ID/);
assert.match(nightShiftSource, /previousRelation <= 0 && boostActive/,
  'Only an actual pass while Police Boost is active should count');
assert.match(nightShiftSource, /Number\(detail\.position\) === 1/);

assert.match(runtime, /SPECTATE_REQUIRED_MS = 5000/);
assert.match(runtime, /LISTEN_CLOSELY_REQUIRED_MS = 10000/);
assert.match(runtime, /LISTEN_CLOSELY_MIN_BALANCE = 0\.75/);
assert.match(runtime, /LISTEN_CLOSELY_MIN_SPEED = 1/);
assert.match(runtime, /LAP_TOAST_DELAY_MS = 4400/,
  'Achievement feedback must wait until the existing lap result has finished');
assert.match(runtime, /SAMPLE_INTERVAL_MS = 100/,
  'Driving mechanics should be sampled lightly rather than adding another frame loop');
assert.match(runtime, /flowEligible/);
assert.match(runtime, /usedDrift/);
assert.match(runtime, /usedBoost/);
assert.match(runtime, /driftChargeGained >= 0\.25/);
assert.match(runtime, /secondWind\.sawEmpty/);
assert.match(runtime, /secondWind\.sawRecharge/);
assert.match(runtime, /settings\?\.balance/);
assert.match(runtime, /balance >= LISTEN_CLOSELY_MIN_BALANCE/);
assert.match(runtime, /Number\(state\.speed\) > LISTEN_CLOSELY_MIN_SPEED/);
assert.match(runtime, /unlock\(\['listen-closely'\]/);
assert.match(runtime, /store\.addBlankTrack\(context\.trackId\)/);
assert.match(runtime, /candidates\.push\('beyond-sight'\)/);
assert.match(runtime, /sampleNightShiftOvertakes/);
assert.match(runtime, /completedNightShiftSheriff/);
assert.match(runtime, /candidates\.push\('night-shift-sheriff'\)/);
assert.match(runtime, /getStoredBestLap/,
  'Existing saved best laps should be recognised when the new achievements first load');
assert.match(runtime, /function importStoredTimeTrials\(\)/);
assert.match(runtime, /unlockSilently\(entries\)/,
  'Imported records should create unread achievements without interrupting Home with an unlock toast');
assert.match(runtime, /const timeTrial = qualifyingTimeTrial\(context\.trackId, context\.time\)/);
assert.match(runtime, /candidates\.push\(timeTrial\.id\)/);
assert.match(runtime, /candidates\.push\(TIME_TRIAL_MASTER_ID\)/);
assert.match(runtime, /completedAllTimeTrials/);
assert.match(runtime, /turn-screen-blanked/);
assert.match(runtime, /reason === 'lap-started'/);
assert.match(runtime, /reason === 'race-reset'/);
assert.match(runtime, /reason === 'spectate-started'/);
assert.match(runtime, /reason === 'spectate-stopped'/);
assert.match(runtime, /turn:lap-result/);
assert.match(runtime, /turn:lap-invalid/);
assert.match(runtime, /turn:track-changed/);
assert.match(runtime, /turn:achievements-updated/);
assert.match(runtime, /pendingTrackEntryPulse/);
assert.match(runtime, /!allOnboardingComplete\(store\)/,
  'The track-entry prompt should stop after Getting Started is complete');

assert.match(view, /aria-live', 'polite'/);
assert.match(view, /role="progressbar"/);
assert.match(view, /data-achievement-filter="onboarding"/);
assert.match(view, /data-achievement-filter="time-trials"/);
assert.match(view, /CATEGORY\.TIME_TRIALS/);
assert.match(view, /achievement\.id === 'faster-than-the-dev'/);
assert.match(view, /TIME_TRIAL_ACHIEVEMENT_IDS\.filter/);
assert.match(view, /store\.markAllSeen\(\)/);
assert.match(view, /prefers-reduced-motion: reduce/);
assert.match(view, /ATTENTION_VISIBLE_MS = 900/);
assert.match(view, /is-achievement-pulsing/);
assert.match(view, /is-achievement-attention/);
assert.match(view, /achievement\.id === 'listen-closely'/);
assert.match(view, /achievement\.id === 'beyond-sight'/);
assert.match(view, /achievement\.id === 'night-shift-sheriff'/);
assert.match(view, /createTrigger\('m8-home-settings m8-achievements-button'/,
  'The Home trigger should reuse the canonical menu-button geometry');
assert.match(view, /createTrigger\('utility turn-race-achievements-button'/);
assert.match(view, /badge\.textContent = unseenCount > 9 \? '9\+' : String\(unseenCount\)/,
  'Unseen achievements should use a compact numeric notification circle');
assert.match(view, /Achievements, \$\{unseenCount\} new achievement/);
assert.match(view, /ONBOARDING_ACHIEVEMENT_IDS\.every/,
  'Getting Started should be unordered rather than prescribing a next achievement');
assert.doesNotMatch(view, /turn-achievements-trigger-icon/,
  'Achievement destination buttons should remain text-only');
assert.doesNotMatch(view, /badge\.textContent = 'NEXT'/,
  'Incomplete onboarding must not create a NEXT badge');
assert.doesNotMatch(view, /is-achievement-next/);
assert.doesNotMatch(view, /recommended \? 'NEXT'/,
  'Achievement cards should not impose a linear next challenge');

assert.match(style, /\.m8-achievements-button/);
assert.match(style, /\.turn-race-achievements-button/);
assert.match(style, /\.turn-achievements-trigger-badge[\s\S]*position: absolute/);
assert.match(style, /\.turn-achievements-trigger-badge[\s\S]*border-radius: 50%/);
assert.match(style, /\.turn-achievements-dialog/);
assert.match(style, /\.turn-achievement-toast/);
assert.match(style, /@keyframes turn-achievement-pulse/);
assert.match(style, /animation: turn-achievement-pulse 760ms[^;]* 1/,
  'The staged Achievements button should pulse once, not repeatedly');
assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(style, /var\(--turn-action-success/);
assert.doesNotMatch(style, /turn-achievements-trigger-icon/);
assert.doesNotMatch(style, /is-achievement-next/);

assert.match(designTokens, /--turn-action-success: var\(--turn-green-500\)/);
assert.match(fixedLayout, /installAchievements/);
assert.match(fixedLayout, /r152-developer-time-trials/);
assert.ok(fixedLayout.indexOf('installM8HomeCardScrollFixes') < fixedLayout.indexOf('installAchievements'),
  'Achievements should join the completed fixed Home layout after track scrolling is installed');
assert.match(workflow, /Run achievement system regression/);
assert.match(workflow, /node turn-lab\/tests\/achievements-production\.mjs/);

console.log('TURN developer time trial achievement regression passed.');

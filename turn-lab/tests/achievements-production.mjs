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
  qualifyingTimeTrial,
  totalAvailableTrophies
} from '../../turn/achievements.js';
import { createAchievementStore } from '../../turn/achievements/store.js';
import {
  completedNightShiftSheriff,
  createNightShiftAttempt,
  sampleNightShiftOvertakes
} from '../../turn/achievements/night-shift.js';

const [
  catalog,
  secretCatalog,
  secretEvents,
  secretRuntime,
  storeSource,
  runtime,
  view,
  nightShiftSource,
  timeTrialSource,
  lilyaSource,
  darvidSource,
  sedanSource,
  style,
  fixedLayout,
  workflow,
  designTokens
] = await Promise.all([
  fs.readFile(new URL('../../turn/achievements/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/secret-catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/secret-events.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/secret-achievements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/store.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/night-shift.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/time-trials.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/midnight-city-world-r11.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/harbor-hidden-face-r89.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/sports-sedan-easter-egg.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/design-tokens.css', import.meta.url), 'utf8')
]);

assert.equal(ACHIEVEMENT_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(ACHIEVEMENTS.length, 25,
  'TURN should ship twenty-five achievements including three hidden discoveries');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 10,
  'Getting Started should remain a focused ten-achievement collection');
assert.equal(TIME_TRIALS.length, 5, 'Every current track should have one hard time trial');
assert.equal(TIME_TRIAL_ACHIEVEMENT_IDS.length, 5);
assert.equal(TIME_TRIAL_MASTER_ID, 'faster-than-the-dev');
assert.equal(totalAvailableTrophies(), 1375);
assert.equal(
  ACHIEVEMENTS.reduce((total, achievement) => total + achievement.trophies, 0),
  1375,
  'The current collection should contain 1375 permanent trophies'
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
    'find-lilya',
    'find-darvid',
    'satans-sedan',
    'countryside-sprint',
    'airport-sprint',
    'cliffside-sprint',
    'harbor-sprint',
    'midnight-sprint',
    'faster-than-the-dev'
  ]
);

assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.trophies, 50);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.description || '', /Drift and Boost/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'flow-state')?.recommendation || '', /Training Car · Countryside/);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'trust-your-ears')?.trophies, 200);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'trust-your-ears')?.description || '', /Blank screen mode on from start to finish/);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.trophies, 50);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.description || '', /75% Drive By Ear/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'listen-closely')?.recommendation || '', /90% Drive By Ear/);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'beyond-sight')?.trophies, 300);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'night-shift-sheriff')?.trophies, 100);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'night-shift-sheriff')?.description || '', /Police Car/);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === 'night-shift-sheriff')?.description || '', /Boost is active/);

for (const id of ['find-lilya', 'find-darvid', 'satans-sedan']) {
  const achievement = ACHIEVEMENTS.find((item) => item.id === id);
  assert.equal(achievement?.hidden, true, `${id} must remain a hidden achievement`);
  assert.equal(achievement?.trophies, 25, `${id} should award 25 trophies`);
  assert.equal(achievement?.category, 'exploration');
}
assert.equal(
  ACHIEVEMENTS.find((item) => item.id === 'find-lilya')?.title,
  'FIND LILYA AFTER MIDNIGHT!'
);
assert.equal(
  ACHIEVEMENTS.find((item) => item.id === 'find-darvid')?.title,
  'FIND DARVID AT THE HARBOR!'
);
assert.equal(ACHIEVEMENTS.find((item) => item.id === 'satans-sedan')?.title, 'SATAN’S SEDAN');

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
  assert.equal(achievement?.trophies, 25);
  assert.match(achievement?.recommendation || '', /Future Racer/);
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds - 0.001)?.id, trial.id);
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds), null,
    `${trial.title} must require a time strictly below the target`);
}
assert.equal(qualifyingTimeTrial('invented', 1), null);
assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === TIME_TRIAL_MASTER_ID)?.trophies, 100);
assert.match(ACHIEVEMENTS.find((achievement) => achievement.id === TIME_TRIAL_MASTER_ID)?.title || '', /FASTER THAN THE DEV/);
assert.equal(completedAllTimeTrials(() => true), true);
assert.equal(completedAllTimeTrials((id) => id !== 'harbor-sprint'), false);
assert.equal(completedAllTimeTrials((id) => id !== 'harbor-sprint', 'harbor-sprint'), true,
  'The final qualifying lap should count while the individual achievement is still pending');

const empty = normalizeAchievementState(null);
assert.equal(empty.version, 4);
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
    'countryside-sprint': { unlockedAt: 125, trackId: 'countryside', vehicleId: 'race-future', time: 12.8 },
    invented: { unlockedAt: 456 }
  },
  seen: ['first-turn', 'invented', 'first-turn'],
  progress: {
    tracks: ['airport', 'airport', 'invented'],
    blankTracks: ['countryside', 'countryside', 'invented']
  },
  rewards: { unlocked: [], seen: [] }
});
assert.equal(normalized.version, 4);
assert.deepEqual(Object.keys(normalized.unlocked), ['first-turn', 'trust-your-ears', 'countryside-sprint']);
assert.deepEqual(normalized.seen, ['first-turn']);
assert.deepEqual(normalized.progress.tracks, ['airport']);
assert.deepEqual(normalized.progress.blankTracks, ['countryside', 'midnight-city'],
  'Existing Trust Your Ears unlocks should seed Beyond Sight progress during migration');
assert.deepEqual(normalized.rewards.unlocked, ['paintjob', 'monster'],
  'Profiles created before the new gates must retain paint and Monster Truck access');
assert.deepEqual(normalized.rewards.seen, ['paintjob', 'monster'],
  'Grandfathered rewards must not create misleading new-reward notifications');

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
assert.equal(store.trophyTotal(), 300);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['midnight-city']);
assert.equal(store.isRewardUnlocked('midnight-city'), true);
assert.equal(store.isRewardUnlocked('paintjob'), true);
assert.equal(store.isRewardUnlocked('monster'), true);
assert.doesNotMatch(storeSource, /rival-storage|clearRivalsState|clearAllRivalsState/,
  'Rival reset implementation must remain independent from persistent achievements and rewards');

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

assert.match(catalog, /SECRET_ACHIEVEMENTS/);
assert.match(catalog, /secret: '<svg/);
assert.match(catalog, /TIME_TRIALS/);
assert.match(catalog, /TIME_TRIAL_ACHIEVEMENT_IDS/);
assert.match(catalog, /TIME_TRIALS: 'time-trials'/);
assert.match(catalog, /id: 'faster-than-the-dev'/);
assert.match(catalog, /title: 'FASTER THAN THE DEV'/);
assert.match(catalog, /trophies: 100/);
assert.match(catalog, /Recommended: Future Racer/);
assert.match(catalog, /category: CATEGORY\.ONBOARDING/);
assert.match(catalog, /id: 'flow-state'/);
assert.match(catalog, /id: 'trust-your-ears'/);
assert.match(catalog, /id: 'listen-closely'/);
assert.match(catalog, /id: 'beyond-sight'/);
assert.match(catalog, /id: 'around-the-turn'/);
assert.match(catalog, /id: 'ahead-of-yourself'/);
assert.match(catalog, /id: 'night-shift-sheriff'/);
assert.doesNotMatch(catalog, /points:/);

assert.match(secretCatalog, /id: 'find-lilya'/);
assert.match(secretCatalog, /id: 'find-darvid'/);
assert.match(secretCatalog, /id: 'satans-sedan'/);
assert.match(secretCatalog, /title: 'FIND LILYA AFTER MIDNIGHT!'/);
assert.match(secretCatalog, /title: 'FIND DARVID AT THE HARBOR!'/);
assert.match(secretCatalog, /title: 'SATAN’S SEDAN'/);
assert.equal((secretCatalog.match(/trophies: 25/g) || []).length, 3);
assert.equal((secretCatalog.match(/hidden: true/g) || []).length, 3);
assert.match(secretEvents, /turn:secret-achievement/);
assert.match(secretEvents, /__turnPendingSecretAchievementIds/);
assert.match(secretRuntime, /Hidden achievement\. The title is your clue\./);
assert.match(secretRuntime, /achievement\.hidden/);
assert.match(secretRuntime, /achievements\.unlock\(achievementId, context\)/);
assert.match(secretRuntime, /takePendingSecretAchievementIds/);
assert.match(lilyaSource, /signalSecretAchievement\('find-lilya'/);
assert.match(lilyaSource, /turnSecretAchievementFound/);
assert.match(darvidSource, /signalSecretAchievement\('find-darvid'/);
assert.match(darvidSource, /DISCOVERY_HOLD_MS = 550/);
assert.match(sedanSource, /signalSecretAchievement\('satans-sedan'/);
assert.match(sedanSource, /color code #666/);

assert.match(storeSource, /ACHIEVEMENT_STORAGE_KEY = TROPHY_ROAD_STORAGE_KEY/);
assert.match(storeSource, /STORAGE_VERSION = TROPHY_ROAD_STORAGE_VERSION/);
assert.match(storeSource, /grandfatheredRewardIdsForVersion/);
assert.match(storeSource, /state\.progress\[key\]/);
assert.match(storeSource, /addBlankTrack/);
assert.match(storeSource, /existingTrustTrack/);
assert.match(storeSource, /markAllSeen/);
assert.match(storeSource, /trophyTotal/);
assert.match(storeSource, /syncRewards/);
assert.match(storeSource, /unseenRewardIds/);
assert.match(storeSource, /unseenCount/);

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
assert.match(runtime, /REWARD_TOAST_OFFSET_MS = 3900/,
  'A Trophy Road reward should follow rather than overlap the achievement toast');
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
assert.match(runtime, /store\.syncRewards\(\)/);
assert.match(runtime, /turn:trophy-road-updated/);
assert.match(runtime, /showRewardToastBatch/);
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
assert.match(view, /achievement\.trophies/);
assert.match(view, /TROPHY ROAD REWARD/);
assert.match(view, /turn-trophy-road-progress" role="progressbar"/);
assert.match(view, /turn-trophy-road-markers" aria-label="Trophy Road rewards"/);
assert.match(view, /store\.markAllSeen\(\)/);
assert.match(view, /store\.unseenCount\(\)/);
assert.match(view, /ATTENTION_VISIBLE_MS = 900/);
assert.match(view, /is-achievement-pulsing/);
assert.match(view, /is-achievement-attention/);
assert.match(view, /achievement\.id === 'listen-closely'/);
assert.match(view, /achievement\.id === 'beyond-sight'/);
assert.match(view, /achievement\.id === 'night-shift-sheriff'/);
assert.match(view, /createTrigger\('m8-feedback-button m8-achievements-button'/,
  'The Home trigger should reuse the complete Give Feedback typography and geometry');
assert.match(view, /feedbackButton\.after\(homeTrigger\)/,
  'Achievements should remain directly after Give Feedback');
assert.match(view, /createTrigger\('utility turn-race-achievements-button'/);
assert.match(view, /badge\.textContent = unseenCount > 9 \? '9\+' : String\(unseenCount\)/,
  'Unseen achievements and rewards should use a compact numeric notification circle');
assert.match(view, /Achievements, \$\{unseenCount\} new item/);
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
assert.match(fixedLayout, /installSecretAchievements/);
assert.match(fixedLayout, /installM8TrophyGate/);
assert.match(fixedLayout, /r157-hidden-achievements/);
assert.match(fixedLayout, /r157-paint-monster/);
assert.ok(fixedLayout.indexOf('installM8HomeCardScrollFixes') < fixedLayout.indexOf('installAchievements'),
  'Achievements should join the completed fixed Home layout after track scrolling is installed');
assert.match(workflow, /Run achievement system regression/);
assert.match(workflow, /node turn-lab\/tests\/achievements-production\.mjs/);
assert.match(workflow, /Run Trophy Road progression regression/);

console.log('TURN hidden and Trophy Road achievement regression passed.');

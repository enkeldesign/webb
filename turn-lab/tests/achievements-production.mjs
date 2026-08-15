import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_STORAGE_KEY,
  CHALLENGE_PROGRESS_STORAGE_KEY,
  CLEAN_LAP_TARGETS,
  ONBOARDING_ACHIEVEMENT_IDS,
  TIME_TRIALS,
  TIME_TRIAL_ACHIEVEMENT_IDS,
  TIME_TRIAL_MASTER_ID,
  completedAllTimeTrials,
  loadAchievementState,
  normalizeAchievementState,
  normalizeChallengeProgress,
  qualifiesForArmyLap,
  qualifiesForCleanLap,
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
  challengeSource,
  bellaSource,
  worldSource,
  lilyaSource,
  darvidSource,
  sedanSource,
  fixedLayout,
  app,
  workflow
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
  fs.readFile(new URL('../../turn/achievements/challenge-expansion-r166.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/countryside-bella-r166.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/midnight-city-world-r11.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/harbor-hidden-face-r89.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/sports-sedan-easter-egg.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

assert.equal(ACHIEVEMENT_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(CHALLENGE_PROGRESS_STORAGE_KEY, 'turn-achievement-challenges-v1');
assert.equal(ACHIEVEMENTS.length, 28,
  'TURN should ship twenty-eight achievements including four hidden discoveries');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 10,
  'Getting Started should remain a focused ten-achievement collection');
assert.equal(totalAvailableTrophies(), 1700);
assert.equal(
  ACHIEVEMENTS.reduce((total, achievement) => total + achievement.trophies, 0),
  1700
);
assert.ok(ACHIEVEMENTS.every((achievement) => Number.isFinite(achievement.trophies)));
assert.ok(ACHIEVEMENTS.every((achievement) => !Object.hasOwn(achievement, 'points')));

const byId = (id) => ACHIEVEMENTS.find((achievement) => achievement.id === id);
assert.equal(byId('an-army-of-me')?.title, 'AN ARMY OF ME');
assert.equal(byId('an-army-of-me')?.trophies, 200);
assert.match(byId('an-army-of-me')?.description || '', /four saved rivals on every track/i);
assert.equal(byId('on-course-of-course')?.title, 'ON COURSE, OF COURSE');
assert.equal(byId('on-course-of-course')?.trophies, 100);
assert.match(byId('on-course-of-course')?.description || '', /without going off-road/i);
assert.match(byId('on-course-of-course')?.recommendation || '', /Countryside, Airport and Cliffside < 0:30/);
assert.match(byId('on-course-of-course')?.recommendation || '', /Harbor < 1:00/);
assert.match(byId('on-course-of-course')?.recommendation || '', /Midnight City < 2:00/);

for (const id of ['find-lilya', 'find-darvid', 'save-bella', 'satans-sedan']) {
  const achievement = byId(id);
  assert.equal(achievement?.hidden, true, `${id} must remain hidden before discovery`);
  assert.equal(achievement?.trophies, 25);
  assert.equal(achievement?.category, 'exploration');
}
assert.equal(byId('find-lilya')?.title, 'FIND LILYA!');
assert.equal(byId('find-darvid')?.title, 'FIND DARVID!');
assert.equal(byId('save-bella')?.title, 'SAVE BELLA!');
assert.equal(byId('save-bella')?.icon, 'cat');
assert.match(byId('save-bella')?.description || '', /Fire Truck/);
assert.equal(byId('find-lilya')?.lockedDescription, '');
assert.equal(byId('find-darvid')?.lockedDescription, '');
assert.equal(byId('save-bella')?.lockedDescription, '');
assert.equal(byId('satans-sedan')?.lockedDescription, undefined,
  'Satan’s Sedan may retain the generic hidden clue treatment');

assert.equal(TIME_TRIALS.length, 5);
assert.equal(TIME_TRIAL_ACHIEVEMENT_IDS.length, 5);
assert.equal(TIME_TRIAL_MASTER_ID, 'faster-than-the-dev');
assert.deepEqual(
  TIME_TRIALS.map(({ trackId, targetSeconds }) => [trackId, targetSeconds]),
  [
    ['countryside', 12],
    ['airport', 17],
    ['cliffside', 16],
    ['harbor', 24],
    ['midnight-city', 53]
  ]
);
for (const trial of TIME_TRIALS) {
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds - 0.001)?.id, trial.id);
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds), null,
    `${trial.title} must require a time strictly below the target`);
  assert.match(byId(trial.id)?.recommendation || '', /Future Racer/);
}
assert.equal(completedAllTimeTrials(() => true), true);
assert.equal(completedAllTimeTrials((id) => id !== 'harbor-sprint'), false);
assert.equal(completedAllTimeTrials((id) => id !== 'harbor-sprint', 'harbor-sprint'), true);

assert.deepEqual(CLEAN_LAP_TARGETS, {
  countryside: 30,
  airport: 30,
  cliffside: 30,
  harbor: 60,
  'midnight-city': 120
});
assert.equal(qualifiesForArmyLap({ rivalCountAtStart: 4 }, { position: 1, total: 5 }), true);
assert.equal(qualifiesForArmyLap({ rivalCountAtStart: 3 }, { position: 1, total: 4 }), false);
assert.equal(qualifiesForArmyLap({ rivalCountAtStart: 4 }, { position: 2, total: 5 }), false);
assert.equal(qualifiesForCleanLap(
  { trackId: 'countryside', onCourseThroughout: true },
  { time: 29.999 }
), true);
assert.equal(qualifiesForCleanLap(
  { trackId: 'countryside', onCourseThroughout: true },
  { time: 30 }
), false, 'Matching a clean-lap target exactly must not count');
assert.equal(qualifiesForCleanLap(
  { trackId: 'harbor', onCourseThroughout: false },
  { time: 20 }
), false, 'Any sampled off-road state must void the clean-lap attempt');
assert.deepEqual(normalizeChallengeProgress({
  armyTracks: ['airport', 'airport', 'invented'],
  cleanTracks: ['harbor', 'invented']
}), {
  armyTracks: ['airport'],
  cleanTracks: ['harbor']
});

const empty = normalizeAchievementState(null);
assert.equal(empty.version, 5,
  'Trophy Road v5 distinguishes existing owners of Vintage/Rally from new profiles after those cars become locked rewards');
assert.deepEqual(empty.progress.tracks, []);
assert.deepEqual(empty.progress.blankTracks, []);
assert.deepEqual(empty.rewards.unlocked, []);

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value)
};
assert.equal(loadAchievementState(storage).storageAvailable, true);
const store = createAchievementStore(storage);
assert.equal(store.unlock('an-army-of-me', { trackId: 'midnight-city' })?.trophies, 200);
assert.equal(store.unlock('on-course-of-course', { trackId: 'harbor' })?.trophies, 100);
assert.equal(store.unlock('save-bella', { trackId: 'countryside', vehicleId: 'firetruck' })?.trophies, 25);
assert.equal(store.trophyTotal(), 325);
assert.deepEqual(store.syncRewards().map((reward) => reward.id), ['midnight-city']);
assert.doesNotMatch(storeSource, /rival-storage|clearRivalsState|clearAllRivalsState/,
  'Rival resets must remain independent from achievements');

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
for (let index = 0; index < rivals.length; index += 1) {
  assert.equal(sampleNightShiftOvertakes(nightShift, {
    playerProgress: rivals[index].progress + 0.01,
    lapElapsed: 6 + index,
    boostActive: true
  }, replayAt), index + 1);
}
assert.equal(completedNightShiftSheriff(nightShift, { position: 1, total: 5 }), true);
assert.equal(completedNightShiftSheriff(nightShift, { position: 2, total: 5 }), false);

assert.match(catalog, /id: 'an-army-of-me'/);
assert.match(catalog, /id: 'on-course-of-course'/);
assert.match(catalog, /cat: '<svg/);
assert.doesNotMatch(catalog, /points:/);
assert.match(secretCatalog, /title: 'FIND LILYA!'/);
assert.match(secretCatalog, /title: 'FIND DARVID!'/);
assert.match(secretCatalog, /title: 'SAVE BELLA!'/);
assert.equal((secretCatalog.match(/hidden: true/g) || []).length, 4);
assert.equal((secretCatalog.match(/trophies: 25/g) || []).length, 4);
assert.match(secretRuntime, /Object\.hasOwn\(achievement, 'lockedDescription'\)/);
assert.match(secretRuntime, /else description\.remove\(\)/,
  'Clue-only hidden cards must remove rather than replace their description');
assert.match(secretRuntime, /Hidden achievement\. The title is your clue\./,
  'The generic clue remains available for hidden achievements that use it');
assert.match(secretEvents, /turn:secret-achievement/);
assert.match(lilyaSource, /signalSecretAchievement\('find-lilya'/);
assert.match(darvidSource, /signalSecretAchievement\('find-darvid'/);
assert.match(sedanSource, /signalSecretAchievement\('satans-sedan'/);

assert.match(timeTrialSource, /targetSeconds: 12/);
assert.match(timeTrialSource, /targetSeconds: 17/);
assert.match(timeTrialSource, /targetSeconds: 16/);
assert.match(timeTrialSource, /targetSeconds: 24/);
assert.match(timeTrialSource, /targetSeconds: 53/);
assert.match(timeTrialSource, /seconds >= trial\.targetSeconds/);

assert.match(challengeSource, /SAMPLE_INTERVAL_MS = 50/);
assert.match(challengeSource, /rivalCountAtStart/);
assert.match(challengeSource, /runtime\.state\.offRoad === true/);
assert.match(challengeSource, /achievements\.unlock\('an-army-of-me'/);
assert.match(challengeSource, /achievements\.unlock\('on-course-of-course'/);
assert.match(challengeSource, /turn:lap-result/);
assert.match(challengeSource, /turn:lap-invalid/);
assert.match(challengeSource, /reason === 'lap-started'/);

assert.match(bellaSource, /Kenney Cube Pets/);
assert.match(bellaSource, /animal-cat\.glb/);
assert.match(bellaSource, /REQUIRED_VEHICLE_ID = 'firetruck'/);
assert.match(bellaSource, /BELLA_SAMPLE_INDEX = 500/);
assert.match(bellaSource, /BELLA_SIDE = -1/);
assert.match(bellaSource, /signalSecretAchievement\('save-bella'/);
assert.match(bellaSource, /vehicleId: REQUIRED_VEHICLE_ID/);
assert.match(bellaSource, /Bella cream, seal brown and white paws/);
assert.match(bellaSource, /using Bella fallback/,
  'Bella must remain discoverable if the external model cannot load');
assert.match(bellaSource, /eyes: 0x74a7ff/,
  'Bella eyes must use the requested exact #74A7FF blue');
assert.match(bellaSource, /frontMask = 1 - smoothstep/,
  'The coat mask must use the Kenney cat’s negative-Z face rather than painting its back');
assert.match(bellaSource, /bounds\.min\.z - size\.z \* 0\.018/,
  'Bella eyes must sit just outside the actual negative-Z face bounds');
assert.match(bellaSource, /pupilToIris = smoothstep/,
  'Bella eyes must retain the radial black-to-blue pupil gradient');
assert.match(bellaSource, /leafDark: 0x1f7a45/);
assert.match(bellaSource, /turnBellaFoliagePalette/,
  'The dedicated rescue tree must retain an explicit green foliage contract');
assert.match(worldSource, /installCountrysideBella/);
assert.match(worldSource, /countryside-bella-r166\.js/);
assert.match(worldSource, /r168-bella-markings-eyes-foliage/,
  'The world loader must cache-bust the corrected Bella visual module');

assert.match(runtime, /catalog\.js\?revision=r166-bella-records/);
assert.match(runtime, /view\.js\?revision=r166-bella-records/);
assert.match(view, /TROPHY_ROAD_MAX_THRESHOLD/);
assert.match(nightShiftSource, /RIVAL_COUNT = 4/);
assert.match(fixedLayout, /installAchievementChallengeExpansion/);
assert.match(fixedLayout, /r166-bella-records/);
assert.match(app, /render\/world\.js\?revision=r166-bella-records/);
assert.match(app, /achievements=r166-bella-records/);
assert.match(workflow, /Run achievement system regression/);
assert.match(workflow, /node turn-lab\/tests\/achievements-production\.mjs/);

console.log('TURN Bella, developer records and all-track achievement regression passed.');
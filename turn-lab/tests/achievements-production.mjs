import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_STORAGE_KEY,
  CHALLENGE_PROGRESS_STORAGE_KEY,
  CLEAN_LAP_TARGETS,
  DRIVE_BY_EAR_PART_IDS,
  HOW_TO_PLAY_DISCLOSURE_IDS,
  ONBOARDING_ACHIEVEMENT_IDS,
  TIME_TRIALS,
  TIME_TRIAL_ACHIEVEMENT_IDS,
  TIME_TRIAL_MASTER_ID,
  TROPHY_ROAD_MAX_THRESHOLD,
  completedLearningSet,
  completedAllTimeTrials,
  loadAchievementState,
  normalizeAchievementState,
  normalizeChallengeProgress,
  qualifiesForArmyLap,
  qualifiesForCatchGas,
  qualifiesForCleanLap,
  qualifyingTimeTrial,
  totalAvailableTrophies
} from '../../turn/achievements.js';
import { TRACK_IDS } from '../../turn/achievements/catalog.js';
import { ACHIEVEMENTS as BASE_ACHIEVEMENTS } from '../../turn/achievements/catalog-base.js';
import { createAchievementStore } from '../../turn/achievements/store.js';
import { TROPHY_ROAD_STORAGE_VERSION } from '../../turn/progression/trophy-road.js';
import {
  completedNightShiftSheriff,
  createNightShiftAttempt,
  sampleNightShiftOvertakes
} from '../../turn/achievements/night-shift.js';

const [
  catalogSource,
  baseCatalogSource,
  productionCatalogSource,
  legacyCatalogSource,
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
  workflow,
  productionEntry,
  labEntry
] = await Promise.all([
  fs.readFile(new URL('../../turn/achievements/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/catalog-base.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/catalog-production.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/catalog-chromatic-r183.js', import.meta.url), 'utf8'),
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
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.equal(ACHIEVEMENT_STORAGE_KEY, 'turn-achievements-v1');
assert.equal(CHALLENGE_PROGRESS_STORAGE_KEY, 'turn-achievement-challenges-v1');
assert.equal(BASE_ACHIEVEMENTS.length, 29,
  'The internal base catalog should remain the 29-achievement foundation');
assert.equal(
  BASE_ACHIEVEMENTS.reduce((total, achievement) => total + achievement.trophies, 0),
  1775,
  'The base catalog must stay separate from production progression balancing'
);
assert.equal(ACHIEVEMENTS.length, 60,
  'Production TURN must expose 47 core achievements plus 13 scoring achievements');
assert.equal(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size, 60,
  'Production achievement ids must remain unique');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 11,
  'GOT STARTED must remain the master of the eleven prerequisite Getting Started achievements, not recursively require itself');
assert.equal(totalAvailableTrophies(), 4575,
  'The learning and balance pass must expose the complete 4,575-trophy supply');
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 2200,
  'Trophy Road 2 uses the first 2200 trophies while the full catalog retains headroom');
assert.equal(
  ACHIEVEMENTS.reduce((total, achievement) => total + achievement.trophies, 0),
  4575
);
assert.ok(ACHIEVEMENTS.every((achievement) => Number.isFinite(achievement.trophies)));
assert.ok(ACHIEVEMENTS.every((achievement) => !Object.hasOwn(achievement, 'points')));

const byId = (id) => ACHIEVEMENTS.find((achievement) => achievement.id === id);
assert.equal(byId('got-started')?.title, 'GOT STARTED');
assert.equal(byId('got-started')?.trophies, 75);
assert.equal(byId('got-started')?.category, 'onboarding');
assert.equal(byId('learn-to-play')?.title, 'LEARN TO PLAY');
assert.equal(byId('learn-to-play')?.trophies, 50);
assert.equal(byId('learn-to-play')?.category, 'ways-to-play');
assert.equal(byId('learn-to-play')?.progressMax, HOW_TO_PLAY_DISCLOSURE_IDS.length);
assert.equal(byId('learn-to-play')?.description, 'Read all parts of How to Play.');
assert.equal(byId('drive-by-ear')?.title, 'DRIVE BY EAR');
assert.equal(byId('drive-by-ear')?.trophies, 50);
assert.equal(byId('drive-by-ear')?.category, 'ways-to-play');
assert.equal(byId('drive-by-ear')?.progressMax, DRIVE_BY_EAR_PART_IDS.length);
assert.equal(byId('drive-by-ear')?.description, 'Finish all five parts of Drive By Ear 101.');
assert.equal(byId('listen-closely')?.trophies, 100);
assert.equal(byId('catch-the-charge')?.title, 'CATCH THE CHARGE');
assert.equal(byId('catch-the-charge')?.trophies, 25);
assert.equal(byId('catch-the-charge')?.category, 'onboarding');
assert.equal(Object.hasOwn(byId('catch-the-charge') || {}, 'progressMax'), false,
  'CATCH THE CHARGE must not imply a timed GAS hold');
assert.equal(
  byId('catch-the-charge')?.description,
  'With BOOST full, keep using DRIFT to build purple OVERCHARGE. Slide to GAS to catch it before it leaks away.'
);
assert.equal(byId('golden-hour')?.title, 'MAYDAY!');
assert.equal(byId('golden-hour')?.trophies, 100);
assert.equal(byId('golden-hour')?.hidden, true);
assert.equal(
  byId('golden-hour')?.lockedDescription,
  'Hidden achievement. You’ll know what to do when the moment comes.'
);
assert.match(byId('golden-hour')?.description || '', /Ambulance/);
assert.match(byId('golden-hour')?.description || '', /30 seconds/);
assert.equal(byId('chromatic-camouflage')?.title, 'CHROMATIC CAMOUFLAGE');
assert.equal(byId('chromatic-camouflage')?.trophies, 50);
assert.equal(byId('chromatic-camouflage')?.hidden, true);

const scoringTargets = Object.freeze({
  countryside: Object.freeze({ drift: 8000, flow: 7000 }),
  airport: Object.freeze({ drift: 11000, flow: 12000 }),
  cliffside: Object.freeze({ drift: 20000, flow: 13000 }),
  harbor: Object.freeze({ drift: 18000, flow: 23000 }),
  'midnight-city': Object.freeze({ drift: 20000, flow: 25000 }),
  mountain: Object.freeze({ drift: 20000, flow: 20000 })
});

for (const trackId of TRACK_IDS) {
  const winner = byId(`${trackId}-winner`);
  const safety = byId(`${trackId}-safety`);
  assert.equal(winner?.trophies, 50, `${trackId} WINNER must remain a 50-trophy stepping stone`);
  assert.equal(winner?.category, 'racing');
  assert.match(winner?.title || '', /WINNER$/);
  assert.equal(safety?.trophies, 75, `${trackId} SAFETY must award 75 trophies`);
  assert.equal(safety?.category, 'racing');
  assert.match(safety?.title || '', /SAFETY$/);
  for (const channel of ['drift', 'flow']) {
    const scoring = byId(`${trackId}-${channel}-score`);
    const target = scoringTargets[trackId][channel];
    assert.equal(scoring?.trophies, channel === 'drift' ? 75 : 50);
    assert.equal(scoring?.category, 'scoring');
    assert.equal(scoring?.target, target);
    assert.equal(scoring?.calibrationPending, false);
    assert.match(scoring?.description || '', new RegExp(target.toLocaleString('en-US')));
  }
}

assert.equal(byId('drift-flow-master')?.trophies, 300);
assert.equal(byId('drift-flow-master')?.progressMax, 12);
assert.equal(byId('drift-flow-master')?.calibrationPending, false);
assert.equal(byId('drift-flow-master')?.recommendation, 'Clear both scoring targets on all six tracks.');

const scoringUnlockMemory = new Map([[ACHIEVEMENT_STORAGE_KEY, JSON.stringify({
    version: TROPHY_ROAD_STORAGE_VERSION,
    unlocked: {
      'countryside-drift-score': { unlockedAt: Date.now() }
    }
  })]]);
const scoringUnlockStorage = {
  getItem: (key) => scoringUnlockMemory.get(key) ?? null,
  setItem: (key, value) => scoringUnlockMemory.set(key, String(value))
};
const scoringUnlockStore = createAchievementStore(scoringUnlockStorage);
assert.equal(scoringUnlockStore.isUnlocked('countryside-drift-score'), true);
assert.equal(scoringUnlockStore.trophyTotal(), 75,
  'A calibrated scoring achievement in storage must grant its trophies');

assert.equal(byId('countryside-safety')?.description, 'Finish Countryside without going off-road in under 15 seconds.');
assert.equal(byId('airport-safety')?.description, 'Finish Airport without going off-road in under 20 seconds.');
assert.equal(byId('cliffside-safety')?.description, 'Finish Cliffside without going off-road in under 20 seconds.');
assert.equal(byId('harbor-safety')?.description, 'Finish Harbor without going off-road in under 30 seconds.');
assert.equal(byId('midnight-city-safety')?.description, 'Finish Midnight City without going off-road in under 70 seconds.');
assert.equal(byId('mountain-safety')?.description, 'Finish Mountain without going off-road in under 70 seconds.');

assert.equal(byId('an-army-of-me')?.title, 'AN ARMY OF ME');
assert.equal(byId('an-army-of-me')?.trophies, 200);
assert.match(byId('an-army-of-me')?.description || '', /four saved rivals on every track/i);
assert.equal(byId('on-course-of-course')?.title, 'ON COURSE, OF COURSE');
assert.equal(byId('on-course-of-course')?.trophies, 100);
assert.match(byId('on-course-of-course')?.description || '', /without going off-road/i);
assert.match(byId('on-course-of-course')?.recommendation || '', /Countryside < 15 seconds/);
assert.match(byId('on-course-of-course')?.recommendation || '', /Airport < 20 seconds/);
assert.match(byId('on-course-of-course')?.recommendation || '', /Cliffside < 20 seconds/);
assert.match(byId('on-course-of-course')?.recommendation || '', /Harbor < 30 seconds/);
assert.match(byId('on-course-of-course')?.recommendation || '', /Midnight City < 70 seconds/);
assert.match(byId('on-course-of-course')?.recommendation || '', /Mountain < 70 seconds/);

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
assert.equal(byId('find-lilya')?.lockedDescription, 'Hidden achievement.');
assert.equal(byId('find-darvid')?.lockedDescription, 'Hidden achievement.');
assert.equal(
  byId('save-bella')?.lockedDescription,
  'Hidden achievement. You’ll know what to do when the moment comes.'
);
assert.equal(byId('satans-sedan')?.lockedDescription, undefined,
  'Satan’s Sports Car may retain the generic hidden title-clue treatment');

assert.equal(TIME_TRIALS.length, 6);
assert.equal(TIME_TRIAL_ACHIEVEMENT_IDS.length, 6);
assert.equal(TIME_TRIAL_MASTER_ID, 'faster-than-the-dev');
assert.equal(byId('faster-than-the-dev')?.progressMax, 6,
  'FASTER THAN THE DEV must require all six developer targets');
assert.equal(byId('faster-than-the-dev')?.trophies, 300,
  'FASTER THAN THE DEV must retain the August progression rebalance');
assert.deepEqual(
  TIME_TRIALS.map(({ trackId, targetSeconds }) => [trackId, targetSeconds]),
  [
    ['countryside', 11],
    ['airport', 15],
    ['cliffside', 14],
    ['harbor', 22],
    ['midnight-city', 50],
    ['mountain', 47]
  ]
);
assert.equal(byId('midnight-sprint')?.description, 'Finish Midnight City in under 50 seconds.');
assert.equal(byId('mountain-sprint')?.description, 'Finish Mountain in under 47 seconds.');
for (const trial of TIME_TRIALS) {
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds - 0.001)?.id, trial.id);
  assert.equal(qualifyingTimeTrial(trial.trackId, trial.targetSeconds), null,
    `${trial.title} must require a time strictly below the target`);
  assert.equal(byId(trial.id)?.trophies, 100,
    `${trial.title} must award 100 trophies`);
  assert.match(byId(trial.id)?.recommendation || '', /Future Racer/);
}
assert.equal(completedAllTimeTrials(() => true), true);
assert.equal(completedAllTimeTrials((id) => id !== 'harbor-sprint'), false);
assert.equal(completedAllTimeTrials((id) => id !== 'mountain-sprint'), false,
  'FASTER THAN THE DEV must remain locked until MOUNTAIN SPRINT is complete');
assert.equal(completedAllTimeTrials((id) => id !== 'harbor-sprint', 'harbor-sprint'), true);

assert.deepEqual(CLEAN_LAP_TARGETS, {
  countryside: 15,
  airport: 20,
  cliffside: 20,
  harbor: 30,
  'midnight-city': 70,
  mountain: 70
});
assert.equal(qualifiesForArmyLap({ rivalCountAtStart: 4 }, { position: 1, total: 5 }), true);
assert.equal(qualifiesForArmyLap({ rivalCountAtStart: 3 }, { position: 1, total: 4 }), false);
assert.equal(qualifiesForArmyLap({ rivalCountAtStart: 4 }, { position: 2, total: 5 }), false);
assert.equal(qualifiesForCatchGas({ running: true, caught: true, overcharge: 0.001, visible: true }), true,
  'Any real caught overcharge should satisfy CATCH THE CHARGE immediately');
assert.equal(qualifiesForCatchGas({ running: true, caught: true, overcharge: 0, visible: true }), false);
assert.equal(qualifiesForCatchGas({ running: true, caught: false, overcharge: 0.5, visible: true }), false);
assert.equal(qualifiesForCleanLap(
  { trackId: 'countryside', onCourseThroughout: true },
  { time: 14.999 }
), true);
assert.equal(qualifiesForCleanLap(
  { trackId: 'countryside', onCourseThroughout: true },
  { time: 15 }
), false, 'Matching a clean-lap target exactly must not count');
assert.equal(qualifiesForCleanLap(
  { trackId: 'mountain', onCourseThroughout: true },
  { time: 69.999 }
), true, 'A clean Mountain lap below its 70-second target should count');
assert.equal(qualifiesForCleanLap(
  { trackId: 'mountain', onCourseThroughout: true },
  { time: 60, onCourseThroughout: false }
), false, 'The physics-step lap latch must veto MOUNTAIN SAFETY even when interval sampling missed the excursion');
assert.equal(qualifiesForCleanLap(
  { trackId: 'harbor', onCourseThroughout: false },
  { time: 20 }
), false, 'Any sampled off-road state must void the clean-lap attempt');
assert.deepEqual(normalizeChallengeProgress({
  armyTracks: ['airport', 'mountain', 'airport', 'invented'],
  cleanTracks: ['harbor', 'mountain', 'invented']
}), {
  armyTracks: ['airport', 'mountain'],
  cleanTracks: ['harbor', 'mountain']
});

const empty = normalizeAchievementState(null);
assert.equal(empty.version, 8,
  'Trophy Road v8 adds the reordered road and explicit grandfathering');
assert.deepEqual(empty.progress.tracks, []);
assert.deepEqual(empty.progress.blankTracks, []);
assert.deepEqual(empty.progress.driveByEarParts, []);
assert.deepEqual(empty.progress.howToPlayDisclosures, []);
assert.deepEqual(empty.rewards.unlocked, []);

const normalizedLearningProgress = normalizeAchievementState({
  version: TROPHY_ROAD_STORAGE_VERSION,
  progress: {
    driveByEarParts: [DRIVE_BY_EAR_PART_IDS[0], DRIVE_BY_EAR_PART_IDS[0], 'invented-part'],
    howToPlayDisclosures: [HOW_TO_PLAY_DISCLOSURE_IDS[0], 'invented-disclosure']
  }
});
assert.deepEqual(normalizedLearningProgress.progress.driveByEarParts, [DRIVE_BY_EAR_PART_IDS[0]]);
assert.deepEqual(
  normalizedLearningProgress.progress.howToPlayDisclosures,
  [HOW_TO_PLAY_DISCLOSURE_IDS[0]]
);
assert.equal(completedLearningSet(DRIVE_BY_EAR_PART_IDS, DRIVE_BY_EAR_PART_IDS), true);
assert.equal(completedLearningSet(DRIVE_BY_EAR_PART_IDS.slice(0, -1), DRIVE_BY_EAR_PART_IDS), false);

const preservedUnknown = normalizeAchievementState({
  version: 5,
  unlocked: {
    'temporarily-unknown-achievement': {
      unlockedAt: 123,
      trackId: 'airport',
      vehicleId: 'ambulance',
      time: 42
    }
  },
  seen: ['temporarily-unknown-achievement'],
  progress: {},
  rewards: {}
});
assert.deepEqual(preservedUnknown.unlocked['temporarily-unknown-achievement'], {
  unlockedAt: 123,
  trackId: 'airport',
  vehicleId: 'ambulance',
  time: 42
}, 'Temporarily unknown unlocks must survive normalization instead of being erased');
assert.deepEqual(preservedUnknown.seen, ['temporarily-unknown-achievement'],
  'Seen state for temporarily unknown unlocks must survive too');

const unknownMemory = new Map([[ACHIEVEMENT_STORAGE_KEY, JSON.stringify({
  version: 5,
  unlocked: {
    'first-turn': { unlockedAt: 1 },
    'temporarily-unknown-achievement': { unlockedAt: 2 }
  },
  seen: [],
  progress: {},
  rewards: {}
})]]);
const unknownStorage = {
  getItem: (key) => unknownMemory.get(key) ?? null,
  setItem: (key, value) => unknownMemory.set(key, String(value))
};
const unknownStore = createAchievementStore(unknownStorage);
assert.equal(unknownStore.trophyTotal(), 25,
  'Unknown preserved records must contribute zero trophies');
assert.equal(unknownStore.isUnlocked('temporarily-unknown-achievement'), false,
  'Unknown preserved records must stay inactive until a catalog recognizes them');
assert.ok(JSON.parse(unknownMemory.get(ACHIEVEMENT_STORAGE_KEY)).unlocked['temporarily-unknown-achievement'],
  'Store creation must not destructively rewrite unknown unlock evidence');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value))
};
assert.equal(loadAchievementState(storage).storageAvailable, true);
const store = createAchievementStore(storage);
for (const partId of DRIVE_BY_EAR_PART_IDS) assert.equal(store.addDriveByEarPart(partId), true);
assert.equal(store.addDriveByEarPart(DRIVE_BY_EAR_PART_IDS[0]), false,
  'Completing the same DBE 101 part twice must not inflate progress');
for (const disclosureId of HOW_TO_PLAY_DISCLOSURE_IDS) {
  assert.equal(store.addHowToPlayDisclosure(disclosureId), true);
}
assert.equal(store.addHowToPlayDisclosure('invented-disclosure'), false);
assert.equal(
  JSON.parse(memory.get(ACHIEVEMENT_STORAGE_KEY)).progress.driveByEarParts.length,
  DRIVE_BY_EAR_PART_IDS.length,
  'Learning progress must persist even before its achievement unlock is recorded'
);
assert.equal(store.unlock('an-army-of-me', { trackId: 'midnight-city' })?.trophies, 200);
assert.equal(store.unlock('on-course-of-course', { trackId: 'harbor' })?.trophies, 100);
assert.equal(store.unlock('save-bella', { trackId: 'countryside', vehicleId: 'firetruck' })?.trophies, 25);
assert.equal(store.trophyTotal(), 325);
assert.deepEqual(store.syncRewards(), [],
  'Trophy Road 2 intentionally has no reward before the 400-trophy milestone');
assert.doesNotMatch(storeSource, /rival-storage|clearRivalsState|clearAllRivalsState/,
  'Rival resets must remain independent from achievements');

const evidenceMemory = new Map();
const evidenceStorage = {
  getItem: (key) => evidenceMemory.get(key) ?? null,
  setItem: (key, value) => evidenceMemory.set(key, String(value))
};
const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: evidenceStorage
});
const secretEventApi = await import(`../../turn/achievements/secret-events.js?integrity-test=${Date.now()}`);
assert.equal(secretEventApi.signalSecretAchievement('golden-hour', {
  trackId: 'airport',
  vehicleId: 'ambulance',
  time: 28.5
}), true);
assert.match(
  evidenceMemory.get(secretEventApi.SECRET_ACHIEVEMENT_EVIDENCE_STORAGE_KEY) || '',
  /golden-hour/,
  'One-shot secret achievement evidence must be durable until acknowledged'
);
assert.equal(secretEventApi.pendingSecretAchievements(evidenceStorage)[0]?.achievementId, 'golden-hour');
secretEventApi.acknowledgeSecretAchievement('golden-hour', evidenceStorage);
assert.deepEqual(secretEventApi.pendingSecretAchievements(evidenceStorage), []);
if (localStorageDescriptor) {
  Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
} else {
  delete globalThis.localStorage;
}

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

assert.match(catalogSource, /Stable production achievement facade/);
assert.match(catalogSource, /catalog-production\.js\?revision=r241-learning-achievements/);
assert.doesNotMatch(catalogSource, /id: 'an-army-of-me'/,
  'The stable facade must not duplicate the production achievement definitions');
assert.match(baseCatalogSource, /id: 'an-army-of-me'/);
assert.match(baseCatalogSource, /id: 'on-course-of-course'/);
assert.match(baseCatalogSource, /cat: '<svg/);
assert.doesNotMatch(baseCatalogSource, /points:/);
assert.match(baseCatalogSource, /convertible: 'AWD'/,
  'Stable vehicle IDs must use the current AWD name in achievement copy');
assert.match(productionCatalogSource, /catalog-base\.js\?revision=r241-trophy-balance/);
assert.doesNotMatch(productionCatalogSource, /from '.\/catalog\.js/,
  'The production catalog must extend the explicit base module, never depend on the public facade');
assert.match(productionCatalogSource, /title: 'MAYDAY!'/);
assert.match(productionCatalogSource, /title: 'GOT STARTED'/);
assert.match(productionCatalogSource, /title: 'CATCH THE CHARGE'/);
assert.match(productionCatalogSource, /TRACK_WINNER_ACHIEVEMENTS/);
assert.match(productionCatalogSource, /TRACK_SAFETY_ACHIEVEMENTS/);
assert.match(productionCatalogSource, /countryside: '15 seconds'/);
assert.match(productionCatalogSource, /'midnight-city': '70 seconds'/);
assert.match(productionCatalogSource, /mountain: '70 seconds'/);
assert.match(legacyCatalogSource, /catalog-production\.js\?revision=r241-learning-achievements/,
  'The old Chromatic catalog URL must converge on the same production source of truth');

assert.match(secretCatalog, /title: 'FIND LILYA!'/);
assert.match(secretCatalog, /title: 'FIND DARVID!'/);
assert.match(secretCatalog, /title: 'SAVE BELLA!'/);
assert.match(secretCatalog, /lockedDescription: 'Hidden achievement\.'/,
  'LILYA and DARVID must identify themselves as hidden without giving a clue');
assert.match(secretCatalog, /You’ll know what to do when the moment comes/,
  'SAVE BELLA should promise contextual discovery rather than expose its solution');
assert.equal((secretCatalog.match(/hidden: true/g) || []).length, 4);
assert.equal((secretCatalog.match(/trophies: 25/g) || []).length, 4);
assert.match(secretRuntime, /Object\.hasOwn\(achievement, 'lockedDescription'\)/);
assert.match(secretRuntime, /Hidden achievement\. The title is your clue\./,
  'The generic clue remains available for hidden achievements that use their title as the clue');
assert.match(secretRuntime, /pendingSecretAchievements/);
assert.match(secretRuntime, /acknowledgeSecretAchievement/);
assert.match(secretEvents, /SECRET_ACHIEVEMENT_EVIDENCE_STORAGE_KEY/);
assert.match(secretEvents, /protects one-shot events such as MAYDAY!/);
assert.match(lilyaSource, /signalSecretAchievement\('find-lilya'/);
assert.match(darvidSource, /signalSecretAchievement\('find-darvid'/);
assert.match(sedanSource, /signalSecretAchievement\('satans-sedan'/);

assert.match(timeTrialSource, /targetSeconds: 11/);
assert.match(timeTrialSource, /targetSeconds: 15/);
assert.match(timeTrialSource, /targetSeconds: 14/);
assert.match(timeTrialSource, /targetSeconds: 22/);
assert.match(timeTrialSource, /targetSeconds: 50/);
assert.match(timeTrialSource, /targetSeconds: 47/);
assert.match(timeTrialSource, /seconds >= trial\.targetSeconds/);
for (const entry of [productionEntry, labEntry]) {
  assert.match(entry, /"\/turn\/achievements\/time-trials\.js\?revision=r166-bella-records": "\/turn\/achievements\/time-trials\.js\?revision=r224-sprint-targets"/,
    'Production and Lab must route cached achievement imports to the new Sprint targets');
  assert.match(entry, /"\/turn\/achievements\/view\.js\?revision=r166-bella-records": "\/turn\/achievements\/view\.js\?revision=r242-serpentine-road"/,
    'Production and Lab must route cached achievement views to the corrected modal header');
  assert.match(entry, /"\/turn\/achievements\/catalog-base\.js\?revision=r222-awd-label": "\/turn\/achievements\/catalog-base\.js\?revision=r241-trophy-balance"/,
    'Installed builds must not retain the old LISTEN CLOSELY trophy value');
  assert.match(entry, /"\/turn\/achievements\/scoring-achievements\.js\?revision=r2-calibrated-targets": "\/turn\/achievements\/scoring-achievements\.js\?revision=r3-trophy-balance"/,
    'Installed builds must not retain the old DRIFT trophy value');
}

assert.match(challengeSource, /SAMPLE_INTERVAL_MS = 50/);
assert.match(challengeSource, /CATCH_GAS_MIN_OVERCHARGE = 0\.001/);
assert.doesNotMatch(challengeSource, /CATCH_GAS_REQUIRED_MS|catchGasMs|3000/,
  'CATCH THE CHARGE must not retain a hidden timed-hold requirement');
assert.match(challengeSource, /GOT_STARTED_ID = 'got-started'/);
assert.match(challengeSource, /mountain: 70/);
assert.match(challengeSource, /rivalCountAtStart/);
assert.match(challengeSource, /runtime\.state\.offRoad === true/);
assert.match(challengeSource, /achievements\.unlock\(\s*CATCH_THE_CHARGE_ID/,
  'A qualifying GAS catch must unlock CATCH THE CHARGE directly');
assert.match(challengeSource, /achievements\.unlock\('an-army-of-me'/);
assert.match(challengeSource, /achievements\.unlock\('on-course-of-course'/);
assert.match(challengeSource, /turn:lap-result/);
assert.match(challengeSource, /turn:lap-invalid/);
assert.match(challengeSource, /turn:achievements-updated/);
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

for (const source of [runtime, view, storeSource, challengeSource, secretRuntime]) {
  assert.doesNotMatch(source, /catalog-base\.js/,
    'Runtime consumers must use the stable production catalog facade, never the internal base catalog');
}
assert.match(runtime, /catalog\.js\?revision=r241-learning-achievements/,
  'Achievement consumers must load the current AWD vehicle label');
assert.match(runtime, /store\.js\?revision=r241-learning-achievements/,
  'The runtime must execute the Trophy Road 2 migration under a fresh module identity');
assert.match(runtime, /view\.js\?revision=r242-serpentine-road/);
assert.match(runtime, /DRIVE_BY_EAR_PART_COMPLETED_EVENT/);
assert.match(runtime, /HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT/);
assert.match(runtime, /unlock\(\[DRIVE_BY_EAR_ACHIEVEMENT_ID\], \{\}, \{ delay: -1 \}\)/);
assert.match(runtime, /unlock\(\[LEARN_TO_PLAY_ACHIEVEMENT_ID\], \{\}, \{ delay: -1 \}\)/);
assert.match(runtime, /window\.addEventListener\(LEARNING_FEEDBACK_READY_EVENT/,
  'Learning feedback must be released only after its modal top layer closes');
assert.match(runtime, /importStoredLearningAchievements\(\)/,
  'A complete persisted learning set must backfill its achievement after startup');
assert.match(view, /store\.state\.progress\.driveByEarParts\.length/);
assert.match(view, /store\.state\.progress\.howToPlayDisclosures\.length/);
assert.match(view, /TROPHY_ROAD_MAX_THRESHOLD/);
assert.match(storeSource, /Preserve syntactically valid unlock records/);
assert.match(nightShiftSource, /RIVAL_COUNT = 4/);
assert.match(fixedLayout, /installAchievementChallengeExpansion/);
assert.match(fixedLayout, /r166-bella-records/);
assert.match(app, /render\/world\.js\?revision=r166-bella-records/);
assert.match(app, /achievements=r166-bella-records/);
assert.match(workflow, /Run achievement system regression/);
assert.match(workflow, /node turn-lab\/tests\/achievements-production\.mjs/);

console.log('TURN achievement catalog and calibrated scoring integrity regression passed.');

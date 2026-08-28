import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ACHIEVEMENTS,
  GOT_STARTED_ACHIEVEMENT,
  ONBOARDING_ACHIEVEMENT_IDS,
  TRACK_IDS,
  TRACK_NAMES,
  getAchievement
} from '../../turn/achievements/catalog-chromatic-r183.js';
import {
  CHROMATIC_CAMOUFLAGE_ID,
  matchesTrackColor,
  qualifyingChromaticCamouflage
} from '../../turn/achievements/chromatic-camouflage-r183.js';
import {
  CHALLENGE_PROGRESS_STORAGE_KEY,
  installAchievementChallengeExpansion
} from '../../turn/achievements/challenge-expansion-r166.js';
import {
  TROPHY_ROAD_MAX_THRESHOLD,
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_REWARD_ICONS
} from '../../turn/progression/trophy-road-chromatic-r183.js';

const [releaseSource, indexSource, moduleSource, trophyRoadCss] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/chromatic-camouflage-r183.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road-r157.css', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

const achievement = getAchievement(CHROMATIC_CAMOUFLAGE_ID);
const mayday = getAchievement('golden-hour');
const catchTheCharge = getAchievement('catch-the-charge');
const gotStarted = getAchievement('got-started');

assert.equal(ACHIEVEMENTS.length, 45,
  'Production TURN should expose the existing achievement set, CATCH THE CHARGE and GOT STARTED');
assert.equal(GOT_STARTED_ACHIEVEMENT, gotStarted);
assert.equal(gotStarted?.title, 'GOT STARTED');
assert.equal(gotStarted?.category, 'onboarding');
assert.equal(gotStarted?.trophies, 75);
assert.equal(gotStarted?.description, 'Finish all Getting Started achievements.');
assert.equal(catchTheCharge?.title, 'CATCH THE CHARGE');
assert.equal(catchTheCharge?.category, 'onboarding');
assert.equal(catchTheCharge?.trophies, 25);
assert.equal(Object.hasOwn(catchTheCharge || {}, 'progressMax'), false,
  'CATCH THE CHARGE should unlock on the catch itself, without a timed hold');
assert.equal(
  catchTheCharge?.description,
  'With BOOST full, keep using DRIFT to build purple OVERCHARGE. Slide to GAS to catch it before it leaks away.'
);
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.length, 11,
  'GOT STARTED must require every Getting Started lesson, including CATCH THE CHARGE, without requiring itself');
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.includes('catch-the-charge'), true);
assert.equal(ONBOARDING_ACHIEVEMENT_IDS.includes('got-started'), false);

assert.equal(achievement?.title, 'CHROMATIC CAMOUFLAGE');
assert.equal(achievement?.hidden, true);
assert.equal(achievement?.category, 'exploration');
assert.equal(achievement?.trophies, 50);
assert.equal(
  achievement?.description,
  'Set your personal best on every track in a car painted to match that track.'
);
assert.equal(mayday?.title, 'MAYDAY!');
assert.equal(mayday?.hidden, true);
assert.equal(mayday?.category, 'racing');
assert.equal(mayday?.trophies, 100);
assert.equal(
  mayday?.lockedDescription,
  'Hidden achievement. You’ll know what to do when the moment comes.'
);
assert.match(mayday?.description || '', /Ambulance/);
assert.match(mayday?.description || '', /Airport MAYDAY/);
assert.match(mayday?.description || '', /30 seconds/);

for (const trackId of TRACK_IDS) {
  const trackName = TRACK_NAMES[trackId];
  const winner = getAchievement(`${trackId}-winner`);
  const safety = getAchievement(`${trackId}-safety`);
  assert.equal(winner?.title, `${trackName.toUpperCase()} WINNER`);
  assert.equal(winner?.category, 'racing');
  assert.equal(winner?.trophies, 50);
  assert.match(winner?.description || '', /four saved rivals/i);
  assert.equal(safety?.title, `${trackName.toUpperCase()} SAFETY`);
  assert.equal(safety?.category, 'racing');
  assert.equal(safety?.trophies, 50);
  assert.match(safety?.description || '', /without going off-road/i);
}

for (const achievementId of [
  'countryside-sprint',
  'airport-sprint',
  'cliffside-sprint',
  'harbor-sprint',
  'midnight-sprint',
  'mountain-sprint'
]) {
  assert.equal(getAchievement(achievementId)?.trophies, 75,
    `${achievementId} should award 75 trophies`);
}
assert.equal(getAchievement('faster-than-the-dev')?.trophies, 300);

const achievementState = {
  unlocked: Object.fromEntries(ONBOARDING_ACHIEVEMENT_IDS.map((id) => [id, { unlockedAt: 1 }]))
};
const challengeMemory = new Map([[
  CHALLENGE_PROGRESS_STORAGE_KEY,
  JSON.stringify({ armyTracks: ['airport'], cleanTracks: ['harbor'] })
]]);
const challengeStorage = {
  getItem: (key) => challengeMemory.get(key) ?? null,
  setItem: (key, value) => challengeMemory.set(key, value)
};
const challengeUnlocks = [];
const challengeRuntime = {
  state: {
    trackId: 'countryside',
    vehicleId: 'sedan',
    competitorLaps: [{}, {}, {}, {}],
    offRoad: false
  }
};
const challengeApi = installAchievementChallengeExpansion({
  runtime: challengeRuntime,
  achievements: {
    unlock(id, context) {
      if (achievementState.unlocked[id]) return null;
      achievementState.unlocked[id] = { unlockedAt: 1, ...context };
      challengeUnlocks.push({ id, context });
      return getAchievement(id) || { id };
    },
    getState() {
      return achievementState;
    }
  },
  storage: challengeStorage
});
assert.ok(challengeUnlocks.some(({ id }) => id === 'airport-winner'),
  'Stored all-track progress should backfill the corresponding WINNER achievement');
assert.ok(challengeUnlocks.some(({ id }) => id === 'harbor-safety'),
  'Stored all-track progress should backfill the corresponding SAFETY achievement');
assert.ok(challengeUnlocks.some(({ id }) => id === 'got-started'),
  'Existing players with every Getting Started achievement should receive GOT STARTED automatically');
challengeUnlocks.length = 0;
challengeApi.beginLap();
challengeApi.completeLap({ position: 1, total: 5, time: 20 });
assert.deepEqual(
  challengeUnlocks.map(({ id }) => id),
  ['countryside-winner', 'countryside-safety'],
  'One qualifying lap should award both track-specific achievements immediately'
);
challengeApi.disconnect();

assert.equal(
  ACHIEVEMENTS.reduce((total, item) => total + item.trophies, 0),
  3075
);
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 3075);
assert.deepEqual(
  TROPHY_ROAD_REWARDS.map(({ id, threshold }) => [id, threshold]),
  [
    ['vintage-racer', 300],
    ['midnight-city', 400],
    ['race-car', 500],
    ['emergency-pack', 600],
    ['mountain', 700],
    ['monster', 800],
    ['paintjob', 900],
    ['future-racer', 1000],
    ['rally-racer', 1100]
  ]
);
assert.deepEqual(TRACK_IDS, [
  'countryside', 'airport', 'cliffside', 'harbor', 'midnight-city', 'mountain'
], 'Every-track achievements must include the sixth production track');

assert.match(TROPHY_ROAD_REWARD_ICONS.future, /M3 32h12l7-5/,
  'Future Racer should use the sharper Formula silhouette in both marker and detail views');
assert.match(TROPHY_ROAD_REWARD_ICONS.race, /M4 31h10l7-11/,
  'Race Car should receive a dedicated formula-car reward silhouette');
assert.match(TROPHY_ROAD_REWARD_ICONS.vintage, /r="7"/,
  'Vintage Racer should read as an older racer with larger exposed wheels');
assert.match(TROPHY_ROAD_REWARD_ICONS.rally, /circle cx="27" cy="29"/,
  'Rally Racer should have recognisable auxiliary rally lamps');

for (const variable of [
  '--turn-reward-vehicle-locked',
  '--turn-reward-vehicle-unlocked',
  '--turn-reward-track-locked',
  '--turn-reward-track-unlocked',
  '--turn-reward-feature-locked',
  '--turn-reward-feature-unlocked'
]) {
  assert.match(trophyRoadCss, new RegExp(variable));
}
assert.match(trophyRoadCss, /data-trophy-reward="mountain"/);
assert.match(trophyRoadCss, /data-trophy-reward="paintjob"/);
assert.match(trophyRoadCss, /data-trophy-reward="vintage-racer"/);
assert.match(trophyRoadCss, /\.is-locked/);
assert.match(trophyRoadCss, /\.is-unlocked/);

const factoryRoute = Object.freeze({
  countryside: Object.freeze({ time: 18, carId: 'convertible', carColor: '#a8327a' }),
  airport: Object.freeze({ time: 21, carId: 'classic', carColor: '#ffcc00' }),
  harbor: Object.freeze({ time: 35, carId: 'vintage-racer', carColor: '#8b5a2b' }),
  cliffside: Object.freeze({ time: 24, carId: 'race-future', carColor: '#00aabb' }),
  'midnight-city': Object.freeze({ time: 70, carId: 'sedan-sports', carColor: '#5e3c87' }),
  mountain: Object.freeze({ time: 98, carId: 'toy-racer', carColor: '#4dabf7' })
});

for (const trackId of TRACK_IDS) {
  assert.equal(matchesTrackColor(trackId, factoryRoute[trackId].carColor), true,
    `${trackId} should admit its corresponding factory-colour route`);
}

assert.equal(matchesTrackColor('countryside', '#ff70b4'), true);
assert.equal(matchesTrackColor('countryside', '#ff00ff'), true,
  'Canonical Magenta should count for Countryside; the charitable range must not fail on a tiny hue boundary');
assert.equal(matchesTrackColor('airport', '#ffd84f'), true);
assert.equal(matchesTrackColor('harbor', '#f28b39'), true);
assert.equal(matchesTrackColor('cliffside', '#3ccad6'), true);
assert.equal(matchesTrackColor('midnight-city', '#a785ea'), true);
assert.equal(matchesTrackColor('mountain', '#4dabf7'), true,
  'Mountain should accept its alpine-blue track family without overlapping Cliffside cyan');
assert.equal(matchesTrackColor('mountain', '#00aabb'), false,
  'Cliffside cyan must not also satisfy the Mountain blue family');
assert.equal(matchesTrackColor('countryside', '#ffcc00'), false,
  'A saturated wrong hue must not count');
assert.equal(matchesTrackColor('airport', '#fafafa'), false,
  'Near-white paint must not count even when hue is ambiguous');
assert.equal(matchesTrackColor('midnight-city', '#160b22'), false,
  'Very dark paint must not count');
assert.equal(matchesTrackColor('cliffside', '#777777'), false,
  'Low-chroma grey must not count');

const qualifying = qualifyingChromaticCamouflage((trackId) => factoryRoute[trackId]);
assert.equal(qualifying?.length, TRACK_IDS.length);
assert.deepEqual(qualifying?.map(({ trackId }) => trackId), TRACK_IDS);
assert.equal(qualifyingChromaticCamouflage((trackId) => (
  trackId === 'harbor'
    ? { ...factoryRoute[trackId], carColor: '#ff4fa3' }
    : factoryRoute[trackId]
)), null, 'One wrong-colour personal best must keep the achievement locked');
assert.equal(qualifyingChromaticCamouflage((trackId) => (
  trackId === 'airport' ? null : factoryRoute[trackId]
)), null, 'Every canonical production track must have a stored personal best');

assert.match(moduleSource, /minSaturation: 0\.30/);
assert.match(moduleSource, /minLightness: 0\.28/);
assert.match(moduleSource, /maxLightness: 0\.85/);
assert.match(moduleSource, /hueMin: 295/,
  'Countryside must include native canonical magenta at hue 300');
assert.match(moduleSource, /mountain: Object\.freeze\(\{ hueMin: 206, hueMax: 230, name: 'blue' \}\)/,
  'Mountain must own a distinct blue paint family');
assert.match(moduleSource, /turn:lap-result/,
  'The state should be re-evaluated after a record can change');

assert.ok(
  indexSource.includes(`TURN v${release.version} · Build ${release.id}`),
  'Production entry point must display the current release source of truth'
);
assert.match(indexSource, /catalog-chromatic-r183\.js/,
  'Production must route the achievement store and view through the production achievement catalog');
assert.match(indexSource, /trophy-road-chromatic-r183\.js/,
  'Production must expose the expanded Trophy Road wrapper');
assert.match(indexSource, /chromatic-camouflage-r183\.js/,
  'Production must install the hidden achievement evaluator');
assert.doesNotMatch(indexSource, /airport-runway/,
  'The TURN NEXT Airport prototype must not enter the production TURN entry point');

console.log(`TURN ${release.version} production achievements, Trophy Road order and Chromatic Camouflage regression passed.`);

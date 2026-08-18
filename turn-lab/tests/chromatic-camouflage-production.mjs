import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  ACHIEVEMENTS,
  TRACK_IDS,
  getAchievement
} from '../../turn/achievements/catalog-chromatic-r183.js';
import {
  CHROMATIC_CAMOUFLAGE_ID,
  matchesTrackColor,
  qualifyingChromaticCamouflage
} from '../../turn/achievements/chromatic-camouflage-r183.js';
import { TROPHY_ROAD_MAX_THRESHOLD } from '../../turn/progression/trophy-road-chromatic-r183.js';

const [releaseSource, indexSource] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8')
]);
const moduleSource = await fs.readFile(
  new URL('../../turn/achievements/chromatic-camouflage-r183.js', import.meta.url),
  'utf8'
);
const release = JSON.parse(releaseSource);

const achievement = getAchievement(CHROMATIC_CAMOUFLAGE_ID);
const mayday = getAchievement('golden-hour');
assert.equal(ACHIEVEMENTS.length, 31,
  'Production TURN should expose the existing 29 achievements plus MAYDAY and Chromatic Camouflage');
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
assert.equal(mayday?.lockedDescription, '');
assert.match(mayday?.description || '', /Ambulance/);
assert.match(mayday?.description || '', /Airport MAYDAY/);
assert.match(mayday?.description || '', /30 seconds/);
assert.equal(
  ACHIEVEMENTS.reduce((total, item) => total + item.trophies, 0),
  1875
);
assert.equal(TROPHY_ROAD_MAX_THRESHOLD, 1875);
assert.deepEqual(TRACK_IDS, [
  'countryside', 'airport', 'cliffside', 'harbor', 'midnight-city', 'mountain'
], 'Every-track achievements must include the sixth production track');

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
  'Production must expose the expanded 1875-trophy road maximum');
assert.match(indexSource, /chromatic-camouflage-r183\.js/,
  'Production must install the hidden achievement evaluator');
assert.doesNotMatch(indexSource, /airport-runway/,
  'The TURN NEXT Airport prototype must not enter the production TURN entry point');

console.log(`TURN ${release.version} production six-track Chromatic Camouflage achievement regression passed.`);

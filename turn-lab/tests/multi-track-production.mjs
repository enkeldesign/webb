import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTrackSpatialIndex, findNearestTrackBruteForce } from '../../turn/race/track-spatial-index.js';
import {
  clearRivalsState,
  getStoredBestTime,
  saveRivalsState
} from '../../turn/race/rival-storage.js';

const storage = new Map();
const originalLocalStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

try {
  const countrysideState = {
    trackId: 'countryside',
    competitorLaps: [{ time: 12.73, frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10 })) }]
  };
  const airportState = {
    trackId: 'airport',
    competitorLaps: [{ time: 18.42, frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10 })) }]
  };

  assert.equal(saveRivalsState(countrysideState), true);
  assert.equal(saveRivalsState(airportState), true);
  assert.ok(storage.has('turn-personal-rivals-v1'), 'Track 1 must preserve the existing rival storage key');
  assert.ok(storage.has('turn-personal-rivals-v1:airport'), 'Airport rivals must live in their own storage key');
  assert.equal(getStoredBestTime('countryside'), 12.73);
  assert.equal(getStoredBestTime('airport'), 18.42);

  clearRivalsState(airportState);
  assert.equal(storage.has('turn-personal-rivals-v1:airport'), false, 'Reset Rivals on Airport must clear only Airport');
  assert.equal(storage.has('turn-personal-rivals-v1'), true, 'Reset Rivals on Airport must never erase countryside history');
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}

const trackA = makeSamples([
  [-20, 0],
  [0, 0],
  [20, 0],
  [40, 0]
]);
const trackB = makeSamples([
  [0, 100],
  [20, 100],
  [40, 100],
  [60, 100]
]);
const spatialIndex = createTrackSpatialIndex(trackA, { cellSize: 16 });
assert.equal(spatialIndex.find({ x: 3, z: 2 }).index, 1, 'Initial track index must find Track A samples');
spatialIndex.replaceSamples(trackB);
const rebuilt = spatialIndex.find({ x: 19, z: 98 });
const brute = findNearestTrackBruteForce(trackB, { x: 19, z: 98 });
assert.equal(rebuilt.index, brute.index, 'Rebuilt track index must remain exact after changing courses');
assert.equal(rebuilt.sample, trackB[brute.index], 'Rebuilt index must return the active track sample object');
assert.ok(spatialIndex.getStats().queryCount >= 1, 'Rebuilt index diagnostics must restart and record new-track queries');

const [index, trackCatalog, trackManager, trackSelect, trackSelectCss, lotWrapper, airportWorld, spatialSource, rivalStorage] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/track-select.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/track-spatial-index.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.5\.0 · Build 2026\.07\.22-r47/);
assert.match(index, /track-select\.css\?build=20260722-r47/);
assert.match(index, /"\.\/garage\/lot-r10\.js\?build=20260720-r19": "\.\/garage\/lot-track-select\.js\?build=20260722-r47"/, 'The track selector must sit before the existing Lot entry point');
assert.match(index, /"\.\/race\/rival-storage\.js\?build=20260720-r19": "\.\/race\/rival-storage\.js\?build=20260722-r47"/, 'Production must load track-scoped rival storage');
assert.match(index, /"\.\/race\/track-spatial-index\.js\?build=20260720-r19": "\.\/race\/track-spatial-index\.js\?build=20260722-r47"/, 'Production must load the rebuildable track index');
assert.match(index, /Turn the device to steer/, 'Start copy must use device-neutral language');
assert.match(index, /Steering uses device rotation/, 'Status copy must use device-neutral language');
assert.doesNotMatch(index, /Turn the phone to steer|Steering uses phone rotation/, 'The retired phone-specific start copy must stay removed');

assert.match(trackCatalog, /id: 'countryside'/);
assert.match(trackCatalog, /difficulty: 'EASY'/);
assert.match(trackCatalog, /id: 'airport'/);
assert.match(trackCatalog, /difficulty: 'MEDIUM'/);
assert.match(trackCatalog, /radiusX = 208 \+ Math\.sin\(angle \* 2 \+ 0\.35\) \* 20 \+ Math\.sin\(angle \* 3 - 0\.8\) \* 9/, 'Track 1 geometry generator must remain unchanged');
assert.match(trackCatalog, /radiusZ = 146 \+ Math\.cos\(angle \* 2 - 0\.4\) \* 14 \+ Math\.sin\(angle \* 3 \+ 0\.6\) \* 8/, 'Track 1 geometry generator must remain unchanged');
assert.match(trackCatalog, /TRACK_SAMPLE_COUNT = 720/, 'Both tracks must use the verified 720-sample race/checkpoint system');
assert.match(trackCatalog, /Runway speed\. Service-road precision\./, 'Airport must keep its medium-difficulty driving identity');

assert.match(lotWrapper, /await chooseTrackBeforeLot\(\)/, 'Track selection must complete before The Lot opens');
assert.ok(
  lotWrapper.indexOf('await chooseTrackBeforeLot()') < lotWrapper.indexOf('showOriginalLot(options)'),
  'The flow must remain TRACK → CAR → RACE'
);
assert.match(trackSelect, /CHOOSE YOUR TRACK/);
assert.match(trackSelect, /TRACK → CAR → RACE/);
assert.match(trackSelect, /getStoredBestTime\(track\.id\)/, 'Selector cards must show track-specific records');
assert.match(trackSelectCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'The two launch tracks must present as peer choices');

assert.match(trackManager, /replaceSamples\(currentRuntime\.samples, airportTrack\.samples\)/);
assert.match(trackManager, /currentRuntime\.trackSpatialIndex\.replaceSamples\(currentRuntime\.samples\)/, 'The shared exact spatial index must rebuild when changing tracks');
assert.match(trackManager, /currentRuntime\.world\.visible = false/);
assert.match(trackManager, /airportWorld\.visible = true/);
assert.match(trackManager, /currentRuntime\.world\.visible = true/);
assert.match(trackManager, /loadRivalsState\([\s\S]*trackId: nextTrackId/, 'Changing track must reload only that track’s rivals');
assert.match(trackManager, /clearRivalsState\(currentRuntime\.state, \{ trackId: activeTrackId \}\)/, 'Reset Rivals must remain scoped to the active track');
assert.doesNotMatch(trackManager, /setAnimationLoop|requestAnimationFrame|setInterval/, 'Track switching must not create another render loop');

assert.match(spatialSource, /replaceSamples\(nextSamples\)/, 'The shared spatial index must expose a controlled rebuild hook');
assert.match(spatialSource, /return rebuild\(nextSamples\)/);
assert.match(rivalStorage, /normalized === DEFAULT_TRACK_ID \? COMPETITOR_KEY : `\$\{COMPETITOR_KEY\}:\$\{normalized\}`/, 'Countryside must keep its historical storage key while later tracks are namespaced');
assert.match(rivalStorage, /version: 5/);

assert.match(airportWorld, /function makeRunway\(/);
assert.match(airportWorld, /function makeAirportBuildings\(/);
assert.match(airportWorld, /function makeAircraft\(/);
assert.match(airportWorld, /function makeGroundOperations\(/);
assert.match(airportWorld, /function makeStartGate\(/);
assert.match(airportWorld, /new THREE\.PlaneGeometry\(520, 340\)/, 'Airport must have a large dedicated concrete field');
assert.match(airportWorld, /new THREE\.BoxGeometry\(455, 0\.1, 62\)/, 'Airport must include its long runway landmark');
assert.doesNotMatch(airportWorld, /GLTFLoader|fetch\(|new Audio\(/, 'Airport scenery must stay deterministic and offline-friendly');
assert.doesNotMatch(airportWorld, /setAnimationLoop|requestAnimationFrame|setInterval/, 'Airport scenery must add no independent animation loop');

console.log('TURN multi-track selection, Airport world and track-scoped rival regression passed.');

function makeSamples(points) {
  return points.map(([x, z]) => ({ point: { x, z } }));
}
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
    competitorLaps: [{ time: 22.42, frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10 })) }]
  };

  assert.equal(saveRivalsState(countrysideState), true);
  assert.equal(saveRivalsState(airportState), true);
  assert.ok(storage.has('turn-personal-rivals-v1'), 'Track 1 must preserve the existing rival storage key');
  assert.ok(storage.has('turn-personal-rivals-v1:airport-r50'), 'Redesigned Airport rivals must use the r50 geometry namespace');
  assert.equal(storage.has('turn-personal-rivals-v1:airport'), false, 'Old Airport ghosts must not leak onto the redesigned course');
  assert.equal(getStoredBestTime('countryside'), 12.73);
  assert.equal(getStoredBestTime('airport'), 22.42);

  clearRivalsState(airportState);
  assert.equal(storage.has('turn-personal-rivals-v1:airport-r50'), false, 'Reset Rivals on Airport must clear only the r50 Airport namespace');
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

const [
  index,
  trackCatalog,
  trackManager,
  trackSelect,
  trackSelectCss,
  lotWrapper,
  airportWorld,
  spatialSource,
  rivalStorage,
  hud,
  worldRender
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/track-select.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-world-r50.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/track-spatial-index.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/hud.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.6\.0 · Build 2026\.07\.22-r50/);
assert.match(index, /track-select\.css\?build=20260722-r50/);
assert.match(index, /"\.\/garage\/lot-r10\.js\?build=20260720-r19": "\.\/garage\/lot-track-select\.js\?build=20260722-r50"/, 'The r50 track selector must sit before the stable Lot entry point');
assert.match(index, /"\.\/race\/rival-storage\.js\?build=20260720-r19": "\.\/race\/rival-storage\.js\?build=20260722-r50"/, 'Production must load geometry-revision-aware rival storage');
assert.match(index, /"\.\/race\/track-spatial-index\.js\?build=20260720-r19": "\.\/race\/track-spatial-index\.js\?build=20260722-r47"/, 'Production must preserve the rebuildable track index');
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
assert.match(trackCatalog, /Runway speed\. Apron precision\./, 'Airport must keep its distinct medium-difficulty driving identity');
assert.match(trackCatalog, /\[25, 43\],[\s\S]*\[0, 22\],[\s\S]*\[-25, 43\]/, 'The service-road hairpin must use a broad symmetric entry and exit around its apex');
assert.doesNotMatch(trackCatalog, /\[27, 76\],[\s\S]*\[3, 40\],[\s\S]*\[-25, 68\]/, 'The pinched r49 hairpin geometry must stay retired');

assert.match(lotWrapper, /track-manager\.js\?build=20260722-r50/, 'The Lot wrapper must load the redesigned Airport runtime');
assert.match(lotWrapper, /await chooseTrackBeforeLot\(\)/, 'Track selection must complete before The Lot opens');
assert.ok(
  lotWrapper.indexOf('await chooseTrackBeforeLot()') < lotWrapper.indexOf('showOriginalLot(options)'),
  'The flow must remain TRACK → CAR → RACE'
);
assert.match(trackSelect, /CHOOSE YOUR TRACK/);
assert.match(trackSelect, /TRACK → CAR → RACE/);
assert.match(trackSelect, /getStoredBestTime\(track\.id\)/, 'Selector cards must show track-specific records');
assert.match(trackSelectCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'The two launch tracks must present as peer choices');
assert.match(trackSelectCss, /@media \(max-height: 820px\) and \(orientation: landscape\)/, 'Landscape track selection must compact before the photographed iPad viewport overflows');
assert.match(trackSelectCss, /grid-template-rows: auto minmax\(0, 1fr\) auto/, 'The chooser must reserve a visible footer row for Continue');
assert.match(trackSelectCss, /\.track-select-shell \{[\s\S]*min-height: 0;/, 'The chooser shell must be allowed to shrink inside the viewport');
assert.match(trackSelectCss, /\.track-card-copy \{[\s\S]*overflow: hidden;/, 'Track copy must not render underneath the Best card');
assert.match(trackSelectCss, /\.track-card-name \{[\s\S]*white-space: nowrap;/, 'Track names must remain a single controlled line');
assert.match(trackSelectCss, /\.track-card\.is-selected \{[\s\S]*translate\(9px, 9px\) scale\(0\.99\)/, 'Selected track must keep its deeply pressed material state');
assert.match(trackSelectCss, /filter: saturate\(1\.38\) contrast\(1\.06\) brightness\(1\.02\)/, 'Selected track must remain distinctly more vibrant');
assert.match(trackSelectCss, /\.track-card:focus-visible/, 'The material treatment must retain a visible keyboard focus ring');

assert.match(trackManager, /airport-world-r50\.js\?build=20260722-r50/, 'Track manager must load the redesigned r50 Airport world');
assert.match(trackManager, /initialTrackId: chosenThisSession \? activeTrackId : loadTrackSelection\(\)/, 'Later Lot visits must reopen track choice with the current course preselected');
assert.doesNotMatch(trackManager, /if \(!force && chosenThisSession\) return activeTrackId/, 'Track selection must not be skipped on later visits to The Lot');
assert.match(trackManager, /replaceSamples\(currentRuntime\.samples, airportTrack\.samples\)/);
assert.match(trackManager, /currentRuntime\.trackSpatialIndex\.replaceSamples\(currentRuntime\.samples\)/, 'The shared exact spatial index must rebuild when changing tracks');
assert.match(trackManager, /loadRivalsState\([\s\S]*trackId: nextTrackId/, 'Changing track must reload only that track’s rivals');
assert.match(trackManager, /clearRivalsState\(currentRuntime\.state, \{ trackId: activeTrackId \}\)/, 'Reset Rivals must remain scoped to the active track');
assert.doesNotMatch(trackManager, /setAnimationLoop|requestAnimationFrame|setInterval/, 'Track switching must not create another render loop');

assert.match(hud, /cached\.firstSample === firstSample/, 'The minimap cache must notice when the shared samples array is repopulated for another track');
assert.match(hud, /cached\.lastSample === lastSample/, 'The minimap cache must not reuse the previous track drawing after a course switch');
assert.match(spatialSource, /replaceSamples\(nextSamples\)/, 'The shared spatial index must expose a controlled rebuild hook');
assert.match(spatialSource, /return rebuild\(nextSamples\)/);

assert.match(rivalStorage, /airport: 'airport-r50'/, 'Airport records must be revision-scoped after the geometry redesign');
assert.match(rivalStorage, /version: 6/);
assert.match(rivalStorage, /trackRevision: storageTrackId\(activeTrackId\)/, 'Saved rival payloads must record the geometry revision');

assert.match(airportWorld, /name = 'TURN Airport r50'/, 'The active world must identify the r50 redesign');
assert.match(airportWorld, /makeStartFinishDistrict\(world, samples, trackWidth\)/, 'Airport must have a deliberately designed start and finish district');
assert.match(airportWorld, /TURN AIRPORT/, 'The start gantry must carry a real Airport identity');
assert.match(airportWorld, /TURN INTERNATIONAL/, 'The terminal must anchor the opening vista');
assert.match(airportWorld, /makeTerminalCampus\(world, samples\)/, 'Terminal, tower and hangars must be composed as one visual campus');
assert.match(airportWorld, /makeHangar\(world, samples/, 'The airport must retain the successful hangar language from the r49 screenshots');
assert.match(airportWorld, /makeAircraftApron\(world, samples\)/, 'Aircraft and ground operations must be arranged as a coherent apron');
assert.match(airportWorld, /createCarVisual\(/, 'Airport service traffic must reuse real local TURN GLB vehicle assets');
assert.match(airportWorld, /carId: 'truck'/);
assert.match(airportWorld, /carId: 'van'/);
assert.match(airportWorld, /carId: 'truck-flat'/);
assert.match(airportWorld, /SUMMER_INDUSTRIAL_COMMIT = '0831a1937a59562b6165ccfab30f64f35c957b6f'/, 'Summer Engine industrial art must be pinned to an immutable source revision');
assert.match(airportWorld, /building-a\.glb/);
assert.match(airportWorld, /building-b\.glb/);
assert.match(airportWorld, /building-c\.glb/);
assert.match(airportWorld, /detail-tank\.glb/);
assert.match(airportWorld, /keeping local Airport fallbacks/, 'Remote industrial enrichment must fail safely');
assert.match(airportWorld, /makeMaintenanceFallback/, 'The Airport must remain visually complete without network assets');
assert.doesNotMatch(airportWorld, /crystal-bit\/platform-3d/, 'The odd external aircraft dependency from r48 must stay retired');
assert.match(airportWorld, /new THREE\.Box3\(\)\.setFromObject\(object\)/, 'Curated scenery safety must still use actual rendered bounds');
assert.match(airportWorld, /radius: Math\.hypot\(size\.x, size\.z\) \* 0\.5/, 'Scenery footprint safety must include both width and depth');
assert.match(airportWorld, /new THREE\.SphereGeometry\(1, 12, 7\)/, 'Distant scenery must use broad hills instead of the old giant pyramid silhouettes');
assert.doesNotMatch(airportWorld, /setAnimationLoop|requestAnimationFrame|setInterval/, 'Airport scenery must add no independent animation loop');

assert.match(worldRender, /const worldSamples = samples\.slice\(\)/, 'Countryside async scenery must retain immutable Track 1 samples during an early track switch');
assert.match(worldRender, /samples: worldSamples/, 'Late Countryside art modules must receive the snapshot rather than the mutable active track array');

console.log('TURN r50 multi-track selection, viewport-safe chooser, redesigned Airport scenery and geometry-revision rivals passed.');

function makeSamples(points) {
  return points.map(([x, z]) => ({ point: { x, z } }));
}

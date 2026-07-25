import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTrackSpatialIndex, findNearestTrackBruteForce } from '../../turn/race/track-spatial-index.js';
import { AIRPORT_HAIRPIN_RUNOFF_ZONES, isForgivingTrackSurface } from '../../turn/tracks/airport-runoff.js';
import {
  TRACK_DEFINITIONS,
  getTrackFreeRoamDistance,
  getTrackStorageRevision
} from '../../turn/tracks/definitions.js';
import {
  clearRivalsState,
  getStoredBestLap,
  getStoredBestTime,
  saveRivalsState
} from '../../turn/race/rival-storage.js';

assert.deepEqual(
  TRACK_DEFINITIONS.map(({ id, difficulty, storageRevision, freeRoamDistance }) => ({
    id,
    difficulty,
    storageRevision,
    freeRoamDistance
  })),
  [
    { id: 'countryside', difficulty: 'EASY', storageRevision: 'countryside', freeRoamDistance: 170 },
    { id: 'airport', difficulty: 'MEDIUM', storageRevision: 'airport-r50', freeRoamDistance: 95 },
    { id: 'cliffside', difficulty: 'MEDIUM', storageRevision: 'cliffside-r68', freeRoamDistance: 15.7 }
  ],
  'Every track must define identity, difficulty, storage revision and world envelope in one source of truth'
);
assert.equal(getTrackStorageRevision('airport'), 'airport-r50');
assert.equal(getTrackStorageRevision('cliffside'), 'cliffside-r68');
assert.equal(getTrackStorageRevision('future-track'), 'future-track', 'Unregistered future storage must not collapse into another track namespace');
assert.equal(getTrackFreeRoamDistance('airport'), 95);
assert.equal(getTrackFreeRoamDistance('cliffside'), 15.7);
assert.equal(getTrackFreeRoamDistance('future-track'), 170, 'Unknown tracks must keep the safe Countryside fallback');

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
    competitorLaps: [
      { time: 13.18, carId: 'sedan', frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10 })) },
      {
        time: 12.73,
        carId: 'monster-truck',
        carColor: '#ff4fa3',
        carSecondaryColor: '#abcdef',
        frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10 }))
      }
    ]
  };
  const airportState = {
    trackId: 'airport',
    competitorLaps: [{ time: 22.42, carId: 'race-future', frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10 })) }]
  };

  assert.equal(saveRivalsState(countrysideState), true);
  assert.equal(saveRivalsState(airportState), true);
  assert.ok(storage.has('turn-personal-rivals-v1'), 'Track 1 must preserve the existing rival storage key');
  assert.ok(storage.has('turn-personal-rivals-v1:airport-r50'), 'Redesigned Airport rivals must use the geometry revision from its track definition');
  assert.equal(storage.has('turn-personal-rivals-v1:airport'), false, 'Old Airport ghosts must not leak onto the redesigned course');
  assert.equal(getStoredBestTime('countryside'), 12.73);
  assert.equal(getStoredBestTime('airport'), 22.42);
  assert.deepEqual(
    getStoredBestLap('countryside'),
    {
      time: 12.73,
      carId: 'monster-truck',
      carColor: '#ff4fa3',
      carSecondaryColor: '#abcdef'
    },
    'Track 1 best summary must preserve the exact car and paint that set the fastest time'
  );
  assert.deepEqual(
    getStoredBestLap('airport'),
    { time: 22.42, carId: 'race-future' },
    'Legacy records without paint metadata must keep their compact backward-compatible summary'
  );

  clearRivalsState(airportState);
  assert.equal(storage.has('turn-personal-rivals-v1:airport-r50'), false, 'Reset Rivals on Airport must clear only its configured geometry namespace');
  assert.equal(storage.has('turn-personal-rivals-v1'), true, 'Reset Rivals on Airport must never erase countryside history');
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}

assert.equal(AIRPORT_HAIRPIN_RUNOFF_ZONES.length, 2, 'The tight Airport hairpin must receive two deliberate run-off bays');
assert.equal(isForgivingTrackSurface('airport', { x: 20, z: 54 }), true, 'The eastern run-off bay must provide normal road physics');
assert.equal(isForgivingTrackSurface('airport', { x: -20, z: 54 }), true, 'The western run-off bay must provide normal road physics');
assert.equal(isForgivingTrackSurface('airport', { x: 0, z: 78 }), false, 'The two bays must not connect into a broad shortcut across the hairpin island');
assert.equal(isForgivingTrackSurface('countryside', { x: 20, z: 54 }), false, 'Airport forgiveness must never leak onto Countryside');

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
assert.ok(spatialIndex.getStats().queryCount >= 1, 'Rebuilt track index diagnostics must restart and record new-track queries');

const [
  index,
  releaseSource,
  trackDefinitions,
  trackCatalog,
  trackRegistry,
  trackManager,
  trackSelect,
  trackSelectCss,
  lotWrapper,
  airportWorld,
  airportPolish,
  airportRunoff,
  airportRunoffWorld,
  physics,
  worldCollision,
  spatialSource,
  rivalStorage,
  hud,
  worldRender
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/track-select.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-world-r50.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-world-r51.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-runoff.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-world-r52.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/world-collision.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/track-spatial-index.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/hud.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (path) => `${path}?build=${release.cacheKey}`;

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.equal(imports['./tracks/catalog.js?build=20260722-r50'], releaseTarget('./tracks/catalog.js'), 'Existing track consumers must receive the current catalog');
assert.equal(imports['./tracks/catalog.js'], releaseTarget('./tracks/catalog.js'), 'New track modules must use a stable catalog specifier');
assert.equal(imports['./tracks/definitions.js'], releaseTarget('./tracks/definitions.js'), 'Track metadata must publish through the current release');
assert.equal(imports['./tracks/registry.js'], releaseTarget('./tracks/registry.js'), 'Track runtime contracts must publish through the current release');
assert.equal(imports['./tracks/track-manager.js?build=20260722-r52'], releaseTarget('./tracks/track-manager.js'), 'The Lot must receive the registry-driven manager');
assert.match(index, /Turn the device to steer/, 'Start copy must use device-neutral language');
assert.match(index, /Steering uses device rotation/, 'Status copy must use device-neutral language');

assert.match(trackDefinitions, /storageRevision: 'countryside'/, 'Countryside must explicitly own its stable storage namespace');
assert.match(trackDefinitions, /storageRevision: 'airport-r50'/, 'Airport must explicitly own its geometry revision');
assert.match(trackDefinitions, /storageRevision: 'cliffside-r68'/, 'Cliffside must explicitly own its geometry revision');
assert.match(trackDefinitions, /freeRoamDistance: 170/, 'Countryside must own its world envelope');
assert.match(trackDefinitions, /freeRoamDistance: 95/, 'Airport must own its world envelope');
assert.match(trackDefinitions, /freeRoamDistance: 15\.7/, 'Cliffside must own its curb-aligned containment envelope');
assert.match(trackDefinitions, /collisionProfile: \{/, 'Every definition must expose a collision profile');

assert.match(trackCatalog, /CONTROL_POINT_FACTORIES/, 'Geometry factories must remain separate from player-facing metadata');
assert.match(trackCatalog, /radiusX = 208 \+ Math\.sin\(angle \* 2 \+ 0\.35\) \* 20 \+ Math\.sin\(angle \* 3 - 0\.8\) \* 9/, 'Track 1 geometry generator must remain unchanged');
assert.match(trackCatalog, /radiusZ = 146 \+ Math\.cos\(angle \* 2 - 0\.4\) \* 14 \+ Math\.sin\(angle \* 3 \+ 0\.6\) \* 8/, 'Track 1 geometry generator must remain unchanged');
assert.match(trackCatalog, /\[25, 43\],[\s\S]*\[0, 22\],[\s\S]*\[-25, 43\]/, 'The service-road hairpin must retain its broad symmetric entry and exit');
assert.match(trackCatalog, /TRACK_DEFINITIONS\.map/, 'The geometry catalog must be generated from the shared track definitions');
assert.match(trackCatalog, /TRACK_SAMPLE_COUNT/, 'Both tracks must keep the verified shared sample count');

assert.match(trackRegistry, /TRACK_CATALOG\.map/, 'Every catalog entry must receive one runtime contract');
assert.match(trackRegistry, /createRuntime\(sampleCount = TRACK_SAMPLE_COUNT\)/, 'Every registered track must expose a runtime factory');
assert.match(trackRegistry, /installWorld,/, 'Every registered track must expose a world installer');
assert.match(trackRegistry, /isForgivingSurface/, 'Every registered track must expose its surface policy');
assert.match(trackRegistry, /collisionProfile/, 'The complete registry entry must retain the definition collision profile');
assert.match(trackRegistry, /installAirportWorld/, 'Airport art must remain behind its registry world installer');
assert.match(trackRegistry, /return initialWorld/, 'Countryside must participate in the same world-install contract without rebuilding its verified scene');

assert.match(lotWrapper, /track-manager\.js\?build=20260722-r52/, 'The Lot wrapper must retain its stable manager specifier');
assert.match(lotWrapper, /await chooseTrackBeforeLot\(\)/, 'Track selection must complete before The Lot opens');
assert.ok(lotWrapper.indexOf('await chooseTrackBeforeLot()') < lotWrapper.indexOf('showOriginalLot(options)'), 'The flow must remain TRACK → CAR → RACE');

assert.match(trackSelect, /CHOOSE YOUR TRACK/);
assert.match(trackSelect, /getStoredBestLap\(track\.id\)/, 'Selector cards must read the track-specific best lap summary');
assert.match(trackSelect, /renderBestCarThumbnail\(bestLap\)/, 'The selector must render the stored car and paint');
assert.match(trackSelectCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'The two launch tracks must present as peer choices');
assert.match(trackSelectCss, /@media \(max-height: 820px\) and \(orientation: landscape\)/, 'Landscape track selection must remain compact');

assert.match(trackManager, /getTrackRuntimeEntry/, 'The manager must resolve tracks through the runtime registry');
assert.match(trackManager, /const trackStates = new Map\(\)/, 'Installed track worlds and samples must use one generic cache');
assert.match(trackManager, /const nextTrack = getTrackRuntimeEntry\(nextTrackId\)/, 'Activation must begin with one complete registry entry');
assert.match(trackManager, /const nextState = ensureTrackState\(nextTrack, currentRuntime\)/, 'Activation must use the same state path for every track');
assert.match(trackManager, /entry\.createRuntime\(currentRuntime\.trackSampleCount \|\| 720\)/, 'New tracks must create samples through their own registry factory');
assert.match(trackManager, /entry\.installWorld\(\{/, 'New tracks must install scenery through their own registry hook');
assert.match(trackManager, /for \(const state of trackStates\.values\(\)\)/, 'World visibility must be generic across any number of tracks');
assert.match(trackManager, /__turnIsForgivingSurface = \(position\) => activeTrackEntry\(\)\.isForgivingSurface\(position\)/, 'Physics must read the active track surface policy');
assert.match(trackManager, /__turnGetCollisionProfile = \(\) => activeTrackEntry\(\)\.collisionProfile/, 'Physics must read the active track collision profile');
assert.doesNotMatch(trackManager, /nextTrackId === '(?:airport|cliffside)'|airportTrack|airportWorld|cliffsideTrack|cliffsideWorld|countrysideSamples/, 'The manager must contain no track-specific activation cases');
assert.doesNotMatch(trackManager, /setAnimationLoop|requestAnimationFrame|setInterval/, 'Track switching must not create another render loop');

assert.match(physics, /globalThis\.__turnIsForgivingSurface\?\.\(position\)/, 'The physics core must use the active registry surface predicate');
assert.match(physics, /globalThis\.__turnGetCollisionProfile\?\.\(\)/, 'The physics core must use the active registry collision profile');
assert.match(worldCollision, /getTrackFreeRoamDistance\(trackId\)/, 'World containment fallback must read track definitions instead of a second handwritten map');
assert.match(worldCollision, /TRACK_DEFINITIONS\.map/, 'The diagnostic world-distance export must be derived from definitions');

assert.match(spatialSource, /replaceSamples\(nextSamples\)/, 'The shared spatial index must expose a controlled rebuild hook');
assert.match(hud, /cached\.firstSample === firstSample/, 'The minimap cache must notice when the shared samples array is repopulated');
assert.match(rivalStorage, /getTrackStorageRevision\(normalizeTrackId\(trackId\)\)/, 'Rival storage must read geometry revisions from track definitions');
assert.doesNotMatch(rivalStorage, /TRACK_STORAGE_REVISIONS/, 'Rival storage must not maintain a second track revision map');

assert.match(airportWorld, /name = 'TURN Airport r50'/, 'The base Airport world must retain the successful r50 redesign');
assert.match(airportWorld, /makeStartFinishDistrict\(world, samples, trackWidth\)/, 'Airport must retain its designed start and finish district');
assert.match(airportWorld, /SUMMER_INDUSTRIAL_COMMIT = '0831a1937a59562b6165ccfab30f64f35c957b6f'/, 'Summer Engine art must stay pinned to its source revision');
assert.doesNotMatch(airportWorld, /setAnimationLoop|requestAnimationFrame|setInterval/, 'Airport scenery must add no independent animation loop');
assert.match(airportPolish, /panel\.rotation\.y \+= Math\.PI/, 'Airport signs must remain correctly faced');
assert.match(airportRunoff, /AIRPORT_HAIRPIN_RUNOFF_ZONES/, 'Forgiving surface geometry must remain shared by visuals and physics');
assert.match(airportRunoffWorld, /installHairpinRunoff\(world\)/, 'The forgiving zones must retain visible paved run-off surfaces');
assert.match(worldRender, /const worldSamples = samples\.slice\(\)/, 'Countryside async scenery must retain immutable samples during a switch');

console.log(`TURN ${release.id} generic track registry, isolated rivals and preserved course geometry passed.`);

function makeSamples(points) {
  return points.map(([x, z]) => ({ point: { x, z } }));
}

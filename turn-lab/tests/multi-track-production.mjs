import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTrackSpatialIndex, findNearestTrackBruteForce } from '../../turn/race/track-spatial-index.js';
import { AIRPORT_HAIRPIN_RUNOFF_ZONES, isForgivingTrackSurface } from '../../turn/tracks/airport-runoff.js';
import {
  TRACK_DEFINITIONS,
  TRACK_PLACEHOLDERS,
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
    id, difficulty, storageRevision, freeRoamDistance
  })),
  [
    { id: 'countryside', difficulty: 'EASY', storageRevision: 'countryside', freeRoamDistance: 170 },
    { id: 'airport', difficulty: 'MEDIUM', storageRevision: 'airport-r50', freeRoamDistance: 95 },
    { id: 'cliffside', difficulty: 'MEDIUM', storageRevision: 'cliffside-r68', freeRoamDistance: 22.2 },
    { id: 'harbor', difficulty: 'HARD', storageRevision: 'harbor-r80', freeRoamDistance: 20.5 }
  ],
  'Every track must define identity, difficulty, storage revision and world envelope in one source of truth'
);
assert.equal(TRACK_PLACEHOLDERS.length, 0, 'Track 4 is now Harbor rather than a locked placeholder');
assert.equal(getTrackStorageRevision('airport'), 'airport-r50');
assert.equal(getTrackStorageRevision('cliffside'), 'cliffside-r68');
assert.equal(getTrackStorageRevision('harbor'), 'harbor-r80');
assert.equal(getTrackStorageRevision('future-track'), 'future-track', 'Unregistered future storage must not collapse into another track namespace');
assert.equal(getTrackFreeRoamDistance('airport'), 95);
assert.equal(getTrackFreeRoamDistance('cliffside'), 22.2);
assert.equal(getTrackFreeRoamDistance('harbor'), 20.5);
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
  const harborState = {
    trackId: 'harbor',
    competitorLaps: [{ time: 38.61, carId: 'sports-hatchback', frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10 })) }]
  };

  assert.equal(saveRivalsState(countrysideState), true);
  assert.equal(saveRivalsState(airportState), true);
  assert.equal(saveRivalsState(harborState), true);
  assert.ok(storage.has('turn-personal-rivals-v1'));
  assert.ok(storage.has('turn-personal-rivals-v1:airport-r50'));
  assert.ok(storage.has('turn-personal-rivals-v1:harbor-r80'));
  assert.equal(getStoredBestTime('countryside'), 12.73);
  assert.equal(getStoredBestTime('airport'), 22.42);
  assert.equal(getStoredBestTime('harbor'), 38.61);
  assert.deepEqual(getStoredBestLap('countryside'), {
    time: 12.73,
    carId: 'monster-truck',
    carColor: '#ff4fa3',
    carSecondaryColor: '#abcdef'
  });
  assert.deepEqual(getStoredBestLap('airport'), { time: 22.42, carId: 'race-future' });
  assert.deepEqual(getStoredBestLap('harbor'), { time: 38.61, carId: 'sports-hatchback' });

  clearRivalsState(harborState);
  assert.equal(storage.has('turn-personal-rivals-v1:harbor-r80'), false, 'Reset Rivals on Harbor clears only Harbor history');
  assert.equal(storage.has('turn-personal-rivals-v1'), true, 'Reset Rivals on Harbor never erases Countryside history');
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}

assert.equal(AIRPORT_HAIRPIN_RUNOFF_ZONES.length, 2);
assert.equal(isForgivingTrackSurface('airport', { x: 20, z: 54 }), true);
assert.equal(isForgivingTrackSurface('airport', { x: -20, z: 54 }), true);
assert.equal(isForgivingTrackSurface('airport', { x: 0, z: 78 }), false);
assert.equal(isForgivingTrackSurface('harbor', { x: 20, z: 54 }), false, 'Airport forgiveness must not leak onto Harbor');

const trackA = makeSamples([[-20, 0], [0, 0], [20, 0], [40, 0]]);
const trackB = makeSamples([[0, 100], [20, 100], [40, 100], [60, 100]]);
const spatialIndex = createTrackSpatialIndex(trackA, { cellSize: 16 });
assert.equal(spatialIndex.find({ x: 3, z: 2 }).index, 1);
spatialIndex.replaceSamples(trackB);
const rebuilt = spatialIndex.find({ x: 19, z: 98 });
const brute = findNearestTrackBruteForce(trackB, { x: 19, z: 98 });
assert.equal(rebuilt.index, brute.index);
assert.equal(rebuilt.sample, trackB[brute.index]);

const [
  index, releaseSource, trackDefinitions, trackCatalog, trackRegistry, trackManager,
  trackSelect, trackSelectCss, lotWrapper, airportWorld, airportPolish,
  airportRunoff, airportRunoffWorld, harborLayout, harborWorld, physics,
  worldCollision, spatialSource, rivalStorage, hud, worldRender
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
  fs.readFile(new URL('../../turn/tracks/harbor-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/harbor-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/world-collision.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/track-spatial-index.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/hud.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText);
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (path) => `${path}?build=${release.cacheKey}`;

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.equal(imports['./tracks/catalog.js'], releaseTarget('./tracks/catalog.js'));
assert.equal(imports['./tracks/definitions.js'], releaseTarget('./tracks/definitions.js'));
assert.equal(imports['./tracks/registry.js'], releaseTarget('./tracks/registry.js'));
assert.equal(imports['./tracks/harbor-layout.js'], releaseTarget('./tracks/harbor-layout.js'));
assert.equal(imports['./tracks/harbor-world.js'], releaseTarget('./tracks/harbor-world.js'));
assert.match(index, /Turn the device to steer/);
assert.match(index, /Steering uses device rotation/);

for (const revision of ['countryside', 'airport-r50', 'cliffside-r68', 'harbor-r80']) {
  assert.match(trackDefinitions, new RegExp(`storageRevision: '${revision}'`));
}
assert.match(trackDefinitions, /id: 'harbor'[\s\S]*difficulty: 'HARD'/);
assert.match(trackDefinitions, /freeRoamDistance: 20\.5/);
assert.match(trackDefinitions, /const PLACEHOLDERS = \[\]/);
assert.match(trackCatalog, /HARBOR_CONTROL_POINTS\.map/);
assert.match(trackCatalog, /TRACK_DEFINITIONS\.map/);
assert.match(trackCatalog, /TRACK_SAMPLE_COUNT/);
assert.match(trackRegistry, /TRACK_CATALOG\.map/);
assert.match(trackRegistry, /installHarborWorld/);
assert.match(trackRegistry, /harbor\(\{ scene, samples, trackWidth \}\)/);
assert.match(trackRegistry, /isForgivingSurface/);
assert.match(trackRegistry, /collisionProfile/);
assert.match(trackManager, /const trackStates = new Map\(\)/);
assert.doesNotMatch(trackManager, /nextTrackId === '(?:airport|cliffside|harbor)'|harborTrack|harborSamples/, 'The manager remains generic');
assert.doesNotMatch(trackManager, /setAnimationLoop|requestAnimationFrame|setInterval/);
assert.match(lotWrapper, /await chooseTrackBeforeLot\(\)/);
assert.match(trackSelect, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)/);
assert.match(trackSelectCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);

assert.match(harborLayout, /closedCourse: true/);
assert.match(harborLayout, /switchbackCount: 3/);
assert.match(harborWorld, /name = 'TURN Harbor r80'/);
assert.match(harborWorld, /makeContainerYards\(world\)/);
assert.match(harborWorld, /makeHarborShips\(world\)/);
assert.match(harborWorld, /Ship Cargo A\/B and Boat Tug/);
assert.match(harborWorld, /new THREE\.InstancedMesh/);
assert.doesNotMatch(harborWorld, /setAnimationLoop|requestAnimationFrame|setInterval/);

assert.match(airportWorld, /name = 'TURN Airport r50'/);
assert.match(airportPolish, /panel\.rotation\.y \+= Math\.PI/);
assert.match(airportRunoff, /AIRPORT_HAIRPIN_RUNOFF_ZONES/);
assert.match(airportRunoffWorld, /installHairpinRunoff\(world\)/);
assert.match(physics, /globalThis\.__turnIsForgivingSurface\?\.\(position\)/);
assert.match(worldCollision, /TRACK_DEFINITIONS\.map/);
assert.match(spatialSource, /replaceSamples\(nextSamples\)/);
assert.match(hud, /cached\.firstSample === firstSample/);
assert.match(rivalStorage, /getTrackStorageRevision\(normalizeTrackId\(trackId\)\)/);
assert.match(worldRender, /const worldSamples = samples\.slice\(\)/);

console.log(`TURN ${release.id} four-track registry, isolated rivals and Harbor world passed.`);

function makeSamples(points) {
  return points.map(([x, z]) => ({ point: { x, z } }));
}

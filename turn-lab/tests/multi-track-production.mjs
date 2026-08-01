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
import { HARBOR_CONTROL_POINTS } from '../../turn/tracks/harbor-layout.js';
import {
  MIDNIGHT_CITY_CONTROL_POINTS,
  MIDNIGHT_CITY_LAYOUT_RULES
} from '../../turn/tracks/midnight-city-layout.js';
import {
  clearRivalsState,
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
    { id: 'cliffside', difficulty: 'MEDIUM', storageRevision: 'cliffside-r68', freeRoamDistance: 22.2 },
    { id: 'harbor', difficulty: 'HARD', storageRevision: 'harbor-r80', freeRoamDistance: 170 },
    { id: 'midnight-city', difficulty: 'HARD', storageRevision: 'midnight-city-r2', freeRoamDistance: 34 }
  ],
  'Every playable track must own identity, difficulty, record namespace and containment in one source of truth'
);
assert.deepEqual(
  TRACK_PLACEHOLDERS.map(({ id, name, locked }) => ({ id, name, locked })),
  [{ id: 'track-6-tba', name: 'TBA', locked: true }],
  'Track 6 must remain a visible but non-playable teaser'
);
assert.equal(getTrackStorageRevision('midnight-city'), 'midnight-city-r2');
assert.equal(getTrackFreeRoamDistance('midnight-city'), 34);
assert.equal(getTrackStorageRevision('future-track'), 'future-track');
assert.equal(getTrackFreeRoamDistance('future-track'), 170);

const midnightLength = closedPolylineLength(MIDNIGHT_CITY_CONTROL_POINTS);
const harborLength = closedPolylineLength(HARBOR_CONTROL_POINTS);
assert.ok(
  midnightLength >= harborLength * 2,
  `Midnight City must remain more than twice as long as Harbor (${midnightLength.toFixed(0)} vs ${harborLength.toFixed(0)})`
);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.cityGridRows, 5);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.outerRingReturn, true);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.districtCount, 4);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.districtAvenues, true);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.repeatedFullWidthSerpentine, false);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.buildingsShapeRoute, true);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.minimumVisualHairpinRadius, 30);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.targetLengthComparedWithHarbor, 'at-least-two-times');
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.verticalRoadOverlap, false);
assert.equal(findProperIntersections(MIDNIGHT_CITY_CONTROL_POINTS).length, 0, 'Midnight City control streets must not cross each other');
assert.ok(
  maximumControlTurn(MIDNIGHT_CITY_CONTROL_POINTS) < 110,
  'Midnight City must not contain a near-reversal that makes offset track borders fold into themselves'
);

const storage = new Map();
const originalLocalStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

try {
  const states = [
    { trackId: 'countryside', time: 12.73, key: 'turn-personal-rivals-v1' },
    { trackId: 'airport', time: 22.42, key: 'turn-personal-rivals-v1:airport-r50' },
    { trackId: 'harbor', time: 38.61, key: 'turn-personal-rivals-v1:harbor-r80' },
    { trackId: 'midnight-city', time: 104.82, key: 'turn-personal-rivals-v1:midnight-city-r2' }
  ];

  for (const entry of states) {
    const state = {
      trackId: entry.trackId,
      competitorLaps: [{
        time: entry.time,
        carId: 'hatchback-sports',
        frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10, p: index / 24 }))
      }]
    };
    assert.equal(saveRivalsState(state), true);
    assert.ok(storage.has(entry.key), `${entry.trackId} must use its own rival storage key`);
    assert.equal(getStoredBestTime(entry.trackId), entry.time);
  }

  clearRivalsState({ trackId: 'midnight-city', competitorLaps: [] });
  assert.equal(storage.has('turn-personal-rivals-v1:midnight-city-r2'), false);
  assert.equal(storage.has('turn-personal-rivals-v1:harbor-r80'), true, 'Resetting Midnight City must preserve Harbor records');
  assert.equal(storage.has('turn-personal-rivals-v1'), true, 'Resetting Midnight City must preserve Countryside records');
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}

assert.equal(AIRPORT_HAIRPIN_RUNOFF_ZONES.length, 2);
assert.equal(isForgivingTrackSurface('airport', { x: 20, z: 54 }), true);
assert.equal(isForgivingTrackSurface('midnight-city', { x: 20, z: 54 }), false, 'Airport runoff must never leak into Midnight City');

const trackA = makeSamples([[-20, 0], [0, 0], [20, 0], [40, 0]]);
const trackB = makeSamples([[0, 100], [20, 100], [40, 100], [60, 100]]);
const spatialIndex = createTrackSpatialIndex(trackA, { cellSize: 16 });
spatialIndex.replaceSamples(trackB);
const rebuilt = spatialIndex.find({ x: 19, z: 98 });
const brute = findNearestTrackBruteForce(trackB, { x: 19, z: 98 });
assert.equal(rebuilt.index, brute.index, 'The spatial index must rebuild exactly for a different course length');

const [definitions, catalog, registry, manager, world, home] = await Promise.all([
  fs.readFile(new URL('../../turn/tracks/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/midnight-city-world-r4.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home.js', import.meta.url), 'utf8')
]);

assert.match(definitions, /id: 'midnight-city'[\s\S]*difficulty: 'HARD'/);
assert.match(definitions, /storageRevision: 'midnight-city-r2'/);
assert.match(definitions, /sampleCount: 1080/);
assert.match(definitions, /fogNear: 250[\s\S]*fogFar: 880/);
assert.match(definitions, /id: 'track-6-tba'[\s\S]*locked: true/);
assert.match(catalog, /MIDNIGHT_CITY_CONTROL_POINTS\.map/);
assert.match(registry, /midnight-city-world-r4\.js\?build=20260801-r4/);
assert.match(registry, /definition\.sampleCount \|\| sampleCount/);
assert.doesNotMatch(manager, /nextTrackId === 'midnight-city'/, 'The generic track manager must not gain a Midnight City special case');
assert.match(manager, /lighting\.hemisphereIntensity \?\? 2\.7/);
assert.match(manager, /track\.fogNear/);
assert.match(world, /removeThickStreetBorders/);
assert.match(world, /installDistrictBuildings/);
assert.match(world, /installWindowBands/);
assert.match(world, /installLampPostPools/);
assert.match(world, /new THREE\.InstancedMesh/);
assert.match(world, /new THREE\.CanvasTexture/);
assert.match(world, /externalAssetFiles: false/);
assert.doesNotMatch(world, /setAnimationLoop|requestAnimationFrame|setInterval/, 'Static city scenery must not add an independent loop');
assert.match(home, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)/, 'Home must render the playable city and TBA teaser from the shared catalog');

console.log(`TURN Midnight City passed at ${midnightLength.toFixed(0)} units, ${(midnightLength / harborLength).toFixed(1)}× Harbor.`);

function closedPolylineLength(points) {
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    length += Math.hypot(next[0] - current[0], next[2] - current[2]);
  }
  return length;
}

function maximumControlTurn(points) {
  let maximum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const incoming = [current[0] - previous[0], current[2] - previous[2]];
    const outgoing = [next[0] - current[0], next[2] - current[2]];
    const incomingLength = Math.hypot(...incoming);
    const outgoingLength = Math.hypot(...outgoing);
    const cosine = (
      incoming[0] * outgoing[0] + incoming[1] * outgoing[1]
    ) / Math.max(1e-9, incomingLength * outgoingLength);
    maximum = Math.max(maximum, Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI);
  }
  return maximum;
}

function makeSamples(points) {
  return points.map(([x, z]) => ({
    point: { x, y: 0, z },
    tangent: { x: 1, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 }
  }));
}

function findProperIntersections(points) {
  const intersections = [];
  for (let first = 0; first < points.length; first += 1) {
    const a = points[first];
    const b = points[(first + 1) % points.length];
    for (let second = first + 2; second < points.length; second += 1) {
      if ((second + 1) % points.length === first) continue;
      const c = points[second];
      const d = points[(second + 1) % points.length];
      if (segmentsProperlyIntersect(a, b, c, d)) intersections.push([first, second]);
    }
  }
  return intersections;
}

function segmentsProperlyIntersect(a, b, c, d) {
  const first = orientation(a, b, c) * orientation(a, b, d);
  const second = orientation(c, d, a) * orientation(c, d, b);
  return first < -1e-8 && second < -1e-8;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  TRACK_DEFINITIONS,
  TRACK_PLACEHOLDERS,
  getTrackStorageRevision
} from '../turn/tracks/definitions.js';
import {
  CLIFFSIDE_CONTROL_POINTS,
  CLIFFSIDE_LAYOUT_RULES
} from '../turn/tracks/cliffside-layout.js';
import {
  clearRivalsState,
  getStoredBestLap,
  saveRivalsState
} from '../turn/race/rival-storage.js';

const AIRPORT_CONTROL_POINTS = [
  [-205, 0, -126], [-120, 0, -138], [-20, 0, -142], [90, 0, -140],
  [175, 0, -128], [214, 0, -100], [232, 0, -58], [232, 0, -12],
  [218, 0, 34], [192, 0, 70], [154, 0, 98], [110, 0, 118],
  [75, 0, 120], [55, 0, 108], [42, 0, 88], [32, 0, 65],
  [25, 0, 43], [0, 0, 22], [-25, 0, 43], [-32, 0, 65],
  [-42, 0, 88], [-55, 0, 108], [-85, 0, 121], [-128, 0, 126],
  [-168, 0, 112], [-204, 0, 84], [-228, 0, 45], [-236, 0, 2],
  [-229, 0, -45], [-215, 0, -88]
];

assert.equal(TRACK_DEFINITIONS.length, 5, 'TURN must expose five playable tracks');
assert.deepEqual(
  TRACK_DEFINITIONS.map(({ id, difficulty }) => ({ id, difficulty })),
  [
    { id: 'countryside', difficulty: 'EASY' },
    { id: 'airport', difficulty: 'MEDIUM' },
    { id: 'cliffside', difficulty: 'MEDIUM' },
    { id: 'harbor', difficulty: 'HARD' },
    { id: 'midnight-city', difficulty: 'HARD' }
  ]
);
assert.deepEqual(
  TRACK_PLACEHOLDERS.map(({ id, name, locked }) => ({ id, name, locked })),
  [{ id: 'track-6-tba', name: 'TBA', locked: true }],
  'The sixth card must remain a locked teaser'
);
assert.equal(getTrackStorageRevision('cliffside'), 'cliffside-r68');
assert.equal(CLIFFSIDE_LAYOUT_RULES.minimumTurnRadiusComparedWithAirport, 'not-smaller');
assert.equal(CLIFFSIDE_LAYOUT_RULES.verticalRoadOverlap, false);

const cliffsideSamples = sampleCentripetalClosed(CLIFFSIDE_CONTROL_POINTS, 20);
const airportSamples = sampleCentripetalClosed(AIRPORT_CONTROL_POINTS, 20);
const cliffsideRadius = minimumHorizontalRadius(cliffsideSamples);
const airportRadius = minimumHorizontalRadius(airportSamples);
assert.ok(Number.isFinite(cliffsideRadius) && Number.isFinite(airportRadius));
assert.ok(cliffsideRadius >= airportRadius * 1.5, 'Cliffside must remain flowing rather than gaining difficulty from another hairpin');

const elevations = cliffsideSamples.map((point) => point[1]);
const minimumElevation = Math.min(...elevations);
const maximumElevation = Math.max(...elevations);
assert.ok(minimumElevation >= CLIFFSIDE_LAYOUT_RULES.minimumElevation - 0.1);
assert.ok(maximumElevation <= CLIFFSIDE_LAYOUT_RULES.maximumElevation + 0.1);
assert.ok(maximumElevation - minimumElevation >= 20);
assert.equal(findProperIntersections(cliffsideSamples).length, 0, 'Cliffside road sections must never overlap in X/Z');

const storage = new Map();
const originalLocalStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

try {
  const cliffsideState = {
    trackId: 'cliffside',
    competitorLaps: [{
      time: 31.24,
      carId: 'suv',
      carColor: '#ff6b6b',
      carSecondaryColor: '#fff8e8',
      frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10, p: index / 24 }))
    }]
  };
  assert.equal(saveRivalsState(cliffsideState), true);
  assert.ok(storage.has('turn-personal-rivals-v1:cliffside-r68'));
  assert.deepEqual(getStoredBestLap('cliffside'), {
    time: 31.24,
    carId: 'suv',
    carColor: '#ff6b6b',
    carSecondaryColor: '#fff8e8'
  });
  assert.equal(storage.has('turn-personal-rivals-v1:midnight-city-r1'), false);
  clearRivalsState(cliffsideState, { trackId: 'cliffside' });
  assert.equal(storage.has('turn-personal-rivals-v1:cliffside-r68'), false);
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}

const [catalogSource, registrySource, managerSource, worldSource, selectorSource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/cliffside-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8')
]);

assert.match(catalogSource, /CLIFFSIDE_CONTROL_POINTS\.map/);
assert.match(catalogSource, /MIDNIGHT_CITY_CONTROL_POINTS\.map/);
assert.match(catalogSource, /TRACK_SELECTION_CATALOG = Object\.freeze/);
assert.match(registrySource, /installCliffsideWorld/);
assert.match(registrySource, /installMidnightCityWorld/);
assert.doesNotMatch(managerSource, /nextTrackId === 'cliffside'|nextTrackId === 'midnight-city'/);
assert.match(worldSource, /sample\.point\.y \+ ROAD_HEIGHT/);
assert.match(worldSource, /trackPitch\(sample\)/);
assert.match(worldSource, /new THREE\.InstancedMesh/);
assert.doesNotMatch(worldSource, /setAnimationLoop|requestAnimationFrame|setInterval/);
assert.match(selectorSource, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)/);
assert.match(selectorSource, /\.track-card:not\(\[disabled\]\)/);

console.log(
  `TURN Cliffside passed within the five-track lineup: radius ${cliffsideRadius.toFixed(2)}, elevation ${minimumElevation.toFixed(1)} to ${maximumElevation.toFixed(1)}.`
);

function sampleCentripetalClosed(controlPoints, subdivisions) {
  const points = controlPoints.map((point) => point.map(Number));
  const samples = [];
  for (let index = 0; index < points.length; index += 1) {
    const p0 = points[(index - 1 + points.length) % points.length];
    const p1 = points[index];
    const p2 = points[(index + 1) % points.length];
    const p3 = points[(index + 2) % points.length];
    const t0 = 0;
    const t1 = knot(t0, p0, p1);
    const t2 = knot(t1, p1, p2);
    const t3 = knot(t2, p2, p3);

    for (let step = 0; step < subdivisions; step += 1) {
      const t = t1 + (t2 - t1) * (step / subdivisions);
      const a1 = interpolatePoint(p0, p1, t0, t1, t);
      const a2 = interpolatePoint(p1, p2, t1, t2, t);
      const a3 = interpolatePoint(p2, p3, t2, t3, t);
      const b1 = interpolatePoint(a1, a2, t0, t2, t);
      const b2 = interpolatePoint(a2, a3, t1, t3, t);
      samples.push(interpolatePoint(b1, b2, t1, t2, t));
    }
  }
  return samples;
}

function knot(previous, a, b) {
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return previous + Math.sqrt(distance);
}

function interpolatePoint(a, b, ta, tb, t) {
  const span = Math.max(1e-9, tb - ta);
  const left = (tb - t) / span;
  const right = (t - ta) / span;
  return [
    a[0] * left + b[0] * right,
    a[1] * left + b[1] * right,
    a[2] * left + b[2] * right
  ];
}

function minimumHorizontalRadius(samples) {
  let minimum = Infinity;
  for (let index = 0; index < samples.length; index += 1) {
    const a = samples[(index - 1 + samples.length) % samples.length];
    const b = samples[index];
    const c = samples[(index + 1) % samples.length];
    const ab = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const bc = Math.hypot(c[0] - b[0], c[2] - b[2]);
    const ca = Math.hypot(a[0] - c[0], a[2] - c[2]);
    const twiceArea = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]));
    if (twiceArea <= 1e-8) continue;
    minimum = Math.min(minimum, (ab * bc * ca) / (2 * twiceArea));
  }
  return minimum;
}

function findProperIntersections(samples) {
  const intersections = [];
  for (let first = 0; first < samples.length; first += 1) {
    const a = samples[first];
    const b = samples[(first + 1) % samples.length];
    for (let second = first + 2; second < samples.length; second += 1) {
      if ((second + 1) % samples.length === first) continue;
      const c = samples[second];
      const d = samples[(second + 1) % samples.length];
      const firstOrientation = orientation(a, b, c) * orientation(a, b, d);
      const secondOrientation = orientation(c, d, a) * orientation(c, d, b);
      if (firstOrientation < -1e-8 && secondOrientation < -1e-8) intersections.push([first, second]);
    }
  }
  return intersections;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}

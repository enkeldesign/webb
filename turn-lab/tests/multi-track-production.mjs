import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTrackSpatialIndex, findNearestTrackBruteForce } from '../../turn/race/track-spatial-index.js';
import { AIRPORT_HAIRPIN_RUNOFF_ZONES, isForgivingTrackSurface } from '../../turn/tracks/airport-runoff.js';
import {
  applyContextualRoadEdges,
  ROAD_EDGE_COLORS,
  ROAD_EDGE_CONTOURS
} from '../../turn/tracks/contextual-road-edges.js';
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
  MOUNTAIN_CONTROL_POINTS,
  MOUNTAIN_LAYOUT_RULES
} from '../../turn/tracks/mountain-layout.js';
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
    { id: 'midnight-city', difficulty: 'HARD', storageRevision: 'midnight-city-r2', freeRoamDistance: 34 },
    { id: 'mountain', difficulty: 'HARD', storageRevision: 'mountain-r3-start-seam', freeRoamDistance: 18.2 }
  ],
  'Every playable track must own identity, difficulty, record namespace and containment in one source of truth'
);
assert.deepEqual(TRACK_PLACEHOLDERS, [], 'Track 6 must be a real playable MOUNTAIN track rather than the old TBA teaser');
assert.equal(getTrackStorageRevision('midnight-city'), 'midnight-city-r2');
assert.equal(getTrackFreeRoamDistance('midnight-city'), 34);
assert.equal(getTrackStorageRevision('mountain'), 'mountain-r3-start-seam');
assert.equal(getTrackFreeRoamDistance('mountain'), 18.2);
assert.equal(getTrackStorageRevision('future-track'), 'future-track');
assert.equal(getTrackFreeRoamDistance('future-track'), 170);

assert.deepEqual(
  ROAD_EDGE_COLORS,
  { countryside: '#ffffff', airport: '#ffbd12', cliffside: '#ffffff', harbor: '#ffbd12' },
  'Airport and Harbor must use TURN profile yellow while road-like tracks keep one solid contextual edge color'
);
assert.deepEqual(Object.keys(ROAD_EDGE_CONTOURS), ['airport', 'cliffside', 'harbor']);
for (const [trackId, contour] of Object.entries(ROAD_EDGE_CONTOURS)) {
  assert.ok(contour.edgeWidth > 1.5, `${trackId} contour must begin outside its colored road edge`);
  assert.ok(contour.contourWidth >= 0.5 && contour.contourWidth <= 0.8, `${trackId} black contour must stay visually subordinate`);
}

const contextualEdgeCases = [
  ['countryside', [0xe63946, 0xfff8e8]], ['airport', [0xff5f67, 0xfff8e8]],
  ['cliffside', [0xff5f67, 0xfff8e8]], ['harbor', [0xf5c542, 0x08090a]]
];
for (const [trackId, sourcePalette] of contextualEdgeCases) {
  const edgeColors = mockVertexColors(sourcePalette);
  const roadColors = mockVertexColors([0x34383d, 0x4a4f55]);
  const edge = { geometry: { getAttribute(name) { return name === 'color' ? edgeColors : null; } }, userData: {} };
  const road = { geometry: { getAttribute(name) { return name === 'color' ? roadColors : null; } }, userData: {} };
  const world = { traverse(callback) { callback(edge); callback(road); } };
  assert.equal(applyContextualRoadEdges(world, trackId), 1);
  assert.equal(edge.userData.turnContextualRoadEdge, trackId);
  assert.equal(road.userData.turnContextualRoadEdge, undefined);
  const target = linearRgb(Number.parseInt(ROAD_EDGE_COLORS[trackId].slice(1), 16));
  for (let index = 0; index < edgeColors.count; index += 1) {
    assert.ok(Math.abs(edgeColors.getX(index) - target.r) < 1e-4);
    assert.ok(Math.abs(edgeColors.getY(index) - target.g) < 1e-4);
    assert.ok(Math.abs(edgeColors.getZ(index) - target.b) < 1e-4);
  }
}
assert.equal(ROAD_EDGE_COLORS['midnight-city'], undefined);
assert.equal(ROAD_EDGE_COLORS.mountain, undefined);
assert.equal(ROAD_EDGE_CONTOURS.countryside, undefined);
assert.equal(ROAD_EDGE_CONTOURS['midnight-city'], undefined);
assert.equal(ROAD_EDGE_CONTOURS.mountain, undefined);

const midnightLength = closedPolylineLength(MIDNIGHT_CITY_CONTROL_POINTS);
const harborLength = closedPolylineLength(HARBOR_CONTROL_POINTS);
const mountainLength = closedPolylineLength(MOUNTAIN_CONTROL_POINTS);
assert.ok(midnightLength >= harborLength * 2);
assert.ok(mountainLength > 3000, `Long Mountain route too short: ${mountainLength.toFixed(0)}`);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.cityGridRows, 5);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.outerRingReturn, true);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.districtCount, 4);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.districtAvenues, true);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.repeatedFullWidthSerpentine, false);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.buildingsShapeRoute, true);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.minimumVisualHairpinRadius, 30);
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.targetLengthComparedWithHarbor, 'at-least-two-times');
assert.equal(MIDNIGHT_CITY_LAYOUT_RULES.verticalRoadOverlap, false);
assert.equal(findProperIntersections(MIDNIGHT_CITY_CONTROL_POINTS).length, 0);
assert.ok(maximumControlTurn(MIDNIGHT_CITY_CONTROL_POINTS) < 110);
assert.equal(findProperIntersections(MOUNTAIN_CONTROL_POINTS).length, 0);
assert.equal(MOUNTAIN_LAYOUT_RULES.minimumElevation, 0);
assert.equal(MOUNTAIN_LAYOUT_RULES.maximumElevation, 49);
assert.equal(MOUNTAIN_LAYOUT_RULES.snowLineElevation, 37);
assert.equal(MOUNTAIN_LAYOUT_RULES.noDropCourse, true);
assert.equal(MOUNTAIN_LAYOUT_RULES.targetLength, 'long-course-about-2.1-times-production-mountain');
assert.ok(maximumControlTurn(MOUNTAIN_CONTROL_POINTS) < 100);

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
    { trackId: 'midnight-city', time: 104.82, key: 'turn-personal-rivals-v1:midnight-city-r2' },
    { trackId: 'mountain', time: 98.14, key: 'turn-personal-rivals-v1:mountain-r3-start-seam' }
  ];
  for (const entry of states) {
    const state = { trackId: entry.trackId, competitorLaps: [{ time: entry.time, carId: 'hatchback-sports', frames: Array.from({ length: 25 }, (_, index) => ({ t: index / 10, p: index / 24 })) }] };
    assert.equal(saveRivalsState(state), true);
    assert.ok(storage.has(entry.key));
    assert.equal(getStoredBestTime(entry.trackId), entry.time);
  }
  clearRivalsState({ trackId: 'midnight-city', competitorLaps: [] });
  assert.equal(storage.has('turn-personal-rivals-v1:midnight-city-r2'), false);
  assert.equal(storage.has('turn-personal-rivals-v1:harbor-r80'), true);
  assert.equal(storage.has('turn-personal-rivals-v1:mountain-r3-start-seam'), true);
  assert.equal(storage.has('turn-personal-rivals-v1:mountain-r2-long'), false,
    'The smoothed MOUNTAIN must never reinterpret or overwrite pre-seam long-course rivals');
  assert.equal(storage.has('turn-personal-rivals-v1:mountain-r1'), false,
    'The promoted MOUNTAIN must never migrate or overwrite the old short-course namespace');
  assert.equal(storage.has('turn-personal-rivals-v1'), true);
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}

assert.equal(AIRPORT_HAIRPIN_RUNOFF_ZONES.length, 2);
assert.equal(isForgivingTrackSurface('airport', { x: 20, z: 54 }), true);
assert.equal(isForgivingTrackSurface('midnight-city', { x: 20, z: 54 }), false);
assert.equal(isForgivingTrackSurface('mountain', { x: 20, z: 54 }), false);

const trackA = makeSamples([[-20, 0], [0, 0], [20, 0], [40, 0]]);
const trackB = makeSamples([[0, 100], [20, 100], [40, 100], [60, 100]]);
const spatialIndex = createTrackSpatialIndex(trackA, { cellSize: 16 });
spatialIndex.replaceSamples(trackB);
assert.equal(spatialIndex.find({ x: 19, z: 98 }).index, findNearestTrackBruteForce(trackB, { x: 19, z: 98 }).index);

const [
  definitions,
  definitionsBase,
  catalog,
  registry,
  manager,
  cityWorld,
  mountainWorld,
  mountainLongWorld,
  mountainExtension,
  mountainTerrain,
  mountainScenery,
  mountainPolish,
  home
] = await Promise.all([
  fs.readFile(new URL('../../turn/tracks/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/definitions-base.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/midnight-city-world-r7.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/mountain-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/mountain-world-long.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/mountain-long-extension-r1.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/mountain-world-r3-terrain.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/mountain-world-r3-scenery.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/mountain-world-r3-polish.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home.js', import.meta.url), 'utf8')
]);
assert.match(definitionsBase, /id: 'midnight-city'[\s\S]*difficulty: 'HARD'/);
assert.match(definitionsBase, /storageRevision: 'midnight-city-r2'/);
assert.match(definitionsBase, /id: 'mountain'[\s\S]*difficulty: 'HARD'/);
assert.match(definitions, /storageRevision: 'mountain-r3-start-seam'/);
assert.match(definitions, /sampleCount: 2160/);
assert.doesNotMatch(definitionsBase, /id: 'track-6-tba'/);
assert.match(catalog, /MIDNIGHT_CITY_CONTROL_POINTS\.map/);
assert.match(catalog, /MOUNTAIN_CONTROL_POINTS\.map/);
assert.match(registry, /mountain-world-long\.js\?revision=mountain-long-r1/);
assert.match(registry, /definition\.sampleCount \|\| sampleCount/);
assert.doesNotMatch(manager, /nextTrackId === 'mountain'/);
assert.match(manager, /track\.fogNear/);
assert.match(cityWorld, /installMidnightCityWorld as installMidnightCityWorldR6/);
assert.match(cityWorld, /new THREE\.InstancedMesh/);
assert.doesNotMatch(cityWorld, /setAnimationLoop|requestAnimationFrame|setInterval/);
assert.match(mountainWorld, /ground: 'continuous-snow-and-granite-terrain-body'/);
assert.match(mountainWorld, /retainingFoundation: '4\.6m-granite-skirt'/);
assert.match(mountainWorld, /visibleWaterfallCurtain: true/);
assert.match(mountainLongWorld, /installBaseMountainWorld/);
assert.match(mountainLongWorld, /installMountainLongExtension/);
assert.match(mountainLongWorld, /BASE_WORLD_SAMPLE_COUNT = 1080/);
assert.match(mountainExtension, /installMountainLongExtension/);
assert.match(mountainExtension, /PORTAL_ROCK_GREY = 0x7d878d/);
assert.match(mountainExtension, /dynamicPointLightsAdded: 0/);
assert.match(mountainTerrain, /Mountain continuous terrain body r3/);
assert.match(mountainTerrain, /Mountain opaque roadbed side wall r3/);
assert.match(mountainTerrain, /Mountain closed roadbed underside r3/);
assert.match(mountainTerrain, /Mountain solid white road edge r3/);
assert.match(mountainTerrain, /Mountain black outer road contour r3/);
assert.match(mountainTerrain, /Mountain integrated snowy peak backdrop r3/);
assert.match(mountainScenery, /Mountain Kenney Holiday cabin prefab r3/);
assert.match(mountainScenery, /Mountain river channel bed r3/);
assert.match(mountainScenery, /Mountain terrain-bounded waterfall lake r3/);
assert.match(mountainScenery, /fountain-round-detail\.glb/);
assert.match(mountainScenery, /stall-green\.glb/);
assert.doesNotMatch(mountainScenery, /windmill\.glb/);
assert.match(mountainPolish, /Mountain deep retaining road foundation r3/);
assert.match(mountainPolish, /Mountain visible waterfall curtain r3/);
assert.match(mountainPolish, /Mountain river waterfall spillway r3/);
for (const source of [mountainWorld, mountainLongWorld, mountainExtension, mountainTerrain, mountainScenery, mountainPolish]) {
  assert.doesNotMatch(source, /setAnimationLoop|requestAnimationFrame|setInterval/);
}
assert.match(home, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)/);

console.log(`TURN six-track runtime passed: Midnight City ${midnightLength.toFixed(0)} units, long Mountain ${mountainLength.toFixed(0)} units.`);

function closedPolylineLength(points) {
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]; const next = points[(index + 1) % points.length];
    length += Math.hypot(next[0] - current[0], next[2] - current[2]);
  }
  return length;
}
function maximumControlTurn(points) {
  let maximum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length]; const current = points[index]; const next = points[(index + 1) % points.length];
    const incoming = [current[0] - previous[0], current[2] - previous[2]]; const outgoing = [next[0] - current[0], next[2] - current[2]];
    const cosine = (incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) / Math.max(1e-9, Math.hypot(...incoming) * Math.hypot(...outgoing));
    maximum = Math.max(maximum, Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI);
  }
  return maximum;
}
function makeSamples(points) { return points.map(([x, z]) => ({ point: { x, y: 0, z }, tangent: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } })); }
function findProperIntersections(points) {
  const intersections = [];
  for (let first = 0; first < points.length; first += 1) {
    const a = points[first]; const b = points[(first + 1) % points.length];
    for (let second = first + 2; second < points.length; second += 1) {
      if ((second + 1) % points.length === first) continue;
      const c = points[second]; const d = points[(second + 1) % points.length];
      if (segmentsProperlyIntersect(a, b, c, d)) intersections.push([first, second]);
    }
  }
  return intersections;
}
function segmentsProperlyIntersect(a, b, c, d) { return orientation(a, b, c) * orientation(a, b, d) < -1e-8 && orientation(c, d, a) * orientation(c, d, b) < -1e-8; }
function orientation(a, b, c) { return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]); }
function mockVertexColors(hexes) {
  const values = [];
  for (const hex of hexes) { const color = linearRgb(hex); values.push(color.r, color.g, color.b); }
  return { itemSize: 3, count: hexes.length, needsUpdate: false, getX(index) { return values[index * 3]; }, getY(index) { return values[index * 3 + 1]; }, getZ(index) { return values[index * 3 + 2]; }, setXYZ(index, r, g, b) { values[index * 3] = r; values[index * 3 + 1] = g; values[index * 3 + 2] = b; } };
}
function linearRgb(hex) {
  const linear = (channel) => { const value = channel / 255; return value < 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
  return { r: linear((hex >> 16) & 0xff), g: linear((hex >> 8) & 0xff), b: linear(hex & 0xff) };
}
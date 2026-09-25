import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MOUNTAIN_CONTROL_POINTS as DEAD_CANYON_CONTROL_POINTS,
  DEAD_CANYON_LAYOUT_RULES
} from '../tracks/mountain-layout.js';
import {
  CLIFFSIDE_CONTROL_POINTS as SUBURBS_CONTROL_POINTS,
  SUBURBS_LAYOUT_RULES
} from '../tracks/cliffside-layout.js';
import {
  MOUNTAIN_CONTROL_POINTS as PRODUCTION_MOUNTAIN_CONTROL_POINTS
} from '../../turn/tracks/mountain-layout.js';
import {
  CLIFFSIDE_CONTROL_POINTS as PRODUCTION_CLIFFSIDE_CONTROL_POINTS
} from '../../turn/tracks/cliffside-layout.js';

const ROOT = new URL('../../', import.meta.url);

const [
  labIndex,
  productionIndex,
  labBootstrap,
  definitions,
  registry,
  suburbsWorld,
  deadWorld,
  paceNotes,
  introCamera,
  lapSystem,
  manifest,
  release
] = await Promise.all([
  readText('turn-lab/index.html'),
  readText('turn/index.html'),
  readText('turn-lab/lab-bootstrap.js'),
  readText('turn-lab/tracks/definitions.js'),
  readText('turn-lab/tracks/registry.js'),
  readText('turn-lab/tracks/suburbs-world.js'),
  readText('turn-lab/tracks/dead-canyon-world.js'),
  readText('turn-lab/tracks/pace-notes.js'),
  readText('turn-lab/render/track-intro-camera.js'),
  readText('turn-lab/race/mountain-lap-system.js'),
  readText('turn-lab/site.webmanifest'),
  readText('turn/release.json').then(JSON.parse)
]);

const labImportMaps = parseImportMaps(labIndex);
const productionImportMaps = parseImportMaps(productionIndex);
assert.equal(labImportMaps.length, 2);
assert.equal(productionImportMaps.length, 1);
assert.deepEqual(
  labImportMaps[0],
  productionImportMaps[0],
  'TURN LAB must boot the exact production runtime map before LAB-only overrides'
);

const labScope = labImportMaps[1]?.scopes?.['/turn/'] || {};
assert.equal(labScope['./tracks/definitions.js'], '/turn-lab/tracks/definitions.js');
assert.equal(labScope['./tracks/mountain-layout.js'], '/turn-lab/tracks/mountain-layout.js');
assert.equal(labScope['./tracks/cliffside-layout.js'], '/turn-lab/tracks/cliffside-layout.js');
assert.equal(labScope['./tracks/pace-notes.js'], '/turn-lab/tracks/pace-notes.js');
assert.equal(labScope['./tracks/registry.js'], '/turn-lab/tracks/registry.js');
assert.equal(
  Object.keys(labScope).some((specifier) => specifier.includes('world-collision')),
  false,
  'LAB must keep production collision/runtime machinery'
);

assert.equal(DEAD_CANYON_CONTROL_POINTS.length, 73);
assert.notDeepEqual(DEAD_CANYON_CONTROL_POINTS, PRODUCTION_MOUNTAIN_CONTROL_POINTS);
assert.equal(findProperIntersections(DEAD_CANYON_CONTROL_POINTS).length, 0);
const deadLength = closedLength(DEAD_CANYON_CONTROL_POINTS);
assert.ok(deadLength > 3150 && deadLength < 3350,
  'Expected DEAD CANYON near 3.25 km, got ' + deadLength.toFixed(1));
assert.equal(DEAD_CANYON_LAYOUT_RULES.sampleCount, 2160);
assert.equal(DEAD_CANYON_LAYOUT_RULES.identity, 'dead-canyon-r4');
assert.deepEqual(DEAD_CANYON_CONTROL_POINTS[49], [-40.0, 5.5, 130.0],
  'DEAD CANYON must bring the west wash through the central basin');
assert.equal(DEAD_CANYON_LAYOUT_RULES.routeNarrative.includes('central-badlands-sweep'), true);

assert.equal(SUBURBS_CONTROL_POINTS.length, 35);
assert.notDeepEqual(SUBURBS_CONTROL_POINTS, PRODUCTION_CLIFFSIDE_CONTROL_POINTS);
assert.equal(SUBURBS_CONTROL_POINTS.every(([, y]) => y === 0), true);
assert.equal(findProperIntersections(SUBURBS_CONTROL_POINTS).length, 0);
const suburbsLength = closedLength(SUBURBS_CONTROL_POINTS);
assert.ok(suburbsLength > 1850 && suburbsLength < 1950,
  'Expected preserved SUBURBS route near 1.9 km, got ' + suburbsLength.toFixed(1));
assert.equal(SUBURBS_LAYOUT_RULES.sampleCount, 1440);
assert.equal(SUBURBS_LAYOUT_RULES.islandCourse, true);
assert.equal(SUBURBS_LAYOUT_RULES.easyTrack, false);

assert.match(definitions, /id === 'mountain'[\s\S]*name: 'Dead Canyon'/);
assert.match(definitions, /id === 'cliffside'[\s\S]*name: 'Beachfront'/);
assert.match(definitions, /name: 'Dead Canyon'[\s\S]*difficulty: 'ADVANCED'/);
assert.match(definitions, /name: 'Dead Canyon'[\s\S]*accent: '#df3045'[\s\S]*accentSoft: '#f3a0a8'/);
assert.match(definitions, /name: 'Dead Canyon'[\s\S]*fogFar: 900/);
assert.match(definitions, /name: 'Beachfront'[\s\S]*difficulty: 'MEDIUM'/);
assert.match(definitions, /storageRevision: 'dead-canyon-lab-r4'/);
assert.match(definitions, /storageRevision: 'suburbs-lab'/);
assert.match(definitions, /export const TRACK_IDS = LAB_TRACK_METADATA\.ids/);
assert.match(definitions, /export const TRACK_NAMES = LAB_TRACK_METADATA\.names/);
assert.match(definitions, /export const assertTrackConfigCoverage = production\.assertTrackConfigCoverage/,
  'TURN LAB definitions overlay must preserve the production track-config coverage API');

assert.match(registry, /entry\.id === 'mountain'[\s\S]*installDeadCanyonWorld/);
assert.match(registry, /entry\.id === 'cliffside'[\s\S]*installSuburbsWorld/);

assert.match(suburbsWorld, /Beachfront surrounding water/);
assert.match(suburbsWorld, /Beachfront island body/);
assert.match(suburbsWorld, /Beachfront island beach rim/);
assert.match(suburbsWorld, /Beachfront wooden dock/);
assert.match(suburbsWorld, /Beachfront moored summer boat/);
assert.match(suburbsWorld, /position: pointInsideFrame\(frame, spec\.inward \?\? 13\.5/);
assert.match(suburbsWorld, /Number\.isFinite\(spec\.x\)[\s\S]*new THREE\.Vector3\(spec\.x, 0\.03, spec\.z\)[\s\S]*pointInsideFrame\(frame, spec\.inward \?\? 24/);
assert.equal(suburbsWorld.includes('outward: 7.5'), true);
assert.doesNotMatch(suburbsWorld, /function makeLakeAndDock/);
assert.doesNotMatch(suburbsWorld, /Suburbs summer lake/);
assert.doesNotMatch(suburbsWorld, /revision=/);
assert.match(suburbsWorld, /BEACHFRONT_HOTEL_URL/);
assert.match(suburbsWorld, /palm-detailed-straight\.glb/);
assert.match(suburbsWorld, /rocks-sand-a\.glb/);
assert.match(suburbsWorld, /boat-sail-a\.glb/);
assert.match(suburbsWorld, /Beachfront hotel tower/);
assert.match(suburbsWorld, /Beachfront offshore sailboat/);
assert.match(suburbsWorld, /progress: 0\.805[\s\S]*inward: 62/);
assert.match(suburbsWorld, /progress: 0\.825[\s\S]*x: 185[\s\S]*z: -82/);
assert.match(suburbsWorld, /Beachfront grass variation/);
assert.match(suburbsWorld, /grassVariationPatches: 10/);
assert.match(suburbsWorld, /function makeInstancedTrackStrip/);
assert.match(suburbsWorld, /name: 'Beachfront sidewalk'/);
assert.match(suburbsWorld, /name: 'Beachfront white road edge'/);
assert.match(suburbsWorld, /new THREE\.CylinderGeometry\(ISLAND_RADIUS, ISLAND_RADIUS \+ 9, 1\.45, 64, 1, true\)/);
assert.doesNotMatch(suburbsWorld, /pointInFrame\(frame,/);

assert.match(deadWorld, /version: 'dead-canyon-polish'/);
assert.match(deadWorld, /DEAD CANYON CROWN/);
assert.match(deadWorld, /yellowStepBarrierCount: 0/);
assert.match(deadWorld, /shedRoofSeated: true/);
assert.match(deadWorld, /yellowTreeCount: 20/);
assert.match(deadWorld, /centralRockFormationCount: 6/);
assert.match(deadWorld, /crownShelvesEmbedded: true/);
assert.match(deadWorld, /Dead Canyon central badlands formations/);
assert.match(deadWorld, /central-yellow-tree-/);
assert.match(deadWorld, /supportTop - roofBounds\.min\.y - 0\.95/);
assert.match(deadWorld, /\[790, 62, 22, 22, 31, 122/);
assert.match(deadWorld, /\[855, 121, 68, 19, 43, 146/);
assert.match(deadWorld, /\[925, 181, 42, 25, 37, 158/);
assert.match(deadWorld, /block\.position\.set\(x, 185 \+ height \/ 2, z\)/);

assert.match(paceNotes, /DEAD_CANYON_PACE_NOTES/);
assert.match(paceNotes, /SUBURBS_PACE_NOTES/);
assert.match(paceNotes, /id === 'mountain'/);
assert.match(paceNotes, /id === 'cliffside'/);
assert.match(introCamera, /mountain:[\s\S]*\[60, 155, -500\][\s\S]*\[280, 28, 40\][\s\S]*fov: 58/);
assert.match(introCamera, /cliffside:[\s\S]*\[15, 330, -610\]/);
assert.match(lapSystem, /trackId === 'mountain'/);
assert.match(lapSystem, /trackId === 'cliffside'/);

assert.match(labIndex, /TURN LAB · DEAD CANYON \+ BEACHFRONT/);
assert.equal(labIndex.includes("purpose: 'dead-canyon-suburbs'"), true);
assert.match(labIndex, /track-card-mountain[\s\S]*--track-card-paper: #f3a0a8[\s\S]*--track-card-fold: #d96874/);
assert.equal(labBootstrap.includes("dataset.turnLab = 'dead-canyon-suburbs'"), true);
assert.match(labBootstrap, /MOUNTAIN_REWARD_ID = 'mountain'/);
assert.match(manifest, /DEAD CANYON and BEACHFRONT/);
assert.equal(labIndex.includes(`production TURN ${release.id}`), true,
  'TURN LAB release identity must follow the current production release metadata');

assert.doesNotMatch(labIndex, /<script type="module" src="\.\/tracks\/cliffside-inner-buildings-r202\.js/);
assert.doesNotMatch(labIndex, /<script type="module" src="\.\/tracks\/cliffside-house-inset-r203\.js/);
assert.doesNotMatch(labIndex, /<script type="module" src="\.\/tracks\/kenney-track-landmarks-r517\.js/);
assert.equal(productionIndex.includes('/turn-lab/tracks/suburbs-world.js'), false);
assert.equal(productionIndex.includes('/turn-lab/tracks/dead-canyon-world.js'), false);

console.log(
  'TURN LAB dual-track contract passed: DEAD CANYON ' + deadLength.toFixed(1) +
  ' m + preserved BEACHFRONT ' + suburbsLength.toFixed(1) + ' m island.'
);

async function readText(path) {
  return fs.readFile(new URL(path, ROOT), 'utf8');
}

function parseImportMaps(source) {
  return [...source.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

function closedLength(points) {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    total += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  return total;
}

function findProperIntersections(points) {
  const intersections = [];
  const count = points.length;
  for (let aIndex = 0; aIndex < count; aIndex += 1) {
    const a1 = points[aIndex];
    const a2 = points[(aIndex + 1) % count];
    for (let bIndex = aIndex + 1; bIndex < count; bIndex += 1) {
      if (Math.abs(aIndex - bIndex) <= 1) continue;
      if (aIndex === 0 && bIndex === count - 1) continue;
      const b1 = points[bIndex];
      const b2 = points[(bIndex + 1) % count];
      if (segmentsIntersect(a1, a2, b1, b2)) intersections.push([aIndex, bIndex]);
    }
  }
  return intersections;
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}

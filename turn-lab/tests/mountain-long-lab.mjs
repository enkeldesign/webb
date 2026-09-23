import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MOUNTAIN_CONTROL_POINTS as SUBURBS_CONTROL_POINTS,
  SUBURBS_LAYOUT_RULES
} from '../tracks/mountain-layout.js';
import {
  MOUNTAIN_CONTROL_POINTS as PRODUCTION_MOUNTAIN_CONTROL_POINTS
} from '../../turn/tracks/mountain-layout.js';

const ROOT = new URL('../../', import.meta.url);

const [
  labIndex,
  productionIndex,
  labBootstrap,
  definitions,
  registry,
  world,
  paceNotes,
  introCamera,
  manifest,
  release
] = await Promise.all([
  readText('turn-lab/index.html'),
  readText('turn/index.html'),
  readText('turn-lab/lab-bootstrap.js'),
  readText('turn-lab/tracks/definitions.js'),
  readText('turn-lab/tracks/registry.js'),
  readText('turn-lab/tracks/suburbs-world.js'),
  readText('turn-lab/tracks/pace-notes.js'),
  readText('turn-lab/render/track-intro-camera.js'),
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
assert.equal(labScope['./tracks/pace-notes.js'], '/turn-lab/tracks/pace-notes.js');
assert.equal(labScope['./tracks/registry.js'], '/turn-lab/tracks/registry.js');
assert.equal(
  Object.keys(labScope).some((specifier) => specifier.includes('world-collision')),
  false,
  'SUBURBS must keep production collision/runtime machinery'
);

assert.equal(SUBURBS_CONTROL_POINTS.length, 35);
assert.notDeepEqual(
  SUBURBS_CONTROL_POINTS,
  PRODUCTION_MOUNTAIN_CONTROL_POINTS,
  'SUBURBS geometry must remain isolated from production MOUNTAIN'
);
assert.equal(SUBURBS_CONTROL_POINTS.every(([, y]) => y === 0), true);
assert.equal(findProperIntersections(SUBURBS_CONTROL_POINTS).length, 0);
const routeLength = closedLength(SUBURBS_CONTROL_POINTS);
assert.ok(routeLength > 1850 && routeLength < 1950,
  'Expected the authored SUBURBS route near 1.9 km, got ' + routeLength.toFixed(1) + ' m');
assert.equal(SUBURBS_LAYOUT_RULES.sampleCount, 1440);
assert.equal(SUBURBS_LAYOUT_RULES.flatCourse, true);
assert.equal(SUBURBS_LAYOUT_RULES.unlockedInLab, true);
assert.equal(SUBURBS_LAYOUT_RULES.easyTrack, true);

assert.match(definitions, /name: 'Suburbs'/);
assert.match(definitions, /difficulty: 'EASY'/);
assert.match(definitions, /storageRevision: 'suburbs-lab'/);
assert.match(definitions, /sampleCount: 1440/);
assert.match(definitions, /fogNear: 480/);
assert.match(definitions, /fogFar: 880/);
assert.match(registry, /installSuburbsWorld/);
assert.match(registry, /\/turn-lab\/tracks\/suburbs-world\.js/);

assert.match(world, /City Kit Suburban 2\.0/);
assert.match(world, /variation-a\.png/);
assert.match(world, /variation-b\.png/);
assert.match(world, /variation-c\.png/);
assert.match(world, /Suburbs parked/);
assert.match(world, /Suburbs wooden dock/);
assert.match(world, /Suburbs moored summer boat/);
assert.match(world, /Suburbs playground/);
assert.match(world, /building-type-/);
assert.match(world, /tree-large\.glb/);
assert.match(world, /tree-small\.glb/);
assert.match(world, /driveway-short\.glb/);
assert.match(world, /fence-low\.glb/);
assert.match(world, /planter\.glb/);
assert.match(world, /path-long\.glb/);
assert.match(world, /path-stones-messy\.glb/);
assert.match(world, /BACK_ROW_SITES/);
assert.doesNotMatch(world, /Suburbs lake light/);
assert.doesNotMatch(world, /revision=/);

assert.match(paceNotes, /SUBURBS_PACE_NOTES/);
assert.match(paceNotes, /suburbs-park-s[\s\S]*direction: LEFT/);
assert.match(paceNotes, /suburbs-home-sweeper[\s\S]*direction: RIGHT/);
assert.match(introCamera, /position: Object\.freeze\(\[20, 260, -570\]\)/);
assert.match(introCamera, /route: 'suburbs-postcard'/);

assert.match(labIndex, /TURN LAB · SUBURBS/);
assert.match(labIndex, /bright summer neighbourhood/);
assert.equal(labIndex.includes("purpose: 'suburbs'"), true);
assert.equal(labBootstrap.includes("dataset.turnLab = 'suburbs'"), true);
assert.match(labBootstrap, /MOUNTAIN_REWARD_ID = 'mountain'/);
assert.match(manifest, /SUBURBS summer track experiment/);
assert.equal(release.id, '2026.09.22-r285');

assert.equal(
  productionIndex.includes('/turn-lab/tracks/suburbs-world.js'),
  false,
  'Production TURN must not import SUBURBS'
);

console.log(
  'TURN LAB SUBURBS contract passed: ' +
  routeLength.toFixed(1) +
  ' m, 35 flat control points, bright Kenney neighbourhood, lake/dock/boat and parked cars.'
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

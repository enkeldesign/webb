import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MOUNTAIN_CONTROL_POINTS as BADLANDS_CONTROL_POINTS,
  BADLANDS_LAYOUT_RULES
} from '../tracks/mountain-layout.js';
import {
  MOUNTAIN_CONTROL_POINTS as PRODUCTION_MOUNTAIN_CONTROL_POINTS
} from '../../turn/tracks/mountain-layout.js';

const REPO_ROOT = new URL('../../', import.meta.url);
const [
  labIndex,
  productionIndex,
  labBootstrap,
  labDefinitions,
  labRegistry,
  labWorld,
  labPaceNotes,
  labManifest
] = await Promise.all([
  readText('turn-lab/index.html'),
  readText('turn/index.html'),
  readText('turn-lab/lab-bootstrap.js'),
  readText('turn-lab/tracks/definitions.js'),
  readText('turn-lab/tracks/registry.js'),
  readText('turn-lab/tracks/badlands-world.js'),
  readText('turn-lab/tracks/pace-notes.js'),
  readText('turn-lab/site.webmanifest')
]);

const labImportMaps = parseImportMaps(labIndex);
const productionImportMaps = parseImportMaps(productionIndex);
assert.equal(labImportMaps.length, 2);
assert.equal(productionImportMaps.length, 1);
assert.deepEqual(
  labImportMaps[0],
  productionImportMaps[0],
  'TURN LAB must boot the exact production runtime map before applying LAB-only overrides'
);

const labScope = labImportMaps[1]?.scopes?.['/turn/'] || {};
assert.equal(labScope['./tracks/definitions.js'], '/turn-lab/tracks/definitions.js');
assert.equal(labScope['./tracks/mountain-layout.js'], '/turn-lab/tracks/mountain-layout.js');
assert.equal(labScope['./tracks/pace-notes.js'], '/turn-lab/tracks/pace-notes.js');
assert.equal(labScope['./tracks/registry.js'], '/turn-lab/tracks/registry.js');
assert.equal(
  labScope['/turn/race/lap-system.js?build=20260720-r19'],
  '/turn-lab/race/mountain-lap-system.js'
);
assert.equal(
  Object.keys(labScope).some((specifier) => specifier.includes('world-collision')),
  false,
  'BADLANDS must use production world collision without the retired bridge-guide LAB adapter'
);

assert.equal(BADLANDS_CONTROL_POINTS.length, 44);
assert.notDeepEqual(
  BADLANDS_CONTROL_POINTS,
  PRODUCTION_MOUNTAIN_CONTROL_POINTS,
  'BADLANDS must remain isolated from production MOUNTAIN geometry'
);
assert.equal(findProperIntersections(BADLANDS_CONTROL_POINTS).length, 0);
const routeLength = closedLength(BADLANDS_CONTROL_POINTS);
assert.ok(routeLength > 1500 && routeLength < 1700, `Expected a ~1.6 km course, got ${routeLength.toFixed(1)} m`);
assert.equal(BADLANDS_LAYOUT_RULES.sampleCount, 1440);
assert.equal(BADLANDS_LAYOUT_RULES.routeNarrative.length, 7);

assert.match(labDefinitions, /name: 'Badlands'/);
assert.match(labDefinitions, /difficulty: 'ADVANCED'/);
assert.match(labDefinitions, /storageRevision: 'badlands-lab-r1'/);
assert.match(labDefinitions, /sampleCount: 1440/);
assert.doesNotMatch(labDefinitions, /bridgeGuide/);

assert.match(labRegistry, /installBadlandsWorld/);
assert.match(labRegistry, /\/turn-lab\/tracks\/badlands-world\.js/);
assert.match(labRegistry, /entry\.id !== 'mountain'/);

assert.match(labWorld, /world\.userData\.turnBadlands/);
assert.match(labWorld, /landmark: 'needle-rock'/);
assert.match(labWorld, /solarPanels: 30/);
assert.match(labWorld, /telemetryMasts: 4/);
assert.match(labWorld, /dynamicLights: 0/);
assert.match(labWorld, /shadowCasters: 0/);
assert.match(labWorld, /InstancedMesh/);
assert.doesNotMatch(labWorld, /GLTFLoader/);

assert.equal((labPaceNotes.match(/note\('badlands-/g) || []).length, 8);
assert.match(labBootstrap, /dataset\.turnLab = 'badlands'/);
assert.match(labBootstrap, /dataset\.turnLabExperimentAccess/);
assert.match(labIndex, /TURN LAB · BADLANDS/);
assert.match(labIndex, /Test BADLANDS, a new desert-dusk track/);
assert.match(labManifest, /BADLANDS track experiment/);

console.log(`TURN LAB BADLANDS contract passed: ${routeLength.toFixed(1)} m, 44 control points, 1440 samples.`);

async function readText(path) {
  return fs.readFile(new URL(path, REPO_ROOT), 'utf8');
}

function parseImportMaps(html) {
  const maps = [];
  const pattern = /<script type="importmap">([\s\S]*?)<\/script>/g;
  let match = null;
  while ((match = pattern.exec(html))) maps.push(JSON.parse(match[1]));
  return maps;
}

function closedLength(points) {
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    length += Math.hypot(next[0] - current[0], next[2] - current[2]);
  }
  return length;
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
  return orientation(a, b, c) * orientation(a, b, d) < -1e-8
    && orientation(c, d, a) * orientation(c, d, b) < -1e-8;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { resolveWorldCollisionState } from '../turn/race/world-collision.js';
import {
  AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS,
  AIRPORT_RUNWAY_BARRIER_COLLIDERS,
  AIRPORT_RUNWAY_COLLISION_PROFILE,
  AIRPORT_RUNWAY_COLLISION_RULES,
  AIRPORT_RUNWAY_HANGAR_COLLIDERS
} from '../turn-next/airport-runway/collision.js';
import {
  AIRPORT_RUNWAY_ACCESS_ROADS,
  AIRPORT_RUNWAY_AIRCRAFT,
  AIRPORT_RUNWAY_BARRIERS,
  AIRPORT_RUNWAY_CONTROL_POINTS,
  AIRPORT_RUNWAY_HANGAR,
  AIRPORT_RUNWAY_PACE_NOTE_BLUEPRINT,
  AIRPORT_RUNWAY_STORAGE_REVISION,
  AIRPORT_RUNWAY_Z,
  AIRPORT_SERVICE_ROAD_Z,
  CANONICAL_AIRPORT_ACCESS_ROADS
} from '../turn-next/airport-runway/spec.js';

assert.deepEqual(
  CANONICAL_AIRPORT_ACCESS_ROADS,
  [-132, 18, 170],
  'The prototype contract must remember the three access roads it replaces'
);
assert.deepEqual(
  AIRPORT_RUNWAY_ACCESS_ROADS,
  [-150, -55, 65, 170],
  'AIRPORT: RUNWAY must expose exactly four deliberately spaced access roads'
);
assert.equal(new Set(AIRPORT_RUNWAY_ACCESS_ROADS).size, 4);

for (const x of AIRPORT_RUNWAY_ACCESS_ROADS) {
  assert.ok(
    AIRPORT_RUNWAY_CONTROL_POINTS.some(([px, pz]) => px === x && pz === AIRPORT_RUNWAY_Z),
    `access road ${x} must meet the runway centreline`
  );
  assert.ok(
    AIRPORT_RUNWAY_CONTROL_POINTS.some(([px, pz]) => px === x && pz === AIRPORT_SERVICE_ROAD_Z),
    `access road ${x} must meet the service-road centreline`
  );
}

assert.equal(findProperIntersections(AIRPORT_RUNWAY_CONTROL_POINTS).length, 0,
  'AIRPORT: RUNWAY control polygon must not cross itself');

assert.ok(
  AIRPORT_RUNWAY_AIRCRAFT.x > AIRPORT_RUNWAY_ACCESS_ROADS[1]
  && AIRPORT_RUNWAY_AIRCRAFT.x < AIRPORT_RUNWAY_ACCESS_ROADS[2],
  'The A380 must physically sit between the second exit and third runway entry'
);
assert.match(AIRPORT_RUNWAY_AIRCRAFT.source, /amvlab\/aircraft-models\/91d835e8e851b2317fe79af291c9fed6153fd525\/models\/A380_nologo\.glb$/);

assert.deepEqual(AIRPORT_RUNWAY_COLLISION_RULES, {
  aircraftHitboxes: 2,
  barrierHitboxes: 3,
  hangarHitboxes: 2,
  totalHitboxes: 7
});

const fuselage = AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS.find((collider) => collider.id.endsWith('fuselage'));
const wings = AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS.find((collider) => collider.id.endsWith('wings'));
assert.ok(fuselage.minZ <= -251 && fuselage.maxZ >= -191,
  'A380 fuselage hitbox must span the full physical runway width');
assert.ok(wings.minX < AIRPORT_RUNWAY_AIRCRAFT.x && wings.maxX > AIRPORT_RUNWAY_AIRCRAFT.x,
  'A380 wing hitbox must cross the runway racing direction');

assert.equal(AIRPORT_RUNWAY_BARRIERS.length, 3);
assert.equal(AIRPORT_RUNWAY_BARRIER_COLLIDERS.length, 3);
for (const collider of AIRPORT_RUNWAY_BARRIER_COLLIDERS) {
  assert.equal(collider.category, 'traffic-cones');
  assert.ok(collider.maxZ - collider.minZ > 70,
    `${collider.id} must be long enough that the cone barrier cannot be casually driven around`);
}

const hangarClearWidth = AIRPORT_RUNWAY_HANGAR.wallOffsetX * 2 - AIRPORT_RUNWAY_HANGAR.wallThickness;
assert.ok(hangarClearWidth > 45, 'The open hangar must leave a generous full-car passage');
assert.equal(AIRPORT_RUNWAY_HANGAR_COLLIDERS.length, 2,
  'The hangar must collide only on its side walls, never across either open mouth');
assert.ok(
  AIRPORT_RUNWAY_CONTROL_POINTS.some(([x, z]) => x === AIRPORT_RUNWAY_HANGAR.x && z === -50)
  && AIRPORT_RUNWAY_CONTROL_POINTS.some(([x, z]) => x === AIRPORT_RUNWAY_HANGAR.x && z === -32),
  'The racing line must actually pass through the open blue hangar'
);

assert.equal(AIRPORT_RUNWAY_STORAGE_REVISION, 'airport-runway-next-r2');
assert.notEqual(AIRPORT_RUNWAY_STORAGE_REVISION, 'airport-r50');
assert.ok(AIRPORT_RUNWAY_COLLISION_PROFILE.freeRoamDistance < 95,
  'The obstacle route must tighten Airport free roam enough to prevent apron bypasses');

assert.equal(AIRPORT_RUNWAY_PACE_NOTE_BLUEPRINT.length, 12);
const turns = controlPointTurns(AIRPORT_RUNWAY_CONTROL_POINTS);
for (const note of AIRPORT_RUNWAY_PACE_NOTE_BLUEPRINT) {
  const expected = directionNearProgress(turns, note.triggerEnd);
  assert.notEqual(expected, 0, `${note.id} must precede a geometrically identifiable bend`);
  assert.equal(
    note.direction,
    expected > 0 ? 'right' : 'left',
    `${note.id} must match the physical AIRPORT: RUNWAY direction`
  );
}

function collisionAt(x, z, velocity = { x: 18, z: 0 }) {
  const state = {
    position: { x, y: 0.18, z },
    velocity: { ...velocity },
    speed: Math.hypot(velocity.x, velocity.z)
  };
  return resolveWorldCollisionState({
    state,
    trackId: 'airport',
    collisionProfile: AIRPORT_RUNWAY_COLLISION_PROFILE,
    carRadius: 2.6,
    dt: 1 / 60
  });
}

assert.ok(collisionAt(AIRPORT_RUNWAY_AIRCRAFT.x, AIRPORT_RUNWAY_AIRCRAFT.z).obstacles > 0,
  'Driving into the A380 must produce a physical obstacle collision');
assert.ok(collisionAt(AIRPORT_RUNWAY_BARRIERS[0].x, AIRPORT_RUNWAY_BARRIERS[0].z).obstacles > 0,
  'Driving through a cone wall must produce a physical obstacle collision');
assert.equal(collisionAt(AIRPORT_RUNWAY_HANGAR.x, AIRPORT_RUNWAY_HANGAR.z).obstacles, 0,
  'The middle of the blue hangar must remain genuinely drive-through');

const [
  prototypeIndex,
  prototypeWorld,
  prototypeStorage,
  prototypeDefinitions,
  ordinaryNextIndex,
  productionDefinitions,
  assetsSource
] = await Promise.all([
  fs.readFile(new URL('../turn-next/airport-runway/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/airport-runway/world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/airport-runway/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/airport-runway/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/airport-runway/ASSETS.md', import.meta.url), 'utf8')
]);

assert.match(prototypeIndex, /TURN NEXT · AIRPORT: RUNWAY · TEST ONLY/);
assert.match(
  prototypeIndex,
  /"\/turn\/tracks\/track-manager\.js\?build=20260805-r160": "\/turn\/tracks\/track-manager\.js\?source=20260729-r118-m8"/,
  'The prototype must preserve TURN NEXT’s canonical Track Manager singleton'
);
assert.doesNotMatch(
  prototypeIndex,
  /"\/turn\/tracks\/track-manager[^\n]+\/turn-next\/airport-runway/,
  'AIRPORT: RUNWAY must never replace Track Manager with a prototype fork'
);
assert.match(prototypeIndex, /"\/turn\/tracks\/catalog\.js\?source=20260729-r118-m8": "\/turn-next\/airport-runway\/catalog\.js"/);
assert.match(prototypeIndex, /"\/turn\/tracks\/registry\.js": "\/turn-next\/airport-runway\/registry\.js"/);
assert.match(prototypeIndex, /"\/turn\/tracks\/pace-notes\.js": "\/turn-next\/airport-runway\/pace-notes\.js"/);
assert.match(prototypeIndex, /\/turn-next\/airport-runway\/storage-bootstrap\.js/);
assert.doesNotMatch(prototypeIndex, /\/turn-next\/app\.js/,
  'The dedicated route lab should not load challenge-mode or mutate ordinary TURN NEXT startup');

assert.match(prototypeStorage, /turn-next-runway:/);
assert.match(prototypeStorage, /production: false/);
assert.match(prototypeDefinitions, /airport-runway-next-r2|AIRPORT_RUNWAY_STORAGE_REVISION/);
assert.doesNotMatch(ordinaryNextIndex, /airport-runway/,
  'Ordinary TURN NEXT entry must remain untouched by the route prototype');
assert.doesNotMatch(productionDefinitions, /airport-runway-next|Airport: Runway/,
  'Production TURN track definitions must remain untouched');

assert.match(prototypeWorld, /GLTFLoader/);
assert.match(prototypeWorld, /A380_nologo|AIRPORT_RUNWAY_AIRCRAFT\.source/);
assert.match(prototypeWorld, /new THREE\.InstancedMesh/,
  'Repeated traffic cones should remain cheap to render');
assert.match(prototypeWorld, /removeCanonicalAccessRoads/);
assert.match(prototypeWorld, /removeCanonicalBlueHangar/);
assert.match(prototypeWorld, /installOpenBlueHangar/);
assert.doesNotMatch(prototypeWorld, /setAnimationLoop|requestAnimationFrame|setInterval/,
  'Static Airport scenery must not add a second animation loop');
assert.match(assetsSource, /CC BY 4\.0/);
assert.match(assetsSource, /amvlab\/aircraft-models/);

console.log(
  `TURN NEXT AIRPORT: RUNWAY passed: four access roads, ${AIRPORT_RUNWAY_COLLISION_RULES.totalHitboxes} physical hitboxes, A380, open hangar and ${AIRPORT_RUNWAY_PACE_NOTE_BLUEPRINT.length} audited pace notes.`
);

function controlPointTurns(points) {
  const segmentLengths = points.map((point, index) => distance2d(point, points[(index + 1) % points.length]));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  let travelled = 0;

  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const incoming = [point[0] - previous[0], point[1] - previous[1]];
    const outgoing = [next[0] - point[0], next[1] - point[1]];
    const signedAngle = Math.atan2(
      incoming[0] * outgoing[1] - incoming[1] * outgoing[0],
      incoming[0] * outgoing[0] + incoming[1] * outgoing[1]
    );
    const turn = { progress: travelled / totalLength, signedAngle };
    travelled += segmentLengths[index];
    return turn;
  });
}

function directionNearProgress(turns, progress) {
  const radius = 0.035;
  const signedTurn = turns
    .filter((turn) => circularDistance(turn.progress, progress) <= radius)
    .reduce((sum, turn) => sum + turn.signedAngle, 0);
  if (Math.abs(signedTurn) < 0.08) return 0;
  return signedTurn > 0 ? 1 : -1;
}

function circularDistance(a, b) {
  const direct = Math.abs(a - b);
  return Math.min(direct, 1 - direct);
}

function distance2d(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
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
      const firstOrientation = orientation(a, b, c) * orientation(a, b, d);
      const secondOrientation = orientation(c, d, a) * orientation(c, d, b);
      if (firstOrientation < -1e-8 && secondOrientation < -1e-8) intersections.push([first, second]);
    }
  }
  return intersections;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

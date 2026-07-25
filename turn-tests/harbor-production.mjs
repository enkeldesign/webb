import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  HARBOR_BOUNDARY_COLLIDERS,
  HARBOR_COLLIDERS,
  HARBOR_COLLISION_RULES,
  HARBOR_CONTAINER_COLLIDERS
} from '../turn/tracks/harbor-collision.js';
import { HARBOR_CONTROL_POINTS, HARBOR_LAYOUT_RULES } from '../turn/tracks/harbor-layout.js';
import { getTrackDefinitionData } from '../turn/tracks/definitions.js';

assert.equal(HARBOR_LAYOUT_RULES.closedCourse, true);
assert.equal(HARBOR_LAYOUT_RULES.switchbackCount, 3);
assert.ok(HARBOR_CONTROL_POINTS.length >= 40, 'Harbor needs enough control points to preserve deliberate switchback shaping');

const samples = sampleCentripetalClosed(HARBOR_CONTROL_POINTS, 24);
assert.equal(findProperIntersections(samples).length, 0, 'Harbor road sections must never overlap in X/Z');

const radius = minimumHorizontalRadius(samples);
assert.ok(Number.isFinite(radius));
assert.ok(radius >= 12, `Harbor minimum radius ${radius.toFixed(2)} must remain driveable`);
assert.ok(radius <= 34, `Harbor minimum radius ${radius.toFixed(2)} must deliver a genuine HARD hairpin`);

const quay = HARBOR_CONTROL_POINTS.slice(
  HARBOR_LAYOUT_RULES.quayStraightControlPointRange[0],
  HARBOR_LAYOUT_RULES.quayStraightControlPointRange[1] + 1
);
const quaySpan = Math.max(...quay.map(([x]) => x)) - Math.min(...quay.map(([x]) => x));
const quayDepthVariation = Math.max(...quay.map(([, , z]) => z)) - Math.min(...quay.map(([, , z]) => z));
assert.ok(quaySpan >= 350, 'The closed return must include a meaningful quayside breathing straight');
assert.ok(quayDepthVariation >= 15 && quayDepthVariation <= 30, 'The quay straight must flow gently rather than becoming ruler-straight');

const harbor = getTrackDefinitionData('harbor');
assert.equal(harbor.freeRoamDistance, 170, 'Harbor must allow Countryside-style free roaming');
assert.equal(harbor.collisionProfile.shoulderStartDistance, undefined, 'Harbor must not retain an invisible road shoulder');
assert.equal(harbor.collisionProfile.shoulderDrag, undefined, 'Harbor off-road space must not receive artificial shoulder drag');
assert.equal(harbor.collisionProfile.colliders.length, HARBOR_COLLIDERS.length);
assert.equal(HARBOR_CONTAINER_COLLIDERS.length, HARBOR_COLLISION_RULES.containerColliderCount);
assert.equal(HARBOR_BOUNDARY_COLLIDERS.length, 8);
assert.equal(HARBOR_COLLIDERS.length, 49);

const minimumColliderClearance = Math.min(
  ...HARBOR_COLLIDERS.map((collider) => minimumDistanceToBox(samples, collider))
);
assert.ok(
  minimumColliderClearance > 16,
  `Harbor colliders must stay beyond the rendered road; minimum clearance was ${minimumColliderClearance.toFixed(2)}`
);
assert.equal(pointInsideAnyCollider({ x: 150, z: 20 }, HARBOR_COLLIDERS), false, 'Open apron space between lanes must remain driveable');
assert.equal(pointInsideAnyCollider({ x: -89, z: -90 }, HARBOR_COLLIDERS), true, 'Container stacks must stop the car');
assert.equal(pointInsideAnyCollider({ x: 0, z: -190 }, HARBOR_COLLIDERS), true, 'The quay edge must stop the car before the water');
assert.equal(pointInsideAnyCollider({ x: -330, z: 0 }, HARBOR_COLLIDERS), true, 'The outer map edge must remain contained');

const [worldSource, polishSource, collisionSource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/harbor-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/harbor-world-r81.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/harbor-collision.js', import.meta.url), 'utf8')
]);
assert.match(worldSource, /makeContainerYards\(world\)/);
assert.match(worldSource, /makeQuayDistrict\(world\)/);
assert.match(worldSource, /makeHarborShips\(world\)/);
assert.match(worldSource, /Ship Cargo A\/B and Boat Tug/, 'Ship silhouettes must explicitly follow the Summer Engine watercraft direction');
assert.match(worldSource, /new THREE\.InstancedMesh/, 'Repeated Harbor scenery must use instancing');
assert.match(polishSource, /moveStartGateOffTheCurbs/, 'The start posts must no longer overlap the curbs');
assert.match(polishSource, /START_POST_CLEARANCE = 4\.8/, 'The start gate must retain deliberate curb clearance');
assert.match(polishSource, /separateStartSightline/, 'The quay crane must not merge visually with the start gate');
assert.match(collisionSource, /'container'/, 'Harbor must expose container collision');
assert.doesNotMatch(`${worldSource}\n${polishSource}`, /setAnimationLoop|requestAnimationFrame|setInterval/, 'The static Harbor world must create no independent loop');

console.log(
  `TURN Harbor passed: ${HARBOR_CONTROL_POINTS.length} control points, minimum radius ${radius.toFixed(2)}, `
  + `quay span ${quaySpan}, ${HARBOR_COLLIDERS.length} free-roam boundaries.`
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
    const twiceArea = Math.abs(
      (b[0] - a[0]) * (c[2] - a[2])
      - (b[2] - a[2]) * (c[0] - a[0])
    );
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

function minimumDistanceToBox(samples, collider) {
  return Math.min(...samples.map(([x, , z]) => {
    const dx = Math.max(collider.minX - x, 0, x - collider.maxX);
    const dz = Math.max(collider.minZ - z, 0, z - collider.maxZ);
    return Math.hypot(dx, dz);
  }));
}

function pointInsideAnyCollider(point, colliders) {
  return colliders.some((collider) => (
    point.x > collider.minX
    && point.x < collider.maxX
    && point.z > collider.minZ
    && point.z < collider.maxZ
  ));
}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { HARBOR_CONTROL_POINTS, HARBOR_LAYOUT_RULES } from '../turn/tracks/harbor-layout.js';

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

const worldSource = await fs.readFile(new URL('../turn/tracks/harbor-world.js', import.meta.url), 'utf8');
assert.match(worldSource, /makeContainerYards\(world\)/);
assert.match(worldSource, /makeQuayDistrict\(world\)/);
assert.match(worldSource, /makeHarborShips\(world\)/);
assert.match(worldSource, /Ship Cargo A\/B and Boat Tug/, 'Ship silhouettes must explicitly follow the Summer Engine watercraft direction');
assert.match(worldSource, /new THREE\.InstancedMesh/, 'Repeated Harbor scenery must use instancing');
assert.doesNotMatch(worldSource, /setAnimationLoop|requestAnimationFrame|setInterval/, 'The static Harbor world must create no independent loop');

console.log(`TURN Harbor passed: ${HARBOR_CONTROL_POINTS.length} control points, minimum radius ${radius.toFixed(2)}, quay span ${quaySpan}.`);

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

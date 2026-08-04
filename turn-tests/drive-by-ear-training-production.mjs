import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  FINISH_PROGRESS,
  RAIL_ASSIST_START,
  RECOVERY_LIMIT,
  ROAD_HALF_WIDTH,
  TRAINING_STAGES
} from '../turn/training/stages.js';
import {
  paceNotePlaybackDirection
} from '../turn/audio/pace-note-spatial.js';

const [training, stagesSource, view, css, fixedLayout, priority] = await Promise.all([
  fs.readFile(new URL('../turn/training/drive-by-ear-training.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/stages.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/drive-by-ear-training.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/pace-note-priority.js', import.meta.url), 'utf8')
]);

assert.match(fixedLayout, /training\/drive-by-ear-training\.js\?build=\$\{buildKey\}-r151-dbe-training-device-fixes/);
assert.match(fixedLayout, /installDriveByEarTraining\(globalThis\.__turnRuntime\)/);
assert.equal(TRAINING_STAGES.length, 5, 'Training must contain exactly five authored parts');
assert.equal(FINISH_PROGRESS, 0.94);
assert.ok(RAIL_ASSIST_START > ROAD_HALF_WIDTH, 'The slippery guide must begin at the visible rail, not inside the road');
assert.ok(RECOVERY_LIMIT > ROAD_HALF_WIDTH + 8, 'The invisible safety area must remain wider than the road');

const [part1, part2, part3, part4, part5] = TRAINING_STAGES;
assert.equal(part1.points.at(-1)[1], 420, 'Part 1 keeps the long ribbon straight');
assert.ok(part1.points.every(([x]) => x === 0), 'Part 1 remains a clean straight');
assert.equal(part1.guideRails, true);

assert.deepEqual(
  part2.notes.map(({ direction, severity, long }) => [direction, severity, long]),
  [[1, 1, false], [-1, 2, false]],
  'Part 2 stores semantic right then left road direction'
);
assert.deepEqual(
  part3.notes.map(({ direction, severity, long }) => [direction, severity, long]),
  [[1, 1, false]],
  'Part 3 stores one semantic right'
);
assert.deepEqual(
  part4.notes.map(({ direction, severity, long }) => [direction, severity, long]),
  [[-1, 3, true]],
  'Part 4 stores one long tight semantic left'
);
assert.deepEqual(
  part5.notes.map(({ direction, severity, long }) => [direction, severity, long]),
  [[1, 1, false], [1, 2, false], [-1, 2, true]],
  'Part 5 stores a gentle right then the linked right–left sequence semantically'
);
assert.equal(part5.notes[1].progress, part5.notes[2].progress, 'The final two Part 5 groups enqueue as one phrase');
assert.equal(paceNotePlaybackDirection(1), -1, 'Semantic right is calibrated to the device-tested panner sign');
assert.equal(paceNotePlaybackDirection(-1), 1, 'Semantic left is calibrated to the device-tested panner sign');
assert.match(stagesSource, /const LEFT = -1;[\s\S]*const RIGHT = 1;/);
assert.doesNotMatch(stagesSource, /opposite ear for these authored training-course turns/);
assert.match(priority, /const pan = paceNotePan\(direction\)/, 'One shared audio layer owns ear calibration');

assert.match(training, /function keepInsideGuideRail\(/);
assert.match(training, /railDistance = RAIL_ASSIST_START/);
assert.match(training, /outwardSpeed/);
assert.match(training, /sample\.tangent/);
assert.match(training, /data-training-race-restart/);
assert.match(training, /restartPart/);
assert.match(training, /crossedForwardGate\(/);
assert.match(training, /turn:pace-note-priority/);
assert.match(training, /direction: paceNote\.direction/, 'Training publishes semantic direction to the shared priority layer');
assert.match(training, /finalBeepDurationSeconds: paceNote\.long \? 0\.17 : 0\.055/);
assert.match(training, /turn:pace-note-silence/);

assert.match(view, /homeButton\.textContent = 'DRIVE BY EAR 101'/);
assert.match(view, /data-training-stage="\$\{index\}"/);
assert.match(view, /Choose a training part/);
assert.match(view, /Know which sound is speaking/);
assert.match(view, /maximum-steering two-tone/);
assert.match(view, /These sounds are not corner instructions/);
assert.match(view, /data-training-race-previous/);
assert.match(view, /data-training-race-restart/);
assert.match(view, /data-training-race-next/);
assert.match(view, /requestAnimationFrame\(resetToTop\)/);
assert.match(view, /globalThis\.setTimeout\(resetToTop, 80\)/);

assert.match(css, /\.turn-dbe-training-home[\s\S]*white-space: nowrap/);
assert.match(css, /\.turn-dbe-training-sound-key/);
assert.match(css, /\.turn-dbe-training-part-picker ol/);
assert.match(css, /\.turn-dbe-training-race-nav/);
assert.match(css, /\.turn-dbe-training-race-nav\[hidden\]/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

for (const stage of TRAINING_STAGES) assertCourseHasSpace(stage);

console.log('TURN Drive By Ear 101 semantic pace notes, navigation, course spacing and shared ear calibration passed.');

function assertCourseHasSpace(stage) {
  const points = stage.points.map(([x, z]) => ({ x, z }));
  const minimumSeparation = ROAD_HALF_WIDTH * 3;
  for (let first = 0; first < points.length - 1; first += 1) {
    for (let second = first + 5; second < points.length - 1; second += 1) {
      const distance = segmentDistance(
        points[first],
        points[first + 1],
        points[second],
        points[second + 1]
      );
      assert.ok(
        distance > minimumSeparation,
        `${stage.title} brings remote course segments within ${distance.toFixed(1)} metres`
      );
    }
  }
}

function segmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b)
  );
}

function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function pointSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const projection = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
    : 0;
  const nearestX = start.x + projection * dx;
  const nearestZ = start.z + projection * dz;
  return Math.hypot(point.x - nearestX, point.z - nearestZ);
}

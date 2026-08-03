import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  FINISH_PROGRESS,
  RAIL_ASSIST_START,
  RECOVERY_LIMIT,
  ROAD_HALF_WIDTH,
  TRAINING_STAGES
} from '../turn/training/stages.js';

const [training, view, css, fixedLayout] = await Promise.all([
  fs.readFile(new URL('../turn/training/drive-by-ear-training.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/drive-by-ear-training.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8')
]);

assert.match(fixedLayout, /training\/drive-by-ear-training\.js\?build=\$\{buildKey\}-r150-dbe-training-refinement/);
assert.match(fixedLayout, /installDriveByEarTraining\(globalThis\.__turnRuntime\)/);
assert.match(fixedLayout, /driveByEarTraining/);

assert.equal(TRAINING_STAGES.length, 5, 'Training must contain exactly five authored parts');
assert.equal(FINISH_PROGRESS, 0.94);
assert.ok(RAIL_ASSIST_START < ROAD_HALF_WIDTH, 'The slippery guide assist must begin when the car reaches a rail');
assert.ok(RECOVERY_LIMIT > ROAD_HALF_WIDTH + 8, 'The invisible safety zone must remain wider than the road');

const [part1, part2, part3, part4, part5] = TRAINING_STAGES;
assert.equal(part1.points.at(-1)[1], 420, 'Part 1 must provide a substantially longer straight');
assert.ok(part1.points.every(([x]) => x === 0), 'Part 1 must remain a clean straight');
assert.equal(part1.guideRails, true);
assert.equal(part1.outerLimit, RECOVERY_LIMIT);

assert.equal(part2.notes.length, 2, 'Part 2 must contain only the gentle right and broader left');
assert.deepEqual(
  part2.notes.map(({ direction, severity, long }) => [direction, severity, long]),
  [[1, 1, false], [-1, 2, false]]
);
assert.ok(part2.notes[0].progress <= 0.10, 'The first Part 2 BIP must play on the long straight');
assert.ok(part2.notes[1].progress <= 0.49, 'The second Part 2 cue must play before its curve');
assert.ok(part2.points[3][1] >= 180, 'Part 2 must begin with a long straight');

assert.equal(part3.notes.length, 1);
assert.deepEqual(
  [part3.notes[0].direction, part3.notes[0].severity, part3.notes[0].long],
  [1, 1, false]
);
assert.ok(part3.notes[0].progress <= 0.17, 'Part 3 BIP must play well before the gentle right');
assert.equal(part3.startOffset, -(ROAD_HALF_WIDTH + 4));

assert.equal(part4.notes.length, 1, 'Part 4 must describe one uninterrupted curve');
assert.deepEqual(
  [part4.notes[0].direction, part4.notes[0].severity, part4.notes[0].long],
  [-1, 3, true],
  'Part 4 must play BIP BIP BEEP in the left ear for one long tight left'
);
assert.match(part4.lead, /BIP BIP BEEP/);
assert.match(part4.lead, /held final BEEP/);

assert.equal(part5.notes.length, 3);
assert.ok(part5.points[3][1] >= 180, 'Part 5 must begin with a long straight');
assert.match(part5.visualHint, /never crosses itself/);

for (const stage of TRAINING_STAGES) {
  assertCourseHasSpace(stage);
}

assert.match(training, /const TRAINING_REVISION = 'r150-dbe-training-refinement'/);
assert.match(training, /applySlipperyAssist\(sample, side/);
assert.match(training, /1 - Math\.exp\(-profile\.damping \* dt\)/);
assert.match(training, /tangential motion instead of stopping or snapping the car back onto the road/);
assert.doesNotMatch(training, /velocity\.multiplyScalar\(stage\.guideRails \?/,
  'Guide rails must no longer stop the car with a fixed speed multiplier');
assert.match(training, /crossedForwardGate\(/, 'Finishing must use the physical finish gate, not nearest-route proximity');
assert.match(training, /HARD_BOUNDARY_OVERSHOOT/);
assert.match(training, /data-training-race-restart/);
assert.match(training, /restartPart/);
assert.match(training, /renderTrainingNavigation/);
assert.match(training, /dataset\.trainingTarget/);

assert.match(view, /homeButton\.textContent = 'DRIVE BY EAR 101'/);
assert.doesNotMatch(view, /homeButton\.textContent = 'DRIVE BY EAR TRAINING'/);
assert.match(view, /data-training-stage="\$\{index\}"/);
assert.match(view, /Choose a training part/);
assert.match(view, /data-training-race-previous/);
assert.match(view, /data-training-race-restart/);
assert.match(view, /data-training-race-next/);
assert.match(view, /Know which sound is speaking/);
assert.match(view, /Steering guidance/);
assert.match(view, /Pace notes/);
assert.match(view, /Status and safety/);
assert.match(view, /maximum-steering two-tone/);
assert.match(view, /These sounds are not corner instructions/);
assert.match(view, /The ear gives the turn side/);
assert.match(view, /held final BEEP means the curve continues/);

assert.match(training, /setAudioEnabled\?\.\(true\)/);
assert.match(training, /setDriveByEarEnabled\?\.\(true\)/);
assert.match(training, /setBalance\?\.\(TRAINING_BALANCE\)/);
assert.match(training, /restorePreferenceStorage\(session\.snapshot\)/);
assert.match(training, /await activateTrack\(snapshot\.trackId, runtime\)/);
assert.match(training, /await raceSession\.selectVehicle\(snapshot\.vehicle\)/);
assert.match(training, /runtime\.openLot = snapshot\.openLot/);

assert.match(css, /\.turn-dbe-training-home[\s\S]*white-space: nowrap/);
assert.match(css, /\.turn-dbe-training-sound-key/);
assert.match(css, /\.turn-dbe-training-part-picker ol/);
assert.match(css, /\.turn-dbe-training-race-nav/);
assert.match(css, /data-training-race-restart/);
assert.match(css, /\.turn-dbe-training-race-nav\[hidden\]/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

console.log('TURN Drive By Ear 101 course spacing, cues, navigation and slippery rails passed.');

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

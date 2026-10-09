import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  FINISH_PROGRESS,
  RAIL_ASSIST_START,
  RECOVERY_LIMIT,
  ROAD_HALF_WIDTH,
  TRAINING_STAGES,
  TRAINING_VEHICLE_ID
} from '../turn/training/stages.js';
import {
  DRIVE_BY_EAR_PART_COMPLETED_EVENT,
  DRIVE_BY_EAR_PART_IDS,
  LEARNING_FEEDBACK_READY_EVENT
} from '../turn/achievements/learning-progress.js';

const [training, view, css, fixedLayout, sessionOrchestrator, index, releaseSource, lapSystem] = await Promise.all([
  fs.readFile(new URL('../turn/training/drive-by-ear-training.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/drive-by-ear-training.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/session-orchestrator.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/lap-system.js', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const productionImports = JSON.parse(importMapText).imports;

assert.match(fixedLayout, /training\/drive-by-ear-training\.js\?build=\$\{buildKey\}-r151-dbe-training-device-fixes/);
assert.match(fixedLayout, /installDriveByEarTraining\(globalThis\.__turnRuntime\)/);
assert.match(fixedLayout, /driveByEarTraining/);
assert.equal(
  productionImports['/turn/race/session-orchestrator.js?source=20260729-r118-m8'],
  `/turn/race/session-orchestrator.js?build=${release.cacheKey}`,
  'Production must map the start-announcement-aware race session through the current release identity'
);
assert.equal(
  productionImports[`/turn/training/drive-by-ear-training.js?build=${release.cacheKey}-r151-dbe-training-device-fixes`],
  `/turn/training/drive-by-ear-training.js?build=${release.cacheKey}`,
  'Legacy DBE 101 entrypoints must route to the current release build instead of a stale training module'
);
assert.equal(
  productionImports['/turn/training/stages.js'],
  `/turn/training/stages.js?build=${release.cacheKey}`,
  'Changed DBE stage definitions must have a release-bound module identity'
);
assert.equal(
  productionImports['/turn/training/view.js'],
  `/turn/training/view.js?build=${release.cacheKey}`,
  'Changed DBE view code must have a release-bound module identity'
);

assert.equal(TRAINING_VEHICLE_ID, 'tractor', 'DBE 101 must use the slow-moving vehicle');
assert.equal(TRAINING_STAGES.length, 5, 'Training must contain exactly five authored parts');
assert.deepEqual(DRIVE_BY_EAR_PART_IDS, TRAINING_STAGES.map((stage) => stage.id),
  'The DRIVE BY EAR achievement must require every authored training part exactly once');
assert.equal(FINISH_PROGRESS, 0.94);
assert.ok(
  RAIL_ASSIST_START > ROAD_HALF_WIDTH && RAIL_ASSIST_START < ROAD_HALF_WIDTH + 1,
  'The slippery guide assist must begin at the visible rail rather than inside the road'
);
assert.ok(RECOVERY_LIMIT > ROAD_HALF_WIDTH + 8, 'The invisible safety zone must remain wider than the road');

const [part1, part2, part3, part4, part5] = TRAINING_STAGES;
assert.equal(part1.points.at(-1)[1], 420, 'Part 1 must provide a substantially longer straight');
assert.ok(part1.points.every(([x]) => x === 0), 'Part 1 must remain a clean straight');
assert.equal(part1.guideRails, true);
assert.equal(part1.outerLimit, RECOVERY_LIMIT);

// Pace notes are SWOOSH swipes generated from each course's geometry (#909), as on every
// track; turn-lab/tests/pace-notes-production.mjs checks the sides each course produces.
for (const stage of TRAINING_STAGES) {
  assert.equal('notes' in stage, false, `${stage.id} has no hand-placed notes`);
  assert.doesNotMatch(`${stage.lead} ${stage.menuSummary} ${stage.visualHint}`, /\bBIP|\bBEEP/, `${stage.id} teaches swipes, not BIPs`);
}
assert.ok(part2.points[3][1] >= 180, 'Part 2 must begin with a long straight');
assert.match(part2.lead, /Pace notes are swipes/);
assert.equal(part3.startOffset, -(ROAD_HALF_WIDTH + 4));
assert.match(part3.lead, /Pace notes wait while you are off the road/);
assert.match(part4.lead, /Two linked swipes in the right ear/);
assert.ok(part5.points[3][1] >= 210, 'Part 5 must begin with a long straight');
assert.match(part5.lead, /a swipe in the left ear, then a swipe in the right ear/);
assert.match(part5.visualHint, /final two curves follow closely/);

for (const stage of TRAINING_STAGES) {
  assertCourseHasSpace(stage);
}

assert.match(training, /const TRAINING_REVISION = 'r241-learning-achievements'/);
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

assert.match(
  sessionOrchestrator,
  /async function startGame\(fullscreenPromise = Promise\.resolve\(false\), \{ announceStart = true \} = \{\}\)/,
  'The shared race session must let training start its parts without the race-start announcement'
);
// GO! is retired (#1032): the player chooses when to start, so nothing says GO! at the
// race start or the lap start, and training has nothing left to suppress.
assert.doesNotMatch(sessionOrchestrator, /'GO!'/);
assert.doesNotMatch(lapSystem, /'GO!'/);
assert.match(sessionOrchestrator, /if \(state\.sensorMode && announceStart\) \{/, 'Training parts start without the tilt hint');
assert.match(
  training,
  /raceSession\.startGame\(fullscreenPromise \|\| Promise\.resolve\(false\), \{ announceStart: false \}\)/,
  'DBE 101 must start its parts without the race-start announcement so its instructions come first'
);
assert.match(training, /function signalStageStarted\(\{ restarted = false \} = \{\}\)/);
assert.match(training, /new CustomEvent\('turn:dbe-training-stage-started'/);
assert.match(training, /stageId: session\.stage\.id/);
assert.match(training, /stageIndex: session\.stageIndex/);
assert.match(training, /signalStageStarted\(\);\s*return true;/,
  'A part-start event must be emitted only after that exact stage has finished starting');
assert.match(training, /signalStageStarted\(\{ restarted: true \}\)/,
  'Restart must emit the same exact-stage start event rather than relying on click timing');
assert.equal(DRIVE_BY_EAR_PART_COMPLETED_EVENT, 'turn:dbe-training-stage-completed');
assert.match(training, /new CustomEvent\(DRIVE_BY_EAR_PART_COMPLETED_EVENT/);
assert.match(training, /async function completePart\(\)[\s\S]*stageId: session\.stage\.id[\s\S]*stageIndex: session\.stageIndex/,
  'Finishing a part must report the completed authored stage, not merely the selected button');
assert.equal(LEARNING_FEEDBACK_READY_EVENT, 'turn:learning-feedback-ready');
assert.match(training, /async function leaveTraining\(\)[\s\S]*new CustomEvent\(LEARNING_FEEDBACK_READY_EVENT/,
  'Achievement feedback must wait until the training dialog has left the top layer');

assert.match(view, /homeButton\.textContent = 'DRIVE BY EAR TUTORIAL'/);
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
assert.match(view, /A swipe travels out to the ear on the side of the coming bend/);
assert.match(view, /Higher pitch means tighter; a slower swipe means a longer bend/);
assert.match(view, /dialog\.classList\.contains\('turn-dbe-training-intro-dialog'\)/);
assert.match(view, /dialog\.querySelector\('\[data-training-cancel\]'\)/);
assert.match(view, /focus\(\{ preventScroll: true \}\)/);
assert.equal(
  (view.match(/requestAnimationFrame\(\(\) =>/g) || []).length >= 2,
  true,
  'The long introduction must reset its scroll after WebKit applies delayed focus scrolling'
);
assert.match(view, /card\.scrollTop = 0/);
assert.match(view, /behavior: 'instant'/);

assert.match(training, /from '\/turn\/training\/stages\.js'/);
assert.match(training, /from '\/turn\/training\/view\.js'/);
assert.match(training, /setAudioEnabled\?\.\(true\)/);
assert.match(training, /carId: TRAINING_VEHICLE_ID/);
assert.match(training, /color: getVehicleDefaultColor\(TRAINING_VEHICLE_ID\)/);
assert.match(training, /secondaryColor: getVehicleDefaultSecondaryColor\(TRAINING_VEHICLE_ID\)/);
assert.match(training, /temporarily uses the slow-moving vehicle/);
assert.match(view, /temporarily uses the slow-moving vehicle/);
assert.doesNotMatch(training, /Training Car/, 'DBE 101 runtime copy must call it the slow-moving vehicle');
assert.doesNotMatch(view, /Training Car/, 'DBE 101 dialog copy must call it the slow-moving vehicle');
assert.doesNotMatch(training, /DEFAULT_VEHICLE_COLOR|DEFAULT_VEHICLE_SECONDARY_COLOR/,
  'DBE 101 must use the slow-moving vehicle factory paint rather than Learner Car defaults');
assert.match(training, /setDriveByEarEnabled\?\.\(true\)/);
assert.match(training, /setBalance\?\.\(TRAINING_BALANCE\)/);
assert.match(training, /restorePreferenceStorage\(session\.snapshot\)/);
assert.match(training, /await activateTrack\(snapshot\.trackId, runtime\)/);
assert.match(training, /await raceSession\.selectVehicle\(snapshot\.vehicle\)/);
assert.match(training, /runtime\.openGarage = snapshot\.openGarage/);

assert.match(css, /\.turn-dbe-training-home[\s\S]*white-space: nowrap/);
assert.match(css, /\.turn-dbe-training-sound-key/);
assert.match(css, /\.turn-dbe-training-part-picker ol/);
assert.match(css, /\.turn-dbe-training-race-nav/);
assert.match(css, /data-training-race-restart/);
assert.match(css, /\.turn-dbe-training-race-nav\[hidden\]/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

console.log('TURN Drive By Ear 101 exact-stage instructions, quiet part starts and device cue mapping passed.');

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

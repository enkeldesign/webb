import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  resolveSteeringRollLimit,
  updateMotionInputState
} from '../turn/input/motion.js';
import {
  resolveSensorCameraRollLimit,
  updateRaceCameraState
} from '../turn/render/camera.js';
import {
  steeringLimitAnnouncement,
  steeringLimitVisualGrowth,
  steeringLimitVisualOpacity
} from '../turn-next/steering-limit-warning.js';

const toRadians = (degrees) => degrees * Math.PI / 180;
const approximately = (actual, expected, tolerance = 1e-6) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

const previousConfiguration = globalThis.__TURN_MOTION_SAFE_ZONE__;

delete globalThis.__TURN_MOTION_SAFE_ZONE__;
approximately(resolveSteeringRollLimit(toRadians(14)), toRadians(14));
approximately(resolveSensorCameraRollLimit(), toRadians(18));

globalThis.__TURN_MOTION_SAFE_ZONE__ = Object.freeze({
  degrees: 24,
  steeringDegrees: 24,
  horizonDegrees: 24,
  feedbackNearDegrees: 19,
  feedbackHardDegrees: 24,
  feedbackHardRearmDegrees: 22,
  feedbackClearDegrees: 17.5,
  directionalFeedback: true
});

approximately(resolveSteeringRollLimit(toRadians(14)), toRadians(24));
approximately(resolveSensorCameraRollLimit(), toRadians(24));
approximately(resolveSteeringRollLimit(toRadians(14), { steeringDegrees: 0 }), toRadians(14));
approximately(resolveSensorCameraRollLimit({ horizonDegrees: 90 }), toRadians(18));

const steeringState = {
  sensorMode: true,
  roll: 0,
  targetRoll: toRadians(32),
  pitch: 0,
  targetPitch: 0,
  neutralRoll: 0,
  steering: 0,
  steeringEngaged: true,
  tiltDrive: 0
};

updateMotionInputState({
  state: steeringState,
  dt: 1,
  maxSteerRoll: toRadians(14)
});
assert.ok(steeringState.steering < -0.999, 'Steering must saturate at the configured +24-degree boundary');

steeringState.roll = 0;
steeringState.targetRoll = toRadians(-32);
steeringState.steering = 0;
updateMotionInputState({
  state: steeringState,
  dt: 1,
  maxSteerRoll: toRadians(14)
});
assert.ok(steeringState.steering > 0.999, 'Steering must saturate at the configured -24-degree boundary');

function measuredCameraRoll(rollDegrees, configuration) {
  globalThis.__TURN_MOTION_SAFE_ZONE__ = configuration;
  let rotation = null;
  const camera = {
    position: { copy() {} },
    up: { set() {} },
    lookAt() {},
    rotateZ(value) { rotation = value; },
    fov: 68,
    updateProjectionMatrix() {}
  };
  const cameraPosition = { x: 0, y: 0, z: 0 };
  const cameraTarget = { x: 0, y: 0, z: 0 };
  const state = {
    speed: 0,
    velocity: { dot() { return 0; } },
    position: { x: 0, y: 0, z: 0 },
    nearestTrackIndex: 0,
    sensorMode: true,
    neutralRoll: 0,
    roll: toRadians(rollDegrees)
  };

  updateRaceCameraState({
    state,
    camera,
    cameraPosition,
    cameraTarget,
    getForward: () => ({ x: 0, z: 1 }),
    getRight: () => ({ x: 1, z: 0 }),
    samples: [],
    maxSpeed: 88,
    dt: 1 / 60
  });
  return rotation;
}

approximately(
  measuredCameraRoll(32, globalThis.__TURN_MOTION_SAFE_ZONE__),
  toRadians(-24),
  1e-9
);
approximately(
  measuredCameraRoll(-32, globalThis.__TURN_MOTION_SAFE_ZONE__),
  toRadians(24),
  1e-9
);
approximately(measuredCameraRoll(32, undefined), toRadians(-18), 1e-9);

assert.equal(steeringLimitVisualOpacity({ active: false }), 0);
approximately(steeringLimitVisualOpacity({ active: true, intensity: 0 }), 0.1);
approximately(steeringLimitVisualOpacity({ active: true, intensity: 0.5 }), 0.55);
assert.equal(steeringLimitVisualOpacity({ active: true, intensity: 1, hard: true }), 1);
approximately(steeringLimitVisualGrowth({ active: false }), 0.08);
approximately(steeringLimitVisualGrowth({ active: true, intensity: 0 }), 0.22);
approximately(steeringLimitVisualGrowth({ active: true, intensity: 0.5 }), 0.61);
assert.equal(steeringLimitVisualGrowth({ active: true, intensity: 1, hard: true }), 1);
assert.equal(steeringLimitAnnouncement('left'), 'Left steering limit reached.');
assert.equal(steeringLimitAnnouncement('right'), 'Right steering limit reached.');
assert.equal(steeringLimitAnnouncement(null), 'Steering limit reached.');

const [
  safeZoneBootstrap,
  nextIndex,
  nextApp,
  orientationCompat,
  warningRuntime,
  warningCss
] = await Promise.all([
  fs.readFile(new URL('../turn-next/safe-zone-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-compat.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/steering-limit-warning.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/steering-limit-warning.css', import.meta.url), 'utf8')
]);

assert.match(safeZoneBootstrap, /SAFE_ZONE_DEGREES = 24/);
assert.match(safeZoneBootstrap, /feedbackNearDegrees: 19/);
assert.match(safeZoneBootstrap, /feedbackHardRearmDegrees: 22/);
assert.match(safeZoneBootstrap, /directionalFeedback: true/);
assert.match(nextIndex, /safe-zone-bootstrap\.js\?source=.*&stage=directional-limit-m4/);
assert.match(nextIndex, /steering-limit-warning\.css\?source=.*&stage=directional-limit-m4/);
assert.ok(
  nextIndex.indexOf('/turn-next/safe-zone-bootstrap.js') < nextIndex.indexOf('./orientation-compat.js'),
  'The safe-zone configuration must load before orientation feedback'
);
assert.match(nextApp, /Platform M1 · Safe Zone M3 · Limit M4\.1/);
assert.match(nextApp, /data-turn-next-steady-limit/);
assert.match(nextApp, /steering-limit-warning\.css\?source=.*&stage=steady-limit-m4-1/);
assert.match(nextApp, /installTurnNextSteeringLimitWarning\(\)/);
assert.match(nextApp, /steering-limit-warning\.js\?source=.*&stage=steady-limit-m4-1/);
assert.ok(
  nextApp.indexOf('installTurnNextSteeringLimitWarning()') < nextApp.indexOf("withBuild('./main.js')"),
  'Directional warning must install before the race core starts'
);
assert.doesNotMatch(nextIndex, /turnAppViewport|orientation-preflight|orientation-freeze/);
assert.doesNotMatch(nextApp, /orientation-freeze|installTurnNextOrientationFreeze|Orientation M2/);
assert.match(orientationCompat, /feedbackNearDegrees/);
assert.match(orientationCompat, /feedbackHardDegrees/);
assert.match(orientationCompat, /feedbackHardRearmDegrees/);
assert.match(orientationCompat, /directionalFeedbackEnabled/);
assert.match(orientationCompat, /turn:steering-limit-feedback/);
assert.match(orientationCompat, /relativeRoll < 0 \? 'left'/);
assert.match(orientationCompat, /enteredHard/);
assert.match(warningRuntime, /aria-live', 'assertive'/);
assert.match(warningRuntime, /announcedSides = \{ left: false, right: false \}/);
assert.match(warningRuntime, /reason === 'race-started'/);
assert.match(warningRuntime, /audio\?\.cue\?\.\('ui-back'\)/);
assert.match(warningRuntime, /__turnAudio\?\.cue\?\.\('ui-tap'\)/);
assert.match(warningRuntime, /--turn-limit-opacity/);
assert.match(warningRuntime, /--turn-limit-growth/);
assert.doesNotMatch(warningRuntime, /FLASH_DURATION|is-flashing|function flash/);
assert.match(warningCss, /html\[data-turn-deployment="next"\] \.hud::before/);
assert.match(warningCss, /width: clamp\(56px, 10vw, 124px\)/);
assert.match(warningCss, /linear-gradient\(\s*90deg/);
assert.match(warningCss, /linear-gradient\(\s*270deg/);
assert.match(warningCss, /transform: scaleX\(var\(--turn-limit-growth/);
assert.match(warningCss, /transform-origin: left center/);
assert.match(warningCss, /transform-origin: right center/);
assert.match(warningCss, /opacity 420ms/);
assert.match(warningCss, /transform 420ms/);
assert.match(warningCss, /transition-duration: 260ms/);
assert.doesNotMatch(warningCss, /animation|@keyframes|is-flashing/);

for (const removedPath of [
  '../turn-next/orientation-preflight.js',
  '../turn-next/orientation-freeze.js',
  '../turn-next/orientation-freeze.css'
]) {
  await assert.rejects(
    fs.access(new URL(removedPath, import.meta.url)),
    undefined,
    `${removedPath} must remain removed`
  );
}

if (previousConfiguration === undefined) delete globalThis.__TURN_MOTION_SAFE_ZONE__;
else globalThis.__TURN_MOTION_SAFE_ZONE__ = previousConfiguration;

console.log('TURN NEXT 24-degree safe zone and non-flashing directional limit warning passed.');

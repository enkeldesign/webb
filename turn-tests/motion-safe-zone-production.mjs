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
  feedbackNearDegrees: 20,
  feedbackHardDegrees: 24,
  feedbackClearDegrees: 17.5
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

const [safeZoneBootstrap, nextIndex, nextApp, orientationCompat] = await Promise.all([
  fs.readFile(new URL('../turn-next/safe-zone-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-compat.js', import.meta.url), 'utf8')
]);

assert.match(safeZoneBootstrap, /SAFE_ZONE_DEGREES = 24/);
assert.match(nextIndex, /safe-zone-bootstrap\.js\?source=.*&stage=safe-zone-m3/);
assert.ok(
  nextIndex.indexOf('/turn-next/safe-zone-bootstrap.js') < nextIndex.indexOf('./orientation-compat.js'),
  'The safe-zone configuration must load before orientation feedback'
);
assert.match(nextApp, /Platform M1 · Safe Zone M3/);
assert.doesNotMatch(nextIndex, /turnAppViewport|orientation-preflight|orientation-freeze/);
assert.doesNotMatch(nextApp, /orientation-freeze|installTurnNextOrientationFreeze|Orientation M2/);
assert.match(orientationCompat, /feedbackNearDegrees/);
assert.match(orientationCompat, /feedbackHardDegrees/);
assert.match(orientationCompat, /feedbackClearDegrees/);

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

console.log('TURN NEXT 24-degree motion safe zone and production fallbacks passed.');

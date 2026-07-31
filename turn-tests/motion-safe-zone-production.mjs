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
  steeringLimitInertialStep,
  steeringLimitVisualGrowth,
  steeringLimitVisualOpacity
} from '../turn/ui/steering-limit-warning.js';

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
assert.ok(steeringState.steering < -0.999, 'Steering must saturate at the canonical +24-degree boundary');

steeringState.roll = 0;
steeringState.targetRoll = toRadians(-32);
steeringState.steering = 0;
updateMotionInputState({
  state: steeringState,
  dt: 1,
  maxSteerRoll: toRadians(14)
});
assert.ok(steeringState.steering > 0.999, 'Steering must saturate at the canonical -24-degree boundary');

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
approximately(steeringLimitVisualOpacity({ active: true, intensity: 0 }), 0.08);
approximately(steeringLimitVisualOpacity({ active: true, intensity: 0.5 }), 0.54);
assert.equal(steeringLimitVisualOpacity({ active: true, intensity: 1, hard: true }), 1);
approximately(steeringLimitVisualGrowth({ active: false }), 0.12);
approximately(steeringLimitVisualGrowth({ active: true, intensity: 0 }), 0.3);
approximately(steeringLimitVisualGrowth({ active: true, intensity: 0.5 }), 0.65);
assert.equal(steeringLimitVisualGrowth({ active: true, intensity: 1, hard: true }), 1);

const attackAfterOneTau = steeringLimitInertialStep(0, 1, 360, 360);
approximately(attackAfterOneTau, 1 - Math.exp(-1));
assert.ok(attackAfterOneTau > 0 && attackAfterOneTau < 1, 'Inertial attack must approach without snapping');
const releaseAfterOneTau = steeringLimitInertialStep(1, 0, 780, 780);
approximately(releaseAfterOneTau, Math.exp(-1));
assert.ok(releaseAfterOneTau > 0 && releaseAfterOneTau < 1, 'Inertial release must retain visible energy');
assert.ok(
  steeringLimitInertialStep(1, 0, 16, 780) > steeringLimitInertialStep(1, 0, 16, 360),
  'Release must be slower than attack for softer threshold behavior'
);

assert.equal(steeringLimitAnnouncement('left'), 'Left steering limit reached.');
assert.equal(steeringLimitAnnouncement('right'), 'Right steering limit reached.');
assert.equal(steeringLimitAnnouncement(null), 'Steering limit reached.');

const [
  safeZoneSource,
  productionIndex,
  nextIndex,
  productionApp,
  nextApp,
  orientationCompat,
  orientationGuardCss,
  warningRuntime,
  warningCss
] = await Promise.all([
  fs.readFile(new URL('../turn/motion-safe-zone.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-compat.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-guard.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/steering-limit-warning.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/steering-limit-warning.css', import.meta.url), 'utf8')
]);

assert.match(safeZoneSource, /SAFE_ZONE_DEGREES = 24/);
assert.match(safeZoneSource, /feedbackNearDegrees: 19/);
assert.match(safeZoneSource, /feedbackHardRearmDegrees: 22/);
assert.match(safeZoneSource, /feedbackClearDegrees: 17\.5/);
assert.match(safeZoneSource, /directionalFeedback: true/);

for (const indexSource of [productionIndex, nextIndex]) {
  assert.match(indexSource, /motion-safe-zone\.js\?build=/);
  assert.ok(
    indexSource.indexOf('./motion-safe-zone.js') < indexSource.indexOf('./orientation-compat.js'),
    'The canonical safe-zone configuration must load before orientation feedback'
  );
}

for (const appSource of [productionApp, nextApp]) {
  assert.match(appSource, /installStylesheet\('\.\/steering-limit-warning\.css'/);
  assert.match(appSource, /installSteeringLimitWarning\(\)/);
}
assert.ok(
  productionApp.indexOf('installSteeringLimitWarning()') < productionApp.indexOf("withBuild('./main.js')"),
  'Production warning must install before the race core starts'
);
assert.ok(
  nextApp.indexOf('installSteeringLimitWarning()') < nextApp.indexOf('main.js?source=${buildKey}-m7'),
  'TURN NEXT warning must install before the M7 race core starts'
);

assert.match(nextApp, /Platform M5–M7 · Motion \+ Display \+ Session Lifecycle/);
assert.doesNotMatch(nextIndex, /turn-next\/safe-zone-bootstrap|turn-next\/steering-limit-warning/);
assert.doesNotMatch(nextApp, /turn-next\/steering-limit-warning|installTurnNextSteeringLimitWarning/);
assert.match(orientationCompat, /feedbackNearDegrees/);
assert.match(orientationCompat, /feedbackHardDegrees/);
assert.match(orientationCompat, /feedbackHardRearmDegrees/);
assert.match(orientationCompat, /turn:steering-limit-feedback/);
assert.match(warningRuntime, /aria-live', 'assertive'/);
assert.match(warningRuntime, /announcedSides = \{ left: false, right: false \}/);
assert.match(warningRuntime, /reason === 'race-started'/);
assert.match(warningRuntime, /audio\?\.cue\?\.\('ui-back'\)/);
assert.match(warningRuntime, /__turnAudio\?\.cue\?\.\('ui-tap'\)/);
assert.match(warningRuntime, /VISUAL_RELEASE_HOLD_MS = 300/);
assert.match(warningRuntime, /VISUAL_ATTACK_TAU_MS = 360/);
assert.match(warningRuntime, /VISUAL_RELEASE_TAU_MS = 780/);
assert.match(warningRuntime, /requestAnimationFrame\(animateVisuals\)/);
assert.doesNotMatch(warningRuntime, /FLASH_DURATION|is-flashing|function flash/);
assert.match(warningCss, /width: clamp\(34px, 9vw, 75px\)/);
assert.match(warningCss, /linear-gradient\(\s*90deg/);
assert.match(warningCss, /linear-gradient\(\s*270deg/);
assert.match(warningCss, /transition: none/);
assert.doesNotMatch(warningCss, /transition-duration|animation|@keyframes|is-flashing/);
assert.doesNotMatch(orientationGuardCss, /\.hud::before|turn-steering-limit-pulse|@keyframes/);

for (const removedPath of [
  '../turn-next/safe-zone-bootstrap.js',
  '../turn-next/steering-limit-warning.js',
  '../turn-next/steering-limit-warning.css',
  '../turn-next/orientation-preflight.js',
  '../turn-next/orientation-freeze.js',
  '../turn-next/orientation-freeze.css'
]) {
  await assert.rejects(
    fs.access(new URL(removedPath, import.meta.url)),
    undefined,
    `${removedPath} must remain absent`
  );
}

if (previousConfiguration === undefined) delete globalThis.__TURN_MOTION_SAFE_ZONE__;
else globalThis.__TURN_MOTION_SAFE_ZONE__ = previousConfiguration;

console.log('Canonical TURN 24-degree safe zone and inertial directional warning passed.');

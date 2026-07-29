import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { updateMotionInputState } from '../../turn/input/motion.js';

function manualStep(manualSteering) {
  const state = { sensorMode: false, manualSteering, steering: 0, tiltDrive: 0 };
  updateMotionInputState({ state, dt: 1, maxSteerRoll: 1 });
  return state.steering;
}

assert.equal(manualStep(-1), 1, 'manual left should steer the car left');
assert.equal(manualStep(1), -1, 'manual right should steer the car right');
assert.equal(manualStep(0), 0, 'centered manual steering should stay centered');

const [
  index,
  releaseSource,
  css,
  orientationGuardCss,
  orientationCompat,
  camera,
  motion,
  safeZone,
  warningCss,
  warningRuntime
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/manual-steering.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/orientation-guard.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/orientation-compat.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/camera.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/input/motion.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/motion-safe-zone.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/steering-limit-warning.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/steering-limit-warning.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, /role="slider"/);
assert.match(index, /manual-steer-knob/);
assert.match(index, new RegExp(`manual-steering\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`orientation-guard\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`motion-safe-zone\\.js\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`orientation-compat\\.js\\?build=${release.cacheKey}`));
assert.ok(
  index.indexOf('./motion-safe-zone.js') < index.indexOf('./orientation-compat.js'),
  'The canonical motion safe zone must load before orientation feedback'
);
assert.equal(imports['./render/camera.js?build=20260720-r19'], `./render/camera.js?build=${release.cacheKey}`, 'The current release must publish the guarded race camera');
assert.match(index, /<strong>Rotate to landscape<\/strong>/, 'The pre-race landscape instruction must remain available');

assert.match(css, /--manual-steer-left/);
assert.match(css, /content: "←"/);
assert.match(css, /content: "→"/);

assert.match(orientationGuardCss, /body\.turn-race-active \.rotate-panel/, 'The portrait warning must stay hidden during an active race');
assert.doesNotMatch(orientationGuardCss, /\.hud::before|turn-steering-limit-pulse|@keyframes/, 'The obsolete whole-screen warning must remain removed');

assert.match(safeZone, /SAFE_ZONE_DEGREES = 24/);
assert.match(safeZone, /feedbackNearDegrees: 19/);
assert.match(safeZone, /feedbackHardDegrees: SAFE_ZONE_DEGREES/);
assert.match(safeZone, /feedbackHardRearmDegrees: 22/);
assert.match(safeZone, /feedbackClearDegrees: 17\.5/);
assert.match(safeZone, /directionalFeedback: true/);

assert.match(warningCss, /turn-steering-limit-edge-left/);
assert.match(warningCss, /turn-steering-limit-edge-right/);
assert.match(warningCss, /width: clamp\(34px, 9vw, 75px\)/);
assert.match(warningCss, /transition: none/);
assert.doesNotMatch(warningCss, /animation|@keyframes|is-flashing/);
assert.match(warningRuntime, /VISUAL_RELEASE_HOLD_MS = 300/);
assert.match(warningRuntime, /VISUAL_ATTACK_TAU_MS = 360/);
assert.match(warningRuntime, /VISUAL_RELEASE_TAU_MS = 780/);
assert.match(warningRuntime, /Left steering limit reached\./);
assert.match(warningRuntime, /Right steering limit reached\./);
assert.match(warningRuntime, /__turnAudio/);

assert.match(orientationCompat, /configuredDegrees\('degrees', 17\)/, 'The compatibility guard must retain a safe legacy fallback when no host configuration exists');
assert.match(orientationCompat, /configuredHardLimitDegrees - 4/, 'Near feedback fallback must remain four degrees before the configured hard limit');
assert.match(orientationCompat, /configuredHardLimitDegrees - 6\.5/, 'Feedback hysteresis fallback must clear below the configured limit');
assert.match(orientationCompat, /globalThis\.__TURN_MOTION_SAFE_ZONE__/, 'The canonical host configuration must remain overridable by future platforms');
assert.match(orientationCompat, /document\.body\.classList\.toggle\('turn-race-active', gameplayActive\)/, 'Race lifecycle must control the orientation-warning suppression class');
assert.match(orientationCompat, /gameplayAngle = computedAngle\(\)/, 'The race must freeze its starting motion-axis orientation');
assert.match(orientationCompat, /return gameplayActive && gameplayAngle != null \? gameplayAngle : computedAngle\(\)/, 'Live viewport flips must not remap steering while racing');
assert.match(orientationCompat, /preferredLandscapeLock = currentLandscapeLockType\(\)/, 'The exact starting landscape side must remain available as a fallback');
assert.match(orientationCompat, /await orientation\.lock\(type\)/, 'Supported browsers must receive an actual Screen Orientation lock request');
assert.match(orientationCompat, /if \(await tryOrientationLock\('landscape'\)\) return true/, 'Generic landscape must be preferred so both turning directions remain valid');
assert.match(orientationCompat, /return exactType !== 'landscape' \? tryOrientationLock\(exactType\) : false/, 'Exact-side locking must be fallback-only');
assert.match(orientationCompat, /#motionButton, #manualButton, \.lot-race/, 'Only actual game-start gestures should retry the browser orientation lock');
assert.doesNotMatch(orientationCompat, /if \(gameplayActive \|\| startsGame\)/, 'Regular GAS, DRIFT and BOOST touches must not repeatedly re-lock orientation');
assert.match(orientationCompat, /globalThis\.__turnRequestLandscapeLock = requestLandscapeLock/, 'The landscape-lock request must remain reusable by the runtime');
assert.match(orientationCompat, /document\.addEventListener\('fullscreenchange'/, 'Entering fullscreen must retry the browser orientation lock');
assert.match(orientationCompat, /window\.addEventListener\('pageshow'/, 'Returning to the web app must retry the browser orientation lock');
assert.match(orientationCompat, /navigator\.vibrate\?\.\(pattern\)/, 'Approaching the guard should provide haptic feedback where supported');
assert.match(orientationCompat, /window\.addEventListener\('turn:ui-state-change'/, 'The guard must follow the actual race lifecycle rather than viewport shape alone');

assert.match(camera, /DEFAULT_MAX_SENSOR_CAMERA_ROLL = 18 \* Math\.PI \/ 180/, 'The camera must retain a safe fallback when no host configuration exists');
assert.match(camera, /resolveSensorCameraRollLimit/, 'The camera must accept the canonical safe-zone clamp');
assert.match(camera, /state\.roll - neutralRoll/, 'Camera horizon roll must be relative to the calibrated steering neutral');
assert.match(camera, /clamp\(relativeRoll, -maxSensorCameraRoll, maxSensorCameraRoll\)/, 'Camera roll must be hard-clamped at the resolved safe-zone limit');
assert.doesNotMatch(camera, /camera\.rotateZ\(-state\.roll\)/, 'The camera must never again follow raw sensor roll toward a portrait flip');

assert.match(motion, /resolveSteeringRollLimit/);
assert.match(motion, /return Number\.isFinite\(fallback\) && fallback > 0 \? fallback : degToRad\(14\)/, 'Motion input must retain a safe fallback when no host configuration exists');

console.log(`TURN ${release.id} manual steering and canonical race orientation guard passed.`);

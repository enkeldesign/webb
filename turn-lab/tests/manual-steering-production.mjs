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

const [index, css, orientationGuardCss, orientationCompat, camera] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/manual-steering.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/orientation-guard.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/orientation-compat.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/camera.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.27 · Build 2026\.07\.22-r44/);
assert.match(index, /role="slider"/);
assert.match(index, /manual-steer-knob/);
assert.match(index, /manual-steering\.css\?build=20260722-r44/);
assert.match(index, /orientation-guard\.css\?build=20260722-r44/);
assert.match(index, /orientation-compat\.js\?build=20260722-r44/);
assert.match(index, /"\.\/render\/camera\.js\?build=20260720-r19": "\.\/render\/camera\.js\?build=20260721-r29"/, 'r44 must preserve the guarded race camera cache redirect');
assert.match(index, /<strong>Rotate to landscape<\/strong>/, 'The pre-race landscape instruction must remain available');

assert.match(css, /--manual-steer-left/);
assert.match(css, /content: "←"/);
assert.match(css, /content: "→"/);

assert.match(orientationGuardCss, /body\.turn-race-active \.rotate-panel/, 'The portrait warning must stay hidden during an active race');
assert.match(orientationGuardCss, /turn-steering-limit-near/, 'Approaching the steering guard must have visual feedback');
assert.match(orientationGuardCss, /turn-steering-limit-hard/, 'The hard steering guard must have stronger visual feedback');
assert.match(orientationGuardCss, /prefers-reduced-motion: reduce/, 'Orientation feedback must respect reduced-motion preferences');

assert.match(orientationCompat, /STEERING_LIMIT_NEAR = 13 \* Math\.PI \/ 180/, 'Steering-limit feedback must begin before the camera guard');
assert.match(orientationCompat, /STEERING_LIMIT_HARD = 17 \* Math\.PI \/ 180/, 'The stronger warning must arrive just before the 18-degree camera clamp');
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

assert.match(camera, /MAX_SENSOR_CAMERA_ROLL = 18 \* Math\.PI \/ 180/, 'Race camera roll must stop before device over-rotation');
assert.match(camera, /state\.roll - neutralRoll/, 'Camera horizon roll must be relative to the calibrated steering neutral');
assert.match(camera, /clamp\(relativeRoll, -MAX_SENSOR_CAMERA_ROLL, MAX_SENSOR_CAMERA_ROLL\)/, 'Camera roll must be hard-clamped at the guard limit');
assert.doesNotMatch(camera, /camera\.rotateZ\(-state\.roll\)/, 'The camera must never again follow raw sensor roll toward a portrait flip');

console.log('TURN manual steering and race orientation guard regression passed.');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, guard] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/motion-start-guard.js', import.meta.url), 'utf8')
]);

const guardScript = '/yourturn/motion-start-guard.js?revision=r592-ios-axis-lock';
assert.match(index, new RegExp(guardScript.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'YOUR TURN must load the iOS motion-start guard under a fresh cache identity');
assert.ok(
  index.indexOf(guardScript) < index.indexOf('/yourturn/app.js?revision=r6'),
  'The motion-start guard must intercept the shared race session before app.js imports TURN main.js'
);

assert.match(guard, /SESSION_KEY = '__turnNextRaceSession'/,
  'The guard must wrap the canonical shared race session rather than fork TURN steering');
assert.match(guard, /LANDSCAPE_QUIET_MS = 180/,
  'Portrait-to-landscape orientation events need a quiet window before axis sampling');
assert.match(guard, /MIN_VALID_MOTION_SAMPLES = 10/,
  'YOUR TURN must collect more than the adaptive orientation layer’s eight calibration samples before racing');
assert.match(guard, /STABLE_AXIS_SAMPLES = 8/,
  'The resolved orientation axis must stay stable for a full calibration window');
assert.match(guard, /screen\?\.orientation\?\.angle/,
  'Stable-axis sampling must observe the same resolved ScreenOrientation angle consumed by TURN motion input');
assert.match(guard, /visualViewport\?\.addEventListener\?\.\('resize'/,
  'Visual viewport settling must participate in the portrait-to-landscape quiet window');
assert.match(guard, /addEventListener\?\.\('orientationchange'/,
  'Native orientation changes must reset the quiet window');
assert.match(guard, /addEventListener\?\.\('devicemotion', onMotion/,
  'The pre-start guard must wait for fresh post-rotation motion samples');
assert.match(guard, /validSamples >= MIN_VALID_MOTION_SAMPLES[\s\S]*stableSamples >= STABLE_AXIS_SAMPLES/,
  'A race may proceed only after enough valid samples and a stable resolved axis');
assert.match(guard, /if \(!firstMotionStartPending \|\| !state\?\.sensorMode\) return;/,
  'Manual steering must never pay the motion stabilization delay');
assert.match(guard, /state\.neutralRoll = state\.targetRoll[\s\S]*state\.horizonRollReference = state\.targetRoll[\s\S]*state\.steeringEngaged = false/,
  'The stable landscape pose must become both steering and horizon neutral immediately before race start');

const wrappedStart = guard.match(/async startGame\(\.\.\.args\) \{([\s\S]*?)\n      \}/)?.[1] || '';
assert.ok(
  wrappedStart.indexOf('await stabilizeBeforeFirstMotionStart()') >= 0
    && wrappedStart.indexOf('await stabilizeBeforeFirstMotionStart()') < wrappedStart.indexOf('return session.startGame(...args)'),
  'Axis stabilization must finish before the canonical session publishes race-started and locks gameplay orientation'
);
assert.match(guard, /__yourTurnMotionStartDiagnostics/,
  'Physical-device retests need motion-handoff diagnostics if steering still fails');

console.log('YOUR TURN iOS portrait-to-landscape motion-axis start guard contract passed.');

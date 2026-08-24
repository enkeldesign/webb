import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, app, session] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/session.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(index, /start-axis-guard\.js/,
  'YOUR TURN must not load a challenge-specific motion-axis guard');
assert.match(index, /\/yourturn\/app\.js\?revision=r593-canonical-motion/,
  'YOUR TURN must cache-bust the canonical-motion app handoff');
assert.match(index, /\/yourturn\/session\.js\?revision=r593-canonical-motion/,
  'YOUR TURN must cache-bust the session that no longer samples motion itself');

assert.match(app, /installMotionLifecycleBridge/,
  'YOUR TURN must install TURN’s production motion lifecycle bridge');
assert.doesNotMatch(app, /__turnMotionLifecycle\?\.uninstall|__turnMotionLifecycle\.uninstall/,
  'YOUR TURN must not uninstall TURN’s production motion lifecycle');
assert.doesNotMatch(app, /addEventListener\(['"]devicemotion/,
  'YOUR TURN app orchestration must not subscribe to device motion itself');
assert.doesNotMatch(session, /addEventListener\(['"]devicemotion/,
  'YOUR TURN session orchestration must not subscribe to device motion itself');
assert.doesNotMatch(app, /neutralRoll\s*=|horizonRollReference\s*=/,
  'YOUR TURN app must not rewrite TURN steering calibration state');
assert.doesNotMatch(session, /neutralRoll\s*=|horizonRollReference\s*=/,
  'YOUR TURN session must not rewrite TURN steering calibration state');
assert.doesNotMatch(app, /deferResumeUntil/,
  'YOUR TURN hard pause must not carry a steering-specific resume barrier');

assert.match(session, /await nextPaint\(\);[\s\S]*return startAcceptedRace\(\);/,
  'YOUR TURN may wait for the landscape UI to paint before handing off to TURN');
assert.match(session, /await raceSession\.startGame\(access\.fullscreenPromise\)/,
  'YOUR TURN must hand race start directly to TURN’s canonical race session');

console.log('YOUR TURN canonical motion ownership contract passed.');
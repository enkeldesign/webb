import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, app, session, orientationCompat] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/session.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-compat.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(index, /start-axis-guard\.js/,
  'YOUR TURN must not load a challenge-specific motion-axis guard');
assert.match(index, /\/yourturn\/app\.js\?revision=r593-canonical-motion/,
  'YOUR TURN must cache-bust the canonical-motion app handoff');
assert.match(index, /\/yourturn\/session\.js\?revision=r593-canonical-motion-r594-preview-orientation/,
  'YOUR TURN must load the preview-safe session under a fresh cache identity');

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

assert.match(
  orientationCompat,
  /setGameplayActive\(Boolean\(event\.detail\?\.running\)\)/,
  'The production TURN orientation guard must continue to derive gameplay lock state from running UI events'
);

const launchBlock = session.match(/async function launch\(\) \{([\s\S]*?)\n  function setChallenge/)?.[1] || '';
const previewModePublish = launchBlock.indexOf('runtime.setGameMode(GAME_MODE.STAGED)');
const previewRunningEnable = launchBlock.indexOf('runtime.state.running = true');
assert.ok(previewModePublish >= 0 && previewRunningEnable >= 0,
  'YOUR TURN invitation preview must explicitly stage the runtime and enable its render loop');
assert.ok(previewModePublish < previewRunningEnable,
  'YOUR TURN must publish its preview mode while running is still false so TURN does not lock portrait orientation as gameplay');

assert.match(session, /await nextPaint\(\);[\s\S]*return startAcceptedRace\(\);/,
  'YOUR TURN may wait for the landscape UI to paint before handing off to TURN');
assert.match(session, /await raceSession\.startGame\(access\.fullscreenPromise\)/,
  'YOUR TURN must hand race start directly to TURN’s canonical race session');

console.log('YOUR TURN canonical motion ownership and preview orientation-lock contract passed.');
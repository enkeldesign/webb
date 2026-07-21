import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, app, audio, controls] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.10 · Build 2026\.07\.21-r26/);
assert.match(index, /\.\/app\.js\?build=20260721-r26/);

assert.match(app, /import\(withBuild\('\.\/audio\/audio-system\.js'\)\)/, 'Production must load the central audio module');
assert.match(app, /installTurnAudio\(\)/, 'The audio foundation must install before gameplay starts');
assert.ok(
  app.indexOf("./audio/audio-system.js") < app.indexOf("./ui/gameplay-controls.js"),
  'Audio must install before gameplay controls begin feeding it state'
);

assert.match(audio, /globalThis\.AudioContext \|\| globalThis\.webkitAudioContext/, 'Audio must support iOS WebKit AudioContext');
assert.match(audio, /AUDIO_UPDATE_INTERVAL_MS = 1000 \/ 30/, 'Continuous audio updates must stay capped at 30 Hz');
assert.match(audio, /globalThis\.__turnAudio = api/, 'The foundation must expose one shared audio API');
assert.match(audio, /unlock,\s*update,\s*cue,\s*silence/, 'The shared audio API must expose lifecycle, continuous state, and one-shot cues');

assert.match(audio, /function installEngineGraph\(/, 'The foundation must provide a continuous engine layer');
assert.match(audio, /function installDriftGraph\(/, 'The foundation must provide a continuous drift layer');
assert.match(audio, /function installBoostGraph\(/, 'The foundation must provide a continuous boost layer');
assert.match(audio, /case 'boost-start':/, 'Boost activation must have a distinct one-shot cue');
assert.match(audio, /function handleUiClick\(/, 'UI buttons must receive lightweight procedural feedback');

assert.match(audio, /document\.addEventListener\('pointerdown', unlockFromGesture/, 'Touch gestures must unlock audio on mobile');
assert.match(audio, /document\.addEventListener\('keydown', unlockFromGesture/, 'Keyboard interaction must also unlock audio');
assert.match(audio, /document\.addEventListener\('visibilitychange', handleVisibilityChange/, 'Audio must react to page visibility changes');
assert.match(audio, /window\.addEventListener\('pagehide', handlePageHide/, 'Audio must suspend cleanly when the page is backgrounded');
assert.match(audio, /function hardMute\(/, 'Continuous buses must hard-mute before mobile suspension');

assert.doesNotMatch(audio, /requestAnimationFrame|setAnimationLoop|setInterval/, 'The audio foundation must not create a second game loop');
assert.doesNotMatch(audio, /fetch\(|new Audio\(/, 'The sound foundation must remain procedural and offline-friendly');

assert.match(controls, /function updateAudio\(now, boosting\)/, 'Existing gameplay controls must feed continuous runtime state into audio');
assert.match(controls, /globalThis\.__turnAudio\?\.update\(/, 'Continuous sound must reuse the shared audio API');
assert.match(controls, /runtimeState\?\.mode === runtime\?\.GAME_MODE\?\.SPECTATING/, 'Player engine audio must stay off during spectator mode');
assert.match(controls, /document\.body\.classList\.contains\('turn-lot-open'\)/, 'Race audio must fade out while The Lot is open');
assert.match(controls, /driftAmount: runtimeState\?\.driftAmount \|\| 0/, 'Drift sound must follow the real physics drift state');
assert.match(controls, /boostActive: boosting/, 'Boost sound must follow the post-lockout boost state');

console.log('TURN sound foundation production regression passed.');

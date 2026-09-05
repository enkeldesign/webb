import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  index,
  releaseSource,
  app,
  audio,
  controls,
  catalogSource,
  organicRibbon,
  recoveryGuidance,
  driveByEarRuntime,
  musicHealth,
  homeLayout
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/organic-ribbon.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/recovery-guidance.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/drive-by-ear-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/racing-music-health.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const vehicleCatalogTarget = '/turn/vehicle/catalog.js?revision=r240-trophy-road-2';

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`\\.\\/app\\.js\\?build=${release.cacheKey}[^\"]*r164-long-session-robustness`),
  'The installed-app root must request a fresh robustness app module');
assert.equal(
  imports['./vehicle/catalog.js?build=20260720-r19'],
  vehicleCatalogTarget,
  'The main runtime must publish the canonical vehicle handling catalog'
);
assert.equal(
  imports['./vehicle/catalog.js?build=20260720-r20'],
  vehicleCatalogTarget,
  'The Lot must use the same canonical vehicle handling catalog'
);

assert.match(app, /audio\/audio-system\.js\?revision=r164-long-session-robustness/,
  'Production must load the cache-safe long-session central audio module');
assert.match(app, /audio\/drive-by-ear-runtime\.js\?revision=r164-long-session-robustness/,
  'Production must load the cache-safe Drive By Ear robustness graph');
assert.match(app, /performance-profile\.js\?revision=r187-legacy-tablet-mountain-shadows/,
  'Production must load the cache-safe track-aware mobile performance profile');
assert.match(app, /installTurnAudio\(\)/, 'The audio foundation must install before gameplay starts');
assert.ok(
  app.indexOf('./audio/audio-system.js') < app.indexOf('./ui/gameplay-controls.js'),
  'Audio must install before gameplay controls begin feeding it state'
);

assert.match(audio, /globalThis\.AudioContext \|\| globalThis\.webkitAudioContext/, 'Audio must support iOS WebKit AudioContext');
assert.match(audio, /AUDIO_UPDATE_INTERVAL_MS = 1000 \/ 30/, 'Continuous audio updates must stay capped at 30 Hz');
assert.match(audio, /AUDIO_RECOVERY_RETRY_MS = 1000/, 'Interrupted game audio recovery must be throttled');
assert.match(audio, /globalThis\.__turnAudio = api/, 'The foundation must expose one shared audio API');
assert.match(audio, /unlock,\s*update,\s*cue,\s*silence/, 'The shared audio API must expose lifecycle, continuous state, and one-shot cues');
assert.match(audio, /get diagnostics\(\)/, 'Long-session audio health must expose bounded diagnostics');

assert.match(audio, /function installEngineGraph\(/, 'The foundation must provide a continuous engine layer');
assert.match(audio, /function installDriftGraph\(/, 'The foundation must provide a continuous drift layer');
assert.match(audio, /function installBoostGraph\(/, 'The foundation must provide a continuous boost layer');
assert.match(audio, /globalThis\.__turnVehicleTuning\?\.enginePitch/, 'Engine frequency must follow the selected car tuning');
assert.match(audio, /engineBaseHz = \(52 \+ speedRatio \* 96 \+ throttle \* 24\) \* enginePitch \* boostEngineLift/, 'Per-car pitch and boost lift must stay connected to the engine bed');
assert.match(audio, /const boostEngineLift = boostActive \? 1\.055 : 1/, 'Boost must lift the engine subtly rather than replace it');

for (const car of catalog.CAR_CATALOG) {
  assert.ok(Number.isFinite(car.tuning.enginePitch), `${car.name} must define an engine pitch baseline`);
  assert.ok(car.tuning.enginePitch >= 0.55 && car.tuning.enginePitch <= 1.7, `${car.name} engine pitch must stay within the supported range`);
}
assert.equal(catalog.getCarDefinition('sedan').tuning.enginePitch, 1, 'Sedan must remain the neutral engine pitch baseline');
assert.equal(catalog.getCarDefinition('monster-truck').tuning.enginePitch, 0.62, 'Monster Truck must have the lowest deep engine baseline');
assert.equal(catalog.getCarDefinition('race').tuning.enginePitch, 1.55, 'Race Car must have the highest F1-like engine baseline');
assert.ok(catalog.getCarDefinition('monster-truck').tuning.enginePitch < catalog.getCarDefinition('truck').tuning.enginePitch, 'Monster Truck must sit below the regular Truck in pitch');
assert.ok(catalog.getCarDefinition('race').tuning.enginePitch > catalog.getCarDefinition('race-future').tuning.enginePitch, 'Race Car must remain the highest-pitched racer');

assert.match(audio, /regularScrubLevel = active \? slipIntent \* driftSpeed \* 0\.0055 : 0/);
assert.match(audio, /deliberateScrubLevel = active && driftHeld/);
assert.match(audio, /const gritLevel = active && driftHeld/);
assert.match(audio, /gritNoise\.buffer = makeNoiseBuffer\(context, 1\.7, 0\.95\)/);
assert.match(audio, /skidTone\.type = 'triangle'/);
assert.doesNotMatch(audio, /skidNoise/);
assert.match(audio, /const boostLevel = boostActive \? 0\.024 : 0/);
assert.doesNotMatch(audio, /const boostLevel = boostActive \? 0\.16 : 0/);
assert.match(audio, /boostTone\.type = 'sine'/);
assert.match(audio, /case 'boost-start':/);
assert.match(audio, /case 'boost-empty':/);
assert.match(audio, /case 'boost-full':/);
assert.match(audio, /RIVAL_NEAR_ENTER_METERS = 10/);
assert.match(audio, /RIVAL_NEAR_EXIT_METERS = 15/);
assert.match(audio, /case 'car-near':/);
assert.match(audio, /case 'overtake':/);
assert.match(audio, /cueAllowed\(name, now\)/);
assert.match(audio, /case 'garage-open':/);
assert.match(audio, /case 'car-select':/);
assert.match(audio, /case 'paint-select':/);
assert.match(audio, /handleLotVisibilityChange/);
assert.match(audio, /handleLotPointerDown/);
assert.match(audio, /function handleUiPointerDown\(/);
assert.match(audio, /document\.addEventListener\('pointerdown', unlockFromGesture/);
assert.match(audio, /document\.addEventListener\('pointerdown', handleUiPointerDown/);
assert.doesNotMatch(audio, /document\.addEventListener\('click'/,
  'Nonessential UI audio must not put a delegated click listener above native form controls');
assert.doesNotMatch(audio, /document\.addEventListener\('change'/,
  'Nonessential UI audio must not put delegated form handling above native controls');
assert.match(audio, /document\.addEventListener\('keydown', unlockFromGesture/);
assert.match(audio, /document\.addEventListener\('visibilitychange', handleVisibilityChange/);
assert.match(audio, /window\.addEventListener\('pageshow', handlePageShow/);
assert.match(audio, /window\.addEventListener\('pagehide', handlePageHide/);
assert.match(audio, /context\.addEventListener\?\.\('statechange', handleContextStateChange\)/,
  'The shared game AudioContext must detect WebKit interruptions');
assert.match(audio, /function requestContextRecovery\(/,
  'A non-running visible game AudioContext must have a self-recovery path');
assert.match(audio, /if \(context\.state !== 'running'\) \{[\s\S]*requestContextRecovery\(now\)/,
  'Continuous game audio must try to recover rather than silently remaining dead');
assert.match(audio, /function hardMute\(/);

// Persistent AudioParams used to accumulated a new automation event on every
// 30 Hz update for the lifetime of the session. Every retarget must replace the
// pending tail before scheduling a new value.
assert.match(audio, /function smooth\([\s\S]*cancelAndHoldAtTime\(time\)[\s\S]*cancelScheduledValues\(time\)[\s\S]*setTargetAtTime\(value, time, timeConstant\)/,
  'Persistent game-audio automation must remain bounded over long sessions');
assert.match(organicRibbon, /ORGANIC_UPDATE_INTERVAL_MS = 1000 \/ 30/);
assert.match(organicRibbon, /function retarget\([\s\S]*cancelAndHoldAtTime\(now\)[\s\S]*cancelScheduledValues\(now\)[\s\S]*setTargetAtTime\(value, now, timeConstant\)/,
  'Organic ribbon automation must remain bounded');
assert.match(recoveryGuidance, /RECOVERY_UPDATE_INTERVAL_MS = 1000 \/ 30/);
assert.match(recoveryGuidance, /lastWrongWayUpdateAt/,
  'Wrong-way tone retargeting must not run at display refresh rate');
assert.match(recoveryGuidance, /function setTarget\([\s\S]*cancelAndHoldAtTime\(now\)[\s\S]*cancelScheduledValues\(now\)[\s\S]*setTargetAtTime\(value, now, timeConstant\)/,
  'Recovery guidance automation must remain bounded');
assert.match(driveByEarRuntime, /organic-ribbon\.js\?revision=r164-long-session-robustness/);
assert.match(driveByEarRuntime, /recovery-guidance\.js\?revision=r164-long-session-robustness/);

// One-shot cue graphs must become collectible instead of accumulating connected
// oscillator/filter/panner graphs for the duration of the app process.
assert.match(audio, /activeTransientSources = new Set\(\)/);
assert.match(audio, /transientNoiseBuffers = new Map\(\)/,
  'Repeated cue noise must reuse a small buffer cache instead of allocating a new AudioBuffer each cue');
assert.match(audio, /function trackTransientSource\(/);
assert.match(audio, /disconnectNodes\(\.\.\.nodes\)/);
assert.match(audio, /source\.buffer = transientNoiseBuffer\(smoothing\)/);

// Keep the exact user-tuned v3 song source untouched. Robustness lives beside it
// and repairs a scheduler/context interruption by forcing a clean stop/restart.
assert.match(homeLayout, /racing-music-v2\.js\?build=\$\{buildKey\}-racing-music-warm-v2/);
assert.match(homeLayout, /racing-music-health\.js\?build=\$\{buildKey\}&revision=r164-long-session-robustness/);
assert.match(musicHealth, /HEALTH_CHECK_INTERVAL_MS = 1000/);
assert.match(musicHealth, /music\.stop\(\)/);
assert.match(musicHealth, /music\.setVolume\(restoreVolume, \{ restart: true \}\)/);
assert.match(musicHealth, /document\.visibilityState !== 'hidden'/);
assert.doesNotMatch(musicHealth, /AudioContext|createOscillator|createBufferSource/,
  'The music health layer must not fork or rewrite the tuned music synthesis graph');

assert.doesNotMatch(audio, /requestAnimationFrame|setAnimationLoop|setInterval/);
assert.doesNotMatch(audio, /fetch\(|new Audio\(/);
assert.match(controls, /function updateAudio\(now, boosting\)/);
assert.match(controls, /globalThis\.__turnAudio\?\.update\(/);
assert.match(controls, /runtimeState\?\.mode === runtime\?\.GAME_MODE\?\.SPECTATING/);
assert.match(controls, /document\.body\.classList\.contains\('turn-lot-open'\)/);
assert.match(controls, /driftAmount: runtimeState\?\.driftAmount \|\| 0/);
assert.match(controls, /boostActive: boosting/);
assert.match(controls, /nearestRivalDistance: nearestRivalDistance\(runtime, active\)/);
assert.match(controls, /globalThis\.__turnAudio\?\.cue\('boost-empty'\)/);
assert.match(controls, /globalThis\.__turnAudio\?\.cue\('boost-full'\)/);
assert.match(controls, /if \(position < lastPosition\)/);
assert.match(controls, /globalThis\.__turnAudio\?\.cue\('overtake'/);

console.log(`TURN ${release.id} long-session audio, drift, boost and rival sound production passed.`);

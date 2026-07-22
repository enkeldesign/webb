import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, app, audio, controls, catalogSource] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

assert.match(index, /TURN v1\.5\.0 · Build 2026\.07\.22-r47/);
assert.match(index, /\.\/app\.js\?build=20260722-r47/);
assert.match(
  index,
  /"\.\/vehicle\/catalog\.js\?build=20260720-r19": "\.\/vehicle\/catalog\.js\?build=20260722-r42"/,
  'The main runtime catalog import must preserve the r42 vehicle presentation catalog'
);
assert.match(
  index,
  /"\.\/vehicle\/catalog\.js\?build=20260720-r20": "\.\/vehicle\/catalog\.js\?build=20260722-r42"/,
  'The Lot must preserve the same r42 vehicle presentation catalog'
);

assert.match(app, /import\(withBuild\('\.\/audio\/audio-system\.js'\)\)/, 'Production must load the central audio module');
assert.match(app, /installTurnAudio\(\)/, 'The audio foundation must install before gameplay starts');
assert.ok(
  app.indexOf('./audio/audio-system.js') < app.indexOf('./ui/gameplay-controls.js'),
  'Audio must install before gameplay controls begin feeding it state'
);

assert.match(audio, /globalThis\.AudioContext \|\| globalThis\.webkitAudioContext/, 'Audio must support iOS WebKit AudioContext');
assert.match(audio, /AUDIO_UPDATE_INTERVAL_MS = 1000 \/ 30/, 'Continuous audio updates must stay capped at 30 Hz');
assert.match(audio, /globalThis\.__turnAudio = api/, 'The foundation must expose one shared audio API');
assert.match(audio, /unlock,\s*update,\s*cue,\s*silence/, 'The shared audio API must expose lifecycle, continuous state, and one-shot cues');

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
assert.match(audio, /handleUiChange/);
assert.match(audio, /function handleUiClick\(/);
assert.match(audio, /document\.addEventListener\('pointerdown', unlockFromGesture/);
assert.match(audio, /document\.addEventListener\('keydown', unlockFromGesture/);
assert.match(audio, /document\.addEventListener\('visibilitychange', handleVisibilityChange/);
assert.match(audio, /window\.addEventListener\('pagehide', handlePageHide/);
assert.match(audio, /function hardMute\(/);
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

console.log('TURN drift, boost and rival sound production regression passed.');
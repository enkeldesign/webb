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

assert.match(index, /TURN v1\.3\.11 · Build 2026\.07\.21-r27/);
assert.match(index, /\.\/app\.js\?build=20260721-r27/);
assert.match(
  index,
  /"\.\/vehicle\/catalog\.js\?build=20260720-r19": "\.\/vehicle\/catalog\.js\?build=20260721-r27"/,
  'The main runtime catalog import must be cache-busted for r27 engine tuning'
);
assert.match(
  index,
  /"\.\/vehicle\/catalog\.js\?build=20260720-r20": "\.\/vehicle\/catalog\.js\?build=20260721-r27"/,
  'The Lot catalog import must resolve to the same r27 engine tuning'
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
assert.match(audio, /engineBaseHz = \(52 \+ speedRatio \* 96 \+ throttle \* 24\) \* enginePitch/, 'Per-car pitch must multiply the whole engine baseline');

for (const car of catalog.CAR_CATALOG) {
  assert.ok(Number.isFinite(car.tuning.enginePitch), `${car.name} must define an engine pitch baseline`);
  assert.ok(car.tuning.enginePitch >= 0.55 && car.tuning.enginePitch <= 1.7, `${car.name} engine pitch must stay within the supported range`);
}
assert.equal(catalog.getCarDefinition('sedan').tuning.enginePitch, 1, 'Sedan must remain the neutral engine pitch baseline');
assert.equal(catalog.getCarDefinition('monster-truck').tuning.enginePitch, 0.62, 'Monster Truck must have the lowest deep engine baseline');
assert.equal(catalog.getCarDefinition('race').tuning.enginePitch, 1.55, 'Race Car must have the highest F1-like engine baseline');
assert.ok(
  catalog.getCarDefinition('monster-truck').tuning.enginePitch < catalog.getCarDefinition('truck').tuning.enginePitch,
  'Monster Truck must sit below the regular Truck in pitch'
);
assert.ok(
  catalog.getCarDefinition('race').tuning.enginePitch > catalog.getCarDefinition('race-future').tuning.enginePitch,
  'Race Car must remain the highest-pitched racer'
);

assert.match(audio, /regularSlipLevel = active \? slipIntent \* driftSpeed \* 0\.018 : 0/, 'Ordinary cornering slip must stay very quiet');
assert.match(audio, /deliberateDriftLevel = active && driftHeld/, 'Holding DRIFT must add a distinct stronger tire layer');
assert.match(audio, /const skidLevel = active && driftHeld/, 'Skid hiss must only wake up during deliberate DRIFT');
assert.match(audio, /skidNoise\.buffer = makeNoiseBuffer\(context, 1\.1, 0\.1\)/, 'DRIFT must use a brighter separate skid texture');

assert.match(audio, /case 'garage-open':/, 'The Lot must have a restrained entrance cue');
assert.match(audio, /case 'car-select':/, 'The Lot car field must have a selection cue');
assert.match(audio, /case 'paint-select':/, 'Native paint changes must have a small confirmation cue');
assert.match(audio, /handleLotVisibilityChange/, 'The Lot entrance cue must follow the actual open state');
assert.match(audio, /handleLotPointerDown/, 'The Lot car field must feed selection sound');
assert.match(audio, /handleUiChange/, 'The Lot paint picker must feed paint sound');
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

console.log('TURN sound character production regression passed.');

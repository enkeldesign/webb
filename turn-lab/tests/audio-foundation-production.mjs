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

assert.match(index, /TURN v1\.4\.0 · Build 2026\.07\.21-r37/);
assert.match(index, /\.\/app\.js\?build=20260721-r37/);
assert.match(
  index,
  /"\.\/vehicle\/catalog\.js\?build=20260720-r19": "\.\/vehicle\/catalog\.js\?build=20260721-r35"/,
  'The main runtime catalog import must preserve the r35 orientation correction'
);
assert.match(
  index,
  /"\.\/vehicle\/catalog\.js\?build=20260720-r20": "\.\/vehicle\/catalog\.js\?build=20260721-r35"/,
  'The Lot catalog import must use the same corrected r35 catalog'
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
assert.match(audio, /function installBoostGraph\(/, 'The foundation must provide a dedicated boost one-shot bus');
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
assert.ok(
  catalog.getCarDefinition('monster-truck').tuning.enginePitch < catalog.getCarDefinition('truck').tuning.enginePitch,
  'Monster Truck must sit below the regular Truck in pitch'
);
assert.ok(
  catalog.getCarDefinition('race').tuning.enginePitch > catalog.getCarDefinition('race-future').tuning.enginePitch,
  'Race Car must remain the highest-pitched racer'
);

assert.match(audio, /regularScrubLevel = active \? slipIntent \* driftSpeed \* 0\.0032 : 0/, 'Ordinary cornering scrub must stay nearly subliminal');
assert.match(audio, /deliberateScrubLevel = active && driftHeld/, 'Holding DRIFT must crossfade in stronger tire scrub');
assert.match(audio, /const driftBedDuck = driftHeld \? 1 - strongSlip \* 0\.42 : 1/, 'Strong slip must duck the continuous spray-like bed beneath the squeal');
assert.match(audio, /driftNoise\.buffer = makeNoiseBuffer\(context, 1\.6, 0\.92\)/, 'The friction bed must use smoother, darker noise than the old spray-like layer');
assert.match(audio, /const gritLevel = active && driftHeld/, 'Deliberate DRIFT must add a separate low-mid grit layer');
assert.match(audio, /gritNoise\.buffer = makeNoiseBuffer\(context, 1\.7, 0\.95\)/, 'Drift grit must use heavily smoothed low-frequency noise rather than spray-like hiss');
assert.match(audio, /skidTone\.type = 'triangle'/, 'Strong drift must keep a controlled tonal tire squeal');
assert.match(audio, /skidTone\.frequency, 2600 \+ speedRatio \* 1800 \+ strongSlip \* 900/, 'The drift squeal must live substantially higher than the retired low whistle');
assert.match(audio, /skidPulse\.buffer = makeSkidPulseBuffer\(context, 1\.25\)/, 'The squeal must use a reusable procedural grip-slip pulse buffer');
assert.match(audio, /skidPulse\.playbackRate, 0\.8 \+ speedRatio \* 0\.35 \+ strongSlip \* 0\.55/, 'Skid chopping must accelerate with speed and slip');
assert.match(audio, /skidPulseDepth\.gain\.value = 0\.965/, 'The chopped squeal must have deep articulation rather than mild tremolo');
assert.match(audio, /function makeSkidPulseBuffer\(/, 'The skid articulation must remain procedural and deterministic');
assert.match(audio, /skidWobbleDepth\.gain, 10 \+ strongSlip \* 22/, 'The high squeal must retain subtle pitch instability under hard slip');
assert.doesNotMatch(audio, /skidNoise/, 'The spray-can-like bright skid noise loop must stay removed');

assert.match(audio, /case 'boost-start':\s*playBoostBlast\(now\);/s, 'Boost activation must trigger the dedicated short blast');
assert.match(audio, /function playBoostBlast\(/, 'Boost must use a dedicated transient designer rather than a sustain loop');
assert.match(audio, /const duration = 0\.105/, 'The main boost blast must stay around one tenth of a second');
assert.match(audio, /source\.buffer = makeNoiseBuffer\(context, 0\.14, 0\.42\)/, 'The boost blast must include a brief broad pressure-noise transient');
assert.match(audio, /no continuous oscillator\/noise bed/, 'The boost graph must remain one-shot only');
assert.doesNotMatch(audio, /const boostLevel = boostActive/, 'Boost must not restore a continuous vacuum-like sustain level');
assert.doesNotMatch(audio, /boostNoise\.loop|boostTone\.type/, 'Boost must not run a looping noise or turbine oscillator while held');
assert.match(audio, /case 'boost-empty':/, 'Boost depletion must have its own cue');
assert.match(audio, /case 'boost-full':/, 'Boost recharge completion must have its own cue');

assert.match(audio, /RIVAL_NEAR_ENTER_METERS = 10/, 'Nearby-rival sound must use a deliberate entry threshold');
assert.match(audio, /RIVAL_NEAR_EXIT_METERS = 15/, 'Nearby-rival sound must use hysteresis before it can re-trigger');
assert.match(audio, /case 'car-near':/, 'A nearby rival must have a restrained proximity cue');
assert.match(audio, /case 'overtake':/, 'Position gains must have an overtake cue');
assert.match(audio, /cueAllowed\(name, now\)/, 'Repeatable rival cues must be cooldown-protected');

assert.match(audio, /case 'garage-open':/, 'The Lot must keep its restrained entrance cue');
assert.match(audio, /case 'car-select':/, 'The Lot car field must keep its selection cue');
assert.match(audio, /case 'paint-select':/, 'Native paint changes must keep their small confirmation cue');
assert.match(audio, /handleLotVisibilityChange/, 'The Lot entrance cue must follow the actual open state');
assert.match(audio, /handleLotPointerDown/, 'The Lot car field must feed selection sound');
assert.match(audio, /handleUiChange/, 'The Lot paint picker must feed paint sound');
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
assert.match(controls, /nearestRivalDistance: nearestRivalDistance\(runtime, active\)/, 'Existing rival positions must feed proximity audio without a new loop');
assert.match(controls, /globalThis\.__turnAudio\?\.cue\('boost-empty'\)/, 'The exact empty transition must trigger its audio cue');
assert.match(controls, /globalThis\.__turnAudio\?\.cue\('boost-full'\)/, 'The exact full transition must trigger its audio cue');
assert.match(controls, /if \(position < lastPosition\)/, 'Only an improved race position may trigger the overtake cue');
assert.match(controls, /globalThis\.__turnAudio\?\.cue\('overtake'/, 'Position gains must feed the shared overtake cue');

console.log('TURN chopped drift, transient boost and rival sound production regression passed.');

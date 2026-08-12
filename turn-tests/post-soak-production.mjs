import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  FUTURE_RACER_CAR_PERK_DESCRIPTION,
  FUTURE_RACER_REWARD_PERK_DESCRIPTION,
  vehiclePerkPresentation
} from '../turn/vehicle/perk-presentation.js';

const [
  spectate,
  steeringWarning,
  lotPerk,
  lotRuntime,
  trophyWrapper,
  app,
  productionIndex,
  labIndex
] = await Promise.all([
  fs.readFile(new URL('../turn/ui/spectate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/steering-limit-warning.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/trophy-road-chromatic-r183.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8')
]);

// Spectate must use the same elevation model as ordinary rivals. Cliffside is
// the regression case: replay coordinates are X/Z only, while track progress
// supplies the authoritative road Y and pitch.
assert.match(spectate, /trackPitch, trackSampleAtProgress, trackSurfaceY/);
assert.match(spectate, /trackSampleAtProgress\(runtime\.samples, frame\?\.p\)/);
assert.match(spectate, /car\.position\.set\(frame\.x, trackSurfaceY\(surfaceSample\), frame\.z\)/);
assert.match(spectate, /car\.rotation\.x = trackPitch\(surfaceSample\)/);
assert.match(spectate, /desiredCamera\.y = surfaceY \+ 8\.6/);
assert.match(spectate, /desiredTarget\.y = surfaceY \+ 2\.15/);
assert.doesNotMatch(spectate, /car\.position\.set\(frame\.x, 0\.18, frame\.z\)/);
assert.doesNotMatch(spectate, /new THREE\.Vector3\(frame\.x, 0\.18, frame\.z\)/);

// The edge gradient stays immediate, but the informational sound/announcement
// requires a sustained hard limit so incidental millisecond touches stay quiet.
assert.match(steeringWarning, /HARD_LIMIT_CUE_HOLD_MS = 320/);
assert.match(steeringWarning, /function scheduleHardCue\(side\)/);
assert.match(steeringWarning, /if \(currentHardSide !== side\) return;/);
assert.match(steeringWarning, /cancelPendingHardCue\(\);[\s\S]*scheduleSoftRelease/);
assert.doesNotMatch(
  steeringWarning,
  /if \(detail\.enteredHard\) \{\s*playLimitCue\(\);/,
  'Entering max steering must not beep immediately'
);

assert.equal(
  FUTURE_RACER_REWARD_PERK_DESCRIPTION,
  'After a few seconds of clean driving on-track the speed cap starts increasing. Going off-track resets it.'
);
assert.equal(
  FUTURE_RACER_CAR_PERK_DESCRIPTION,
  'A few seconds of staying on-track raises speed cap. Going off-track resets it.'
);
assert.equal(
  vehiclePerkPresentation('race-future', { title: 'OVERDRIVE', description: 'old' }).description,
  FUTURE_RACER_CAR_PERK_DESCRIPTION
);
assert.equal(
  vehiclePerkPresentation('monster-truck', { title: 'OVERSIZED', description: 'unchanged' }).description,
  'unchanged',
  'Other vehicle perk copy must remain untouched'
);
assert.match(lotPerk, /vehiclePerkPresentation\(vehicleId, getCarDefinition\(vehicleId\)\?\.perk\)/);
assert.match(lotRuntime, /lot-perk-disclosure\.js\?revision=r164-post-soak/);
assert.match(trophyWrapper, /FUTURE_RACER_REWARD_PERK_DESCRIPTION/);
assert.match(trophyWrapper, /reward\.id !== 'future-racer'/);

for (const index of [productionIndex, labIndex]) {
  assert.match(
    index,
    /\/turn\/progression\/trophy-road-chromatic-r183\.js\?revision=r183-post-soak/,
    'Production and LAB must load the fresh Future Racer reward-copy wrapper'
  );
  assert.match(index, /app\.js\?build=[^"']*r164-long-session-robustness-post-soak/);
}

assert.match(app, /steering-limit-warning\.js\?revision=r164-post-soak/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r164-post-soak/);
assert.match(app, /spectate\.js\?revision=r164-elevation-aware/);

console.log('TURN post-optimisation soak fixes passed.');

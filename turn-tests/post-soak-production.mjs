import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  resolveMotionSteeringProfile,
  updateMotionInputState
} from '../turn/input/motion.js';
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

const toRadians = (degrees) => degrees * Math.PI / 180;

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

// iPadOS can identify either as iPad or as a touch-capable Mac. Only those
// environments get damping. The established iPhone/default numbers are pinned
// exactly so this compatibility fix cannot silently alter newer-iPhone feel.
const defaultProfile = resolveMotionSteeringProfile({
  navigator: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) Mobile Safari',
    platform: 'iPhone',
    maxTouchPoints: 5
  }
});
assert.equal(defaultProfile.id, 'default');
assert.equal(defaultProfile.steeringEnterThreshold, toRadians(2.2));
assert.equal(defaultProfile.steeringExitThreshold, toRadians(0.9));
assert.equal(defaultProfile.rollFollowRate, 16);
assert.equal(defaultProfile.pitchFollowRate, 12);
assert.equal(defaultProfile.steeringResponseRate, 8.5);
assert.equal(defaultProfile.steeringReleaseRate, 12);
assert.equal(defaultProfile.curvePower, 1);

const namedIPadProfile = resolveMotionSteeringProfile({
  navigator: {
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 26_5 like Mac OS X) Mobile Safari',
    platform: 'iPad',
    maxTouchPoints: 5
  }
});
const desktopIPadProfile = resolveMotionSteeringProfile({
  navigator: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Mobile Safari',
    platform: 'MacIntel',
    maxTouchPoints: 5
  }
});
for (const profile of [namedIPadProfile, desktopIPadProfile]) {
  assert.equal(profile.id, 'ipad-damped');
  assert.equal(profile.steeringEnterThreshold, toRadians(3.2));
  assert.equal(profile.steeringExitThreshold, toRadians(1.4));
  assert.equal(profile.rollFollowRate, 10.5);
  assert.equal(profile.pitchFollowRate, 12);
  assert.equal(profile.steeringResponseRate, 6.5);
  assert.equal(profile.steeringReleaseRate, 10);
  assert.equal(profile.curvePower, 1.22);
}
assert.equal(
  resolveMotionSteeringProfile({
    navigator: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari',
      platform: 'MacIntel',
      maxTouchPoints: 0
    }
  }).id,
  'default',
  'An ordinary Mac must never be mistaken for an iPad'
);

function steeringAfterFrames(profile, targetDegrees, frames = 24) {
  const state = {
    sensorMode: true,
    roll: 0,
    targetRoll: toRadians(targetDegrees),
    pitch: 0,
    targetPitch: 0,
    neutralRoll: 0,
    steering: 0,
    steeringEngaged: false,
    tiltDrive: 0
  };
  for (let frame = 0; frame < frames; frame += 1) {
    updateMotionInputState({
      state,
      dt: 1 / 60,
      maxSteerRoll: toRadians(24),
      steeringProfile: profile
    });
  }
  return state.steering;
}

const defaultMidSteer = Math.abs(steeringAfterFrames(defaultProfile, 12));
const ipadMidSteer = Math.abs(steeringAfterFrames(namedIPadProfile, 12));
assert.ok(ipadMidSteer < defaultMidSteer * 0.8,
  'The iPad profile must materially calm mid-range steering without changing the default profile');
assert.ok(Math.abs(steeringAfterFrames(namedIPadProfile, 24, 120)) > 0.99,
  'The iPad profile must still reach full steering at the canonical 24-degree limit');

assert.equal(
  FUTURE_RACER_REWARD_PERK_DESCRIPTION,
  'After a few seconds of clean driving on-track the speed cap starts increasing. Leaving the track or colliding resets it.'
);
assert.equal(
  FUTURE_RACER_CAR_PERK_DESCRIPTION,
  'A few seconds of staying on-track raises the speed cap. Leaving the track or colliding resets it.'
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
assert.match(lotRuntime, /lot-perk-disclosure\.js\?revision=r217-stable-perk-slot/);
assert.match(trophyWrapper, /FUTURE_RACER_REWARD_PERK_DESCRIPTION/);
assert.match(trophyWrapper, /reward\.id !== 'future-racer'/);

for (const index of [productionIndex, labIndex]) {
  assert.match(
    index,
    /\/turn\/progression\/trophy-road-chromatic-r183\.js\?revision=r220-race-reward/,
    'Production and LAB must load the fresh Race Car reward and Future Racer copy wrapper'
  );
  assert.match(index, /app\.js\?build=[^"']*r164-long-session-robustness-post-soak/);
  assert.match(
    index,
    /"\/turn\/input\/motion\.js": "\/turn\/input\/motion\.js\?revision=r164-ipad-motion-profile"/,
    'Production and LAB must route the race core to the fresh iPad-aware motion module'
  );
}

assert.match(app, /steering-limit-warning\.js\?revision=r164-post-soak/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r164-post-soak/);
assert.match(app, /spectate\.js\?revision=r164-elevation-aware/);

console.log('TURN post-optimisation soak fixes and isolated iPad steering profile passed.');

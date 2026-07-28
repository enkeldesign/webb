import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  createRecoveryGuidanceFrame,
  installRecoveryGuidance
} from '../../turn/audio/recovery-guidance.js';

const [releaseSource, app, recoverySource] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/recovery-guidance.js', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.match(app, /recoveryGuidance = await import\(withBuild\('\.\/audio\/recovery-guidance\.js'\)\)/);
assert.match(app, /recoveryGuidance\.prepareRecoveryGuidanceCapture\(\)/);
assert.match(app, /recoveryGuidance\.installRecoveryGuidance\(\)/);
assert.ok(
  app.indexOf('prepareRecoveryGuidanceCapture()') < app.indexOf('./audio/audio-system.js'),
  'The existing AudioContext and master gain must be observed before the core graph is created'
);
assert.ok(
  app.indexOf('installPaceNotes()') < app.indexOf('installRecoveryGuidance()')
    && app.indexOf('installRecoveryGuidance()') < app.indexOf('./audio/audio-preference-runtime.js'),
  'Recovery overrides must wrap the computed soundscape while remaining inside live DBE preferences'
);

assert.doesNotMatch(recoverySource, /new AudioContext|new webkitAudioContext|HTMLAudioElement|new Audio\(/,
  'Recovery must share TURN’s existing audio graph');
assert.match(recoverySource, /CAPTURED_GRAPH\.masterGain = node/,
  'The continuous wrong-way tone must enter through the existing master graph');
assert.match(recoverySource, /First find the road again/,
  'Off-road recovery must prioritise immediate road finding');
assert.match(recoverySource, /flowWeight = 0\.12 \+ \(1 - outsideDepth\) \* 0\.28/,
  'Race-direction alignment must blend in only as the car approaches asphalt');
assert.match(recoverySource, /baseSurfaceAmount \* \(1 - Math\.abs\(pan\) \* 0\.5\)/,
  'Centred gravel must duck beneath a strong directional ribbon');
assert.match(recoverySource, /sliderMode: 'wrong-way'/,
  'Wrong-way mode must expose a continuous directional state between warning pulses');
assert.match(recoverySource, /wrongWayPanner\.connect\(masterGain\)/,
  'The sustained wrong-way compass must share TURN’s mastered output');
assert.match(recoverySource, /settings\?\.dbeEnabled !== false/,
  'Live DBE shutdown must also silence the added recovery layer');

const forward = { x: 0, y: 0, z: 1 };
const right = { x: 1, y: 0, z: 0 };
const leftNormal = { x: -1, y: 0, z: 0 };

function makeSamples() {
  return Array.from({ length: 120 }, (_, index) => ({
    point: { x: 0, y: 0, z: index * 4 },
    tangent: forward,
    normal: leftNormal
  }));
}

function makeRuntime({
  nearestTrackIndex = 20,
  position = { x: 0, y: 0, z: nearestTrackIndex * 4 },
  velocity = { x: 0, y: 0, z: 18 },
  speed = Math.hypot(velocity.x, velocity.z),
  trackDistance = Math.abs(position.x),
  offRoad = false,
  carForward = forward,
  carRight = right,
  brake = 0
} = {}) {
  return {
    trackWidth: 27,
    samples: makeSamples(),
    state: {
      nearestTrackIndex,
      position,
      velocity,
      speed,
      trackDistance,
      offRoad,
      brake,
      running: true
    },
    getForward: () => carForward,
    getRight: () => carRight
  };
}

const normalRoad = createRecoveryGuidanceFrame(makeRuntime(), { active: true });
assert.deepEqual(normalRoad, {}, 'Normal road driving must remain owned by the universal Slider');

const offRoadLeft = createRecoveryGuidanceFrame(makeRuntime({
  position: { x: -36, y: 0, z: 80 },
  velocity: { x: 0, y: 0, z: 12 },
  speed: 12,
  trackDistance: 36,
  offRoad: true
}), { active: true });
assert.equal(offRoadLeft.sliderMode, 'recovery');
assert.equal(offRoadLeft.sliderPresence, 1);
assert.ok(offRoadLeft.sliderPan > 0.65,
  'A car left of a straight road must receive a decisive right-ear instruction toward the road');
assert.ok(offRoadLeft.recoveryTargetDistance < 45,
  'The recovery target must stay near the road instead of chasing a distant route point');
assert.ok(offRoadLeft.surfaceAmount < 0.28,
  'Strong directional recovery must push the centred surface texture into the background');

const facingTowardRoad = createRecoveryGuidanceFrame(makeRuntime({
  position: { x: -42, y: 0, z: 80 },
  velocity: { x: 10, y: 0, z: 0 },
  speed: 10,
  trackDistance: 42,
  offRoad: true,
  carForward: { x: 1, y: 0, z: 0 },
  carRight: { x: 0, y: 0, z: -1 }
}), { active: true });
const facingAwayFromRoad = createRecoveryGuidanceFrame(makeRuntime({
  position: { x: -42, y: 0, z: 80 },
  velocity: { x: -10, y: 0, z: 0 },
  speed: 10,
  trackDistance: 42,
  offRoad: true,
  carForward: { x: -1, y: 0, z: 0 },
  carRight: { x: 0, y: 0, z: 1 }
}), { active: true });
assert.ok(facingTowardRoad.recoveryHeadingError < facingAwayFromRoad.recoveryHeadingError,
  'Pointing toward the road must sound more aligned than pointing away');
assert.ok(Math.abs(facingAwayFromRoad.sliderPan) > 0.85,
  'A road target behind the car must force an unmistakable turn side');
assert.notEqual(Math.sign(facingTowardRoad.sliderPan), Math.sign(facingAwayFromRoad.sliderPan),
  'Recovery direction must change when the car faces the opposite way at the same location');

const wrongWay = createRecoveryGuidanceFrame(makeRuntime({
  velocity: { x: 0, y: 0, z: -20 },
  speed: 20,
  carForward: { x: 0, y: 0, z: -1 },
  carRight: { x: -1, y: 0, z: 0 }
}), { active: true });
assert.equal(wrongWay.wrongWay, true);
assert.equal(wrongWay.sliderMode, 'wrong-way');
assert.equal(wrongWay.sliderPresence, 1,
  'Wrong Way must retain a continuous guidance floor between alert pulses');
assert.ok(Math.abs(wrongWay.sliderPan) > 0.75,
  'Wrong Way must expose a decisive correction direction');

let forwardedFrame = null;
let settings = {
  audioEnabled: true,
  dbeEnabled: true,
  balance: 1
};
const baseAudio = {
  unlock: () => true,
  update: (frame) => { forwardedFrame = frame; },
  cue: () => {},
  silence: () => {},
  available: true,
  state: 'running'
};
globalThis.__turnAudio = baseAudio;
globalThis.__turnAudioPreferences = { getSettings: () => settings };
globalThis.__turnDriveByEarEnabled = true;
globalThis.__turnRuntime = makeRuntime({
  position: { x: -36, y: 0, z: 80 },
  velocity: { x: 0, y: 0, z: 12 },
  speed: 12,
  trackDistance: 36,
  offRoad: true
});

const enhancedAudio = installRecoveryGuidance();
enhancedAudio.update({ active: true, speed: 12 }, 100);
assert.equal(forwardedFrame.offRoad, true);
assert.equal(forwardedFrame.sliderMode, 'recovery');
assert.ok(forwardedFrame.sliderPan > 0.65,
  'The live wrapper must override the older far-ahead recovery vector');

settings = { ...settings, dbeEnabled: false };
forwardedFrame = null;
enhancedAudio.update({ active: true, speed: 12 }, 200);
assert.deepEqual(forwardedFrame, { active: true, speed: 12 },
  'Live DBE shutdown must bypass all recovery overrides');

delete globalThis.__turnAudio;
delete globalThis.__turnAudioPreferences;
delete globalThis.__turnDriveByEarEnabled;
delete globalThis.__turnRuntime;

console.log(`TURN ${release.id} near-road recovery, surface ducking and continuous wrong-way guidance passed.`);

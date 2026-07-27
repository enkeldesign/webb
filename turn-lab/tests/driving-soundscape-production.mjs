import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  createDrivingSoundscapeFrame,
  installUniversalDrivingSoundscape
} from '../../turn/audio/driving-soundscape.js';

const [releaseSource, app, audio, soundscape] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/driving-soundscape.js', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.match(app, /import\(\s*withBuild\('\.\/audio\/driving-soundscape\.js'\)\s*\)/);
assert.match(app, /installUniversalDrivingSoundscape\(\)/);
assert.ok(
  app.indexOf('./audio/audio-system.js') < app.indexOf('./audio/driving-soundscape.js')
    && app.indexOf('./audio/driving-soundscape.js') < app.indexOf('./ui/gameplay-controls.js'),
  'DBE must wrap the central audio engine before gameplay begins'
);

assert.match(soundscape, /export function createDrivingSoundscapeFrame/);
assert.match(soundscape, /export function installUniversalDrivingSoundscape/);
assert.match(soundscape, /function createTrajectorySlider\(/);
assert.match(soundscape, /function createRecoverySlider\(/,
  'A lost car needs a dedicated pure-pursuit recovery calculation');
assert.match(soundscape, /function sampleAheadByDistance\(/,
  'Recovery must target the racing line ahead rather than the nearest strip of asphalt');
assert.match(soundscape, /18 \+ trackDistance \* 0\.85 \+ speed \* 0\.55/,
  'Recovery look-ahead must expand with both distance and speed');
assert.match(soundscape, /behindAmount = smoothstep\(0\.05, 0\.86, -forwardness\)/,
  'A road target behind the car must become a decisive turn instruction rather than a centred ambiguity');
assert.match(soundscape, /currentNormalized \* 0\.36 \+ predictedNormalized \* 0\.64/,
  'The on-road slider must still combine present road position with projected trajectory');
assert.match(soundscape, /const wrongWay = !offRoad/,
  'Off-road pure pursuit must own orientation recovery instead of being silenced by Wrong Way');
assert.match(soundscape, /sliderMode: slider\.mode/);
assert.match(soundscape, /surfaceAmount: slider\.surfaceAmount/);
assert.match(soundscape, /recoveryHeadingError: slider\.recoveryHeadingError/);
assert.match(soundscape, /baseAudio\.update\(\{ \.\.\.cachedFrame, \.\.\.frame \}, now\)/,
  'The real off-road state must now reach the central mixer');
assert.doesNotMatch(soundscape, /audioFrame\.offRoad = false/,
  'The soundscape must no longer hide off-road state from the central mixer');
assert.doesNotMatch(soundscape, /AIRPORT_TRACK_ID|airportHybrid|createAirportHybridGuidance/,
  'No track may retain a private DBE generation');
assert.doesNotMatch(soundscape, /turnPulse|turnRibbon|cornerFlow|roadEdge|driftPan/,
  'Replaced DBE signals must remain absent');
assert.doesNotMatch(soundscape, /VoiceOver|screenReader|blindMode|userAgent/i);

for (const bus of ['dynamicsBus', 'guidanceBus', 'routeBus', 'worldBus', 'safetyBus']) {
  assert.match(audio, new RegExp(`let ${bus} = null`), `The central mixer must expose the ${bus} layer`);
}
assert.match(audio, /sliderTone\.type = 'sine'/,
  'The sustained ribbon must use a soft tonal fundamental rather than broadband hiss');
assert.match(audio, /sliderHarmonic\.type = 'triangle'/,
  'A restrained harmonic must preserve localisation and character');
assert.match(audio, /sliderFilter\.type = 'lowpass'/,
  'The ribbon must avoid the former sharp band-pass hiss');
assert.doesNotMatch(audio, /const sliderNoise = context\.createBufferSource/,
  'The continuous guidance source must no longer be a noise loop');
assert.match(audio, /const sliderFundamental = recoveryRibbon/,
  'Off-road recovery must retain the same tonal family with a distinct register');
assert.match(audio, /surfaceNoise\.buffer = makeNoiseBuffer\(context, 2\.4, 0\.95\)/,
  'Off-road surface must use a separate low rough texture');
assert.match(audio, /surfacePulseDepth\.connect\(surfaceGain\.gain\)/,
  'The surface layer must carry a gentle speed-linked bump pattern');
assert.match(audio, /surfaceGain\.connect\(guidanceBus\)/,
  'Surface state must remain inside the central DBE graph');
assert.match(audio, /routeBus\.gain, offRoad \|\| wrongWay \? 0 : 1/,
  'Pace notes must yield while the player is recovering');
assert.match(audio, /updateRivalProximity\(active && !offRoad && !wrongWay/,
  'Rival direction must not compete with route recovery');
assert.doesNotMatch(audio, /recoveryGain|recoveryFilter|recoveryPanner|playRecoveryCue/,
  'The retired second recovery grammar must be removed from the audio engine');
assert.match(audio, /const driftWidth = driftHeld/);
assert.doesNotMatch(audio, /driftPanner|smoothPan\(drift/,
  'DRIFT must remain centred and width-based');

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
  trackId = 'countryside',
  samples = makeSamples(),
  nearestTrackIndex = 20,
  position = { x: 0, y: 0, z: nearestTrackIndex * 4 },
  velocity = { x: 0, y: 0, z: 18 },
  speed = Math.hypot(velocity.x, velocity.z),
  trackDistance = Math.abs(position.x),
  offRoad = false,
  carForward = forward,
  carRight = right,
  lapActive = true,
  rivals = []
} = {}) {
  return {
    trackId,
    trackWidth: 27,
    samples,
    state: {
      trackId,
      nearestTrackIndex,
      position,
      velocity,
      speed,
      trackDistance,
      offRoad,
      brake: 0,
      lapActive
    },
    getForward: () => carForward,
    getRight: () => carRight,
    playerCar: { position },
    competitorCars: rivals
  };
}

const centred = createDrivingSoundscapeFrame(makeRuntime());
assert.equal(centred.sliderMode, 'road');
assert.ok(centred.sliderPresence > 0.9, 'Normal driving must keep the Slider present even in a safe corridor');
assert.ok(centred.sliderRisk < 0.05, 'A centred straight trajectory must sound calm');
assert.equal(centred.sliderPan, 0, 'A safe trajectory must settle near the centre');
assert.equal(centred.surfaceAmount, 0);

const movingRight = createDrivingSoundscapeFrame(makeRuntime({
  velocity: { x: 12, y: 0, z: 18 },
  speed: 22
}));
assert.ok(movingRight.sliderRisk > 0.4, 'A substantial projected correction must create strong audible risk');
assert.ok(Math.abs(movingRight.sliderPan) > 0.6, 'A substantial projected correction must produce unmistakable stereo guidance');

for (const trackId of ['countryside', 'airport', 'cliffside', 'harbor']) {
  const frame = createDrivingSoundscapeFrame(makeRuntime({
    trackId,
    velocity: { x: 12, y: 0, z: 18 },
    speed: 22
  }));
  assert.ok(frame.sliderPresence > 0.9, `${trackId} must use the central Slider`);
  assert.ok(frame.sliderRisk > 0.4, `${trackId} must expose the same strong correction risk`);
  assert.ok(Math.abs(frame.sliderPan) > 0.6, `${trackId} must use identical trajectory semantics`);
}

const offRoadForward = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -32, y: 0, z: 80 },
  velocity: { x: 0, y: 0, z: 12 },
  speed: 12,
  trackDistance: 32,
  offRoad: true
}));
assert.equal(offRoadForward.sliderMode, 'recovery');
assert.equal(offRoadForward.sliderPresence, 1);
assert.ok(offRoadForward.sliderRisk >= 0.8);
assert.ok(offRoadForward.surfaceAmount > 0.5, 'Leaving asphalt must expose a qualitative surface state');
assert.ok(offRoadForward.recoveryTargetDistance > offRoadForward.trackDistance,
  'Recovery must aim ahead on the route rather than only at the nearest edge');
assert.ok(Math.abs(offRoadForward.sliderPan) > 0.2,
  'A parallel car far from the road must receive a clear merge instruction');

const facingTowardRoad = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -42, y: 0, z: 80 },
  velocity: { x: 10, y: 0, z: 0 },
  speed: 10,
  trackDistance: 42,
  offRoad: true,
  carForward: { x: 1, y: 0, z: 0 },
  carRight: { x: 0, y: 0, z: -1 }
}));
const facingAwayFromRoad = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -42, y: 0, z: 80 },
  velocity: { x: -10, y: 0, z: 0 },
  speed: 10,
  trackDistance: 42,
  offRoad: true,
  carForward: { x: -1, y: 0, z: 0 },
  carRight: { x: 0, y: 0, z: 1 }
}));
assert.ok(facingTowardRoad.recoveryHeadingError < facingAwayFromRoad.recoveryHeadingError,
  'Heading toward the route must sound more aligned than heading away from it');
assert.ok(Math.abs(facingAwayFromRoad.sliderPan) > 0.85,
  'A recovery target behind the car must force an unmistakable turn side');
assert.notEqual(
  Math.sign(facingTowardRoad.sliderPan),
  Math.sign(facingAwayFromRoad.sliderPan),
  'The same location must produce different steering guidance when the car faces toward versus away from the route'
);

const offRoadBackwards = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -30, y: 0, z: 80 },
  velocity: { x: 0, y: 0, z: -15 },
  speed: 15,
  trackDistance: 30,
  offRoad: true,
  carForward: { x: 0, y: 0, z: -1 },
  carRight: { x: -1, y: 0, z: 0 }
}));
assert.equal(offRoadBackwards.wrongWay, false, 'Off-road recovery must not be replaced by the generic Wrong Way alarm');
assert.equal(offRoadBackwards.sliderMode, 'recovery');
assert.ok(Math.abs(offRoadBackwards.sliderPan) > 0.85, 'A backwards lost car must be told decisively which way to turn');

const wrongWay = createDrivingSoundscapeFrame(makeRuntime({
  carForward: { x: 0, y: 0, z: -1 },
  carRight: { x: -1, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: -20 },
  speed: 20
}));
assert.equal(wrongWay.wrongWay, true);
assert.equal(wrongWay.sliderPresence, 0, 'Wrong Way must still replace normal on-road Slider guidance');

const rivalLeft = createDrivingSoundscapeFrame(makeRuntime({
  rivals: [{ visible: true, position: { x: -5, y: 0, z: 84 } }]
}));
assert.ok(rivalLeft.nearestRivalDistance < 7);
assert.ok(rivalLeft.nearestRivalPan < -0.7);

let forwardedFrame = null;
const baseAudio = {
  unlock: () => true,
  update: (frame) => { forwardedFrame = frame; },
  cue: () => {},
  silence: () => {},
  available: true,
  state: 'running'
};
globalThis.__turnAudio = baseAudio;
globalThis.__turnRuntime = makeRuntime({
  trackId: 'harbor',
  position: { x: -32, y: 0, z: 80 },
  velocity: { x: 0, y: 0, z: 12 },
  speed: 12,
  trackDistance: 32,
  offRoad: true
});
const enhancedAudio = installUniversalDrivingSoundscape();
enhancedAudio.update({ active: true, speed: 12 }, 100);
assert.equal(forwardedFrame.offRoad, true, 'The central mixer must receive the real surface state');
assert.equal(forwardedFrame.sliderMode, 'recovery');
assert.ok(forwardedFrame.surfaceAmount > 0.5);
assert.equal('turnDirection' in forwardedFrame, false);
assert.equal('cornerFlow' in forwardedFrame, false);
delete globalThis.__turnAudio;
delete globalThis.__turnRuntime;

console.log(`TURN ${release.id} pleasant ribbon, surface state and pure-pursuit recovery passed.`);

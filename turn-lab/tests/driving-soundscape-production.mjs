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
assert.match(soundscape, /currentNormalized \* 0\.36 \+ predictedNormalized \* 0\.64/,
  'The slider must combine present road position with projected trajectory');
assert.match(soundscape, /sliderPresence: slider\.presence/);
assert.match(soundscape, /sliderRisk: slider\.risk/);
assert.match(soundscape, /sliderPan: slider\.pan/);
assert.doesNotMatch(soundscape, /AIRPORT_TRACK_ID|airportHybrid|createAirportHybridGuidance/,
  'No track may retain a private DBE generation');
assert.doesNotMatch(soundscape, /turnPulse|turnRibbon|cornerFlow|roadEdge|driftPan/,
  'Replaced DBE signals must be removed rather than muted');
assert.doesNotMatch(soundscape, /VoiceOver|screenReader|blindMode|userAgent/i);

for (const bus of ['dynamicsBus', 'guidanceBus', 'routeBus', 'worldBus', 'safetyBus']) {
  assert.match(audio, new RegExp(`let ${bus} = null`), `The central mixer must expose the ${bus} layer`);
}
assert.match(audio, /function installDbeGraphs\(/);
assert.match(audio, /const sliderLevel = sliderActive[\s\S]*0\.026 \+ sliderRisk \* 0\.04/,
  'The Slider needs a guaranteed audible floor and more level as risk rises');
assert.match(audio, /smooth\(dynamicsBus\.gain, Math\.min\(sliderDuck, routeDuck, safetyDuck\)/,
  'Dynamics must duck centrally rather than forcing guidance to shout');
assert.match(audio, /const driftWidth = driftHeld/);
assert.match(audio, /driftLeftGain\.gain/);
assert.match(audio, /driftRightGain\.gain/);
assert.doesNotMatch(audio, /driftPanner|smoothPan\(drift/,
  'DRIFT must describe grip loss through centred width, not a competing steering direction');
assert.doesNotMatch(audio, /playTurnCue|installRoadGuidanceGraph|edgeRumbleLevel/,
  'Turn Pulse and Road Edge must not survive inside the new mixer');
assert.match(audio, /if \(safetyMode !== 'none'\) stopPaceNoteSources\(\)/,
  'Recovery and Wrong Way must replace normal route guidance');
assert.match(audio, /panner\.connect\(routeBus\)/,
  'Pace notes must live on the route layer');
assert.match(audio, /recoveryPanner\.connect\(safetyBus\)/,
  'Recovery must live on the safety layer');
assert.match(audio, /case 'car-near':[\s\S]*worldBus/,
  'Directional rival information must remain a short world-object cue');

const forward = { x: 0, y: 0, z: 1 };
const right = { x: 1, y: 0, z: 0 };
const leftNormal = { x: -1, y: 0, z: 0 };

function makeSamples() {
  return Array.from({ length: 40 }, (_, index) => ({
    point: { x: 0, y: 0, z: index * 4 },
    tangent: forward,
    normal: leftNormal
  }));
}

function makeRuntime({
  trackId = 'countryside',
  samples = makeSamples(),
  nearestTrackIndex = 4,
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
assert.ok(centred.sliderPresence > 0.9, 'Normal driving must keep the Slider present even in a safe corridor');
assert.ok(centred.sliderRisk < 0.05, 'A centred straight trajectory must sound calm');
assert.equal(centred.sliderPan, 0, 'A safe trajectory must settle near the centre');

const movingRight = createDrivingSoundscapeFrame(makeRuntime({
  velocity: { x: 12, y: 0, z: 18 },
  speed: 22
}));
assert.ok(movingRight.sliderRisk > 0.15, 'A projected path toward the right edge must create meaningful risk without freezing listening calibration');
assert.ok(movingRight.sliderPan > 0.5, 'The Slider must move toward the threatened right edge');

const leftOfCentre = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -10, y: 0, z: 16 },
  velocity: { x: 0, y: 0, z: 18 },
  trackDistance: 10
}));
assert.ok(leftOfCentre.sliderPan < -0.35, 'Current left-side position must influence the combined Slider value');

for (const trackId of ['countryside', 'airport', 'cliffside', 'harbor']) {
  const frame = createDrivingSoundscapeFrame(makeRuntime({
    trackId,
    velocity: { x: 12, y: 0, z: 18 },
    speed: 22
  }));
  assert.ok(frame.sliderPresence > 0.9, `${trackId} must use the central Slider`);
  assert.ok(frame.sliderPan > 0.5, `${trackId} must use identical trajectory semantics`);
  assert.equal('airportHybrid' in frame, false, `${trackId} must expose no track-specific DBE flag`);
}

const offRoad = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -19, y: 0, z: 16 },
  trackDistance: 19,
  offRoad: true
}));
assert.equal(offRoad.offRoad, true);
assert.equal(offRoad.sliderPresence, 0, 'The Slider must yield completely to recovery');
assert.equal(offRoad.sliderRisk, 0);
assert.ok(offRoad.recoveryUrgency > 0.5);
assert.ok(offRoad.recoveryPan > 0.8, 'Recovery must point back toward road centre');

const wrongWay = createDrivingSoundscapeFrame(makeRuntime({
  carForward: { x: 0, y: 0, z: -1 },
  velocity: { x: 0, y: 0, z: -20 },
  speed: 20
}));
assert.equal(wrongWay.wrongWay, true);
assert.equal(wrongWay.sliderPresence, 0, 'Wrong Way must replace normal Slider guidance');

const rivalLeft = createDrivingSoundscapeFrame(makeRuntime({
  rivals: [{
    visible: true,
    position: { x: -5, y: 0, z: 20 }
  }]
}));
assert.ok(rivalLeft.nearestRivalDistance < 7);
assert.ok(rivalLeft.nearestRivalPan < -0.7, 'Nearby rivals must remain short directional object cues');

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
  velocity: { x: 12, y: 0, z: 18 },
  speed: 22
});
const enhancedAudio = installUniversalDrivingSoundscape();
enhancedAudio.update({ active: true, speed: 22 }, 100);
assert.equal(forwardedFrame.active, true);
assert.equal(forwardedFrame.speed, 22);
assert.ok(forwardedFrame.sliderPresence > 0.9);
assert.ok(forwardedFrame.sliderPan > 0.5);
assert.equal('turnDirection' in forwardedFrame, false);
assert.equal('cornerFlow' in forwardedFrame, false);
delete globalThis.__turnAudio;
delete globalThis.__turnRuntime;

console.log(`TURN ${release.id} universal layered DBE v2 production passed.`);

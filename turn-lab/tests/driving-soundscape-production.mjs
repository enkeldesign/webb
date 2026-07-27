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
assert.match(soundscape, /smoothstep\(0\.18, 0\.86, magnitude\)/,
  'Meaningful corrections must enter the risk curve early enough to be audible');
assert.match(soundscape, /smoothstep\(0\.04, 0\.78, magnitude\)/,
  'Meaningful corrections must move clearly outside the stereo centre');
assert.match(soundscape, /0\.78 \+ offRoadDepth \* 0\.22/,
  'Leaving the road must intensify the existing Slider risk');
assert.match(soundscape, /Math\.max\(smoothstep\(0\.04, 0\.78, magnitude\), 0\.82 \+ offRoadDepth \* 0\.18\)/,
  'The same Slider side must become harder to miss off road');
assert.match(soundscape, /if \(cachedFrame\.offRoad\) audioFrame\.offRoad = false/,
  'The legacy second recovery cue must not receive the off-road flag');
assert.match(soundscape, /sliderPresence: slider\.presence/);
assert.match(soundscape, /sliderRisk: slider\.risk/);
assert.match(soundscape, /sliderPan: slider\.pan/);
assert.doesNotMatch(soundscape, /recoveryPan|recoveryUrgency/,
  'The soundscape frame must expose no competing recovery direction');
assert.doesNotMatch(soundscape, /AIRPORT_TRACK_ID|airportHybrid|createAirportHybridGuidance/,
  'No track may retain a private DBE generation');
assert.doesNotMatch(soundscape, /turnPulse|turnRibbon|cornerFlow|roadEdge|driftPan/,
  'Replaced DBE signals must remain absent');
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
assert.match(audio, /panner\.connect\(routeBus\)/,
  'Pace notes must live on the route layer');
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
  assert.equal('airportHybrid' in frame, false, `${trackId} must expose no track-specific DBE flag`);
}

const nearLeftEdge = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -10, y: 0, z: 16 },
  velocity: { x: 0, y: 0, z: 10 },
  speed: 10,
  trackDistance: 10
}));
const offRoadLeft = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -19, y: 0, z: 16 },
  velocity: { x: 0, y: 0, z: 10 },
  speed: 10,
  trackDistance: 19,
  offRoad: true
}));
assert.equal(offRoadLeft.offRoad, true);
assert.equal(offRoadLeft.sliderPresence, 1, 'The Slider must continue at full presence off road');
assert.ok(offRoadLeft.sliderRisk > nearLeftEdge.sliderRisk, 'Crossing the edge must intensify the same ribbon');
assert.equal(Math.sign(offRoadLeft.sliderPan), Math.sign(nearLeftEdge.sliderPan), 'The steering side must not flip at the road edge');
assert.ok(Math.abs(offRoadLeft.sliderPan) >= Math.abs(nearLeftEdge.sliderPan), 'Off-road urgency must strengthen rather than replace the ribbon');
assert.equal('recoveryPan' in offRoadLeft, false);
assert.equal('recoveryUrgency' in offRoadLeft, false);

const nearRightEdge = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: 10, y: 0, z: 16 },
  velocity: { x: 0, y: 0, z: 10 },
  speed: 10,
  trackDistance: 10
}));
const offRoadRight = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: 19, y: 0, z: 16 },
  velocity: { x: 0, y: 0, z: 10 },
  speed: 10,
  trackDistance: 19,
  offRoad: true
}));
assert.equal(Math.sign(offRoadRight.sliderPan), Math.sign(nearRightEdge.sliderPan), 'The opposite edge must preserve its own ribbon direction too');
assert.ok(Math.abs(offRoadRight.sliderPan) >= Math.abs(nearRightEdge.sliderPan));

const wrongWay = createDrivingSoundscapeFrame(makeRuntime({
  carForward: { x: 0, y: 0, z: -1 },
  velocity: { x: 0, y: 0, z: -20 },
  speed: 20
}));
assert.equal(wrongWay.wrongWay, true);
assert.equal(wrongWay.sliderPresence, 0, 'Wrong Way must still replace normal Slider guidance');

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
assert.ok(forwardedFrame.sliderRisk > 0.4);
assert.ok(Math.abs(forwardedFrame.sliderPan) > 0.6);

globalThis.__turnRuntime = makeRuntime({
  trackId: 'harbor',
  position: { x: -19, y: 0, z: 16 },
  velocity: { x: 0, y: 0, z: 10 },
  speed: 10,
  trackDistance: 19,
  offRoad: true
});
enhancedAudio.update({ active: true, speed: 10 }, 200);
assert.equal(forwardedFrame.offRoad, false, 'The base engine must not enter the second recovery grammar');
assert.equal(forwardedFrame.sliderPresence, 1);
assert.ok(forwardedFrame.sliderRisk > 0.78);
assert.equal('turnDirection' in forwardedFrame, false);
assert.equal('cornerFlow' in forwardedFrame, false);
delete globalThis.__turnAudio;
delete globalThis.__turnRuntime;

console.log(`TURN ${release.id} continuous normative Slider production passed.`);

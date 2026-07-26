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
  'The universal soundscape must wrap the central audio engine before gameplay begins'
);

assert.match(soundscape, /export function createDrivingSoundscapeFrame/);
assert.match(soundscape, /export function installUniversalDrivingSoundscape/);
assert.match(soundscape, /baseAudio\.update\(\{ \.\.\.cachedFrame, \.\.\.frame \}, now\)/);
assert.doesNotMatch(soundscape, /VoiceOver|screenReader|blindMode|userAgent/i);

assert.match(audio, /function installRoadGuidanceGraph\(/);
assert.match(audio, /createStereoPanner/);
assert.match(audio, /smoothPan\(driftPanner/);
assert.match(audio, /const edgeRumbleLevel = active \? Math\.pow\(edgeProximity, 1\.65\) \* 0\.018 : 0/);
assert.match(audio, /function playTurnCue\(/);
assert.match(audio, /const panMagnitude = 0\.88 \+ proximity \* 0\.12/);
assert.match(audio, /const pan = direction < 0 \? -panMagnitude : panMagnitude/);
assert.match(audio, /const level = 0\.024 \+ severity \* 0\.022/);
assert.match(audio, /playTone\(start \* 1\.72, end \* 1\.72/, 'The turn pulse needs a bright overtone that survives deliberate drift audio');
assert.doesNotMatch(audio, /const left = direction < 0/, 'Turn direction must not use different pitch vocabularies for left and right');
assert.match(audio, /function playRecoveryCue\(/);
assert.match(audio, /function playWrongWayCue\(/);
assert.match(audio, /nearestRivalPan/);
assert.match(audio, /case 'car-near':[\s\S]*const pan = clamp/);

const forward = { x: 0, y: 0, z: 1 };
const right = { x: 1, y: 0, z: 0 };
const leftNormal = { x: -1, y: 0, z: 0 };

function makeSamples(turn = 'straight') {
  return Array.from({ length: 24 }, (_, index) => {
    let tangent = forward;
    if (index >= 7) {
      const progress = Math.min(1, (index - 6) / 8);
      if (turn === 'left') tangent = normalize({ x: -progress, y: 0, z: 1 - progress * 0.45 });
      if (turn === 'right') tangent = normalize({ x: progress, y: 0, z: 1 - progress * 0.45 });
    }
    return {
      point: { x: 0, y: 0, z: index * 4 },
      tangent,
      normal: leftNormal
    };
  });
}

function makeRuntime({
  samples = makeSamples(),
  position = { x: 0, y: 0, z: 0 },
  velocity = { x: 0, y: 0, z: 18 },
  speed = Math.hypot(velocity.x, velocity.z),
  trackDistance = Math.abs(position.x),
  offRoad = false,
  carForward = forward,
  lapActive = true,
  rivals = []
} = {}) {
  return {
    trackWidth: 27,
    samples,
    state: {
      nearestTrackIndex: 0,
      position,
      velocity,
      speed,
      trackDistance,
      offRoad,
      brake: 0,
      lapActive
    },
    getForward: () => carForward,
    getRight: () => right,
    playerCar: { position },
    competitorCars: rivals
  };
}

const leftTurn = createDrivingSoundscapeFrame(makeRuntime({ samples: makeSamples('left') }));
assert.equal(leftTurn.turnDirection, -1, 'A left bend must produce a left directional cue');
assert.ok(leftTurn.turnSeverity > 0.1);
assert.ok(Number.isFinite(leftTurn.turnDistance));

const rightTurn = createDrivingSoundscapeFrame(makeRuntime({ samples: makeSamples('right') }));
assert.equal(rightTurn.turnDirection, 1, 'A right bend must produce a right directional cue');

const leftEdge = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -12, y: 0, z: 0 },
  trackDistance: 12
}));
assert.ok(leftEdge.edgeProximity > 0.7, 'Road-edge rumble must emerge before leaving the asphalt');
assert.ok(leftEdge.edgePan < -0.9, 'The physical edge sound must come from the left edge');
assert.ok(leftEdge.recoveryPan > 0.9, 'Recovery guidance must point back toward road centre');

const offRoad = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -19, y: 0, z: 0 },
  trackDistance: 19,
  offRoad: true
}));
assert.equal(offRoad.offRoad, true);
assert.ok(offRoad.recoveryUrgency > 0.5);

const slidingRight = createDrivingSoundscapeFrame(makeRuntime({
  velocity: { x: 14, y: 0, z: 12 },
  speed: 18
}));
assert.ok(slidingRight.driftPan > 0.8, 'Existing tyre scrub must reveal the direction of lateral slip');

const wrongWay = createDrivingSoundscapeFrame(makeRuntime({
  carForward: { x: 0, y: 0, z: -1 },
  speed: 20
}));
assert.equal(wrongWay.wrongWay, true, 'Sustained opposite heading must be available to the wrong-way cue');

const rivalLeft = createDrivingSoundscapeFrame(makeRuntime({
  rivals: [{
    visible: true,
    position: { x: -5, y: 0, z: 4 }
  }]
}));
assert.ok(rivalLeft.nearestRivalDistance < 7);
assert.ok(rivalLeft.nearestRivalPan < -0.7, 'The existing nearby-rival cue must become directional');

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
globalThis.__turnRuntime = makeRuntime({ samples: makeSamples('left') });
const enhancedAudio = installUniversalDrivingSoundscape();
enhancedAudio.update({ active: true, speed: 22 }, 100);
assert.equal(forwardedFrame.active, true);
assert.equal(forwardedFrame.speed, 22);
assert.equal(forwardedFrame.turnDirection, -1);
assert.ok('edgeProximity' in forwardedFrame);
delete globalThis.__turnAudio;
delete globalThis.__turnRuntime;

console.log(`TURN ${release.id} universal driving soundscape production passed.`);

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}

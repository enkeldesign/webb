import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  applyCornerFlowToAudioFrame,
  createAirportHybridGuidance,
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
assert.match(soundscape, /export function createAirportHybridGuidance/);
assert.match(soundscape, /export function applyCornerFlowToAudioFrame/);
assert.match(soundscape, /export function installUniversalDrivingSoundscape/);
assert.match(soundscape, /baseAudio\.update\(applyCornerFlowToAudioFrame\(\{ \.\.\.cachedFrame, \.\.\.frame \}\), now\)/);
assert.match(soundscape, /direction: -Math\.sign\(strongestAngle\)/, 'The verified production channel inversion must stay corrected at the turn source');
assert.match(soundscape, /function scoreCornerFlow\(/);
assert.match(soundscape, /function createTrajectoryCue\(/);
assert.match(soundscape, /roadEdgeEnabled: !airportHybrid/);
assert.match(soundscape, /turnPulseEnabled: !airportHybrid/);
assert.match(soundscape, /cornerFlow = airportHybrid[\s\S]*\? 0/);
assert.match(soundscape, /turnDirection: airportHybrid \? 0 : upcomingTurn\.direction/);
assert.doesNotMatch(soundscape, /VoiceOver|screenReader|blindMode|userAgent/i);

assert.match(audio, /function installRoadGuidanceGraph\(/);
assert.equal(
  (audio.match(/function installRoadGuidanceGraph\(/g) || []).length,
  1,
  'AIRPORT must reuse the one existing road-texture graph rather than adding another continuous sound'
);
assert.match(audio, /createStereoPanner/);
assert.match(audio, /smoothPan\(driftPanner/);
assert.match(audio, /const edgeRumbleLevel = active \? Math\.pow\(edgeProximity, 1\.65\) \* 0\.018 : 0/);
assert.match(audio, /function playTurnCue\(/);
assert.match(audio, /const panMagnitude = 0\.88 \+ proximity \* 0\.12/);
assert.match(audio, /const pan = direction < 0 \? -panMagnitude : panMagnitude/);
assert.match(audio, /const level = 0\.024 \+ severity \* 0\.022/);
assert.match(audio, /playTone\(start \* 1\.72, end \* 1\.72/, 'The turn pulse on the other tracks needs its bright overtone');
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
      // TURN's track/minimap winding is mirrored relative to the raw signed X/Z angle.
      if (turn === 'left') tangent = normalize({ x: progress, y: 0, z: 1 - progress * 0.45 });
      if (turn === 'right') tangent = normalize({ x: -progress, y: 0, z: 1 - progress * 0.45 });
    }
    return {
      point: { x: 0, y: 0, z: index * 4 },
      tangent,
      normal: leftNormal
    };
  });
}

function makeRuntime({
  trackId = 'countryside',
  samples = makeSamples(),
  nearestTrackIndex = 0,
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

const leftTurn = createDrivingSoundscapeFrame(makeRuntime({ samples: makeSamples('left') }));
assert.equal(leftTurn.turnDirection, -1, 'A left bend must produce a pulse in the left ear outside AIRPORT');
assert.ok(leftTurn.turnSeverity > 0.1);
assert.ok(Number.isFinite(leftTurn.turnDistance));

const rightTurn = createDrivingSoundscapeFrame(makeRuntime({ samples: makeSamples('right') }));
assert.equal(rightTurn.turnDirection, 1, 'A right bend must produce a pulse in the right ear outside AIRPORT');

const leftEdge = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -12, y: 0, z: 0 },
  trackDistance: 12
}));
assert.ok(leftEdge.edgeProximity > 0.7, 'Road-edge rumble must remain on the other tracks');
assert.ok(leftEdge.edgePan < -0.9, 'The physical edge sound must come from the left edge');
assert.ok(leftEdge.recoveryPan > 0.9, 'Recovery guidance must point back toward road centre');

const offRoad = createDrivingSoundscapeFrame(makeRuntime({
  position: { x: -19, y: 0, z: 0 },
  trackDistance: 19,
  offRoad: true
}));
assert.equal(offRoad.offRoad, true);
assert.ok(offRoad.recoveryUrgency > 0.5);
assert.equal(offRoad.cornerFlow, 0, 'Recovery information must always take priority over corner-flow reward');

const slidingRight = createDrivingSoundscapeFrame(makeRuntime({
  velocity: { x: 14, y: 0, z: 12 },
  speed: 18
}));
assert.ok(slidingRight.driftPan > 0.8, 'Existing tyre scrub must reveal the direction of lateral slip');

const cornerSamples = makeSamples('left');
const cornerIndex = 10;
const cornerVelocity = scale(cornerSamples[cornerIndex].tangent, 22);
const cleanCorner = createDrivingSoundscapeFrame(makeRuntime({
  samples: cornerSamples,
  nearestTrackIndex: cornerIndex,
  position: cornerSamples[cornerIndex].point,
  velocity: cornerVelocity,
  speed: 22,
  carForward: cornerSamples[cornerIndex].tangent
}));
assert.ok(cleanCorner.cornerSeverity > 0.05, 'Current curvature must be available to the corner-flow score');
assert.ok(cleanCorner.cornerFlow > 0.15, 'A fast, aligned, on-road turn should produce audible corner flow outside AIRPORT');

const rawAudioFrame = { driftAmount: 0.8, enginePitch: 1, cornerFlow: 0.75 };
const flowedAudioFrame = applyCornerFlowToAudioFrame(rawAudioFrame);
assert.ok(flowedAudioFrame.driftAmount < rawAudioFrame.driftAmount, 'A clean corner should soften tyre grit without changing physics');
assert.ok(flowedAudioFrame.enginePitch > rawAudioFrame.enginePitch, 'A clean corner should tighten the audible engine note');
assert.equal(rawAudioFrame.driftAmount, 0.8, 'Audio shaping must not mutate gameplay state');

const airportTrajectory = createDrivingSoundscapeFrame(makeRuntime({
  trackId: 'airport',
  velocity: { x: 16, y: 0, z: 18 },
  speed: 24
}));
assert.equal(airportTrajectory.airportHybrid, true);
assert.equal(airportTrajectory.roadEdgeEnabled, false, 'AIRPORT must replace ROAD EDGE rather than layer on top of it');
assert.equal(airportTrajectory.turnPulseEnabled, false, 'AIRPORT must replace TURN PULSE rather than layer on top of it');
assert.equal(airportTrajectory.turnDirection, 0, 'The legacy recurring pulse must receive no AIRPORT turn direction');
assert.equal(airportTrajectory.cornerFlow, 0, 'CORNER FLOW must be fully disabled on AIRPORT');
assert.ok(airportTrajectory.trajectoryRisk > 0.5, 'A projected path toward the right edge must create meaningful risk');
assert.ok(airportTrajectory.trajectoryPan > 0.9, 'Trajectory danger must sound from the threatened right side');
assert.equal(airportTrajectory.guidanceSource, 'trajectory');

const airportRibbon = createDrivingSoundscapeFrame(makeRuntime({
  trackId: 'airport',
  samples: cornerSamples,
  nearestTrackIndex: cornerIndex,
  position: cornerSamples[cornerIndex].point,
  velocity: cornerVelocity,
  speed: 22,
  carForward: cornerSamples[cornerIndex].tangent
}));
assert.equal(airportRibbon.cornerFlow, 0);
assert.equal(airportRibbon.turnDirection, 0);
assert.equal(airportRibbon.turnRibbonDirection, -1, 'A left AIRPORT corner must hold the ribbon in the left ear');
assert.ok(airportRibbon.turnRibbonStrength > 0.1, 'Current AIRPORT curvature must produce a continuous ribbon');
assert.ok(airportRibbon.edgeProximity > 0, 'The ribbon must reuse the existing continuous road-texture bridge');
assert.ok(airportRibbon.edgePan < 0, 'The ribbon texture must sit on the curve side');

const ribbonOnly = createAirportHybridGuidance({
  trajectoryRisk: 0,
  trajectoryPan: 1,
  turnDirection: -1,
  turnSeverity: 0.4,
  speed: 24
});
assert.equal(ribbonOnly.source, 'ribbon');
assert.ok(ribbonOnly.pan < -0.7);

const trajectoryOverridesRibbon = createAirportHybridGuidance({
  trajectoryRisk: 0.92,
  trajectoryPan: 1,
  turnDirection: -1,
  turnSeverity: 0.4,
  speed: 24
});
assert.equal(trajectoryOverridesRibbon.source, 'trajectory');
assert.ok(trajectoryOverridesRibbon.pan > 0.6, 'Trajectory risk must take over the shared texture instead of competing with the ribbon');

const airportRecovery = createDrivingSoundscapeFrame(makeRuntime({
  trackId: 'airport',
  position: { x: -19, y: 0, z: 0 },
  trackDistance: 19,
  offRoad: true
}));
assert.equal(airportRecovery.trajectoryRisk, 0);
assert.equal(airportRecovery.turnRibbonStrength, 0);
assert.equal(airportRecovery.edgeProximity, 0, 'AIRPORT live guidance must yield completely to off-road recovery');
assert.ok(airportRecovery.recoveryUrgency > 0.5);

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
assert.ok(rivalLeft.nearestRivalPan < -0.7, 'The existing nearby-rival cue must remain directional');

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
assert.ok('cornerFlow' in forwardedFrame);
assert.ok('trajectoryRisk' in forwardedFrame);
delete globalThis.__turnAudio;
delete globalThis.__turnRuntime;

console.log(`TURN ${release.id} AIRPORT RAD hybrid and universal soundscape production passed.`);

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}

function scale(vector, amount) {
  return {
    x: vector.x * amount,
    y: vector.y * amount,
    z: vector.z * amount
  };
}

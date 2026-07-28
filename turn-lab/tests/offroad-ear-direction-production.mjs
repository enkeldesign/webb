import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createDrivingSoundscapeFrame } from '../../turn/audio/driving-soundscape.js';
import {
  createOffroadEarDirectionFrame,
  installOffroadEarDirection
} from '../../turn/audio/offroad-ear-direction.js';

const [releaseSource, app, source] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/offroad-ear-direction.js', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.match(app, /withBuild\('\.\/audio\/offroad-ear-direction\.js'\)/);
assert.ok(
  app.indexOf('installOffroadEarDirection()') < app.indexOf('recoveryGuidance.installRecoveryGuidance()'),
  'The route-side continuity check must sit inside the outer recovery wrapper'
);
assert.match(source, /One rule on asphalt and beyond it/,
  'The ribbon must keep one route-side meaning across the road edge');
assert.match(source, /sliderPan: -Math\.sign\(optimalRouteSide\) \* magnitude/,
  'Off-road guidance must use the same mixer sign convention as the proven on-road ribbon');
assert.doesNotMatch(source, /AudioContext|webkitAudioContext|createOscillator|createBufferSource/,
  'The correction must reuse the existing ribbon rather than creating another sound grammar');

const forward = { x: 0, y: 0, z: 1 };
const right = { x: 1, y: 0, z: 0 };
const samples = Array.from({ length: 80 }, (_, index) => ({
  point: { x: 0, y: 0, z: index * 4 },
  tangent: forward,
  normal: { x: -1, y: 0, z: 0 }
}));

function runtimeAt(x, { offRoad = true } = {}) {
  const index = 20;
  const position = { x, y: 0, z: index * 4 };
  return {
    trackWidth: 27,
    samples,
    state: {
      position,
      velocity: { x: 0, y: 0, z: 16 },
      speed: 16,
      nearestTrackIndex: index,
      trackDistance: Math.abs(x),
      offRoad,
      heading: 0,
      brake: 0,
      running: true
    },
    getForward: () => forward,
    getRight: () => right,
    competitorCars: []
  };
}

const onRoadLeft = createDrivingSoundscapeFrame(runtimeAt(-8, { offRoad: false }));
const offRoadLeft = createOffroadEarDirectionFrame(
  runtimeAt(-32),
  { offRoad: true, sliderPan: 0.9 }
);
assert.ok(onRoadLeft.sliderPan < -0.2,
  'The established on-road ribbon must point toward the route from the left side');
assert.ok(offRoadLeft.sliderPan < -0.58,
  'Leaving the left edge must keep the ribbon in the same route-side ear rather than flipping');
assert.equal(Math.sign(offRoadLeft.sliderPan), Math.sign(onRoadLeft.sliderPan),
  'Left-side guidance must remain continuous from asphalt to off-road');

const onRoadRight = createDrivingSoundscapeFrame(runtimeAt(8, { offRoad: false }));
const offRoadRight = createOffroadEarDirectionFrame(
  runtimeAt(32),
  { offRoad: true, sliderPan: -0.9 }
);
assert.ok(onRoadRight.sliderPan > 0.2,
  'The established on-road ribbon must point toward the route from the right side');
assert.ok(offRoadRight.sliderPan > 0.58,
  'Leaving the right edge must keep the ribbon in the same route-side ear rather than flipping');
assert.equal(Math.sign(offRoadRight.sliderPan), Math.sign(onRoadRight.sliderPan),
  'Right-side guidance must remain continuous from asphalt to off-road');

const onRoad = createOffroadEarDirectionFrame({
  ...runtimeAt(0),
  state: { ...runtimeAt(0).state, offRoad: false }
}, { offRoad: false, sliderPan: 0.7 });
assert.deepEqual(onRoad, {}, 'Normal road guidance must remain owned by the existing trajectory ribbon');

let forwarded = null;
let settings = { dbeEnabled: true };
globalThis.__turnAudio = {
  unlock: () => true,
  update: (frame) => { forwarded = frame; },
  cue: () => {},
  silence: () => {},
  available: true,
  state: 'running'
};
globalThis.__turnAudioPreferences = { getSettings: () => settings };
globalThis.__turnDriveByEarEnabled = true;
globalThis.__turnRuntime = runtimeAt(-32);

const enhanced = installOffroadEarDirection();
enhanced.update({ active: true, offRoad: true, sliderPan: 0.9 }, 100);
assert.ok(forwarded.sliderPan < -0.58,
  'The live wrapper must preserve the on-road route-ear direction after crossing the left edge');

settings = { dbeEnabled: false };
forwarded = null;
enhanced.update({ active: true, offRoad: true, sliderPan: 0.9 }, 200);
assert.equal(forwarded.sliderPan, 0.9,
  'Live DBE shutdown must bypass the correction layer');

delete globalThis.__turnAudio;
delete globalThis.__turnAudioPreferences;
delete globalThis.__turnDriveByEarEnabled;
delete globalThis.__turnRuntime;

console.log(`TURN ${release.id} continuous optimal-route ear direction across both road edges passed.`);
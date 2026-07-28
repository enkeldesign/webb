import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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
  'The physical-road ear check must sit inside the outer recovery wrapper'
);
assert.match(source, /nearest road point is the physical source of truth for the ear/,
  'Recovery direction must be anchored to asphalt rather than an abstract look-ahead');
assert.match(source, /sliderPan: Math\.sign\(roadSide\) \* magnitude/,
  'The ear sign must come from the actual side of the nearest road point');
assert.doesNotMatch(source, /AudioContext|webkitAudioContext|createOscillator|createBufferSource/,
  'The correction must reuse the existing ribbon rather than creating another sound grammar');

const forward = { x: 0, y: 0, z: 1 };
const right = { x: 1, y: 0, z: 0 };
const samples = Array.from({ length: 80 }, (_, index) => ({
  point: { x: 0, y: 0, z: index * 4 },
  tangent: forward,
  normal: { x: -1, y: 0, z: 0 }
}));

function runtimeAt(x) {
  const index = 20;
  const position = { x, y: 0, z: index * 4 };
  return {
    trackWidth: 27,
    samples,
    state: {
      position,
      nearestTrackIndex: index,
      trackDistance: Math.abs(x),
      offRoad: true,
      heading: 0
    },
    getRight: () => right
  };
}

const leftOfRoad = createOffroadEarDirectionFrame(
  runtimeAt(-32),
  { offRoad: true, sliderPan: -0.9 }
);
assert.ok(leftOfRoad.sliderPan > 0.58,
  'A car left of the road must hear the ribbon in the right ear even when an earlier recovery candidate points left');

const rightOfRoad = createOffroadEarDirectionFrame(
  runtimeAt(32),
  { offRoad: true, sliderPan: 0.9 }
);
assert.ok(rightOfRoad.sliderPan < -0.58,
  'A car right of the road must hear the ribbon in the left ear even when an earlier recovery candidate points right');

const onRoad = createOffroadEarDirectionFrame({
  ...runtimeAt(0),
  state: { ...runtimeAt(0).state, offRoad: false }
}, { offRoad: false, sliderPan: 0.7 });
assert.deepEqual(onRoad, {}, 'Normal road guidance must remain untouched');

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
enhanced.update({ active: true, offRoad: true, sliderPan: -0.9 }, 100);
assert.ok(forwarded.sliderPan > 0.58,
  'The live wrapper must correct a reversed recovery frame before it reaches the mixer');

settings = { dbeEnabled: false };
forwarded = null;
enhanced.update({ active: true, offRoad: true, sliderPan: -0.9 }, 200);
assert.equal(forwarded.sliderPan, -0.9,
  'Live DBE shutdown must bypass the correction layer');

delete globalThis.__turnAudio;
delete globalThis.__turnAudioPreferences;
delete globalThis.__turnDriveByEarEnabled;
delete globalThis.__turnRuntime;

console.log(`TURN ${release.id} physical-road off-road ear direction passed.`);
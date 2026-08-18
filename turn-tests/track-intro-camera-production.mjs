import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { installTrackIntroCamera } from '../turn/render/track-intro-camera.js';

const [appSource, cameraSource, mountainSkySource] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/track-intro-camera.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r7-sky.js', import.meta.url), 'utf8')
]);

assert.match(appSource, /installTrackIntroCamera/);
assert.match(appSource, /track-intro-camera\.js\?revision=r133-midnight-downtown/);
assert.match(cameraSource, /'midnight-city'/);
assert.match(cameraSource, /position: Object\.freeze\(\[20, 150, 300\]\)/);
assert.match(cameraSource, /target: Object\.freeze\(\[275, 3, 40\]\)/);
assert.match(cameraSource, /fov: 52/);
assert.match(cameraSource, /mountain: Object\.freeze/);
assert.match(cameraSource, /position: Object\.freeze\(\[300, 70, -340\]\)/);
assert.match(cameraSource, /target: Object\.freeze\(\[0, 110, 100\]\)/);
assert.match(cameraSource, /fov: 48/);
assert.doesNotMatch(cameraSource, /requestAnimationFrame|setInterval|setAnimationLoop/);

assert.match(mountainSkySource, /new THREE\.SphereGeometry\(SKY_RADIUS, 48, 24\)/,
  'MOUNTAIN stars must live on a camera-centred sphere so yaw is world-locked');
assert.match(mountainSkySource, /texture\.wrapS = THREE\.MirroredRepeatWrapping/,
  'The compact star texture should repeat around the sky without hard seams');
assert.match(mountainSkySource, /texture\.repeat\.set\(SKY_REPEAT_X, 1\)/,
  'The compact star texture should repeat around the 360-degree sphere');
assert.match(mountainSkySource, /const SKY_TRANSLATION_FOLLOW = 0\.96/,
  'MOUNTAIN sky should keep only a small amount of translational parallax');
assert.doesNotMatch(mountainSkySource, /sky\.lookAt\(camera\.position\)/,
  'MOUNTAIN stars must not face the camera in yaw or they become screen-locked');
assert.doesNotMatch(mountainSkySource, /sky\.quaternion\.copy\(camera\.quaternion\)/,
  'MOUNTAIN stars must never become screen-locked by copying the full camera quaternion');

const moonVector = mountainSkySource.match(
  /const MOON_DIRECTION = new THREE\.Vector3\(([-\d.]+), ([-\d.]+), ([-\d.]+)\)/
);
assert.ok(moonVector, 'MOUNTAIN sky fix must expose a fixed world-space moon direction');
const moonDirection = moonVector.slice(1).map(Number);
const moonElevation = Math.asin(moonDirection[1] / Math.hypot(...moonDirection)) * 180 / Math.PI;
assert.ok(moonElevation >= 16.5,
  `MOUNTAIN moon must clear the surrounding peaks during racing; elevation was ${moonElevation.toFixed(1)} degrees`);
const introMoon = projectDirectionToScreen({
  direction: moonDirection,
  position: [300, 70, -340],
  target: [0, 110, 100],
  fov: 48,
  aspect: 1536 / 709
});
assert.ok(introMoon.depth > 0, 'MOUNTAIN moon must sit in front of the intro camera');
assert.ok(Math.abs(introMoon.x - 0.15) < 0.015,
  `MOUNTAIN intro moon should sit around 15% from the left, got ${(introMoon.x * 100).toFixed(1)}%`);
assert.ok(Math.abs(introMoon.y - 0.18) < 0.015,
  `MOUNTAIN intro moon should sit around 18% from the top, got ${(introMoon.y * 100).toFixed(1)}%`);

const bodyClasses = new Set(['turn-track-intro']);
const calls = [];
const camera = {
  fov: 68,
  position: {
    set(...values) {
      calls.push(['position', ...values]);
    }
  },
  up: {
    set(...values) {
      calls.push(['up', ...values]);
    }
  },
  lookAt(...values) {
    calls.push(['target', ...values]);
  },
  updateProjectionMatrix() {
    calls.push(['projection']);
  },
  updateMatrixWorld(force) {
    calls.push(['matrix', force]);
  }
};
let previousHookCalls = 0;
const scene = {
  onBeforeRender() {
    previousHookCalls += 1;
  }
};
const runtime = {
  scene,
  camera,
  activeTrack: { id: 'midnight-city' }
};
const environment = {
  __turnRuntime: runtime,
  __turnGetTrackId: () => runtime.activeTrack.id,
  document: {
    body: {
      classList: {
        contains(name) {
          return bodyClasses.has(name);
        }
      }
    }
  }
};

assert.equal(installTrackIntroCamera({ environment }), true);
assert.equal(installTrackIntroCamera({ environment }), false, 'The camera hook must install only once');
scene.onBeforeRender();
assert.equal(previousHookCalls, 1, 'Existing scene hooks must be preserved');
assert.deepEqual(calls.find((call) => call[0] === 'position'), ['position', 20, 150, 300]);
assert.deepEqual(calls.find((call) => call[0] === 'target'), ['target', 275, 3, 40]);
assert.equal(camera.fov, 52, 'Midnight City uses the tighter downtown showcase field of view');
assert.ok(calls.some((call) => call[0] === 'matrix' && call[1] === true));

bodyClasses.delete('turn-track-intro');
scene.onBeforeRender();
assert.equal(camera.fov, 68, 'The normal race camera field of view is restored after the intro');

calls.length = 0;
runtime.activeTrack = { id: 'mountain' };
bodyClasses.add('turn-track-intro');
scene.onBeforeRender();
assert.deepEqual(calls.find((call) => call[0] === 'position'), ['position', 300, 70, -340]);
assert.deepEqual(calls.find((call) => call[0] === 'target'), ['target', 0, 110, 100]);
assert.equal(camera.fov, 48, 'Mountain uses a lower alpine establishing frame so the raised moon stays in the loading composition');

bodyClasses.delete('turn-track-intro');
scene.onBeforeRender();
assert.equal(camera.fov, 68, 'Mountain also restores the normal race camera after the intro');

calls.length = 0;
runtime.activeTrack = { id: 'harbor' };
bodyClasses.add('turn-track-intro');
scene.onBeforeRender();
assert.equal(calls.some((call) => call[0] === 'position'), false, 'Tracks without a showcase preset keep their established framing');

console.log('TURN Midnight City and Mountain track intros use deliberate cinematic showcase angles with a world-yaw-locked MOUNTAIN sky and raised moon.');

function projectDirectionToScreen({ direction, position, target, fov, aspect }) {
  const forward = normalize(subtract(target, position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = normalize(cross(right, forward));
  const unitDirection = normalize(direction);
  const depth = dot(unitDirection, forward);
  const tangent = Math.tan((fov * Math.PI / 180) / 2);
  const ndcX = dot(unitDirection, right) / (depth * tangent * aspect);
  const ndcY = dot(unitDirection, up) / (depth * tangent);
  return { x: (ndcX + 1) / 2, y: (1 - ndcY) / 2, depth };
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / Math.max(length, 1e-9));
}

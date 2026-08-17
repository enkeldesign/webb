import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { installTrackIntroCamera } from '../turn/render/track-intro-camera.js';

const [appSource, cameraSource] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/track-intro-camera.js', import.meta.url), 'utf8')
]);

assert.match(appSource, /installTrackIntroCamera/);
assert.match(appSource, /track-intro-camera\.js\?revision=r133-midnight-downtown/);
assert.match(cameraSource, /'midnight-city'/);
assert.match(cameraSource, /position: Object\.freeze\(\[20, 150, 300\]\)/);
assert.match(cameraSource, /target: Object\.freeze\(\[275, 3, 40\]\)/);
assert.match(cameraSource, /fov: 52/);
assert.match(cameraSource, /mountain: Object\.freeze/);
assert.match(cameraSource, /position: Object\.freeze\(\[285, 128, -338\]\)/);
assert.match(cameraSource, /target: Object\.freeze\(\[6, 45, 92\]\)/);
assert.match(cameraSource, /fov: 48/);
assert.doesNotMatch(cameraSource, /requestAnimationFrame|setInterval|setAnimationLoop/);

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
assert.deepEqual(calls.find((call) => call[0] === 'position'), ['position', 285, 128, -338]);
assert.deepEqual(calls.find((call) => call[0] === 'target'), ['target', 6, 45, 92]);
assert.equal(camera.fov, 48, 'Mountain uses a wide alpine establishing frame from village/lake toward summit');

bodyClasses.delete('turn-track-intro');
scene.onBeforeRender();
assert.equal(camera.fov, 68, 'Mountain also restores the normal race camera after the intro');

calls.length = 0;
runtime.activeTrack = { id: 'harbor' };
bodyClasses.add('turn-track-intro');
scene.onBeforeRender();
assert.equal(calls.some((call) => call[0] === 'position'), false, 'Tracks without a showcase preset keep their established framing');

console.log('TURN Midnight City and Mountain track intros use deliberate cinematic showcase angles.');

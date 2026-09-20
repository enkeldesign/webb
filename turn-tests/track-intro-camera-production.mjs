import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { installTrackIntroCamera } from '../turn/render/track-intro-camera.js';

const [appSource, cameraSource, sharedSkySource] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/track-intro-camera.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/shared-night-sky.js', import.meta.url), 'utf8')
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

assert.match(sharedSkySource, /new THREE\.ShaderMaterial/,
  'Night tracks should use one crisp procedural shader instead of a scaled raster sky');
assert.match(sharedSkySource, /float starField\(vec2 sampleUv\)/);
assert.doesNotMatch(sharedSkySource, /mountain-night-sky\.jpg/);
assert.match(sharedSkySource, /const SKY_WORLD_CYCLES = 4/,
  'The procedural sample space should retain the established four-cycle world yaw mapping');
assert.match(sharedSkySource, /const SKY_YAW_CATCHUP = 0\.14/,
  'Normal driving should retain the established gentle sky drag');
assert.match(sharedSkySource, /const SKY_REFERENCE_ASPECT = 1536 \/ 709/,
  'The approved wide-phone composition remains the angular-scale reference');
assert.match(sharedSkySource, /const heading = Math\.atan2\(forward\.x, forward\.z\)/);
assert.match(sharedSkySource, /const yawU = -motion\.visualHeading \/ TAU \* SKY_WORLD_CYCLES/);
assert.match(sharedSkySource, /sky\.up\.set\(0, 1, 0\)/,
  'The celestial plane must stay world-up so camera roll does not screen-lock the sky');
assert.match(sharedSkySource, /sky\.lookAt\(camera\.position\)/);
assert.doesNotMatch(sharedSkySource, /sky\.quaternion\.copy\(camera\.quaternion\)/);
assert.match(sharedSkySource, /const LEGACY_MOON_DISTANCE = 810/);
assert.match(sharedSkySource, /const MOON_SKY_ANCHOR_U = 0\.580888/);
assert.match(sharedSkySource, /const MOON_SKY_ANCHOR_V = 0\.783222/);
assert.match(sharedSkySource, /sky\.add\(runtime\.moon\)/,
  'The canonical moon image must share the same celestial transform as the procedural sky');
assert.match(sharedSkySource, /const localU = \(anchorU - motion\.offsetU\) \/ motion\.repeatU/);
assert.match(sharedSkySource, /const localV = \(MOON_SKY_ANCHOR_V - motion\.offsetV\) \/ motion\.repeatV/);
assert.match(sharedSkySource, /moon\.position\.set\(localU - 0\.5, localV - 0\.5, 0\)/);
assert.match(sharedSkySource, /LEGACY_MOON_SIZE \* SKY_DISTANCE \/ LEGACY_MOON_DISTANCE/);
assert.match(sharedSkySource, /motion\.reducedMotion \? 0 : \(camera\.position\.x - camera\.position\.z\) \* SKY_POSITION_PARALLAX/);
assert.match(sharedSkySource, /motion\.reducedMotion \? 0 : forward\.y \* SKY_PITCH_PARALLAX/);
assert.match(sharedSkySource, /cameraCut[\s\S]*motion\.visualHeading = heading/);
assert.doesNotMatch(sharedSkySource, /requestAnimationFrame|setAnimationLoop|setInterval/);

const introMoon = projectSkyAnchorToScreen({
  anchorU: 0.580888,
  anchorV: 0.783222,
  position: [300, 70, -340],
  target: [0, 110, 100],
  fov: 48,
  aspect: 1536 / 709
});
assert.ok(Math.abs(introMoon.x - 0.15) < 0.015,
  `MOUNTAIN intro moon should remain around 15% from the left, got ${(introMoon.x * 100).toFixed(1)}%`);
assert.ok(Math.abs(introMoon.y - 0.18) < 0.015,
  `MOUNTAIN intro moon should remain around 18% from the top, got ${(introMoon.y * 100).toFixed(1)}%`);

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

console.log('TURN Midnight City and Mountain track intros use deliberate cinematic showcase angles with one shared procedural celestial layer.');

function projectSkyAnchorToScreen({ anchorU, anchorV, position, target, fov, aspect }) {
  const skyDistance = 840;
  const skyPlaneAspect = 2;
  const horizontalTiles = 4;
  const overscan = 1.05;
  const referenceAspect = 1536 / 709;
  const forward = normalize(subtract(target, position));
  const heading = Math.atan2(forward[0], forward[2]);
  const verticalFov = fov * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const visibleU = horizontalFov / (Math.PI * 2) * horizontalTiles;

  const visibleHeight = 2 * skyDistance * Math.tan(verticalFov / 2);
  const visibleWidth = visibleHeight * aspect;
  const coverHeight = Math.max(visibleHeight, visibleWidth / skyPlaneAspect) * overscan;
  const visiblePlaneX = Math.min(1, visibleWidth / (coverHeight * skyPlaneAspect));
  const visiblePlaneY = Math.min(1, visibleHeight / coverHeight);
  const referenceCoverage = planeCoverage(referenceAspect, skyPlaneAspect, overscan);
  const repeatU = visibleU * referenceCoverage.x / visiblePlaneX;
  const repeatV = referenceCoverage.y / visiblePlaneY;
  const baseU = 0.5 - repeatU * 0.5;
  const baseV = 0.5 - repeatV * 0.5;
  const yawU = -heading / (Math.PI * 2) * horizontalTiles;
  const positionU = (position[0] - position[2]) * 0.00004;
  const offsetU = baseU + yawU + positionU;
  const offsetV = baseV + forward[1] * 0.025;
  const centreSampleU = offsetU + repeatU * 0.5;
  const equivalentAnchorU = anchorU
    + Math.round((centreSampleU - anchorU) / horizontalTiles) * horizontalTiles;
  const localU = (equivalentAnchorU - offsetU) / repeatU;
  const localV = (anchorV - offsetV) / repeatV;

  const worldX = (localU - 0.5) * coverHeight * skyPlaneAspect;
  const worldY = (localV - 0.5) * coverHeight;
  const ndcX = worldX / (visibleWidth / 2);
  const ndcY = worldY / (visibleHeight / 2);
  return { x: (ndcX + 1) / 2, y: (1 - ndcY) / 2 };
}

function planeCoverage(aspect, skyPlaneAspect, overscan) {
  const coverHeightInVisibleHeights = Math.max(1, aspect / skyPlaneAspect) * overscan;
  return {
    x: Math.min(1, aspect / (coverHeightInVisibleHeights * skyPlaneAspect)),
    y: Math.min(1, 1 / coverHeightInVisibleHeights)
  };
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / Math.max(length, 1e-9));
}

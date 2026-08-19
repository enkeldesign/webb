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

assert.match(mountainSkySource, /new THREE\.PlaneGeometry\(1, 1\)/,
  'MOUNTAIN should keep the visually clean flat star backdrop');
assert.match(mountainSkySource, /const SKY_HORIZONTAL_TILES = 4/,
  'MOUNTAIN yaw lock should map four star-field tiles to one world rotation');
assert.match(mountainSkySource, /const SKY_YAW_CATCHUP = 0\.14/,
  'MOUNTAIN sky should retain a small heading drag instead of snapping');
assert.match(mountainSkySource, /const SKY_REFERENCE_ASPECT = 1536 \/ 709/,
  'The approved wide-phone composition should remain the sky-scale reference');
assert.match(mountainSkySource, /const heading = Math\.atan2\(forward\.x, forward\.z\)/,
  'MOUNTAIN sky UVs must derive from world heading');
assert.match(mountainSkySource, /const yawU = -motion\.visualHeading \/ TAU \* SKY_HORIZONTAL_TILES/,
  'MOUNTAIN star texture must move opposite camera yaw so the distant sky appears world-fixed');
assert.match(mountainSkySource, /const repeatU = visibleU \* REFERENCE_SKY_COVERAGE\.x \/ visiblePlaneX/,
  'MOUNTAIN horizontal star sampling must compensate for aspect-dependent plane overhang');
assert.match(mountainSkySource, /const repeatV = REFERENCE_SKY_COVERAGE\.y \/ visiblePlaneY/,
  'MOUNTAIN vertical star sampling must preserve the approved scale across aspect ratios');
assert.match(mountainSkySource, /sky\.up\.set\(0, 1, 0\)/,
  'MOUNTAIN stars must keep world-up so they roll with the rendered horizon');
assert.match(mountainSkySource, /sky\.lookAt\(camera\.position\)/,
  'The flat backdrop may face the camera only after world-up is applied');
assert.doesNotMatch(mountainSkySource, /sky\.quaternion\.copy\(camera\.quaternion\)/,
  'MOUNTAIN stars must never become screen-locked by copying the full camera quaternion');

assert.match(mountainSkySource, /const LEGACY_MOON_DISTANCE = 810/,
  'The previous closer moon distance should remain explicit only for apparent-size compensation');
assert.match(mountainSkySource, /const MOON_SKY_ANCHOR_U = 0\.580888/,
  'MOUNTAIN moon needs a stable horizontal anchor in the star texture');
assert.match(mountainSkySource, /const MOON_SKY_ANCHOR_V = 0\.783222/,
  'MOUNTAIN moon needs a stable vertical anchor in the star texture');
assert.match(mountainSkySource, /sky\.add\(moonLayer\)/,
  'The moon must be a literal child of the star backdrop so it shares the same 3D transform and depth');
assert.match(mountainSkySource, /const localU = \(anchorU - skyMotion\.offsetU\) \/ skyMotion\.repeatU/,
  'The moon horizontal position must invert the exact aspect-corrected star-field UV transform');
assert.match(mountainSkySource, /const localV = \(MOON_SKY_ANCHOR_V - skyMotion\.offsetV\) \/ skyMotion\.repeatV/,
  'The moon vertical position must invert the exact aspect-corrected star-field UV transform');
assert.match(mountainSkySource, /moonLayer\.position\.set\(localU - 0\.5, localV - 0\.5, 0\)/,
  'The moon must live on the exact same Z plane as the stars');
assert.match(mountainSkySource, /apparentSize = legacySize \* SKY_DISTANCE \/ LEGACY_MOON_DISTANCE/,
  'Moving the moon from 810 to the 840-unit star layer must preserve its apparent diameter');
assert.doesNotMatch(mountainSkySource, /moon\.position\.copy\(camera\.position\)\.addScaledVector/,
  'The moon must not return to an independently positioned camera-relative sprite');

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

console.log('TURN Midnight City and Mountain track intros use deliberate cinematic showcase angles with a single shared MOUNTAIN celestial layer.');

function projectSkyAnchorToScreen({ anchorU, anchorV, position, target, fov, aspect }) {
  const skyDistance = 840;
  const skyImageAspect = 2;
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
  const coverHeight = Math.max(visibleHeight, visibleWidth / skyImageAspect) * overscan;
  const visiblePlaneX = Math.min(1, visibleWidth / (coverHeight * skyImageAspect));
  const visiblePlaneY = Math.min(1, visibleHeight / coverHeight);
  const referenceCoverage = planeCoverage(referenceAspect, skyImageAspect, overscan);
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

  const worldX = (localU - 0.5) * coverHeight * skyImageAspect;
  const worldY = (localV - 0.5) * coverHeight;
  const ndcX = worldX / (visibleWidth / 2);
  const ndcY = worldY / (visibleHeight / 2);
  return { x: (ndcX + 1) / 2, y: (1 - ndcY) / 2 };
}

function planeCoverage(aspect, skyImageAspect, overscan) {
  const coverHeightInVisibleHeights = Math.max(1, aspect / skyImageAspect) * overscan;
  return {
    x: Math.min(1, aspect / (coverHeightInVisibleHeights * skyImageAspect)),
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

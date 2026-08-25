import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  resolveDriftCameraBlend,
  resolveDriftCameraYawOffset,
  updateRaceCameraState
} from '../turn/render/camera.js';
import {
  DRIFT_CAMERA_STORAGE_KEY,
  driftCameraEnabled,
  saveDriftCameraEnabled
} from '../turn/ui/drift-camera-setting.js';

const toRadians = (degrees) => degrees * Math.PI / 180;
const approximately = (actual, expected, tolerance = 1e-6) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

const emptyStorage = {
  getItem() { return null; },
  setItem() {}
};
assert.equal(driftCameraEnabled(emptyStorage), false, 'Drift Camera must remain opt-in during playtesting');

const values = new Map();
const storage = {
  getItem(key) { return values.get(key) ?? null; },
  setItem(key, value) { values.set(key, value); }
};
assert.equal(saveDriftCameraEnabled(true, storage), true);
assert.equal(values.get(DRIFT_CAMERA_STORAGE_KEY), 'on');
assert.equal(driftCameraEnabled(storage), true);
assert.equal(saveDriftCameraEnabled(false, storage), true);
assert.equal(values.get(DRIFT_CAMERA_STORAGE_KEY), 'off');
assert.equal(driftCameraEnabled(storage), false);

approximately(resolveDriftCameraBlend(0), 0);
approximately(resolveDriftCameraBlend(8 / 3.6), 0);
approximately(resolveDriftCameraBlend(28 / 3.6), 1);
approximately(resolveDriftCameraBlend(100 / 3.6), 1);

const forward = { x: 0, z: 1 };
const right = { x: 1, z: 0 };
const highSpeedSideways = { x: 20, z: 0 };
const settledSidewaysOffset = resolveDriftCameraYawOffset({
  velocity: highSpeedSideways,
  forward,
  right,
  previousOffset: 0,
  dt: 10,
  enabled: true
});
approximately(settledSidewaysOffset, toRadians(90) * 0.85, 1e-6);

const crawlingSidewaysOffset = resolveDriftCameraYawOffset({
  velocity: { x: 1, z: 0 },
  forward,
  right,
  previousOffset: 0,
  dt: 10,
  enabled: true
});
approximately(crawlingSidewaysOffset, 0, 1e-9);
approximately(resolveDriftCameraYawOffset({
  velocity: highSpeedSideways,
  forward,
  right,
  previousOffset: toRadians(25),
  dt: 1 / 60,
  enabled: false
}), 0, 1e-9);

function makeVelocity(x, z) {
  return {
    x,
    y: 0,
    z,
    dot(vector) {
      return this.x * (Number(vector?.x) || 0)
        + this.y * (Number(vector?.y) || 0)
        + this.z * (Number(vector?.z) || 0);
    }
  };
}

function cameraSnapshot(enabled) {
  globalThis.__turnDriftCameraEnabled = enabled;
  const cameraPosition = { x: 0, y: 0, z: 0 };
  const cameraTarget = { x: 0, y: 0, z: 0 };
  const camera = {
    position: { copy(value) { this.x = value.x; this.y = value.y; this.z = value.z; } },
    up: { set() {} },
    lookAt() {},
    rotateZ() {},
    fov: 68,
    updateProjectionMatrix() {}
  };
  const state = {
    speed: 20,
    velocity: makeVelocity(20, 0),
    position: { x: 0, y: 0, z: 0 },
    nearestTrackIndex: 0,
    sensorMode: false,
    driftCameraYawOffset: 0
  };

  updateRaceCameraState({
    state,
    camera,
    cameraPosition,
    cameraTarget,
    getForward: () => forward,
    getRight: () => right,
    samples: [],
    maxSpeed: 88,
    dt: 1
  });
  return { cameraPosition, cameraTarget, camera, state };
}

const classic = cameraSnapshot(false);
const drift = cameraSnapshot(true);
approximately(classic.state.driftCameraYawOffset, 0, 1e-9);
approximately(classic.cameraTarget.x, 0, 1e-9);
assert.ok(
  drift.state.driftCameraYawOffset > toRadians(70),
  'Enabled Drift Camera should rotate strongly toward a high-speed sideways travel vector'
);
assert.ok(
  drift.cameraTarget.x > 10,
  'Enabled Drift Camera should look along actual travel instead of only the car nose'
);
approximately(
  drift.camera.fov,
  classic.camera.fov,
  1e-9
);
assert.equal(
  drift.cameraPosition.y,
  classic.cameraPosition.y,
  'Drift Camera must not alter the established camera height/speed response'
);

const settingSource = await fs.readFile(new URL('../turn/ui/drift-camera-setting.js', import.meta.url), 'utf8');
const cameraSource = await fs.readFile(new URL('../turn/render/camera.js', import.meta.url), 'utf8');
assert.match(settingSource, /getItem\(DRIFT_CAMERA_STORAGE_KEY\) === 'on'/,
  'Missing storage must continue to mean classic camera');
assert.match(settingSource, /Experimental; the classic camera remains the default\./);
assert.match(settingSource, /globalThis\.__turnDriftCameraEnabled = next/,
  'The Settings toggle must update camera behavior live without a reload');
assert.match(cameraSource, /DRIFT_CAMERA_TRAVEL_WEIGHT = 0\.85/);
assert.match(cameraSource, /DRIFT_CAMERA_BLEND_START_SPEED = 8 \/ 3\.6/);
assert.match(cameraSource, /DRIFT_CAMERA_FULL_BLEND_SPEED = 28 \/ 3\.6/);
assert.match(cameraSource, /const followDistance = 14 \+ speedRatio \* 7/,
  'Existing camera distance must remain untouched in this feature');
assert.match(cameraSource, /camera\.fov = lerp\(camera\.fov, 68 \+ speedRatio \* 14/,
  'Existing speed/FOV behavior must remain untouched in this feature');

console.log('TURN opt-in Drift Camera preference, velocity-led blend, low-speed fallback and classic-camera parity passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  resolveCameraMotionLeadTime,
  resolveDriftCameraBlend,
  resolveDriftCameraYawOffset,
  updateRaceCameraState
} from '../turn/render/camera.js';
import {
  DRIFT_CAMERA_STORAGE_KEY,
  SPEED_RESPONSIVE_CAMERA_STORAGE_KEY,
  driftCameraEnabled,
  saveDriftCameraEnabled,
  saveSpeedResponsiveCameraEnabled,
  speedResponsiveCameraEnabled
} from '../turn/ui/drift-camera-setting.js';
import {
  ADVANCED_DRIFT_DEFAULT,
  ADVANCED_DRIFT_STORAGE_KEY,
  advancedDriftEnabled,
  saveAdvancedDriftEnabled
} from '../turn/input/advanced-drift.js';

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
assert.equal(ADVANCED_DRIFT_DEFAULT, false, 'Advanced DRIFT must remain opt-in during playtesting');
assert.equal(advancedDriftEnabled(emptyStorage), false);
assert.equal(
  speedResponsiveCameraEnabled(emptyStorage),
  false,
  'Speed-responsive Camera must remain opt-in during playtesting'
);
assert.equal(
  speedResponsiveCameraEnabled(emptyStorage, true),
  true,
  'A future default change should apply when no explicit preference exists'
);

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

assert.equal(saveAdvancedDriftEnabled(true, storage), true);
assert.equal(values.get(ADVANCED_DRIFT_STORAGE_KEY), 'on');
assert.equal(advancedDriftEnabled(storage), true);
assert.equal(saveAdvancedDriftEnabled(false, storage), true);
assert.equal(values.get(ADVANCED_DRIFT_STORAGE_KEY), 'off');
assert.equal(advancedDriftEnabled(storage), false);
assert.equal(
  advancedDriftEnabled(storage, true),
  false,
  'An explicit Advanced DRIFT off preference must survive a future default-on change'
);

assert.equal(saveSpeedResponsiveCameraEnabled(true, storage), true);
assert.equal(values.get(SPEED_RESPONSIVE_CAMERA_STORAGE_KEY), 'on');
assert.equal(speedResponsiveCameraEnabled(storage), true);
assert.equal(saveSpeedResponsiveCameraEnabled(false, storage), true);
assert.equal(values.get(SPEED_RESPONSIVE_CAMERA_STORAGE_KEY), 'off');
assert.equal(speedResponsiveCameraEnabled(storage), false);
assert.equal(
  speedResponsiveCameraEnabled(storage, true),
  false,
  'An explicit off preference must survive a future default-on change'
);

approximately(resolveDriftCameraBlend(0), 0);
approximately(resolveDriftCameraBlend(8 / 3.6), 0);
approximately(resolveDriftCameraBlend(28 / 3.6), 1);
approximately(resolveDriftCameraBlend(100 / 3.6), 1);
approximately(resolveCameraMotionLeadTime(6.2, 0), 1 / 6.2);
approximately(
  resolveCameraMotionLeadTime(6.2, 1 / 60),
  (1 / 60) / Math.expm1(6.2 / 60)
);

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

function cameraSnapshot({
  driftEnabled = false,
  speedResponsiveEnabled = false,
  speed = 20,
  velocity = makeVelocity(20, 0),
  dt = 1
} = {}) {
  globalThis.__turnDriftCameraEnabled = driftEnabled;
  globalThis.__turnSpeedResponsiveCameraEnabled = speedResponsiveEnabled;
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
    speed,
    velocity,
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
    dt
  });
  return { cameraPosition, cameraTarget, camera, state };
}

const classic = cameraSnapshot();
const drift = cameraSnapshot({ driftEnabled: true });
const speedResponsive = cameraSnapshot({ speedResponsiveEnabled: true });
const combined = cameraSnapshot({ driftEnabled: true, speedResponsiveEnabled: true });
approximately(classic.state.driftCameraYawOffset, 0, 1e-9);
approximately(speedResponsive.state.driftCameraYawOffset, 0, 1e-9);
approximately(classic.cameraTarget.x, 0, 1e-9);
assert.ok(
  drift.state.driftCameraYawOffset > toRadians(70),
  'Enabled Drift Camera should rotate strongly toward a high-speed sideways travel vector'
);
assert.ok(
  drift.cameraTarget.x > 10,
  'Enabled Drift Camera should look along actual travel instead of only the car nose'
);
approximately(drift.state.driftCameraYawOffset, combined.state.driftCameraYawOffset, 1e-9);
approximately(drift.camera.fov, classic.camera.fov, 1e-9);
approximately(combined.camera.fov, speedResponsive.camera.fov, 1e-9);
assert.equal(
  drift.cameraPosition.y,
  classic.cameraPosition.y,
  'Drift Camera must not alter the selected camera height/speed response'
);
assert.equal(
  combined.cameraPosition.y,
  speedResponsive.cameraPosition.y,
  'Drift Camera and Speed-responsive Camera must remain independent'
);

const legacyStopped = cameraSnapshot({ speed: 0, velocity: makeVelocity(0, 0), dt: 10 });
const legacyFast = cameraSnapshot({ speed: 88, velocity: makeVelocity(0, 88), dt: 10 });
const responsiveStopped = cameraSnapshot({
  speedResponsiveEnabled: true,
  speed: 0,
  velocity: makeVelocity(0, 0),
  dt: 10
});
const responsiveFast = cameraSnapshot({
  speedResponsiveEnabled: true,
  speed: 88,
  velocity: makeVelocity(0, 88),
  dt: 10
});

approximately(-legacyStopped.cameraPosition.z, 14);
approximately(-legacyFast.cameraPosition.z, 18);
approximately(legacyStopped.cameraPosition.y, 7.7);
approximately(legacyFast.cameraPosition.y, 10.2);
approximately(-responsiveStopped.cameraPosition.z, 16);
approximately(-responsiveFast.cameraPosition.z, 14);
approximately(responsiveStopped.cameraPosition.y, 8.7);
approximately(responsiveFast.cameraPosition.y, 7.7);
assert.ok(
  -responsiveFast.cameraPosition.z < -responsiveStopped.cameraPosition.z,
  'Speed-responsive Camera must move closer as speed builds'
);
approximately(legacyStopped.camera.fov, 68);
approximately(responsiveStopped.camera.fov, 68);
approximately(legacyFast.camera.fov, 88);
approximately(responsiveFast.camera.fov, 88);
approximately(legacyFast.cameraTarget.z, responsiveFast.cameraTarget.z);

function movingCameraRun(speedResponsiveEnabled, dt = 1 / 60) {
  globalThis.__turnDriftCameraEnabled = false;
  globalThis.__turnSpeedResponsiveCameraEnabled = speedResponsiveEnabled;
  const speed = 88;
  const cameraPosition = { x: 0, y: 7.7, z: speedResponsiveEnabled ? -14 : -18 };
  const cameraTarget = { x: 0, y: 2, z: 27 };
  const camera = {
    position: { copy(value) { this.x = value.x; this.y = value.y; this.z = value.z; } },
    up: { set() {} },
    lookAt() {},
    rotateZ() {},
    fov: 68,
    updateProjectionMatrix() {}
  };
  const state = {
    speed,
    velocity: makeVelocity(0, speed),
    position: { x: 0, y: 0, z: 0 },
    nearestTrackIndex: 0,
    sensorMode: false,
    driftCameraYawOffset: 0
  };

  const frameCount = Math.ceil(10 / dt);
  for (let frame = 0; frame < frameCount; frame += 1) {
    state.position.z += speed * dt;
    updateRaceCameraState({
      state,
      camera,
      cameraPosition,
      cameraTarget,
      getForward: () => forward,
      getRight: () => right,
      samples: [],
      maxSpeed: 88,
      dt
    });
  }

  return {
    followDistance: state.position.z - cameraPosition.z,
    targetDistance: cameraTarget.z - state.position.z,
    fov: camera.fov
  };
}

const movingLegacy = movingCameraRun(false);
const movingResponsive = movingCameraRun(true);
assert.ok(
  movingLegacy.followDistance > 30,
  'The regression harness must reproduce the established high-speed world-space camera lag'
);
assert.ok(
  movingLegacy.targetDistance < 20,
  'The regression harness must reproduce the established high-speed look-target lag'
);
approximately(movingLegacy.fov, 88, 1e-6);
approximately(movingResponsive.followDistance, 14, 1e-6);
approximately(movingResponsive.targetDistance, 27, 1e-6);
approximately(movingResponsive.fov, 88, 1e-6);
for (const dt of [1 / 30, 1 / 120, 0.12]) {
  const frameRateVariant = movingCameraRun(true, dt);
  approximately(frameRateVariant.followDistance, 14, 1e-6);
  approximately(frameRateVariant.targetDistance, 27, 1e-6);
  approximately(frameRateVariant.fov, 88, 1e-6);
}

const settingSource = await fs.readFile(new URL('../turn/ui/drift-camera-setting.js', import.meta.url), 'utf8');
const cameraSource = await fs.readFile(new URL('../turn/render/camera.js', import.meta.url), 'utf8');
const gameplayCss = await fs.readFile(new URL('../turn/gameplay-v2.css', import.meta.url), 'utf8');
assert.match(settingSource, /getItem\(DRIFT_CAMERA_STORAGE_KEY\) === 'on'/,
  'Missing storage must continue to mean classic drift direction');
assert.match(settingSource, /SPEED_RESPONSIVE_CAMERA_DEFAULT = false/);
assert.match(settingSource, /<strong>Advanced DRIFT<\/strong>/);
assert.match(settingSource, /progressively release the gas and lock the rear wheels/);
assert.match(settingSource, /turn:advanced-drift-change/,
  'Advanced DRIFT must update the live drive pad without a reload');
assert.match(settingSource, /<strong>Zoom<\/strong>/);
assert.match(settingSource, /Off uses the classic pull-back; both modes widen the view with speed\./);
assert.match(settingSource, /globalThis\.__turnDriftCameraEnabled = next/,
  'The Drift Camera toggle must update camera behavior live without a reload');
assert.match(settingSource, /globalThis\.__turnSpeedResponsiveCameraEnabled = next/,
  'The Speed-responsive Camera toggle must update camera behavior live without a reload');
assert.match(cameraSource, /DRIFT_CAMERA_TRAVEL_WEIGHT = 0\.85/);
assert.match(cameraSource, /DRIFT_CAMERA_BLEND_START_SPEED = 8 \/ 3\.6/);
assert.match(cameraSource, /DRIFT_CAMERA_FULL_BLEND_SPEED = 28 \/ 3\.6/);
assert.match(cameraSource, /\?revision=r215-advanced-drift/,
  'The combined Camera settings module must be cache-busted');
assert.match(cameraSource, /\? 16 - speedRatio \* 2/,
  'The responsive camera must move from distance 16 toward 14 as speed builds');
assert.match(cameraSource, /\? 8\.7 - speedRatio/,
  'Responsive camera height must preserve the tuned vertical composition');
assert.match(cameraSource, /: 14 \+ speedRatio \* 4/,
  'Zoom OFF must use the tuned 14-to-18 classic pull-back');
assert.match(cameraSource, /resolveCameraMotionLeadTime\(CAMERA_POSITION_RESPONSE_RATE, dt\)/,
  'The responsive camera must cancel speed-dependent world-space follow lag');
assert.match(cameraSource, /resolveCameraMotionLeadTime\(CAMERA_TARGET_RESPONSE_RATE, dt\)/,
  'The responsive look target must cancel speed-dependent world-space follow lag');
assert.match(cameraSource, /camera\.fov = lerp\(camera\.fov, 68 \+ speedRatio \* 20/,
  'Both distance profiles must share the same 68-to-88-degree speed FOV');
assert.doesNotMatch(cameraSource, /fovSpeedGain/,
  'The FOV curve must not depend on the Zoom preference');
assert.match(gameplayCss, /--boost-hud-downshift: 20px/,
  'Boost bar must move down by approximately its own racing height');
assert.match(
  gameplayCss,
  /bottom: calc\(clamp\(92px, 20vh, 150px\) - var\(--boost-hud-downshift\)\)/,
  'Standard-height HUD must apply the independent Boost bar downshift'
);
assert.match(
  gameplayCss,
  /bottom: calc\(74px - var\(--boost-hud-downshift\)\)/,
  'Short landscape HUD must preserve the same Boost bar downshift'
);

console.log('TURN shared speed FOV, tuned classic pull-back, Zoom preference and Boost HUD shift passed.');

import assert from 'node:assert/strict';

import {
  getTurnPlatform,
  installTurnPlatform,
  requireTurnPlatform,
  validateTurnPlatform
} from '../turn/platform/platform-context.js';
import { createWebPlatform } from '../turn/platform/web-platform.js';
import { motionPoseFromGravity, updateMotionInputState } from '../turn/input/motion.js';

const EPSILON = 1e-9;

assert.equal(getTurnPlatform(), null, 'Production modules must keep a browser fallback until a platform is composed');
assert.throws(() => requireTurnPlatform(), /has not been installed/);
assert.throws(() => validateTurnPlatform(null), /must be an object/);
assert.throws(
  () => validateTurnPlatform({ kind: 'broken', motion: {}, display: {} }),
  /motion\.isAvailable must be a function/
);

const fallbackPose = motionPoseFromGravity({
  accelerationIncludingGravity: { x: 2, y: 0, z: 0 }
});
assert.ok(Math.abs(fallbackPose.roll - Math.PI / 2) < EPSILON, 'The production browser fallback must preserve current screen-space steering');
assert.equal(fallbackPose.pitch, 0);
assert.equal(motionPoseFromGravity({ accelerationIncludingGravity: { x: 0.1, y: 0.1, z: 0.1 } }), null);

let permissionRequests = 0;
let fullscreenRequests = 0;
let landscapeLocks = 0;
let subscribed = null;
let subscribedOptions = null;
let removed = null;

class FakeDeviceMotionEvent {
  static async requestPermission() {
    permissionRequests += 1;
    return 'granted';
  }
}

const root = {
  async requestFullscreen() {
    fullscreenRequests += 1;
  }
};

const fakeEnvironment = {
  DeviceMotionEvent: FakeDeviceMotionEvent,
  document: {
    documentElement: root,
    fullscreenElement: null,
    webkitFullscreenElement: null
  },
  screen: {
    orientation: {
      angle: 90,
      async lock(value) {
        landscapeLocks += 1;
        assert.equal(value, 'landscape');
      }
    }
  },
  window: {
    orientation: 0,
    addEventListener(type, listener, options) {
      assert.equal(type, 'devicemotion');
      subscribed = listener;
      subscribedOptions = options;
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'devicemotion');
      removed = listener;
    }
  }
};

const platform = createWebPlatform(fakeEnvironment);
assert.equal(validateTurnPlatform(platform), true);
assert.equal(platform.kind, 'web');
assert.equal(platform.motion.isAvailable(), true);
assert.ok(Math.abs(platform.motion.getScreenOrientationAngle() - Math.PI / 2) < EPSILON);
assert.equal(await platform.motion.requestPermission(), true);
assert.equal(permissionRequests, 1);

const listener = () => {};
const unsubscribe = platform.motion.subscribe(listener);
assert.equal(subscribed, listener);
assert.deepEqual(subscribedOptions, { passive: true });
unsubscribe();
assert.equal(removed, listener);

assert.equal(await platform.display.requestFullscreen(), true);
assert.equal(fullscreenRequests, 1);
assert.equal(await platform.display.lockLandscape(), true);
assert.equal(landscapeLocks, 1);

assert.equal(installTurnPlatform(platform), platform);
assert.equal(installTurnPlatform(platform), platform, 'Installing the same platform twice must be idempotent');
assert.equal(getTurnPlatform(), platform);
assert.equal(requireTurnPlatform(), platform);
assert.throws(
  () => installTurnPlatform(createWebPlatform(fakeEnvironment)),
  /already been installed/,
  'A runtime must not silently replace its platform after composition'
);

const adaptedPose = motionPoseFromGravity({
  accelerationIncludingGravity: { x: 2, y: 0, z: 0 }
});
assert.ok(Math.abs(adaptedPose.roll) < EPSILON, 'TURN NEXT motion math must consume the installed platform orientation');
assert.equal(adaptedPose.pitch, 0);

const manualState = {
  sensorMode: false,
  steering: 0,
  manualSteering: 1,
  tiltDrive: 1
};
updateMotionInputState({ state: manualState, dt: 0.1, maxSteerRoll: Math.PI / 4 });
assert.equal(manualState.steering, -1);
assert.equal(manualState.tiltDrive, 0);

class DeniedDeviceMotionEvent {
  static async requestPermission() {
    return 'denied';
  }
}
const deniedPlatform = createWebPlatform({
  DeviceMotionEvent: DeniedDeviceMotionEvent,
  window: {},
  document: {},
  screen: {}
});
await assert.rejects(() => deniedPlatform.motion.requestPermission(), /was not granted/);

const unavailablePlatform = createWebPlatform({ window: {}, document: {}, screen: {} });
assert.equal(unavailablePlatform.motion.isAvailable(), false);
await assert.rejects(() => unavailablePlatform.motion.requestPermission(), /not available/);
assert.equal(await unavailablePlatform.display.requestFullscreen(), false);
assert.equal(await unavailablePlatform.display.lockLandscape(), false);

console.log('TURN web platform contract and TURN NEXT motion composition passed.');

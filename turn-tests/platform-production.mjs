import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  getTurnPlatform,
  installTurnPlatform,
  requireTurnPlatform,
  validateTurnPlatform
} from '../turn/platform/platform-context.js';
import { createWebPlatform } from '../turn/platform/web-platform.js';
import { motionPoseFromGravity, updateMotionInputState } from '../turn/input/motion.js';
import { installMotionLifecycleBridge } from '../turn-next/motion-lifecycle-bridge.js';

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
const addedEvents = [];
const removedEvents = [];

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

const fakeWindow = {
  orientation: 0,
  addEventListener(type, listener, options) {
    addedEvents.push({ type, listener, options });
    if (type === 'devicemotion') {
      subscribed = listener;
      subscribedOptions = options;
    }
  },
  removeEventListener(type, listener, options) {
    removedEvents.push({ type, listener, options });
    if (type === 'devicemotion') removed = listener;
  }
};
const originalWindowAdd = fakeWindow.addEventListener;
const originalWindowRemove = fakeWindow.removeEventListener;

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
  window: fakeWindow
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

const bridge = installMotionLifecycleBridge({ platform, environment: fakeEnvironment });
assert.equal(bridge.route, 'platform');
assert.equal(bridge.isAvailable(), true);
assert.notEqual(fakeEnvironment.DeviceMotionEvent, FakeDeviceMotionEvent, 'M5 must provide TURN NEXT with a permission bridge');
assert.equal(await fakeEnvironment.DeviceMotionEvent.requestPermission(), true);
assert.equal(permissionRequests, 2, 'The legacy launch call must route into platform.motion.requestPermission()');

const bridgeListenerA = () => {};
const bridgeListenerB = () => {};
const motionAddsBeforeBridge = addedEvents.filter(({ type }) => type === 'devicemotion').length;
fakeWindow.addEventListener('devicemotion', bridgeListenerA, { passive: false });
assert.equal(subscribed, bridgeListenerA);
assert.deepEqual(subscribedOptions, { passive: true }, 'The platform owns motion listener options');
assert.equal(bridge.isSubscribed(), true);
assert.equal(
  addedEvents.filter(({ type }) => type === 'devicemotion').length,
  motionAddsBeforeBridge + 1,
  'The bridge must create exactly one platform subscription'
);

fakeWindow.addEventListener('devicemotion', bridgeListenerA);
assert.equal(
  addedEvents.filter(({ type }) => type === 'devicemotion').length,
  motionAddsBeforeBridge + 1,
  'Registering the same listener twice must not duplicate the platform subscription'
);

fakeWindow.addEventListener('devicemotion', bridgeListenerB);
assert.equal(removed, bridgeListenerA, 'Replacing a listener must clean up the previous subscription');
assert.equal(subscribed, bridgeListenerB);
fakeWindow.removeEventListener('devicemotion', bridgeListenerB);
assert.equal(removed, bridgeListenerB);
assert.equal(bridge.isSubscribed(), false);

const ordinaryListener = () => {};
fakeWindow.addEventListener('resize', ordinaryListener, { passive: true });
assert.ok(addedEvents.some(({ type, listener: received }) => type === 'resize' && received === ordinaryListener));
assert.equal(bridge.uninstall(), true);
assert.equal(bridge.uninstall(), false, 'M5 uninstall must be idempotent');
assert.equal(fakeWindow.addEventListener, originalWindowAdd);
assert.equal(fakeWindow.removeEventListener, originalWindowRemove);
assert.equal(fakeEnvironment.DeviceMotionEvent, FakeDeviceMotionEvent);

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

const productionApp = fs.readFileSync(new URL('../turn/app.js', import.meta.url), 'utf8');
const nextApp = fs.readFileSync(new URL('../turn-next/app.js', import.meta.url), 'utf8');
const bridgeSource = fs.readFileSync(new URL('../turn-next/motion-lifecycle-bridge.js', import.meta.url), 'utf8');
const webPlatformSource = fs.readFileSync(new URL('../turn/platform/web-platform.js', import.meta.url), 'utf8');

assert.doesNotMatch(productionApp, /installMotionLifecycleBridge|turnMotionLifecycle/, 'Production must retain the proven browser launch path during M5');
assert.match(nextApp, /installMotionLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(nextApp, /turnMotionLifecycle = 'platform-m5'/);
assert.match(nextApp, /Platform M5 · Motion Lifecycle/);
assert.ok(
  nextApp.indexOf('installMotionLifecycleBridge({ platform: webPlatform })')
    < nextApp.indexOf("withBuild('./main.js')"),
  'The M5 bridge must own motion before the canonical runtime registers its legacy listener'
);
assert.match(bridgeSource, /motion\.requestPermission\(\)/);
assert.match(bridgeSource, /motion\.subscribe\(listener\)/);
assert.match(bridgeSource, /launchPending && !intro\.hidden/);
assert.match(bridgeSource, /type === 'devicemotion'/);
assert.match(webPlatformSource, /addWindowEventListener = typeof windowRef\?\.addEventListener/);
assert.match(webPlatformSource, /removeWindowEventListener = typeof windowRef\?\.removeEventListener/);

console.log('TURN web platform contract and TURN NEXT Platform M5 motion lifecycle passed.');

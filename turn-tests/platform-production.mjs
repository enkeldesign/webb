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
import { installMotionLifecycleBridge } from '../turn/motion-lifecycle-bridge.js';
import { installDisplayLifecycleBridge } from '../turn/display-lifecycle-bridge.js';

const EPSILON = 1e-9;

assert.equal(getTurnPlatform(), null);
assert.throws(() => requireTurnPlatform(), /has not been installed/);
assert.throws(() => validateTurnPlatform(null), /must be an object/);

let permissionRequests = 0;
let fullscreenRequests = 0;
let landscapeLocks = 0;
let subscribed = null;
let removed = null;
const eventListeners = new Map();

class FakeDeviceMotionEvent {
  static async requestPermission() {
    permissionRequests += 1;
    return 'granted';
  }
}

const intro = { hidden: true };
const manualButton = {
  addEventListener() {},
  removeEventListener() {}
};
const root = {
  async requestFullscreen() {
    fullscreenRequests += 1;
  }
};
const orientation = {
  angle: 90,
  async lock(value) {
    landscapeLocks += 1;
    assert.match(value, /^landscape/);
  }
};
const fakeWindow = {
  orientation: 0,
  addEventListener(type, listener) {
    eventListeners.set(type, listener);
    if (type === 'devicemotion') subscribed = listener;
  },
  removeEventListener(type, listener) {
    if (type === 'devicemotion') removed = listener;
    if (eventListeners.get(type) === listener) eventListeners.delete(type);
  },
  setTimeout: globalThis.setTimeout
};
const fakeDocument = {
  documentElement: root,
  fullscreenElement: null,
  webkitFullscreenElement: null,
  querySelector(selector) {
    if (selector === '#intro') return intro;
    if (selector === '#manualButton') return manualButton;
    return null;
  }
};
const fakeEnvironment = {
  DeviceMotionEvent: FakeDeviceMotionEvent,
  document: fakeDocument,
  screen: { orientation },
  window: fakeWindow,
  performance: globalThis.performance
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
unsubscribe();
assert.equal(removed, listener);
assert.equal(await platform.display.requestFullscreen(), true);
assert.equal(fullscreenRequests, 1);
assert.equal(await platform.display.lockLandscape(), true);
assert.equal(landscapeLocks, 1);

assert.equal(installTurnPlatform(platform), platform);
assert.equal(installTurnPlatform(platform), platform);
assert.equal(getTurnPlatform(), platform);
assert.equal(requireTurnPlatform(), platform);

const adaptedPose = motionPoseFromGravity({
  accelerationIncludingGravity: { x: 2, y: 0, z: 0 }
});
assert.ok(Math.abs(adaptedPose.roll) < EPSILON);

const manualState = {
  sensorMode: false,
  steering: 0,
  manualSteering: 1,
  tiltDrive: 1
};
updateMotionInputState({ state: manualState, dt: 0.1, maxSteerRoll: Math.PI / 4 });
assert.equal(manualState.steering, -1);
assert.equal(manualState.tiltDrive, 0);

const originalWindowAdd = fakeWindow.addEventListener;
const originalWindowRemove = fakeWindow.removeEventListener;
const originalMotionEvent = fakeEnvironment.DeviceMotionEvent;
const originalFullscreen = root.requestFullscreen;
const originalOrientationLock = orientation.lock;

const motionBridge = installMotionLifecycleBridge({ platform, environment: fakeEnvironment });
assert.equal(motionBridge.route, 'platform');
assert.notEqual(fakeEnvironment.DeviceMotionEvent, originalMotionEvent);
assert.equal(await fakeEnvironment.DeviceMotionEvent.requestPermission(), 'granted');
assert.equal(permissionRequests, 2);

const bridgedListener = () => {};
fakeWindow.addEventListener('devicemotion', bridgedListener);
assert.equal(subscribed, bridgedListener);
assert.equal(motionBridge.isSubscribed(), true);
fakeWindow.removeEventListener('devicemotion', bridgedListener);
assert.equal(removed, bridgedListener);
assert.equal(motionBridge.isSubscribed(), false);

const displayBridge = installDisplayLifecycleBridge({ platform, environment: fakeEnvironment });
assert.equal(displayBridge.route, 'platform');
assert.notEqual(root.requestFullscreen, originalFullscreen);
assert.notEqual(orientation.lock, originalOrientationLock);
const fullscreenA = root.requestFullscreen();
const fullscreenB = root.requestFullscreen();
assert.equal(fullscreenA, fullscreenB);
await fullscreenA;
assert.equal(fullscreenRequests, 2);
const landscapeA = orientation.lock('landscape');
const landscapeB = orientation.lock('landscape-primary');
assert.equal(landscapeA, landscapeB);
await landscapeA;
assert.equal(landscapeLocks, 2);

assert.equal(displayBridge.uninstall(), true);
assert.equal(displayBridge.uninstall(), false);
assert.equal(root.requestFullscreen, originalFullscreen);
assert.equal(orientation.lock, originalOrientationLock);
assert.equal(motionBridge.uninstall(), true);
assert.equal(motionBridge.uninstall(), false);
assert.equal(fakeWindow.addEventListener, originalWindowAdd);
assert.equal(fakeWindow.removeEventListener, originalWindowRemove);
assert.equal(fakeEnvironment.DeviceMotionEvent, originalMotionEvent);

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
const motionBridgeSource = fs.readFileSync(new URL('../turn/motion-lifecycle-bridge.js', import.meta.url), 'utf8');
const displayBridgeSource = fs.readFileSync(new URL('../turn/display-lifecycle-bridge.js', import.meta.url), 'utf8');
const webPlatformSource = fs.readFileSync(new URL('../turn/platform/web-platform.js', import.meta.url), 'utf8');

assert.match(productionApp, /installMotionLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(productionApp, /installDisplayLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(productionApp, /turnMotionLifecycle = 'platform-m5'/);
assert.match(productionApp, /turnDisplayLifecycle = 'platform-m6'/);
assert.match(productionApp, /turnSessionLifecycle = 'orchestrator-m7'/);
assert.match(productionApp, /turnHomeLifecycle = 'home-m8'/);
assert.ok(
  productionApp.indexOf('installMotionLifecycleBridge({ platform: webPlatform })')
    < productionApp.indexOf("withBuild('./main.js')")
);
assert.ok(
  productionApp.indexOf('installDisplayLifecycleBridge({ platform: webPlatform })')
    < productionApp.indexOf("withBuild('./main.js')")
);
assert.match(nextApp, /new URL\('\/turn\/app\.js'/);
assert.doesNotMatch(nextApp, /installMotionLifecycleBridge|installDisplayLifecycleBridge/);
assert.match(motionBridgeSource, /await motion\.requestPermission\(\);[\s\S]*return 'granted';/);
assert.match(motionBridgeSource, /motion\.subscribe\(listener\)/);
assert.match(displayBridgeSource, /display\.requestFullscreen\(root\)/);
assert.match(displayBridgeSource, /display\.lockLandscape\(\)/);
assert.match(webPlatformSource, /requestDefaultFullscreen = defaultFullscreenRoot\?\.requestFullscreen/);
assert.match(webPlatformSource, /lockScreenOrientation = screenOrientation\?\.lock/);

console.log('TURN production web platform and M5–M8 lifecycle composition passed.');

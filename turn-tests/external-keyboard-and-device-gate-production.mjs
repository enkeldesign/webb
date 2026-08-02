import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  EXTERNAL_KEYBOARD_BINDINGS,
  keyboardActionForCode
} from '../turn/input/external-keyboard-controls.js';
import { isTurnPhoneOrTablet } from '../turn/ui/device-support-message.js';
import { updateMotionInputState } from '../turn/input/motion.js';

const expectedBindings = Object.freeze({
  ArrowLeft: 'steer-left',
  KeyA: 'steer-left',
  ArrowRight: 'steer-right',
  KeyD: 'steer-right',
  ArrowUp: 'gas',
  KeyW: 'gas',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'brake',
  KeyQ: 'drift',
  ShiftLeft: 'drift',
  ShiftRight: 'drift',
  KeyE: 'boost',
  ControlLeft: 'boost',
  ControlRight: 'boost',
  KeyR: 'restart'
});

assert.deepEqual(EXTERNAL_KEYBOARD_BINDINGS, expectedBindings);
for (const [code, action] of Object.entries(expectedBindings)) {
  assert.equal(keyboardActionForCode(code), action, `${code} must map to ${action}`);
}
assert.equal(keyboardActionForCode('Escape'), null);

const makeEnvironment = ({ userAgent = '', platform = '', maxTouchPoints = 0, mobile = false, coarse = false } = {}) => ({
  navigator: {
    userAgent,
    platform,
    maxTouchPoints,
    userAgentData: { mobile }
  },
  matchMedia: () => ({ matches: coarse })
});

assert.equal(
  isTurnPhoneOrTablet(makeEnvironment({ userAgent: 'Mozilla/5.0 (iPhone)', maxTouchPoints: 5, coarse: true })),
  true,
  'iPhone must retain the rotate-to-landscape guidance'
);
assert.equal(
  isTurnPhoneOrTablet(makeEnvironment({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })),
  true,
  'iPad desktop-class user agents must still be treated as tablets'
);
assert.equal(
  isTurnPhoneOrTablet(makeEnvironment({ userAgent: 'Mozilla/5.0 (Linux; Android 16)', maxTouchPoints: 10 })),
  true,
  'Android tablets must retain the supported-device path'
);
assert.equal(
  isTurnPhoneOrTablet(makeEnvironment({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })),
  false,
  'ordinary desktop browsers must receive the unsupported-device message'
);

const motionState = {
  sensorMode: true,
  manualSteering: 1,
  steering: 0,
  tiltDrive: 0,
  roll: 0,
  targetRoll: 0,
  pitch: 0,
  targetPitch: 0,
  neutralRoll: 0,
  steeringEngaged: false
};
updateMotionInputState({ state: motionState, dt: 0.1, maxSteerRoll: Math.PI / 4 });
assert.ok(
  motionState.steering < -0.9,
  'a held external-keyboard direction must temporarily override motion steering'
);
motionState.manualSteering = 0;
updateMotionInputState({ state: motionState, dt: 0.1, maxSteerRoll: Math.PI / 4 });
assert.ok(
  motionState.steering > -0.9,
  'releasing the keyboard must hand steering back toward the motion sensor'
);

const [app, keyboard, deviceMessage, deviceCss, guide, index, motion] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/input/external-keyboard-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/device-support-message.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/device-support-message-r138.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/input/motion.js', import.meta.url), 'utf8')
]);

assert.match(app, /installDeviceSupportMessage\(\)/, 'production must install device-aware support guidance');
assert.match(app, /device-support-message-r138\.css/, 'production must install the desktop support-gate styling');
assert.match(app, /installExternalKeyboardControls\(\)/, 'production must install external keyboard controls');
assert.ok(
  app.indexOf("./ui/gameplay-controls.js") < app.indexOf('installExternalKeyboardControls()')
    && app.indexOf('installExternalKeyboardControls()') < app.indexOf("./main.js"),
  'the keyboard owner must install after the unified drive pad and before legacy global keyboard listeners'
);

assert.match(keyboard, /event\.stopImmediatePropagation\(\)/, 'owned keyboard events must not leak into legacy global shortcuts');
assert.match(keyboard, /dialog\[open\]/, 'driving shortcuts must stop while a modal dialog is open');
assert.match(keyboard, /interactiveTarget\(event\.target\)/, 'driving shortcuts must not fire through ordinary controls');
assert.match(keyboard, /turn-desktop-device/, 'the external keyboard route must remain disabled by the desktop support gate');
assert.match(keyboard, /runtimeState\(\)[\s\S]*state\?\.running/, 'keyboard input must be scoped to an active TURN session');
assert.match(keyboard, /requestedDriveZone[\s\S]*brake[\s\S]*boost[\s\S]*drift[\s\S]*gas/, 'brake, boost, drift and gas priority must be deterministic');
assert.match(keyboard, /pointerdown/, 'keyboard driving must enter the same continuous drive-pad pathway as touch');
assert.match(keyboard, /pointermove/, 'held-key transitions must slide through the same drive zones as touch');
assert.match(keyboard, /pointerup/, 'releasing the keyboard must release the continuous drive surface');
assert.match(keyboard, /manualSteer\.tabIndex = 0/, 'the exposed steering slider must be keyboard focusable');
assert.match(keyboard, /aria-valuetext/, 'the steering slider must expose a human-readable direction and amount');
assert.match(keyboard, /windowRef\.addEventListener\('blur', releaseAllInputs\)/, 'lost window focus must release every held driving input');
assert.match(keyboard, /visibilitychange/, 'backgrounding the app must release every held driving input');

assert.match(deviceMessage, /TURN IS MADE FOR PHONES AND TABLETS/, 'desktop users need an honest supported-device message');
assert.match(deviceMessage, /Open TURN on a phone or tablet/, 'the desktop gate must provide a concrete next step');
assert.match(deviceMessage, /ROTATE YOUR DEVICE TO LANDSCAPE/, 'supported touch devices must retain the landscape instruction');
assert.match(deviceMessage, /MacIntel[\s\S]*touchPoints > 1/, 'iPad desktop-class user agents must not be mistaken for desktop computers');
assert.match(deviceCss, /\.turn-desktop-device \.rotate-panel \{[\s\S]*display: grid !important;/, 'desktop must show the support gate in either browser-window orientation');
assert.match(deviceCss, /\.turn-desktop-device \.rotate-phone \{[\s\S]*display: none;/, 'desktop guidance must not show an impossible rotate-phone illustration');
assert.match(index, /ROTATE YOUR DEVICE TO LANDSCAPE/, 'the static document must retain a useful pre-module mobile fallback');

assert.match(
  guide,
  /Arrow keys or W, A, S and D to drive; Q or Shift for DRIFT; E or Control for BOOST; Space for BRAKE\/REVERSE; and R to restart the lap/,
  'How to Play must document the complete external-keyboard mapping'
);
assert.match(motion, /manualOverride/, 'motion composition must explicitly support a held keyboard override');
assert.match(motion, /hands control back to the sensor on release/, 'the keyboard override contract must preserve motion steering after release');

console.log('TURN external keyboard controls and device-aware desktop gate passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  QE_DRIVE_BINDINGS,
  createQeHoldController,
  qeDriveZoneForEvent
} from '../turn/input/qe-drive-controls.js';

assert.deepEqual(QE_DRIVE_BINDINGS, { KeyQ: 'drift', KeyE: 'boost' });
assert.equal(qeDriveZoneForEvent({ code: 'KeyQ', key: 'q' }), 'drift');
assert.equal(qeDriveZoneForEvent({ code: 'KeyE', key: 'e' }), 'boost');
assert.equal(qeDriveZoneForEvent({ key: 'Q' }), 'drift');
assert.equal(qeDriveZoneForEvent({ key: 'E' }), 'boost');
assert.equal(qeDriveZoneForEvent({ code: 'ShiftLeft', key: 'Shift' }), null,
  'Q/E are the only new shortcuts; old Shift/Control aliases must not return');

const transitions = [];
const held = createQeHoldController((zone) => transitions.push(zone));
assert.equal(held.press('KeyQ', 'drift'), true);
assert.equal(held.getActiveZone(), 'drift');
assert.equal(held.press('KeyQ', 'drift'), false, 'Repeated keydown must not toggle Drift');
assert.deepEqual(transitions, ['drift']);

assert.equal(held.press('KeyE', 'boost'), true);
assert.equal(held.getActiveZone(), 'boost', 'Most recently pressed Q/E action should own the shared drive zone');
assert.equal(held.release('KeyE'), true);
assert.equal(held.getActiveZone(), 'drift', 'Releasing E while Q remains held must return to Drift');
assert.equal(held.release('KeyQ'), true);
assert.equal(held.getActiveZone(), null, 'Releasing the final shortcut must release the drive pad');
assert.deepEqual(transitions, ['drift', 'boost', 'drift', null]);

const [source, bootstrap, index] = await Promise.all([
  fs.readFile(new URL('../turn/input/qe-drive-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/input/qe-drive-controls-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8')
]);

assert.match(source, /\.drive-drift-zone/);
assert.match(source, /\.drive-boost-zone/);
assert.match(source, /dispatchKeyboardPointer\('pointerdown', nextZone\)/,
  'Keyboard press must enter the same unified drive-pad pointer path as touch');
assert.match(source, /dispatchKeyboardPointer\('pointermove', nextZone\)/,
  'Switching Q/E while held must move within the same unified drive surface');
assert.match(source, /dispatchKeyboardPointer\('pointerup', activePointerZone\)/,
  'Keyboard release must leave the canonical drive surface');
assert.match(source, /createKeyboardDriveOwnership/,
  'Q/E must share the canonical keyboard-driving ownership rule');
assert.match(source, /ownership\.accepts\(event\)/,
  'Q/E must ask the shared ownership rule before consuming input');
assert.match(source, /installKeyboardDriveOwnershipLossHandlers/,
  'Q/E must release held Drift/Boost when keyboard ownership is lost');
assert.match(bootstrap, /from '\/turn\/input\/qe-drive-controls\.js'/,
  'The Q/E loader must use the canonical release-bound module identity');
assert.match(bootstrap, /attempt < 300/,
  'The Q/E loader must wait for gameplay-controls to construct the unified drive pad');
assert.match(index, /qe-drive-controls-bootstrap\.js\?build=\d{8}-r\d+/,
  'Production TURN must load the Q/E bootstrap through the current release build');
assert.match(index, /"\/turn\/input\/qe-drive-controls\.js": "\/turn\/input\/qe-drive-controls\.js\?build=\d{8}-r\d+"/,
  'The production import map must route Q/E through the current release build');

console.log('TURN Q = Drift / E = Boost unified keyboard control regression passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  CONTROL_HANDEDNESS,
  CONTROL_HANDEDNESS_KEY,
  applyControlHandedness,
  controlHandednessDescription,
  driftLockSideForHandedness,
  loadControlHandedness,
  normalizeControlHandedness,
  saveControlHandedness,
  topDriveZoneAt
} from '../turn/ui/control-handedness.js';

assert.equal(normalizeControlHandedness('left'), CONTROL_HANDEDNESS.LEFT);
assert.equal(normalizeControlHandedness('right'), CONTROL_HANDEDNESS.RIGHT);
assert.equal(normalizeControlHandedness('unexpected'), CONTROL_HANDEDNESS.RIGHT);
assert.equal(loadControlHandedness({ getItem: () => 'left' }), CONTROL_HANDEDNESS.LEFT);
assert.equal(loadControlHandedness({ getItem: () => { throw new Error('blocked'); } }), CONTROL_HANDEDNESS.RIGHT);

let savedPreference = null;
assert.equal(saveControlHandedness('left', {
  setItem(key, value) {
    assert.equal(key, CONTROL_HANDEDNESS_KEY);
    savedPreference = value;
  }
}), CONTROL_HANDEDNESS.LEFT);
assert.equal(savedPreference, CONTROL_HANDEDNESS.LEFT);
assert.match(controlHandednessDescription('right'), /^Off\./);
assert.match(controlHandednessDescription('left'), /^On\./);

assert.equal(topDriveZoneAt(0.25, 'right'), 'drift');
assert.equal(topDriveZoneAt(0.75, 'right'), 'boost');
assert.equal(topDriveZoneAt(0.25, 'left'), 'boost');
assert.equal(topDriveZoneAt(0.75, 'left'), 'drift');
assert.equal(driftLockSideForHandedness('right'), 'left');
assert.equal(driftLockSideForHandedness('left'), 'right');

const rootClasses = new Set();
const root = {
  dataset: {},
  classList: {
    toggle(name, active) {
      if (active) rootClasses.add(name);
      else rootClasses.delete(name);
    }
  }
};
const driftZone = { id: 'drift' };
const boostZone = { id: 'boost' };
const driveTop = {
  children: [],
  append(...nodes) {
    this.children = nodes;
  }
};
const fakeDocument = {
  documentElement: root,
  querySelector(selector) {
    if (selector === '.drive-pad-top') return driveTop;
    if (selector === '.drive-drift-zone') return driftZone;
    if (selector === '.drive-boost-zone') return boostZone;
    return null;
  }
};

applyControlHandedness('left', { documentRef: fakeDocument, eventTarget: null });
assert.equal(root.dataset.turnControlHandedness, 'left');
assert.equal(rootClasses.has('turn-left-handed-controls'), true);
assert.deepEqual(driveTop.children, [boostZone, driftZone],
  'Left-handed visual order and keyboard focus order must both be BOOST then DRIFT');

applyControlHandedness('right', { documentRef: fakeDocument, eventTarget: null });
assert.equal(root.dataset.turnControlHandedness, 'right');
assert.equal(rootClasses.has('turn-right-handed-controls'), true);
assert.deepEqual(driveTop.children, [driftZone, boostZone],
  'Default visual order and keyboard focus order must both be DRIFT then BOOST');

const [home, handedness, controls, driveCss, manualCss, guide, storageBootstrap, workflow] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/control-handedness.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/manual-steering.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

assert.match(home, /<legend>Steering<\/legend>[\s\S]*id="m8LeftHanded"/);
assert.match(home, /<strong>Left-handed controls<\/strong>/);
assert.match(home, /aria-describedby="m8LeftHandedDescription"/);
assert.match(home, /controlHandednessDescription\(handedness\)/);
assert.match(home, /saveControlHandedness\(/);
assert.match(home, /Left-handed controls on\./);
assert.match(home, /Left-handed controls off\./);

assert.match(controls, /installControlHandedness\(\)/,
  'The shared gameplay controls must apply the preference in TURN and YOUR TURN');
assert.match(controls, /topDriveZoneAt\(x, controlHandedness\)/,
  'Mirrored visual zones must also mirror continuous thumb hit testing');
assert.match(controls, /lockSide: driftLockSideForHandedness\(controlHandedness\)/,
  'LOCK hit testing must follow the visible outer edge');
assert.match(controls, /slide outward into LOCK/,
  'Accessible control instructions must stay correct in either handedness');

assert.match(driveCss, /:root\.turn-left-handed-controls \.pedals \{[\s\S]*grid-column: 1;/,
  'Only the primary drive surface should move to the left');
assert.match(driveCss, /:root\.turn-left-handed-controls \.utility-group \{[\s\S]*justify-self: center;/,
  'Race utility buttons must remain unmirrored and clear of the left drive pad');
assert.doesNotMatch(driveCss, /turn-left-handed-controls[\s\S]{0,100}row-reverse/,
  'The handedness policy must not reverse the complete race UI');
assert.match(driveCss, /:root\.turn-left-handed-controls \.drive-lock-bubble \{[\s\S]*left: calc\(100% - 4px\)/,
  'Left-handed LOCK must sit outside the right edge');
assert.match(driveCss, /:root\.turn-left-handed-controls \.drive-boost-zone \{[\s\S]*border-right:/);
assert.match(driveCss, /:root\.turn-left-handed-controls \.drive-drift-zone \{[\s\S]*border-left:/);
assert.match(manualCss, /:root\.turn-left-handed-controls \.manual-steer \{[\s\S]*right: max\(22px, env\(safe-area-inset-right\)\)/,
  'On-screen steering must move to the right without reversing its steering values');
assert.match(guide, /slide outward past it into/);
assert.doesNotMatch(guide, /slide farther left into/);

assert.match(storageBootstrap, /__TURN_SHARED_LOCAL_STORAGE__/,
  'YOUR TURN must retain the safe raw preference bridge used by shared TURN UI preferences');
assert.match(handedness, /globalThis\.__TURN_SHARED_LOCAL_STORAGE__ \|\| globalThis\.localStorage/,
  'The handedness preference must use the shared bridge in YOUR TURN without changing challenge records');
assert.match(workflow, /node turn-tests\/control-handedness-production\.mjs/,
  'The complete regression suite must protect the handedness feature');

console.log('TURN persisted left-handed layout, mirrored thumb geometry and accessible focus order passed.');

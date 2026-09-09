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

const [
  home,
  handedness,
  controls,
  driveCss,
  manualCss,
  peripheralCss,
  guide,
  storageBootstrap,
  workflow,
  turnIndex,
  nextIndex,
  labIndex,
  yourTurnIndex
] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/control-handedness.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/manual-steering.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/peripheral-hud-r261.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8')
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
assert.match(
  driveCss,
  /:root\.turn-left-handed-controls \.utility-group \{[\s\S]*grid-column: 2;[\s\S]*align-self: end;[\s\S]*justify-self: end;[\s\S]*transform: none;/,
  'The left-handed menu bar must occupy the bottom-right slot beneath on-screen steering'
);
assert.match(manualCss, /bottom: max\(68px, calc\(env\(safe-area-inset-bottom\) \+ 56px\)\)/,
  'The on-screen steering pad must reserve the bottom strip for the menu bar');
assert.match(
  driveCss,
  /@media \(max-width: 700px\) and \(max-height: 430px\)[\s\S]*turn-left-handed-controls \.utility-group\[data-menu-state="staged"\][\s\S]*gap: 5px/,
  'The left-handed menu must preserve separation from the drive pad on narrow landscape screens'
);
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


assert.match(
  peripheralCss,
  /:root\.turn-left-handed-controls \.topbar \{[\s\S]*flex-direction: row-reverse;/,
  'Left-handed controls must mirror the stats/minimap topbar'
);
assert.match(
  peripheralCss,
  /:root\.turn-left-handed-controls \.score-feedback \{[\s\S]*right: var\(--turn-peripheral-right-edge\);[\s\S]*left: auto;/,
  'The scorekeeper must follow steering onto the right-hand peripheral column'
);
assert.match(
  peripheralCss,
  /\.score-feedback \{[\s\S]*left: var\(--turn-peripheral-left-edge\);[\s\S]*height: min\([\s\S]*var\(--app-height\)[\s\S]*var\(--turn-peripheral-score-clearance\)/,
  'The default scorekeeper must align with stats and budget its dual-row height above steering'
);
assert.match(
  peripheralCss,
  /\.score-feedback-row \{[\s\S]*min-height: 52px;[\s\S]*flex: 0 1 var\(--score-feedback-paper-height\);/,
  'DRIFT and FLOW rows must shrink together before they can reach steering'
);
assert.match(
  peripheralCss,
  /:root\.turn-left-handed-controls \.score-feedback-gauge-shell \{[\s\S]*right: calc\(100% - var\(--score-feedback-gauge-overlap\)\);[\s\S]*left: auto;[\s\S]*transform-origin: right center;/,
  'Left-handed score gauges must unfold inward from the right-hand paper'
);
assert.match(
  peripheralCss,
  /:root\.turn-left-handed-controls \.score-feedback-meter > i,[\s\S]*to left,[\s\S]*transform-origin: right center;/,
  'Mirrored score fill must grow toward the playfield rather than the outer edge'
);
assert.match(
  peripheralCss,
  /\.score-feedback\[data-score-layout="dual"\] \.score-feedback-callout \{[\s\S]*top: 0;[\s\S]*left: calc\(100% \+ var\(--score-feedback-gauge-width\) \+ 9px\);/,
  'Worst-case score callouts must use the inboard slot instead of dropping into steering'
);
assert.match(
  peripheralCss,
  /@media \(max-height: 560px\) and \(orientation: landscape\)[\s\S]*--turn-peripheral-manual-height: clamp\(96px, 14vw, 126px\);/,
  'Short landscape layouts must reduce the steering and score footprint together'
);
assert.match(
  peripheralCss,
  /@media \(max-height: 360px\) and \(orientation: landscape\)[\s\S]*--turn-peripheral-stats-height: 48px;[\s\S]*--turn-peripheral-manual-height: 82px;/,
  'Very short landscape layouts must compact stats and steering before overlap'
);
assert.match(peripheralCss, /env\(safe-area-inset-left\)/);
assert.match(peripheralCss, /env\(safe-area-inset-right\)/);
assert.match(peripheralCss, /env\(safe-area-inset-top\)/);
assert.match(peripheralCss, /env\(safe-area-inset-bottom\)/);

const peripheralStylesheet = /peripheral-hud-r261\.css\?revision=r261-mirrored-periphery/;
for (const [deployment, markup] of [
  ['TURN', turnIndex],
  ['TURN NEXT', nextIndex],
  ['TURN LAB', labIndex],
  ['YOUR TURN', yourTurnIndex]
]) {
  assert.match(markup, peripheralStylesheet, `${deployment} must inherit the mirrored peripheral HUD`);
}
for (const [deployment, markup] of [
  ['TURN', turnIndex],
  ['TURN NEXT', nextIndex],
  ['TURN LAB', labIndex]
]) {
  assert.ok(
    markup.indexOf('scoring/score-feedback.css') < markup.indexOf('peripheral-hud-r261.css'),
    `${deployment} must apply the composition layer after ScoreFeedback's component styles`
  );
}
assert.ok(
  yourTurnIndex.indexOf('manual-steering.css') < yourTurnIndex.indexOf('peripheral-hud-r261.css'),
  'YOUR TURN must apply the shared composition after its canonical steering styles'
);

console.log('TURN persisted handedness, complete mirrored HUD composition and accessible focus order passed.');

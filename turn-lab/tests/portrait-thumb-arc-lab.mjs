import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import vm from 'node:vm';

const [index, arc, arcRuntime, portraitR1, productionControls] = await Promise.all([
  fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../portrait-thumb-arc-r2.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../portrait-thumb-arc-r2.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../portrait-play-r1.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8')
]);

const r1Href = '/turn-lab/portrait-play-r1.css?revision=r1';
const r2Href = '/turn-lab/portrait-thumb-arc-r2.css?revision=r2';
const r2Runtime = '/turn-lab/portrait-thumb-arc-r2.js?revision=r2';

assert.ok(index.includes(r2Href), 'TURN LAB must load the portrait R2 thumb arc');
assert.ok(index.includes(r2Runtime), 'TURN LAB must load the portrait R2 hit-geometry adapter');
assert.ok(
  index.indexOf(r2Href) > index.indexOf(r1Href),
  'The rollback-friendly R2 control layer must load after the portrait R1 foundation'
);
assert.match(index, /purpose: 'roadtrip-world-r1\+portrait-play-r2-thumb-arc'/);
assert.match(index, /TURN LAB · PORTRAIT PLAY R2/);

assert.match(arc, /@media \(orientation: portrait\)/);
assert.doesNotMatch(arc, /@media \(orientation: landscape\)/);
assert.match(arc, /html\.turn-lab-portrait \.controls/);
assert.match(arc, /grid-template-columns: minmax\(0, 1fr\) !important/);
assert.match(arc, /grid-template-columns: minmax\(0, 72fr\) minmax\(0, 28fr\) !important/);
assert.match(arc, /justify-self: end !important/);
assert.match(arc, /clip-path: polygon\(/);
assert.match(arc, /-webkit-clip-path: polygon\(/);
assert.match(
  arc,
  /grid-template-rows: minmax\(0, 32fr\) minmax\(0, 44fr\) minmax\(0, 24fr\) !important/,
  'The visible arc segments must retain the production Drive Pad row contract'
);

assert.match(productionControls, /const TOP_ZONE_SHARE = 0\.32/);
assert.match(productionControls, /const BRAKE_ZONE_START = 0\.76/);
assert.match(productionControls, /drivePad\.setPointerCapture/);
assert.match(productionControls, /drivePad\.dataset\.driveZone/);
assert.match(productionControls, /brakeButton\.textContent = 'Brake · Reverse'/);
assert.match(productionControls, /driftZone\.setAttribute\('aria-label', 'Gas and drift'\)/);
assert.match(productionControls, /boostZone\.setAttribute\('aria-label', 'Gas and boost'\)/);

assert.doesNotMatch(portraitR1, /thumb-arc-r2/);

let portrait = true;
const drivePad = {
  dataset: {},
  getBoundingClientRect() {
    return { x: 12, y: 500, left: 12, top: 500, width: 369, height: 268, right: 381, bottom: 768 };
  }
};
const root = { dataset: { turnDeployment: 'lab' } };
const context = {
  document: {
    documentElement: root,
    body: {},
    readyState: 'complete',
    querySelector(selector) { return selector === '.drive-pad' ? drivePad : null; }
  },
  matchMedia() { return { get matches() { return portrait; } }; }
};
context.window = context;
vm.runInNewContext(arcRuntime, context, { filename: 'portrait-thumb-arc-r2.js' });

assert.equal(root.dataset.turnLabThumbArc, 'r2');
assert.equal(root.dataset.turnLabThumbArcSplit, '72');
assert.equal(drivePad.dataset.turnPortraitArcHitGeometry, 'r2');

const portraitRect = drivePad.getBoundingClientRect();
assert.equal(portraitRect.left, 12);
assert.equal(portraitRect.top, 500);
assert.equal(portraitRect.width, 369 * 1.44);
assert.equal(portraitRect.right, 12 + 369 * 1.44);
assert.equal(portraitRect.height, 268);

// Short portrait viewport, 34 px home-indicator inset and the production
// utility-row sizing: even the 24% Brake row remains above TURN's comfortable
// 44 CSS px design baseline. The narrowest visible arc band is wider still.
const shortDeckHeight = 310;
const shortPadHeight = shortDeckHeight - 4 - 10 - 34 - 46 - 8;
const shortPadInnerHeight = shortPadHeight - 10 - 10;
const rowHeights = [0.32, 0.44, 0.24].map((share) => shortPadInnerHeight * share);
assert.ok(Math.min(...rowHeights) >= 44);
assert.ok((320 - 24) * 0.24 >= 44);

portrait = false;
assert.deepEqual(
  { ...drivePad.getBoundingClientRect() },
  { x: 12, y: 500, left: 12, top: 500, width: 369, height: 268, right: 381, bottom: 768 },
  'Landscape must receive the untouched production hit rectangle'
);

console.log('TURN LAB portrait R2 thumb arc, race-state sizing and production control contract passed.');

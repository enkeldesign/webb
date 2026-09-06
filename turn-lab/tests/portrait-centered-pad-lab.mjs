import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, pad, portraitR1, productionControls, readme] = await Promise.all([
  fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../portrait-centered-pad-r3.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../portrait-play-r1.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../README.md', import.meta.url), 'utf8')
]);

const r1Href = '/turn-lab/portrait-play-r1.css?revision=r1';
const r3Href = '/turn-lab/portrait-centered-pad-r3.css?revision=r3';

assert.ok(index.includes(r3Href), 'TURN LAB must load the portrait R3 centred pad');
assert.ok(
  index.indexOf(r3Href) > index.indexOf(r1Href),
  'The rollback-friendly R3 control layer must load after the portrait R1 foundation'
);
assert.doesNotMatch(index, /portrait-thumb-arc-r2/);
assert.match(index, /purpose: 'roadtrip-world-r1\+portrait-play-r3-centered-pad'/);
assert.match(index, /TURN LAB · PORTRAIT PLAY R3/);

assert.match(pad, /@media \(orientation: portrait\)/);
assert.doesNotMatch(pad, /@media \(orientation: landscape\)/);
assert.match(pad, /html\.turn-lab-portrait \.controls/);
assert.match(pad, /grid-template-columns: minmax\(0, 1fr\) !important/);
assert.match(pad, /width: min\(100%, 480px\) !important/);
assert.match(pad, /margin: 0 auto !important/);
assert.match(pad, /justify-self: center !important/);
assert.match(pad, /clip-path: none !important/);
assert.match(pad, /-webkit-clip-path: none !important/);
assert.match(
  pad,
  /grid-template-rows: minmax\(0, 32fr\) minmax\(0, 44fr\) minmax\(0, 24fr\) !important/,
  'The visible pad must retain the production Drive Pad row contract'
);
assert.match(
  pad,
  /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) !important/,
  'The visible Drift and Boost targets must match production hit geometry'
);

assert.match(productionControls, /const TOP_ZONE_SHARE = 0\.32/);
assert.match(productionControls, /const BRAKE_ZONE_START = 0\.76/);
assert.match(productionControls, /if \(y < TOP_ZONE_SHARE\) return x < 0\.5 \? 'drift' : 'boost'/);
assert.match(productionControls, /drivePad\.setPointerCapture/);
assert.match(productionControls, /drivePad\.dataset\.driveZone/);
assert.match(productionControls, /brakeButton\.textContent = 'Brake'/);
assert.match(productionControls, /className = 'drive-reverse-bubble'/);
assert.match(productionControls, /driftZone\.setAttribute\('aria-label', 'Gas and drift'\)/);
assert.match(productionControls, /boostZone\.setAttribute\('aria-label', 'Gas and boost'\)/);

assert.doesNotMatch(portraitR1, /centered-pad-r3/);
assert.match(readme, /left, centre or right in portrait and on either side in landscape/);

// Compact 320 x 640 portrait viewport: account for the utility row, gaps,
// safe-area inset, pad border and deck padding. Even the shortest Brake row
// remains above TURN's comfortable 44 CSS px design baseline.
const compactViewportWidth = 320;
const compactDeckHeight = 318;
const compactPadWidth = Math.min(compactViewportWidth - 16, 480);
const compactPadHeight = compactDeckHeight - 10 - 10 - 34 - 46 - 8;
const compactInnerHeight = compactPadHeight - 8;
const compactRows = [0.32, 0.44, 0.24].map((share) => compactInnerHeight * share);

assert.ok(compactPadWidth / 2 >= 44);
assert.ok(Math.min(...compactRows) >= 44);

console.log('TURN LAB portrait R3 centred pad, compact sizing and production control contract passed.');

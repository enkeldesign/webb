import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// GARAGE structure: how ROADBOOK opens it, its heading and announcement structure for
// assistive technology, and the showroom's rendering and teardown budget.
const [home, garage, viewer] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/garage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/showroom-viewer.js', import.meta.url), 'utf8')
]);

// --- Module identity ------------------------------------------------------------------
// GARAGE's own modules take their identity from the release (import maps), never from a
// new manual revision= query.
for (const module of ['training-car-guide', 'showroom-viewer', 'garage-cars', 'garage-selection']) {
  assert.match(garage, new RegExp(`from '\\./${module}\\.js';`), `${module}.js is imported by its release-bound path`);
}
const importMaps = await Promise.all(['../turn/index.html', '../turn-next/index.html', '../yourturn/index.html']
  .map((entry) => fs.readFile(new URL(entry, import.meta.url), 'utf8')));
for (const entry of importMaps) {
  assert.match(entry, /"\/turn\/garage\/training-car-guide\.js": "\/turn\/garage\/training-car-guide\.js\?build=/);
}

// --- ROADBOOK → GARAGE ---------------------------------------------------------------
assert.match(home, /import\('\/turn\/garage\/garage\.js'\)\.then\(async \(module\) => \{\s*await module\.prepareGarage\(\);/,
  'ROADBOOK warms GARAGE and its stylesheets before CHOOSE CAR');
assert.match(home, /await Promise\.all\(\[[\s\S]*activateTrack\(trackId, runtime\),[\s\S]*prepareLotOnce\(\)[\s\S]*\]\);/,
  'GARAGE prepares in parallel with track activation');
assert.ok(home.indexOf('prepareLotOnce()\n      ]);') < home.indexOf('garageModule.showGarage({'),
  'GARAGE is prepared before it opens');
assert.ok(home.indexOf('garageModule.showGarage({') < home.indexOf('const removeRaceGate = installLotRaceGate'),
  'GARAGE mounts RACE synchronously, before the motion-access gate looks for it');
assert.match(home, /if \(!selection\) \{\s*showHome\(\{ focus: true \}\);/, 'Back returns to ROADBOOK, focused');

// --- Structure for assistive technology --------------------------------------------------
assert.match(garage, /root\.setAttribute\('aria-labelledby', 'garageTitle'\)/);
assert.match(garage, /<h1 class="turn-pr-display" id="garageTitle" tabindex="-1">GARAGE<\/h1>/,
  'GARAGE is the H1 and takes focus on open, like every TURN dialog heading');
assert.match(garage, /title\.focus\(\{ preventScroll: true \}\)/);
assert.match(garage, /<section class="garage-feature" aria-labelledby="garageCarName">[\s\S]*<h2 class="garage-name" id="garageCarName"><\/h2>/,
  'The featured car is an H2 section named by the car');
assert.match(garage, /<h3 class="garage-disclosure-head">[\s\S]*?Specifications/, 'Specifications is an H3 disclosure');
assert.match(garage, /<h3 class="garage-disclosure-head">[\s\S]*?garage-perk-chip">PERK/, 'The perk is an H3 disclosure');
assert.match(garage, /<div class="garage-view" aria-hidden="true"><\/div>/, 'The 3D view is decorative');
assert.match(garage, /aria-label="Previous car"/);
// The icons show the direction the car turns on screen; the -45° button turns it
// clockwise seen from above the stage.
assert.match(garage, /data-rotate="-45" aria-label="Turn the car left"><span aria-hidden="true">↻<\/span>/);
assert.match(garage, /data-rotate="45" aria-label="Turn the car right"><span aria-hidden="true">↺<\/span>/);
assert.match(garage, /aria-label="Next car"/);
assert.match(garage, /announcer\.textContent = `\$\{car\.name\}, \$\{ORDER\.indexOf\(car\.id\) \+ 1\} of \$\{ORDER\.length\}\$\{lock \? `\. Locked until \$\{lock\.threshold\} trophies` : ''\}\.`;/,
  'Previous/next keep focus and announce the car, its position and any lock');
assert.match(garage, /class="garage-announcer garage-visually-hidden" role="status" aria-live="polite"/);
assert.match(garage, /id="garagePaint" role="group" aria-label="Car paint"/,
  'Paint is a named control group, not another heading');
assert.match(garage, /<button class="turn-pr-button is-primary garage-race" type="button" aria-describedby="garageDockContext">/,
  'RACE is described by the track and car beside it');
assert.match(garage, /raceButton\.setAttribute\('aria-label', `\$\{car\.name\} is locked until \$\{lock\.threshold\} trophies\.`\)/);
assert.match(garage, /const ENTRY_TAP_GUARD_MS = 600/,
  'A VoiceOver double-tap that opened GARAGE never lands on RACE');
assert.match(garage, /if \(event\.key === 'Escape' && selection\.state\(\)\.preview && !documentRef\.querySelector\('dialog\[open\]'\)\)/,
  'Escape leaves a preview unless a dialog owns the key');

// --- Showroom budget ---------------------------------------------------------------------
assert.match(viewer, /const FRAME_INTERVAL_MS = 1000 \/ 30/, 'The live view is capped at 30fps');
assert.match(viewer, /document\.hidden/, 'The view does no work while the page is hidden');
assert.match(viewer, /prefers-reduced-motion: reduce/, 'Reduced motion stops the idle spin');
assert.match(viewer, /if \(!dragging && !reducedMotion\) yaw \+= IDLE_SPIN/);
assert.match(viewer, /yaw \+= \(event\.clientX - lastX\) \* DRAG_RATE/, 'Dragging turns the car around its vertical axis');
assert.match(viewer, /stage\.rotation\.set\(0, yaw, 0\)/, 'The car stays level: no pitch or roll');
assert.doesNotMatch(viewer, /clientY|stage\.rotation\.x\s*=|pitch/);
assert.match(garage, /viewer\.stop\(\);\s*root\.remove\(\);[\s\S]*viewer\.dispose\(\);[\s\S]*resolve\(/,
  'GARAGE releases its WebGL context before handing control to the race');
assert.match(garage, /shift\.trigger\.addEventListener\('click', \(\) => \{\s*if \(shift\.dialog\.open\) viewer\.pause\(\);/,
  'The view pauses while the SHIFT dialog covers it');

console.log('GARAGE opens prepared from ROADBOOK, announces each car, keeps its H1/H2/H3 structure and a 30fps level showroom.');

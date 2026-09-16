import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [release, index, labIndex] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8').then(JSON.parse),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8')
]);

const requiredLegacyHooks = [
  'controls',
  'manualSteer',
  'calibrateButton',
  'resetButton',
  'gasButton',
  'brakeButton'
];

for (const [label, source] of [['TURN', index], ['TURN LAB', labIndex]]) {
  for (const id of requiredLegacyHooks) {
    assert.match(source, new RegExp(`id=["']${id}["']`), `${label} must retain #${id} until main.js no longer depends on the legacy compatibility shell`);
  }

  const appIndex = source.indexOf('./app.js?build=');
  assert.ok(appIndex > 0, `${label} must load app.js`);
  for (const id of requiredLegacyHooks) {
    assert.ok(source.indexOf(`id="${id}"`) < appIndex, `${label} must define #${id} before app.js starts`);
  }
}

const requiredProductionBootstraps = [
  './ui/about-history-bootstrap-r165.js',
  './ui/startup-screen-reader-handoff-r529.js',
  './testing/admin-unlock-sequence.js',
  './ui/low-graphics-setting.js',
  './render/skid-continuity-r198.js',
  './tracks/cliffside-inner-buildings-r202.js',
  './tracks/cliffside-house-inset-r203.js',
  './tracks/kenney-track-landmarks-r517.js',
  './input/qe-drive-controls-bootstrap.js',
  './ui/r411-race-controls.js',
  './ui/trophy-road-highlight-perk-polish-r258.js',
  './accessibility/color-accessibility-r163.js',
  './achievements/chromatic-camouflage-r183.js',
  './social/your-turn-share-bootstrap.js',
  './tracks/countryside-bella-rescue-hotfix-r176.js'
];

for (const script of requiredProductionBootstraps) {
  assert.ok(index.includes(script), `Production TURN must retain bootstrap ${script}`);
}

assert.match(index, new RegExp(`app\\.js\\?build=${release.cacheKey}`), 'Production app.js must be cache-bound to the current TURN build');
assert.match(labIndex, new RegExp(`app\\.js\\?build=${release.cacheKey}`), 'TURN LAB app.js must be cache-bound to the current TURN build');

console.log(`TURN startup shell contract verified for ${release.id}.`);

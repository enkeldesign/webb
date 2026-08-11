import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [lotGate, paintGate, paintCss, lotRuntime, app, index, releaseSource] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/lot-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road-r157.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const syncBody = paintGate.match(/function sync\(\) \{([\s\S]*?)\n  \}\n\n  const observer/ )?.[1] || '';
assert.ok(syncBody, 'The paint gate must expose a bounded synchronization function');
assert.match(paintGate, /observer\.observe\(picker,/,
  'Paint synchronization must observe the car picker rather than the whole Lot screen');
assert.doesNotMatch(paintGate, /observer\.observe\(screen,/,
  'The lock presentation must not be inside the paint observer target');
assert.match(syncBody, /if \(locked\) ensureLockButton\(carId\);[\s\S]*else removeLockPresentation\(\)/,
  'Paint synchronization must keep the compact lock control only while paint is actually locked');
assert.doesNotMatch(syncBody, /lot-paint-lock[\s\S]*remove\(\);[\s\S]*if \(locked\)/,
  'A synchronization pass must never remove and immediately recreate its own lock control');
assert.match(paintGate, /try \{[\s\S]*\} finally \{[\s\S]*syncing = false/,
  'The synchronization guard must always be released');

assert.doesNotMatch(paintGate, /colors\.addEventListener\(['"]click['"]/,
  'The paint container must never be a click-listener ancestor of the native color input');
assert.doesNotMatch(paintGate, /colors\.addEventListener\(['"]keydown['"]/,
  'The paint container must not emulate button keyboard behavior');
assert.doesNotMatch(paintGate, /colors\.setAttribute\('role', 'button'\)|colors\.tabIndex\s*=/,
  'The paint group must keep its real group semantics instead of becoming a faux button');
assert.match(paintGate, /button = document\.createElement\('button'\)/,
  'Locked Paintjob feedback should use a real button');
assert.match(paintGate, /button\.type = 'button'/);
assert.match(paintGate, /button\.className = 'lot-paint-lock-button'/);
assert.match(paintGate, /button\.addEventListener\('click', showLockedPaintInfo\)/,
  'The lock explanation belongs directly to the lock button, not an ancestor of paint inputs');
assert.match(paintGate, /lot-paint-lock-copy/);
assert.match(paintGate, /<strong>PAINTJOB<\/strong>/);
assert.doesNotMatch(paintGate, /<i>•<\/i>|<b>LOCKED<\/b>/,
  'Visible lock-status copy must not crowd out the Paintjob label');
assert.match(paintGate, /function contrastingInk\(hexColor\)/);
assert.match(paintGate, /luminance > 0\.18 \? '#08090a' : '#fffdf6'/,
  'The lock glyph must use whichever TURN ink gives the stronger colour contrast');
assert.match(paintGate, /--lot-paint-lock-background/);
assert.match(paintGate, /--lot-paint-lock-foreground/);
assert.match(paintGate, /getVehicleDefaultColor\(carId\)/,
  'The locked swatch must represent the selected car factory colour');

assert.match(paintCss, /\.lot-colors\.is-paint-locked[\s\S]*min-height: 54px/);
assert.match(
  paintCss,
  /\.lot-viewbox-with-paint \.lot-colors\.is-paint-locked \{[\s\S]*position: absolute;[\s\S]*bottom: 0;/,
  'The locked Paintjob treatment must occupy the reserved bottom rail rather than cover the 3D viewer'
);
assert.doesNotMatch(
  paintCss.match(/\.lot-colors\.is-paint-locked\s*\{([\s\S]*?)\}/)?.[1] || '',
  /position: relative/,
  'The generic locked state must not override the absolute bottom-rail placement'
);
const paintLockButtonRule = paintCss.match(/\.lot-paint-lock-button\s*\{([\s\S]*?)\}/)?.[1] || '';
assert.ok(paintLockButtonRule, 'The real locked Paintjob button must have its own layout rule');
assert.match(paintLockButtonRule, /grid-template-columns: minmax\(0, 1fr\) auto/);
assert.match(paintLockButtonRule, /width: 100%/);
const paintLockRule = paintCss.match(/\.lot-paint-lock\s*\{([\s\S]*?)\}/)?.[1] || '';
assert.ok(paintLockRule, 'The compact paint lock must have its own CSS rule');
assert.match(paintLockRule, /width: 36px/);
assert.match(paintLockRule, /height: 36px/);
assert.match(paintLockRule, /background: var\(--lot-paint-lock-background/);
assert.match(paintLockRule, /color: var\(--lot-paint-lock-foreground/);
assert.match(paintLockRule, /border: 2px solid var\(--turn-ink/,
  'The swatch keeps the TURN black outline even when the lock glyph needs white contrast');
assert.doesNotMatch(paintLockRule, /width: 100%/);

assert.match(lotGate, /function dismissVisibleUnlockNotice\(\)/);
assert.match(lotGate, /\.turn-unlock-notice\.is-visible/);
assert.match(lotGate, /notice\.classList\.remove\('is-visible'\)/);
assert.match(lotGate, /if \(lastAnnouncedCarId\) dismissVisibleUnlockNotice\(\)/,
  'Selecting an available vehicle after a locked one must remove the stale lock notice');
assert.match(lotGate, /if \(lastAnnouncedCarId\) dismissVisibleUnlockNotice\(\);[\s\S]*raceButton\.classList\.remove/,
  'Leaving The Lot must not leave a vehicle lock notice behind');

assert.match(lotRuntime, /lot-trophy-gate\.js\?revision=r164-perks/);
assert.match(lotRuntime, /lot-paint-reward\.js\?revision=r164-perks/);
assert.match(lotRuntime, /lot-perk-disclosure\.js\?revision=r164-perks/);
assert.match(app, /trophy-road-r157\.css\?revision=r163-native-picker-parent-click/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r163-native-picker-parent-click/);
assert.match(
  index,
  new RegExp(`app\\.js\\?build=${release.cacheKey}-browser-consent-r176-bella-road-derived-zone-voiceover-paint-parent-click`)
);

console.log('TURN Lot lock feedback, perk revisions and native paint ancestry regressions passed.');

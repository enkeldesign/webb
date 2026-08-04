import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [paintGate, paintCss, lotRuntime, app, index, releaseSource] = await Promise.all([
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
assert.match(syncBody, /setLockedInteraction\(locked\)/,
  'Paint synchronization must retain or remove the compact rail according to the current state');
assert.doesNotMatch(syncBody, /lot-paint-lock[\s\S]*remove\(\);[\s\S]*if \(locked\)/,
  'A synchronization pass must never remove and immediately recreate its own lock icon');
assert.match(paintGate, /try \{[\s\S]*\} finally \{[\s\S]*syncing = false/,
  'The synchronization guard must always be released');
assert.match(paintGate, /colors\.addEventListener\('click', handleLockedAreaClick\)/,
  'Any tap in the locked paint rail must explain the Trophy Road requirement');
assert.match(paintGate, /colors\.addEventListener\('keydown', handleLockedAreaKeydown\)/,
  'The locked paint rail must expose the same explanation from the keyboard');
assert.match(paintGate, /colors\.setAttribute\('role', 'button'\)/);
assert.match(paintGate, /colors\.tabIndex = 0/);
assert.match(paintGate, /lot-paint-lock-copy/);
assert.match(paintGate, /<strong>Paintjob<\/strong><i>•<\/i><b>LOCKED<\/b>/);
assert.doesNotMatch(paintGate, /document\.createElement\('button'\)[\s\S]*lot-paint-lock/,
  'The compact lock must not create a nested oversized button');
assert.match(paintCss, /\.lot-colors\.is-paint-locked[\s\S]*min-height: 54px/);
assert.match(
  paintCss,
  /\.lot-viewbox-with-paint \.lot-colors\.is-paint-locked \{[\s\S]*position: absolute;[\s\S]*bottom: 0;[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/,
  'The locked Paintjob treatment must occupy the reserved bottom rail rather than cover the 3D viewer'
);
assert.doesNotMatch(
  paintCss.match(/\.lot-colors\.is-paint-locked\s*\{([\s\S]*?)\}/)?.[1] || '',
  /position: relative/,
  'The generic locked state must not override the absolute bottom-rail placement'
);
const paintLockRule = paintCss.match(/\.lot-paint-lock\s*\{([\s\S]*?)\}/)?.[1] || '';
assert.ok(paintLockRule, 'The compact paint lock must have its own CSS rule');
assert.match(paintLockRule, /width: 36px/);
assert.match(paintLockRule, /height: 36px/);
assert.doesNotMatch(paintLockRule, /width: 100%/);
assert.match(lotRuntime, /lot-paint-reward\.js\?revision=r160-bottom-paint-rail/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r121&trophy-road=r159&paint=r159-paint-lock-observer/);
assert.match(
  index,
  new RegExp(`app\\.js\\?build=${release.cacheKey}-browser-consent-r160-reward-detail-paint-rail`)
);

console.log('TURN locked Paintjob rail remains compact, explainable, below the viewer and free from observer loops.');

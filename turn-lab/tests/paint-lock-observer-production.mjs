import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [paintGate, lotRuntime, app, index] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8')
]);

const syncBody = paintGate.match(/function sync\(\) \{([\s\S]*?)\n  \}\n\n  const observer/ )?.[1] || '';
assert.ok(syncBody, 'The paint gate must expose a bounded synchronization function');
assert.match(paintGate, /observer\.observe\(picker,/,
  'Paint synchronization must observe the car picker rather than the whole Lot screen');
assert.doesNotMatch(paintGate, /observer\.observe\(screen,/,
  'The lock notice panel must not be inside the paint observer target');
assert.match(syncBody, /if \(locked\) \{[\s\S]*ensureLockNotice\(\);[\s\S]*\} else \{[\s\S]*lot-paint-lock[\s\S]*remove\(\)/,
  'The lock notice must be retained while locked and removed only when it is no longer needed');
assert.doesNotMatch(syncBody, /lot-paint-lock[\s\S]*remove\(\);[\s\S]*if \(locked\)/,
  'A synchronization pass must never remove and immediately recreate its own observed lock notice');
assert.match(paintGate, /try \{[\s\S]*\} finally \{[\s\S]*syncing = false/,
  'The synchronization guard must always be released');
assert.match(lotRuntime, /lot-paint-reward\.js\?revision=r159-paint-lock-observer/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r121&trophy-road=r157&paint=r159-paint-lock-observer/);
assert.match(index, /app\.js\?build=20260803-r126-browser-consent-r159-paint-lock-observer/);

console.log('TURN Lot paint lock observer reaches quiescence and cannot freeze Home-to-Lot race entry.');

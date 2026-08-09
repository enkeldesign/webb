import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  COLOR_CUES_STORAGE_KEY,
  TRACK_COLOR_CUES,
  describeColorCue,
  loadColorCuesEnabled,
  saveColorCuesEnabled,
  trackColorCue
} from '../../turn/accessibility/color-cues.js';

const [releaseSource, indexSource, runtimeSource, cueCssSource, lotSource, lotCssSource, historySource] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-accessibility-r163.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-cues-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/content/about-history.js', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.equal(COLOR_CUES_STORAGE_KEY, 'turn-color-cues-v1');
assert.deepEqual(TRACK_COLOR_CUES, {
  countryside: 'pink',
  airport: 'yellow',
  harbor: 'orange',
  cliffside: 'cyan',
  'midnight-city': 'violet'
});
assert.equal(trackColorCue('countryside'), 'pink');
assert.equal(describeColorCue('#ff00ff'), 'magenta');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value))
};
assert.equal(loadColorCuesEnabled(storage), false, 'Color Cues must be off by default');
assert.equal(saveColorCuesEnabled(true, storage), true);
assert.equal(loadColorCuesEnabled(storage), true);
assert.equal(saveColorCuesEnabled(false, storage), true);

assert.equal(release.version, '1.7.0');
assert.equal(release.id, '2026.08.09-r163');
assert.match(indexSource, /garage\/lot-r10\.css\?build=20260809-r163-paint-basics/);
assert.match(indexSource, /color-accessibility-r163\.js\?build=20260809-r163-paint-basics/);
assert.doesNotMatch(indexSource, /native-color-input-r163\.css/,
  'There must not be a second stylesheet whose job is to undo the paint-control stylesheet');
assert.doesNotMatch(indexSource, /syncFixedLiveryRail|emergencyVehicleNames/,
  'Production index must not patch The Lot after render');

assert.match(lotSource, /const control = document\.createElement\('label'\)/,
  'The paint field must use an ordinary label around the native input');
assert.match(lotSource, /input\.type = 'color'/,
  'The visible paint swatch and interactive control must be the native input[type=color]');
assert.match(lotSource, /input\.className = 'lot-color-input'/);
assert.match(lotSource, /control\.append\(copy, input\)/);
assert.match(lotSource, /cue\.textContent = `COLOR · \$\{describeColorCue\(input\.value\)\.toUpperCase\(\)\}`/,
  'Color Cues must use the shared broad semantic classifier');
assert.doesNotMatch(lotSource, /lot-color-trigger|lot-color-native|openNativeColorPicker|focusNativeColorInput|isIOSFamily|showPicker\(|label\.click\(/,
  'The Lot must not contain a second swatch or synthetic picker activation path');
assert.doesNotMatch(lotSource, /input\.setAttribute\('aria-label'/,
  'Color Cues should not replace the native input semantics with a scripted accessible name');
assert.doesNotMatch(lotSource, /input\.setAttribute\('aria-hidden'|input\.tabIndex = -1/,
  'The native input must remain in the normal accessibility and keyboard order');

assert.match(lotCssSource, /\.lot-color-input \{[\s\S]*width: 38px[\s\S]*height: 28px[\s\S]*border: 2px solid var\(--ink\)/,
  'The native input must be styled directly as the visible swatch');
assert.doesNotMatch(lotCssSource, /\.lot-color-trigger|opacity: 0\.001/,
  'Core Lot CSS must not contain the retired hidden-input or duplicate-trigger treatment');
const paintInputCss = lotCssSource.match(/\.lot-color-input \{[\s\S]*?\}/)?.[0] || '';
assert.doesNotMatch(paintInputCss, /pointer-events:\s*none|opacity:\s*0(?:\.0+)?/,
  'The native paint input itself must remain visible and interactive');

assert.doesNotMatch(runtimeSource, /describeColorCue|lot-color-control|input\[type="color"\]|onPaintValueChange|replaceWith|removeAttribute\('aria-hidden'/,
  'Color Cues runtime must not post-process paint controls');
assert.match(runtimeSource, /Color cues/);
assert.match(runtimeSource, /TRACK COLOR ·/);
assert.doesNotMatch(runtimeSource, /setInterval|setAnimationLoop/);

assert.match(cueCssSource, /data-turn-color-cues='on'/);
assert.match(cueCssSource, /track-card-color-cue/);
assert.match(cueCssSource, /lot-color-cue/);
assert.match(cueCssSource, /repeating-linear-gradient/);

assert.match(historySource, /1\.7\.0 r163/);
assert.match(historySource, /accessibility patch/i);
assert.match(historySource, /CHROMATIC CAMOUFLAGE/);
assert.match(historySource, /Color Cues/);

console.log('TURN 1.7.0 r163 first-principles native color input and Color Cues regression passed.');

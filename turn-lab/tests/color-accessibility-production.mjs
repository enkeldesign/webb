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

const [
  releaseSource,
  indexSource,
  runtimeSource,
  cueCssSource,
  nativeInputCssSource,
  lotSource,
  historySource
] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-accessibility-r163.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-cues-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/native-color-input-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
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
assert.equal(trackColorCue('midnight-city'), 'violet');
assert.equal(trackColorCue('invented'), '');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value))
};
assert.equal(loadColorCuesEnabled(storage), false, 'Color Cues must be off by default');
assert.equal(saveColorCuesEnabled(true, storage), true);
assert.equal(loadColorCuesEnabled(storage), true);
assert.equal(saveColorCuesEnabled(false, storage), true);
assert.equal(loadColorCuesEnabled(storage), false);

assert.equal(describeColorCue('#ff70b4'), 'pink');
assert.equal(describeColorCue('#ff00ff'), 'magenta',
  'TURN should use the ordinary semantic name for canonical Magenta');
assert.equal(describeColorCue('#ffd84f'), 'yellow');
assert.equal(describeColorCue('#f28b39'), 'orange');
assert.equal(describeColorCue('#3ccad6'), 'cyan');
assert.equal(describeColorCue('#a785ea'), 'violet');
assert.equal(describeColorCue('#8b5a2b'), 'brown');
assert.equal(describeColorCue('#777777'), 'grey');
assert.equal(describeColorCue('#050505'), 'black');
assert.equal(describeColorCue('#fafafa'), 'white');

assert.equal(release.version, '1.7.0');
assert.equal(release.id, '2026.08.09-r163');
assert.equal(release.cacheKey, '20260809-r163');
assert.match(indexSource, /TURN v1\.7\.0 · Build 2026\.08\.09-r163/);
assert.match(indexSource, /accessibility\/native-color-input-r163\.css\?revision=r163-native-input/,
  'The native-input correction must have its own uncached stylesheet');
assert.match(indexSource, /accessibility\/color-accessibility-r163\.js\?build=20260809-r163-native-input/,
  'The device-tested native-input correction must bypass the failed bridge cache');

// The verified Lot still creates the old r163 bridge, but the accessibility
// runtime must synchronously reduce it back to one real native input before it
// becomes the interactive UI. This protects the hotfix while the older Lot
// renderer remains release-frozen.
assert.match(lotSource, /input\.type = 'color'/,
  'TURN must retain a real input[type=color] as the paint value source');
assert.match(runtimeSource, /control\.querySelector\('\.lot-color-trigger'\)\?\.remove\(\)/,
  'The failed duplicate swatch/button must be removed from the live Lot');
assert.match(runtimeSource, /input\.removeAttribute\('aria-hidden'\)/,
  'The real native input must return to the accessibility tree');
assert.match(runtimeSource, /input\.removeAttribute\('tabindex'\)/,
  'The real native input must return to normal keyboard and swipe order');
assert.match(runtimeSource, /input\.classList\.remove\('lot-color-native'\)/,
  'The native input must no longer carry the hidden-bridge marker');
assert.match(runtimeSource, /describeColorCue\(input\.value\)/,
  'The same semantic classifier must name the selected paint for Color Cues');
assert.match(runtimeSource, /cuesEnabled[\s\S]*`\$\{label\} colour\. \$\{colorName\}\.`[\s\S]*`\$\{label\} colour\.`/,
  'TURN must expose its semantic color name only when Color Cues is enabled');
assert.match(runtimeSource, /document\.addEventListener\('input', onPaintValueChange, true\)/,
  'The Color Cue name must follow live native picker changes');
assert.match(runtimeSource, /document\.addEventListener\('change', onPaintValueChange, true\)/,
  'The Color Cue name must also follow committed native picker changes');
assert.doesNotMatch(runtimeSource, /showPicker\(|\.click\(\)|focusNativeColorInput|isIOSFamily|label\.click\(/,
  'TURN must stop trying to synthesize or forward activation of the native picker');
assert.match(runtimeSource, /Color cues/);
assert.match(runtimeSource, /turn:color-cues-changed/);
assert.match(runtimeSource, /TRACK COLOR ·/);
assert.doesNotMatch(runtimeSource, /setInterval|setAnimationLoop/,
  'Color accessibility must remain event/DOM driven rather than add polling');

assert.match(nativeInputCssSource, /\.lot-color-control \.lot-color-input/);
assert.match(nativeInputCssSource, /opacity: 1 !important/,
  'The native input itself must be visible as the color swatch');
assert.match(nativeInputCssSource, /pointer-events: auto !important/,
  'The native input itself must receive pointer interaction');
assert.match(nativeInputCssSource, /\.lot-color-control \.lot-color-trigger[\s\S]*display: none !important/,
  'The duplicate swatch must never flash before the runtime removes it');
assert.match(nativeInputCssSource, /\.lot-color-input:focus-visible/,
  'The real native input must retain a visible keyboard focus treatment');

assert.match(cueCssSource, /data-turn-color-cues='on'/);
assert.match(cueCssSource, /track-card-color-cue/);
assert.match(cueCssSource, /lot-color-cue/);
assert.match(cueCssSource, /repeating-linear-gradient/,
  'Color Cues must include a non-color pattern channel as well as text');

assert.match(historySource, /1\.7\.0 r163/);
assert.match(historySource, /accessibility patch/i);
assert.match(historySource, /CHROMATIC CAMOUFLAGE/);
assert.match(historySource, /Color Cues/);
assert.match(historySource, /VoiceOver/);

console.log('TURN 1.7.0 r163 native color input and Color Cues regression passed.');
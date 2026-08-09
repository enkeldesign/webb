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
  lotSource,
  lotCssSource,
  lotTrackSelectSource,
  historySource
] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-accessibility-r163.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-cues-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
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
assert.match(indexSource, /garage\/lot-r10\.css\?build=20260809-r163-accessible-paint/);
assert.match(indexSource, /accessibility\/color-cues-r163\.css\?build=20260809-r163-accessible-paint/);
assert.match(indexSource, /accessibility\/color-accessibility-r163\.js\?build=20260809-r163-accessible-paint/);
assert.match(indexSource, /lot-track-select\.js\?build=20260809-r163&revision=r163-accessible-paint/);
assert.match(lotTrackSelectSource, /lot-r10\.js\?build=20260809-r163-accessible-paint/);

// The Lot owns the paint control. The accessibility runtime must not replace
// or rebuild it after render.
assert.match(lotSource, /input\.type = 'color'/,
  'The Lot must keep the real native color input rather than substitute a custom picker');
assert.match(lotSource, /trigger\.className = 'lot-color-trigger'/,
  'The Lot itself must create the accessible paint trigger');
assert.match(lotSource, /input\.setAttribute\('aria-hidden', 'true'\)/,
  'The broken native AXPress target must stay out of the VoiceOver swipe order');
assert.match(lotSource, /trigger\.setAttribute\('aria-label', `\$\{label\} colour\. \$\{colourName\}\. Opens system color picker\.`\)/,
  'The accessible trigger must expose the selected semantic color name');
assert.match(lotSource, /function isIOSFamily\(\)/,
  'The iOS workaround must be scoped to iPhone and iPad rather than change desktop picker behavior');
assert.match(lotSource, /input\.focus\(\{ preventScroll: true \}\)/,
  'On iOS, the accessible button must open the native form picker through DOM focus');
assert.match(lotSource, /if \(isIOSFamily\(\)\)[\s\S]*focusNativeColorInput\(input\)[\s\S]*input\.click\(\)/,
  'iOS must use focus while other platforms retain normal click activation');
assert.doesNotMatch(lotSource, /label\.click\(/,
  'Do not route through a synthetic label click; device testing showed that only moved VoiceOver to a hidden target');
assert.doesNotMatch(lotSource, /showPicker\(/,
  'The iOS accessibility fix must not rely on showPicker(), which is not implemented for these iOS controls');
assert.match(lotSource, /describeColorCue\(color\)/,
  'Paint cues and accessible names must share the same semantic color classifier');
assert.match(lotSource, /cue\.textContent = `COLOR · \$\{colourName\.toUpperCase\(\)\}`/);

assert.doesNotMatch(runtimeSource, /lot-color-control|lot-color-trigger|input\[type="color"\]|replaceWith|enhancePaintControl/,
  'Color Cues runtime must not post-process or replace The Lot paint controls');
assert.match(runtimeSource, /Color cues/);
assert.match(runtimeSource, /turn:color-cues-changed/);
assert.match(runtimeSource, /TRACK COLOR ·/);
assert.doesNotMatch(runtimeSource, /setInterval|setAnimationLoop/,
  'Color accessibility must remain event/DOM driven rather than add a polling loop');

assert.match(lotCssSource, /\.lot-color-input/);
assert.match(lotCssSource, /\.lot-color-trigger/);
assert.match(lotCssSource, /top: 50%/,
  'The native input must remain aligned with the visible paint swatch rather than at the viewport origin');
assert.match(lotCssSource, /right: 5px/,
  'The native input focus geometry must match the visible trigger');
assert.match(cueCssSource, /data-turn-color-cues='on'/);
assert.match(cueCssSource, /track-card-color-cue/);
assert.match(cueCssSource, /lot-color-cue/);
assert.match(cueCssSource, /repeating-linear-gradient/,
  'Color Cues must include a non-color pattern channel as well as text');
assert.doesNotMatch(cueCssSource, /lot-color-native|lot-color-trigger/,
  'Core paint-control styling must live with The Lot rather than in the optional Color Cues layer');

assert.match(historySource, /1\.7\.0 r163/);
assert.match(historySource, /accessibility patch/i);
assert.match(historySource, /CHROMATIC CAMOUFLAGE/);
assert.match(historySource, /Color Cues/);
assert.match(historySource, /VoiceOver/);

console.log('TURN 1.7.0 r163 color accessibility regression passed.');

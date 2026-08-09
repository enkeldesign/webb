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

const [releaseSource, indexSource, runtimeSource, cssSource, historySource] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-accessibility-r163.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-cues-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/content/about-history.js', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.equal(COLOR_CUES_STORAGE_KEY, 'turn-color-cues-v1');
assert.deepEqual(TRACK_COLOR_CUES, {
  countryside: 'pink / magenta',
  airport: 'yellow',
  harbor: 'orange',
  cliffside: 'cyan',
  'midnight-city': 'violet'
});
assert.equal(trackColorCue('countryside'), 'pink / magenta');
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
assert.match(indexSource, /accessibility\/color-cues-r163\.css/);
assert.match(indexSource, /accessibility\/color-accessibility-r163\.js/);

assert.match(runtimeSource, /input\[type="color"\]/,
  'TURN must keep the real native color input rather than substitute a custom picker');
assert.match(runtimeSource, /lot-color-trigger/,
  'An ordinary button must provide an assistive-technology activation path');
assert.match(runtimeSource, /trigger\.addEventListener\('click', \(\) => label\.click\(\)\)/,
  'The accessible trigger must activate the associated label so iOS opens the native picker');
assert.doesNotMatch(runtimeSource, /showPicker\(/,
  'The iOS accessibility fix must not rely on showPicker(), which is not dependable on affected iOS versions');
assert.match(runtimeSource, /platform's own semantic color names/,
  'The implementation must deliberately retain the system picker semantic color naming');
assert.match(runtimeSource, /Color cues/);
assert.match(runtimeSource, /turn:color-cues-changed/);
assert.match(runtimeSource, /TRACK COLOR ·/);
assert.match(runtimeSource, /COLOR ·/);
assert.doesNotMatch(runtimeSource, /setInterval|setAnimationLoop/,
  'Color accessibility must remain event/DOM driven rather than add a polling loop');

assert.match(cssSource, /data-turn-color-cues='on'/);
assert.match(cssSource, /lot-color-native/);
assert.match(cssSource, /lot-color-trigger/);
assert.match(cssSource, /track-card-color-cue/);
assert.match(cssSource, /repeating-linear-gradient/,
  'Color Cues must include a non-color pattern channel as well as text');

assert.match(historySource, /1\.7\.0 r163/);
assert.match(historySource, /CHROMATIC CAMOUFLAGE/);
assert.match(historySource, /Color Cues/);
assert.match(historySource, /VoiceOver/);

console.log('TURN 1.7.0 r163 color accessibility regression passed.');

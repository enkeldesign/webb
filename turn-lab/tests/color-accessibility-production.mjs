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
  stylesSource,
  drivePadCssSource,
  manualSteeringCssSource,
  orientationSource,
  audioSource,
  historySource
] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-accessibility-r163.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-cues-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/garage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/garage.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/manual-steering.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/orientation-compat.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/content/about-history.js', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.equal(COLOR_CUES_STORAGE_KEY, 'turn-color-cues-v1');
assert.deepEqual(TRACK_COLOR_CUES, {
  countryside: 'pink',
  airport: 'yellow',
  harbor: 'orange',
  cliffside: 'cyan',
  beachfront: 'green',
  'dead-canyon': 'red',
  'midnight-city': 'violet',
  mountain: 'blue'
});
assert.equal(trackColorCue('countryside'), 'pink');
assert.equal(trackColorCue('mountain'), 'blue');
assert.equal(describeColorCue('#ff00ff'), 'magenta');
assert.equal(describeColorCue('#4dabf7'), 'blue');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value))
};
assert.equal(loadColorCuesEnabled(storage), false, 'Color Cues must be off by default');
assert.equal(saveColorCuesEnabled(true, storage), true);
assert.equal(loadColorCuesEnabled(storage), true);
assert.equal(saveColorCuesEnabled(false, storage), true);

assert.ok(
  indexSource.includes(`TURN v${release.version} · Build ${release.id}`),
  'Production entry point must display the current release source of truth'
);
assert.ok(indexSource.includes(`styles.css?build=${release.cacheKey}-native-html`));
assert.doesNotMatch(indexSource, /lot-r10\.css|lot-layout-r60\.css|lot-track-select\.js/,
  'The Lot is retired; GARAGE loads its own styles when it opens');
assert.ok(
  indexSource.includes(`app.js?build=${release.cacheKey}-browser-consent-r176-bella-road-derived-zone-voiceover-paint-parent-click`),
  'The device must receive the native-picker ancestry experiment under a fresh release module URL'
);
assert.doesNotMatch(indexSource, /named-color-fallback|native-color-input-r163\.css/,
  'Production must not load fallback or corrective paint layers');

// GARAGE paint: a real HTML colour input with an explicit label, left unstyled.
assert.match(lotSource, /<input id="\$\{control\.htmlFor\}" type="color" value="\$\{escapeHtml\(value\)\}">/,
  'Vehicle paint must be a real HTML color input');
assert.match(lotSource, /control\.htmlFor = `garagePaint/,
  'The native color input must have a real explicit label');
assert.match(lotSource, /input\.addEventListener\('input'/,
  'Progressive enhancement must listen to the native input rather than replace activation');
assert.match(lotSource, /colorName\.textContent = titleCase\(describeColorCue\(input\.value\)\)/,
  'Each paint control names its colour in words');
assert.doesNotMatch(lotSource, /NAMED_COLOR_PRESETS|color-preset|BY NAME|createElement\('select'\)/,
  'The rejected named-color fallback must be gone');
assert.doesNotMatch(lotSource, /showPicker\(|input\.click\(\)|focusNativeColorInput|isIOSFamily|label\.click\(/,
  'TURN must not proxy or synthesize native picker activation');
assert.doesNotMatch(lotSource, /input\.className|input\.classList|input\.setAttribute\('aria-|input\.tabIndex|type="color"[^>]*(class|aria-)/,
  'The color input itself must not be restyled or have its accessibility semantics rewritten');
assert.match(lotSource, /<div class="garage-paint" id="garagePaint" role="group" aria-label="Car paint" hidden><\/div>/,
  'Paint controls must be created in their final semantic DOM location');
assert.match(lotSource, /<div class="garage-view" aria-hidden="true"><\/div>/);
const clippedInput = lotCssSource.match(/\.garage-swatch input\[type='color'\] \{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(clippedInput, /width: 0\.75px;[\s\S]*height: 0\.75px;[\s\S]*clip-path: inset\(50%\);[\s\S]*opacity: 0;/,
  'The native input is visually clipped; TURN paints the visible face (r206 standalone-PWA contract)');
assert.doesNotMatch(clippedInput, /inset:\s*0|width:\s*100%|height:\s*100%/,
  'Standalone WebKit must never receive a full-size transparent native control over the visible face');
assert.match(lotCssSource, /\.garage-swatch:focus-within \.garage-swatch-face[\s\S]*outline:/,
  'Keyboard and screen-reader focus still shows on the face');

const universalBlock = stylesSource.match(/\*\s*\{[\s\S]*?\}/)?.[0] || '';
const htmlBodyBlock = stylesSource.match(/html,\s*\nbody\s*\{[\s\S]*?\}/)?.[0] || '';
const buttonBlock = stylesSource.match(/button\s*\{[\s\S]*?\}/)?.[0] || '';
assert.doesNotMatch(universalBlock, /user-select|touch-action|-webkit-touch-callout|-webkit-tap-highlight-color/,
  'Universal CSS must not suppress native interaction');
assert.doesNotMatch(htmlBodyBlock, /touch-action:\s*none|user-select:\s*none/,
  'The document root must not disable native touch or selection semantics');
assert.doesNotMatch(buttonBlock, /touch-action:\s*none|user-select:\s*none|-webkit-touch-callout/,
  'Generic controls must not inherit game-gesture suppression');
assert.match(drivePadCssSource, /\.drive-pad[\s\S]*touch-action:\s*none/,
  'Gesture suppression must remain local to the driving surface');
assert.match(manualSteeringCssSource, /\.manual-steer[\s\S]*touch-action:\s*none/,
  'Gesture suppression must remain local to manual steering');

assert.doesNotMatch(orientationSource, /document\.addEventListener\(['"]click['"]/,
  'Orientation compatibility must not delegate click handling from document');
assert.match(orientationSource, /querySelector\('#motionButton'\)\?\.addEventListener\('click', resetSensorCalibration\)/,
  'Motion calibration should bind directly to the control that owns it');
assert.doesNotMatch(audioSource, /document\.addEventListener\(['"]click['"]/,
  'Generic UI audio must not intercept every native-control click through document');
assert.doesNotMatch(audioSource, /document\.addEventListener\(['"]change['"]/,
  'Generic UI audio must not delegate native form changes through document');
assert.match(audioSource, /document\.addEventListener\('pointerdown', handleUiPointerDown/,
  'Nonessential pointer UI sounds may remain on the physical pointer path');
assert.doesNotMatch(lotSource, /paintPanel\.addEventListener\(['"]click['"]/,
  'The paint panel itself must not be a click-listener ancestor of its native color inputs');
assert.match(lotSource, /<button class="turn-pr-button is-secondary is-compact garage-paint-toggle" type="button" aria-expanded="false" aria-controls="garagePaint">PAINT<\/button>/,
  'The paint lock explanation belongs to a separate real button, never an ancestor of the input');

// Color Cues: GARAGE names the car's body colour before Paintjob, from the factory colour.
assert.match(lotSource, /<span class="turn-color-cue garage-color-cue"><\/span>/,
  'GARAGE must expose a car colour cue independently of paint controls');
assert.match(lotSource, /const bodyColor = lock \? getVehicleDefaultColor\(car\.id\) : selection\.state\(\)\.choice\.color;/,
  'The car cue follows the chosen paint, and the factory colour for a preview');
assert.match(lotSource, /CAR COLOR · \$\{describeColorCue\(bodyColor\)\.toUpperCase\(\)\}/);
assert.match(lotCssSource, /\.garage-color-cue::before[\s\S]*repeating-linear-gradient/,
  'The car cue carries a pattern, not colour alone');
assert.doesNotMatch(runtimeSource, /lot-|MutationObserver\(scheduleSync\)/,
  'The Color Cues runtime no longer scans for The Lot');
assert.match(runtimeSource, /Color cues/);
// ROADBOOK identifies tracks by name and pictogram; colour is decorative there.
assert.doesNotMatch(runtimeSource, /TRACK COLOR ·/);
assert.doesNotMatch(runtimeSource, /setInterval|setAnimationLoop/);

assert.match(cueCssSource, /data-turn-color-cues='on'/);
assert.match(cueCssSource, /html\[data-turn-color-cues='on'\] \.turn-color-cue \{\s*display: inline-flex;/,
  'Every colour cue, GARAGE included, appears only while Color cues is on');

assert.match(historySource, /optional Color Cues/i,
  'Curated History must retain the player-facing accessibility feature; native-input behavior is verified above');
assert.doesNotMatch(historySource, /native paint activation bridge|assistive-technology bridge/i,
  'Current release history must not claim an activation bridge that no longer exists');

console.log(`TURN ${release.version} ${release.id} HTML-first native color input, pre-Paintjob car cue and eight-track color-cue regression passed.`);

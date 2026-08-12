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
  layoutSource,
  paintGateSource,
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
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8'),
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

assert.ok(
  indexSource.includes(`TURN v${release.version} · Build ${release.id}`),
  'Production entry point must display the current release source of truth'
);
assert.ok(indexSource.includes(`styles.css?build=${release.cacheKey}-native-html`));
assert.ok(indexSource.includes(`garage/lot-r10.css?build=${release.cacheKey}-native-html`));
assert.ok(indexSource.includes(`garage/lot-layout-r60.css?build=${release.cacheKey}-native-html`));
assert.ok(indexSource.includes(`lot-track-select.js?build=${release.cacheKey}&revision=r164-long-session-robustness`));
assert.ok(
  indexSource.includes(`app.js?build=${release.cacheKey}-browser-consent-r176-bella-road-derived-zone-voiceover-paint-parent-click`),
  'The device must receive the native-picker ancestry experiment under a fresh release module URL'
);
assert.doesNotMatch(indexSource, /named-color-fallback|native-color-input-r163\.css/,
  'Production must not load fallback or corrective paint layers');

assert.match(lotSource, /input\.type = 'color'/,
  'Vehicle paint must start with a real HTML color input');
assert.match(lotSource, /inputLabel\.htmlFor = input\.id/,
  'The native color input must have a real explicit label');
assert.match(lotSource, /input\.addEventListener\('input'/,
  'Progressive enhancement must listen to the native input rather than replace activation');
assert.match(lotSource, /cue\.textContent = `COLOR · \$\{describeColorCue\(input\.value\)\.toUpperCase\(\)\}`/,
  'Color Cues may progressively add TURN’s broad semantic name');
assert.doesNotMatch(lotSource, /NAMED_COLOR_PRESETS|lot-color-preset|BY NAME|document\.createElement\('select'\)/,
  'The rejected named-color fallback must be gone');
assert.doesNotMatch(lotSource, /lot-color-trigger|lot-color-native|showPicker\(|\.click\(\)|focusNativeColorInput|isIOSFamily|label\.click\(/,
  'TURN must not proxy or synthesize native picker activation');
assert.doesNotMatch(lotSource, /input\.className|input\.classList|input\.setAttribute\('aria-|input\.tabIndex/,
  'The color input itself must not be restyled or have its accessibility semantics rewritten');

assert.match(lotSource, /<section class="lot-viewbox lot-viewbox-with-paint">[\s\S]*<div class="lot-colors" aria-label="Choose car paint colours"><\/div>[\s\S]*<\/section>/,
  'Paint controls must be created in their final semantic DOM location');
assert.match(lotSource, /lot-viewbox-head" aria-hidden="true"/);
assert.match(lotSource, /lot-view-host" aria-hidden="true"/);
assert.doesNotMatch(layoutSource, /appendChild\(colors\)|removeAttribute\('aria-hidden'\)|lot-view-close|lot-view-open/,
  'The layout enhancer must not relocate paint or repair parent accessibility after render');

assert.doesNotMatch(lotCssSource, /\.lot-color-input|\.lot-color-preset|input\[type=['"]?color/,
  'TURN CSS must leave the native color input appearance untouched');

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

// Keep native form activation out of click delegation. WebKit native pickers can
// be sensitive to click listeners on ancestors; TURN has no reason to put unrelated
// behavior anywhere in the color input's click ancestry.
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
assert.doesNotMatch(paintGateSource, /colors\.addEventListener\(['"]click['"]/,
  'The paint group itself must not be a click-listener ancestor of its native color inputs');
assert.doesNotMatch(paintGateSource, /colors\.setAttribute\('role', 'button'\)|colors\.tabIndex\s*=/,
  'Unlocked native paint must not inherit faux-button semantics from the Trophy Road lock');
assert.match(paintGateSource, /button\.className = 'lot-paint-lock-button'/,
  'When paint is locked, its explanation belongs on a separate real button');
assert.match(paintGateSource, /button\.addEventListener\('click', showLockedPaintInfo\)/,
  'The lock button may own its own click listener without becoming an ancestor of the color input');

assert.doesNotMatch(runtimeSource, /describeColorCue|lot-color-control|input\[type="color"\]|onPaintValueChange|replaceWith/,
  'The Color Cues runtime must not post-process paint controls');
assert.match(runtimeSource, /Color cues/);
assert.match(runtimeSource, /TRACK COLOR ·/);
assert.doesNotMatch(runtimeSource, /setInterval|setAnimationLoop/);

assert.match(cueCssSource, /data-turn-color-cues='on'/);
assert.match(cueCssSource, /track-card-color-cue/);
assert.match(cueCssSource, /lot-color-cue/);
assert.match(cueCssSource, /repeating-linear-gradient/);

assert.match(historySource, /native HTML color input/i);
assert.doesNotMatch(historySource, /native paint activation bridge|assistive-technology bridge/i,
  'Current release history must not claim an activation bridge that no longer exists');

console.log(`TURN ${release.version} ${release.id} HTML-first native color input and click-ancestry regression passed.`);

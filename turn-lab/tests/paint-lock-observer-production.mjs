import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  lotGate,
  paintGate,
  paintCss,
  showroomCleanupCss,
  lotRuntime,
  lotWrapper,
  perkPresentation,
  app,
  index,
  releaseSource
] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/lot-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road-r157.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-showroom-cleanup-r201.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const syncBody = paintGate.match(/function sync\(\) \{([\s\S]*?)\n  \}\n\n  const observer/ )?.[1] || '';
assert.ok(syncBody, 'The paint gate must expose a bounded synchronization function');

// --- Stable baseline and explicit state model ---------------------------------
assert.match(paintGate, /function selectedCarIsLocked\(screen\)/,
  'CAR lock state must be modeled independently from paint state');
assert.match(syncBody, /const carLocked = selectedCarIsLocked\(screen\)/);
assert.match(syncBody, /const freeColor = Boolean\(car && !car\.fixedLivery\)/,
  'Vehicle free/fixed color must be an explicit state dimension');
assert.match(syncBody, /const paintLocked = Boolean\(freeColor && !paintUnlocked\)/,
  'PAINTJOB lock must depend on paintability and PAINTJOB only, never car lock');
assert.doesNotMatch(
  syncBody.match(/const paintLocked[^\n]*/)?.[0] || '',
  /carLocked/,
  'A locked vehicle must still expose the same COLOR baseline'
);
assert.match(syncBody, /colors\.dataset\.vehicleColorMode = car\?\.fixedLivery \? 'fixed' : 'free'/);
assert.match(syncBody, /colors\.dataset\.paintState = car\?\.fixedLivery \? 'fixed' : \(paintUnlocked \? 'editable' : 'locked'\)/);
assert.match(syncBody, /colors\.dataset\.carState = carLocked \? 'locked' : 'unlocked'/);
assert.match(syncBody, /colors\.hidden = false/,
  'The COLOR component must remain visible for every selected vehicle state');
assert.match(syncBody, /colors\.removeAttribute\('aria-hidden'\)/,
  'Fixed-livery showroom markup must not be allowed to remove COLOR from the final interface');
assert.match(syncBody, /screen\.classList\.toggle\('lot-color-baseline-active', Boolean\(car\)\)/);

// --- One visible COLOR label and swatch for every vehicle ----------------------
assert.match(paintGate, /function ensureVisibleLabel\(car\)/);
assert.match(paintGate, /label\.className = 'lot-color-visible-label'/);
assert.match(paintGate, /label\.textContent = 'COLOR'/);
assert.match(paintGate, /label\.setAttribute\('aria-hidden', 'true'\)/,
  'The visual COLOR label must not duplicate the named screen-reader group');
assert.doesNotMatch(
  paintGate.match(/function ensureVisibleLabel\(car\) \{([\s\S]*?)\n  \}/)?.[1] || '',
  /fixedLivery[\s\S]*remove/,
  'Fixed-livery cars must keep the same visible COLOR label as paintable cars'
);

assert.match(paintGate, /function ensureFixedColorDisplay\(car\)/,
  'Set-color vehicles must receive a display-only swatch rather than an empty COLOR area');
assert.match(paintGate, /swatch\.className = 'lot-fixed-color-display'/);
assert.match(paintGate, /getVehicleDefaultColor\(car\.id\)/);
assert.match(paintGate, /getVehicleDefaultSecondaryColor\(car\.id\)/,
  'Fixed emergency liveries must expose their canonical secondary color too');
assert.match(paintGate, /swatch\.classList\.toggle\('is-two-tone'/,
  'Two-color fixed liveries must remain represented inside the same swatch footprint');
assert.match(paintGate, /Fixed car colors\./,
  'The display-only fixed swatch must still carry a useful accessible description');

// --- TURN-owned visual face over native color input ----------------------------
assert.match(paintGate, /function applyNativeSwatchFace\(control\)/);
assert.match(paintGate, /control\.classList\.add\('has-turn-color-swatch'\)/);
assert.match(paintGate, /control\.style\.setProperty\('--lot-color-swatch', input\.value\)/,
  'The visible free-color swatch must be driven by the actual native input value');
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-color-control\.has-turn-color-swatch::before\s*\{[\s\S]*background: var\(--lot-color-swatch/,
  'TURN must paint the visible swatch itself instead of relying on the browser color-input skin'
);
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-color-control\.has-turn-color-swatch input\[type='color'\][\s\S]*opacity: 0/,
  'The native color input must stay interactive but no longer be responsible for visible paint'
);
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-color-control\.has-turn-color-swatch:focus-within::before[\s\S]*outline:/,
  'Keyboard focus must remain visible on the TURN-owned swatch face'
);
assert.match(showroomCleanupCss, /\.lot-showroom \.lot-color-control\[hidden\][\s\S]*display: none !important/,
  'PAINTJOB locking must reliably hide the native editable control despite author display rules');

// --- PAINTJOB locked/unlocked ---------------------------------------------------
assert.match(syncBody, /if \(freeColor && \(!paintUnlocked \|\| changedCar\)\) forceFactoryPaint\(carId\)/,
  'Before PAINTJOB unlock, paintable vehicles must display their factory color');
assert.match(syncBody, /control\.hidden = paintLocked/);
assert.match(syncBody, /input\.disabled = paintLocked/);
assert.match(syncBody, /if \(paintLocked\) ensureLockButton\(carId\);[\s\S]*else removeLockPresentation\(\)/,
  'Free-color vehicles must turn the same swatch slot into a lock only while PAINTJOB is locked');
assert.match(paintGate, /button\.className = 'lot-paint-lock-button'/);
assert.match(paintGate, /Color locked\. Car color controls unlock at \$\{threshold\} trophies on Trophy Road\./,
  'The lock must describe COLOR, not imply that the vehicle itself is locked');
assert.match(paintGate, /applyLockColour\(button\.querySelector\('\.lot-paint-lock'\), carId\)/,
  'The locked swatch must still visibly represent the selected car factory color');
assert.match(paintGate, /function contrastingInk\(hexColor\)/);
assert.match(paintGate, /luminance > 0\.18 \? '#08090a' : '#fffdf6'/,
  'The lock glyph must retain readable contrast over every car color');

// --- COLOR CUES on/off, always in the same swatch-side slot --------------------
assert.match(paintGate, /import \{ describeColorCue \} from '\.\.\/accessibility\/color-cues\.js\?revision=r163'/,
  'The visual cue must use the canonical COLOR CUES color naming');
assert.match(paintGate, /function ensureVisualColorCue\(car\)/);
assert.match(paintGate, /cue\.className = 'turn-color-cue lot-color-cue lot-paint-color-cue'/,
  'The fixed swatch-side cue must obey the global COLOR CUES on/off CSS state');
assert.match(paintGate, /cue\.setAttribute\('aria-hidden', 'true'\)/,
  'The new cue is visual-only because the existing selected-car cue remains semantic');
assert.match(paintGate, /cue\.textContent = `CAR COLOR · \$\{colorCueDescription\(car\)\}`/);
assert.match(paintGate, /if \(car\.fixedLivery\)[\s\S]*getVehicleDefaultSecondaryColor\(car\.id\)/,
  'Fixed emergency liveries must get COLOR CUES in the same place, including their second color');
assert.match(paintGate, /if \(car\.secondaryPaint\)/,
  'Free-color vehicles with a secondary paint part must keep that extra color in the cue');
assert.match(syncBody, /ensureVisualColorCue\(car\)/,
  'Every selected-car state must finish by populating the same cue slot');
assert.match(paintGate, /colors\.addEventListener\('input', handlePaintInput\)/,
  'Unlocked native color changes must update the TURN-owned swatch and cue immediately');
assert.match(paintGate, /applyNativeSwatchFace\(event\.target\.closest\('\.lot-color-control'\)\)/);
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-paint-color-cue\s*\{[\s\S]*font-size: clamp\(\.56rem, 1\.08vw, \.72rem\)/,
  'The swatch-side COLOR CUE must stay large enough to read'
);
assert.match(
  showroomCleanupCss,
  /\.lot-showroom\.lot-color-baseline-active \.lot-card \.lot-selected-car-color-cue[\s\S]*clip-path: inset\(50%\)/,
  'The old semantic cue must remain accessible without being visually duplicated for any car type'
);

// --- Observer safety ------------------------------------------------------------
assert.match(paintGate, /observer\.observe\(picker,/,
  'Paint synchronization must stay scoped to the car picker rather than the whole Lot screen');
assert.doesNotMatch(paintGate, /observer\.observe\(screen,/,
  'The COLOR presentation must never observe the screen subtree that contains its own writes');
assert.match(paintGate, /attributeFilter: \['aria-checked', 'class'\]/,
  'Selection and car-lock changes must both refresh the explicit state model');
assert.match(paintGate, /function mutationTouchesPaintControl\(mutation\)/,
  'The paint gate must distinguish showroom control replacement from its own presentation mutations');
assert.match(paintGate, /mutations\.some\(mutationTouchesPaintControl\)\) sync\(\)/,
  'Replacing native color controls must immediately resynchronize the baseline');
assert.match(paintGate, /controlObserver\.observe\(colors, \{ childList: true \}\)/,
  'The rebuild observer must stay direct-child-only');
assert.doesNotMatch(paintGate, /controlObserver\.observe\(colors, \{[^}]*subtree:\s*true/,
  'The color rebuild recovery must not recreate the old self-triggering observer loop');
assert.match(paintGate, /try \{[\s\S]*\} finally \{[\s\S]*syncing = false/,
  'The synchronization guard must always be released');
assert.match(paintGate, /controlObserver\.disconnect\(\)/);

// Keep native form semantics: no faux-button wrapper around editable color controls.
assert.doesNotMatch(paintGate, /colors\.addEventListener\(['"]click['"]/,
  'The COLOR container must never become a click-listener ancestor that hijacks native input behavior');
assert.doesNotMatch(paintGate, /colors\.addEventListener\(['"]keydown['"]/);
assert.doesNotMatch(paintGate, /colors\.setAttribute\('role', 'button'\)|colors\.tabIndex\s*=/);

// Established Trophy Road / perk contracts remain intact.
assert.match(paintCss, /\.lot-colors\.is-paint-locked[\s\S]*min-height: 54px/);
assert.match(lotGate, /function dismissVisibleUnlockNotice\(\)/);
assert.match(lotGate, /\.turn-unlock-notice\.is-visible/);
assert.match(lotGate, /trophy-road\.js\?revision=r164-vintage-rally-perks/);
assert.match(lotRuntime, /lot-trophy-gate\.js\?revision=r164-vintage-rally-perks/);
assert.match(lotRuntime, /lot-paint-reward\.js\?revision=r205-color-baseline/,
  'The baseline color state model must receive a fresh module cache identity');
assert.match(lotRuntime, /lot-perk-disclosure\.js\?revision=r203-idempotent/);
assert.match(lotWrapper, /lot-enhancement-runtime\.js\?revision=r205-color-baseline/,
  'The showroom wrapper must not reuse a cached enhancement runtime');
assert.match(lotWrapper, /SHOWROOM_CLEANUP_STYLE_ID = 'turn-lot-showroom-r205-polish'/);
assert.match(lotWrapper, /lot-showroom-cleanup-r201\.css\?revision=r205-color-baseline/);

assert.match(perkPresentation, /getCarDefinition\(vehicleId\)\?\.perk/,
  'Inline perk identity must remain car-owned');
assert.doesNotMatch(perkPresentation, /observer\.observe\(screen,/,
  'Perk presentation must not reintroduce its old self-triggering observer');
assert.doesNotMatch(perkPresentation, /childList:\s*true|characterData:\s*true/);

assert.match(app, /trophy-road-r157\.css\?revision=r163-native-picker-parent-click/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r163-native-picker-parent-click/);
assert.match(
  index,
  new RegExp(`app\\.js\\?build=${release.cacheKey}-browser-consent-r176-bella-road-derived-zone-voiceover-paint-parent-click`)
);

console.log('TURN Lot COLOR baseline state matrix, browser-independent swatches, cue placement and observer safety regressions passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  lotGate,
  paintGate,
  paintCss,
  showroomCleanupCss,
  pwaSwatches,
  showroom,
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
  fs.readFile(new URL('../../turn/garage/lot-pwa-color-swatch.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-showroom-experiment.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1] || '';
assert.ok(importMapText, 'TURN production entry must expose an import map');
const importMap = JSON.parse(importMapText);
const imports = importMap.imports || {};
const catalogImport = paintGate.match(/import\s*\{([\s\S]*?)\}\s*from '\.\.\/vehicle\/catalog\.js[^']*';/)?.[1] || '';
assert.ok(catalogImport, 'The paint gate must import its vehicle-catalog helpers explicitly');
assert.match(catalogImport, /\bgetVehicleDefaultColor\b/);
assert.match(catalogImport, /\bgetVehicleDefaultSecondaryColor\b/,
  'The paint gate must import the secondary factory-color helper it calls');
const syncBody = paintGate.match(/function sync\(\) \{([\s\S]*?)\n  \}\n\n  const observer/)?.[1] || '';
assert.ok(syncBody, 'The paint gate must expose a bounded synchronization function');

// --- Stable COLOR baseline and explicit state model ---------------------------
assert.match(paintGate, /function selectedCarIsLocked\(screen\)/,
  'CAR lock state must remain modeled independently from paint state');
assert.match(syncBody, /const carLocked = selectedCarIsLocked\(screen\)/);
assert.match(syncBody, /const freeColor = Boolean\(car && !car\.fixedLivery\)/,
  'Vehicle free/fixed color must remain an explicit state dimension');
assert.match(syncBody, /const paintLocked = Boolean\(freeColor && !paintUnlocked\)/,
  'PAINTJOB lock must depend on paintability and PAINTJOB only, never car lock');
assert.doesNotMatch(syncBody.match(/const paintLocked[^\n]*/)?.[0] || '', /carLocked/);
assert.match(syncBody, /colors\.dataset\.vehicleColorMode = car\?\.fixedLivery \? 'fixed' : 'free'/);
assert.match(syncBody, /colors\.dataset\.paintState = car\?\.fixedLivery \? 'fixed' : \(paintUnlocked \? 'editable' : 'locked'\)/);
assert.match(syncBody, /colors\.dataset\.carState = carLocked \? 'locked' : 'unlocked'/);
assert.match(syncBody, /colors\.hidden = false/,
  'The COLOR component must remain visible for every selected vehicle state');
assert.match(syncBody, /colors\.removeAttribute\('aria-hidden'\)/);

assert.match(paintGate, /label\.className = 'lot-color-visible-label'/);
assert.match(paintGate, /label\.textContent = 'COLOR'/);
assert.match(paintGate, /function ensureFixedColorDisplay\(car\)/,
  'Fixed-livery vehicles must receive the same permanent COLOR slot');
assert.match(paintGate, /swatch\.className = 'lot-fixed-color-display'/);
assert.match(paintGate, /getVehicleDefaultSecondaryColor\(car\.id\)/,
  'Emergency liveries must retain their canonical secondary color');
assert.match(paintGate, /swatch\.classList\.toggle\('is-two-tone'/);

// --- Standalone-iOS/PWA-safe editable swatch ---------------------------------
assert.match(pwaSwatches, /function ensureSwatchFace\(control\)/,
  'A dedicated runtime must own the visible editable swatch face');
assert.match(pwaSwatches, /face = document\.createElement\('label'\)/,
  'The visible swatch must be a label linked to the real native color input');
assert.match(pwaSwatches, /face\.className = 'lot-turn-color-swatch-face'/);
assert.match(pwaSwatches, /face\.htmlFor = input\.id/,
  'Tapping the TURN-owned face must activate the real input without overlaying it');
assert.match(pwaSwatches, /face\.style\.setProperty\('--lot-color-swatch', input\.value\)/,
  'The visible swatch must always mirror the native input value');
assert.match(pwaSwatches, /colors\.addEventListener\('input', handleInput\)/,
  'Changing paint must update the linked swatch immediately');
assert.match(pwaSwatches, /observer\.observe\(colors, \{ childList: true \}\)/,
  'The swatch runtime may watch direct control replacement but not its own descendants');
assert.doesNotMatch(pwaSwatches, /observer\.observe\(colors, \{[^}]*subtree:\s*true/);

assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-turn-color-swatch-face\s*\{[\s\S]*background: var\(--lot-color-swatch/,
  'TURN must paint the visible color square itself'
);
const clippedInputRule = showroomCleanupCss.match(
  /\.lot-showroom \.lot-color-control\.has-turn-color-swatch input\[type='color'\]\s*\{([\s\S]*?)\n\}/
)?.[1] || '';
assert.ok(clippedInputRule, 'The editable native color input must have a PWA-safe visual rule');
assert.match(clippedInputRule, /width: 1px !important/);
assert.match(clippedInputRule, /height: 1px !important/);
assert.match(clippedInputRule, /clip-path: inset\(50%\) !important/,
  'The native input must be visually clipped instead of composited over the swatch');
assert.match(clippedInputRule, /opacity: 0 !important/);
assert.doesNotMatch(clippedInputRule, /inset:\s*0|width:\s*100%|height:\s*100%/,
  'Standalone WebKit must never receive a full-size transparent native control over the visible face');
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-color-control\.has-turn-color-swatch:focus-within \.lot-turn-color-swatch-face[\s\S]*outline:/,
  'Keyboard/screen-reader focus must still get a visible focus treatment'
);
assert.match(showroomCleanupCss, /\.lot-showroom \.lot-color-control\[hidden\][\s\S]*display: none !important/);

// The existing paint state model still owns the value and state, not the PWA face.
assert.match(paintGate, /function applyNativeSwatchFace\(control\)/);
assert.match(paintGate, /control\.style\.setProperty\('--lot-color-swatch', input\.value\)/);
assert.match(syncBody, /if \(freeColor && \(!paintUnlocked \|\| changedCar\)\) forceFactoryPaint\(carId\)/);
assert.match(syncBody, /control\.hidden = paintLocked/);
assert.match(syncBody, /input\.disabled = paintLocked/);
assert.match(syncBody, /if \(paintLocked\) ensureLockButton\(carId\);[\s\S]*else removeLockPresentation\(\)/);

// --- COLOR CUES remains in one stable swatch-side slot ------------------------
assert.match(paintGate, /function ensureVisualColorCue\(car\)/);
assert.match(paintGate, /cue\.className = 'turn-color-cue lot-color-cue lot-paint-color-cue'/,
  'The cue must continue to obey the global COLOR CUES on/off state');
assert.match(paintGate, /cue\.textContent = `CAR COLOR · \$\{colorCueDescription\(car\)\}`/);
assert.match(syncBody, /ensureVisualColorCue\(car\)/);
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-colors,[\s\S]*min-height: 54px;[\s\S]*gap: 7px/,
  'Cue on/off and fixed/free color states must share one aligned COLOR geometry'
);
assert.match(
  showroomCleanupCss,
  /\.lot-showroom \.lot-paint-color-cue\s*\{[\s\S]*font-size: clamp\(\.56rem, 1\.08vw, \.72rem\)/,
  'The swatch-side COLOR CUE must stay large enough to read'
);

// --- Observer safety -----------------------------------------------------------
assert.match(paintGate, /observer\.observe\(picker,/);
assert.doesNotMatch(paintGate, /observer\.observe\(screen,/);
assert.match(paintGate, /attributeFilter: \['aria-checked', 'class'\]/);
assert.match(paintGate, /controlObserver\.observe\(colors, \{ childList: true \}\)/);
assert.doesNotMatch(paintGate, /controlObserver\.observe\(colors, \{[^}]*subtree:\s*true/);
assert.match(paintGate, /try \{[\s\S]*\} finally \{[\s\S]*syncing = false/);
assert.doesNotMatch(paintGate, /colors\.addEventListener\(['"]click['"]/,
  'The COLOR group must not become a faux click-control ancestor');
assert.doesNotMatch(paintGate, /colors\.setAttribute\('role', 'button'\)|colors\.tabIndex\s*=/);

// --- Carousel entitlement boundary --------------------------------------------
const orderMatch = showroom.match(/export const LOT_CAR_ORDER = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert.ok(orderMatch, 'The showroom must expose one canonical car order');
const order = [...orderMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
const lockedTail = [
  'race',
  'vintage-racer',
  'race-future',
  'firetruck',
  'ambulance',
  'police',
  'monster-truck',
  'toy-racer'
];
assert.deepEqual(order.slice(order.indexOf('race')), lockedTail,
  'The horizontal Lot and its keyboard/VoiceOver order must put every reward car after the standard starting cars');

// --- Fresh module identities for already-installed PWAs -----------------------
assert.match(lotRuntime, /lot-paint-reward\.js\?revision=r206-pwa-color/,
  'The app-level enhancement runtime must retain the current color state model specifier');
assert.match(lotWrapper, /lot-enhancement-runtime\.js\?revision=r222-awd-suv-paint/,
  'The showroom wrapper must use the same enhancement-runtime identity');
assert.match(lotWrapper, /lot-pwa-color-swatch\.js\?revision=r206-pwa-color/);
assert.match(lotWrapper, /lot-showroom-experiment\.js\?revision=r222-awd-suv-paint/);
assert.match(lotWrapper, /SHOWROOM_CLEANUP_STYLE_ID = 'turn-lot-showroom-r206-polish'/);
assert.match(lotWrapper, /lot-showroom-cleanup-r201\.css\?revision=r206-pwa-color/);
assert.match(index, /\/turn\/garage\/lot-enhancement-runtime\.js\?revision=r164-post-soak&build=20260826-r184"\s*:\s*"\/turn\/garage\/lot-enhancement-runtime\.js\?revision=r222-awd-suv-paint/,
  'Old installed app runtime URLs must bridge to the current Lot runtime');
assert.match(index, /\/turn\/m8-home\.js\?revision=r131-motion-permission-retry&trophy-road=r159&showroom=r200&build=20260818-r175"\s*:\s*"\/turn\/m8-home\.js\?revision=r131-motion-permission-retry&trophy-road=r159&showroom=r206-pwa-color&build=20260818-r175/);
assert.match(index, /\/turn\/garage\/lot-track-select\.js\?revision=r200-production-candidate"\s*:\s*"\/turn\/garage\/lot-track-select\.js\?revision=r222-awd-suv-paint/);
assert.match(
  index,
  new RegExp(`app\\.js\\?build=${release.cacheKey}-browser-consent-r176-bella-road-derived-zone-voiceover-paint-parent-click[^\"]*-pwa-color-r206`),
  'The top-level app script must still enter the bridged module graph'
);

// The installed PWA previously allowed these nested Lot dependencies to keep old
// HTTP/module-cache snapshots. All selected-car consumers must now converge on one
// fresh vehicle-catalog module, and the state/showroom modules themselves get fresh
// identities without requiring a reinstall or clearing site data.
const canonicalLotCatalog = '/turn/vehicle/catalog.js?revision=r222-awd-suv-paint';
assert.equal(
  imports['/turn/progression/lot-paint-reward.js?revision=r206-pwa-color'],
  '/turn/progression/lot-paint-reward.js?revision=r208-secondary-color-import',
  'Installed PWAs must refetch the corrected COLOR state module'
);
assert.equal(
  imports['/turn/garage/lot-showroom-experiment.js?revision=r206-race-before-locks'],
  '/turn/garage/lot-showroom-experiment.js?revision=r222-awd-suv-paint',
  'Installed PWAs must refetch the showroom module when the visible Trophy Road order changes'
);
for (const staleCatalogSpecifier of [
  '/turn/vehicle/catalog.js?build=20260804-r157-factory-colors',
  '/turn/vehicle/catalog.js?build=20260720-r20&revision=r588-canonical-attributes',
  '/turn/vehicle/catalog.js?revision=r164-vintage-rally-polish'
]) {
  assert.equal(
    imports[staleCatalogSpecifier],
    canonicalLotCatalog,
    `${staleCatalogSpecifier} must resolve to the same fresh Lot vehicle catalog`
  );
}

// Established Trophy Road and perk contracts remain intact.
assert.match(paintCss, /\.lot-colors\.is-paint-locked[\s\S]*min-height: 54px/);
assert.match(lotGate, /function dismissVisibleUnlockNotice\(\)/);
assert.match(lotRuntime, /lot-trophy-gate\.js\?revision=r164-vintage-rally-perks/);
assert.match(lotRuntime, /lot-perk-disclosure\.js\?revision=r217-stable-perk-slot/);
assert.match(perkPresentation, /getCarDefinition\(vehicleId\)\?\.perk/);
assert.doesNotMatch(perkPresentation, /observer\.observe\(screen,/);
assert.match(app, /trophy-road-r157\.css\?revision=r163-native-picker-parent-click/);

console.log('TURN Lot PWA swatch compositing, factory-color imports, reward-car catalog coherence, state matrix, cue geometry, cache bridge, car order and observer safety regressions passed.');

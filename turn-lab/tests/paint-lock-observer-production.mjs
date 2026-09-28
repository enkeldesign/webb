import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GARAGE_CAR_ORDER } from '../../turn/garage/garage-cars.js';
import { rewardForVehicle } from '../../turn/progression/trophy-road.js';

// GARAGE paint: one explicit state model (fixed, editable, locked), the standalone
// PWA-safe native swatch, no DOM observers, the Trophy Road car order and the cache
// bridges installed PWAs still rely on.
const [garage, garageCss, index, releaseSource] = await Promise.all([
  fs.readFile(new URL('../../turn/garage/garage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/garage.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);
const imports = JSON.parse(index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1] || '{}').imports || {};

// --- Explicit paint state model ------------------------------------------------
const renderPaint = garage.match(/function renderPaint\(\) \{[\s\S]*?\n    \}\n/)?.[0] || '';
assert.ok(renderPaint, 'GARAGE owns one bounded paint renderer');
assert.match(renderPaint, /paintToggle\.hidden = Boolean\(preview\)/, 'A locked preview has no paint');
assert.match(renderPaint, /if \(car\.fixedLivery\) \{[\s\S]*\} else if \(!isPaintUnlocked\(\)\) \{[\s\S]*\} else \{/,
  'Paint is fixed for service liveries, locked before PAINTJOB, editable after');
assert.match(renderPaint, /Paint unlocks at <strong>/);
assert.match(garage, /const paintFor = \(carId\) => \(isPaintUnlocked\(\) \? resolveLotPaint\(carId\) : factoryPaint\(carId\)\)/,
  'Factory paint is forced only while PAINTJOB is locked');
assert.match(garage, /paintToggle\.classList\.toggle\('is-locked', !car\.fixedLivery && !isPaintUnlocked\(\)\)/);
assert.match(garage, /showTrophyUnlockNotice\(\{ reward: getTrophyRoadReward\(PAINT_REWARD_ID\), itemName: 'Car color' \}\)/,
  'A locked PAINT explains its Trophy Road reward');

// --- Standalone-iOS/PWA-safe editable swatch -----------------------------------
assert.match(garage, /<span class="garage-swatch-face" aria-hidden="true"><\/span>/,
  'TURN paints a visible swatch face inside the label of the real input');
assert.match(garage, /face\.style\.setProperty\('--garage-swatch', input\.value\)/,
  'The visible swatch always mirrors the native input value');
assert.match(garageCss, /\.garage-swatch-face \{[\s\S]*background: var\(--garage-swatch/);
const clippedInput = garageCss.match(/\.garage-swatch input\[type='color'\] \{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(clippedInput, /width: 0\.75px;[\s\S]*height: 0\.75px;[\s\S]*clip-path: inset\(50%\);[\s\S]*opacity: 0;/,
  'The native input is visually clipped instead of composited over the swatch');
assert.doesNotMatch(clippedInput, /inset:\s*0|width:\s*100%|height:\s*100%/,
  'Standalone WebKit must never receive a full-size transparent native control over the visible face');

// --- No observers, no faux controls -----------------------------------------------
assert.doesNotMatch(garage, /MutationObserver/, 'GARAGE renders its own state instead of observing the DOM');
assert.doesNotMatch(garage, /paintPanel\.addEventListener\(['"]click['"]/,
  'The paint panel must not become a faux click-control ancestor of the native inputs');
assert.doesNotMatch(garage, /paintPanel\.setAttribute\('role', 'button'\)|paintPanel\.tabIndex\s*=/);

// --- Trophy Road order ---------------------------------------------------------------
const thresholds = GARAGE_CAR_ORDER.map((carId) => rewardForVehicle(carId)?.threshold ?? 0);
assert.deepEqual(thresholds, [...thresholds].sort((a, b) => a - b),
  'GARAGE and its keyboard/VoiceOver order follow Trophy Road: every reward car after the starting cars');
assert.ok(thresholds.filter((threshold) => threshold === 0).length >= 2, 'GARAGE starts with the standard cars');

// --- Fresh module identities for already-installed PWAs ----------------------------
const canonicalCatalog = `/turn/vehicle/catalog.js?build=${release.cacheKey}`;
for (const staleCatalogSpecifier of [
  '/turn/vehicle/catalog.js?build=20260804-r157-factory-colors',
  '/turn/vehicle/catalog.js?build=20260720-r20&revision=r588-canonical-attributes',
  '/turn/vehicle/catalog.js?revision=r164-vintage-rally-polish',
  '/turn/vehicle/catalog.js?revision=r250-supercar-finish'
]) {
  assert.equal(imports[staleCatalogSpecifier], canonicalCatalog,
    `${staleCatalogSpecifier} must resolve to the one fresh vehicle catalog`);
}
assert.ok(!Object.keys(imports).some((specifier) => /lot-(paint-reward|trophy-gate|enhancement-runtime|showroom-experiment|track-select|pwa-color-swatch)/.test(specifier)),
  'The retired Lot modules are no longer routed');

console.log('GARAGE paint state model, PWA-safe native swatch, observer-free rendering, Trophy Road order and catalog cache bridges passed.');

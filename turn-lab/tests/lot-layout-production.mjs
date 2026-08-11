import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  index,
  releaseSource,
  app,
  wrapper,
  enhancementRuntime,
  perkDisclosure,
  layout,
  layoutCss,
  lot,
  legend,
  accessibility
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-accessibility-r118.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(
  index,
  new RegExp(`lot-layout-r60\\.css\\?build=${release.cacheKey}-native-html`),
  'Production must cache-bust the HTML-first Lot layout stylesheet with the active release'
);
assert.match(index, new RegExp(`app\\.js\\?build=${release.cacheKey}-browser-consent`));
assert.equal(
  imports['./garage/lot-r10.js?build=20260720-r19'],
  `./garage/lot-track-select.js?build=${release.cacheKey}&revision=r163-native-html`
);
assert.equal(
  imports['./garage/lot-accessibility-r118.js?build=20260729-r118'],
  `./garage/lot-accessibility-r118.js?build=${release.cacheKey}&revision=r163-voiceover-first-lot-focus`
);
assert.equal(
  imports['./garage/lot-enhancement-runtime.js?revision=r163-native-picker-parent-click&build=20260809-r163'],
  `./garage/lot-enhancement-runtime.js?build=${release.cacheKey}&revision=r164-perk-observer-hotfix`,
  'The interaction-freeze hotfix must use a fresh enhancement-runtime URL so installed PWAs cannot reuse the broken r164 observer graph'
);

assert.match(app, /installLotEnhancementRuntime\(\)/);
assert.ok(
  app.indexOf('installLotEnhancementRuntime()') < app.indexOf("withBuild('./main.js')"),
  'The Lot enhancement observer must exist before any route can open The Lot'
);

assert.match(wrapper, /export async function showEnhancedLot/);
assert.match(wrapper, /const removeEnhancements = enhanceLotNow\(\)/);
assert.match(wrapper, /await chooseTrackBeforeLot\(\)/);
assert.doesNotMatch(wrapper, /installLotLayout|installLotStatLegend|installLotAccessibility/);

assert.match(enhancementRuntime, /ENHANCEMENT_ID = 'enhanced-lot-r164-perks-observer-hotfix'/);
assert.match(enhancementRuntime, /lot-perk-disclosure\.js\?revision=r164-perks-observer-hotfix/);
assert.match(enhancementRuntime, /activeEnhancements = new WeakMap\(\)/);
assert.match(enhancementRuntime, /LOT_ENTRY_CLICK_GUARD_MS = 600/);
assert.match(enhancementRuntime, /installLotPerkDisclosure\(scope\)/);
assert.match(enhancementRuntime, /installLotStatLegend\(scope\)/);
assert.match(enhancementRuntime, /installLotLayout\(scope\)/);
assert.match(enhancementRuntime, /installLotAccessibility\(scope\)/);
assert.ok(
  enhancementRuntime.indexOf('installLotPerkDisclosure(scope)') < enhancementRuntime.indexOf('installLotAccessibility(scope)'),
  'Perk information must exist before the accessibility enhancer completes selected-car semantics'
);
assert.match(enhancementRuntime, /new MutationObserver\(sync\)/);
assert.match(enhancementRuntime, /if \(active\) return active\.release/);
assert.match(enhancementRuntime, /released = true/);

assert.match(perkDisclosure, /className = 'lot-perk-button'/);
assert.match(perkDisclosure, /aria-expanded/);
assert.match(perkDisclosure, /<strong>PERK:<\/strong>/);
assert.match(perkDisclosure, /-webkit-line-clamp: 2/);
assert.match(perkDisclosure, /reward\?\.perkDescription/);
assert.match(perkDisclosure, /const picker = screen\?\.querySelector\?\.\('\.lot-car-picker'\)/);
assert.match(
  perkDisclosure,
  /observer\.observe\(picker, \{[\s\S]*subtree: true,[\s\S]*attributes: true,[\s\S]*attributeFilter: \['aria-checked'\][\s\S]*\}\);/,
  'Perk synchronization must observe only car radio selection state'
);
assert.doesNotMatch(perkDisclosure, /observer\.observe\(screen,/,
  'The perk disclosure must never observe the subtree that contains its own generated copy');
assert.doesNotMatch(perkDisclosure, /childList:\s*true|characterData:\s*true/,
  'The perk disclosure must not react to DOM/text mutations that its own sync function can create');

assert.match(
  lot,
  /<section class="lot-viewbox lot-viewbox-with-paint">[\s\S]*<div class="lot-colors" aria-label="Choose car paint colours"><\/div>[\s\S]*<\/section>/,
  'Native paint controls and 3D preview must share their final panel from initial render'
);
assert.match(lot, /lot-viewbox-head" aria-hidden="true"/);
assert.match(lot, /lot-view-host" aria-hidden="true"/);
assert.doesNotMatch(lot, /lot-view-close|lot-view-open/);

assert.doesNotMatch(layout, /appendChild\(colors\)|lot-view-close|lot-view-open/);
assert.match(layout, /document\.createTextNode\('ATTRIBUTES'\)/);
assert.match(layout, /infoButton\.textContent = 'i'/);
assert.match(layout, /aria-label', 'What do the attributes mean\?'/);
assert.doesNotMatch(layout, /MutationObserver|setAnimationLoop|requestAnimationFrame/);

assert.match(layoutCss, /\.lot-a11y-only \{[\s\S]*clip-path: inset\(50%\)/);
assert.match(layoutCss, /--lot-paint-rail-height: 54px/);
assert.match(layoutCss, /min-height: clamp\(150px, 28vh, 230px\)/);
assert.match(layoutCss, /\.lot-viewbox-with-paint \.lot-colors \{[\s\S]*border-top: 3px solid var\(--ink\)/);
assert.doesNotMatch(layoutCss, /\.lot-color-input|\.lot-color-preset/);
assert.match(layoutCss, /\.lot-race \{[\s\S]*background: var\(--pink\)/);
assert.match(layoutCss, /@media \(max-height: 520px\)/);
assert.match(layoutCss, /@media \(max-height: 430px\)/);

assert.match(accessibility, /makeHiddenHeading\('lot-choose-car-heading', 'Choose car'\)/);
assert.match(accessibility, /makeHiddenHeading\('lot-paint-heading', 'Choose car colour'\)/);
assert.match(accessibility, /makeHiddenHeading\('lot-car-info-heading', 'Car information'\)/);
assert.match(accessibility, /button\.setAttribute\('aria-labelledby', description\.id\)/);
assert.match(accessibility, /selectedSummary\.textContent = completeTextByCarId\.get\(selectedCarId\)/);
assert.match(accessibility, /CAR_CATALOG\.slice\(selectedIndex\)/);
assert.match(accessibility, /aria-posinset/);
assert.match(accessibility, /aria-setsize/);
assert.match(accessibility, /lotTitle\.focus\(\{ preventScroll: true \}\)/);
assert.match(accessibility, /Top speed/);
assert.match(accessibility, /Boost tank/);
assert.doesNotMatch(accessibility, /setInterval|requestAnimationFrame|setAnimationLoop/);

assert.match(legend, /VEHICLE_STAT_LEGEND/);
assert.match(legend, /aria-haspopup', 'dialog'/);
assert.match(legend, /role', 'dialog'/);
assert.match(legend, /name\.textContent = entry\.label/);
assert.match(legend, /description\.textContent = entry\.description/);

console.log(`TURN ${release.id} compact Lot layout, non-self-triggering perk disclosure and accessibility contract passed.`);

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  index,
  releaseSource,
  app,
  wrapper,
  enhancementRuntime,
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

assert.match(index, new RegExp(`lot-layout-r60\\.css\\?build=${release.cacheKey}`), 'Production must retain the baseline Lot layout stylesheet');
assert.match(index, new RegExp(`app\\.js\\?build=${release.cacheKey}-lot-restored`), 'Production must cache-bust the route-independent Lot fix');
assert.equal(imports['./garage/lot-r10.js?build=20260720-r19'], `./garage/lot-track-select.js?build=${release.cacheKey}`, 'Production must retain the track-first compatibility wrapper');

assert.match(app, /lot-layout-r60\.css\?revision=r121-viewer-r122-fit/, 'The fitted Lot rail stylesheet must bypass the previous viewer cache');
assert.match(app, /lot-enhancement-runtime\.js\?revision=r121/, 'Production must load the route-independent Lot enhancer');
assert.match(app, /installLotEnhancementRuntime\(\)/, 'Production must install the Lot enhancer once');
assert.ok(
  app.indexOf('installLotEnhancementRuntime()') < app.indexOf("withBuild('./main.js')"),
  'The Lot enhancement observer must exist before any route can open The Lot'
);

assert.match(wrapper, /lot-enhancement-runtime\.js\?revision=r121&build=20260731-r120/, 'The compatibility wrapper must share the exact enhancement module instance');
assert.match(wrapper, /export async function showEnhancedLot/, 'The enhanced active-track Lot must remain reusable without another track chooser');
assert.match(wrapper, /const removeEnhancements = enhanceLotNow\(\)/, 'The compatibility wrapper must synchronously enhance before the first paint');
assert.match(wrapper, /await chooseTrackBeforeLot\(\)/, 'The compatibility route must still choose a track before The Lot');
assert.doesNotMatch(wrapper, /installLotLayout|installLotStatLegend|installLotAccessibility/, 'Enhancement ownership must not drift back into one navigation wrapper');

assert.match(enhancementRuntime, /ENHANCEMENT_ID = 'enhanced-lot-r121'/, 'The restored Lot contract must have an explicit identity');
assert.match(enhancementRuntime, /activeEnhancements = new WeakMap\(\)/, 'Enhancements must be idempotent per Lot screen');
assert.match(enhancementRuntime, /installLotStatLegend\(scope\)/, 'Every Lot route must receive the stat legend');
assert.match(enhancementRuntime, /installLotLayout\(scope\)/, 'Every Lot route must receive the shared 3D and paint layout');
assert.match(enhancementRuntime, /installLotAccessibility\(scope\)/, 'Every Lot route must receive the r118 accessibility model');
assert.ok(
  enhancementRuntime.indexOf('installLotStatLegend(scope)') < enhancementRuntime.indexOf('installLotLayout(scope)'),
  'The legend trigger must exist before the layout turns it into the Attributes info icon'
);
assert.ok(
  enhancementRuntime.indexOf('installLotLayout(scope)') < enhancementRuntime.indexOf('installLotAccessibility(scope)'),
  'Accessibility landmarks must attach after paint reaches its final DOM position'
);
assert.match(enhancementRuntime, /new MutationObserver\(sync\)/, 'The runtime must catch M8 and any future Lot route');
assert.match(enhancementRuntime, /if \(active\) return active\.release/, 'Repeated route helpers must not install duplicate observers or headings');
assert.match(enhancementRuntime, /released = true/, 'Cleanup must be safe when both the route and observer release the same screen');

assert.match(layout, /viewbox\.removeAttribute\('aria-hidden'\)/, 'The shared 3D and paint panel must remain in the accessibility tree');
assert.match(layout, /lot-viewbox-head'\)\?\.setAttribute\('aria-hidden', 'true'\)/, 'Decorative 3D chrome must remain hidden from assistive technology');
assert.match(layout, /lot-view-host'\)\?\.setAttribute\('aria-hidden', 'true'\)/, 'The decorative WebGL host must remain hidden from assistive technology');
assert.match(layout, /viewbox\.appendChild\(colors\)/, 'The live paint controls and 3D preview must share one actual panel');
assert.doesNotMatch(layout, /lot-paint-a11y-host/, 'The retired overlapping paint-host workaround must not return');
assert.match(layout, /lot-view-close'\)\?\.remove\(\)/, 'The redundant 3D close control must be removed');
assert.match(layout, /lot-view-open'\)\?\.remove\(\)/, 'The retired 3D reopen control must be removed with it');
assert.match(layout, /document\.createTextNode\('ATTRIBUTES'\)/, 'The lower card must be headed Attributes visually');
assert.match(layout, /infoButton\.textContent = 'i'/, 'The verbose help button must become a conventional info icon');
assert.match(layout, /aria-label', 'What do the attributes mean\?'/, 'The compact icon must keep an explicit accessible name');
assert.doesNotMatch(layout, /MutationObserver|setAnimationLoop|requestAnimationFrame/, 'The visual layout pass must remain a one-time DOM arrangement');

assert.match(accessibility, /makeHiddenHeading\('lot-choose-car-heading', 'Choose car'\)/, 'Screen-reader users must be able to navigate directly to the car chooser');
assert.match(accessibility, /makeHiddenHeading\('lot-paint-heading', 'Choose car colour'\)/, 'Screen-reader users must be able to jump beyond the car list to paint controls');
assert.match(accessibility, /makeHiddenHeading\('lot-car-info-heading', 'Car information'\)/, 'Screen-reader users must be able to jump directly to selected-car information');
assert.match(accessibility, /existingLabel = button\.getAttribute\('aria-label'\) \|\| car\.name/, 'The complete car text must retain its name and visual description');
assert.match(accessibility, /button\.setAttribute\('aria-labelledby', description\.id\)/, 'Every car option must use its complete hidden text as the accessible name');
assert.match(accessibility, /selectedSummary\.textContent = completeTextByCarId\.get\(selectedCarId\)/, 'Car information must contain real complete text for the selected car');
assert.match(accessibility, /carDescription\.setAttribute\('aria-hidden', 'true'\)/, 'The visible short description must not duplicate the complete accessible summary');
assert.match(accessibility, /stats\.setAttribute\('aria-hidden', 'true'\)/, 'The visual bars must not duplicate attributes already present in the complete summary');
assert.match(accessibility, /CAR_CATALOG\.slice\(selectedIndex\)/, 'The hidden radio order must begin with the selected car');
assert.match(accessibility, /carPicker\.appendChild\(fragment\)/, 'The checked radio must become the first item reached after the Choose car heading');
assert.match(accessibility, /button\.tabIndex = button === selectedButton \? 0 : -1/, 'The selected car must remain the radio group keyboard entry point');
assert.match(accessibility, /aria-posinset/, 'Reordered radios must retain their original catalogue position');
assert.match(accessibility, /aria-setsize/, 'Reordered radios must retain the catalogue size');
assert.match(accessibility, /attributeFilter: \['aria-checked'\]/, 'Selected-car semantics must follow live radio changes without polling');
assert.doesNotMatch(accessibility, /setAttribute\('aria-activedescendant'/, 'A non-focusable radiogroup must not pretend to own active-descendant focus');
assert.match(accessibility, /Top speed/, 'Car descriptions must include top speed');
assert.match(accessibility, /Acceleration/, 'Car descriptions must include acceleration');
assert.match(accessibility, /Control/, 'Car descriptions must include control');
assert.match(accessibility, /Drift/, 'Car descriptions must include drift');
assert.match(accessibility, /Boost power/, 'Car descriptions must include boost power');
assert.match(accessibility, /Boost tank/, 'Car descriptions must include boost tank');
assert.match(accessibility, /out of 5\./, 'Every described attribute must use the agreed out-of-five scale');
assert.match(accessibility, /colors\.setAttribute\('aria-labelledby', paintHeading\.id\)/, 'The colour controls must have a useful accessible name');
assert.match(accessibility, /card\.setAttribute\('role', 'region'\)/, 'Selected-car information must remain a named navigable region');
assert.doesNotMatch(accessibility, /setInterval|requestAnimationFrame|setAnimationLoop/, 'The accessibility enhancer must not add polling or animation work');

assert.match(layoutCss, /\.lot-a11y-only \{[\s\S]*clip-path: inset\(50%\)/, 'Navigation headings and summaries must be visually hidden without leaving the accessibility tree');
assert.match(layoutCss, /--lot-paint-rail-height: 54px/, 'Paint controls must use a compact dock to protect the 3D preview');
assert.match(layoutCss, /min-height: clamp\(150px, 28vh, 230px\)/, 'The 3D viewer must receive a meaningful responsive minimum height');
assert.match(layoutCss, /flex: 1 1 auto/, 'The 3D panel must receive the remaining rail height instead of being squashed');
assert.match(layoutCss, /\.lot-viewbox-with-paint \.lot-colors \{[\s\S]*border-top: 3px solid var\(--ink\)/, 'Accessible paint controls must preserve their visual dock inside the 3D card');
assert.match(layoutCss, /\.lot-card-actions \{[\s\S]*grid-template-columns: 1fr/, 'The lower card must reserve its action row for Race only');
assert.match(layoutCss, /\.lot-stats-help \{[\s\S]*border-radius: 50%/, 'The Attributes help control must read as a conventional circular info icon');
assert.match(layoutCss, /\.lot-race \{[\s\S]*background: var\(--pink\)/, 'Race This Car must use the pink action treatment shown in the fitted design');
assert.match(layoutCss, /\.lot-view-close,[\s\S]*\.lot-view-open \{[\s\S]*display: none !important/, 'No dormant 3D close or reopen affordance may flash during setup');
assert.match(layoutCss, /@media \(max-height: 520px\)[\s\S]*\.lot-side \{[\s\S]*top: max\(62px,[\s\S]*\.lot-card \{[\s\S]*padding: 9px/, 'Tablet-sized short landscapes must compact the rail before Race can leave the viewport');
assert.match(layoutCss, /@media \(max-height: 520px\)[\s\S]*min-height: 140px/, 'The fitted layout must preserve a useful 3D preview on short tablet landscapes');
assert.match(layoutCss, /@media \(max-height: 430px\)[\s\S]*min-height: 120px/, 'Short iPhone landscapes must keep the viewer without pushing Race off-screen');

assert.match(lot, /<div class="lot-colors" aria-label="Choose car paint colours"><\/div>/, 'The verified Lot must still own the live native paint controls before enhancement');
assert.match(legend, /aria-haspopup', 'dialog'/, 'The relocated info icon must still open the full stat legend');

console.log(`TURN ${release.id} route-independent enhanced Lot, fitted short-landscape rail and selected-car accessibility passed.`);

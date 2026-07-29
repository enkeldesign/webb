import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, releaseSource, wrapper, layout, layoutCss, lot, legend, accessibility] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-accessibility-r117.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(index, new RegExp(`lot-layout-r60\\.css\\?build=${release.cacheKey}`), 'Production must load the compact Lot layout through the current release');
assert.equal(imports['./garage/lot-r10.js?build=20260720-r19'], `./garage/lot-track-select.js?build=${release.cacheKey}`, 'Production must publish the wrapper that installs the compact layout');
assert.match(wrapper, /lot-layout-r60\.js\?build=20260729-r116/, 'The wrapper must import the verified shared-panel layout enhancer');
assert.match(wrapper, /lot-accessibility-r117\.js\?build=20260729-r117/, 'The wrapper must install the current Lot accessibility enhancer');
assert.ok(
  wrapper.indexOf('installLotStatLegend()') < wrapper.indexOf('installLotLayout()'),
  'The legend trigger must exist before the layout turns it into the Attributes info icon'
);
assert.ok(
  wrapper.indexOf('installLotLayout()') < wrapper.indexOf('installLotAccessibility()'),
  'Accessibility landmarks must be attached after the paint controls reach their final DOM position'
);

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
assert.match(accessibility, /existingLabel = button\.getAttribute\('aria-label'\) \|\| car\.name/, 'The complete car label must retain its name and visual description');
assert.match(accessibility, /button\.setAttribute\('aria-labelledby', description\.id\)/, 'Every car option must use its complete label as the accessible name');
assert.match(accessibility, /carDescription\.setAttribute\('aria-labelledby', completeLabelId\)/, 'The visible selected-car description must expose the same complete name, appearance and attributes');
assert.match(accessibility, /carPicker\.setAttribute\('aria-activedescendant', selectedButton\.id\)/, 'The radio group must explicitly retain the currently selected car as its active item');
assert.match(accessibility, /button\.tabIndex = button === selectedButton \? 0 : -1/, 'The selected car must remain the radio group keyboard entry point');
assert.match(accessibility, /attributeFilter: \['aria-checked'\]/, 'Selected-car semantics must follow live radio changes without polling');
assert.match(accessibility, /Top speed/, 'Car descriptions must include top speed');
assert.match(accessibility, /Acceleration/, 'Car descriptions must include acceleration');
assert.match(accessibility, /Control/, 'Car descriptions must include control');
assert.match(accessibility, /Drift/, 'Car descriptions must include drift');
assert.match(accessibility, /Boost power/, 'Car descriptions must include boost power');
assert.match(accessibility, /Boost tank/, 'Car descriptions must include boost tank');
assert.match(accessibility, /out of 5\./, 'Every described attribute must use the agreed out-of-five scale');
assert.match(accessibility, /colors\.setAttribute\('aria-labelledby', paintHeading\.id\)/, 'The colour controls must have a useful accessible name');
assert.match(accessibility, /card\.setAttribute\('role', 'region'\)/, 'Selected-car information must be a named navigable region');
assert.match(accessibility, /stats\.setAttribute\('role', 'list'\)/, 'Individual selected-car attributes must remain browsable as a list');
assert.match(accessibility, /row\.setAttribute\('role', 'listitem'\)/, 'Each selected-car attribute must be exposed individually');
assert.match(accessibility, /new MutationObserver\(applyStatSemantics\)/, 'Re-rendered attributes must retain their list semantics');
assert.doesNotMatch(accessibility, /setInterval|requestAnimationFrame|setAnimationLoop/, 'The accessibility enhancer must not add polling or animation work');

assert.match(layoutCss, /\.lot-a11y-only \{[\s\S]*clip-path: inset\(50%\)/, 'Navigation headings must be visually hidden without leaving the accessibility tree');
assert.match(layoutCss, /--lot-paint-rail-height: 58px/, 'The 3D panel must reserve a deliberate paint-control rail');
assert.match(layoutCss, /flex: 1 1 auto/, 'The 3D panel must receive the remaining rail height instead of being squashed');
assert.match(layoutCss, /\.lot-viewbox-with-paint \.lot-colors \{[\s\S]*border-top: 3px solid var\(--ink\)/, 'Accessible paint controls must preserve their visual dock inside the 3D card');
assert.match(layoutCss, /\.lot-card-actions \{[\s\S]*grid-template-columns: 1fr/, 'The lower card must reserve its action row for Race only');
assert.match(layoutCss, /\.lot-stats-help \{[\s\S]*border-radius: 50%/, 'The Attributes help control must read as a conventional circular info icon');
assert.match(layoutCss, /\.lot-view-close,[\s\S]*\.lot-view-open \{[\s\S]*display: none !important/, 'No dormant 3D close or reopen affordance may flash during setup');

assert.match(lot, /<div class="lot-colors" aria-label="Choose car paint colours"><\/div>/, 'The verified Lot must still own the live native paint controls before enhancement');
assert.match(legend, /aria-haspopup', 'dialog'/, 'The relocated info icon must still open the full stat legend');

console.log(`TURN ${release.id} shared 3D, selected-car info and active-radio accessibility passed.`);

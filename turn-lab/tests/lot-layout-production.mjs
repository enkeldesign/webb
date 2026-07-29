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
  fs.readFile(new URL('../../turn/garage/lot-accessibility-r115.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(index, new RegExp(`lot-layout-r60\\.css\\?build=${release.cacheKey}`), 'Production must load the compact Lot layout through the current release');
assert.equal(imports['./garage/lot-r10.js?build=20260720-r19'], `./garage/lot-track-select.js?build=${release.cacheKey}`, 'Production must publish the wrapper that installs the compact layout');
assert.match(wrapper, /lot-layout-r60\.js\?build=20260724-r60/, 'The wrapper must import the verified layout enhancer');
assert.match(wrapper, /lot-accessibility-r115\.js\?build=20260729-r115/, 'The wrapper must install the complete Lot accessibility enhancer');
assert.ok(
  wrapper.indexOf('installLotStatLegend()') < wrapper.indexOf('installLotLayout()'),
  'The legend trigger must exist before the layout turns it into the Attributes info icon'
);
assert.ok(
  wrapper.indexOf('installLotLayout()') < wrapper.indexOf('installLotAccessibility()'),
  'Accessibility landmarks must be attached after the paint controls reach their final DOM position'
);

assert.match(layout, /document\.createElement\('section'\)/, 'Paint controls must live in a semantic section');
assert.match(layout, /paintA11yHost\.appendChild\(colors\)/, 'The semantic paint section must own the live colour controls');
assert.match(layout, /viewbox\.insertAdjacentElement\('afterend', paintA11yHost\)/, 'Paint controls must remain outside the aria-hidden 3D subtree');
assert.doesNotMatch(layout, /viewbox\.appendChild\(colors\)/, 'Interactive paint controls must never be descendants of the aria-hidden viewer');
assert.match(layout, /viewbox\.setAttribute\('aria-hidden', 'true'\)/, 'The WebGL viewer must remain hidden from assistive technology');
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
assert.match(accessibility, /aria-labelledby takes precedence over aria-label/, 'The complete car name must remain stable when The Lot refreshes its shorter aria-label');
assert.match(accessibility, /Top speed/, 'Car descriptions must include top speed');
assert.match(accessibility, /Acceleration/, 'Car descriptions must include acceleration');
assert.match(accessibility, /Control/, 'Car descriptions must include control');
assert.match(accessibility, /Drift/, 'Car descriptions must include drift');
assert.match(accessibility, /Boost power/, 'Car descriptions must include boost power');
assert.match(accessibility, /Boost tank/, 'Car descriptions must include boost tank');
assert.match(accessibility, /out of 5\./, 'Every described attribute must use the agreed out-of-five scale');
assert.match(accessibility, /paintHost\.setAttribute\('aria-labelledby', paintHeading\.id\)/, 'The colour section must have a useful accessible name');
assert.match(accessibility, /card\.setAttribute\('role', 'region'\)/, 'Selected-car information must be a named navigable region');
assert.match(accessibility, /stats\.setAttribute\('role', 'list'\)/, 'Individual selected-car attributes must remain browsable as a list');
assert.match(accessibility, /row\.setAttribute\('role', 'listitem'\)/, 'Each selected-car attribute must be exposed individually');
assert.match(accessibility, /new MutationObserver\(applyStatSemantics\)/, 'Re-rendered attributes must retain their list semantics');
assert.doesNotMatch(accessibility, /setInterval|requestAnimationFrame|setAnimationLoop/, 'The accessibility enhancer must not add polling or animation work');

assert.match(layoutCss, /\.lot-a11y-only \{[\s\S]*clip-path: inset\(50%\)/, 'Navigation headings must be visually hidden without leaving the accessibility tree');
assert.match(layoutCss, /--lot-paint-rail-height: 58px/, 'The 3D panel must reserve a deliberate paint-control rail');
assert.match(layoutCss, /flex: 1 1 auto/, 'The 3D panel must receive the remaining rail height instead of being squashed');
assert.match(layoutCss, /\.lot-paint-a11y-host \.lot-colors \{[\s\S]*border-top: 3px solid var\(--ink\)/, 'Accessible paint controls must preserve their visual dock inside the 3D card');
assert.match(layoutCss, /\.lot-card-actions \{[\s\S]*grid-template-columns: 1fr/, 'The lower card must reserve its action row for Race only');
assert.match(layoutCss, /\.lot-stats-help \{[\s\S]*border-radius: 50%/, 'The Attributes help control must read as a conventional circular info icon');
assert.match(layoutCss, /\.lot-view-close,[\s\S]*\.lot-view-open \{[\s\S]*display: none !important/, 'No dormant 3D close or reopen affordance may flash during setup');

assert.match(lot, /<div class="lot-colors" aria-label="Choose car paint colours"><\/div>/, 'The verified Lot must still own the live native paint controls before enhancement');
assert.match(legend, /aria-haspopup', 'dialog'/, 'The relocated info icon must still open the full stat legend');

console.log(`TURN ${release.id} compact 3D, paint and complete Lot accessibility passed.`);

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, releaseSource, wrapper, layout, layoutCss, lot, legend] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-stat-legend.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(index, new RegExp(`lot-layout-r60\\.css\\?build=${release.cacheKey}`), 'Production must load the compact Lot layout through the current release');
assert.equal(imports['./garage/lot-r10.js?build=20260720-r19'], `./garage/lot-track-select.js?build=${release.cacheKey}`, 'Production must publish the wrapper that installs the compact layout');
assert.match(wrapper, /lot-layout-r60\.js\?build=20260724-r60/, 'The wrapper must import the verified layout enhancer');
assert.ok(
  wrapper.indexOf('installLotStatLegend()') < wrapper.indexOf('installLotLayout()'),
  'The legend trigger must exist before the layout turns it into the Attributes info icon'
);

assert.match(layout, /viewbox\.appendChild\(colors\)/, 'Paint controls must move into the 3D view panel');
assert.match(layout, /lot-view-close'\)\?\.remove\(\)/, 'The redundant 3D close control must be removed');
assert.match(layout, /lot-view-open'\)\?\.remove\(\)/, 'The retired 3D reopen control must be removed with it');
assert.match(layout, /document\.createTextNode\('ATTRIBUTES'\)/, 'The lower card must be headed Attributes');
assert.match(layout, /infoButton\.textContent = 'i'/, 'The verbose help button must become a conventional info icon');
assert.match(layout, /aria-label', 'What do the attributes mean\?'/, 'The compact icon must keep an explicit accessible name');
assert.doesNotMatch(layout, /MutationObserver|setAnimationLoop|requestAnimationFrame/, 'The layout pass must remain a one-time DOM arrangement');

assert.match(layoutCss, /--lot-paint-rail-height: 58px/, 'The 3D panel must reserve a deliberate paint-control rail');
assert.match(layoutCss, /flex: 1 1 auto/, 'The 3D panel must receive the remaining rail height instead of being squashed');
assert.match(layoutCss, /\.lot-viewbox-with-paint \.lot-colors \{[\s\S]*position: absolute/, 'Paint controls must dock inside the 3D panel');
assert.match(layoutCss, /\.lot-card-actions \{[\s\S]*grid-template-columns: 1fr/, 'The lower card must reserve its action row for Race only');
assert.match(layoutCss, /\.lot-stats-help \{[\s\S]*border-radius: 50%/, 'The Attributes help control must read as a conventional circular info icon');
assert.match(layoutCss, /\.lot-view-close,[\s\S]*\.lot-view-open \{[\s\S]*display: none !important/, 'No dormant 3D close or reopen affordance may flash during setup');

assert.match(lot, /<div class="lot-colors" aria-label="Choose car paint colours"><\/div>/, 'The verified Lot must still own the live native paint controls');
assert.match(legend, /aria-haspopup', 'dialog'/, 'The relocated info icon must still open the full stat legend');

console.log(`TURN ${release.id} compact 3D, paint and Attributes panel layout passed.`);

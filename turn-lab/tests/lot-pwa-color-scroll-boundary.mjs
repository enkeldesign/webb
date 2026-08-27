import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [boundary, runtime, screenReader, perk, showroomCss, layout] = await Promise.all([
  fs.readFile(new URL('../../turn/garage/lot-card-scroll-boundary.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-screen-reader-r202.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-showroom-experiment.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-layout-r60.js', import.meta.url), 'utf8')
]);

// COLOR is intentionally moved into .lot-card for the requested semantic order.
assert.match(screenReader, /card\.insertBefore\(colors, raceHeading\)/,
  'The screen-reader pass must keep COLOR between Car information and Race in DOM order');

// The perk popover remains adjacent to the description in source order, while its
// fixed/top-layer presentation keeps it from consuming information-panel height.
assert.match(perk, /description\.after\(popover\)/,
  'Perk content must remain associated with car information rather than the floating COLOR control');
assert.match(showroomCss, /\.lot-showroom \.lot-card\s*\{[\s\S]*overflow-y:\s*auto/,
  'The base showroom still documents the historical card-level scroll behavior this compatibility layer overrides');

// Standalone iOS must never have the fixed COLOR control inside the active scrolling ancestor.
assert.match(boundary, /\.lot-showroom\.lot-card-scroll-boundary \.lot-card\s*\{[\s\S]*overflow:\s*visible/,
  'The card itself must stop being the scrolling/clipping ancestor');
assert.match(boundary, /\.lot-showroom \.lot-card-info-scroll\s*\{[\s\S]*overflow-y:\s*auto/,
  'Only the inner car-information region may scroll');
assert.match(boundary, /-webkit-overflow-scrolling:\s*touch/,
  'The inner information scroller must retain native iOS momentum scrolling');

// With description and perk copy removed from visual flow, keep title, ATTRIBUTES and
// the responsive stat grid packed in a predictable order. Keep the inter-section
// spacing small enough that all six rows fit before the fixed race action.
assert.match(boundary, /\.lot-showroom \.lot-card-info-scroll\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*justify-content:\s*flex-start;[\s\S]*gap:\s*clamp\(2px, 0\.5vh, 5px\);/,
  'Car-information sections must stay packed without creating avoidable inner scrolling');

// The wrapper must contain every car-information node, including the hidden popover
// source and visible ATTRIBUTES row, while COLOR and RACE stay as card siblings outside it.
for (const selector of [
  "'.lot-car-title'",
  "'.lot-car-description'",
  "'.lot-perk-disclosure'",
  "'.lot-attributes-row'",
  "'.lot-stats'",
  "'.lot-stats-help'"
]) {
  assert.match(boundary, new RegExp(`card\\.querySelector\\(${selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\)`));
}
assert.match(boundary, /for \(const node of \[title, description, perk, attributes, stats, statsHelp\]\)/,
  'ATTRIBUTES must move with the variable-height car information rather than becoming a fixed descendant');
assert.doesNotMatch(boundary, /lot-colors|lot-race/,
  'COLOR and RACE must never be moved into the inner scroll region');

// ATTRIBUTES is visual structure only; it must not add a new heading between
// CAR INFORMATION and RACE, while the existing help button remains semantic.
assert.match(layout, /label\.textContent = 'ATTRIBUTES'/);
assert.match(layout, /label\.setAttribute\('aria-hidden', 'true'\)/);
assert.match(layout, /attributesRow\.appendChild\(infoButton\)/);

// The production enhancement lifecycle must install the boundary after perk/stat/layout
// construction, before the later screen-reader pass moves COLOR into the card.
assert.match(runtime, /lot-card-scroll-boundary\.js\?revision=r216-meter-density/);
assert.match(runtime, /installLotCardScrollBoundary: scrollBoundary\.installLotCardScrollBoundary/);
const installOrder = runtime.match(/const removePerkDisclosure[\s\S]*?const removeAccessibility = installLotAccessibility\(scope\);/)?.[0] || '';
assert.ok(installOrder, 'Lot enhancement installation order must remain inspectable');
assert.ok(installOrder.indexOf('removePerkDisclosure') < installOrder.indexOf('removeCardScrollBoundary'));
assert.ok(installOrder.indexOf('removeStatLegend') < installOrder.indexOf('removeCardScrollBoundary'));
assert.ok(installOrder.indexOf('removeLayout') < installOrder.indexOf('removeCardScrollBoundary'));
assert.ok(installOrder.indexOf('removeCardScrollBoundary') < installOrder.indexOf('removeAccessibility'));

// Cleanup must restore the original DOM before the showroom is removed.
assert.match(boundary, /while \(scroll\.firstChild\) card\.insertBefore\(scroll\.firstChild, scroll\)/);
assert.match(boundary, /screen\.classList\.remove\('lot-card-scroll-boundary'\)/);
assert.match(runtime, /removeAccessibility\(\);[\s\S]*removeCardScrollBoundary\(\);/);

console.log('TURN Lot standalone-PWA COLOR scroll-boundary regression passed.');

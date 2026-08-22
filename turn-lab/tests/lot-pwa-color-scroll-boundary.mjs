import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [boundary, runtime, screenReader, perk, showroomCss] = await Promise.all([
  fs.readFile(new URL('../../turn/garage/lot-card-scroll-boundary.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-screen-reader-r202.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-perk-disclosure.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-showroom-experiment.css', import.meta.url), 'utf8')
]);

// COLOR is intentionally moved into .lot-card for the requested semantic order.
assert.match(screenReader, /card\.insertBefore\(colors, raceHeading\)/,
  'The screen-reader pass must keep COLOR between Car information and Race in DOM order');

// Reward cars have perk copy, which can make the information panel genuinely scroll.
assert.match(perk, /description\.after\(perk\)/,
  'Perk copy must remain part of car information rather than the floating COLOR control');
assert.match(showroomCss, /\.lot-showroom \.lot-card\s*\{[\s\S]*overflow-y:\s*auto/,
  'The base showroom still documents the historical card-level scroll behavior this compatibility layer overrides');

// Standalone iOS must never have the fixed COLOR control inside the active scrolling ancestor.
assert.match(boundary, /\.lot-showroom\.lot-card-scroll-boundary \.lot-card\s*\{[\s\S]*overflow:\s*visible/,
  'The card itself must stop being the scrolling/clipping ancestor');
assert.match(boundary, /\.lot-showroom \.lot-card-info-scroll\s*\{[\s\S]*overflow-y:\s*auto/,
  'Only the inner car-information region may scroll');
assert.match(boundary, /-webkit-overflow-scrolling:\s*touch/,
  'The inner information scroller must retain native iOS momentum scrolling');

// The wrapper must contain every variable-height information node, especially perk copy,
// while COLOR and RACE stay as card siblings outside the scroll layer.
for (const selector of [
  "'.lot-car-title'",
  "'.lot-car-description'",
  "'.lot-perk-disclosure'",
  "'.lot-stats'",
  "'.lot-stats-help'"
]) {
  assert.match(boundary, new RegExp(`card\\.querySelector\\(${selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\)`));
}
assert.match(boundary, /for \(const node of \[title, description, perk, stats, statsHelp\]\)/);
assert.doesNotMatch(boundary, /lot-colors|lot-race/,
  'COLOR and RACE must never be moved into the inner scroll region');

// The production enhancement lifecycle must install the boundary after perk/stat/layout
// construction, before the later screen-reader pass moves COLOR into the card.
assert.match(runtime, /lot-card-scroll-boundary\.js\?revision=r208-pwa-scroll-boundary/);
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

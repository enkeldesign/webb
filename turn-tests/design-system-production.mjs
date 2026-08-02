import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [design, tokens, semantic, installGate, homeFeedback] = await Promise.all([
  fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-tokens.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-semantic.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/install-gate.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-feedback-r135.css', import.meta.url), 'utf8')
]);

assert.match(design, /^<!doctype html>/i);
assert.match(design, /<html lang="en">/);
assert.match(design, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
assert.doesNotMatch(design, /user-scalable=no/);
assert.doesNotMatch(design, /<script\b/i, 'The reference page must remain static');
assert.doesNotMatch(design, /https?:\/\//i, 'The reference page must remain dependency-free');
assert.match(design, /href="\.\/design-tokens\.css\?revision=r139-semantic-system"/);
assert.match(design, /href="\.\/design-semantic\.css\?revision=r139-semantic-system"/);

for (const token of [
  '--turn-ink',
  '--turn-paper',
  '--turn-white',
  '--turn-yellow-600',
  '--turn-yellow-400',
  '--turn-yellow-200',
  '--turn-blue-600',
  '--turn-blue-500',
  '--turn-blue-300',
  '--turn-blue-200',
  '--turn-pink-500',
  '--turn-pink-200',
  '--turn-red-500',
  '--turn-red-200',
  '--turn-green-500',
  '--turn-green-200',
  '--turn-orange-500',
  '--turn-orange-200',
  '--turn-action-primary',
  '--turn-action-utility',
  '--turn-action-information',
  '--turn-action-success',
  '--turn-action-warning',
  '--turn-action-danger',
  '--turn-action-navigation',
  '--turn-control-gas',
  '--turn-control-drift',
  '--turn-control-boost',
  '--turn-control-brake',
  '--turn-border-micro',
  '--turn-border-compact',
  '--turn-border-default',
  '--turn-border-heavy',
  '--turn-radius-micro',
  '--turn-radius-compact',
  '--turn-radius-default',
  '--turn-radius-hero',
  '--turn-radius-pill',
  '--turn-radius-circle',
  '--turn-shadow-compact',
  '--turn-shadow-default',
  '--turn-shadow-hero'
]) {
  assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

for (const alias of [
  '--ink: var(--turn-ink)',
  '--paper: var(--turn-paper)',
  '--cyan: var(--turn-blue-500)',
  '--pink: var(--turn-pink-500)',
  '--yellow: var(--turn-yellow-400)',
  '--lime: var(--turn-green-500)',
  '--m8-ink: var(--turn-ink)',
  '--m8-cream: var(--turn-paper)',
  '--m8-pink: var(--turn-pink-500)',
  '--m8-yellow: var(--turn-yellow-600)',
  '--m8-blue: var(--turn-blue-300)'
]) {
  assert.match(tokens, new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(semantic, /^@import url\('\.\/design-tokens\.css\?revision=r139-semantic-system'\);/);
assert.match(semantic, /\.install-primary,[\s\S]*\.m8-home-fixed-layout \.m8-track-continue,[\s\S]*\.track-select-continue,[\s\S]*\.lot-race/);
assert.match(semantic, /border-radius: var\(--turn-radius-pill\) !important;/);
assert.match(semantic, /background: var\(--turn-action-primary\) !important;/);
assert.match(semantic, /\.m8-home-fixed-layout \.m8-home-settings,[\s\S]*\.m8-how-button,[\s\S]*\.m8-feedback-button/);
assert.match(semantic, /background: var\(--turn-action-utility\) !important;/);

for (const navigationSelector of [
  '.install-close',
  '.track-select-close',
  '.lot-back',
  '.lot-view-close',
  '.lot-stats-dialog-close',
  '.spectate-close',
  '.sound-guide-close',
  '.m8-dialog-head > button',
  '.back-to-lot-button',
  '[data-turn-navigation-action]'
]) {
  assert.ok(semantic.includes(navigationSelector), `Missing navigation selector ${navigationSelector}`);
}
assert.match(semantic, /background: var\(--turn-action-navigation\) !important;/);

assert.match(semantic, /\.drive-drift-zone,[\s\S]*background: var\(--turn-control-drift\) !important;/);
assert.match(semantic, /\.drive-pad \.drive-gas-zone,[\s\S]*background: var\(--turn-control-gas\) !important;/);
assert.match(semantic, /\.drive-pad \.drive-brake-zone,[\s\S]*background: var\(--turn-control-brake\) !important;/);
assert.match(semantic, /var\(--turn-control-boost\) 0 var\(--boost-charge\)/);
assert.doesNotMatch(semantic, /#ff3f4a|#ff5a5f|#ff7ab7|#c8db08|#d9eb12|#54c2ef/);

const semanticImport = /^@import url\('\.\/design-semantic\.css\?revision=r139-semantic-system'\);/;
assert.match(installGate, semanticImport);
assert.match(homeFeedback, semanticImport);

for (const section of ['decisions', 'colour', 'shape', 'components', 'screens', 'adoption']) {
  assert.match(design, new RegExp(`id="${section}"`));
  assert.match(design, new RegExp(`href="#${section}"`));
}

for (const decision of [
  'Forward is pink. Navigation is orange.',
  'Pink 500 + pill',
  'Paper + pill',
  'Orange 500',
  'Gas is green',
  'Drift is blue',
  'Boost is yellow',
  'Brake and Reverse are orange'
]) {
  assert.ok(design.includes(decision), `Missing normative decision: ${decision}`);
}

for (const primaryAction of ['Install TURN', 'Race this track', 'Race this car']) {
  assert.ok(design.includes(primaryAction), `Missing primary-flow specimen: ${primaryAction}`);
}
for (const utilityAction of ['Settings', 'How to Play', 'Give Feedback']) {
  assert.ok(design.includes(utilityAction), `Missing utility specimen: ${utilityAction}`);
}

for (const page of [
  'TURN install-page component specimen',
  'TURN Home and track-selection component specimen',
  'TURN The Lot component specimen',
  'TURN race component specimen',
  'TURN dialog component specimen'
]) {
  assert.match(design, new RegExp(page));
}

assert.match(design, />Track preview</);
assert.match(design, />3D car view</);
assert.match(design, />Rotatable car view</);
assert.match(design, />Game view</);
assert.doesNotMatch(design, /car-shape|track-preview-sample|race-road/);
assert.match(design, /Real components, no pretend game art\./);
assert.match(design, /The first two migration steps are now live\./);
assert.match(design, /class="skip-link" href="#main"/);
assert.match(design, /aria-label="Design system sections"/);
assert.match(design, /@media \(prefers-reduced-motion: reduce\)/);

console.log('TURN shared tokens, aliases, semantic roles and component-only reference passed.');

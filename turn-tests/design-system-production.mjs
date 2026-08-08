import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [design, tokens, semantic, homeFeedback, release, index] = await Promise.all([
  fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-tokens.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-semantic.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-feedback-r135.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8')
]);

assert.match(design, /^<!doctype html>/i);
assert.match(design, /<html lang="en">/);
assert.match(design, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
assert.doesNotMatch(design, /user-scalable=no/);
assert.doesNotMatch(design, /<script\b/i, 'The reference page must remain static');
assert.doesNotMatch(design, /https?:\/\//i, 'The reference page must remain dependency-free');
assert.match(design, /href="\.\/design-tokens\.css\?revision=r162-social-sharing"/);
assert.match(design, /href="\.\/design-semantic\.css\?revision=r162-social-sharing"/);

const primitivePalette = new Map([
  ['--turn-ink', '#08090a'],
  ['--turn-paper', '#fff8e8'],
  ['--turn-white', '#fffdf6'],
  ['--turn-road', '#44494f'],
  ['--turn-muted', '#d6d0c2'],
  ['--turn-yellow-600', '#ffbd12'],
  ['--turn-yellow-400', '#ffd43b'],
  ['--turn-yellow-200', '#ffe087'],
  ['--turn-yellow-100', '#fff0a8'],
  ['--turn-blue-600', '#35b8e7'],
  ['--turn-blue-500', '#38d9ff'],
  ['--turn-blue-300', '#68c8f2'],
  ['--turn-blue-200', '#8ed8ff'],
  ['--turn-blue-100', '#bdeeff'],
  ['--turn-pink-500', '#ff4fa3'],
  ['--turn-pink-200', '#ff8caf'],
  ['--turn-pink-100', '#ffd1e6'],
  ['--turn-red-500', '#ff6b6b'],
  ['--turn-red-200', '#ff9b91'],
  ['--turn-green-500', '#8ce99a'],
  ['--turn-green-200', '#d9f5c2'],
  ['--turn-green-100', '#c8f5d0'],
  ['--turn-orange-500', '#ff7b54'],
  ['--turn-orange-200', '#ffb89f'],
  ['--turn-orange-100', '#ffd0ae']
]);

assert.equal(
  [...design.matchAll(/class="swatch" data-token="([^"]+)"/g)].length,
  primitivePalette.size,
  'The reference must show every primitive colour exactly once'
);

for (const [token, value] of primitivePalette) {
  assert.ok(tokens.includes(`${token}: ${value}`), `Missing primitive definition ${token}: ${value}`);
  assert.ok(design.includes(`data-token="${token}"`), `Missing primitive swatch ${token}`);
  assert.ok(design.includes(`<code>${token}</code>`), `Missing visible primitive variable name ${token}`);
  assert.ok(design.includes(`<span>${value}</span>`), `Missing visible primitive value ${value}`);
}

const semanticMappings = new Map([
  ['--turn-surface-page', '--turn-paper'],
  ['--turn-surface-raised', '--turn-white'],
  ['--turn-action-primary', '--turn-pink-500'],
  ['--turn-action-share', '--turn-pink-500'],
  ['--turn-action-utility', '--turn-paper'],
  ['--turn-action-information', '--turn-blue-500'],
  ['--turn-action-game', '--turn-blue-500'],
  ['--turn-action-success', '--turn-green-500'],
  ['--turn-action-warning', '--turn-yellow-400'],
  ['--turn-action-danger', '--turn-red-500'],
  ['--turn-action-navigation', '--turn-orange-500'],
  ['--turn-form-control-idle', '--turn-paper'],
  ['--turn-form-control-selected', '--turn-pink-500'],
  ['--turn-form-control-focus', '--turn-blue-500'],
  ['--turn-disclosure-trigger', '--turn-blue-300'],
  ['--turn-disclosure-panel', '--turn-paper'],
  ['--turn-difficulty-easy', '--turn-green-200'],
  ['--turn-difficulty-medium', '--turn-yellow-200'],
  ['--turn-difficulty-hard', '--turn-red-200'],
  ['--turn-difficulty-locked', '--turn-muted'],
  ['--turn-control-gas', '--turn-green-500'],
  ['--turn-control-drift', '--turn-blue-500'],
  ['--turn-control-boost', '--turn-yellow-400'],
  ['--turn-control-boost-empty', '--turn-yellow-200'],
  ['--turn-control-brake', '--turn-orange-500'],
  ['--turn-social-racer-1', '--turn-pink-100'],
  ['--turn-social-racer-2', '--turn-blue-100'],
  ['--turn-social-racer-3', '--turn-green-100'],
  ['--turn-social-racer-4', '--turn-yellow-100'],
  ['--turn-social-racer-5', '--turn-orange-100']
]);

assert.equal(
  [...design.matchAll(/data-semantic="([^"]+)"/g)].length,
  semanticMappings.size,
  'The reference must show every semantic colour role exactly once'
);

for (const [semanticToken, primitiveToken] of semanticMappings) {
  const definition = `${semanticToken}: var(${primitiveToken})`;
  assert.ok(tokens.includes(definition), `Missing semantic mapping ${definition}`);
  assert.ok(design.includes(`data-semantic="${semanticToken}"`), `Missing semantic reference row ${semanticToken}`);
  assert.ok(design.includes(`<code>${semanticToken}</code>`), `Missing visible semantic variable ${semanticToken}`);
  assert.ok(design.includes(`<code>var(${primitiveToken})</code>`), `Missing visible semantic mapping ${semanticToken} to ${primitiveToken}`);
}

const compatibilityAliases = new Map([
  ['--ink', '--turn-ink'],
  ['--paper', '--turn-paper'],
  ['--cyan', '--turn-blue-500'],
  ['--pink', '--turn-pink-500'],
  ['--yellow', '--turn-yellow-400'],
  ['--lime', '--turn-green-500'],
  ['--m8-ink', '--turn-ink'],
  ['--m8-cream', '--turn-paper'],
  ['--m8-pink', '--turn-pink-500'],
  ['--m8-yellow', '--turn-yellow-600'],
  ['--m8-blue', '--turn-blue-300']
]);

for (const [alias, target] of compatibilityAliases) {
  assert.ok(tokens.includes(`${alias}: var(${target})`), `Missing compatibility alias ${alias}`);
  assert.ok(design.includes(`<code>${alias}</code>`), `Missing visible compatibility alias ${alias}`);
  assert.ok(design.includes(`<code>var(${target})</code>`), `Missing visible compatibility target ${target}`);
}

for (const token of [
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
  assert.ok(tokens.includes(token), `Missing geometry or elevation token ${token}`);
}

assert.match(semantic, /@import url\('\.\/design-tokens\.css\?revision=r162-social-sharing'\)/);
assert.match(semantic, /\.install-primary,[\s\S]*\.m8-home-fixed-layout \.m8-track-continue,[\s\S]*\.track-select-continue,[\s\S]*\.lot-race/);
assert.match(semantic, /border-radius: var\(--turn-radius-pill\) !important;/);
assert.match(semantic, /background: var\(--turn-action-primary\) !important;/);
assert.match(semantic, /\.turn-yourturn-share-submit,[\s\S]*\.yourturn-actions button\.is-share[\s\S]*var\(--turn-action-share\)/,
  'TURN and YOUR TURN share actions must consume the same semantic role');
assert.match(semantic, /\.yourturn-actions button\.is-game[\s\S]*var\(--turn-action-game\)/,
  'The YOUR TURN → TURN handoff must consume the game-handoff role');
assert.match(semantic, /\.yourturn-order-1[\s\S]*var\(--turn-social-racer-1\)/);
assert.match(semantic, /\.yourturn-order-5[\s\S]*var\(--turn-social-racer-5\)/);
assert.match(semantic, /background: var\(--turn-action-utility\) !important;/);
assert.match(semantic, /background: var\(--turn-action-navigation\) !important;/);

for (const difficultyContract of [
  '.track-card-countryside .track-card-difficulty',
  '.track-card-airport .track-card-difficulty',
  '.track-card-cliffside .track-card-difficulty',
  '.track-card-harbor .track-card-difficulty',
  '.track-card-midnight-city .track-card-difficulty',
  '.track-card-locked .track-card-difficulty'
]) {
  assert.ok(semantic.includes(difficultyContract), `Missing difficulty contract ${difficultyContract}`);
}

assert.match(homeFeedback, /Visually a text link; semantically a button because it opens a dialog/);
assert.match(homeFeedback, /\.m8-home-fixed-layout \.m8-about-trigger[\s\S]*appearance: none/);
assert.match(homeFeedback, /text-decoration: underline/);

for (const section of ['audit', 'colour', 'patterns', 'screens', 'migration']) {
  assert.match(design, new RegExp(`id="${section}"`));
  assert.match(design, new RegExp(`href="#${section}"`));
}

for (const colourLayer of ['primitive-palette', 'semantic-mappings', 'compatibility-aliases']) {
  assert.match(design, new RegExp(`id="${colourLayer}"`));
}

for (const decision of [
  'Primitive palette',
  'Semantic variables and mappings',
  'Compatibility aliases',
  'Primary action',
  'Social share',
  'Game handoff',
  'Racer identity',
  'Utility',
  'Navigation',
  'Easy green 200, Medium yellow 200, Hard red 200',
  'Form controls',
  'Disclosure',
  'ABOUT TURN is visually a link but semantically a button',
  'Install TURN',
  'Race this track',
  'Race this car',
  'Share Your Turn',
  'Get the Game',
  'Settings',
  'How to Play',
  'Give Feedback',
  'Race Again',
  'Leave race',
  'Close',
  'Gas',
  'Drift',
  'Boost',
  'Brake · Reverse'
]) {
  assert.ok(design.toLocaleLowerCase('en').includes(decision.toLocaleLowerCase('en')), `Missing design decision ${decision}`);
}

assert.match(design, /Colour reinforces progression but never replaces the label/);
assert.match(design, /Colour follows stable join order\. A faster lap may change race rank, but never the racer’s social colour\./);
assert.match(design, /Name is required before sharing/);
assert.match(design, /stable racer ID carries identity through a challenge chain/);
assert.match(design, /selected track record and inside a new-personal-best result/);

for (const page of [
  'TURN install page design specimen',
  'TURN Home and track-selection design specimen',
  'TURN The Lot design specimen',
  'TURN race HUD and control design specimen',
  'YOUR TURN social challenge design specimen',
  'TURN How to Play dialog design specimen'
]) {
  assert.match(design, new RegExp(page));
}
for (const placeholder of ['TRACK PREVIEW', '3D CAR VIEW', 'GAME VIEW']) {
  assert.ok(design.includes(placeholder), `Missing labelled content area ${placeholder}`);
}
assert.doesNotMatch(design, /car-shape|track-preview-sample|race-road/);
assert.match(design, /Actual components, not substitute illustrations\./);
assert.match(design, /Core game and social challenge patterns are represented\./);
assert.match(design, /Social challenge semantics: active\./);
assert.match(design, /class="skip-link" href="#main"/);
assert.match(design, /aria-label="Design system sections"/);
assert.match(design, /@media \(prefers-reduced-motion: reduce\)/);

const releaseDefinition = JSON.parse(release);
assert.match(index, new RegExp(`TURN v${escapeRegex(releaseDefinition.version)} · Build ${escapeRegex(releaseDefinition.id)}`));
assert.match(index, new RegExp(`version: '${escapeRegex(releaseDefinition.version)}'`));
assert.match(index, new RegExp(`id: '${escapeRegex(releaseDefinition.id)}'`));
assert.match(index, new RegExp(`cacheKey: '${escapeRegex(releaseDefinition.cacheKey)}'`));
assert.match(design, new RegExp(`TURN V${escapeRegex(releaseDefinition.version)} · BUILD ${escapeRegex(releaseDefinition.id.toUpperCase())}`));
assert.doesNotMatch(design, /TURN V1\.4\.0|2026\.08\.03-R126/,
  'The living design reference must not present a stale release as current metadata');

console.log('TURN 1.6 primitive palette, social challenge semantics, mappings and component reference passed.');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

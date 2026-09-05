import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [design, dialogs, referenceCss, tokens, semantic, releaseSource, index] = await Promise.all([
  fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-dialogs.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-reference.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-tokens.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-semantic.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);

for (const page of [design, dialogs]) {
  assert.match(page, /^<!doctype html>/i);
  assert.match(page, /<html lang="en">/);
  assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.doesNotMatch(page, /user-scalable=no/);
  assert.doesNotMatch(page, /<script\b/i, 'Design references must remain static');
  assert.doesNotMatch(page, /https?:\/\//i, 'Design references must remain dependency-free');
  assert.match(page, /href="\.\/design-tokens\.css\?revision=r162-social-sharing"/);
  assert.match(page, /href="\.\/design-semantic\.css\?revision=r162-social-sharing"/);
  assert.match(page, /href="\.\/design-reference\.css\?revision=r204-current-product-language"/);
  assert.match(page, /class="system-toolbar" aria-label="Design reference pages"/);
  assert.match(page, />Design system<\/a>[\s\S]*>Dialogs<\/a>[\s\S]*>Open TURN<\/a>/);
  assert.match(page, /href="\.\/" target="_blank" rel="noopener">Open TURN<\/a>/,
    'Open TURN must use a fresh browsing context');
  assert.match(page, new RegExp(`TURN ${escapeRegex(release.version)}`),
    'Current design references must identify the canonical production release');
  assert.match(page, new RegExp(`Build ${escapeRegex(release.id)}`, 'i'),
    'Current design references must identify the canonical production build');
}

assert.match(design, /href="\.\/design\.html" aria-current="page">Design system<\/a>/);
assert.match(dialogs, /href="\.\/design-dialogs\.html" aria-current="page">Dialogs<\/a>/);
assert.match(design, /Current product language · September 2026/);
assert.match(design, /Built from the game, not beside it\./);
assert.match(design, /what the shipped game actually does today instead of presenting an aspirational concept board/);
assert.doesNotMatch(design, /Normative production system · TURN 1\.7/);
assert.doesNotMatch(design, /TURN V1\.7\.0 · BUILD 2026\.08\.09-R163/);
assert.doesNotMatch(design, /TRACK PREVIEW|3D CAR VIEW|Actual components, not substitute illustrations/,
  'The current reference must use real structural specimens instead of the old placeholder-board vocabulary');

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
  assert.ok(design.includes(`<code>${token}</code>`), `Missing visible primitive variable ${token}`);
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
  ['--turn-difficulty-advanced', '--turn-orange-200'],
  ['--turn-difficulty-expert', '--turn-red-200'],
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
  assert.ok(design.includes(`<code>var(${primitiveToken})</code>`), `Missing visible semantic mapping ${semanticToken}`);
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
  '--turn-border-micro', '--turn-border-compact', '--turn-border-default', '--turn-border-heavy',
  '--turn-radius-micro', '--turn-radius-compact', '--turn-radius-default', '--turn-radius-hero',
  '--turn-radius-pill', '--turn-radius-circle', '--turn-shadow-compact', '--turn-shadow-default', '--turn-shadow-hero'
]) {
  assert.ok(tokens.includes(token), `Missing geometry or elevation token ${token}`);
}

assert.match(semantic, /@import url\('\.\/design-tokens\.css\?revision=r162-social-sharing'\)/);
assert.match(semantic, /\.install-primary,[\s\S]*\.m8-home-fixed-layout \.m8-track-continue,[\s\S]*\.track-select-continue,[\s\S]*\.lot-race/);
assert.match(semantic, /\.drive-drift-zone,[\s\S]*var\(--turn-control-drift\)/);
assert.match(semantic, /\.drive-pad \.drive-gas-zone,[\s\S]*var\(--turn-control-gas\)/);
assert.match(semantic, /\.drive-pad \.drive-brake-zone,[\s\S]*var\(--turn-control-brake\)/);
assert.match(semantic, /\.drive-boost-zone[\s\S]*var\(--turn-control-boost\)[\s\S]*var\(--turn-control-boost-empty\)/);

for (const section of ['principles', 'foundations', 'components', 'gameplay', 'progression', 'layouts', 'accessibility', 'legacy']) {
  assert.match(design, new RegExp(`id="${section}"`));
  assert.match(design, new RegExp(`href="#${section}"`));
}
for (const colourLayer of ['primitive-palette', 'semantic-mappings', 'compatibility-aliases']) {
  assert.match(design, new RegExp(`id="${colourLayer}"`));
}

for (const decision of [
  'Race this track', 'Settings', 'How to play', 'Achievements', 'Leave race',
  'Easy', 'Medium', 'Advanced', 'Expert', 'Locked',
  'Device steering', 'On-screen steering', 'Left-handed layout', 'Drive By Ear',
  'Drift Points', 'Drift', 'Boost', 'Gas', 'Brake · Reverse', 'Lock', 'Shift',
  'Scorekeeper paper', 'Trophy Road is a literal road now', 'START', 'FINISH',
  'Vehicle', 'Feature / perk', 'Scoring', 'The Lot', 'SPORTS CAR',
  'Screen reader', 'Blank screen', 'Reduced motion'
]) {
  assert.ok(design.toLocaleLowerCase('en').includes(decision.toLocaleLowerCase('en')), `Missing current design decision ${decision}`);
}

assert.match(design, /Colour reinforces progression but never replaces the label/);
assert.match(design, /Social racer colour follows stable join order\. A faster lap may change race rank, but never the racer’s social colour\./);
assert.match(design, /Vehicle[\s\S]*blue-100 → blue-500/);
assert.match(design, /Track[\s\S]*green-200 → green-500/);
assert.match(design, /Feature \/ perk[\s\S]*yellow-100 → yellow-400/);
assert.match(design, /Scoring[\s\S]*pink-100 → pink-200/);
assert.match(design, /Locked perks stay still/);
assert.match(design, /selecting a car with an active perk gives the short confirmation wiggle/);
assert.match(design, /reward detail can close on outside click/i);
assert.match(design, /orange close control/i);

assert.match(referenceCss, /\.system-header[\s\S]*background: var\(--turn-yellow-600\)/,
  'The reference itself must use the current solid yellow Home-header language');
assert.match(referenceCss, /\.system-toolbar[\s\S]*background: var\(--turn-blue-300\)/);
assert.match(referenceCss, /\.button-sample\.primary[\s\S]*background: var\(--turn-action-primary\)/);
assert.match(referenceCss, /\.dialog-demo__close[\s\S]*background: var\(--turn-orange-500\)/);
assert.match(referenceCss, /\.drive-demo__drift[\s\S]*var\(--turn-control-drift\)/);
assert.match(referenceCss, /\.drive-demo__boost[\s\S]*var\(--turn-control-boost\)/);
assert.match(referenceCss, /\.drive-demo__gas[\s\S]*var\(--turn-control-gas\)/);
assert.match(referenceCss, /\.drive-demo__brake[\s\S]*var\(--turn-control-brake\)/);
assert.match(referenceCss, /\.score-row\.flow \.score-gauge i[\s\S]*var\(--turn-pink-500\)/);
assert.match(referenceCss, /\.reward-tile\.vehicle\.locked[\s\S]*var\(--turn-blue-100\)/);
assert.match(referenceCss, /\.reward-tile\.scoring\.unlocked[\s\S]*var\(--turn-pink-200\)/);
assert.match(referenceCss, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(dialogs, /TURN dialogs/i);
assert.match(dialogs, /Standardize the shell, not the content\./);
assert.match(dialogs, /Production dialog inventory/);
assert.match(dialogs, /About TURN/);
assert.match(dialogs, /Development history &amp; changelog/);
assert.match(dialogs, /Drive By Ear 101 introduction/);
assert.match(dialogs, /Motion access denied/);
assert.match(dialogs, /In-race audio settings/);
assert.match(dialogs, /Compact[\s\S]*Standard[\s\S]*Wide[\s\S]*Reader/);
assert.match(dialogs, /Do not stack modal dialogs/);
assert.match(dialogs, /Focus the heading first/);
assert.match(dialogs, /Return focus/);
assert.match(dialogs, /Contain scrolling/);

assert.match(index, new RegExp(`TURN v${escapeRegex(release.version)} · Build ${escapeRegex(release.id)}`));
assert.match(index, new RegExp(`version: '${escapeRegex(release.version)}'`));
assert.match(index, new RegExp(`id: '${escapeRegex(release.id)}'`));
assert.match(index, new RegExp(`cacheKey: '${escapeRegex(release.cacheKey)}'`));

console.log('TURN current product-language design system, palette, gameplay, progression and dialog reference passed.');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

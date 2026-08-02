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
assert.match(design, /href="\.\/design-tokens\.css\?revision=r140-difficulty-system"/);
assert.match(design, /href="\.\/design-semantic\.css\?revision=r140-difficulty-system"/);

for (const token of [
  '--turn-ink',
  '--turn-paper',
  '--turn-yellow-600',
  '--turn-yellow-400',
  '--turn-yellow-200',
  '--turn-blue-500',
  '--turn-blue-300',
  '--turn-pink-500',
  '--turn-red-500',
  '--turn-red-200',
  '--turn-green-500',
  '--turn-green-200',
  '--turn-orange-500',
  '--turn-action-primary',
  '--turn-action-utility',
  '--turn-action-danger',
  '--turn-action-navigation',
  '--turn-difficulty-easy',
  '--turn-difficulty-medium',
  '--turn-difficulty-hard',
  '--turn-difficulty-locked',
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
  assert.ok(tokens.includes(token), `Missing design token ${token}`);
}

for (const mapping of [
  '--turn-difficulty-easy: var(--turn-green-200)',
  '--turn-difficulty-medium: var(--turn-yellow-200)',
  '--turn-difficulty-hard: var(--turn-red-200)',
  '--turn-difficulty-locked: var(--turn-muted)',
  '--turn-control-gas: var(--turn-green-500)',
  '--turn-control-drift: var(--turn-blue-500)',
  '--turn-control-boost: var(--turn-yellow-400)',
  '--turn-control-brake: var(--turn-orange-500)'
]) {
  assert.ok(tokens.includes(mapping), `Missing semantic mapping ${mapping}`);
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
  assert.ok(tokens.includes(alias), `Missing compatibility alias ${alias}`);
}

assert.match(semantic, /^@import url\('\.\/design-tokens\.css\?revision=r140-difficulty-system'\);/);
assert.match(semantic, /\.install-primary,[\s\S]*\.m8-home-fixed-layout \.m8-track-continue,[\s\S]*\.track-select-continue,[\s\S]*\.lot-race/);
assert.match(semantic, /border-radius: var\(--turn-radius-pill\) !important;/);
assert.match(semantic, /background: var\(--turn-action-primary\) !important;/);
assert.match(semantic, /\.m8-home-fixed-layout \.m8-home-settings,[\s\S]*\.m8-how-button,[\s\S]*\.m8-feedback-button/);
assert.match(semantic, /background: var\(--turn-action-utility\) !important;/);

for (const difficultyContract of [
  '.track-card-countryside .track-card-difficulty',
  '.track-card-airport .track-card-difficulty',
  '.track-card-cliffside .track-card-difficulty',
  '.track-card-harbor .track-card-difficulty',
  '.track-card-midnight-city .track-card-difficulty',
  '.track-card-locked .track-card-difficulty',
  'background: var(--turn-difficulty-easy) !important',
  'background: var(--turn-difficulty-medium) !important',
  'background: var(--turn-difficulty-hard) !important',
  'background: var(--turn-difficulty-locked) !important'
]) {
  assert.ok(semantic.includes(difficultyContract), `Missing difficulty contract ${difficultyContract}`);
}

for (const navigationSelector of [
  '.install-close',
  '.track-select-close',
  '.lot-back',
  '.lot-view-close',
  '.lot-stats-dialog-close',
  '.spectate-close',
  '.sound-guide-close',
  '.m8-dialog-head > button',
  '.back-to-lot-button'
]) {
  assert.ok(semantic.includes(navigationSelector), `Missing navigation selector ${navigationSelector}`);
}
assert.match(semantic, /background: var\(--turn-action-navigation\) !important;/);

assert.match(homeFeedback, /^@import url\('\.\/design-semantic\.css\?revision=r140-difficulty-system'\);/);
assert.match(homeFeedback, /Visually a text link; semantically a button because it opens a dialog/);
assert.match(homeFeedback, /\.m8-home-fixed-layout \.m8-about-trigger[\s\S]*appearance: none;/);
assert.match(homeFeedback, /box-shadow: none !important;/);
assert.match(homeFeedback, /transform: none !important;/);
assert.match(homeFeedback, /text-decoration: underline;/);
assert.match(homeFeedback, /\.m8-home-fixed-layout \.m8-about-trigger:focus-visible/);

for (const section of ['audit', 'colour', 'patterns', 'screens', 'migration']) {
  assert.match(design, new RegExp(`id="${section}"`));
  assert.match(design, new RegExp(`href="#${section}"`));
}

for (const decision of [
  'Primary action',
  'Utility',
  'Navigation',
  'Easy green 200, Medium yellow 200, Hard red 200',
  'ABOUT TURN is visually a link but semantically a button',
  'Install TURN',
  'Race this track',
  'Race this car',
  'Settings',
  'How to Play',
  'Give Feedback',
  'Brake · Reverse'
]) {
  assert.ok(design.includes(decision), `Missing normative decision or specimen: ${decision}`);
}

for (const difficulty of ['Easy', 'Medium', 'Hard', 'Locked']) {
  assert.match(design, new RegExp(`class="difficulty ${difficulty.toLowerCase()}"[^>]*>${difficulty}<`));
}
assert.match(design, /Colour reinforces progression but never replaces the label/);

for (const page of [
  'TURN install page design specimen',
  'TURN Home and track-selection design specimen',
  'TURN The Lot design specimen',
  'TURN race HUD and control design specimen',
  'TURN How to Play dialog design specimen'
]) {
  assert.match(design, new RegExp(page));
}

for (const placeholder of ['TRACK PREVIEW', '3D CAR VIEW', 'GAME VIEW']) {
  assert.ok(design.includes(placeholder), `Missing labelled content area ${placeholder}`);
}
assert.doesNotMatch(design, /car-shape|track-preview-sample|race-road/);
assert.match(design, /Actual components, not substitute illustrations\./);
assert.match(design, /The first two migration steps are live\./);
assert.match(design, /class="skip-link" href="#main"/);
assert.match(design, /aria-label="Design system sections"/);
assert.match(design, /@media \(prefers-reduced-motion: reduce\)/);

const releaseDefinition = JSON.parse(release);
assert.deepEqual(releaseDefinition, {
  version: '1.3.1',
  id: '2026.08.02-r123',
  cacheKey: '20260802-r123'
});
assert.match(index, /TURN v1\.3\.1 · Build 2026\.08\.02-r123/);
assert.match(index, /version: '1\.3\.1'/);
assert.match(index, /id: '2026\.08\.02-r123'/);
assert.match(index, /cacheKey: '20260802-r123'/);
assert.match(design, /TURN V1\.3\.1 · BUILD 2026\.08\.02-R123/);

console.log('TURN difficulty, About metadata, semantic roles and current release reference passed.');

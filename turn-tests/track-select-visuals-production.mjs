import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';

const [index, releaseSource, postcardCss, depthCss, runwayCss, chooserSource] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/track-select-r77.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/track-select-r78.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/track-select-r79.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/track-select.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const tracks = Object.fromEntries(TRACK_DEFINITIONS.map((track) => [track.id, track]));

assert.equal(tracks.countryside.accent, '#ff4fa3', 'Countryside keeps its established pink identity');
assert.equal(tracks.airport.accent, '#ffd43b', 'Airport keeps its established runway-yellow identity');
assert.equal(tracks.cliffside.accent, '#26c7c3', 'Cliffside keeps its blue-green ocean identity');
assert.equal(tracks.harbor.accent, '#ff8f3d', 'Harbor needs a distinct rust-orange dock identity');
assert.equal(tracks['midnight-city'].accent, '#9d7cff', 'Midnight City keeps its established violet identity');
assert.equal(tracks.harbor.difficulty, 'HARD');
assert.equal(new Set(TRACK_DEFINITIONS.map((track) => track.accent)).size, TRACK_DEFINITIONS.length, 'Every playable track needs a distinct accent');

for (const track of TRACK_DEFINITIONS) {
  assert.ok(contrastRatio(track.accent, '#08090a') >= 4.5, `${track.name} accent must keep black text at WCAG AA contrast`);
}

for (const stylesheet of ['track-select-r77.css', 'track-select-r78.css', 'track-select-r79.css']) {
  assert.match(
    index,
    new RegExp(`${stylesheet.replace('.', '\\.')}\\?build=${release.cacheKey}`),
    `Production must load ${stylesheet} through the current release cache key`
  );
}
assert.match(postcardCss, /\.track-card-countryside[\s\S]*--track-card-paper: #f7dce7/);
assert.match(postcardCss, /\.track-card-airport[\s\S]*--track-card-paper: #fff4c7/);
assert.match(postcardCss, /\.track-card-cliffside[\s\S]*--track-card-paper: #d5f3ef/);
assert.match(postcardCss, /\.track-card-harbor[\s\S]*--track-card-paper: #f9e2d2/);
assert.match(
  postcardCss,
  /\.track-card-midnight-city[\s\S]*--track-card-paper: #e3dcff[\s\S]*--track-card-fold: #cfc2f4/,
  'Unselected Midnight City must have a visible pastel violet card rather than inheriting the blue page background'
);
assert.match(postcardCss, /\.track-card-preview::after[\s\S]*repeating-linear-gradient/, 'Every preview gets the small track-coloured curb motif');
assert.match(postcardCss, /\.track-card-cliffside \.track-card-preview[\s\S]*#4ba8c8/, 'Cliffside preview must retain visible ocean blue');
assert.match(postcardCss, /\.track-card-harbor \.track-card-preview[\s\S]*#287f9f/, 'Harbor preview must retain visible quay water');
assert.match(postcardCss, /\.track-card-harbor \.track-card-preview[\s\S]*#c95b35[\s\S]*#167b82[\s\S]*#f5c542/, 'Harbor postcard must read as a colourful container yard');

const countrysideDepth = depthCss.match(/\.track-card-countryside \.track-card-preview \{([\s\S]*?)\n\}/)?.[1] || '';
const firstHill = countrysideDepth.indexOf('radial-gradient(ellipse');
const sun = countrysideDepth.indexOf('radial-gradient(circle');
assert.ok(firstHill >= 0 && sun > firstHill, 'Countryside hills must paint above the sun so the sun sits behind the landscape');
assert.match(depthCss, /\.track-card-airport \.track-card-preview::before[\s\S]*content: "27"/, 'Airport must keep a recognizable runway number');
assert.match(runwayCss, /left: -8%;[\s\S]*bottom: 3%;[\s\S]*transform: rotate\(-8deg\)/, 'Airport runway must travel diagonally from the lower left across the foreground');
assert.match(runwayCss, /width: 105%;[\s\S]*height: 20%/, 'Airport runway must stay shallow enough to finish below the terminal');
assert.match(runwayCss, /repeating-linear-gradient\([\s\S]*90deg/, 'Airport runway must retain a dashed centre line along its new direction');
assert.match(runwayCss, /inset 0 4px 0 #f3d34a[\s\S]*inset 0 -4px 0 #f3d34a/, 'Airport runway must retain yellow edge markings');
assert.doesNotMatch(`${postcardCss}\n${depthCss}\n${runwayCss}`, /@keyframes|animation(?:-name)?:/, 'Track postcards must add no looping or distracting motion');

assert.match(chooserSource, /card\.setAttribute\('aria-pressed', String\(selected\)\)/, 'Selection remains programmatically exposed');
assert.match(chooserSource, /CONTINUE TO \$\{track\?\.name\.toUpperCase\(\)/, 'Continue copy remains the explicit textual confirmation');
assert.match(chooserSource, /track-card-choice-marker/, 'The radio-style marker remains the extra visual choice indicator');

console.log(`TURN ${release.id} five distinct track palettes and readable postcard previews passed.`);

function contrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

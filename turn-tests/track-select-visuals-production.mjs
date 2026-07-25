import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';

const [index, releaseSource, postcardCss, depthCss, chooserSource] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/track-select-r77.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/track-select-r78.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/track-select.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const tracks = Object.fromEntries(TRACK_DEFINITIONS.map((track) => [track.id, track]));

assert.equal(tracks.countryside.accent, '#ff4fa3', 'Countryside keeps its established pink identity');
assert.equal(tracks.airport.accent, '#ffd43b', 'Airport keeps its established runway-yellow identity');
assert.equal(tracks.cliffside.accent, '#26c7c3', 'Cliffside must use its new blue-green ocean identity');
assert.equal(tracks.cliffside.accentSoft, '#bcefeb');
assert.equal(new Set(TRACK_DEFINITIONS.map((track) => track.accent)).size, TRACK_DEFINITIONS.length, 'Every playable track needs a distinct accent');

for (const track of TRACK_DEFINITIONS) {
  assert.ok(contrastRatio(track.accent, '#08090a') >= 4.5, `${track.name} accent must keep black text at WCAG AA contrast`);
}

for (const stylesheet of ['track-select-r77.css', 'track-select-r78.css']) {
  assert.match(
    index,
    new RegExp(`${stylesheet.replace('.', '\\.')}\\?build=${release.cacheKey}`),
    `Production must load ${stylesheet} through the current release cache key`
  );
}
assert.match(postcardCss, /\.track-card-countryside[\s\S]*--track-card-paper: #f7dce7/);
assert.match(postcardCss, /\.track-card-airport[\s\S]*--track-card-paper: #fff4c7/);
assert.match(postcardCss, /\.track-card-cliffside[\s\S]*--track-card-paper: #d5f3ef/);
assert.match(postcardCss, /\.track-card-preview::after[\s\S]*repeating-linear-gradient/, 'Every preview gets the small track-coloured curb motif');
assert.match(postcardCss, /\.track-card-cliffside \.track-card-preview[\s\S]*#4ba8c8/, 'Cliffside preview must retain visible ocean blue');
assert.match(postcardCss, /\.track-card-locked \.track-card-preview[\s\S]*repeating-linear-gradient/, 'The future slot keeps a quiet blueprint texture');

const countrysideDepth = depthCss.match(/\.track-card-countryside \.track-card-preview \{([\s\S]*?)\n\}/)?.[1] || '';
const firstHill = countrysideDepth.indexOf('radial-gradient(ellipse');
const sun = countrysideDepth.indexOf('radial-gradient(circle');
assert.ok(firstHill >= 0 && sun > firstHill, 'Countryside hills must paint above the sun so the sun sits behind the landscape');
assert.match(depthCss, /\.track-card-airport \.track-card-preview::before[\s\S]*content: "27"/, 'Airport must show a recognizable runway number');
assert.match(depthCss, /\.track-card-airport \.track-card-preview::before[\s\S]*clip-path: polygon\(42% 0, 58% 0, 100% 100%, 0 100%\)/, 'Airport runway must use clear perspective');
assert.match(depthCss, /\.track-card-airport \.track-card-preview::before[\s\S]*repeating-linear-gradient/, 'Airport runway must include a dashed centre line');
assert.doesNotMatch(`${postcardCss}\n${depthCss}`, /@keyframes|animation(?:-name)?:/, 'The visual refresh must add no looping or distracting motion');

assert.match(chooserSource, /card\.setAttribute\('aria-pressed', String\(selected\)\)/, 'Selection remains programmatically exposed');
assert.match(chooserSource, /CONTINUE TO \$\{track\?\.name\.toUpperCase\(\)/, 'Continue copy remains the explicit textual confirmation');
assert.match(chooserSource, /track-card-choice-marker/, 'The existing radio-style marker remains the only extra visual choice indicator');

console.log(`TURN ${release.id} distinct track palette and readable postcard previews passed.`);

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

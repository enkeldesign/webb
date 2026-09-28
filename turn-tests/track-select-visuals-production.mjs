import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';

const [
  index,
  releaseSource,
  trackSelectCss,
  roadbookSource,
  appSource,
  chooserSource
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/track-select.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/roadbook/roadbook.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/track-select.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const layer = (revision) => {
  const marker = `/* ==== Layer ${revision} `;
  const start = trackSelectCss.indexOf(marker);
  assert.ok(start >= 0, `track-select.css must keep its ${revision} layer`);
  const end = trackSelectCss.indexOf('/* ==== Layer ', start + marker.length);
  return trackSelectCss.slice(start, end < 0 ? undefined : end);
};
const postcardCss = layer('r77');
const depthCss = layer('r78');
const runwayCss = layer('r79');
const tracks = Object.fromEntries(TRACK_DEFINITIONS.map((track) => [track.id, track]));

assert.equal(tracks.countryside.accent, '#ff4fa3', 'Countryside keeps its established pink identity');
assert.equal(tracks.airport.accent, '#ffd43b', 'Airport keeps its established runway-yellow identity');
assert.equal(tracks.cliffside.accent, '#26c7c3', 'Cliffside keeps its blue-green ocean identity');
assert.equal(tracks.harbor.accent, '#ff8f3d', 'Harbor needs a distinct rust-orange dock identity');
assert.equal(tracks['midnight-city'].accent, '#9d7cff', 'Midnight City keeps its established violet identity');
assert.equal(tracks.mountain.accent, '#4dabf7', 'Mountain keeps its established alpine-blue identity');
assert.equal(tracks.beachfront.accent, '#25b97a', 'Beachfront keeps its tropical green identity');
assert.equal(tracks['dead-canyon'].accent, '#e5404f', 'Dead Canyon keeps its badlands red identity');
assert.equal(tracks.cliffside.difficulty, 'EASY');
assert.equal(tracks.beachfront.difficulty, 'MEDIUM');
assert.equal(tracks.harbor.difficulty, 'ADVANCED');
assert.equal(tracks['dead-canyon'].difficulty, 'ADVANCED');
assert.equal(tracks['midnight-city'].difficulty, 'EXPERT');
assert.equal(tracks.mountain.difficulty, 'EXPERT');
assert.equal(new Set(TRACK_DEFINITIONS.map((track) => track.accent)).size, TRACK_DEFINITIONS.length, 'Every playable track needs a distinct accent');

for (const track of TRACK_DEFINITIONS) {
  assert.ok(contrastRatio(track.accent, '#08090a') >= 4.5, `${track.name} accent must keep black text at WCAG AA contrast`);
}

assert.match(
  index,
  new RegExp(`track-select\\.css\\?build=${release.cacheKey}`),
  'Production must load the consolidated track-select.css through the current release cache key'
);
assert.doesNotMatch(index, /track-select-r\d+\.css/, 'Track chooser styles must stay consolidated in track-select.css');
assert.match(postcardCss, /\.track-card-countryside[\s\S]*--track-card-paper: #f7dce7/);
assert.match(postcardCss, /\.track-card-airport[\s\S]*--track-card-paper: #fff4c7/);
assert.match(postcardCss, /\.track-card-cliffside[\s\S]*--track-card-paper: #d5f3ef/);
assert.match(postcardCss, /\.track-card-harbor[\s\S]*--track-card-paper: #f9e2d2/);
assert.match(
  postcardCss,
  /\.track-card-midnight-city[\s\S]*--track-card-paper: #e3dcff[\s\S]*--track-card-fold: #cfc2f4/,
  'Unselected Midnight City must have a visible pastel violet card rather than inheriting the blue page background'
);
assert.match(
  postcardCss,
  /\.track-card-mountain[\s\S]*--track-card-paper: #d7efff[\s\S]*--track-card-fold: #b9dced/,
  'Unselected Mountain must use a light alpine-blue paper and the same folded-corner treatment as the other tracks'
);
assert.match(postcardCss, /\.track-card-beachfront \{[\s\S]*--track-card-paper: #d8f6dc/,
  'Unselected Beachfront gets a pale green postcard');
assert.match(postcardCss, /\.track-card-dead-canyon \{[\s\S]*--track-card-paper: #f3a0a8[\s\S]*--track-card-fold: #d96874/,
  'Unselected Dead Canyon stays clearly red, distinct from Countryside pink');
assert.match(postcardCss, /\.track-card-beachfront \.track-card-preview \{[\s\S]*#2fc1c8[\s\S]*#f1d99a/,
  'Beachfront postcard reads as turquoise sea and sand beach');
assert.match(postcardCss, /\.track-card-beachfront \.track-card-preview::before[\s\S]*#2f9d5c[\s\S]*#5c3f2a/,
  'Beachfront postcard carries palms behind the route map');
assert.match(postcardCss, /\.track-card-dead-canyon \.track-card-preview::before[\s\S]*#b44a3c[\s\S]*#8f3a33/,
  'Dead Canyon postcard carries stepped red mesas behind the route map');
assert.match(postcardCss, /\.track-card-preview::after[\s\S]*repeating-linear-gradient/, 'Every preview gets the small track-coloured curb motif');
assert.match(postcardCss, /\.track-card-cliffside \.track-card-preview[\s\S]*#4ba8c8/, 'Cliffside preview must retain visible ocean blue');
assert.match(postcardCss, /\.track-card-harbor \.track-card-preview[\s\S]*#287f9f/, 'Harbor preview must retain visible quay water');
assert.match(postcardCss, /\.track-card-harbor \.track-card-preview[\s\S]*#c95b35[\s\S]*#167b82[\s\S]*#f5c542/, 'Harbor postcard must read as a colourful container yard');
assert.match(
  postcardCss,
  /\.track-card-mountain \.track-card-preview \{[\s\S]*radial-gradient\(circle at 18% 20%, #fff8e8[\s\S]*#101832[\s\S]*#1c2c42/,
  'Mountain must have its own moonlit night background behind the route map'
);
assert.match(
  postcardCss,
  /\.track-card-mountain \.track-card-preview::before[\s\S]*#e1edf5[\s\S]*#516a82[\s\S]*#405a72[\s\S]*#263b50/,
  'Mountain must have layered snow-capped alpine silhouettes behind the route map'
);
assert.match(
  postcardCss,
  /\.track-card-mountain \.track-preview-road[\s\S]*stroke: #738797/,
  'Mountain road geometry must remain readable against the dark postcard background'
);

const countrysideDepth = depthCss.match(/\.track-card-countryside \.track-card-preview \{([\s\S]*?)\n\}/)?.[1] || '';
const firstHill = countrysideDepth.indexOf('radial-gradient(ellipse');
const sun = countrysideDepth.indexOf('radial-gradient(circle');
assert.ok(firstHill >= 0 && sun > firstHill, 'Countryside hills must paint above the sun so the sun sits behind the landscape');
assert.match(depthCss, /\.track-card-airport \.track-card-preview::before[\s\S]*content: "27"/, 'Airport must keep a recognizable runway number');
assert.match(runwayCss, /left: -8%;[\s\S]*bottom: 3%;[\s\S]*transform: rotate\(-8deg\)/, 'Airport runway must travel diagonally from the lower left across the foreground');
assert.match(runwayCss, /width: 105%;[\s\S]*height: 20%/, 'Airport runway must stay shallow enough to finish below the terminal');
assert.match(runwayCss, /repeating-linear-gradient\([\s\S]*90deg/, 'Airport runway must retain a dashed centre line along its new direction');
assert.match(runwayCss, /inset 0 3px 0 #f3d34a[\s\S]*inset 0 -3px 0 #f3d34a/, 'Airport runway must retain yellow edge markings');

// ROADBOOK draws each track's real route in its own accent; the Home postcards retired
// with the old cards.
assert.doesNotMatch(appSource, /m8-midnight-city-postcard/, 'Home no longer loads the Midnight City postcard');
assert.match(roadbookSource, /style="--turn-pr-accent:\$\{escapeHtml\(track\.accent\)\}"/,
  'Every ROADBOOK route uses its track accent');
assert.match(roadbookSource, /getTrackPreviewPoints\(trackId, 110\)/, 'Routes come from the real track geometry');
assert.doesNotMatch(`${postcardCss}\n${depthCss}\n${runwayCss}`, /@keyframes|animation(?:-name)?:/, 'Track postcards must add no looping or distracting motion');

assert.match(chooserSource, /card\.setAttribute\('aria-pressed', String\(selected\)\)/, 'Selection remains programmatically exposed');
assert.match(chooserSource, /data-track-difficulty=\"\$\{track\.difficulty\.toLowerCase\(\)\}\"/, 'Track chooser must expose the canonical difficulty as data');
assert.match(chooserSource, /aria-label=\"\$\{track\.name\}, \$\{track\.difficulty\} difficulty track\"/, 'Track chooser ARIA must explicitly announce the canonical difficulty');
assert.match(chooserSource, /CONTINUE TO \$\{track\?\.name\.toUpperCase\(\)/, 'Continue copy remains the explicit textual confirmation');
assert.match(chooserSource, /track-card-choice-marker/, 'The radio-style marker remains the extra visual choice indicator');

console.log(`TURN ${release.id} six distinct track palettes and readable postcard previews passed.`);

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

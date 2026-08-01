import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [app, guide, css, homeReset, rivalStorage] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-how-to-play-r126.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-rival-reset.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/rival-storage.js', import.meta.url), 'utf8')
]);

assert.match(app, /installStylesheet\('\.\/m8-how-to-play-r126\.css', 'data-turn-m8-how-to-play'\)/);
assert.match(app, /how-to-play-guide\.js\?revision=r126-dbe-disclosure/);
assert.match(app, /installHowToPlayGuide\(\)/);
assert.match(app, /home-rival-reset\.js\?revision=r126-all-tracks/);
assert.match(app, /installHomeRivalReset\(\)/);
assert.ok(
  app.indexOf('await installM8HomeNavigation()') < app.indexOf('installHowToPlayGuide()'),
  'The guide enhancer must run only after the How to Play dialog exists'
);
assert.ok(
  app.indexOf('await installM8HomeNavigation()') < app.indexOf('installHomeRivalReset()'),
  'The all-track reset enhancer must run only after the Home settings dialog exists'
);

assert.match(guide, /Holding <strong>DRIFT<\/strong> also charges <strong>BOOST<\/strong> faster/);
assert.match(guide, /<details class="m8-dbe-guide">/);
assert.match(guide, /<summary>Explore the Drive By Ear sounds<\/summary>/);
assert.match(guide, /Guiding ribbon/);
assert.match(guide, /Pace notes/);
assert.match(guide, /Drift and grip/);
assert.match(guide, /Engine and BOOST/);
assert.match(guide, /Off-road recovery/);
assert.match(guide, /Nearby rivals/);
assert.match(guide, /Wrong way/);
assert.match(guide, /With a screen reader/);
assert.match(guide, /Headphones provide the clearest left and right information/);
assert.match(guide, /complete non-visual play/);

assert.match(guide, /A long corner keeps the same number of beeps but holds the final beep longer/);
assert.match(guide, /bip-beeeep for a long medium corner/);
assert.match(guide, /bip-bip-beeeep for a long tight corner/);
assert.doesNotMatch(guide, /delayed extra beep|extra one-beep group|lengthMarker/);
assert.match(guide, /root\.querySelector\('#dbeGuidePaceNotes'\)/, 'The in-race audio guide must receive the corrected long-corner language too');

assert.match(css, /\.m8-dbe-guide > summary/);
assert.match(css, /cursor: pointer/);
assert.match(css, /summary:focus-visible/);
assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /@media \(max-width: 720px\)[\s\S]*grid-template-columns: 1fr/);
assert.doesNotMatch(`${guide}\n${css}`, /requestAnimationFrame|setInterval|setTimeout|@keyframes|animation:/, 'Help content must add no runtime loop or distracting motion');

assert.match(homeReset, /Remove every recorded personal rival from every track/);
assert.match(homeReset, /To reset only one track, use Settings at that track’s start line/);
assert.match(homeReset, /RESET ALL RIVALS/);
assert.match(homeReset, /resetTarget\.textContent = 'ALL TRACKS'/);
assert.match(homeReset, /clearAllRivalsState/);
assert.match(homeReset, /TRACK_CATALOG\.map\(\(track\) => track\.id\)/);
assert.match(homeReset, /Personal rivals reset on all tracks/);
assert.match(homeReset, /event\.stopImmediatePropagation\(\)/, 'Home must replace the old selected-track reset handlers rather than also running them');
assert.match(homeReset, /delete model\.dataset\.previewKey/, 'Pending BEST thumbnails must not reappear after an all-track reset');
assert.doesNotMatch(homeReset, /activateTrack|__turnResetRivals/, 'Home reset must not cycle the live runtime through every track or reuse the track-specific race action');

assert.match(rivalStorage, /export function clearAllRivalsState\(state, trackIds = \[\]\)/);
assert.match(rivalStorage, /localStorage\.removeItem\(rivalKey\(trackId\)\)/);
assert.match(rivalStorage, /localStorage\.removeItem\(ghostKey\(trackId\)\)/);
assert.match(rivalStorage, /state\.trackId = activeTrackId/, 'An all-track reset must preserve the runtime’s active track');
assert.match(rivalStorage, /syncPrimaryRivalState\(state\)/);

console.log('TURN How to Play, detailed Drive By Ear disclosure and Home all-track rival reset passed.');

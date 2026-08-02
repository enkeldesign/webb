import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [app, guide, css, components, homeReset, resetCss, rivalStorage, trackManager] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-how-to-play-r126.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/settings-components-r141.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-rival-reset.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/rival-reset-context-r127.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/track-manager.js', import.meta.url), 'utf8')
]);

assert.match(app, /m8-how-to-play-r126\.css\?revision=r141-form-disclosure/);
assert.match(app, /settings-components-r141\.css\?revision=r141-form-disclosure/);
assert.match(app, /data-turn-m8-how-to-play/);
assert.match(app, /data-turn-settings-components/);
assert.match(app, /installStylesheet\('\.\/rival-reset-context-r127\.css', 'data-turn-rival-reset-context'\)/);
assert.match(app, /how-to-play-guide\.js\?revision=r141-form-disclosure/);
assert.match(app, /installHowToPlayGuide\(\)/);
assert.match(app, /home-rival-reset\.js\?revision=r127-contextual/);
assert.match(app, /installHomeRivalReset\(\)/);
assert.ok(
  app.indexOf('await installM8HomeNavigation()') < app.indexOf('installHowToPlayGuide()'),
  'The guide enhancer must run only after the How to Play dialog exists'
);
assert.ok(
  app.indexOf('await installM8HomeNavigation()') < app.indexOf('installHomeRivalReset()'),
  'The contextual reset enhancer must run only after the shared Settings dialog exists'
);

assert.match(guide, /GUIDE_VERSION = 'r141-form-disclosure-system'/);
assert.match(guide, /Holding <strong>DRIFT<\/strong> also charges <strong>BOOST<\/strong> faster/);
assert.match(guide, /<details class="m8-dbe-guide">/);
assert.match(
  guide,
  /<summary><span class="m8-disclosure-symbol" aria-hidden="true"><\/span><span>Explore the Drive By Ear sounds<\/span><\/summary>/
);
assert.match(
  guide,
  /<summary><span class="m8-disclosure-symbol" aria-hidden="true"><\/span><span>Explore the Drive By Ear sounds<\/span><\/summary>[\s\S]*<div class="m8-dbe-guide-panel">[\s\S]*<div class="m8-dbe-guide-content">/,
  'Every expanded help section must remain inside one visual disclosure panel'
);
assert.ok(
  guide.indexOf('m8-disclosure-symbol') < guide.indexOf('Explore the Drive By Ear sounds'),
  'The decorative state symbol must be grouped immediately before the summary label'
);
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
assert.match(guide, /Drive By Ear supplies the spatial information needed to steer and stay on course/);
assert.match(guide, /Drive By Ear provides the continuous spatial information/);
assert.match(guide, /root\.querySelector\('#dbeGuideScreenReaders'\)/, 'The in-race guide must replace its abbreviated screen-reader copy before it can be shown');
assert.doesNotMatch(guide, /[;.]\s*DBE\s+(?:supplies|provides)/, 'Player-facing help must always spell out Drive By Ear');

assert.match(guide, /A long corner keeps the same number of beeps but holds the final beep longer/);
assert.match(guide, /bip-beeeep for a long medium corner/);
assert.match(guide, /bip-bip-beeeep for a long tight corner/);
assert.doesNotMatch(guide, /delayed extra beep|extra one-beep group|lengthMarker/);
assert.match(guide, /root\.querySelector\('#dbeGuidePaceNotes'\)/, 'The in-race audio guide must receive the corrected long-corner language too');

assert.match(css, /\.m8-how-dialog[\s\S]*-webkit-text-size-adjust: 100%[\s\S]*text-size-adjust: 100%/, 'Opening details must not trigger iOS text autosizing');
assert.match(css, /\.m8-how-dialog \.m8-dialog-card[\s\S]*overscroll-behavior-y: contain/);
assert.match(css, /scroll-padding-block-end: max\(32px, env\(safe-area-inset-bottom\)\)/);
assert.match(css, /scrollbar-gutter: stable/, 'The dialog width must remain stable when expanded content creates a scrollbar');
assert.match(css, /\.m8-dbe-guide[\s\S]*border: 3px solid[\s\S]*border-radius: 16px[\s\S]*overflow: clip/, 'The summary and expanded content must share one containing card');
assert.match(css, /\.m8-dbe-guide > summary/);
assert.match(css, /cursor: pointer/);
assert.match(css, /\.m8-dbe-guide\[open\] > summary[\s\S]*border-bottom: 3px solid/, 'The expanded panel must stay visibly attached below the summary');
assert.match(css, /summary:focus-visible/);
assert.match(css, /\.m8-dbe-guide-panel[\s\S]*padding: 14px 14px max\(36px, env\(safe-area-inset-bottom\)\)[\s\S]*overflow-anchor: none/, 'The bottom screen-reader card needs settling room without scroll anchoring');
assert.match(css, /\.m8-dbe-guide-content[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.m8-dbe-guide-content p,[\s\S]*font-size: 1rem/, 'Expanded paragraphs keep the same explicit text size');
assert.match(css, /@media \(max-width: 720px\)[\s\S]*grid-template-columns: 1fr/);

assert.match(components, /\.m8-guide-wide[\s\S]*background: var\(--turn-surface-raised\) !important/);
assert.match(components, /\.m8-dbe-guide > summary[\s\S]*background: var\(--turn-disclosure-trigger\)/);
assert.match(components, /\.m8-disclosure-symbol::before[\s\S]*content: '\+'/);
assert.match(components, /\.m8-dbe-guide\[open\] \.m8-disclosure-symbol::before[\s\S]*content: '−'/);
assert.match(components, /\.m8-dbe-guide-panel,[\s\S]*background: var\(--turn-disclosure-panel\)/);
assert.doesNotMatch(components, /#eaf9ef/);
assert.doesNotMatch(`${guide}\n${css}\n${components}`, /setInterval|setTimeout|@keyframes|animation:/, 'Help content must add no runtime loop or distracting motion');

assert.match(homeReset, /function homeIsOpen\(\)/);
assert.match(homeReset, /document\.body\.classList\.contains\('turn-home-open'\)/);
assert.match(homeReset, /const allTracks = homeIsOpen\(\)/);
assert.match(homeReset, /Remove every recorded personal rival from every track/);
assert.match(homeReset, /To reset only one track, use Settings at that track’s start line/);
assert.match(homeReset, /RESET ALL RIVALS/);
assert.match(homeReset, /Remove the recorded personal rivals for \$\{track\.name\}/);
assert.match(homeReset, /Rivals on other tracks will be kept/);
assert.match(homeReset, /resetButton\.textContent = 'RESET RIVALS'/);
assert.match(homeReset, /Remove the saved personal rivals and lap records for \$\{track\.name\}/);
assert.match(homeReset, /clearAllRivalsState/);
assert.match(homeReset, /TRACK_CATALOG\.map\(\(entry\) => entry\.id\)/);
assert.match(homeReset, /globalThis\.__turnResetRivals\?\.\(\)/, 'The race Settings path must use the existing active-track reset only');
assert.match(homeReset, /clearTrackCardRecord\(root, track\.id\)/);
assert.match(homeReset, /Personal rivals reset for \$\{track\.name\}/);
assert.match(homeReset, /raceResetButton\.textContent = 'RESET RIVALS'/);
assert.match(homeReset, /Remove the saved personal rivals and lap records for \$\{track\.name\}/);
assert.match(homeReset, /event\.stopImmediatePropagation\(\)/, 'The contextual handler must replace the old fixed-scope handlers rather than also running them');
assert.match(homeReset, /delete model\.dataset\.previewKey/, 'Pending BEST thumbnails must not reappear after any reset');
assert.doesNotMatch(homeReset, /activateTrack/, 'Resetting rivals must never change tracks behind the player');

assert.match(resetCss, /\.m8-reset-rivals\.is-all-tracks/);
assert.match(resetCss, /#ff9b91/, 'RESET ALL RIVALS must use a light warning red');
assert.match(resetCss, /\.m8-settings-dialog \.m8-reset-rivals,[\s\S]*background: var\(--m8-yellow\) !important/, 'The active-track Settings action must retain the standard yellow treatment');
assert.match(resetCss, /\.utility-group \.reset-rivals-button,[\s\S]*#ffd43b/, 'The direct start-line reset action must also remain yellow');

assert.match(rivalStorage, /export function clearAllRivalsState\(state, trackIds = \[\]\)/);
assert.match(rivalStorage, /localStorage\.removeItem\(rivalKey\(trackId\)\)/);
assert.match(rivalStorage, /localStorage\.removeItem\(ghostKey\(trackId\)\)/);
assert.match(rivalStorage, /state\.trackId = activeTrackId/, 'An all-track reset must preserve the runtime’s active track');
assert.match(rivalStorage, /syncPrimaryRivalState\(state\)/);
assert.match(trackManager, /clearRivalsState\(currentRuntime\.state, \{ trackId: activeTrackId \}\)/, 'The race reset implementation must clear only the current track storage key');
assert.match(trackManager, /globalThis\.__turnResetRivals = resetCurrentTrackRivals/);

console.log('TURN native disclosure help, scroll stability and contextual rival reset passed.');

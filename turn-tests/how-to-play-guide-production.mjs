import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [app, guide, css, components, homeReset, resetCss, rivalStorage, trackManager, scorekeeper] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-how-to-play-r126.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/settings-components-r141.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-rival-reset.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/rival-reset-context-r127.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/scorekeeper-records.js', import.meta.url), 'utf8')
]);

assert.match(app, /m8-how-to-play-r126\.css\?revision=r220-overcharge-disclosure/);
assert.match(app, /settings-components-r141\.css\?revision=r220-overcharge-disclosure/);
assert.match(app, /data-turn-m8-how-to-play/);
assert.match(app, /data-turn-settings-components/);
assert.match(app, /installStylesheet\('\.\/rival-reset-context-r127\.css', 'data-turn-rival-reset-context'\)/);
assert.match(app, /how-to-play-guide\.js\?revision=r220-overcharge-disclosure/);
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

assert.match(guide, /GUIDE_VERSION = 'r222-collapsible-cards'/);
assert.match(guide, /slide between <strong>GAS<\/strong>, <strong>DRIFT<\/strong>, <strong>BOOST<\/strong> and <strong>BRAKE · REVERSE<\/strong>/);
assert.match(guide, /slide outward past it into <strong>LOCK<\/strong>/);
assert.match(guide, /<strong>DRIFT<\/strong> charges <strong>BOOST<\/strong> as you slide/);
assert.match(guide, /With BOOST full, keep using DRIFT to build purple <strong>OVERCHARGE<\/strong>/);
assert.match(guide, /<details class="m8-guide-disclosure m8-overcharge-guide">/);
assert.match(guide, /How to catch and use OVERCHARGE/);
assert.match(guide, /<strong>BUILD<\/strong><span>With BOOST full, keep using DRIFT\.<\/span>/);
assert.match(guide, /<strong>CATCH<\/strong><span>Slide to GAS before OVERCHARGE leaks away\.<\/span>/);
assert.match(guide, /<strong>HOLD<\/strong><span>Stay on GAS to hold the OVERCHARGE you caught\.<\/span>/);
assert.match(guide, /<strong>SPEND<\/strong><span>Slide to BOOST\. OVERCHARGE is spent before normal BOOST\.<\/span>/);
assert.match(guide, /Uncaught OVERCHARGE leaks\. At its peak, it starts leaking even while you keep using DRIFT/);

assert.match(guide, /title: 'SHIFT'/);
assert.match(guide, /normal attributes and the alternate setup you configured in <strong>THE LOT<\/strong>/);
assert.match(guide, /redistributes attribute points — it does not add free power/);
assert.match(guide, /slide from GAS into SHIFT to swap setup, then SHIFT again to return/);
assert.match(guide, /title: 'DRIFT POINTS'/);
assert.match(guide, /DRIFT POINTS<\/strong> reward strong, fast, controlled slides — not pressing DRIFT/);
assert.match(guide, /large live number is the current drift value at risk/);
assert.match(guide, /Link drifts to raise <strong>COMBO<\/strong>/);
assert.match(guide, /clean exit <strong>BANKS<\/strong>/);
assert.match(guide, /<strong>LAP<\/strong> is this lap, <strong>LAST<\/strong> is your previous completed lap and <strong>BEST<\/strong> is the saved record for this track/);
assert.match(guide, /title: 'FLOW POINTS'/);
assert.match(guide, /FLOW POINTS<\/strong> reward useful choreography between systems such as SHIFT, BOOST, DRIFT, LOCK, OVERCHARGE catches and clean exits/);
assert.match(guide, /Button presses alone score nothing/);
assert.match(guide, /Variety and useful timing build <strong>COMBO<\/strong>/);
assert.match(guide, /gauge shows your current FLOW momentum/);

assert.match(guide, /installGuideCardDisclosures\(dialog\)/);
assert.match(guide, /section\.classList\.contains\('m8-guide-wide'\)/,
  'Drive By Ear must remain the one ordinary card with its disclosure inside');
assert.match(guide, /details\.className = 'm8-guide-card-disclosure'/);
assert.match(guide, /summary\.append\(badge, title\)/);
assert.match(guide, /title\.setAttribute\('role', 'heading'\)/);
assert.match(guide, /title\.setAttribute\('aria-level', '3'\)/);
assert.doesNotMatch(guide, /turn:open-how-to-play|installTargetedOpening|__turnOpenHowToPlaySection|TARGET_SECTION_ID/,
  'Removing the scorekeeper info buttons must also remove their deep-link event wiring');

assert.doesNotMatch(scorekeeper, /score-feedback-info|data-score-feedback-help|turn:open-how-to-play|About .* scoring/,
  'The live scorekeeper must stay visually clean and contain no scoring help controls');
assert.doesNotMatch(scorekeeper, /setInterval|setTimeout|requestAnimationFrame/,
  'The scorekeeper record helper must remain event-driven and add no racing-loop work');

assert.match(guide, /<details class="m8-dbe-guide">/);
assert.match(
  guide,
  /<summary><span class="m8-disclosure-symbol" aria-hidden="true"><\/span><span>Explore the Drive By Ear sounds<\/span><\/summary>/
);
assert.match(
  guide,
  /<summary><span class="m8-disclosure-symbol" aria-hidden="true"><\/span><span>Explore the Drive By Ear sounds<\/span><\/summary>[\s\S]*<div class="m8-dbe-guide-panel">[\s\S]*<div class="m8-dbe-guide-content">/,
  'Every expanded Drive By Ear help section must remain inside one visual disclosure panel'
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
assert.match(css, /\.m8-guide-grid section\.m8-guide-card-shell[\s\S]*background: transparent[\s\S]*box-shadow: none/,
  'Ordinary guide sections become neutral grid shells around the disclosure card');
assert.match(css, /\.m8-guide-card-disclosure[\s\S]*border: 4px solid var\(--m8-ink\)[\s\S]*border-radius: 20px[\s\S]*box-shadow: 5px 5px 0 var\(--m8-ink\)/);
assert.match(css, /\.m8-guide-card-disclosure > summary[\s\S]*display: grid[\s\S]*cursor: pointer/);
assert.match(css, /\.m8-guide-card-disclosure\[open\] > summary[\s\S]*border-bottom: 3px solid/);
assert.match(css, /\.m8-guide-card-disclosure > summary::after[\s\S]*content: "\+"/);
assert.match(css, /\.m8-guide-card-disclosure\[open\] > summary::after[\s\S]*content: "−"/);
assert.match(css, /\.m8-guide-card-panel[\s\S]*overflow-anchor: none/);
assert.match(css, /\.m8-dbe-guide[\s\S]*border: 3px solid[\s\S]*border-radius: 16px[\s\S]*overflow: clip/, 'The Drive By Ear summary and expanded content must share one containing card');
assert.match(css, /\.m8-guide-disclosure/,
  'The Overcharge lesson must share the native nested disclosure component without masquerading as Drive By Ear');
assert.match(css, /\.m8-overcharge-steps[\s\S]*display: grid/);
assert.match(css, /\.m8-overcharge-leak[\s\S]*border-top: 2px solid/);
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
assert.match(components, /\.m8-guide-disclosure > summary[\s\S]*background: var\(--turn-disclosure-trigger\)/);
assert.match(components, /\.m8-disclosure-symbol::before[\s\S]*content: '\+'/);
assert.match(components, /\.m8-dbe-guide\[open\] \.m8-disclosure-symbol::before[\s\S]*content: '−'/);
assert.match(components, /\.m8-guide-disclosure\[open\] \.m8-disclosure-symbol::before[\s\S]*content: '−'/);
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

console.log('TURN collapsible How to Play cards, SHIFT/scoring guidance, clean scorekeeper and contextual rival reset passed.');

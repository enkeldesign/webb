import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';

const [
  yourTurnIndex,
  yourTurnControls,
  yourTurnMap,
  yourTurnCss,
  turnIndex,
  turnControls,
  minorUx,
  yourTurnSession
] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/race-controls-r411.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/track-map-r417.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/r411.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/r411-race-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/minor-ux-polish-r229.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/session.js', import.meta.url), 'utf8')
]);

assert.match(yourTurnIndex, /race-controls-r417\.js\?revision=r602\b/);
assert.match(yourTurnIndex, /track-map-r417\.js\?revision=r417/);
assert.match(yourTurnIndex, /r411\.css\?build=\d{8}-r\d+/);
assert.match(turnIndex, /ui\/r411-race-controls\.js\?build=\d{8}-r\d+/,
  'TURN must cache-bust the race-control entry when the active-race controls change');

assert.match(yourTurnMap, /getTrackPreviewPoints/,
  'YOUR TURN maps must derive from TURN canonical track geometry');
assert.match(yourTurnMap, /getTrackDefinition/,
  'YOUR TURN map accents and identity must come from TURN track definitions');
assert.match(yourTurnMap, /MAP_VIEWS = new Set\(\['invitation', 'paused'\]\)/,
  'Track maps must appear on the invitation and central challenge view before racing');
for (const track of TRACK_DEFINITIONS) {
  assert.ok(track.id, 'Every production track must have a stable id');
  assert.doesNotMatch(yourTurnMap, new RegExp(`case ['\"]${track.id}['\"]`),
    `Track ${track.id} must not require a YOUR TURN-specific geometry branch`);
}

assert.doesNotMatch(yourTurnControls, /yourturn-settings-button/,
  'Settings lives in THE CHALLENGE menu, not on the start line');
assert.match(yourTurnControls, /className = 'utility yourturn-spectate-button'/,
  'The start line only shows a Stop Spectating control while spectating');
assert.match(yourTurnControls, /globalThis\.__yourTurnControls = Object\.freeze\(\{\s*openSettings: settings\.open,\s*canSpectate,\s*startSpectating/,
  'THE CHALLENGE menu opens Settings and Spectate through one controls API');
assert.match(yourTurnSession, /\{ label: 'SETTINGS', action: \(\) => openSettingsFromMenu\(reason\) \}/,
  'THE CHALLENGE menu offers SETTINGS');
assert.match(yourTurnSession, /controls\(\)\?\.canSpectate\(\) \? \[\{ label: 'SPECTATE', action: spectateFromMenu \}\]/,
  'THE CHALLENGE menu offers SPECTATE on the start line');
assert.match(yourTurnSession, /openSettings\(\{ onClose: \(\) => showChallengeMenuView\(reason\) \}\)/,
  'Closing Settings returns to THE CHALLENGE menu, with the race still paused');
assert.match(yourTurnControls, /id="yourTurnLeftHanded"[\s\S]*saveControlHandedness\(/,
  'YOUR TURN Settings keeps TURN’s Left-handed controls');
assert.match(yourTurnControls, /installQeDriveControls\(\);/,
  'YOUR TURN keeps TURN’s Q and E keys for DRIFT and BOOST');
assert.match(yourTurnSession, /recordFunnel\('challenge_open'\);\s*if \(request\.reply/,
  'The YOUR TURN funnel counts a challenge opening once, when it loads');
assert.match(yourTurnSession, /function getTheGame\(\) \{\s*recordFunnel\('get_game'\);\s*openFullTurn\(\);/,
  'GET THE GAME is counted before going to TURN');
assert.doesNotMatch(yourTurnSession, /label: 'GET THE GAME', game: true, action: openFullTurn/,
  'Every GET THE GAME in the menus is counted');
assert.match(yourTurnControls, /fullGameButton\.addEventListener\('click', \(\) => session\.getTheGame\(\)\)/,
  'The start-line Get the game is counted too');
assert.match(yourTurnSession, /telemetry\.flush\(\);\s*telemetry\.record\(event\);\s*telemetry\.flush\(\);/,
  'Funnel events travel in their own batch, so an older Worker cannot drop other events with them');
assert.doesNotMatch(yourTurnControls, /RESET RIVALS|Personal rivals/,
  'YOUR TURN Settings must not expose Reset Rivals');
assert.match(yourTurnControls, /restartButton\.hidden = true/,
  'YOUR TURN must keep the direct Restart Lap control hidden');
assert.match(yourTurnControls,
  /reorder\(\[challengeButton, recalibrateButton, fullGameButton\]\)/,
  'YOUR TURN start line: THE CHALLENGE, Recalibrate, Get the game');
assert.match(yourTurnControls, /if \(activeLap\) \{\s*recalibrateButton\.hidden = true;[\s\S]*reorder\(\[challengeButton\]\);/,
  'During a lap only THE CHALLENGE shows: RECALIBRATE belongs to the start line');
assert.doesNotMatch(yourTurnControls, /blankButton|turn-screen-blank-control/, 'YOUR TURN has no blank screen');
assert.match(yourTurnCss, /:root\[data-turn-deployment="yourturn"\] :is\(\.reset-rivals-button, #resetButton\) \{\s*display: none !important;/,
  'RESET RIVALS and the direct RESTART LAP never show in YOUR TURN, whatever loads first');
assert.match(yourTurnControls, /state\.scene\?\.setPhase\('preview'\)/,
  'YOUR TURN Spectate must use the existing challenge replay scene to teach the track');
assert.match(yourTurnControls, /classList\.toggle\('is-lap-invalid', invalid\)/,
  'YOUR TURN must reflect LAP VOID on THE CHALLENGE button');
assert.match(yourTurnCss, /\.yourturn-challenge-button\.is-lap-invalid[\s\S]*#ff6b6b/);
assert.doesNotMatch(yourTurnCss, /\.utility-group\s*\{/,
  'The mockup must not cause global utility-row spacing or alignment changes');

assert.match(turnControls, /menuState === 'racing'[\s\S]*restartButton\.hidden = false[\s\S]*recalibrateButton\.hidden = true/,
  'TURN must expose Restart Lap but hide Recalibrate during an active race');
assert.match(turnControls, /utilityGroup\.prepend\(restartButton\)/,
  'TURN active-race DOM order must keep Restart Lap in the utility strip');
assert.match(turnControls, /menuState !== 'staged'[\s\S]*recalibrateButton\.hidden = false/,
  'TURN must restore Recalibrate when the player is back at the staged start line');
assert.match(turnControls, /blankScreenButton\.after\(recalibrateButton\)/,
  'TURN must restore Recalibrate to its established staged position after Blank Screen');
assert.match(turnControls, /\.manual-steer \{[\s\S]*background-clip: padding-box/,
  'TURN must keep the yellow steering fill inside the thick rounded contour');
assert.match(turnControls, /back-to-start-button[\s\S]*#ff7b54/,
  'TURN Restart Lap must be orange during a valid active lap');
assert.match(turnControls, /back-to-start-button\.is-lap-invalid[\s\S]*#ff6b6b/,
  'TURN Restart Lap must turn red for LAP VOID');
assert.match(turnControls, /minor-ux-polish-r229\.js\?revision=r229-discoverability-cues/,
  'TURN must load the isolated minor UX polish bundle from the existing race-control entry');
assert.doesNotMatch(turnControls, /gap:|align-items:|translate|margin:/,
  'The TURN r411 control patch must not copy incidental mockup layout changes');

assert.match(
  turnControls,
  /button\[data-achievement-filter="new"\]:not\(:disabled\):not\(\[aria-pressed="true"\]\)::after/,
  'The NEW filter notification must represent available unseen achievements before the player selects it'
);
assert.match(
  turnControls,
  /button\[data-achievement-filter="new"\]\[aria-pressed="true"\]::after\s*\{[\s\S]*content: none/,
  'The NEW notification must disappear once the player has already selected the filter'
);
assert.match(turnControls, /background: var\(--turn-action-warning, #ffd43b\)/,
  'The available NEW filter dot must use TURN warning yellow');
assert.doesNotMatch(minorUx, /turn-first-perk-attention|PERK_ATTENTION_STORAGE_KEY/,
  'GARAGE shows each perk in its own disclosure, so the first-encounter PERK animation is retired');
assert.match(minorUx, /className = 'turn-player-marker turn-spectate-player-marker'/,
  'Spectate must reuse the established player-marker visual language');
assert.match(minorUx, /globalThis\.__turnGetSpectateV3State\?\.\(\)/,
  'The spectate marker must follow the currently selected spectate record');
assert.match(minorUx, /runtime\.competitorCars\?\.\[current\.index\]/,
  'The marker must attach to the selected spectated car rather than the ordinary player car');
assert.match(minorUx, /playerMarkerOutlineColor\(runtime\.state\?\.trackId\)/,
  'The spectate marker must retain the night-track white outline behavior');
assert.match(minorUx, /typeof document !== 'undefined' && typeof window !== 'undefined'/,
  'The polish bundle must guard browser-only startup work');

console.log('TURN/YOUR TURN r411 maps, race-control alignment and minor UX polish regression passed.');

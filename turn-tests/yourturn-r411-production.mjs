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
  minorUx
] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/race-controls-r411.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/track-map-r417.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/r411.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/r411-race-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/minor-ux-polish-r229.js', import.meta.url), 'utf8')
]);

assert.match(yourTurnIndex, /race-controls-r417\.js\?revision=r417/);
assert.match(yourTurnIndex, /track-map-r417\.js\?revision=r417/);
assert.match(yourTurnIndex, /r411\.css\?revision=r411/);
assert.match(turnIndex, /ui\/r411-race-controls\.js\?revision=r229-minor-ux-polish/,
  'TURN must cache-bust the race-control entry when the UX polish bundle changes');

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

assert.match(yourTurnControls, /className = 'utility yourturn-settings-button'/);
assert.match(yourTurnControls, /className = 'utility yourturn-spectate-button'/);
assert.doesNotMatch(yourTurnControls, /RESET RIVALS|Personal rivals/,
  'YOUR TURN Settings must not expose Reset Rivals');
assert.match(yourTurnControls, /restartButton\.hidden = true/,
  'YOUR TURN must keep the direct Restart Lap control hidden');
assert.match(yourTurnControls,
  /const ordered = \[challengeButton\];[\s\S]*ordered\.push\(blankButton\);[\s\S]*ordered\.push\(recalibrateButton, settingsButton, spectateButton\)/,
  'YOUR TURN staged controls must follow THE CHALLENGE, Blank Screen, Recalibrate, Settings, Spectate');
assert.match(yourTurnControls, /state\.scene\?\.setPhase\('preview'\)/,
  'YOUR TURN Spectate must use the existing challenge replay scene to teach the track');
assert.match(yourTurnControls, /classList\.toggle\('is-lap-invalid', invalid\)/,
  'YOUR TURN must reflect LAP VOID on THE CHALLENGE button');
assert.match(yourTurnCss, /\.yourturn-challenge-button\.is-lap-invalid[\s\S]*#ff6b6b/);
assert.doesNotMatch(yourTurnCss, /\.utility-group\s*\{/,
  'The mockup must not cause global utility-row spacing or alignment changes');

assert.match(turnControls, /menuState === 'racing'[\s\S]*restartButton\.hidden = false[\s\S]*recalibrateButton\.hidden = false/,
  'TURN must expose Restart Lap and Recalibrate during an active race');
assert.match(turnControls, /utilityGroup\.prepend\(recalibrateButton\);[\s\S]*utilityGroup\.prepend\(restartButton\)/,
  'TURN active-race DOM order must be Restart Lap then Recalibrate');
assert.match(turnControls, /blankScreenButton\.after\(recalibrateButton\)/,
  'TURN must restore Recalibrate to its established staged position after Blank Screen');
assert.match(turnControls, /back-to-start-button[\s\S]*#ff7b54/,
  'TURN Restart Lap must be orange during a valid active lap');
assert.match(turnControls, /back-to-start-button\.is-lap-invalid[\s\S]*#ff6b6b/,
  'TURN Restart Lap must turn red for LAP VOID');
assert.match(turnControls, /minor-ux-polish-r229\.js\?revision=r229-discoverability-cues/,
  'TURN must load the isolated minor UX polish bundle from the existing race-control entry');
assert.doesNotMatch(turnControls, /gap:|align-items:|top:|bottom:|translate|margin:/,
  'The TURN r411 control patch must not copy incidental mockup layout changes');

assert.match(
  minorUx,
  /button\[data-achievement-filter="new"\]\[aria-pressed="true"\]:not\(:disabled\)::after/,
  'The NEW filter must show its notification dot only while the filter is active'
);
assert.match(minorUx, /background: var\(--turn-action-warning, #ffd43b\)/,
  'The active NEW filter dot must use TURN warning yellow');
assert.match(minorUx, /PERK_ATTENTION_STORAGE_KEY = 'turn-perk-first-encounter-seen-v1'/,
  'The PERK attention cue must be a persisted first-encounter behavior');
assert.match(
  minorUx,
  /\.lot-showroom \.lot-perk-button:not\(\.is-layout-placeholder\):not\(:disabled\)/,
  'PERK attention must wait until the player actually encounters an available perk'
);
assert.match(minorUx, /turn-first-perk-attention/,
  'The first available PERK button must receive the attention animation class');
assert.match(minorUx, /prefers-reduced-motion: reduce/,
  'PERK attention must have a reduced-motion treatment');
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

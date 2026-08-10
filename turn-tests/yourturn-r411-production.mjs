import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';

const [
  yourTurnIndex,
  yourTurnControls,
  yourTurnMap,
  yourTurnCss,
  turnIndex,
  turnControls
] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/race-controls-r411.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/track-map-r417.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/r411.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/r411-race-controls.js', import.meta.url), 'utf8')
]);

assert.match(yourTurnIndex, /race-controls-r417\.js\?revision=r417/);
assert.match(yourTurnIndex, /track-map-r417\.js\?revision=r417/);
assert.match(yourTurnIndex, /r411\.css\?revision=r411/);
assert.match(turnIndex, /ui\/r411-race-controls\.js\?revision=r411/);

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
assert.doesNotMatch(turnControls, /gap:|align-items:|top:|bottom:|translate|margin:/,
  'The TURN r411 control patch must not copy incidental mockup layout changes');

console.log('TURN/YOUR TURN r411 maps and race-control alignment regression passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [homeSource, homeCss, productionApp, productionMain, nextApp, nextMain, orchestrator] = await Promise.all([
  fs.readFile(new URL('../turn-next/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/m8-home.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/session-orchestrator.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(productionApp, /installM8HomeNavigation|m8-home/);
assert.doesNotMatch(productionMain, /createRaceSessionOrchestrator/);
assert.match(nextApp, /installM8HomeNavigation/);
assert.match(nextApp, /turnHomeLifecycle = 'home-m8'/);
assert.match(nextMain, /session-orchestrator\.js\?source=20260729-r118-m8/);

for (const requiredCopy of [
  'TILT. DRIFT.',
  'BEAT YOUR BEST.',
  'HOW TO PLAY',
  'CHOOSE YOUR TRACK',
  'SETTINGS',
  'Drive By Ear™',
  'Device rotation',
  'On-screen steering',
  'RESET RIVALS'
]) {
  assert.ok(homeSource.includes(requiredCopy), 'M8 Home must contain ' + requiredCopy);
}

assert.match(homeSource, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)/);
assert.match(homeSource, /aria-pressed="false"/);
assert.match(homeSource, /m8-track-previous/);
assert.match(homeSource, /m8-track-next/);
assert.match(homeSource, /showTheLot\(\{ initialSelection: selectedVehicle\(runtime\) \}\)/);
assert.doesNotMatch(homeSource, /chooseTrackBeforeLot|lot-track-select/);
assert.match(homeSource, /raceSession\.prepareMotionAccess\(\)/);
assert.match(homeSource, /raceSession\.prepareManualAccess\(\)/);
assert.match(homeSource, /raceSession\.selectVehicle\(selection\)/);
assert.match(homeSource, /showTrackIntro\(selectedTrackId\)/);
assert.match(homeSource, /raceSession\.startGame\(pendingAccess\?\.fullscreenPromise\)/);
assert.ok(homeSource.indexOf('activateTrack(selectedTrackId, runtime)') < homeSource.indexOf('showTheLot({ initialSelection: selectedVehicle(runtime) })'));
assert.ok(homeSource.indexOf('raceSession.selectVehicle(selection)') < homeSource.indexOf('showTrackIntro(selectedTrackId)'));
assert.ok(homeSource.indexOf('showTrackIntro(selectedTrackId)') < homeSource.indexOf('raceSession.startGame(pendingAccess?.fullscreenPromise)'));
assert.match(homeSource, /runtime\.openLot = leaveRaceForHome/);
assert.match(homeSource, /showHome\(\{ focus: true \}\)/);
assert.match(homeSource, /turn-steering-mode-v1/);
assert.match(homeSource, /saveDriveByEarEnabled/);
assert.match(homeSource, /__turnResetRivals/);

assert.match(homeCss, /scroll-snap-type: x mandatory/);
assert.match(homeCss, /overflow-x: auto/);
assert.match(homeCss, /-webkit-overflow-scrolling: touch/);
assert.match(homeCss, /turn-m8-active \.audio-settings-button/);
assert.match(homeCss, /turn-m8-active \.reset-rivals-button/);
assert.match(homeCss, /@media \(max-height: 760px\) and \(orientation: landscape\)/);
assert.match(homeCss, /@media \(max-width: 760px\) and \(orientation: portrait\)/);
assert.match(homeCss, /prefers-reduced-motion/);

assert.match(orchestrator, /async function prepareMotionAccess\(\)/);
assert.match(orchestrator, /function prepareManualAccess\(\)/);
assert.match(orchestrator, /async function selectVehicle\(selection\)/);
assert.match(orchestrator, /function leaveRace\(\)/);
assert.match(orchestrator, /publish\('home-open'\)/);
assert.match(orchestrator, /phase = 'home'/);

console.log('TURN NEXT M8 Home, Help, Settings and navigation contracts passed.');

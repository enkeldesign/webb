import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function update(relativePath, transform) {
  const filePath = path.join(root, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const output = transform(source);
  assert.notEqual(output, source, `${relativePath} was not changed by the M8 test migration.`);
  await fs.writeFile(filePath, output);
}

function replaceRequired(source, search, replacement, label) {
  const index = source.indexOf(search);
  assert.notEqual(index, -1, `M8 test migration could not find ${label}.`);
  assert.equal(source.indexOf(search, index + search.length), -1, `M8 test migration found multiple ${label} values.`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

await update('turn-tests/platform-production.mjs', (source) => {
  let output = source.replaceAll('M5–M7', 'M5–M8');
  output = output.replaceAll('Motion + Display + Session Lifecycle', 'Motion + Display + Session + Home');
  output = output.replaceAll('main.js?source=${buildKey}-m7', 'main.js?source=${buildKey}-m8');
  output = replaceRequired(
    output,
    "assert.match(nextApp, /turnSessionLifecycle = 'orchestrator-m7'/);",
    "assert.match(nextApp, /turnSessionLifecycle = 'orchestrator-m7'/);\nassert.match(nextApp, /turnHomeLifecycle = 'home-m8'/);",
    'M7 session lifecycle assertion'
  );
  assert.match(output, /M5–M8/);
  assert.match(output, /home-m8/);
  return output;
});

await update('turn-tests/motion-safe-zone-production.mjs', (source) => {
  let output = source.replaceAll('main.js?source=${buildKey}-m7', 'main.js?source=${buildKey}-m8');
  output = output.replaceAll('M7 race core', 'M8 race core');
  output = output.replaceAll('M5–M7', 'M5–M8');
  output = output.replaceAll('Motion + Display + Session Lifecycle', 'Motion + Display + Session + Home');
  assert.match(output, /M5–M8/);
  return output;
});

await update('turn-tests/session-orchestrator-production.mjs', (source) => {
  let output = source.replaceAll('-m7', '-m8');
  output = replaceRequired(
    output,
    "const unavailable = createHarness({ selections: [] });",
    `const deferredMotion = createHarness({ selections: [] });
const motionAccess = await deferredMotion.orchestrator.prepareMotionAccess();
assert.equal(motionAccess.mode, 'motion');
assert.equal(deferredMotion.state.sensorMode, true);
assert.equal(deferredMotion.orchestrator.getPhase(), 'authorizing');
assert.equal(deferredMotion.fullscreenRequests, 1);
assert.ok(deferredMotion.order.indexOf('fullscreen') < deferredMotion.order.indexOf('permission'));
assert.equal(deferredMotion.order.includes('show-setup'), false, 'M8 must not open setup while requesting motion access');
await motionAccess.fullscreenPromise;

const deferredManual = createHarness({ selections: [] });
deferredManual.state.roll = 1;
deferredManual.state.targetRoll = 1;
deferredManual.state.neutralRoll = 1;
deferredManual.state.horizonRollReference = 1;
deferredManual.state.pitch = 1;
deferredManual.state.targetPitch = 1;
deferredManual.state.neutralPitch = 1;
const manualAccess = deferredManual.orchestrator.prepareManualAccess();
assert.equal(manualAccess.mode, 'manual');
assert.equal(deferredManual.state.sensorMode, false);
assert.equal(deferredManual.order.includes('show-setup'), false, 'M8 manual access must not open setup');
for (const key of ['roll', 'targetRoll', 'neutralRoll', 'horizonRollReference', 'pitch', 'targetPitch', 'neutralPitch']) {
  assert.equal(deferredManual.state[key], 0, \\`Deferred manual access must reset \\${key}\\`);
}

const selectionOnly = createHarness({ selections: [] });
const selectedCar = { carId: 'suv', color: '#112233', secondaryColor: '#445566' };
assert.equal(await selectionOnly.orchestrator.selectVehicle(selectedCar), true);
assert.deepEqual(selectionOnly.applied, [selectedCar]);
assert.equal(await selectionOnly.orchestrator.selectVehicle(null), false);

const leaveRace = createHarness({ selections: [] });
leaveRace.state.running = true;
leaveRace.elements.hud.hidden = false;
leaveRace.elements.controls.hidden = false;
leaveRace.elements.manualSteer.hidden = false;
assert.equal(leaveRace.orchestrator.leaveRace(), true);
assert.equal(leaveRace.orchestrator.getPhase(), 'home');
assert.equal(leaveRace.state.running, false);
assert.equal(leaveRace.state.touchGas, false);
assert.equal(leaveRace.state.touchBrake, false);
assert.equal(leaveRace.state.manualSteering, 0);
assert.equal(leaveRace.environment.__turnAnalogGas, 0);
assert.equal(leaveRace.environment.__turnBoostActive, false);
assert.equal(leaveRace.environment.__turnDriftHeld, false);
assert.equal(leaveRace.elements.intro.hidden, true);
assert.equal(leaveRace.elements.hud.hidden, true);
assert.equal(leaveRace.elements.controls.hidden, true);
assert.equal(leaveRace.elements.manualSteer.hidden, true);
assert.deepEqual(leaveRace.published, ['home-open']);

const unavailable = createHarness({ selections: [] });`,
    'unavailable motion test insertion point'
  );
  output = replaceRequired(
    output,
    "assert.match(nextMain, /createRaceSessionOrchestrator/);",
    "assert.match(nextMain, /createRaceSessionOrchestrator/);\nassert.match(nextMain, /session-orchestrator\\.js\\?source=20260729-r118-m8/);",
    'generated orchestrator assertion'
  );
  output = replaceRequired(
    output,
    "assert.match(nextMain, /openLot: raceSession\\.openLotFromRace/);",
    "assert.match(nextMain, /openLot: raceSession\\.openLotFromRace/);\nassert.match(nextApp, /turnHomeLifecycle = 'home-m8'/);",
    'runtime Lot assertion'
  );
  assert.match(output, /prepareMotionAccess/);
  assert.match(output, /leaveRace/);
  return output;
});

await update('turn-tests/turn-next-entry-production.mjs', (source) => {
  const output = source
    .replace("assert.match(homeSource, /audio-settings-button/);\n", '')
    .replace("assert.match(homeSource, /reset-rivals-button/);\n", '');
  assert.doesNotMatch(output, /homeSource, \/audio-settings-button/);
  return output;
});

await update('eslint.config.mjs', (source) => {
  let output = replaceRequired(
    source,
    "  requestAnimationFrame: 'readonly'",
    "  requestAnimationFrame: 'readonly',\n  MutationObserver: 'readonly'",
    'readonly requestAnimationFrame global'
  );
  output = replaceRequired(
    output,
    "      'turn/input/motion.js',",
    "      'turn-next/m8-home.js',\n      'turn/input/motion.js',",
    'TURN domain lint list start'
  );
  return output;
});

const homeTest = `import assert from 'node:assert/strict';
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
assert.match(nextMain, /session-orchestrator\\.js\\?source=20260729-r118-m8/);

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
  assert.ok(homeSource.includes(requiredCopy), \\`M8 Home must contain \\${requiredCopy}\\`);
}

assert.match(homeSource, /TRACK_SELECTION_CATALOG\\.map\\(renderTrackCard\\)/);
assert.match(homeSource, /aria-pressed="false"/);
assert.match(homeSource, /m8-track-previous/);
assert.match(homeSource, /m8-track-next/);
assert.match(homeSource, /showTheLot\\(\\{ initialSelection: selectedVehicle\\(runtime\\) \\}\\)/);
assert.doesNotMatch(homeSource, /chooseTrackBeforeLot|lot-track-select/);
assert.match(homeSource, /raceSession\\.prepareMotionAccess\\(\\)/);
assert.match(homeSource, /raceSession\\.prepareManualAccess\\(\\)/);
assert.match(homeSource, /raceSession\\.selectVehicle\\(selection\\)/);
assert.match(homeSource, /showTrackIntro\\(selectedTrackId\\)/);
assert.match(homeSource, /raceSession\\.startGame\\(pendingAccess\\?\\.fullscreenPromise\\)/);
assert.ok(homeSource.indexOf('activateTrack(selectedTrackId, runtime)') < homeSource.indexOf('showTheLot({ initialSelection: selectedVehicle(runtime) })'));
assert.ok(homeSource.indexOf('raceSession.selectVehicle(selection)') < homeSource.indexOf('showTrackIntro(selectedTrackId)'));
assert.ok(homeSource.indexOf('showTrackIntro(selectedTrackId)') < homeSource.indexOf('raceSession.startGame(pendingAccess?.fullscreenPromise)'));
assert.match(homeSource, /runtime\\.openLot = leaveRaceForHome/);
assert.match(homeSource, /showHome\\(\\{ focus: true \\}\\)/);
assert.match(homeSource, /turn-steering-mode-v1/);
assert.match(homeSource, /saveDriveByEarEnabled/);
assert.match(homeSource, /__turnResetRivals/);

assert.match(homeCss, /scroll-snap-type: x mandatory/);
assert.match(homeCss, /overflow-x: auto/);
assert.match(homeCss, /-webkit-overflow-scrolling: touch/);
assert.match(homeCss, /turn-m8-active \\.audio-settings-button/);
assert.match(homeCss, /turn-m8-active \\.reset-rivals-button/);
assert.match(homeCss, /@media \\(max-height: 760px\\) and \\(orientation: landscape\\)/);
assert.match(homeCss, /@media \\(max-width: 760px\\) and \\(orientation: portrait\\)/);
assert.match(homeCss, /prefers-reduced-motion/);

assert.match(orchestrator, /async function prepareMotionAccess\\(\\)/);
assert.match(orchestrator, /function prepareManualAccess\\(\\)/);
assert.match(orchestrator, /async function selectVehicle\\(selection\\)/);
assert.match(orchestrator, /function leaveRace\\(\\)/);
assert.match(orchestrator, /publish\\('home-open'\\)/);
assert.match(orchestrator, /phase = 'home'/);

console.log('TURN NEXT M8 Home, Help, Settings and navigation contracts passed.');
`;
await fs.writeFile(path.join(root, 'turn-tests/home-navigation-production.mjs'), homeTest);

console.log('Applied TURN NEXT M8 permanent test contracts.');

import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
  fs.writeFileSync(path, source.replace(from, to));
}

function replaceAllRequired(path, from, to, minimum = 1) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count < minimum) throw new Error(`${path}: expected at least ${minimum} occurrences of ${JSON.stringify(from)}, found ${count}`);
  fs.writeFileSync(path, source.split(from).join(to));
}

const chooseBlock = `async function chooseVehicleAndStart(fullscreenPromise = Promise.resolve(false)) {
  intro.hidden = true;
  const selection = await showTheLot({
    initialSelection: { carId: state.vehicleId, color: state.vehicleColor }
  });

  if (!selection) {
    intro.hidden = false;
    return;
  }

  await applyVehicleSelection(selection);
  await startGame(fullscreenPromise);
}
`;

const replacement = `${chooseBlock}
async function openLotFromRace() {
  if (!state.running || document.body.classList.contains('turn-lot-open')) return false;

  const spectateState = globalThis.__turnGetSpectateV3State?.();
  if (spectateState?.active) {
    globalThis.__turnStopSpectateV3?.();
    document.body.classList.remove('turn-spectating');
  }

  const wasRunning = state.running;
  state.running = false;
  state.touchGas = false;
  state.touchBrake = false;
  state.manualSteering = 0;
  globalThis.__turnAnalogGas = 0;
  globalThis.__turnBoostActive = false;
  globalThis.__turnDriftHeld = false;

  hud.hidden = true;
  controls.hidden = true;
  manualSteer.hidden = true;

  const selection = await showTheLot({
    initialSelection: { carId: state.vehicleId, color: state.vehicleColor }
  });

  if (!selection) {
    state.running = wasRunning;
    state.lastFrame = performance.now();
    hud.hidden = false;
    controls.hidden = false;
    manualSteer.hidden = state.sensorMode;
    resize();
    return false;
  }

  await applyVehicleSelection(selection);
  await startGame();
  return true;
}
`;

replaceOnce('turn/main.js', chooseBlock, replacement);
replaceOnce(
  'turn/main.js',
  '  setGameMode,\n  setRacePosition(position, total) {',
  '  setGameMode,\n  openLot: openLotFromRace,\n  setRacePosition(position, total) {'
);
replaceOnce(
  'turn/app.js',
  "  import(withBuild('./render/world.js')),\n  import(withBuild('./ui/spectate.js'))",
  "  import(withBuild('./render/world.js')),\n  import(withBuild('./ui/spectate.js')),\n  import(withBuild('./ui/back-to-lot.js'))"
);

replaceAllRequired('turn/index.html', 'v1.1.1', 'v1.1.2', 3);
replaceAllRequired('turn/index.html', '2026.07.19-r10', '2026.07.19-r11', 3);
replaceAllRequired('turn/index.html', '20260719-r10', '20260719-r11', 8);
replaceAllRequired('turn/index.html', 'TURN r10 Lot polish', 'TURN r11 Back to the Lot');
replaceAllRequired('turn-lab/tests/manual-steering-production.mjs', '20260719-r10', '20260719-r11');
replaceAllRequired('turn-lab/tests/garage-production.mjs', 'TURN v1\\.1\\.1 · Build 2026\\.07\\.19-r10', 'TURN v1\\.1\\.2 · Build 2026\\.07\\.19-r11');
replaceAllRequired('turn-lab/tests/garage-production.mjs', 'build=20260719-r10', 'build=20260719-r11');

const garageTestPath = 'turn-lab/tests/garage-production.mjs';
let test = fs.readFileSync(garageTestPath, 'utf8');
const anchor = "assert.match(lotR10Css, /--lot-rail-width/, 'The stats and viewer rail must reserve space beside the parking lot');";
if (!test.includes(anchor)) throw new Error('garage regression anchor missing');
test = test.replace(anchor, `${anchor}\n\nconst backToLot = await fs.readFile(path.join(turnDir, 'ui/back-to-lot.js'), 'utf8');\nassert.match(main, /openLot: openLotFromRace/, 'Race runtime must expose the Back to the Lot action');\nassert.match(main, /await showTheLot\\(/, 'Back to the Lot must reuse the real Lot selector');\nassert.match(backToLot, /Back to the Lot/, 'Race UI must include the Back to the Lot button');\nassert.match(backToLot, /insertAdjacentElement\\('afterend'/, 'Back to the Lot button must sit next to Reset Car');`);
fs.writeFileSync(garageTestPath, test);

console.log('TURN r11 Back to the Lot integration applied.');

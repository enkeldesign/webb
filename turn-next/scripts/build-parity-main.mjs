import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const productionMainPath = path.join(repositoryRoot, 'turn', 'main.js');
const releasePath = path.join(repositoryRoot, 'turn', 'release.json');
const outputPath = path.join(repositoryRoot, 'turn-next', 'main.js');

function replaceRequired(source, search, replacement, label) {
  const firstIndex = source.indexOf(search);
  assert.notEqual(firstIndex, -1, `TURN NEXT main generation could not find ${label}.`);
  assert.equal(source.indexOf(search, firstIndex + search.length), -1, `TURN NEXT main generation found more than one ${label}.`);
  return source.slice(0, firstIndex) + replacement + source.slice(firstIndex + search.length);
}

function replaceRangeRequired(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `TURN NEXT main generation could not find the start of ${label}.`);
  assert.equal(source.indexOf(start, startIndex + start.length), -1, `TURN NEXT main generation found more than one start of ${label}.`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `TURN NEXT main generation could not find the end of ${label}.`);
  assert.equal(source.indexOf(end, endIndex + end.length), -1, `TURN NEXT main generation found more than one end of ${label}.`);
  return source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

export function buildTurnNextMain(productionMain, release) {
  let output = productionMain.replaceAll("from './", "from '/turn/");

  output = replaceRequired(
    output,
    "import { GAME_MODE, installGameModeState, prepareRaceStartState, resetRaceToStage, setGameModeState } from '/turn/race/game-state.js';",
    "import { GAME_MODE, installGameModeState, prepareRaceStartState, resetRaceToStage, setGameModeState } from '/turn/race/game-state.js';\nimport { createRaceSessionOrchestrator } from '/turn/race/session-orchestrator.js';",
    'race session import'
  );

  output = replaceRangeRequired(
    output,
    'function requestGameFullscreen() {',
    'function calibrate() {',
    `const raceSession = createRaceSessionOrchestrator({
  state,
  elements: { intro, hud, controls, manualSteer, status },
  environment: globalThis,
  showRaceSetup: showTheLot,
  applyVehicleSelection,
  prepareRaceStartState,
  publishUiState,
  handleMotion,
  resize,
  showMessage
});
globalThis.__turnNextRaceSession = raceSession;

`,
    'legacy launch and race-session orchestration'
  );

  output = replaceRequired(
    output,
    "motionButton.addEventListener('click', requestMotion);\nmanualButton.addEventListener('click', useManualMode);",
    "motionButton.addEventListener('click', raceSession.requestMotion);\nmanualButton.addEventListener('click', raceSession.useManualMode);",
    'launch button bindings'
  );
  output = replaceRequired(
    output,
    '  openLot: openLotFromRace,',
    '  openLot: raceSession.openLotFromRace,',
    'runtime Lot command'
  );

  output = `// Generated from turn/main.js for TURN ${release.id}. Do not edit by hand.\n${output}`;

  assert.match(output, /createRaceSessionOrchestrator/);
  assert.match(output, /showRaceSetup: showTheLot/);
  assert.match(output, /__turnNextRaceSession = raceSession/);
  assert.match(output, /motionButton\.addEventListener\('click', raceSession\.requestMotion\)/);
  assert.match(output, /manualButton\.addEventListener\('click', raceSession\.useManualMode\)/);
  assert.match(output, /openLot: raceSession\.openLotFromRace/);
  assert.doesNotMatch(output, /function requestGameFullscreen\(|async function requestMotion\(|async function chooseVehicleAndStart\(|async function openLotFromRace\(|async function startGame\(|async function useManualMode\(/);
  assert.match(output, /function calibrate\(\)/);
  assert.doesNotMatch(output, /from '\.\//, 'TURN NEXT main imports must resolve through the canonical production module graph');

  return output.endsWith('\n') ? output : `${output}\n`;
}

async function main() {
  const [productionMain, releaseSource] = await Promise.all([
    fs.readFile(productionMainPath, 'utf8'),
    fs.readFile(releasePath, 'utf8')
  ]);
  const release = JSON.parse(releaseSource);
  const generated = buildTurnNextMain(productionMain, release);

  if (process.argv.includes('--check')) {
    const current = await fs.readFile(outputPath, 'utf8').catch(() => null);
    assert.equal(current, generated, 'turn-next/main.js is stale. Run node turn-next/scripts/build-parity-main.mjs.');
    console.log(`TURN NEXT main orchestration matches TURN ${release.id}.`);
    return;
  }

  await fs.writeFile(outputPath, generated);
  console.log(`Generated turn-next/main.js from TURN ${release.id}.`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await main();

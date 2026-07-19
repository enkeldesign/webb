import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const lab = path.join(root, 'turn-lab');

async function read(relativePath) {
  return fs.readFile(path.join(lab, relativePath), 'utf8');
}

function requireText(source, needles, label) {
  const missing = needles.filter((needle) => !source.includes(needle));
  if (missing.length) {
    throw new Error(`${label} is missing required anchors:\n${missing.join('\n')}`);
  }
}

function forbidText(source, needles, label) {
  const present = needles.filter((needle) => source.includes(needle));
  if (present.length) {
    throw new Error(`${label} still contains forbidden legacy runtime machinery:\n${present.join('\n')}`);
  }
}

const index = await read('index.html');
const app = await read('app.js');
const main = await read('main.js');
const analogGas = await read('input/analog-gas.js');
const gameplayControls = await read('ui/gameplay-controls.js');

requireText(index, [
  'Build 2026.07.19-r6',
  './app.js?build=20260719-r6'
], 'TURN LAB index');

forbidText(index, [
  'patch-capture-init.js',
  'game-prepatch.js',
  'gameplay-features.js?build=',
  'core-state-v1.js',
  'driving-core-v1.js',
  'render-core-v1.js',
  'legacy-bootstrap.js',
  'lab-motion-loader.js',
  'motion-adapter.js'
], 'TURN LAB index');

requireText(app, [
  './input/analog-gas.js',
  './ui/gameplay-controls.js',
  './main.js',
  './render/world.js',
  './ui/spectate.js',
  'static module graph'
], 'TURN LAB app bootstrap');

requireText(main, [
  "import * as THREE from 'three';",
  "from './race/game-state.js'",
  "from './race/lap-system.js'",
  "from './race/replay-system.js'",
  "from './race/rival-storage.js'",
  "from './input/motion.js'",
  "from './vehicle/physics.js'",
  "from './render/camera.js'",
  "from './ui/hud.js'",
  "from './world-assets.js'",
  'const TRACK_WIDTH = 27;',
  'updateVehiclePhysicsState({',
  'updateLapProgressState({',
  'updateRaceCameraState({',
  'updateHudState({',
  'updateDriveEffects(dt);',
  'placeCompetitorCars(dt);',
  'globalThis.__turnNukeGhosts = () => {',
  'globalThis.__turnHasGhosts = () => state.competitorLaps.length > 0;',
  'globalThis.__turnRuntime = turnRuntime;'
], 'TURN LAB static main');

forbidText(main, [
  'URL.createObjectURL(new Blob',
  '__turnCaptureLegacyPatch',
  '__turnLegacyPipeline',
  '__turnRestoreNativeFetch',
  'window.fetch = async'
], 'TURN LAB static main');

requireText(analogGas, [
  'const GAS_BASE = 0.42;',
  'const GAS_DRAG_RANGE = 110;',
  'globalThis.__turnAnalogGas = throttle;'
], 'TURN LAB analog gas module');

requireText(gameplayControls, [
  'globalThis.__turnBoostActive = false;',
  'globalThis.__turnDriftHeld = false;',
  'const BOOST_DRAIN_SECONDS = 2.0;',
  'const BOOST_RECHARGE_SECONDS = 4.2;',
  'const DRIFT_RECHARGE_MULTIPLIER = 2.4;',
  "globalThis.__turnNukeGhosts?.()"
], 'TURN LAB gameplay controls module');

console.log('TURN static runtime preflight passed. No runtime source rewriting remains in the LAB entry path.');

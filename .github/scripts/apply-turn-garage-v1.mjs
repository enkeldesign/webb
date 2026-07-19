import fs from 'node:fs';

const mainPath = 'turn/main.js';
const indexPath = 'turn/index.html';

let main = fs.readFileSync(mainPath, 'utf8');
let index = fs.readFileSync(indexPath, 'utf8');

function replaceOnce(source, search, replacement, label) {
  const count = typeof search === 'string'
    ? source.split(search).length - 1
    : [...source.matchAll(new RegExp(search.source, search.flags.includes('g') ? search.flags : search.flags + 'g'))].length;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(search, replacement);
}

main = replaceOnce(
  main,
  `// TURN LAB static game core.\n// Generated deterministically from verified 2026.07.19-r5; do not hand-edit.\n\nimport * as THREE from 'three';\nimport { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';`,
  `// TURN game core.\n\nimport * as THREE from 'three';`,
  'modernize main header'
);

main = replaceOnce(
  main,
  `import { RIVAL_LIMIT, loadRivalsState, saveRivalsState } from './race/rival-storage.js';`,
  `import { RIVAL_LIMIT, loadRivalsState, saveRivalsState } from './race/rival-storage.js';\nimport { showTheLot } from './garage/lot.js';\nimport { getCarDefinition, loadVehicleSelection, saveVehicleSelection } from './vehicle/catalog.js';\nimport { createCarVisual } from './vehicle/car-models.js';`,
  'add garage imports'
);

main = replaceOnce(
  main,
  `const TRACK_SECTION_COLORS = ['#ff8fbd', '#2f855a', '#f6ad55', '#5c7cfa'];\n\nconst state = {`,
  `const TRACK_SECTION_COLORS = ['#ff8fbd', '#2f855a', '#f6ad55', '#5c7cfa'];\nconst initialVehicleSelection = loadVehicleSelection();\nconst initialVehicleDefinition = getCarDefinition(initialVehicleSelection.carId);\n\nconst state = {`,
  'initialize vehicle selection'
);

main = replaceOnce(
  main,
  `  competitorLaps: [],\n  lastFrame: performance.now(),`,
  `  competitorLaps: [],\n  vehicleId: initialVehicleSelection.carId,\n  vehicleColor: initialVehicleSelection.color,\n  vehicleTuning: initialVehicleDefinition.tuning,\n  lastFrame: performance.now(),`,
  'add vehicle state'
);

main = replaceOnce(
  main,
  `};\n\ninstallGameModeState(state);`,
  `};\n\nglobalThis.__turnVehicleTuning = state.vehicleTuning;\n\ninstallGameModeState(state);`,
  'publish initial vehicle tuning'
);

const carBlockPattern = /const proceduralPlayerParts = \[\.\.\.playerCar\.children\];[\s\S]*?\nconst skidGeometry = new THREE\.BufferGeometry\(\);/;
const carBlockReplacement = `const proceduralPlayerParts = [...playerCar.children];
const proceduralGhostParts = [...ghostCar.children];
playerCar.userData.turnProceduralParts = proceduralPlayerParts;
ghostCar.userData.turnProceduralParts = proceduralGhostParts;

async function installCarVisual(root, { carId, color, ghost = false }) {
  const key = \`${'${carId}'}|${'${color}'}|${'${ghost ? 1 : 0}'}\`;
  if (root.userData.turnVisualKey === key || root.userData.turnVisualPendingKey === key) return;

  const generation = (root.userData.turnVisualGeneration || 0) + 1;
  root.userData.turnVisualGeneration = generation;
  root.userData.turnVisualPendingKey = key;

  const visual = await createCarVisual({ carId, color, ghost, targetLength: 5.5, outline: true });
  if (root.userData.turnVisualGeneration !== generation) return;

  for (const child of [...root.children]) {
    if (child.userData?.turnAssetVisual) root.remove(child);
  }
  for (const part of root.userData.turnProceduralParts || []) part.visible = false;

  visual.userData.turnAssetVisual = true;
  root.add(visual);
  root.userData.turnVisualKey = key;
  root.userData.turnVisualPendingKey = null;
}

async function applyVehicleSelection(selection) {
  const saved = saveVehicleSelection(selection);
  const definition = getCarDefinition(saved.carId);
  state.vehicleId = saved.carId;
  state.vehicleColor = saved.color;
  state.vehicleTuning = definition.tuning;
  globalThis.__turnVehicleTuning = definition.tuning;

  try {
    await installCarVisual(playerCar, {
      carId: state.vehicleId,
      color: state.vehicleColor,
      ghost: false
    });
  } catch (error) {
    console.warn('TURN: selected car model failed to load, using procedural fallback.', error);
    for (const part of playerCar.userData.turnProceduralParts || []) part.visible = true;
  }
}

void installCarVisual(playerCar, {
  carId: state.vehicleId,
  color: state.vehicleColor,
  ghost: false
}).catch((error) => console.warn('TURN: initial selected car failed to load.', error));

const COMPETITOR_MAP_COLORS = ['#38d9ff', '#ff4fa3', '#9775fa', '#ff922b'];
const competitorCars = [ghostCar];

function refreshCompetitorLabels() {
  // Ghost identity is owned by the standalone spectator HUD.
}

function createCompetitorCar() {
  const car = makeCar(0x38d9ff, 0.34);
  car.userData.turnProceduralParts = [...car.children];
  car.visible = false;
  car.traverse((node) => {
    if (node.isMesh) node.castShadow = false;
  });
  world.add(car);
  return car;
}

function ensureCompetitorCars() {
  while (competitorCars.length < COMPETITOR_LIMIT) {
    competitorCars.push(createCompetitorCar());
  }

  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    if (!lap) continue;
    void syncCompetitorVisual(car, lap);
  }
}

async function syncCompetitorVisual(car, lap) {
  const carId = lap.carId || 'sedan';
  const color = lap.carColor || COMPETITOR_MAP_COLORS[competitorCars.indexOf(car)] || '#38d9ff';
  try {
    await installCarVisual(car, { carId, color, ghost: true });
  } catch (error) {
    const key = \`${'${carId}'}|${'${color}'}|1\`;
    if (car.userData.turnVisualFailedKey !== key) {
      car.userData.turnVisualFailedKey = key;
      console.warn('TURN: rival car model failed to load, using procedural fallback.', error);
    }
  }
}

const skidGeometry = new THREE.BufferGeometry();`;
main = replaceOnce(main, carBlockPattern, carBlockReplacement, 'replace legacy single-car asset runtime');

const startFlowPattern = /async function requestMotion\(\) \{[\s\S]*?\nfunction calibrate\(\) \{/;
const startFlowReplacement = `async function requestMotion() {
  const fullscreenPromise = requestGameFullscreen();
  try {
    if (typeof DeviceMotionEvent === 'undefined') throw new Error('Motion sensors are not available in this browser.');
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') throw new Error('Motion permission was not granted.');
    }
    window.addEventListener('devicemotion', handleMotion, { passive: true });
    state.sensorMode = true;
    await chooseVehicleAndStart(fullscreenPromise);
  } catch (error) {
    status.textContent = \`${'${error.message}'} Manual mode still works.\`;
  }
}

async function chooseVehicleAndStart(fullscreenPromise = Promise.resolve(false)) {
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

async function startGame(fullscreenPromise = Promise.resolve(false)) {
  state.running = true;
  state.lastFrame = performance.now();
  prepareRaceStartState(state);
  intro.hidden = true;
  hud.hidden = false;
  controls.hidden = false;
  manualSteer.hidden = state.sensorMode;

  if (state.sensorMode) {
    window.setTimeout(() => {
      state.neutralRoll = state.targetRoll;
      state.horizonRollReference = state.targetRoll;
      state.roll = state.targetRoll;
      state.neutralPitch = state.targetPitch;
      state.pitch = state.targetPitch;
    }, 220);
  }

  await fullscreenPromise;
  try {
    await screen.orientation?.lock?.('landscape');
  } catch (_) {}

  resize();
  window.setTimeout(resize, 300);
  window.setTimeout(resize, 900);
  showMessage('GO!');
}

async function useManualMode() {
  const fullscreenPromise = requestGameFullscreen();
  state.sensorMode = false;
  state.roll = 0;
  state.targetRoll = 0;
  state.neutralRoll = 0;
  state.horizonRollReference = 0;
  state.pitch = 0;
  state.targetPitch = 0;
  state.neutralPitch = 0;
  await chooseVehicleAndStart(fullscreenPromise);
}

function calibrate() {`;
main = replaceOnce(main, startFlowPattern, startFlowReplacement, 'insert The Lot into start flow');

main = replaceOnce(
  main,
  `    maxSpeed: MAX_SPEED,\n    analogGas: globalThis.__turnAnalogGas || 0,\n    boostActive: Boolean(globalThis.__turnBoostActive),\n    driftHeld: Boolean(globalThis.__turnDriftHeld)`,
  `    maxSpeed: MAX_SPEED * state.vehicleTuning.topSpeedMultiplier,\n    analogGas: globalThis.__turnAnalogGas || 0,\n    boostActive: Boolean(globalThis.__turnBoostActive),\n    driftHeld: Boolean(globalThis.__turnDriftHeld),\n    vehicleTuning: state.vehicleTuning`,
  'connect vehicle tuning to physics'
);

index = index
  .replaceAll('TURN v1.0.1 · Build 2026.07.19-r8', 'TURN v1.1.0 · Build 2026.07.19-r9')
  .replace("version: '1.0.1'", "version: '1.1.0'")
  .replace("id: '2026.07.19-r8'", "id: '2026.07.19-r9'")
  .replace("cacheKey: '20260719-r8'", "cacheKey: '20260719-r9'")
  .replaceAll('build=20260719-r8', 'build=20260719-r9');

if (!index.includes('./garage/lot.css?build=20260719-r9')) {
  index = replaceOnce(
    index,
    `  <link rel="stylesheet" href="./manual-steering.css?build=20260719-r9">`,
    `  <link rel="stylesheet" href="./manual-steering.css?build=20260719-r9">\n  <link rel="stylesheet" href="./garage/lot.css?build=20260719-r9">`,
    'link Lot stylesheet'
  );
}

for (const required of [
  "import { showTheLot } from './garage/lot.js';",
  'vehicleTuning: initialVehicleDefinition.tuning',
  'async function applyVehicleSelection(selection)',
  'await chooseVehicleAndStart(fullscreenPromise);',
  'vehicleTuning: state.vehicleTuning',
  "version: '1.1.0'",
  "id: '2026.07.19-r9'"
]) {
  const haystack = required.startsWith('version:') || required.startsWith('id:') ? index : main;
  if (!haystack.includes(required)) throw new Error(`Post-migration verification failed: ${required}`);
}

for (const retired of [
  'wayne-wu/webgpu-crowd-simulation',
  'async function installCarAssets()',
  'function styleCompetitorCar(car, color)'
]) {
  if (main.includes(retired)) throw new Error(`Retired car runtime still present: ${retired}`);
}

fs.writeFileSync(mainPath, main);
fs.writeFileSync(indexPath, index);
console.log('TURN garage integration migration applied successfully.');

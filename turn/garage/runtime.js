import * as THREE from 'three';
import {
  getCarDefinition,
  loadVehicleSelection,
  normalizeVehicleSelection,
  saveVehicleSelection
} from '../vehicle/catalog.js';
import { createCarVisual } from '../vehicle/car-models.js';
import { showTheLot } from './lot.js';

const runtime = globalThis.__turnRuntime || await waitForRuntime();
const { state, world, playerCar, competitorCars } = runtime;
const COMPETITOR_LIMIT = 4;

let lotOpen = false;
let launchGeneration = 0;
let selectedVehicle = loadVehicleSelection();

ensureCompetitorRoots();
await applyVehicleSelection(selectedVehicle, { waitForVisual: false });
installStartInterceptors();
maintainVehicleVisuals();

function installStartInterceptors() {
  const buttons = [
    document.querySelector('#motionButton'),
    document.querySelector('#manualButton')
  ].filter(Boolean);

  for (const button of buttons) {
    button.addEventListener('click', beginLotSelection, { capture: true });
  }
}

async function beginLotSelection() {
  if (lotOpen) return;
  lotOpen = true;
  const generation = ++launchGeneration;
  let raceWasPaused = false;

  const pauseWhileChoosing = () => {
    if (!lotOpen || generation !== launchGeneration) return;
    if (state.running) {
      state.running = false;
      raceWasPaused = true;
    }
    requestAnimationFrame(pauseWhileChoosing);
  };
  requestAnimationFrame(pauseWhileChoosing);

  const selection = await showTheLot({ initialSelection: selectedVehicle });
  if (generation !== launchGeneration) return;

  if (!selection) {
    lotOpen = false;
    cancelBootstrappedRace();
    return;
  }

  selectedVehicle = await applyVehicleSelection(selection, { waitForVisual: true });
  lotOpen = false;

  if (raceWasPaused) resumeBootstrappedRace();
}

async function applyVehicleSelection(selection, { waitForVisual = true } = {}) {
  const normalized = saveVehicleSelection(normalizeVehicleSelection(selection));
  const definition = getCarDefinition(normalized.carId);

  state.vehicleId = normalized.carId;
  state.vehicleColor = normalized.color;
  state.vehicleTuning = definition.tuning;
  globalThis.__turnVehicleTuning = definition.tuning;
  globalThis.__turnCurrentVehicle = Object.freeze({
    carId: normalized.carId,
    color: normalized.color,
    name: definition.name,
    stats: definition.stats
  });

  const visualPromise = syncRootVisual(playerCar, {
    carId: normalized.carId,
    color: normalized.color,
    ghost: false
  });

  if (waitForVisual) await visualPromise;
  else void visualPromise;

  return normalized;
}

function resumeBootstrappedRace() {
  state.lastFrame = performance.now();
  state.running = true;
  document.querySelector('#intro')?.setAttribute('hidden', '');
  document.querySelector('#hud')?.removeAttribute('hidden');
  document.querySelector('#controls')?.removeAttribute('hidden');
  const manualSteer = document.querySelector('#manualSteer');
  if (manualSteer) manualSteer.hidden = Boolean(state.sensorMode);
}

function cancelBootstrappedRace() {
  state.running = false;
  state.speed = 0;
  state.velocity?.set?.(0, 0, 0);
  document.querySelector('#intro')?.removeAttribute('hidden');
  document.querySelector('#hud')?.setAttribute('hidden', '');
  document.querySelector('#controls')?.setAttribute('hidden', '');
  const manualSteer = document.querySelector('#manualSteer');
  if (manualSteer) manualSteer.hidden = true;

  // A motion permission promise can resolve just after the player backs out of The Lot.
  // Suppress that late bootstrap for a short window without interfering with a later retry.
  const generation = ++launchGeneration;
  const until = performance.now() + 1800;
  const suppressLateStart = () => {
    if (generation !== launchGeneration || performance.now() >= until) return;
    if (state.running) state.running = false;
    requestAnimationFrame(suppressLateStart);
  };
  requestAnimationFrame(suppressLateStart);
}

function ensureCompetitorRoots() {
  while (competitorCars.length < COMPETITOR_LIMIT) {
    const root = new THREE.Group();
    root.visible = false;
    root.userData.frontWheelPivots = [];
    root.userData.wheelSpinners = [];
    world.add(root);
    competitorCars.push(root);
  }
}

function maintainVehicleVisuals() {
  ensureCompetitorRoots();
  enforceSelectedVisual(playerCar);

  for (let index = 0; index < competitorCars.length; index += 1) {
    const root = competitorCars[index];
    const lap = state.competitorLaps[index];
    enforceSelectedVisual(root);
    if (!lap) continue;

    void syncRootVisual(root, {
      carId: lap.carId || 'sedan',
      color: lap.carColor || '#38d9ff',
      ghost: true
    });
  }

  requestAnimationFrame(maintainVehicleVisuals);
}

async function syncRootVisual(root, { carId, color, ghost }) {
  const selection = normalizeVehicleSelection({ carId, color });
  const key = `${selection.carId}|${selection.color}|${ghost ? 1 : 0}`;
  if (root.userData.turnGarageVisualKey === key) return root.userData.turnGarageVisual;
  if (root.userData.turnGarageVisualPendingKey === key) return root.userData.turnGarageVisualPromise;

  const generation = (root.userData.turnGarageVisualGeneration || 0) + 1;
  root.userData.turnGarageVisualGeneration = generation;
  root.userData.turnGarageVisualPendingKey = key;

  const promise = createCarVisual({
    carId: selection.carId,
    color: selection.color,
    ghost,
    targetLength: 5.5,
    outline: true
  }).then((visual) => {
    if (root.userData.turnGarageVisualGeneration !== generation) return null;

    const previous = root.userData.turnGarageVisual;
    if (previous?.parent === root) root.remove(previous);

    visual.userData.turnGarageVisual = true;
    root.add(visual);
    root.userData.turnGarageVisual = visual;
    root.userData.turnGarageVisualKey = key;
    root.userData.turnGarageVisualPendingKey = null;
    root.userData.turnGarageVisualPromise = null;
    enforceSelectedVisual(root);
    return visual;
  }).catch((error) => {
    if (root.userData.turnGarageVisualGeneration === generation) {
      root.userData.turnGarageVisualPendingKey = null;
      root.userData.turnGarageVisualPromise = null;
    }
    console.warn(`TURN: could not install ${ghost ? 'rival' : 'player'} vehicle ${selection.carId}.`, error);
    return null;
  });

  root.userData.turnGarageVisualPromise = promise;
  return promise;
}

function enforceSelectedVisual(root) {
  const selected = root.userData.turnGarageVisual;
  if (!selected) return;

  for (const child of root.children) {
    child.visible = child === selected;
  }
  selected.visible = true;
}

function waitForRuntime() {
  return new Promise((resolve) => {
    window.addEventListener('turn:runtime-ready', (event) => resolve(event.detail), { once: true });
  });
}

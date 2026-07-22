import * as THREE from 'three';
import { resetRaceToStage } from '../race/game-state.js?build=20260722-r41';
import { clearRivalsState, loadRivalsState } from '../race/rival-storage.js?build=20260722-r47';
import {
  DEFAULT_TRACK_ID,
  createTrackRuntime,
  getTrackDefinition,
  loadTrackSelection,
  normalizeTrackId,
  saveTrackSelection
} from './catalog.js?build=20260722-r47';
import { installAirportWorld } from './airport-world.js?build=20260722-r47';
import { showTrackSelect } from '../ui/track-select.js?build=20260722-r47';

let runtime = null;
let runtimeReadyResolve = null;
let activeTrackId = DEFAULT_TRACK_ID;
let chosenThisSession = false;
let countrysideSamples = null;
let airportTrack = null;
let airportWorld = null;
let dynamicWorld = null;

const runtimeReady = new Promise((resolve) => {
  runtimeReadyResolve = resolve;
});

if (globalThis.__turnRuntime) installRuntime(globalThis.__turnRuntime);
else {
  window.addEventListener('turn:runtime-ready', (event) => {
    installRuntime(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

export async function chooseTrackBeforeLot() {
  const currentRuntime = await runtimeReady;
  const selectedTrackId = await showTrackSelect({
    initialTrackId: chosenThisSession ? activeTrackId : loadTrackSelection()
  });
  if (!selectedTrackId) return null;

  await activateTrack(selectedTrackId, currentRuntime);
  chosenThisSession = true;
  return activeTrackId;
}

export async function activateTrack(trackId, currentRuntime = runtime) {
  currentRuntime ||= await runtimeReady;
  const nextTrackId = normalizeTrackId(trackId);
  ensureTrackInfrastructure(currentRuntime);

  if (typeof currentRuntime.trackSpatialIndex?.replaceSamples !== 'function') {
    throw new Error('TURN: the active track index cannot rebuild for track changes.');
  }

  if (nextTrackId === 'airport') {
    if (!airportTrack) {
      airportTrack = createTrackRuntime('airport', currentRuntime.trackSampleCount || 720);
    }
    if (!airportWorld) {
      airportWorld = installAirportWorld({
        scene: currentRuntime.scene,
        samples: airportTrack.samples,
        trackWidth: currentRuntime.trackWidth
      });
      airportWorld.visible = false;
    }

    replaceSamples(currentRuntime.samples, airportTrack.samples);
    currentRuntime.trackSpatialIndex.replaceSamples(currentRuntime.samples);
    currentRuntime.world.visible = false;
    airportWorld.visible = true;
  } else {
    replaceSamples(currentRuntime.samples, countrysideSamples);
    currentRuntime.trackSpatialIndex.replaceSamples(currentRuntime.samples);
    currentRuntime.world.visible = true;
    if (airportWorld) airportWorld.visible = false;
  }

  activeTrackId = nextTrackId;
  currentRuntime.trackId = nextTrackId;
  currentRuntime.state.trackId = nextTrackId;
  saveTrackSelection(nextTrackId);
  applyTrackAtmosphere(currentRuntime, nextTrackId);

  for (const car of currentRuntime.competitorCars || []) car.visible = false;
  resetRaceToStage({
    state: currentRuntime.state,
    samples: currentRuntime.samples,
    showFeedback: false,
    setRacePosition: currentRuntime.setRacePosition
  });
  loadRivalsState({
    state: currentRuntime.state,
    samples: currentRuntime.samples,
    findNearestTrack: currentRuntime.findNearestTrack,
    trackId: nextTrackId
  });
  currentRuntime.ensureCompetitorCars?.();

  window.dispatchEvent(new CustomEvent('turn:track-changed', {
    detail: {
      trackId: nextTrackId,
      track: getTrackDefinition(nextTrackId)
    }
  }));
  publishUiState(currentRuntime, 'rivals-loaded');
  publishUiState(currentRuntime, 'track-changed');
  return nextTrackId;
}

function installRuntime(nextRuntime) {
  if (!nextRuntime || runtime) return;
  runtime = nextRuntime;
  runtime.state.trackId = DEFAULT_TRACK_ID;
  runtime.trackId = DEFAULT_TRACK_ID;
  countrysideSamples = runtime.samples.slice();
  ensureTrackInfrastructure(runtime);
  installTrackAwareRivalReset(runtime);

  globalThis.__turnGetTrackId = () => activeTrackId;
  globalThis.__turnChooseTrack = () => chooseTrackBeforeLot();
  runtimeReadyResolve(runtime);
}

function ensureTrackInfrastructure(currentRuntime) {
  if (dynamicWorld) return;

  currentRuntime.ensureCompetitorCars?.();
  dynamicWorld = new THREE.Group();
  dynamicWorld.name = 'TURN Dynamic Race Layer';
  currentRuntime.scene.add(dynamicWorld);

  const dynamicNodes = new Set([
    currentRuntime.playerCar,
    ...(currentRuntime.competitorCars || [])
  ]);

  for (const child of [...currentRuntime.world.children]) {
    if (dynamicNodes.has(child) || child?.isLineSegments || isRaceParticle(child)) {
      dynamicWorld.attach(child);
    }
  }

  currentRuntime.dynamicWorld = dynamicWorld;
}

function isRaceParticle(node) {
  return node?.isMesh
    && node.geometry?.type === 'SphereGeometry'
    && node.material?.transparent === true
    && node.geometry?.parameters?.radius <= 1;
}

function replaceSamples(target, source) {
  target.splice(0, target.length, ...source);
}

function applyTrackAtmosphere(currentRuntime, trackId) {
  const track = getTrackDefinition(trackId);
  currentRuntime.scene.background = new THREE.Color(track.sky);
  if (currentRuntime.scene.fog?.color) currentRuntime.scene.fog.color.setHex(track.fog);
}

function installTrackAwareRivalReset(currentRuntime) {
  const resetCurrentTrackRivals = () => {
    clearRivalsState(currentRuntime.state, { trackId: activeTrackId });
    for (const car of currentRuntime.competitorCars || []) car.visible = false;
    currentRuntime.setRacePosition?.(null, 1);
    showMessage('RIVALS RESET');
    window.dispatchEvent(new CustomEvent('turn:rivals-reset'));
    publishUiState(currentRuntime, 'rivals-reset');
  };

  globalThis.__turnResetRivals = resetCurrentTrackRivals;
  globalThis.__turnNukeGhosts = resetCurrentTrackRivals;
}

function showMessage(text, duration = 1800) {
  const message = document.querySelector('#message');
  if (!message) return;
  message.textContent = text;
  message.classList.add('show');
  window.setTimeout(() => message.classList.remove('show'), duration);
}

function publishUiState(currentRuntime, reason) {
  window.dispatchEvent(new CustomEvent('turn:ui-state-change', {
    detail: {
      reason,
      mode: currentRuntime.state.mode,
      running: currentRuntime.state.running,
      trackId: activeTrackId
    }
  }));
}
import * as THREE from 'three';
import { resetRaceToStage } from '../race/game-state.js?build=20260722-r41';
import { clearRivalsState, loadRivalsState } from '../race/rival-storage.js?build=20260722-r50';
import {
  DEFAULT_TRACK_ID,
  loadTrackSelection,
  normalizeTrackId,
  saveTrackSelection
} from './catalog.js';
import { getTrackRuntimeEntry } from './registry.js';
import { showTrackSelect } from '../ui/track-select.js?build=20260722-r51';

let runtime = null;
let runtimeReadyResolve = null;
let activeTrackId = DEFAULT_TRACK_ID;
let chosenThisSession = false;
let dynamicWorld = null;

const trackStates = new Map();
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
  const nextTrack = getTrackRuntimeEntry(nextTrackId);
  ensureTrackInfrastructure(currentRuntime);

  if (typeof currentRuntime.trackSpatialIndex?.replaceSamples !== 'function') {
    throw new Error('TURN: the active track index cannot rebuild for track changes.');
  }

  const nextState = ensureTrackState(nextTrack, currentRuntime);
  replaceSamples(currentRuntime.samples, nextState.trackRuntime.samples);
  currentRuntime.trackSpatialIndex.replaceSamples(currentRuntime.samples);
  for (const state of trackStates.values()) {
    state.world.visible = state.entry.id === nextTrackId;
  }

  activeTrackId = nextTrackId;
  currentRuntime.trackId = nextTrackId;
  currentRuntime.activeTrack = nextTrack;
  currentRuntime.activeWorld = nextState.world;
  currentRuntime.state.trackId = nextTrackId;
  saveTrackSelection(nextTrackId);
  applyTrackAtmosphere(currentRuntime, nextTrack);

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
  currentRuntime.syncCompetitorVisuals?.();

  window.dispatchEvent(new CustomEvent('turn:track-changed', {
    detail: {
      trackId: nextTrackId,
      track: nextTrack
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

  const initialTrack = getTrackRuntimeEntry(DEFAULT_TRACK_ID);
  trackStates.set(DEFAULT_TRACK_ID, {
    entry: initialTrack,
    trackRuntime: {
      id: DEFAULT_TRACK_ID,
      definition: initialTrack,
      samples: runtime.samples.slice(),
      sampleCount: runtime.samples.length
    },
    world: runtime.world
  });
  runtime.activeTrack = initialTrack;
  runtime.activeWorld = runtime.world;

  ensureTrackInfrastructure(runtime);
  installTrackAwareRivalReset(runtime);

  globalThis.__turnGetTrackId = () => activeTrackId;
  globalThis.__turnChooseTrack = () => chooseTrackBeforeLot();
  globalThis.__turnIsForgivingSurface = (position) => activeTrackEntry().isForgivingSurface(position);
  globalThis.__turnGetCollisionProfile = () => activeTrackEntry().collisionProfile;
  runtimeReadyResolve(runtime);
}

function ensureTrackState(entry, currentRuntime) {
  const existing = trackStates.get(entry.id);
  if (existing) return existing;

  const trackRuntime = entry.createRuntime(currentRuntime.trackSampleCount || 720);
  const world = entry.installWorld({
    scene: currentRuntime.scene,
    samples: trackRuntime.samples,
    trackWidth: currentRuntime.trackWidth,
    initialWorld: currentRuntime.world,
    runtime: currentRuntime,
    trackRuntime
  });
  if (!world) throw new Error(`TURN: track ${entry.id} did not install a world.`);
  world.visible = false;

  const state = { entry, trackRuntime, world };
  trackStates.set(entry.id, state);
  return state;
}

function activeTrackEntry() {
  return trackStates.get(activeTrackId)?.entry || getTrackRuntimeEntry(activeTrackId);
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

function applyTrackAtmosphere(currentRuntime, track) {
  const lighting = track.lighting || {};
  currentRuntime.scene.background = new THREE.Color(track.sky);

  if (currentRuntime.scene.fog?.color) {
    currentRuntime.scene.fog.color.setHex(track.fog);
    currentRuntime.scene.fog.near = Number.isFinite(track.fogNear) ? track.fogNear : 180;
    currentRuntime.scene.fog.far = Number.isFinite(track.fogFar) ? track.fogFar : 700;
  }

  const hemisphere = currentRuntime.scene.children.find((node) => node.isHemisphereLight);
  if (hemisphere) {
    hemisphere.color.setHex(lighting.hemisphereSky ?? 0xffffff);
    hemisphere.groundColor.setHex(lighting.hemisphereGround ?? 0x5b3a29);
    hemisphere.intensity = lighting.hemisphereIntensity ?? 2.7;
  }

  const directional = currentRuntime.scene.children.find((node) => node.isDirectionalLight);
  if (directional) {
    directional.color.setHex(lighting.directionalColor ?? 0xfff1c1);
    directional.intensity = lighting.directionalIntensity ?? 4.3;
  }
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

import * as THREE from 'three';
import { replayFrameAt } from '/turn/race/replay-system.js';
import { trackPitch, trackSurfaceY } from '/turn/tracks/elevation.js?build=20260725-r67';

const PREVIEW_CAMERA_DISTANCE = 18;
const PREVIEW_CAMERA_HEIGHT = 8.4;
const PREVIEW_START_DELAY_MS = 650;
const STAGED_IMITATION_DELAY_MS = 650;
const START_GRID_SPACING = 3.4;

export function createChallengeScene({ runtime, challengeLap, onRaceStarted }) {
  let phase = 'preview';
  let previewStartedAt = performance.now();
  const stagedHistory = [];
  const stagedGrid = createEmptyGrid();
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  function setPhase(nextPhase) {
    phase = nextPhase;
    if (nextPhase === 'preview' || nextPhase === 'reply' || nextPhase === 'result') {
      previewStartedAt = performance.now();
    }
    if (nextPhase !== 'staged') stagedHistory.length = 0;
    if (nextPhase === 'staged') resetGrid(stagedGrid);
  }

  function update(dt) {
    if (phase === 'preview' || phase === 'reply' || phase === 'result') {
      renderPreview(runtime, challengeLap, previewStartedAt, dt, reduceMotion);
      return true;
    }
    if (phase === 'staged') {
      if (runtime.state.lapActive) {
        phase = 'racing';
        stagedHistory.length = 0;
        onRaceStarted?.();
        return false;
      }
      renderStage(runtime, dt, stagedHistory, stagedGrid, reduceMotion);
      return true;
    }
    return false;
  }

  runtime.setSceneOverride(update);
  return Object.freeze({ setPhase, getPhase: () => phase });
}

function renderPreview(runtime, challengeLap, previewStartedAt, dt, reduceMotion) {
  const sinceOpenMs = performance.now() - previewStartedAt;
  const elapsed = reduceMotion
    ? Math.min(challengeLap.time * 0.18, 1.2)
    : Math.max(0, sinceOpenMs - PREVIEW_START_DELAY_MS) / 1000;
  const replayTime = challengeLap.time > 0 ? elapsed % challengeLap.time : elapsed;
  const frame = replayFrameAt(challengeLap, replayTime);
  const opponentCar = runtime.competitorCars[0];
  runtime.playerCar.visible = false;
  hideOtherCompetitors(runtime, 0);
  if (!frame || !opponentCar) return;

  placeReplayCar(runtime, opponentCar, frame, dt);
  const focus = new THREE.Vector3(frame.x, replaySurfaceY(runtime, frame), frame.z);
  const forward = new THREE.Vector3(Math.sin(frame.h), 0, Math.cos(frame.h));
  const desiredCamera = focus.clone().addScaledVector(forward, -PREVIEW_CAMERA_DISTANCE);
  desiredCamera.y += PREVIEW_CAMERA_HEIGHT;
  runtime.cameraPosition.lerp(desiredCamera, 1 - Math.exp(-dt * 7.2));
  runtime.camera.position.copy(runtime.cameraPosition);

  const desiredTarget = focus.clone().addScaledVector(forward, 12.5);
  desiredTarget.y += 1.9;
  runtime.cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 9));
  runtime.camera.up.set(0, 1, 0);
  runtime.camera.lookAt(runtime.cameraTarget);
  runtime.camera.fov = THREE.MathUtils.lerp(runtime.camera.fov, 70, Math.min(1, dt * 6));
  runtime.camera.updateProjectionMatrix();
}

function renderStage(runtime, dt, stagedHistory, stagedGrid, reduceMotion) {
  const rivalCount = Math.min(
    runtime.state.competitorLaps?.length || 0,
    runtime.competitorCars?.length || 0
  );

  if (rivalCount > 1) {
    renderMultiRivalGrid(runtime, dt, stagedGrid, rivalCount);
    renderStageCamera(runtime, dt);
    return;
  }

  renderSingleRivalStage(runtime, dt, stagedHistory, reduceMotion);
  renderStageCamera(runtime, dt);
}

function renderSingleRivalStage(runtime, dt, stagedHistory, reduceMotion) {
  const { state, playerCar, competitorCars } = runtime;
  const opponentCar = competitorCars[0];
  placePlayerCar(runtime, dt);

  const now = performance.now();
  if (!reduceMotion) {
    const last = stagedHistory.at(-1);
    if (!last || now - last.at >= 40) {
      stagedHistory.push({ at: now, heading: state.heading, steering: state.steering });
    }
    while (stagedHistory.length > 2 && stagedHistory[1].at < now - 1600) stagedHistory.shift();
  }
  const delayed = reduceMotion
    ? { heading: state.heading, steering: 0 }
    : delayedStageSample(stagedHistory, now - STAGED_IMITATION_DELAY_MS) || { heading: state.heading, steering: 0 };

  hideOtherCompetitors(runtime, 0);
  if (opponentCar) {
    const right = new THREE.Vector3(Math.cos(state.heading), 0, -Math.sin(state.heading));
    opponentCar.visible = true;
    opponentCar.position.copy(state.position).addScaledVector(right, 4.1);
    opponentCar.position.y = playerCar.position.y;
    opponentCar.rotation.x = playerCar.rotation.x;
    opponentCar.rotation.y = delayed.heading + Math.PI;
    opponentCar.rotation.z = -delayed.steering * 0.03;
    runtime.animateWheels(opponentCar, delayed.steering, 0, dt);
  }
}

function renderMultiRivalGrid(runtime, dt, grid, rivalCount) {
  const { state, samples, competitorCars } = runtime;
  const totalCars = rivalCount + 1;
  const playerSlot = Math.floor((totalCars - 1) / 2);
  const slotOffsets = Array.from(
    { length: totalCars },
    (_, index) => (index - (totalCars - 1) / 2) * START_GRID_SPACING
  );

  if (!grid.playerPlaced) {
    const nearest = runtime.findNearestTrack(state.position);
    const normal = nearest.sample.normal || normalFromTangent(nearest.sample.tangent);
    state.position.addScaledVector(normal, slotOffsets[playerSlot]);
    const settled = runtime.findNearestTrack(state.position);
    state.position.y = trackSurfaceY(settled.sample);
    state.surfacePitch = trackPitch(settled.sample);
    state.nearestTrackIndex = settled.index;
    state.trackDistance = settled.distance;
    state.progress = settled.index / Math.max(1, samples.length);
    state.lastProgress = state.progress;
    state.lapPreviousPosition = { x: state.position.x, z: state.position.z };
    grid.rivalIndex = settled.index;
    grid.playerPlaced = true;
  }

  placePlayerCar(runtime, dt);

  const nearest = runtime.findNearestTrack(state.position);
  if (!Number.isFinite(grid.rivalIndex)) grid.rivalIndex = nearest.index;
  if (nearest.index >= grid.rivalIndex && nearest.index - grid.rivalIndex < samples.length / 2) {
    grid.rivalIndex = nearest.index;
  }

  const rowSample = samples[Math.max(0, Math.min(samples.length - 1, grid.rivalIndex))] || nearest.sample;
  const rowNormal = rowSample.normal || normalFromTangent(rowSample.tangent);
  const rowHeading = Math.atan2(rowSample.tangent.x, rowSample.tangent.z);
  const rivalSlots = slotOffsets.filter((_, index) => index !== playerSlot);

  for (let index = 0; index < competitorCars.length; index += 1) {
    const car = competitorCars[index];
    if (!car || index >= rivalCount) {
      if (car) car.visible = false;
      continue;
    }

    const offset = rivalSlots[index] ?? 0;
    car.visible = true;
    car.position.copy(rowSample.point).addScaledVector(rowNormal, offset);
    const surface = runtime.findNearestTrack(car.position).sample;
    car.position.y = trackSurfaceY(surface);
    car.rotation.x = trackPitch(surface);
    car.rotation.y = rowHeading + Math.PI;
    car.rotation.z = 0;
    runtime.animateWheels(car, 0, Math.max(0, state.speed), dt);
  }
}

function placePlayerCar(runtime, dt) {
  const { state, playerCar } = runtime;
  playerCar.visible = true;
  playerCar.position.copy(state.position);
  const playerSample = runtime.findNearestTrack(state.position).sample;
  playerCar.position.y = trackSurfaceY(playerSample);
  playerCar.rotation.x = trackPitch(playerSample);
  playerCar.rotation.y = state.heading + Math.PI;
  playerCar.rotation.z = 0;
  runtime.animateWheels(playerCar, state.steering, state.speed, dt);
}

function renderStageCamera(runtime, dt) {
  const { state, playerCar } = runtime;
  const forward = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
  const focus = state.position.clone();
  focus.y = playerCar.position.y;
  const desiredCamera = focus.clone().addScaledVector(forward, -17.5);
  desiredCamera.y += 8.2;
  runtime.cameraPosition.lerp(desiredCamera, 1 - Math.exp(-dt * 9));
  runtime.camera.position.copy(runtime.cameraPosition);
  const desiredTarget = focus.clone().addScaledVector(forward, 12);
  desiredTarget.y += 2;
  runtime.cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 10));
  runtime.camera.up.set(0, 1, 0);
  runtime.camera.lookAt(runtime.cameraTarget);
}

function delayedStageSample(history, targetTime) {
  let candidate = null;
  for (const sample of history) {
    if (sample.at > targetTime) break;
    candidate = sample;
  }
  return candidate;
}

function placeReplayCar(runtime, car, frame, dt) {
  const sample = runtime.findNearestTrack(frame).sample;
  car.visible = true;
  car.position.set(frame.x, trackSurfaceY(sample), frame.z);
  car.rotation.x = trackPitch(sample);
  car.rotation.y = frame.h + Math.PI;
  car.rotation.z = -frame.s * 0.03;
  runtime.animateWheels(car, frame.s, 45, dt);
}

function replaySurfaceY(runtime, frame) {
  return trackSurfaceY(runtime.findNearestTrack(frame).sample);
}

function hideOtherCompetitors(runtime, keepIndex) {
  for (let index = 0; index < runtime.competitorCars.length; index += 1) {
    if (index !== keepIndex) runtime.competitorCars[index].visible = false;
  }
}

function normalFromTangent(tangent) {
  return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
}

function createEmptyGrid() {
  return { playerPlaced: false, rivalIndex: null };
}

function resetGrid(grid) {
  grid.playerPlaced = false;
  grid.rivalIndex = null;
}

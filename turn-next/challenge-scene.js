import * as THREE from 'three';
import { replayFrameAt } from '/turn/race/replay-system.js?build=20260805-r160';
import { trackPitch, trackSurfaceY } from '/turn/tracks/elevation.js?build=20260805-r160';

const PREVIEW_CAMERA_DISTANCE = 19;
const PREVIEW_CAMERA_HEIGHT = 8.8;

export function createChallengeScene({ runtime, challengeLap, onRaceStarted }) {
  let phase = 'preview';
  let previewStartedAt = performance.now();

  function setPhase(nextPhase) {
    phase = nextPhase;
    if (nextPhase === 'preview' || nextPhase === 'reply' || nextPhase === 'result') {
      previewStartedAt = performance.now();
    }
  }

  function update(dt) {
    if (phase === 'preview' || phase === 'reply' || phase === 'result') {
      renderPreview(runtime, challengeLap, previewStartedAt, dt);
      return true;
    }
    if (phase === 'staged') {
      if (runtime.state.lapActive) {
        phase = 'racing';
        onRaceStarted?.();
        return false;
      }
      renderStage(runtime, dt);
      return true;
    }
    return false;
  }

  runtime.setSceneOverride(update);
  return Object.freeze({ setPhase, getPhase: () => phase });
}

function renderPreview(runtime, challengeLap, previewStartedAt, dt) {
  const elapsed = (performance.now() - previewStartedAt) / 1000;
  const frame = replayFrameAt(challengeLap, elapsed);
  const challengeCar = runtime.competitorCars[0];
  runtime.playerCar.visible = false;
  hideOtherCompetitors(runtime, 0);
  if (!frame || !challengeCar) return;

  placeReplayCar(runtime, challengeCar, frame, dt);
  const focus = new THREE.Vector3(frame.x, replaySurfaceY(runtime, frame), frame.z);
  const forward = new THREE.Vector3(Math.sin(frame.h), 0, Math.cos(frame.h));
  const desiredCamera = focus.clone().addScaledVector(forward, -PREVIEW_CAMERA_DISTANCE);
  desiredCamera.y += PREVIEW_CAMERA_HEIGHT;
  runtime.cameraPosition.lerp(desiredCamera, 1 - Math.exp(-dt * 7.2));
  runtime.camera.position.copy(runtime.cameraPosition);

  const desiredTarget = focus.clone().addScaledVector(forward, 13.5);
  desiredTarget.y += 2.1;
  runtime.cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 9));
  runtime.camera.up.set(0, 1, 0);
  runtime.camera.lookAt(runtime.cameraTarget);
  runtime.camera.fov = THREE.MathUtils.lerp(runtime.camera.fov, 72, Math.min(1, dt * 6));
  runtime.camera.updateProjectionMatrix();
}

function renderStage(runtime, dt) {
  const { state, playerCar, competitorCars } = runtime;
  const challengeCar = competitorCars[0];
  playerCar.visible = true;
  playerCar.position.copy(state.position);
  const playerSample = runtime.findNearestTrack(state.position).sample;
  playerCar.position.y = trackSurfaceY(playerSample);
  playerCar.rotation.x = trackPitch(playerSample);
  playerCar.rotation.y = state.heading + Math.PI;
  playerCar.rotation.z = 0;
  runtime.animateWheels(playerCar, state.steering, state.speed, dt);

  hideOtherCompetitors(runtime, 0);
  if (challengeCar) {
    const right = new THREE.Vector3(Math.cos(state.heading), 0, -Math.sin(state.heading));
    challengeCar.visible = true;
    challengeCar.position.copy(state.position).addScaledVector(right, 4.1);
    challengeCar.position.y = playerCar.position.y;
    challengeCar.rotation.copy(playerCar.rotation);
    runtime.animateWheels(challengeCar, 0, 0, dt);
  }

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

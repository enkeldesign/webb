import * as THREE from 'three';
import { beginTimedLapState } from '/turn/race/lap-system.js';
import { trackPitch, trackSurfaceY } from '/turn/tracks/elevation.js?build=20260725-r67';
import { updateRaceCameraState } from '/turn/render/camera.js?build=20260720-r19&revision=r270-camera-hotpath';
import { keyboardDriveActionForEvent } from '/turn/input/keyboard-driving-controls.js';
import { createKeyboardDriveOwnership } from '/turn/input/keyboard-drive-ownership.js';
import { qeDriveZoneForEvent } from '/turn/input/qe-drive-controls.js';

const GRID_SPACING = 3.4;
const LAUNCH_BLEND_SECONDS = 0.9;
const START_GATE_GUARD_DISTANCE = 0.75;

bootstrap();

function bootstrap() {
  const runtime = globalThis.__turnRuntime;
  const session = globalThis.__yourTurnSession;
  if (!runtime || !session) {
    requestAnimationFrame(bootstrap);
    return;
  }
  if (runtime.__yourTurnStartGateInstalled) return;
  runtime.__yourTurnStartGateInstalled = true;
  installFixedStartGrid(runtime, session);
  installStartIntent(runtime, session);
}

function installFixedStartGrid(runtime, session) {
  const downstreamRunSceneOverride = runtime.runSceneOverride.bind(runtime);

  runtime.runSceneOverride = (dt) => {
    const sessionState = session.getState();
    const staged = sessionState?.accepted
      && sessionState.phase === 'staged'
      && !runtime.state.lapActive
      && document.body.classList.contains('yourturn-racing');

    if (!staged) return downstreamRunSceneOverride(dt);

    renderStartGrid(runtime, sessionState, dt);
    return true;
  };
}

function installStartIntent(runtime, session) {
  const isForwardControl = (target) => Boolean(target?.closest?.(
    '#gasButton, .drive-drift-zone, .drive-boost-zone'
  ));

  const startFromControl = (event) => {
    if (!isForwardControl(event.target)) return;
    startRace(runtime, session);
  };

  document.addEventListener('pointerdown', startFromControl, { capture: true });
  document.addEventListener('click', startFromControl, { capture: true });

  // The keyboard starts the race too: GAS (Up or W), DRIFT (Q) or BOOST (E), as in
  // TURN. It only listens; TURN's own keyboard controls still drive the car.
  const ownership = createKeyboardDriveOwnership({ getState: () => runtime.state });
  document.addEventListener('keydown', (event) => {
    if (event.repeat || !ownership.accepts(event)) return;
    const forward = keyboardDriveActionForEvent(event) === 'gas' || Boolean(qeDriveZoneForEvent(event));
    if (forward) startRace(runtime, session);
  }, { capture: true });
}

function startRace(runtime, session) {
  const sessionState = session.getState();
  if (!sessionState?.accepted || sessionState.phase !== 'staged' || runtime.state.lapActive) return false;

  const layout = startLayout(runtime.state.competitorLaps?.length || 0);
  prepareRivalLaunchLanes(runtime, layout.rivalOffsets);

  beginTimedLapState({
    state: runtime.state,
    samples: runtime.samples,
    now: performance.now()
  });

  // beginTimedLapState snapshots the exact start-line position. Give the physical
  // gate detector a previous point just beyond the line so the first acceleration
  // does not look like an immediate second crossing and restart the timer.
  const start = runtime.samples[0];
  runtime.state.lapPreviousPosition = {
    x: runtime.state.position.x + start.tangent.x * START_GATE_GUARD_DISTANCE,
    z: runtime.state.position.z + start.tangent.z * START_GATE_GUARD_DISTANCE
  };

  window.dispatchEvent(new CustomEvent('turn:ui-state-change', {
    detail: {
      reason: 'lap-started',
      mode: runtime.state.mode,
      running: runtime.state.running
    }
  }));
  return true;
}

function renderStartGrid(runtime, sessionState, dt) {
  const rivalCount = Math.min(
    sessionState.challengeLaps?.length || 0,
    runtime.competitorCars?.length || 0
  );
  const layout = startLayout(rivalCount);
  const start = runtime.samples[0];
  if (!start) return;

  const normal = start.normal || normalFromTangent(start.tangent);
  const heading = Math.atan2(start.tangent.x, start.tangent.z);
  const surfaceY = trackSurfaceY(start);
  const surfacePitch = trackPitch(start);

  runtime.state.position.copy(start.point).addScaledVector(normal, layout.playerOffset);
  runtime.state.position.y = surfaceY;
  runtime.state.velocity.set(0, 0, 0);
  runtime.state.speed = 0;
  runtime.state.throttle = 0;
  runtime.state.brake = 0;
  runtime.state.heading = heading;
  runtime.state.nearestTrackIndex = 0;
  runtime.state.trackDistance = Math.abs(layout.playerOffset);
  runtime.state.progress = 0;
  runtime.state.lastProgress = 0;
  runtime.state.lapPreviousPosition = {
    x: runtime.state.position.x,
    z: runtime.state.position.z
  };

  // The car waits on its grid slot, but tilt reads exactly as in TURN while it
  // stands still: the front wheels and body follow the steering, and TURN's
  // race camera keeps the horizon level.
  const playerCar = runtime.playerCar;
  playerCar.visible = true;
  playerCar.position.copy(runtime.state.position);
  playerCar.rotation.x = surfacePitch;
  playerCar.rotation.y = heading + Math.PI;
  playerCar.rotation.z = -runtime.state.steering * 0.035;
  runtime.animateWheels(playerCar, runtime.state.steering, 0, dt);

  for (let index = 0; index < runtime.competitorCars.length; index += 1) {
    const car = runtime.competitorCars[index];
    if (!car || index >= rivalCount) {
      if (car) car.visible = false;
      continue;
    }

    car.visible = true;
    car.position.copy(start.point).addScaledVector(normal, layout.rivalOffsets[index] || 0);
    car.position.y = surfaceY;
    car.rotation.x = surfacePitch;
    car.rotation.y = heading + Math.PI;
    car.rotation.z = 0;
    runtime.animateWheels(car, 0, 0, dt);
  }

  updateRaceCameraState({
    state: runtime.state,
    camera: runtime.camera,
    cameraPosition: runtime.cameraPosition,
    cameraTarget: runtime.cameraTarget,
    getForward: runtime.getForward,
    getRight: runtime.getRight,
    samples: runtime.samples,
    maxSpeed: runtime.maxSpeed,
    dt
  });
}

function prepareRivalLaunchLanes(runtime, rivalOffsets) {
  const laps = runtime.state.competitorLaps || [];
  runtime.state.competitorLaps = laps.map((lap, index) => {
    const offset = rivalOffsets[index] || 0;
    if (!offset || !Array.isArray(lap.frames)) return lap;

    return {
      ...lap,
      frames: lap.frames.map((frame) => {
        const fade = THREE.MathUtils.clamp(1 - (Number(frame.t) || 0) / LAUNCH_BLEND_SECONDS, 0, 1);
        if (fade <= 0) return { ...frame };
        const sample = runtime.findNearestTrack(frame).sample;
        const normal = sample.normal || normalFromTangent(sample.tangent);
        return {
          ...frame,
          x: frame.x + normal.x * offset * fade,
          z: frame.z + normal.z * offset * fade
        };
      })
    };
  });
}

function startLayout(rivalCount) {
  const totalCars = Math.max(1, rivalCount + 1);
  const playerSlot = Math.floor((totalCars - 1) / 2);
  const offsets = Array.from(
    { length: totalCars },
    (_, index) => (index - (totalCars - 1) / 2) * GRID_SPACING
  );
  return {
    playerOffset: offsets[playerSlot] || 0,
    rivalOffsets: offsets.filter((_, index) => index !== playerSlot)
  };
}

function normalFromTangent(tangent) {
  return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
}

import * as THREE from 'three';
import { beginTimedLapState } from '/turn/race/lap-system.js';
import { trackPitch, trackSurfaceY } from '/turn/tracks/elevation.js?build=20260725-r67';

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

  const playerCar = runtime.playerCar;
  playerCar.visible = true;
  playerCar.position.copy(runtime.state.position);
  playerCar.rotation.x = surfacePitch;
  playerCar.rotation.y = heading + Math.PI;
  playerCar.rotation.z = 0;
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

  renderGridCamera(runtime, start, heading, dt);
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

function renderGridCamera(runtime, start, heading, dt) {
  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const focus = start.point.clone();
  focus.y = trackSurfaceY(start);

  const desiredCamera = focus.clone().addScaledVector(forward, -20);
  desiredCamera.y += 9;
  runtime.cameraPosition.lerp(desiredCamera, 1 - Math.exp(-dt * 10));
  runtime.camera.position.copy(runtime.cameraPosition);

  const desiredTarget = focus.clone().addScaledVector(forward, 10);
  desiredTarget.y += 1.8;
  runtime.cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 11));
  runtime.camera.up.set(0, 1, 0);
  runtime.camera.lookAt(runtime.cameraTarget);
}

function normalFromTangent(tangent) {
  return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
}

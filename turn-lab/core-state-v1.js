(() => {
  const upstreamFetch = window.fetch.bind(window);
  const gameStateModuleUrl = new URL('/turn-lab/race/game-state.js', location.origin).href;
  const lapSystemModuleUrl = new URL('/turn-lab/race/lap-system.js', location.origin).href;
  const replaySystemModuleUrl = new URL('/turn-lab/race/replay-system.js', location.origin).href;
  const rivalStorageModuleUrl = new URL('/turn-lab/race/rival-storage.js', location.origin).href;

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN core state bridge not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    source = replaceRequired(
      source,
      "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';",
      `import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';
import { GAME_MODE, installGameModeState, prepareRaceStartState, resetRaceToStage, setGameModeState } from '${gameStateModuleUrl}';
import { beginTimedLapState, completeLapState, updateLapProgressState } from '${lapSystemModuleUrl}';
import { recordReplayFrame, replayFrameAt } from '${replaySystemModuleUrl}';
import { RIVAL_LIMIT, loadRivalsState, saveRivalsState } from '${rivalStorageModuleUrl}';`,
      'race module imports'
    );

    // Preserve the verified lighter drift balance after removing the old spectator source patch.
    source = replaceRequired(
      source,
      '(state.offRoad ? 36 : 43) * (driftHeld ? 0.86 : 1);',
      '(state.offRoad ? 36 : 43) * (driftHeld ? 0.93 : 1);',
      'lighter drift power penalty'
    );
    source = replaceRequired(
      source,
      '0.11 + speed * 0.0009 + (driftHeld ? 0.15 : 0);',
      '0.11 + speed * 0.0009 + (driftHeld ? 0.085 : 0);',
      'lighter drift drag penalty'
    );

    source = replaceRequired(
      source,
      `const scene = new THREE.Scene();`,
      `installGameModeState(state);

function setGameMode(mode) {
  return setGameModeState(state, mode);
}

globalThis.__turnGameModes = GAME_MODE;
globalThis.__turnGetGameMode = () => state.mode;

const scene = new THREE.Scene();`,
      'module-backed game mode state'
    );

    source = replaceRequired(
      source,
      /function resetCar\(showFeedback = true\) \{[\s\S]*?\n\}\n\nfunction motionPoseFromGravity/,
      `function resetCar(showFeedback = true) {
  resetRaceToStage({
    state,
    samples,
    showFeedback,
    showMessage,
    setRacePosition: globalThis.__turnSetRacePosition
  });
}

function motionPoseFromGravity`,
      'module-backed staged reset'
    );

    source = replaceRequired(
      source,
      `  state.lastFrame = performance.now();
  state.lapStartedAt = 0;
  state.lapElapsed = 0;`,
      `  state.lastFrame = performance.now();
  prepareRaceStartState(state);`,
      'module-backed race start timer'
    );

    source = replaceRequired(
      source,
      `function updatePhysics(dt, now) {`,
      `function beginTimedLap(now) {
  beginTimedLapState({ state, samples, now, showMessage });
}

function updatePhysics(dt, now) {`,
      'module-backed timed lap start'
    );

    source = replaceRequired(
      source,
      /function recordGhostFrame\(\) \{[\s\S]*?\n\}\n\nfunction completeLap/,
      `function recordGhostFrame() {
  recordReplayFrame(state);
}

function completeLap`,
      'module-backed replay recording'
    );

    source = replaceRequired(
      source,
      /function completeLap\(now\) \{[\s\S]*?\n\}\n\nfunction saveGhost\(\) \{/,
      `function completeLap(now) {
  completeLapState({
    state,
    samples,
    now,
    competitorLimit: RIVAL_LIMIT,
    saveGhost,
    showMessage,
    onError(error) {
      console.error('TURN: completed lap could not be added to rivals, continuing race.', error);
      globalThis.__turnLastLapError = error;
    }
  });
}

function saveGhost() {`,
      'module-backed lap completion'
    );

    source = replaceRequired(
      source,
      /function saveGhost\(\) \{[\s\S]*?\n\}\n\nfunction loadGhost\(\) \{[\s\S]*?\n\}\n\nfunction lapFrameAt\(lap, time\) \{[\s\S]*?\n\}\n\nfunction ghostFrameAt/,
      `function saveGhost() {
  saveRivalsState(state);
}

function loadGhost() {
  loadRivalsState({ state, samples, findNearestTrack });
}

function lapFrameAt(lap, time) {
  return replayFrameAt(lap, time);
}

function ghostFrameAt`,
      'module-backed rival storage and replay interpolation'
    );

    source = replaceRequired(
      source,
      `  const crossedStart = state.lastProgress > 0.82 && state.progress < 0.18;
  const movingForwardAtStart = state.velocity.dot(samples[0].tangent) > 5;
  if (crossedStart && movingForwardAtStart && state.trackDistance < TRACK_WIDTH * 0.8) completeLap(now);

  state.lapElapsed = (now - state.lapStartedAt) / 1000;
  recordGhostFrame();`,
      `  updateLapProgressState({
    state,
    nearestAfter,
    samples,
    trackWidth: TRACK_WIDTH,
    checkpoints: LAP_CHECKPOINTS,
    now,
    beginTimedLap,
    completeLap,
    recordGhostFrame
  });`,
      'module-backed checkpoint and start-line flow'
    );

    source = replaceRequired(
      source,
      /function refreshCompetitorLabels\(\) \{[\s\S]*?\n\}\n\nfunction ensureCompetitorCars\(\) \{/,
      `function refreshCompetitorLabels() {
  // Ghost identity is owned by the standalone spectator HUD.
}

function ensureCompetitorCars() {`,
      'disable legacy 3D ghost labels'
    );

    source = replaceRequired(
      source,
      `    const car = ghostCar.clone(true);\n    car.visible = false;`,
      `    const car = ghostCar.clone(true);\n    car.userData.frontWheelPivots = [];\n    car.userData.wheelSpinners = [];\n    car.visible = false;`,
      'sanitize cloned competitor wheel references'
    );

    source = replaceRequired(
      source,
      `    car.rotation.y = frame.h + Math.PI;
    car.rotation.z = -frame.s * 0.03;`,
      `    car.rotation.y = frame.h + Math.PI;
    car.rotation.z = -frame.s * 0.03;
    if (car === ghostCar) animateWheels(car, frame.s, 45, dt);`,
      'preserve safe rival wheel animation'
    );

    // Keep the verified simple pink minimap and explicit start/finish marker.
    source = source.replace(
      /  mapCtx\.lineWidth = 8;\n  for \(let section = 0; section < TRACK_SECTION_COLORS\.length; section \+= 1\) \{[\s\S]*?\n  \}/,
      `  mapCtx.strokeStyle = '#ff4fa3';
  mapCtx.lineWidth = 8;
  mapCtx.stroke();

  const startPoint = mapPoint(samples[0].point);
  const beforeStart = mapPoint(samples[samples.length - 4].point);
  const afterStart = mapPoint(samples[4].point);
  const startDx = afterStart.x - beforeStart.x;
  const startDy = afterStart.y - beforeStart.y;
  const startLength = Math.max(0.001, Math.hypot(startDx, startDy));
  const startNx = -startDy / startLength;
  const startNy = startDx / startLength;
  mapCtx.beginPath();
  mapCtx.moveTo(startPoint.x - startNx * 11, startPoint.y - startNy * 11);
  mapCtx.lineTo(startPoint.x + startNx * 11, startPoint.y + startNy * 11);
  mapCtx.strokeStyle = '#08090a';
  mapCtx.lineWidth = 9;
  mapCtx.stroke();
  mapCtx.strokeStyle = '#fff8e8';
  mapCtx.lineWidth = 5;
  mapCtx.stroke();`
    );

    source = replaceRequired(
      source,
      `function updateScene(dt) {`,
      `function updateScene(dt) {
  if (globalThis.__turnRuntime?.runSceneOverride?.(dt)) return;`,
      'runtime scene override hook'
    );

    source = replaceRequired(
      source,
      `renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.035, Math.max(0.001, (now - state.lastFrame) / 1000));
  state.lastFrame = now;

  if (state.running) {
    updatePhysics(dt, now);
    updateScene(dt);
    updateHud();
  } else {
    const preview = samples[Math.floor((now * 0.012) % TRACK_SAMPLES)];
    playerCar.position.copy(preview.point);
    playerCar.position.y = 0.18;
    playerCar.rotation.y = Math.atan2(preview.tangent.x, preview.tangent.z) + Math.PI;
    animateWheels(playerCar, Math.sin(now * 0.001) * 0.3, 28, dt);
    camera.position.set(0, 110, 215);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
});`,
      `const MAX_PHYSICS_STEP = 1 / 60;
const MAX_FRAME_CATCHUP = 0.12;

renderer.setAnimationLoop((now) => {
  const frameDt = Math.min(MAX_FRAME_CATCHUP, Math.max(0.001, (now - state.lastFrame) / 1000));
  const frameStart = now - frameDt * 1000;
  state.lastFrame = now;

  if (state.running) {
    const physicsSteps = Math.max(1, Math.ceil(frameDt / MAX_PHYSICS_STEP));
    const physicsDt = frameDt / physicsSteps;

    for (let step = 1; step <= physicsSteps; step += 1) {
      updatePhysics(physicsDt, frameStart + physicsDt * step * 1000);
    }

    updateScene(frameDt);
    updateHud();
  } else {
    const preview = samples[Math.floor((now * 0.012) % TRACK_SAMPLES)];
    playerCar.position.copy(preview.point);
    playerCar.position.y = 0.18;
    playerCar.rotation.y = Math.atan2(preview.tangent.x, preview.tangent.z) + Math.PI;
    animateWheels(playerCar, Math.sin(now * 0.001) * 0.3, 28, frameDt);
    camera.position.set(0, 110, 215);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
});`,
      'frame-rate independent physics substeps'
    );

    source = replaceRequired(
      source,
      `const MAX_PHYSICS_STEP = 1 / 60;`,
      `let turnSceneOverride = null;
const turnRuntime = {
  state,
  samples,
  camera,
  cameraPosition,
  cameraTarget,
  playerCar,
  ghostCar,
  competitorCars,
  ensureCompetitorCars,
  animateWheels,
  lapFrameAt,
  GAME_MODE,
  setGameMode,
  setRacePosition(position, total) {
    globalThis.__turnSetRacePosition?.(position, total);
  },
  setSceneOverride(override) {
    turnSceneOverride = typeof override === 'function' ? override : null;
  },
  runSceneOverride(dt) {
    return turnSceneOverride ? turnSceneOverride(dt) === true : false;
  }
};
globalThis.__turnRuntime = turnRuntime;
window.dispatchEvent(new CustomEvent('turn:runtime-ready', { detail: turnRuntime }));

const MAX_PHYSICS_STEP = 1 / 60;`,
      'publish TURN runtime bridge'
    );

    return source;
  }

  window.fetch = async (input, init) => {
    const response = await upstreamFetch(input, init);
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!url.pathname.endsWith('/turn/game.js')) return response;

      const source = await response.text();
      const patched = patchGameSource(source);
      return new Response(patched, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.warn('TURN core state bridge failed, using upstream game source.', error);
      return response;
    }
  };
})();

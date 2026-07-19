(() => {
  const upstreamFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN core state bridge not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    // Introduce one explicit race mode without forcing the remaining legacy systems to migrate
    // all at once. lapActive becomes a compatibility view over the canonical mode value.
    source = replaceRequired(
      source,
      `const LAP_CHECKPOINTS = [0.18, 0.38, 0.58, 0.78];`,
      `const LAP_CHECKPOINTS = [0.18, 0.38, 0.58, 0.78];
const GAME_MODE = Object.freeze({
  STAGED: 'staged',
  RACING: 'racing',
  SPECTATING: 'spectating'
});`,
      'game mode constants'
    );

    source = replaceRequired(
      source,
      `  lapCheckpointIndex: 0,
  lapActive: false,`,
      `  lapCheckpointIndex: 0,
  mode: GAME_MODE.STAGED,
  lapActive: false,`,
      'canonical mode state'
    );

    source = replaceRequired(
      source,
      `const scene = new THREE.Scene();`,
      `Object.defineProperty(state, 'lapActive', {
  configurable: true,
  enumerable: true,
  get() {
    return state.mode === GAME_MODE.RACING;
  },
  set(active) {
    if (active) {
      state.mode = GAME_MODE.RACING;
    } else if (state.mode === GAME_MODE.RACING) {
      state.mode = GAME_MODE.STAGED;
    }
  }
});

function setGameMode(mode) {
  if (!Object.values(GAME_MODE).includes(mode)) {
    console.warn('TURN: ignored unknown game mode', mode);
    return state.mode;
  }
  state.mode = mode;
  return state.mode;
}

globalThis.__turnGameModes = GAME_MODE;
globalThis.__turnGetGameMode = () => state.mode;

const scene = new THREE.Scene();`,
      'game mode compatibility bridge'
    );

    // Spectator state is still owned by the existing spectator feature for now, but it must keep
    // the canonical game mode synchronized so later refactor steps can depend on one state model.
    source = replaceRequired(
      source,
      `  spectate.active = true;
  spectate.index = 0;`,
      `  spectate.active = true;
  setGameMode(GAME_MODE.SPECTATING);
  spectate.index = 0;`,
      'spectator mode entry'
    );

    source = replaceRequired(
      source,
      `  spectate.active = false;
  spectate.elapsed = 0;`,
      `  spectate.active = false;
  setGameMode(GAME_MODE.STAGED);
  spectate.elapsed = 0;`,
      'spectator mode exit'
    );

    // Ghost identity lives in the spectator HUD. Keep 3D label allocation out of the race loop.
    source = replaceRequired(
      source,
      /function refreshCompetitorLabels\(\) \{[\s\S]*?\n\}\n\nfunction ensureCompetitorCars\(\) \{/,
      `function refreshCompetitorLabels() {
  // Intentionally empty. Ghost labels are shown only in the spectator HUD.
}

function ensureCompetitorCars() {`,
      'disable 3D ghost labels'
    );

    // Keep lap completion crash-safe and preserve the exact recorded start frame used by rivals.
    source = replaceRequired(
      source,
      /function completeLap\(now\) \{[\s\S]*?\n\}\n\nfunction saveGhost\(\) \{/,
      `function completeLap(now) {
  const finishedTime = (now - state.lapStartedAt) / 1000;
  const validLap = finishedTime > 5 && state.recording.length > 20;

  if (validLap) {
    const previousBest = state.bestTime;
    let message = 'LAP ' + formatTime(finishedTime);

    try {
      const candidateFrames = state.recording.map((frame) => ({ ...frame }));
      if (candidateFrames.length) {
        const start = samples[0];
        candidateFrames[0] = {
          ...candidateFrames[0],
          t: 0,
          x: start.point.x,
          z: start.point.z,
          h: Math.atan2(start.tangent.x, start.tangent.z),
          p: 0
        };
      }

      const candidate = {
        time: finishedTime,
        hitAt: Date.now(),
        frames: candidateFrames
      };

      const nextLaps = [...state.competitorLaps, candidate]
        .filter((lap) => Number.isFinite(lap?.time) && Array.isArray(lap?.frames) && lap.frames.length > 20)
        .sort((a, b) => a.time - b.time)
        .slice(0, COMPETITOR_LIMIT);

      const rank = nextLaps.indexOf(candidate);
      state.competitorLaps = nextLaps;
      state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
      state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
      state.ghostVisible = state.competitorLaps.length > 0;
      saveGhost();

      if (finishedTime < previousBest) {
        message = 'NEW BEST ' + formatTime(finishedTime);
      } else if (rank >= 0) {
        message = 'TOP ' + (rank + 1) + ' LAP ' + formatTime(finishedTime);
      }
    } catch (error) {
      console.error('TURN: completed lap could not be added to rivals, continuing race.', error);
      globalThis.__turnLastLapError = error;
    }

    showMessage(message);
  }

  state.lapCheckpointIndex = 0;
  state.lapActive = true;
  state.lap += 1;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [];
}

function saveGhost() {`,
      'crash-safe lap completion'
    );

    // Three.js clones JSON-style userData values. Never treat cloned wheel references as Object3D.
    source = replaceRequired(
      source,
      `    const car = ghostCar.clone(true);\n    car.visible = false;`,
      `    const car = ghostCar.clone(true);\n    car.userData.frontWheelPivots = [];\n    car.userData.wheelSpinners = [];\n    car.visible = false;`,
      'sanitize cloned competitor wheel references'
    );

    source = replaceRequired(
      source,
      '    animateWheels(car, frame.s, 45, dt);',
      `    if (car === ghostCar) animateWheels(car, frame.s, 45, dt);`,
      'avoid wheel animation on cloned competitors'
    );

    // Unknown historical timestamps are null. Avoid Number(null) turning them into 1970 dates.
    source = replaceRequired(
      source,
      `function spectateDateLabel(lap) {
  const hitAt = Number(lap?.hitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record';`,
      `function spectateDateLabel(lap) {
  const rawHitAt = lap?.hitAt;
  const hitAt = rawHitAt == null ? NaN : Number(rawHitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record';`,
      'null-safe spectator timestamp'
    );

    source = source.replaceAll(
      `    const otherHitAt = Number(other?.hitAt);
    return Number.isFinite(otherHitAt) && sameSpectateDate(new Date(otherHitAt), date);`,
      `    const rawOtherHitAt = other?.hitAt;
    const otherHitAt = rawOtherHitAt == null ? NaN : Number(rawOtherHitAt);
    return Number.isFinite(otherHitAt) && sameSpectateDate(new Date(otherHitAt), date);`
    );

    // Preserve high-frame-rate handling and substep only slower frames instead of discarding time.
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
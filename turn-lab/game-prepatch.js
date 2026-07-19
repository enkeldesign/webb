(() => {
  const nativeFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN prepatch not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    source = replaceRequired(
      source,
      `  const steeringRoll = normalizeAngle(state.roll - state.neutralRoll);
  const linearSteer = THREE.MathUtils.clamp(steeringRoll / MAX_STEER_ROLL, -1, 1);
  state.steering = Math.sign(linearSteer) * Math.pow(Math.abs(linearSteer), 0.78);`,
      `  const steeringRoll = normalizeAngle(state.roll - state.neutralRoll);
  const steeringDeadzone = THREE.MathUtils.degToRad(1.4);
  const steeringMagnitude = Math.abs(steeringRoll);
  let desiredSteering = 0;

  if (steeringMagnitude > steeringDeadzone) {
    const availableRoll = Math.max(0.001, MAX_STEER_ROLL - steeringDeadzone);
    const linearSteer = THREE.MathUtils.clamp(
      (steeringMagnitude - steeringDeadzone) / availableRoll,
      0,
      1
    );
    desiredSteering = -Math.sign(steeringRoll) * Math.pow(linearSteer, 0.78);
  }

  const steeringResponse = 1 - Math.exp(-dt * 7.5);
  state.steering = THREE.MathUtils.lerp(state.steering, desiredSteering, steeringResponse);`,
      'cushioned motion steering'
    );

    source = replaceRequired(
      source,
      "const GHOST_KEY = 'turn-three-ghost-v4';",
      "const GHOST_KEY = 'turn-three-ghost-v4';\nconst COMPETITOR_KEY = 'turn-personal-rivals-v1';\nconst COMPETITOR_LIMIT = 4;\nconst COMPETITOR_MIGRATION_KEY = 'turn-rival-timestamp-migration-v1';",
      'competitor compatibility constants'
    );

    source = replaceRequired(
      source,
      '  ghostVisible: false,',
      '  ghostVisible: false,\n  competitorLaps: [],',
      'competitor lap state'
    );

    source = replaceRequired(
      source,
      `world.add(ghostCar);

const skidGeometry`,
      `world.add(ghostCar);

const COMPETITOR_COLORS = [0x38d9ff, 0xff4fa3, 0x9775fa, 0xff922b];
const COMPETITOR_MAP_COLORS = ['#38d9ff', '#ff4fa3', '#9775fa', '#ff922b'];
const baseGhostChildCount = ghostCar.children.length;
const competitorCars = [ghostCar];

function styleCompetitorCar(car, color) {
  car.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const styled = materials.map((material) => {
      const clone = material.clone();
      clone.transparent = false;
      clone.opacity = 1;
      clone.depthWrite = true;
      if (/paint/i.test(clone.name || '')) clone.color?.set(color);
      return clone;
    });
    node.material = Array.isArray(node.material) ? styled : styled[0];
    node.castShadow = true;
  });
}

function refreshCompetitorLabels() {
  // Rival identity is rendered by the spectator HUD, not as 3D labels.
}

function ensureCompetitorCars() {
  if (ghostCar.children.length <= baseGhostChildCount) return;

  while (competitorCars.length < COMPETITOR_LIMIT) {
    const car = ghostCar.clone(true);
    car.visible = false;
    world.add(car);
    competitorCars.push(car);
  }

  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    if (car.userData.turnCompetitorStyled) continue;
    styleCompetitorCar(car, COMPETITOR_COLORS[i]);
    car.userData.turnCompetitorStyled = true;
  }
}

const skidGeometry`,
      'personal rival cars'
    );

    source = source.replace(
      /function completeLap\(now\) \{[\s\S]*?\nfunction animateWheels\(car, steering, speed, dt\) \{/,
      `function completeLap(now) {
  const finishedTime = (now - state.lapStartedAt) / 1000;
  const validLap = finishedTime > 5 && state.recording.length > 20;
  if (validLap && finishedTime < state.bestTime) {
    state.bestTime = finishedTime;
    state.ghostFrames = state.recording.slice();
    state.ghostVisible = true;
    saveGhost();
    showMessage('NEW BEST ' + formatTime(finishedTime));
  } else if (validLap) {
    showMessage('LAP ' + formatTime(finishedTime));
  }
  state.lap += 1;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [];
}

function saveGhost() {
  // Replaced by race/rival-storage.js through the core bridge.
}

function loadGhost() {
  // Replaced by race/rival-storage.js through the core bridge.
}

function lapFrameAt(lap, time) {
  return null;
}

function ghostFrameAt(time) {
  const bestLap = state.competitorLaps[0];
  return bestLap ? lapFrameAt(bestLap, time) : null;
}

function animateWheels(car, steering, speed, dt) {`
    );

    source = source.replace(
      /function placeGhostCar\(dt\) \{[\s\S]*?\n\}\n\nfunction updateScene\(dt\) \{/,
      `function placeCompetitorCars(dt) {
  ensureCompetitorCars();

  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    if (!lap || !state.lapActive) {
      car.visible = false;
      continue;
    }

    const frame = lapFrameAt(lap, state.lapElapsed);
    if (!frame) {
      car.visible = false;
      continue;
    }

    car.visible = true;
    car.position.set(frame.x, 0.18, frame.z);
    car.rotation.y = frame.h + Math.PI;
    car.rotation.z = -frame.s * 0.03;
  }
}

function updateScene(dt) {`
    );

    source = replaceRequired(source, '  placeGhostCar(dt);', '  placeCompetitorCars(dt);', 'personal rival placement');

    source = source.replace(
      /  if \(state\.ghostVisible\) \{[\s\S]*?\n  \}\n\}\n\nfunction formatTime/,
      `  if (state.lapActive) {
    for (let i = 0; i < state.competitorLaps.length; i += 1) {
      const rival = lapFrameAt(state.competitorLaps[i], state.lapElapsed);
      if (!rival) continue;
      const rivalPoint = mapPoint({ x: rival.x, z: rival.z });
      mapCtx.beginPath();
      mapCtx.arc(rivalPoint.x, rivalPoint.y, 6, 0, TAU);
      mapCtx.fillStyle = COMPETITOR_MAP_COLORS[i] || '#38d9ff';
      mapCtx.fill();
      mapCtx.strokeStyle = '#08090a';
      mapCtx.lineWidth = 3;
      mapCtx.stroke();
    }
  }
}

function formatTime`
    );

    return source;
  }

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
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
      console.warn('TURN: prepatch failed, using original game source.', error);
      return response;
    }
  };
})();

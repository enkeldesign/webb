(() => {
  const nativeFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN prepatch not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    // Keep the responsive steering range, but ignore tiny phone tremors and ease into changes.
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
      "const GHOST_KEY = 'turn-three-ghost-v4';\nconst COMPETITOR_KEY = 'turn-personal-rivals-v1';",
      'competitor storage key'
    );

    source = replaceRequired(
      source,
      '  ghostVisible: false,',
      '  ghostVisible: false,\n  competitorLaps: [],',
      'competitor lap state'
    );

    // Preserve the original ghost block verbatim so motion-adapter.js can still replace it
    // with the Kenney sedan asset. Extra rivals are cloned lazily once that asset has loaded.
    source = replaceRequired(
      source,
      `world.add(ghostCar);

const skidGeometry`,
      `world.add(ghostCar);

const COMPETITOR_COLORS = [0x38d9ff, 0xff4fa3, 0x9775fa];
const COMPETITOR_MAP_COLORS = ['#38d9ff', '#ff4fa3', '#9775fa'];
const baseGhostChildCount = ghostCar.children.length;
const competitorCars = [ghostCar];
let competitorCarsStyled = false;

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

function ensureCompetitorCars() {
  // The Kenney asset installer adds one child to ghostCar asynchronously.
  if (ghostCar.children.length <= baseGhostChildCount) return;

  if (!competitorCarsStyled) {
    styleCompetitorCar(ghostCar, COMPETITOR_COLORS[0]);
    competitorCarsStyled = true;
  }

  while (competitorCars.length < 3) {
    const car = ghostCar.clone(true);
    car.visible = false;
    styleCompetitorCar(car, COMPETITOR_COLORS[competitorCars.length]);
    world.add(car);
    competitorCars.push(car);
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

  if (validLap) {
    const previousBest = state.bestTime;
    const candidate = {
      time: finishedTime,
      frames: state.recording.slice()
    };

    state.competitorLaps = [...state.competitorLaps, candidate]
      .filter((lap) => Number.isFinite(lap.time) && Array.isArray(lap.frames) && lap.frames.length > 20)
      .sort((a, b) => a.time - b.time)
      .slice(0, 3);

    state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
    state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
    state.ghostVisible = state.competitorLaps.length > 0;
    saveGhost();

    const rank = state.competitorLaps.indexOf(candidate);
    if (finishedTime < previousBest) {
      showMessage(\`NEW BEST \${formatTime(finishedTime)}\`);
    } else if (rank >= 0) {
      showMessage(\`TOP \${rank + 1} LAP \${formatTime(finishedTime)}\`);
    } else {
      showMessage(\`LAP \${formatTime(finishedTime)}\`);
    }
  }

  state.lap += 1;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [];
}

function saveGhost() {
  try {
    localStorage.setItem(
      COMPETITOR_KEY,
      JSON.stringify({ version: 1, laps: state.competitorLaps })
    );
  } catch (_) {}
}

function loadGhost() {
  try {
    const savedRivals = JSON.parse(localStorage.getItem(COMPETITOR_KEY));
    let laps = Array.isArray(savedRivals?.laps) ? savedRivals.laps : [];

    // Migrate the old single best-lap ghost the first time this version is opened.
    if (!laps.length) {
      const oldGhost = JSON.parse(localStorage.getItem(GHOST_KEY));
      if (
        oldGhost &&
        Number.isFinite(oldGhost.bestTime) &&
        Array.isArray(oldGhost.frames) &&
        oldGhost.frames.length > 20
      ) {
        laps = [{ time: oldGhost.bestTime, frames: oldGhost.frames }];
      }
    }

    state.competitorLaps = laps
      .filter((lap) => Number.isFinite(lap?.time) && Array.isArray(lap?.frames) && lap.frames.length > 20)
      .sort((a, b) => a.time - b.time)
      .slice(0, 3);

    state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
    state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
    state.ghostVisible = state.competitorLaps.length > 0;

    if (state.competitorLaps.length) saveGhost();
  } catch (_) {}
}

function lapFrameAt(lap, time) {
  const frames = lap?.frames || [];
  if (frames.length < 2) return null;

  const wrappedTime = Number.isFinite(lap.time) ? time % lap.time : time;
  let low = 0;
  let high = frames.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].t < wrappedTime) low = mid + 1;
    else high = mid;
  }

  const b = frames[low];
  const a = frames[Math.max(0, low - 1)];
  const span = Math.max(0.001, b.t - a.t);
  const alpha = THREE.MathUtils.clamp((wrappedTime - a.t) / span, 0, 1);

  return {
    x: THREE.MathUtils.lerp(a.x, b.x, alpha),
    z: THREE.MathUtils.lerp(a.z, b.z, alpha),
    h: lerpAngle(a.h, b.h, alpha),
    s: THREE.MathUtils.lerp(a.s, b.s, alpha),
    d: THREE.MathUtils.lerp(a.d, b.d, alpha)
  };
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

    if (!lap) {
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

    source = replaceRequired(
      source,
      '  placeGhostCar(dt);',
      '  placeCompetitorCars(dt);',
      'personal rival placement'
    );

    // Show every saved rival on the minimap instead of only the old single ghost.
    source = source.replace(
      /  if \(state\.ghostVisible\) \{[\s\S]*?\n  \}\n\}\n\nfunction formatTime/,
      `  for (let i = 0; i < state.competitorLaps.length; i += 1) {
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
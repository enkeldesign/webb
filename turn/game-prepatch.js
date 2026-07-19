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
      'competitor storage keys'
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

function sameLocalDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function ghostTimeLabel(date) {
  return date.getHours().toString().padStart(2, '0') + '.'
    + date.getMinutes().toString().padStart(2, '0');
}

function ghostNameForLap(lap, allLaps) {
  const hitAt = Number(lap?.hitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record';

  const date = new Date(hitAt);
  const now = new Date();
  const time = ghostTimeLabel(date);

  if (sameLocalDate(date, now)) return 'Today ' + time;

  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const mondayOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - mondayOffset);

  if (date >= weekStart && date < now) {
    const weekday = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date);
    return weekday + ' ' + time;
  }

  const duplicateDate = allLaps.filter((other) => {
    const otherHitAt = Number(other?.hitAt);
    return Number.isFinite(otherHitAt) && sameLocalDate(new Date(otherHitAt), date);
  }).length > 1;

  const month = new Intl.DateTimeFormat('en', { month: 'long' }).format(date);
  const base = date.getFullYear() === now.getFullYear()
    ? month + ' ' + date.getDate()
    : month + ' ' + date.getDate() + ', ' + date.getFullYear();

  return duplicateDate ? base + ', ' + time : base;
}

function makeGhostLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  const colorCss = '#' + color.toString(16).padStart(6, '0');

  ctx.fillStyle = 'rgba(255, 248, 232, 0.96)';
  ctx.strokeStyle = '#08090a';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.roundRect(8, 8, 624, 96, 34);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colorCss;
  ctx.fillRect(30, 44, 30, 30);
  ctx.strokeStyle = '#08090a';
  ctx.lineWidth = 5;
  ctx.strokeRect(30, 44, 30, 30);

  ctx.fillStyle = '#08090a';
  ctx.font = '900 42px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 355, 57, 520);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  }));
  sprite.scale.set(13.2, 2.3, 1);
  sprite.position.set(0, 5.7, 0);
  sprite.renderOrder = 50;
  sprite.userData.turnGhostLabel = true;
  sprite.userData.turnGhostLabelText = text;
  return sprite;
}

function refreshCompetitorLabels() {
  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    const existing = car.children.find((child) => child.userData?.turnGhostLabel);
    if (!lap) {
      if (existing) car.remove(existing);
      continue;
    }
    const text = ghostNameForLap(lap, state.competitorLaps);
    if (existing?.userData?.turnGhostLabelText === text) continue;
    if (existing) car.remove(existing);
    car.add(makeGhostLabel(text, COMPETITOR_COLORS[i]));
  }
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
  refreshCompetitorLabels();
}

const skidGeometry`,
      'personal rival cars and labels'
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
      hitAt: Date.now(),
      frames: state.recording.slice()
    };

    state.competitorLaps = [...state.competitorLaps, candidate]
      .filter((lap) => Number.isFinite(lap.time) && Array.isArray(lap.frames) && lap.frames.length > 20)
      .sort((a, b) => a.time - b.time)
      .slice(0, COMPETITOR_LIMIT);

    state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
    state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
    state.ghostVisible = state.competitorLaps.length > 0;
    saveGhost();
    refreshCompetitorLabels();

    const rank = state.competitorLaps.indexOf(candidate);
    if (finishedTime < previousBest) {
      showMessage('NEW BEST ' + formatTime(finishedTime));
    } else if (rank >= 0) {
      showMessage('TOP ' + (rank + 1) + ' LAP ' + formatTime(finishedTime));
    } else {
      showMessage('LAP ' + formatTime(finishedTime));
    }
  }

  state.lap += 1;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [];
}

function saveGhost() {
  try {
    localStorage.setItem(COMPETITOR_KEY, JSON.stringify({ version: 2, laps: state.competitorLaps }));
  } catch (_) {}
}

function loadGhost() {
  try {
    const savedRivals = JSON.parse(localStorage.getItem(COMPETITOR_KEY));
    let laps = Array.isArray(savedRivals?.laps) ? savedRivals.laps : [];

    if (!laps.length) {
      const oldGhost = JSON.parse(localStorage.getItem(GHOST_KEY));
      if (oldGhost && Number.isFinite(oldGhost.bestTime) && Array.isArray(oldGhost.frames) && oldGhost.frames.length > 20) {
        laps = [{ time: oldGhost.bestTime, frames: oldGhost.frames }];
      }
    }

    let migrationBase = Number(localStorage.getItem(COMPETITOR_MIGRATION_KEY));
    if (!Number.isFinite(migrationBase)) {
      migrationBase = Date.now();
      localStorage.setItem(COMPETITOR_MIGRATION_KEY, String(migrationBase));
    }

    const start = samples[0];
    const startHeading = Math.atan2(start.tangent.x, start.tangent.z);

    state.competitorLaps = laps
      .filter((lap) => Number.isFinite(lap?.time) && Array.isArray(lap?.frames) && lap.frames.length > 20)
      .map((lap, index) => {
        const frames = lap.frames.map((frame) => ({ ...frame }));
        if (frames.length) {
          frames[0] = {
            ...frames[0],
            t: 0,
            x: start.point.x,
            z: start.point.z,
            h: startHeading,
            p: 0
          };
        }
        return {
          ...lap,
          hitAt: Number.isFinite(Number(lap.hitAt)) ? Number(lap.hitAt) : migrationBase - index * 60000,
          frames
        };
      })
      .sort((a, b) => a.time - b.time)
      .slice(0, COMPETITOR_LIMIT);

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
    d: THREE.MathUtils.lerp(a.d, b.d, alpha),
    p: Number.isFinite(a.p) && Number.isFinite(b.p) ? THREE.MathUtils.lerp(a.p, b.p, alpha) : null
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
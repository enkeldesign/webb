import * as THREE from 'three';
import { GAME_MODE } from '../race/game-state.js';
import { replayFrameAt } from '../race/replay-system.js';

const spectate = {
  active: false,
  index: 0,
  startedAt: 0,
  elapsed: 0,
  snapshot: null
};

globalThis.__turnSpectateV3 = spectate;

function waitForRuntime() {
  if (globalThis.__turnRuntime) {
    install(globalThis.__turnRuntime);
    return;
  }

  window.addEventListener('turn:runtime-ready', (event) => {
    install(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

function install(runtime) {
  if (!runtime || runtime.__spectateInstalled) return;
  runtime.__spectateInstalled = true;

  runtime.setSceneOverride((dt) => updateSpectatorScene(runtime, dt));
  installPublicApi(runtime);
  installUi(runtime);
}

function updateSpectatorScene(runtime, dt) {
  if (!spectate.active) return false;

  const {
    state,
    camera,
    cameraPosition,
    cameraTarget,
    playerCar,
    ghostCar,
    competitorCars,
    ensureCompetitorCars,
    animateWheels
  } = runtime;

  spectate.elapsed = (performance.now() - spectate.startedAt) / 1000;
  playerCar.visible = false;
  ensureCompetitorCars();

  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    hideCompetitorLabels(car);

    if (!lap) {
      car.visible = false;
      continue;
    }

    const frame = replayFrameAt(lap, spectate.elapsed);
    if (!frame) {
      car.visible = false;
      continue;
    }

    car.visible = true;
    car.position.set(frame.x, 0.18, frame.z);
    car.rotation.y = frame.h + Math.PI;
    car.rotation.z = -frame.s * 0.03;
    if (car === ghostCar) animateWheels(car, frame.s, 45, dt);
  }

  const lap = state.competitorLaps[spectate.index];
  const frame = lap ? replayFrameAt(lap, spectate.elapsed) : null;
  if (!frame) return true;

  const focus = new THREE.Vector3(frame.x, 0.18, frame.z);
  const forward = new THREE.Vector3(Math.sin(frame.h), 0, Math.cos(frame.h));
  const desiredCamera = focus.clone().addScaledVector(forward, -18.5);
  desiredCamera.y = 8.6;
  cameraPosition.lerp(desiredCamera, 1 - Math.exp(-dt * 7.2));
  camera.position.copy(cameraPosition);

  const desiredTarget = focus.clone().addScaledVector(forward, 13.5);
  desiredTarget.y = 2.15;
  cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 9));
  camera.up.set(0, 1, 0);
  camera.lookAt(cameraTarget);
  camera.fov = THREE.MathUtils.lerp(camera.fov, 72, Math.min(1, dt * 6));
  camera.updateProjectionMatrix();
  return true;
}

function installPublicApi(runtime) {
  const { state, playerCar, competitorCars } = runtime;

  globalThis.__turnGetSpectateV3State = () => {
    const lap = state.competitorLaps[spectate.index];
    return {
      available: Boolean(state.running && !state.lapActive && !spectate.active && state.competitorLaps.length),
      active: spectate.active,
      index: spectate.index,
      total: state.competitorLaps.length,
      name: spectateDateLabel(lap, state.competitorLaps),
      record: lap ? formatTime(lap.time) : ''
    };
  };

  globalThis.__turnStartSpectateV3 = () => {
    if (!state.running || state.lapActive || spectate.active || !state.competitorLaps.length) return false;

    spectate.snapshot = {
      position: state.position.clone(),
      heading: state.heading,
      progress: state.progress,
      lastProgress: state.lastProgress,
      nearestTrackIndex: state.nearestTrackIndex
    };
    spectate.active = true;
    spectate.index = 0;
    spectate.startedAt = performance.now();
    spectate.elapsed = 0;

    runtime.setGameMode(GAME_MODE.SPECTATING);
    state.velocity.set(0, 0, 0);
    state.speed = 0;
    globalThis.__turnAnalogGas = 0;
    globalThis.__turnBoostActive = false;
    globalThis.__turnDriftHeld = false;
    playerCar.visible = false;
    runtime.setRacePosition(null, state.competitorLaps.length + 1);
    return true;
  };

  globalThis.__turnNextSpectateV3 = () => {
    if (!spectate.active || !state.competitorLaps.length) return false;
    spectate.index = (spectate.index + 1) % state.competitorLaps.length;
    return true;
  };

  globalThis.__turnStopSpectateV3 = () => {
    if (!spectate.active) return false;

    spectate.active = false;
    spectate.elapsed = 0;
    runtime.setGameMode(GAME_MODE.STAGED);

    if (spectate.snapshot) {
      state.position.copy(spectate.snapshot.position);
      state.heading = spectate.snapshot.heading;
      state.progress = spectate.snapshot.progress;
      state.lastProgress = spectate.snapshot.lastProgress;
      state.nearestTrackIndex = spectate.snapshot.nearestTrackIndex;
    }

    state.velocity.set(0, 0, 0);
    state.speed = 0;
    playerCar.visible = true;
    for (const car of competitorCars) {
      car.visible = false;
      hideCompetitorLabels(car);
    }
    return true;
  };
}

function installUi(runtime) {
  const utilityGroup = document.querySelector('.utility-group');
  const gasButton = document.querySelector('#gasButton');
  if (!utilityGroup || !gasButton) return;

  const spectateButton = document.createElement('button');
  spectateButton.type = 'button';
  spectateButton.className = 'utility spectate-button';
  spectateButton.textContent = 'Spectate';
  spectateButton.hidden = true;
  utilityGroup.appendChild(spectateButton);

  const bar = document.createElement('div');
  bar.className = 'spectate-bar';
  bar.hidden = true;
  bar.innerHTML = `
    <button class="spectate-close" type="button" aria-label="Stop spectating">×</button>
    <div class="spectate-following"><strong></strong><b></b></div>
    <button class="spectate-next" type="button">NEXT &gt;</button>`;
  document.body.appendChild(bar);

  const nameEl = bar.querySelector('strong');
  const recordEl = bar.querySelector('b');
  const closeButton = bar.querySelector('.spectate-close');
  const nextButton = bar.querySelector('.spectate-next');

  spectateButton.addEventListener('click', () => {
    if (globalThis.__turnStartSpectateV3?.()) document.body.classList.add('turn-spectating');
  });
  nextButton.addEventListener('click', () => globalThis.__turnNextSpectateV3?.());
  closeButton.addEventListener('click', () => {
    globalThis.__turnStopSpectateV3?.();
    document.body.classList.remove('turn-spectating');
  });

  let gasPointerId = null;
  let wasInBoostZone = false;
  let previousCharge = Number(globalThis.__turnBoostCharge ?? 1);

  function updateBoostZoneHaptic(event) {
    if (gasPointerId === null || event.pointerId !== gasPointerId) return;
    const rect = gasButton.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    const inBoostZone = inside && event.clientY <= rect.top + rect.height * 0.34;
    if (inBoostZone && !wasInBoostZone) safeVibrate(18);
    wasInBoostZone = inBoostZone;
  }

  gasButton.addEventListener('pointerdown', (event) => {
    gasPointerId = event.pointerId;
    wasInBoostZone = false;
    updateBoostZoneHaptic(event);
  });
  gasButton.addEventListener('pointermove', updateBoostZoneHaptic);

  const releaseGasHaptic = (event) => {
    if (gasPointerId !== null && event?.pointerId != null && event.pointerId !== gasPointerId) return;
    gasPointerId = null;
    wasInBoostZone = false;
  };

  gasButton.addEventListener('pointerup', releaseGasHaptic);
  gasButton.addEventListener('pointercancel', releaseGasHaptic);
  gasButton.addEventListener('lostpointercapture', releaseGasHaptic);

  function syncUi() {
    const current = globalThis.__turnGetSpectateV3State?.();
    if (current) {
      spectateButton.hidden = !current.available;
      bar.hidden = !current.active;
      document.body.classList.toggle('turn-spectating', current.active);
      nameEl.textContent = current.name || 'Ghost';
      recordEl.textContent = current.record || '';
      nextButton.hidden = current.total < 2;
    }

    const charge = Number(globalThis.__turnBoostCharge ?? 1);
    if (gasPointerId !== null && wasInBoostZone && previousCharge > 0.015 && charge <= 0.001) {
      safeVibrate([28, 36, 62]);
    }
    previousCharge = charge;
    requestAnimationFrame(syncUi);
  }

  requestAnimationFrame(syncUi);
}

function hideCompetitorLabels(car) {
  for (const child of car.children) {
    if (child.userData?.turnGhostLabel) child.visible = false;
  }
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function spectateDateLabel(lap, allLaps) {
  const rawHitAt = lap?.hitAt;
  const hitAt = rawHitAt == null ? NaN : Number(rawHitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record';

  const date = new Date(hitAt);
  const now = new Date();
  const time = date.getHours() + '.' + date.getMinutes().toString().padStart(2, '0');

  if (sameDate(date, now)) return 'Today, ' + time;

  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  if (date >= weekStart && date < now) {
    return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date) + ', ' + time;
  }

  const duplicateDate = allLaps.filter((other) => {
    const otherHitAt = other?.hitAt == null ? NaN : Number(other.hitAt);
    return Number.isFinite(otherHitAt) && sameDate(new Date(otherHitAt), date);
  }).length > 1;

  const month = new Intl.DateTimeFormat('en', { month: 'long' }).format(date);
  const base = date.getFullYear() === now.getFullYear()
    ? month + ' ' + date.getDate()
    : month + ' ' + date.getDate() + ', ' + date.getFullYear();
  return duplicateDate ? base + ', ' + time : base;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}

function safeVibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch (_) {}
}

waitForRuntime();

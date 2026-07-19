(() => {
  globalThis.__turnSpectateV3 = {
    active: false,
    index: 0,
    startedAt: 0,
    elapsed: 0,
    snapshot: null
  };

  const upstreamFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN spectate v3 patch not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    // Preserve the lighter drift tuning from the previous pass.
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

    // Spectating is visual only. Player physics keeps its normal code path untouched.
    source = replaceRequired(
      source,
      `function placePlayerCar(dt) {
  playerCar.position.copy(state.position);`,
      `function placePlayerCar(dt) {
  const spectate = globalThis.__turnSpectateV3;
  playerCar.visible = !spectate?.active;
  if (spectate?.active) return;
  playerCar.position.copy(state.position);`,
      'hide player during spectate'
    );

    source = source.replace(
      /function placeCompetitorCars\(dt\) \{[\s\S]*?\n\}\n\nfunction updateScene\(dt\) \{/,
      `function hideCompetitorLabels(car) {
  for (const child of car.children) {
    if (child.userData?.turnGhostLabel) child.visible = false;
  }
}

function placeCompetitorCars(dt) {
  ensureCompetitorCars();
  const spectate = globalThis.__turnSpectateV3;

  if (spectate?.active) {
    spectate.elapsed = (performance.now() - spectate.startedAt) / 1000;
  }

  const replayEnabled = state.lapActive || spectate?.active;
  const replayTime = spectate?.active ? spectate.elapsed : state.lapElapsed;

  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    hideCompetitorLabels(car);

    if (!lap || !replayEnabled) {
      car.visible = false;
      continue;
    }

    const frame = lapFrameAt(lap, replayTime);
    if (!frame) {
      car.visible = false;
      continue;
    }

    car.visible = true;
    car.position.set(frame.x, 0.18, frame.z);
    car.rotation.y = frame.h + Math.PI;
    car.rotation.z = -frame.s * 0.03;
    animateWheels(car, frame.s, 45, dt);
  }
}

function updateSpectatorCamera(dt) {
  const spectate = globalThis.__turnSpectateV3;
  if (!spectate?.active) return;

  const lap = state.competitorLaps[spectate.index];
  const frame = lap ? lapFrameAt(lap, spectate.elapsed) : null;
  if (!frame) return;

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
}

function updateScene(dt) {`
    );

    source = replaceRequired(
      source,
      `  placePlayerCar(dt);
  placeCompetitorCars(dt);
  updateDriveEffects(dt);`,
      `  placePlayerCar(dt);
  placeCompetitorCars(dt);

  if (globalThis.__turnSpectateV3?.active) {
    updateSpectatorCamera(dt);
    return;
  }

  updateDriveEffects(dt);`,
      'spectator camera branch'
    );

    source = replaceRequired(
      source,
      'function lapFrameAt(lap, time) {',
      `function sameSpectateDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function spectateTimeOfDay(date) {
  return date.getHours() + '.' + date.getMinutes().toString().padStart(2, '0');
}

function spectateDateLabel(lap) {
  const hitAt = Number(lap?.hitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record';

  const date = new Date(hitAt);
  const now = new Date();
  const time = spectateTimeOfDay(date);

  if (sameSpectateDate(date, now)) return 'Today, ' + time;

  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  if (date >= weekStart && date < now) {
    return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date) + ', ' + time;
  }

  const duplicateDate = state.competitorLaps.filter((other) => {
    const otherHitAt = Number(other?.hitAt);
    return Number.isFinite(otherHitAt) && sameSpectateDate(new Date(otherHitAt), date);
  }).length > 1;

  const month = new Intl.DateTimeFormat('en', { month: 'long' }).format(date);
  const base = date.getFullYear() === now.getFullYear()
    ? month + ' ' + date.getDate()
    : month + ' ' + date.getDate() + ', ' + date.getFullYear();
  return duplicateDate ? base + ', ' + time : base;
}

globalThis.__turnGetSpectateV3State = () => {
  const spectate = globalThis.__turnSpectateV3;
  const lap = state.competitorLaps[spectate.index];
  return {
    available: Boolean(state.running && !state.lapActive && !spectate.active && state.competitorLaps.length),
    active: Boolean(spectate.active),
    index: spectate.index,
    total: state.competitorLaps.length,
    name: spectateDateLabel(lap),
    record: lap ? formatTime(lap.time) : ''
  };
};

globalThis.__turnStartSpectateV3 = () => {
  const spectate = globalThis.__turnSpectateV3;
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

  state.velocity.set(0, 0, 0);
  state.speed = 0;
  globalThis.__turnAnalogGas = 0;
  globalThis.__turnBoostActive = false;
  globalThis.__turnDriftHeld = false;
  playerCar.visible = false;
  globalThis.__turnSetRacePosition?.(null, state.competitorLaps.length + 1);
  return true;
};

globalThis.__turnNextSpectateV3 = () => {
  const spectate = globalThis.__turnSpectateV3;
  if (!spectate.active || !state.competitorLaps.length) return false;
  spectate.index = (spectate.index + 1) % state.competitorLaps.length;
  return true;
};

globalThis.__turnStopSpectateV3 = () => {
  const spectate = globalThis.__turnSpectateV3;
  if (!spectate.active) return false;

  spectate.active = false;
  spectate.elapsed = 0;
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

function lapFrameAt(lap, time) {`,
      'spectator public API'
    );

    // Keep the minimap simple and show the start/finish line explicitly.
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
      console.warn('TURN spectate v3 failed, using upstream game source.', error);
      return response;
    }
  };

  function safeVibrate(pattern) {
    try {
      navigator.vibrate?.(pattern);
    } catch (_) {}
  }

  function installUi() {
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

    // Haptic feedback for entering the boost zone and draining the tank.
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
      const state = globalThis.__turnGetSpectateV3State?.();
      if (state) {
        spectateButton.hidden = !state.available;
        bar.hidden = !state.active;
        document.body.classList.toggle('turn-spectating', state.active);
        nameEl.textContent = state.name || 'Ghost';
        recordEl.textContent = state.record || '';
        nextButton.hidden = state.total < 2;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installUi, { once: true });
  } else {
    installUi();
  }
})();

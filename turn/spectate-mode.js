(() => {
  const upstreamFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN spectate patch not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    source = replaceRequired(
      source,
      '  lapActive: false,',
      '  lapActive: false,\n  spectating: false,\n  spectateIndex: 0,\n  spectateStartedAt: 0,\n  spectateElapsed: 0,',
      'spectator state'
    );

    source = replaceRequired(
      source,
      '  state.lapActive = false;\n  state.lapStartedAt = 0;',
      '  state.lapActive = false;\n  state.spectating = false;\n  state.spectateElapsed = 0;\n  state.lapStartedAt = 0;',
      'reset spectator state'
    );

    // Drift should still trade some pace for rotation, but not feel as punitive.
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
      'function updatePhysics(dt, now) {\n  updateMotionInput(dt);',
      `function updatePhysics(dt, now) {
  if (state.spectating) {
    state.spectateElapsed = (now - state.spectateStartedAt) / 1000;
    state.speed = 0;
    return;
  }

  updateMotionInput(dt);`,
      'freeze player physics during spectate'
    );

    source = replaceRequired(
      source,
      `function placePlayerCar(dt) {
  playerCar.position.copy(state.position);`,
      `function placePlayerCar(dt) {
  playerCar.visible = !state.spectating;
  if (state.spectating) return;
  playerCar.position.copy(state.position);`,
      'hide player while spectating'
    );

    source = source.replace(
      /function placeCompetitorCars\(dt\) \{[\s\S]*?\n\}\n\nfunction updateScene\(dt\) \{/,
      `function setCompetitorLabelVisibility(car, visible) {
  for (const child of car.children) {
    if (child.userData?.turnGhostLabel) child.visible = visible;
  }
}

function placeCompetitorCars(dt) {
  ensureCompetitorCars();
  const replayEnabled = state.lapActive || state.spectating;
  const replayTime = state.spectating ? state.spectateElapsed : state.lapElapsed;

  for (let i = 0; i < competitorCars.length; i += 1) {
    const car = competitorCars[i];
    const lap = state.competitorLaps[i];
    setCompetitorLabelVisibility(car, Boolean(state.spectating && lap));

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
  const lap = state.competitorLaps[state.spectateIndex];
  const frame = lap ? lapFrameAt(lap, state.spectateElapsed) : null;
  if (!frame) return;

  const focus = new THREE.Vector3(frame.x, 0.18, frame.z);
  const forward = new THREE.Vector3(Math.sin(frame.h), 0, Math.cos(frame.h));
  const desiredCamera = focus.clone().addScaledVector(forward, -19);
  desiredCamera.y = 8.8;
  cameraPosition.lerp(desiredCamera, 1 - Math.exp(-dt * 5.2));
  camera.position.copy(cameraPosition);

  const desiredTarget = focus.clone().addScaledVector(forward, 15);
  desiredTarget.y = 2.2;
  cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 7.2));
  camera.up.set(0, 1, 0);
  camera.lookAt(cameraTarget);
  camera.fov = THREE.MathUtils.lerp(camera.fov, 73, Math.min(1, dt * 5));
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

  if (state.spectating) {
    updateSpectatorCamera(dt);
    return;
  }

  updateDriveEffects(dt);`,
      'spectator camera branch'
    );

    source = replaceRequired(
      source,
      'function lapFrameAt(lap, time) {',
      `function currentSpectateName() {
  const lap = state.competitorLaps[state.spectateIndex];
  return lap ? ghostNameForLap(lap, state.competitorLaps) : '';
}

globalThis.__turnGetSpectateState = () => ({
  available: Boolean(state.running && !state.lapActive && !state.spectating && state.competitorLaps.length),
  spectating: state.spectating,
  index: state.spectateIndex,
  total: state.competitorLaps.length,
  name: currentSpectateName()
});

globalThis.__turnStartSpectating = () => {
  if (!state.running || state.lapActive || !state.competitorLaps.length) return false;
  state.spectating = true;
  state.spectateIndex = 0;
  state.spectateStartedAt = performance.now();
  state.spectateElapsed = 0;
  playerCar.visible = false;
  globalThis.__turnSetRacePosition?.(null, state.competitorLaps.length + 1);
  return true;
};

globalThis.__turnNextSpectator = () => {
  if (!state.spectating || !state.competitorLaps.length) return false;
  state.spectateIndex = (state.spectateIndex + 1) % state.competitorLaps.length;
  return true;
};

globalThis.__turnStopSpectating = () => {
  if (!state.spectating) return false;
  state.spectating = false;
  state.spectateElapsed = 0;
  playerCar.visible = true;
  for (const car of competitorCars) {
    car.visible = false;
    setCompetitorLabelVisibility(car, false);
  }
  return true;
};

function lapFrameAt(lap, time) {`,
      'spectator public API'
    );

    // Return the minimap to one clean course color and mark the start line explicitly.
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
      console.warn('TURN spectate mode failed, using upstream game source.', error);
      return response;
    }
  };

  function safeVibrate(pattern) {
    try {
      navigator.vibrate?.(pattern);
    } catch (_) {}
  }

  function installSpectateUi() {
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
      <div class="spectate-following"><span>FOLLOWING</span><strong></strong></div>
      <button class="spectate-next" type="button">NEXT &gt;</button>`;
    document.body.appendChild(bar);

    const nameEl = bar.querySelector('strong');
    const closeButton = bar.querySelector('.spectate-close');
    const nextButton = bar.querySelector('.spectate-next');

    spectateButton.addEventListener('click', () => {
      if (globalThis.__turnStartSpectating?.()) document.body.classList.add('turn-spectating');
    });
    nextButton.addEventListener('click', () => globalThis.__turnNextSpectator?.());
    closeButton.addEventListener('click', () => {
      globalThis.__turnStopSpectating?.();
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
      const state = globalThis.__turnGetSpectateState?.();
      if (state) {
        spectateButton.hidden = !state.available;
        bar.hidden = !state.spectating;
        document.body.classList.toggle('turn-spectating', state.spectating);
        if (nameEl) nameEl.textContent = state.name || 'Ghost';
        if (nextButton) nextButton.hidden = state.total < 2;
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
    document.addEventListener('DOMContentLoaded', installSpectateUi, { once: true });
  } else {
    installSpectateUi();
  }
})();
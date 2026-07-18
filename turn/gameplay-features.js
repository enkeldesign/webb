(() => {
  globalThis.__turnBoostActive = false;
  globalThis.__turnBoostCharge = 1;

  const upstreamFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN gameplay patch not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    source = replaceRequired(
      source,
      "const COMPETITOR_KEY = 'turn-personal-rivals-v1';",
      "const COMPETITOR_KEY = 'turn-personal-rivals-v1';\nconst LAP_CHECKPOINTS = [0.18, 0.38, 0.58, 0.78];",
      'lap checkpoint constants'
    );

    source = replaceRequired(
      source,
      '  competitorLaps: [],',
      '  competitorLaps: [],\n  lapCheckpointIndex: 0,',
      'lap checkpoint state'
    );

    source = replaceRequired(
      source,
      `  state.nearestTrackIndex = 4;
  if (showFeedback) showMessage('CAR RESET');`,
      `  state.nearestTrackIndex = 4;
  state.lapCheckpointIndex = 0;
  if (showFeedback) showMessage('CAR RESET');`,
      'reset lap checkpoints with car'
    );

    source = replaceRequired(
      source,
      `  const enginePower = state.offRoad ? 29 : 43;
  state.velocity.addScaledVector(forward, state.throttle * enginePower * dt);`,
      `  const enginePower = state.offRoad ? 29 : 43;
  const boostActive = Boolean(globalThis.__turnBoostActive);
  const boostPower = boostActive ? (state.offRoad ? 13 : 36) : 0;
  state.velocity.addScaledVector(
    forward,
    (state.throttle * enginePower + boostPower) * dt
  );`,
      'boost acceleration'
    );

    source = replaceRequired(
      source,
      '  const speedLimit = state.offRoad ? 46 : MAX_SPEED;',
      '  const speedLimit = state.offRoad ? 46 : (boostActive ? MAX_SPEED * 1.32 : MAX_SPEED);',
      'boost speed ceiling'
    );

    source = replaceRequired(
      source,
      `  const crossedStart = state.lastProgress > 0.82 && state.progress < 0.18;
  const movingForwardAtStart = state.velocity.dot(samples[0].tangent) > 5;
  if (crossedStart && movingForwardAtStart && state.trackDistance < TRACK_WIDTH * 0.8) completeLap(now);`,
      `  const movingForwardOnTrack = state.velocity.dot(nearestAfter.sample.tangent) > 2;
  const nextCheckpoint = LAP_CHECKPOINTS[state.lapCheckpointIndex];

  if (
    nextCheckpoint != null &&
    movingForwardOnTrack &&
    state.lastProgress < nextCheckpoint &&
    state.progress >= nextCheckpoint
  ) {
    state.lapCheckpointIndex += 1;
  }

  const crossedStart = state.lastProgress > 0.82 && state.progress < 0.18;
  const movingForwardAtStart = state.velocity.dot(samples[0].tangent) > 5;
  const crossedStartOnTrack = crossedStart && movingForwardAtStart && state.trackDistance < TRACK_WIDTH * 0.8;

  if (crossedStartOnTrack) {
    if (state.lapCheckpointIndex >= LAP_CHECKPOINTS.length) {
      completeLap(now);
    } else {
      // Returning to the line without visiting the full circuit begins a fresh attempt.
      // This prevents checkpoint progress being accumulated across start-line shortcuts.
      state.lapCheckpointIndex = 0;
      state.lapStartedAt = now;
      state.lapElapsed = 0;
      state.recording = [];
    }
  }`,
      'ordered invisible lap checkpoints'
    );

    source = replaceRequired(
      source,
      `  state.lap += 1;
  state.lapStartedAt = now;`,
      `  state.lapCheckpointIndex = 0;
  state.lap += 1;
  state.lapStartedAt = now;`,
      'reset checkpoints after completed lap'
    );

    source = replaceRequired(
      source,
      'function lapFrameAt(lap, time) {',
      `globalThis.__turnHasGhosts = () => state.competitorLaps.length > 0;

globalThis.__turnNukeGhosts = () => {
  state.competitorLaps = [];
  state.bestTime = Infinity;
  state.ghostFrames = [];
  state.ghostVisible = false;

  try {
    localStorage.removeItem(COMPETITOR_KEY);
    localStorage.removeItem(GHOST_KEY);
  } catch (_) {}

  for (const car of competitorCars) car.visible = false;
  updateHud();
  showMessage('GHOSTS NUKED', 1800);
  window.dispatchEvent(new CustomEvent('turn:ghosts-nuked'));
};

function lapFrameAt(lap, time) {`,
      'ghost reset API'
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
      console.warn('TURN gameplay features failed, using upstream game source.', error);
      return response;
    }
  };

  function addGameplayUi() {
    const gasButton = document.querySelector('#gasButton');
    const utilityGroup = document.querySelector('.utility-group');
    if (!gasButton || !utilityGroup) return;

    const nukeButton = document.createElement('button');
    nukeButton.type = 'button';
    nukeButton.className = 'utility nuke-ghosts-button';
    nukeButton.setAttribute('aria-label', 'Nuke saved ghosts');
    nukeButton.title = 'Nuke saved ghosts';
    nukeButton.innerHTML = '<span class="mushroom-cloud-icon" aria-hidden="true"><i></i></span>';
    utilityGroup.appendChild(nukeButton);

    const dialog = document.createElement('dialog');
    dialog.className = 'nuke-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="nuke-dialog-card">
        <div class="nuke-dialog-icon" aria-hidden="true"><span class="mushroom-cloud-icon"><i></i></span></div>
        <h2>NUKE THE GHOSTS?</h2>
        <p>Are you sure you want to nuke the ghosts?</p>
        <div class="nuke-dialog-actions">
          <button value="cancel" class="nuke-cancel">Cancel</button>
          <button value="nuke" class="nuke-confirm">Nuke ghosts</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const effect = document.createElement('div');
    effect.className = 'nuke-effect';
    effect.hidden = true;
    effect.setAttribute('aria-hidden', 'true');
    effect.innerHTML = `
      <div class="nuke-flash"></div>
      <div class="nuke-shockwave"></div>
      <div class="nuke-mushroom">
        <i class="nuke-cap"></i>
        <i class="nuke-stem"></i>
        <i class="nuke-base"></i>
      </div>`;
    document.body.appendChild(effect);

    function openNukeDialog() {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeNukeDialog() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    }

    nukeButton.addEventListener('click', openNukeDialog);
    dialog.querySelector('.nuke-cancel')?.addEventListener('click', closeNukeDialog);
    dialog.querySelector('.nuke-confirm')?.addEventListener('click', (event) => {
      event.preventDefault();
      closeNukeDialog();
      effect.hidden = false;
      document.body.classList.add('turn-nuking');

      window.setTimeout(() => {
        globalThis.__turnNukeGhosts?.();
      }, 360);

      window.setTimeout(() => {
        document.body.classList.remove('turn-nuking');
        effect.hidden = true;
      }, 1650);
    });

    // The top third of the analog pedal is a rechargeable boost zone.
    let boostPointerId = null;
    let boostHeld = false;
    let boostCharge = 1;
    let previousTime = performance.now();
    const BOOST_ZONE = 0.34;
    const BOOST_DRAIN_SECONDS = 2.0;
    const BOOST_RECHARGE_SECONDS = 4.2;

    function releaseBoost(event) {
      if (boostPointerId !== null && event?.pointerId != null && event.pointerId !== boostPointerId) return;
      boostPointerId = null;
      boostHeld = false;
      globalThis.__turnBoostActive = false;
      gasButton.classList.remove('is-boosting');
    }

    gasButton.addEventListener('pointerdown', (event) => {
      const rect = gasButton.getBoundingClientRect();
      const localY = event.clientY - rect.top;
      if (localY <= rect.height * BOOST_ZONE && boostCharge > 0.015) {
        boostPointerId = event.pointerId;
        boostHeld = true;
      }
    });
    gasButton.addEventListener('pointerup', releaseBoost);
    gasButton.addEventListener('pointercancel', releaseBoost);
    gasButton.addEventListener('lostpointercapture', releaseBoost);
    window.addEventListener('blur', () => releaseBoost());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseBoost();
    });

    function updateBoost(now) {
      const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
      previousTime = now;

      if (boostHeld) {
        boostCharge = Math.max(0, boostCharge - dt / BOOST_DRAIN_SECONDS);
      } else {
        boostCharge = Math.min(1, boostCharge + dt / BOOST_RECHARGE_SECONDS);
      }

      if (boostCharge <= 0) boostHeld = false;
      const active = boostHeld && boostCharge > 0;
      globalThis.__turnBoostActive = active;
      globalThis.__turnBoostCharge = boostCharge;
      gasButton.classList.toggle('is-boosting', active);
      gasButton.style.setProperty('--boost-fill', `${(boostCharge * 34).toFixed(2)}%`);
      gasButton.setAttribute(
        'aria-label',
        active ? `Gas, boost ${Math.round(boostCharge * 100)} percent` : `Gas, boost ${Math.round(boostCharge * 100)} percent charged`
      );

      requestAnimationFrame(updateBoost);
    }

    gasButton.style.setProperty('--boost-fill', '34%');
    requestAnimationFrame(updateBoost);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addGameplayUi, { once: true });
  } else {
    addGameplayUi();
  }
})();
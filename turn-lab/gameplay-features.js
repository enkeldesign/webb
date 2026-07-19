(() => {
  globalThis.__turnBoostActive = false;
  globalThis.__turnBoostCharge = 1;
  globalThis.__turnDriftHeld = false;

  const upstreamFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN gameplay patch not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    // Slightly wider racing surface. This runs before motion-adapter.js, so its old 18 -> 24
    // patch simply becomes a harmless no-op and the entire generated road uses this width.
    source = replaceRequired(source, 'const TRACK_WIDTH = 18;', 'const TRACK_WIDTH = 27;', 'wider road');

    source = replaceRequired(
      source,
      "const COMPETITOR_MIGRATION_KEY = 'turn-rival-timestamp-migration-v1';",
      "const COMPETITOR_MIGRATION_KEY = 'turn-rival-timestamp-migration-v1';\nconst LAP_CHECKPOINTS = [0.18, 0.38, 0.58, 0.78];\nconst TRACK_SECTION_COLORS = ['#ff8fbd', '#2f855a', '#f6ad55', '#5c7cfa'];",
      'race constants'
    );

    source = replaceRequired(
      source,
      '  competitorLaps: [],',
      '  competitorLaps: [],\n  lapCheckpointIndex: 0,\n  lapActive: false,',
      'lap start state'
    );

    source = replaceRequired(
      source,
      '  const start = samples[4];',
      '  const startIndex = samples.length - 24;\n  const start = samples[startIndex];',
      'stage car behind start line'
    );

    source = replaceRequired(
      source,
      `  state.progress = 4 / TRACK_SAMPLES;
  state.lastProgress = state.progress;
  state.nearestTrackIndex = 4;
  if (showFeedback) showMessage('CAR RESET');`,
      `  state.progress = startIndex / TRACK_SAMPLES;
  state.lastProgress = state.progress;
  state.nearestTrackIndex = startIndex;
  state.lapCheckpointIndex = 0;
  state.lapActive = false;
  state.lapStartedAt = 0;
  state.lapElapsed = 0;
  state.recording = [];
  globalThis.__turnSetRacePosition?.(null, state.competitorLaps.length + 1);
  if (showFeedback) showMessage('READY FOR THE LINE');`,
      'reset behind start with frozen timer'
    );

    source = replaceRequired(
      source,
      '  state.lapStartedAt = performance.now();',
      '  state.lapStartedAt = 0;\n  state.lapElapsed = 0;',
      'wait for start line before timing'
    );

    // Old recordings did not contain track progress. Fill it once during migration so ranking
    // remains cheap in subsequent frames.
    source = replaceRequired(
      source,
      '        const frames = lap.frames.map((frame) => ({ ...frame }));',
      `        const frames = lap.frames.map((frame) => {
          const copy = { ...frame };
          if (!Number.isFinite(copy.p) && Number.isFinite(copy.x) && Number.isFinite(copy.z)) {
            copy.p = findNearestTrack(copy).index / TRACK_SAMPLES;
          }
          return copy;
        });`,
      'migrate rival progress data'
    );

    source = replaceRequired(
      source,
      `  const enginePower = state.offRoad ? 29 : 43;
  state.velocity.addScaledVector(forward, state.throttle * enginePower * dt);`,
      `  const boostActive = Boolean(globalThis.__turnBoostActive);
  const driftHeld = Boolean(globalThis.__turnDriftHeld);
  const enginePower = (state.offRoad ? 36 : 43) * (driftHeld ? 0.86 : 1);
  const boostPower = boostActive ? (state.offRoad ? 16 : 36) : 0;
  state.velocity.addScaledVector(
    forward,
    (state.throttle * enginePower + boostPower) * dt
  );`,
      'boost drift and gentler off-road acceleration'
    );

    source = replaceRequired(
      source,
      `  const driftIntent = THREE.MathUtils.clamp(
    Math.abs(state.steering) * speedRatio * 0.9 +
    state.brake * Math.abs(state.steering) * 1.35 +
    Math.abs(lateralSpeed) / 22,
    0,
    1
  );`,
      `  const driftIntent = THREE.MathUtils.clamp(
    Math.abs(state.steering) * speedRatio * 0.9 +
    state.brake * Math.abs(state.steering) * 1.35 +
    Math.abs(lateralSpeed) / 22 +
    (driftHeld ? 0.48 + Math.abs(state.steering) * 0.5 : 0),
    0,
    1
  );`,
      'drift button intent'
    );

    source = replaceRequired(
      source,
      `    (1 + state.driftAmount * 0.65);`,
      `    (1 + state.driftAmount * 0.65 + (driftHeld ? 0.58 : 0));`,
      'extra drift rotation'
    );

    source = replaceRequired(
      source,
      `  const grip = state.offRoad
    ? THREE.MathUtils.lerp(2.6, 1.0, state.driftAmount)
    : THREE.MathUtils.lerp(11.5, 1.45, state.driftAmount);`,
      `  const grip = (state.offRoad
    ? THREE.MathUtils.lerp(3.4, 1.35, state.driftAmount)
    : THREE.MathUtils.lerp(11.5, 1.45, state.driftAmount)) * (driftHeld ? 0.42 : 1);`,
      'lower grip while drifting'
    );

    source = replaceRequired(
      source,
      `  if (state.driftAmount > 0.18 && speed > 18) {
    state.velocity.addScaledVector(newRight, state.steering * speed * state.driftAmount * 0.12 * dt);
  }`,
      `  if ((state.driftAmount > 0.18 || driftHeld) && speed > 14) {
    const slideStrength = driftHeld ? 0.235 : 0.12;
    state.velocity.addScaledVector(newRight, state.steering * speed * Math.max(state.driftAmount, 0.48) * slideStrength * dt);
  }`,
      'stronger rear slide'
    );

    source = replaceRequired(
      source,
      '  const drag = state.offRoad ? 0.72 : 0.11 + speed * 0.0009;',
      '  const drag = state.offRoad ? 0.34 : 0.11 + speed * 0.0009 + (driftHeld ? 0.15 : 0);',
      'gentler off-road drag and drift speed tradeoff'
    );

    source = replaceRequired(
      source,
      '  const speedLimit = state.offRoad ? 46 : MAX_SPEED;',
      '  const speedLimit = state.offRoad ? (boostActive ? 72 : 64) : (boostActive ? MAX_SPEED * 1.32 : MAX_SPEED);',
      'off-road and boost speed ceilings'
    );

    source = replaceRequired(
      source,
      `      d: state.driftAmount
    });`,
      `      d: state.driftAmount,
      p: state.progress
    });`,
      'record track progress for ranking'
    );

    source = replaceRequired(
      source,
      `const skidHistory = [];`,
      `const skidHistory = [];

const smokePool = Array.from({ length: 24 }, () => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 7, 5),
    new THREE.MeshBasicMaterial({ color: 0xb9c0c7, transparent: true, opacity: 0 })
  );
  mesh.visible = false;
  mesh.userData.life = 0;
  world.add(mesh);
  return mesh;
});

const flamePool = Array.from({ length: 16 }, (_, index) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 7, 5),
    new THREE.MeshBasicMaterial({
      color: index % 2 ? 0xff922b : 0xffd43b,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  mesh.visible = false;
  mesh.userData.life = 0;
  world.add(mesh);
  return mesh;
});

let smokeCursor = 0;
let flameCursor = 0;
let smokeCooldown = 0;
let flameCooldown = 0;

function launchParticle(pool, cursor, position, velocity, life, scale, opacity) {
  const particle = pool[cursor % pool.length];
  particle.visible = true;
  particle.position.copy(position);
  particle.scale.copy(scale);
  particle.material.opacity = opacity;
  particle.userData.life = life;
  particle.userData.maxLife = life;
  particle.userData.velocity = velocity.clone();
  return cursor + 1;
}

function updateParticlePool(pool, dt, smoke = false) {
  for (const particle of pool) {
    if (!particle.visible) continue;
    particle.userData.life -= dt;
    if (particle.userData.life <= 0) {
      particle.visible = false;
      continue;
    }
    const ratio = particle.userData.life / particle.userData.maxLife;
    particle.position.addScaledVector(particle.userData.velocity, dt);
    particle.material.opacity = ratio * (smoke ? 0.42 : 0.9);
    if (smoke) particle.scale.multiplyScalar(1 + dt * 1.7);
    else particle.scale.multiplyScalar(1 - Math.min(0.65, dt * 3.2));
  }
}

function updateDriveEffects(dt) {
  const forward = getForward().clone();
  const right = getRight().clone();
  const rear = state.position.clone().addScaledVector(forward, -3.2).setY(0.72);

  flameCooldown -= dt;
  if (globalThis.__turnBoostActive && state.speed > 4 && flameCooldown <= 0) {
    for (const side of [-1, 1]) {
      const position = rear.clone().addScaledVector(right, side * 0.78);
      const velocity = forward.clone().multiplyScalar(-8 - state.speed * 0.08).add(new THREE.Vector3(0, 1.2, 0));
      flameCursor = launchParticle(
        flamePool,
        flameCursor,
        position,
        velocity,
        0.22,
        new THREE.Vector3(0.5, 0.48, 1.8),
        0.95
      );
    }
    flameCooldown = 0.035;
  }

  smokeCooldown -= dt;
  if (globalThis.__turnDriftHeld && state.speed > 13 && Math.abs(state.steering) > 0.08 && smokeCooldown <= 0) {
    for (const side of [-1, 1]) {
      const position = rear.clone().addScaledVector(right, side * 1.28).setY(0.45);
      const velocity = right.clone().multiplyScalar(-side * state.steering * 2.8).add(new THREE.Vector3(0, 2.1, 0));
      smokeCursor = launchParticle(
        smokePool,
        smokeCursor,
        position,
        velocity,
        0.72,
        new THREE.Vector3(0.78, 0.52, 0.78),
        0.42
      );
    }
    smokeCooldown = 0.075;
  }

  updateParticlePool(smokePool, dt, true);
  updateParticlePool(flamePool, dt, false);
}`,
      'boost flames and drift smoke'
    );

    source = replaceRequired(
      source,
      `  placePlayerCar(dt);
  placeCompetitorCars(dt);`,
      `  placePlayerCar(dt);
  placeCompetitorCars(dt);
  updateDriveEffects(dt);`,
      'drive particle effects update'
    );

    // Replace the single pink minimap stroke with four track-section colors. Spectate later
    // restores the unified pink map and adds the explicit start/finish marker.
    source = replaceRequired(
      source,
      `  mapCtx.strokeStyle = '#ff4fa3';
  mapCtx.lineWidth = 8;
  mapCtx.stroke();`,
      `  mapCtx.lineWidth = 8;
  for (let section = 0; section < TRACK_SECTION_COLORS.length; section += 1) {
    const startIndex = Math.floor((section / TRACK_SECTION_COLORS.length) * samples.length);
    const endIndex = Math.floor(((section + 1) / TRACK_SECTION_COLORS.length) * samples.length);
    mapCtx.beginPath();
    for (let index = startIndex; index <= endIndex; index += 1) {
      const sample = samples[index % samples.length];
      const point = mapPoint(sample.point);
      if (index === startIndex) mapCtx.moveTo(point.x, point.y);
      else mapCtx.lineTo(point.x, point.y);
    }
    mapCtx.strokeStyle = TRACK_SECTION_COLORS[section];
    mapCtx.stroke();
  }`,
      'colored minimap sections'
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
  refreshCompetitorLabels();
  updateHud();
  showMessage('GHOSTS NUKED', 1800);
  window.dispatchEvent(new CustomEvent('turn:ghosts-nuked'));
};

function lapFrameAt(lap, time) {`,
      'ghost reset API'
    );

    source = replaceRequired(
      source,
      'function updateHud() {',
      `function updateRacePosition() {
  const total = state.competitorLaps.length + 1;
  if (!state.lapActive || !state.competitorLaps.length) {
    globalThis.__turnSetRacePosition?.(state.lapActive ? 1 : null, total);
    return;
  }

  let rivalsAhead = 0;
  const playerDistance = state.progress;

  for (const lap of state.competitorLaps) {
    const frame = lapFrameAt(lap, state.lapElapsed);
    if (!frame) continue;
    const progress = Number.isFinite(frame.p)
      ? frame.p
      : findNearestTrack(frame).index / TRACK_SAMPLES;
    const completedGhostLaps = Number.isFinite(lap.time) && lap.time > 0
      ? Math.floor(state.lapElapsed / lap.time)
      : 0;
    if (completedGhostLaps + progress > playerDistance + 0.002) rivalsAhead += 1;
  }

  globalThis.__turnSetRacePosition?.(rivalsAhead + 1, total);
}

function updateHud() {`,
      'race position calculation'
    );

    source = replaceRequired(
      source,
      `  drawMap();
}

function showMessage`,
      `  drawMap();
  updateRacePosition();
}

function showMessage`,
      'update position HUD'
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
    const brakeButton = document.querySelector('#brakeButton');
    const utilityGroup = document.querySelector('.utility-group');
    const hud = document.querySelector('#hud');
    if (!gasButton || !brakeButton || !utilityGroup || !hud) return;

    const positionHud = document.createElement('div');
    positionHud.className = 'race-position-hud';
    positionHud.hidden = true;
    positionHud.innerHTML = '<span>POSITION</span><strong>1/1</strong>';
    hud.appendChild(positionHud);
    let lastPosition = null;

    globalThis.__turnSetRacePosition = (position, total) => {
      if (position == null) {
        positionHud.hidden = true;
        lastPosition = null;
        return;
      }
      positionHud.hidden = false;
      positionHud.querySelector('strong').textContent = position + '/' + total;
      if (lastPosition !== null && position !== lastPosition) {
        positionHud.classList.remove('position-pop');
        void positionHud.offsetWidth;
        positionHud.classList.add('position-pop');
      }
      lastPosition = position;
    };

    const boostHud = document.createElement('div');
    boostHud.className = 'boost-hud';
    boostHud.innerHTML = '<span>BOOST</span><div><i></i></div>';
    hud.appendChild(boostHud);

    const brakeStack = document.createElement('div');
    brakeStack.className = 'brake-stack';
    brakeButton.parentNode.insertBefore(brakeStack, brakeButton);

    const driftButton = document.createElement('button');
    driftButton.type = 'button';
    driftButton.className = 'pedal drift';
    driftButton.textContent = 'Drift';
    driftButton.setAttribute('aria-label', 'Hold to drift');
    brakeStack.append(driftButton, brakeButton);

    let driftPointerId = null;
    const endDrift = (event) => {
      if (driftPointerId !== null && event?.pointerId != null && event.pointerId !== driftPointerId) return;
      driftPointerId = null;
      globalThis.__turnDriftHeld = false;
      driftButton.classList.remove('is-down');
    };
    driftButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      driftPointerId = event.pointerId;
      driftButton.setPointerCapture?.(event.pointerId);
      globalThis.__turnDriftHeld = true;
      driftButton.classList.add('is-down');
    });
    driftButton.addEventListener('pointerup', endDrift);
    driftButton.addEventListener('pointercancel', endDrift);
    driftButton.addEventListener('lostpointercapture', endDrift);

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

    function closeNukeDialog() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    }

    nukeButton.addEventListener('click', () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
    dialog.querySelector('.nuke-cancel')?.addEventListener('click', closeNukeDialog);
    dialog.querySelector('.nuke-confirm')?.addEventListener('click', (event) => {
      event.preventDefault();
      closeNukeDialog();
      effect.hidden = false;
      document.body.classList.add('turn-nuking');
      window.setTimeout(() => globalThis.__turnNukeGhosts?.(), 360);
      window.setTimeout(() => {
        document.body.classList.remove('turn-nuking');
        effect.hidden = true;
      }, 1650);
    });

    // Boost is an absolute zone on the pedal, not something latched by the initial touch.
    // Pointer capture means the player can slide in and out of the red band without lifting.
    let gasPointerId = null;
    let boostRequested = false;
    let boostExhausted = false;
    let boostCharge = 1;
    let previousTime = performance.now();
    const BOOST_ZONE = 0.34;
    const BOOST_DRAIN_SECONDS = 2.0;
    const BOOST_RECHARGE_SECONDS = 4.2;
    const DRIFT_RECHARGE_MULTIPLIER = 2.4;

    function updateBoostRequest(event) {
      if (gasPointerId === null || event.pointerId !== gasPointerId) return;
      const rect = gasButton.getBoundingClientRect();
      const inside = event.clientY >= rect.top
        && event.clientY <= rect.bottom
        && event.clientX >= rect.left
        && event.clientX <= rect.right;
      const inBoostZone = inside && event.clientY - rect.top <= rect.height * BOOST_ZONE;
      if (!inBoostZone) boostExhausted = false;
      boostRequested = inBoostZone;
    }

    function releaseBoost(event) {
      if (gasPointerId !== null && event?.pointerId != null && event.pointerId !== gasPointerId) return;
      gasPointerId = null;
      boostRequested = false;
      boostExhausted = false;
      globalThis.__turnBoostActive = false;
      gasButton.classList.remove('is-boosting');
    }

    gasButton.addEventListener('pointerdown', (event) => {
      gasPointerId = event.pointerId;
      updateBoostRequest(event);
    });
    gasButton.addEventListener('pointermove', updateBoostRequest);
    gasButton.addEventListener('pointerup', releaseBoost);
    gasButton.addEventListener('pointercancel', releaseBoost);
    gasButton.addEventListener('lostpointercapture', releaseBoost);
    window.addEventListener('blur', () => releaseBoost());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        releaseBoost();
        endDrift();
      }
    });

    function updateBoost(now) {
      const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
      previousTime = now;
      const active = boostRequested && !boostExhausted && boostCharge > 0.001;

      if (active) {
        boostCharge = Math.max(0, boostCharge - dt / BOOST_DRAIN_SECONDS);
        if (boostCharge <= 0) boostExhausted = true;
      } else {
        const rechargeMultiplier = globalThis.__turnDriftHeld ? DRIFT_RECHARGE_MULTIPLIER : 1;
        boostCharge = Math.min(1, boostCharge + dt * rechargeMultiplier / BOOST_RECHARGE_SECONDS);
      }

      const boosting = boostRequested && !boostExhausted && boostCharge > 0.001;
      globalThis.__turnBoostActive = boosting;
      globalThis.__turnBoostCharge = boostCharge;
      gasButton.classList.toggle('is-boosting', boosting);
      boostHud.classList.toggle('is-boosting', boosting);
      boostHud.classList.toggle('is-drift-charging', globalThis.__turnDriftHeld && !boosting);
      boostHud.style.setProperty('--boost-charge', (boostCharge * 100).toFixed(1) + '%');
      boostHud.setAttribute('aria-label', 'Boost ' + Math.round(boostCharge * 100) + ' percent charged');
      requestAnimationFrame(updateBoost);
    }

    requestAnimationFrame(updateBoost);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addGameplayUi, { once: true });
  } else {
    addGameplayUi();
  }
})();
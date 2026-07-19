globalThis.__turnBoostActive = false;
globalThis.__turnBoostCharge = 1;
globalThis.__turnDriftHeld = false;

if (!globalThis.__turnGameplayControlsInstalled) {
  globalThis.__turnGameplayControlsInstalled = true;
  installGameplayUi();
}

function installGameplayUi() {
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

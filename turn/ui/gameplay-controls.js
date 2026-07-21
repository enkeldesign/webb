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
  const calibrateButton = document.querySelector('#calibrateButton');
  const manualSteer = document.querySelector('#manualSteer');
  const utilityGroup = document.querySelector('.utility-group');
  const hud = document.querySelector('#hud');
  const controlsRoot = document.querySelector('#controls');
  const pedals = gasButton?.parentElement;
  if (!gasButton || !brakeButton || !manualSteer || !utilityGroup || !hud || !pedals) return;

  let manualPointerId = null;

  function setManualSteerVisual(event) {
    if (manualPointerId !== null && event.pointerId !== manualPointerId) return;
    const rect = manualSteer.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const position = x * 2 - 1;
    manualSteer.style.setProperty('--manual-steer-left', `${50 + position * 28}%`);
    manualSteer.setAttribute('aria-valuenow', String(Math.round(position * 100)));
  }

  function centerManualSteerVisual(event) {
    if (manualPointerId !== null && event?.pointerId != null && event.pointerId !== manualPointerId) return;
    manualPointerId = null;
    manualSteer.classList.remove('is-steering');
    manualSteer.style.setProperty('--manual-steer-left', '50%');
    manualSteer.setAttribute('aria-valuenow', '0');
  }

  manualSteer.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    manualPointerId = event.pointerId;
    manualSteer.setPointerCapture?.(event.pointerId);
    manualSteer.classList.add('is-steering');
    setManualSteerVisual(event);
  });
  manualSteer.addEventListener('pointermove', (event) => {
    if (manualPointerId === event.pointerId) setManualSteerVisual(event);
  });
  manualSteer.addEventListener('pointerup', centerManualSteerVisual);
  manualSteer.addEventListener('pointercancel', centerManualSteerVisual);
  manualSteer.addEventListener('lostpointercapture', centerManualSteerVisual);
  calibrateButton?.addEventListener('click', () => centerManualSteerVisual());

  const positionHud = document.createElement('div');
  positionHud.className = 'race-position-hud';
  positionHud.hidden = true;
  positionHud.innerHTML = '<span>POSITION</span><strong>1/1</strong>';
  hud.appendChild(positionHud);
  const positionValue = positionHud.querySelector('strong');
  let lastPosition = null;
  let lastPositionTotal = null;

  globalThis.__turnSetRacePosition = (position, total) => {
    if (position == null) {
      if (!positionHud.hidden) positionHud.hidden = true;
      lastPosition = null;
      lastPositionTotal = null;
      return;
    }
    if (positionHud.hidden) positionHud.hidden = false;
    if (position !== lastPosition || total !== lastPositionTotal) {
      positionValue.textContent = position + '/' + total;
    }
    if (lastPosition !== null && position !== lastPosition) {
      positionHud.classList.remove('position-pop');
      void positionHud.offsetWidth;
      positionHud.classList.add('position-pop');
      if (position < lastPosition) {
        globalThis.__turnAudio?.cue('overtake', { places: lastPosition - position });
      }
    }
    lastPosition = position;
    lastPositionTotal = total;
  };

  const boostHud = document.createElement('div');
  boostHud.className = 'boost-hud';
  boostHud.innerHTML = '<span>BOOST</span><div><i></i></div>';
  hud.appendChild(boostHud);

  const driveStack = document.createElement('div');
  driveStack.className = 'drive-stack';

  const drivePad = document.createElement('div');
  drivePad.className = 'drive-pad';
  drivePad.setAttribute('role', 'group');
  drivePad.setAttribute('aria-label', 'Drive control. Slide between Gas, Drift and Boost.');
  drivePad.style.setProperty('--boost-charge', '100%');

  const driveTop = document.createElement('div');
  driveTop.className = 'drive-pad-top';

  const driftZone = document.createElement('button');
  driftZone.type = 'button';
  driftZone.className = 'drive-zone drive-drift-zone';
  driftZone.textContent = 'Drift';
  driftZone.setAttribute('aria-label', 'Gas and drift');

  const boostZone = document.createElement('button');
  boostZone.type = 'button';
  boostZone.className = 'drive-zone drive-boost-zone';
  boostZone.textContent = 'Boost';
  boostZone.setAttribute('aria-label', 'Gas and boost');

  gasButton.classList.add('drive-gas-zone');
  gasButton.textContent = 'Gas';
  gasButton.setAttribute('aria-label', 'Gas');

  brakeButton.classList.add('brake-reverse');
  brakeButton.textContent = 'Brake · Reverse';
  brakeButton.setAttribute('aria-label', 'Brake. Hold after stopping to reverse.');

  driveTop.append(driftZone, boostZone);
  drivePad.append(driveTop, gasButton);
  driveStack.append(drivePad, brakeButton);
  pedals.replaceChildren(driveStack);

  let drivePointerId = null;
  let driveZone = null;
  let boostRequested = false;
  let boostExhausted = false;
  let boostCharge = 1;
  let previousBoostCharge = boostCharge;
  let boostFlashTimer = 0;
  let previousTime = performance.now();
  const TOP_ZONE_SHARE = 0.42;
  const DEFAULT_BOOST_DRAIN_SECONDS = 2.0;
  const BOOST_RECHARGE_SECONDS = 4.2;
  const DRIFT_RECHARGE_MULTIPLIER = 2.4;
  const BOOST_VISUAL_INTERVAL_MS = 1000 / 30;
  let lastBoostVisualAt = -Infinity;
  let boostVisualDirty = true;
  let publishedBoosting = null;
  let publishedLocked = null;
  let publishedDriftCharging = null;
  let publishedChargePercent = null;
  let publishedAriaPercent = null;

  function safeVibrate(pattern) {
    try {
      navigator.vibrate?.(pattern);
    } catch (_) {}
  }

  function flashBoostHud(className) {
    window.clearTimeout(boostFlashTimer);
    boostHud.classList.remove('is-boost-full-flash', 'is-boost-empty-flash');
    void boostHud.offsetWidth;
    boostHud.classList.add(className);
    boostFlashTimer = window.setTimeout(() => {
      boostHud.classList.remove(className);
      boostFlashTimer = 0;
    }, 700);
  }

  function getBoostDrainSeconds() {
    const duration = Number(globalThis.__turnVehicleTuning?.boostDurationSeconds);
    if (!Number.isFinite(duration)) return DEFAULT_BOOST_DRAIN_SECONDS;
    return Math.max(0.8, Math.min(5, duration));
  }

  function zoneFromPointer(event) {
    const rect = drivePad.getBoundingClientRect();
    const margin = 24;
    if (
      event.clientX < rect.left - margin ||
      event.clientX > rect.right + margin ||
      event.clientY < rect.top - margin ||
      event.clientY > rect.bottom + margin
    ) return null;

    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    if (y < TOP_ZONE_SHARE) return x < 0.5 ? 'drift' : 'boost';
    return 'gas';
  }

  function setDriveZone(nextZone, { announce = true } = {}) {
    if (nextZone === driveZone) return;
    const previousZone = driveZone;
    if (previousZone === 'boost' && nextZone !== 'boost') boostExhausted = false;
    driveZone = nextZone;
    globalThis.__turnAnalogGas = nextZone ? 1 : 0;
    globalThis.__turnDriftHeld = nextZone === 'drift';
    boostRequested = nextZone === 'boost';

    drivePad.dataset.driveZone = nextZone || '';
    gasButton.classList.toggle('is-active', nextZone === 'gas');
    driftZone.classList.toggle('is-active', nextZone === 'drift');
    boostZone.classList.toggle('is-active', nextZone === 'boost');

    if (announce && nextZone && nextZone !== previousZone && (nextZone === 'drift' || nextZone === 'boost')) {
      safeVibrate(14);
    }
  }

  function updateDrivePointer(event) {
    if (drivePointerId === null || event.pointerId !== drivePointerId) return;
    event.preventDefault();
    setDriveZone(zoneFromPointer(event));
  }

  function releaseDrive(event) {
    if (drivePointerId === null || (event?.pointerId != null && event.pointerId !== drivePointerId)) return;
    const releasedPointerId = drivePointerId;
    drivePointerId = null;
    drivePad.releasePointerCapture?.(releasedPointerId);
    setDriveZone(null, { announce: false });
    boostRequested = false;
    boostExhausted = false;
    globalThis.__turnBoostActive = false;
    drivePad.classList.remove('is-boosting', 'is-boost-locked');
  }

  drivePad.addEventListener('pointerdown', (event) => {
    if (drivePointerId !== null) return;
    event.preventDefault();
    drivePointerId = event.pointerId;
    boostExhausted = false;
    drivePad.setPointerCapture?.(event.pointerId);
    setDriveZone(zoneFromPointer(event), { announce: false });
  });
  drivePad.addEventListener('pointermove', updateDrivePointer);
  drivePad.addEventListener('pointerup', releaseDrive);
  drivePad.addEventListener('pointercancel', releaseDrive);
  drivePad.addEventListener('lostpointercapture', (event) => {
    if (drivePointerId === event.pointerId) releaseDrive(event);
  });

  const resetRivalsButton = document.createElement('button');
  resetRivalsButton.type = 'button';
  resetRivalsButton.className = 'utility reset-rivals-button';
  resetRivalsButton.textContent = 'Reset Rivals';
  resetRivalsButton.setAttribute('aria-label', 'Reset saved rivals');
  resetRivalsButton.title = 'Reset saved rivals';
  utilityGroup.appendChild(resetRivalsButton);

  const dialog = document.createElement('dialog');
  dialog.className = 'nuke-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="nuke-dialog-card">
      <div class="nuke-dialog-icon" aria-hidden="true"><span class="mushroom-cloud-icon"><i></i></span></div>
      <h2>RESET RIVALS?</h2>
      <p>Remove all saved rivals and their lap records?</p>
      <div class="nuke-dialog-actions">
        <button value="cancel" class="nuke-cancel">Cancel</button>
        <button value="nuke" class="nuke-confirm">Reset rivals</button>
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

  resetRivalsButton.addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });
  dialog.querySelector('.nuke-cancel')?.addEventListener('click', closeNukeDialog);
  dialog.querySelector('.nuke-confirm')?.addEventListener('click', (event) => {
    event.preventDefault();
    closeNukeDialog();
    effect.hidden = false;
    document.body.classList.add('turn-nuking');
    window.setTimeout(() => globalThis.__turnResetRivals?.(), 360);
    window.setTimeout(() => {
      document.body.classList.remove('turn-nuking');
      effect.hidden = true;
    }, 1650);
  });

  window.addEventListener('blur', () => {
    releaseDrive();
    centerManualSteerVisual();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseDrive();
      centerManualSteerVisual();
    }
  });

  function nearestRivalDistance(runtime, active) {
    if (!active || !runtime?.state?.lapActive || !runtime?.playerCar?.position) return Infinity;
    let nearestSquared = Infinity;
    const player = runtime.playerCar.position;

    for (const car of runtime.competitorCars || []) {
      if (!car?.visible || !car.position) continue;
      const dx = car.position.x - player.x;
      const dz = car.position.z - player.z;
      nearestSquared = Math.min(nearestSquared, dx * dx + dz * dz);
    }

    return Number.isFinite(nearestSquared) ? Math.sqrt(nearestSquared) : Infinity;
  }

  function updateAudio(now, boosting) {
    const runtime = globalThis.__turnRuntime;
    const runtimeState = runtime?.state;
    const spectating = runtimeState?.mode === runtime?.GAME_MODE?.SPECTATING;
    const active = Boolean(runtimeState?.running) &&
      !document.hidden &&
      !document.body.classList.contains('turn-lot-open') &&
      !spectating;
    const tuningTopSpeed = Number(runtimeState?.vehicleTuning?.topSpeedMultiplier) || 1;

    globalThis.__turnAudio?.update({
      active,
      speed: runtimeState?.speed || 0,
      maxSpeed: (runtime?.maxSpeed || 88) * tuningTopSpeed,
      throttle: runtimeState?.throttle || 0,
      driftAmount: runtimeState?.driftAmount || 0,
      driftHeld: Boolean(globalThis.__turnDriftHeld),
      boostActive: boosting,
      enginePitch: runtimeState?.vehicleTuning?.enginePitch || 1,
      nearestRivalDistance: nearestRivalDistance(runtime, active)
    }, now);
  }

  function updateBoost(now) {
    const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;
    const active = boostRequested && !boostExhausted && boostCharge > 0.001;

    if (active) {
      boostCharge = Math.max(0, boostCharge - dt / getBoostDrainSeconds());
      if (boostCharge <= 0) {
        boostExhausted = true;
        safeVibrate([28, 36, 62]);
      }
    } else {
      const rechargeMultiplier = globalThis.__turnDriftHeld ? DRIFT_RECHARGE_MULTIPLIER : 1;
      boostCharge = Math.min(1, boostCharge + dt * rechargeMultiplier / BOOST_RECHARGE_SECONDS);
    }

    const becameEmpty = previousBoostCharge > 0.001 && boostCharge <= 0.001;
    const becameFull = previousBoostCharge < 0.999 && boostCharge >= 0.999;
    previousBoostCharge = boostCharge;

    const boosting = boostRequested && !boostExhausted && boostCharge > 0.001;
    globalThis.__turnBoostActive = boosting;
    globalThis.__turnBoostCharge = boostCharge;
    updateAudio(now, boosting);

    const locked = boostRequested && boostExhausted;
    const driftCharging = globalThis.__turnDriftHeld && !boosting;
    const chargePercent = (boostCharge * 100).toFixed(1) + '%';
    const ariaPercent = Math.round(boostCharge * 100);
    const controlsVisible = !controlsRoot?.hidden && !document.hidden;
    const stateChanged =
      boosting !== publishedBoosting ||
      locked !== publishedLocked ||
      driftCharging !== publishedDriftCharging;
    const visualDue = now - lastBoostVisualAt >= BOOST_VISUAL_INTERVAL_MS;

    if (!controlsVisible) {
      boostVisualDirty = true;
      return;
    }
    if (becameEmpty) {
      globalThis.__turnAudio?.cue('boost-empty');
      flashBoostHud('is-boost-empty-flash');
    } else if (becameFull) {
      globalThis.__turnAudio?.cue('boost-full');
      flashBoostHud('is-boost-full-flash');
    }
    if (!boostVisualDirty && !stateChanged && !visualDue) return;

    if (boostVisualDirty || boosting !== publishedBoosting) {
      drivePad.classList.toggle('is-boosting', boosting);
      boostHud.classList.toggle('is-boosting', boosting);
      publishedBoosting = boosting;
    }
    if (boostVisualDirty || locked !== publishedLocked) {
      drivePad.classList.toggle('is-boost-locked', locked);
      boostZone.classList.toggle('is-locked', locked);
      publishedLocked = locked;
    }
    if (boostVisualDirty || driftCharging !== publishedDriftCharging) {
      boostHud.classList.toggle('is-drift-charging', driftCharging);
      publishedDriftCharging = driftCharging;
    }
    if (boostVisualDirty || chargePercent !== publishedChargePercent) {
      drivePad.style.setProperty('--boost-charge', chargePercent);
      boostHud.style.setProperty('--boost-charge', chargePercent);
      publishedChargePercent = chargePercent;
    }
    if (boostVisualDirty || ariaPercent !== publishedAriaPercent) {
      boostHud.setAttribute('aria-label', 'Boost ' + ariaPercent + ' percent charged');
      publishedAriaPercent = ariaPercent;
    }
    boostVisualDirty = false;
    lastBoostVisualAt = now;
  }

  setDriveZone(null, { announce: false });
  globalThis.__turnUpdateGameplayControls = updateBoost;
}

import { createBoostReservoir, updateBoostReservoir } from '../race/boost-reservoir.js';

globalThis.__turnBoostActive = false;
globalThis.__turnBoostCharge = 1;
globalThis.__turnNitrousCharge = 0;
globalThis.__turnNitrousActive = false;
globalThis.__turnBoostPowerMultiplier = 1;
globalThis.__turnBoostSpeedMultiplier = 1;
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
  boostHud.innerHTML = '<span>BOOST</span><div><i class="boost-normal"></i><i class="boost-nitrous"></i></div>';
  hud.appendChild(boostHud);
  const boostLabel = boostHud.querySelector('span');

  const driveStack = document.createElement('div');
  driveStack.className = 'drive-stack';

  const drivePad = document.createElement('div');
  drivePad.className = 'drive-pad';
  drivePad.setAttribute('role', 'group');
  drivePad.setAttribute('aria-label', 'Drive control. Slide between Gas, Drift and Boost.');
  drivePad.style.setProperty('--boost-charge', '100%');
  drivePad.style.setProperty('--boost-normal', '100%');
  drivePad.style.setProperty('--boost-nitrous', '0%');

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
  let boostReservoir = createBoostReservoir(1, 0);
  let previousTime = performance.now();
  const TOP_ZONE_SHARE = 0.42;
  const DEFAULT_BOOST_DRAIN_SECONDS = 2.0;
  const BOOST_RECHARGE_SECONDS = 4.2;
  const DRIFT_RECHARGE_MULTIPLIER = 2.4;

  function safeVibrate(pattern) {
    try {
      navigator.vibrate?.(pattern);
    } catch (_) {}
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
    globalThis.__turnNitrousActive = false;
    globalThis.__turnBoostPowerMultiplier = 1;
    globalThis.__turnBoostSpeedMultiplier = 1;
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

  function updateBoost(now) {
    const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;
    const inBoostAbilityZone = globalThis.__turnAbilityZoneType === 'boost';
    const nextReservoir = updateBoostReservoir(boostReservoir, {
      dt,
      requested: boostRequested,
      locked: boostExhausted,
      inBoostZone: inBoostAbilityZone,
      driftHeld: globalThis.__turnDriftHeld,
      drainSeconds: getBoostDrainSeconds(),
      rechargeSeconds: BOOST_RECHARGE_SECONDS,
      driftRechargeMultiplier: DRIFT_RECHARGE_MULTIPLIER
    });
    boostReservoir = nextReservoir;

    if (nextReservoir.exhausted && !boostExhausted) {
      boostExhausted = true;
      safeVibrate([28, 36, 62]);
    }

    const boosting = nextReservoir.boosting;
    globalThis.__turnBoostActive = boosting;
    globalThis.__turnBoostCharge = nextReservoir.charge;
    globalThis.__turnNitrousCharge = nextReservoir.nitrousCharge;
    globalThis.__turnNitrousActive = nextReservoir.nitrousActive;
    globalThis.__turnBoostPowerMultiplier = nextReservoir.boostPowerMultiplier;
    globalThis.__turnBoostSpeedMultiplier = nextReservoir.boostSpeedMultiplier;
    drivePad.classList.toggle('is-boosting', boosting);
    drivePad.classList.toggle('is-nitrous', nextReservoir.nitrousActive);
    drivePad.classList.toggle('has-nitrous', nextReservoir.nitrousCharge > 0.001);
    drivePad.classList.toggle('is-boost-zone', inBoostAbilityZone);
    drivePad.classList.toggle('is-boost-locked', boostRequested && boostExhausted);
    boostZone.classList.toggle('is-locked', boostRequested && boostExhausted);
    boostHud.classList.toggle('is-boosting', boosting);
    boostHud.classList.toggle('is-nitrous', nextReservoir.nitrousActive);
    boostHud.classList.toggle('has-nitrous', nextReservoir.nitrousCharge > 0.001);
    boostHud.classList.toggle('is-drift-charging', globalThis.__turnDriftHeld && !boosting);
    const chargePercent = (nextReservoir.charge * 100).toFixed(1) + '%';
    const normalPercent = (nextReservoir.normalCharge * 100).toFixed(1) + '%';
    const nitrousPercent = (nextReservoir.nitrousCharge * 100).toFixed(1) + '%';
    drivePad.style.setProperty('--boost-charge', chargePercent);
    drivePad.style.setProperty('--boost-normal', normalPercent);
    drivePad.style.setProperty('--boost-nitrous', nitrousPercent);
    boostHud.style.setProperty('--boost-charge', chargePercent);
    boostHud.style.setProperty('--boost-normal', normalPercent);
    boostHud.style.setProperty('--boost-nitrous', nitrousPercent);
    boostLabel.textContent = nextReservoir.nitrousActive
      ? 'NITROUS'
      : (nextReservoir.nitrousCharge > 0.001 ? 'BOOST · N₂O' : 'BOOST');
    boostHud.setAttribute(
      'aria-label',
      'Boost ' + Math.round(nextReservoir.charge * 100) + ' percent charged, ' +
        Math.round(nextReservoir.nitrousCharge * 100) + ' percent nitrous'
    );
    requestAnimationFrame(updateBoost);
  }

  setDriveZone(null, { announce: false });
  requestAnimationFrame(updateBoost);
}

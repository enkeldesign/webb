import {
  DRIFT_LOCK_RECHARGE_MULTIPLIER,
  advanceDriftLockAmount,
  driftThrottleForLock,
  pointerUsesDriftLock,
  resolveDriftBoostRechargeMultiplier
} from '../input/drift-lock.js?revision=r218-boost-balance';
import {
  BOOST_OVERCHARGE_PHASE,
  advanceBoostOvercharge,
  boostOverchargeVisualWidth,
  qualifiesForBoostOvercharge,
  resolveBoostSlipAngle
} from '../input/boost-overcharge.js?revision=r219-overcharge-state';
import {
  driftLockSideForHandedness,
  installControlHandedness,
  normalizeControlHandedness,
  topDriveZoneAt
} from './control-handedness.js';

globalThis.__turnBoostActive = false;
globalThis.__turnBoostCharge = 1;
globalThis.__turnBoostOvercharge = 0;
globalThis.__turnBoostOverchargeCaught = false;
globalThis.__turnDriftHeld = false;
globalThis.__turnDriftLockAmount = 0;

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
  boostHud.setAttribute('role', 'meter');
  boostHud.setAttribute('aria-label', 'Boost');
  boostHud.setAttribute('aria-valuemin', '0');
  boostHud.setAttribute('aria-valuemax', '120');
  boostHud.setAttribute('aria-valuenow', '100');
  boostHud.setAttribute('aria-valuetext', '100 percent charged.');
  boostHud.innerHTML = '<span>BOOST</span><div><i></i></div>';
  hud.appendChild(boostHud);
  const boostFill = boostHud.querySelector('i');

  const driveStack = document.createElement('div');
  driveStack.className = 'drive-stack';

  const drivePad = document.createElement('div');
  drivePad.className = 'drive-pad';
  drivePad.setAttribute('role', 'group');
  drivePad.setAttribute(
    'aria-label',
    'Drive control. Double tap and hold, then slide between GAS, DRIFT, BOOST, and BRAKE or REVERSE. DRIFT charges BOOST and builds OVERCHARGE after the bar is full. GAS catches and holds OVERCHARGE. BOOST spends OVERCHARGE before normal BOOST. While holding DRIFT, slide outward into LOCK for rear-wheel lock.'
  );
  drivePad.style.setProperty('--boost-charge', '100%');

  const driftLockBubble = document.createElement('div');
  driftLockBubble.className = 'drive-lock-bubble';
  driftLockBubble.setAttribute('aria-hidden', 'true');
  driftLockBubble.innerHTML = '<span>LOCK</span>';

  const driveTop = document.createElement('div');
  driveTop.className = 'drive-pad-top';

  const driftZone = document.createElement('button');
  driftZone.type = 'button';
  driftZone.className = 'drive-zone drive-drift-zone';
  driftZone.textContent = 'Drift';
  driftZone.setAttribute('aria-label', 'GAS and DRIFT. DRIFT charges BOOST; after the bar is full, it builds OVERCHARGE. Slide outward into LOCK for rear-wheel lock.');

  const boostZone = document.createElement('button');
  boostZone.type = 'button';
  boostZone.className = 'drive-zone drive-boost-zone';
  boostZone.textContent = 'Boost';
  boostZone.setAttribute('aria-label', 'GAS and BOOST. BOOST spends OVERCHARGE before normal BOOST.');

  gasButton.classList.add('drive-gas-zone');
  gasButton.textContent = 'Gas';
  gasButton.setAttribute('aria-label', 'GAS. Catches and holds OVERCHARGE.');

  brakeButton.classList.add('drive-brake-zone', 'brake-reverse');
  brakeButton.textContent = 'Brake · Reverse';
  brakeButton.setAttribute('aria-label', 'Brake. Hold after stopping to reverse.');

  driveTop.append(driftZone, boostZone);
  drivePad.append(driveTop, gasButton, brakeButton);
  driveStack.append(driftLockBubble, drivePad);
  pedals.replaceChildren(driveStack);

  let controlHandedness = installControlHandedness();
  globalThis.addEventListener?.('turn:control-handedness-change', (event) => {
    controlHandedness = normalizeControlHandedness(event.detail?.handedness);
  });

  let drivePointerId = null;
  let driveZone = null;
  let boostRequested = false;
  let boostExhausted = false;
  let driftLockRequested = false;
  let driftLockAmount = 0;
  let boostCharge = 1;
  let boostOvercharge = 0;
  let boostOverchargePhase = BOOST_OVERCHARGE_PHASE.READY;
  let previousBoostCharge = boostCharge;
  let boostFlashTimer = 0;
  let overchargePeakTimer = 0;
  let previousTime = performance.now();
  const TOP_ZONE_SHARE = 0.32;
  const BRAKE_ZONE_START = 0.76;
  const DEFAULT_BOOST_DRAIN_SECONDS = 2.0;
  const BOOST_TANK_DURATION_MULTIPLIER = 1.5;
  const BOOST_RECHARGE_SECONDS = 4.2;
  const DRIFT_RECHARGE_MULTIPLIER = 2.4;
  const DRIFT_LOCK_BOOST_GRADIENT = 'linear-gradient(90deg, #8b5cf6, #8ce99a)';
  const BOOST_VISUAL_INTERVAL_MS = 1000 / 30;
  let lastBoostVisualAt = -Infinity;
  let boostVisualDirty = true;
  let publishedBoosting = null;
  let publishedLocked = null;
  let publishedDriftCharging = null;
  let publishedDriftLocking = null;
  let publishedOvercharge = null;
  let publishedOverchargeCaught = null;
  let publishedOverchargeVolatile = null;
  let publishedChargePercent = null;
  let publishedMeterValue = null;
  let publishedAriaValueText = null;

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

  function flashOverchargePeak() {
    window.clearTimeout(overchargePeakTimer);
    boostHud.classList.remove('is-overcharge-peak');
    boostHud.classList.add('is-overcharge-peak');
    safeVibrate([14, 18, 24]);
    overchargePeakTimer = window.setTimeout(() => {
      boostHud.classList.remove('is-overcharge-peak');
      overchargePeakTimer = 0;
    }, 420);
  }

  function getBoostDrainSeconds() {
    const duration = Number(globalThis.__turnVehicleTuning?.boostDurationSeconds);
    const baseDuration = Number.isFinite(duration)
      ? Math.max(0.8, Math.min(5, duration))
      : DEFAULT_BOOST_DRAIN_SECONDS;
    return baseDuration * BOOST_TANK_DURATION_MULTIPLIER;
  }

  function getDriftRechargeMultiplier() {
    const multiplier = Number(globalThis.__turnVehicleTuning?.driftBoostRechargeMultiplier);
    if (!Number.isFinite(multiplier)) return DRIFT_RECHARGE_MULTIPLIER;
    return Math.max(1, Math.min(6, multiplier));
  }

  function refillBoost() {
    window.clearTimeout(boostFlashTimer);
    window.clearTimeout(overchargePeakTimer);
    boostFlashTimer = 0;
    overchargePeakTimer = 0;
    boostCharge = 1;
    previousBoostCharge = 1;
    boostExhausted = false;
    boostOvercharge = 0;
    boostOverchargePhase = BOOST_OVERCHARGE_PHASE.READY;
    globalThis.__turnBoostCharge = 1;
    globalThis.__turnBoostOvercharge = 0;
    globalThis.__turnBoostOverchargeCaught = false;
    boostVisualDirty = true;
    lastBoostVisualAt = -Infinity;
    publishedChargePercent = null;
    publishedMeterValue = null;
    publishedAriaValueText = null;
    publishedLocked = null;
    publishedDriftLocking = null;
    publishedOvercharge = null;
    publishedOverchargeCaught = null;
    publishedOverchargeVolatile = null;
    driftLockRequested = false;
    driftLockAmount = 0;
    globalThis.__turnDriftLockAmount = 0;
    boostFill?.style.removeProperty('background');
    drivePad.style.setProperty('--boost-charge', '100%');
    boostHud.style.setProperty('--boost-charge', '100%');
    boostHud.style.setProperty('--boost-overcharge-width', '0%');
    boostHud.style.setProperty('--boost-base-width', '100%');
    boostHud.setAttribute('aria-valuenow', '100');
    boostHud.setAttribute('aria-valuetext', '100 percent charged.');
    driveStack.classList.toggle('is-drift-ready', driveZone === 'drift');
    driveStack.classList.remove('is-drift-locking');
    drivePad.classList.remove('is-boost-locked');
    boostZone.classList.remove('is-locked');
    boostHud.classList.remove(
      'is-boost-full-flash',
      'is-boost-empty-flash',
      'is-drift-locking',
      'has-overcharge',
      'is-overcharge-caught',
      'is-overcharge-volatile',
      'is-overcharge-peak'
    );
  }

  globalThis.__turnRefillBoost = refillBoost;

  function zoneFromPointer(event, rect = drivePad.getBoundingClientRect()) {
    const margin = 24;
    if (
      event.clientX < rect.left - margin ||
      event.clientX > rect.right + margin ||
      event.clientY < rect.top - margin ||
      event.clientY > rect.bottom + margin
    ) return null;

    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    if (y < TOP_ZONE_SHARE) return topDriveZoneAt(x, controlHandedness);
    if (y >= BRAKE_ZONE_START) return 'brake';
    return 'gas';
  }

  function driveInputFromPointer(event) {
    const rect = drivePad.getBoundingClientRect();
    const lockRequested = pointerUsesDriftLock({
      driftActive: driveZone === 'drift',
      pointerX: event.clientX,
      pointerY: event.clientY,
      padLeft: rect.left,
      padRight: rect.right,
      padTop: rect.top,
      padHeight: rect.height,
      bubbleWidth: driftLockBubble.offsetWidth,
      lockSide: driftLockSideForHandedness(controlHandedness)
    });
    if (lockRequested) return { zone: 'drift', lockRequested: true };

    const zone = zoneFromPointer(event, rect);
    return { zone, lockRequested: false };
  }

  function setBrakeInput(active) {
    const runtimeState = globalThis.__turnRuntime?.state;
    if (runtimeState) runtimeState.touchBrake = Boolean(active);
  }

  function setDriveZone(nextZone, lockRequested = false, { announce = true } = {}) {
    const nextLockRequested = nextZone === 'drift' && lockRequested === true;
    const zoneChanged = nextZone !== driveZone;
    const lockRequestChanged = nextLockRequested !== driftLockRequested;
    if (!zoneChanged && !lockRequestChanged) return;
    const previousZone = driveZone;
    if (previousZone === 'boost' && nextZone !== 'boost') boostExhausted = false;
    driveZone = nextZone;
    driftLockRequested = nextLockRequested;
    if (nextZone !== 'drift') {
      driftLockAmount = 0;
      globalThis.__turnDriftLockAmount = 0;
    }
    const forwardDrive = nextZone === 'gas' || nextZone === 'drift' || nextZone === 'boost';
    const forwardThrottle = nextZone === 'drift'
      ? driftThrottleForLock(driftLockAmount)
      : 1;
    globalThis.__turnAnalogGas = forwardDrive ? forwardThrottle : 0;
    globalThis.__turnDriftHeld = nextZone === 'drift';
    boostRequested = nextZone === 'boost';
    setBrakeInput(nextZone === 'brake');
    boostVisualDirty = boostVisualDirty || lockRequestChanged || zoneChanged;

    drivePad.dataset.driveZone = nextZone || '';
    driveStack.classList.toggle('is-drift-ready', nextZone === 'drift');
    driveStack.classList.toggle('is-drift-locking', nextLockRequested);
    gasButton.classList.toggle('is-active', nextZone === 'gas');
    driftZone.classList.toggle('is-active', nextZone === 'drift');
    boostZone.classList.toggle('is-active', nextZone === 'boost');
    brakeButton.classList.toggle('is-active', nextZone === 'brake');

    if (announce && nextZone && nextZone !== previousZone && (nextZone === 'drift' || nextZone === 'boost')) {
      safeVibrate(14);
    }
    if (announce && lockRequestChanged && nextZone === 'drift') {
      safeVibrate(nextLockRequested ? 18 : 8);
    }
  }

  function consumeDrivePointer(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function updateDrivePointer(event) {
    consumeDrivePointer(event);
    if (drivePointerId === null || event.pointerId !== drivePointerId) return;
    const input = driveInputFromPointer(event);
    setDriveZone(input.zone, input.lockRequested);
  }

  function releaseDrive(event) {
    if (event) consumeDrivePointer(event);
    if (drivePointerId === null || (event?.pointerId != null && event.pointerId !== drivePointerId)) return;
    const releasedPointerId = drivePointerId;
    drivePointerId = null;
    drivePad.releasePointerCapture?.(releasedPointerId);
    setDriveZone(null, false, { announce: false });
    boostRequested = false;
    boostExhausted = false;
    globalThis.__turnBoostActive = false;
    drivePad.classList.remove('is-boosting', 'is-boost-locked');
  }

  drivePad.addEventListener('pointerdown', (event) => {
    consumeDrivePointer(event);
    if (drivePointerId !== null) return;
    drivePointerId = event.pointerId;
    boostExhausted = false;
    drivePad.setPointerCapture?.(event.pointerId);
    const input = driveInputFromPointer(event);
    setDriveZone(input.zone, input.lockRequested, { announce: false });
  }, { capture: true });
  drivePad.addEventListener('pointermove', updateDrivePointer, { capture: true });
  drivePad.addEventListener('pointerup', releaseDrive, { capture: true });
  drivePad.addEventListener('pointercancel', releaseDrive, { capture: true });
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
  window.addEventListener('turn:ui-state-change', (event) => {
    if (event.detail?.reason === 'race-reset') refillBoost();
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
      driftLockAmount: Math.max(0, Number(globalThis.__turnDriftLockAmount) || 0),
      boostActive: boosting,
      vehicleId: runtimeState?.vehicleId || '',
      enginePitch: runtimeState?.vehicleTuning?.enginePitch || 1,
      nearestRivalDistance: nearestRivalDistance(runtime, active)
    }, now);
  }

  function updateBoost(now) {
    const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;
    const lockCanRun = driveZone === 'drift' && globalThis.__turnDriftHeld === true;
    driftLockAmount = advanceDriftLockAmount(
      driftLockAmount,
      lockCanRun && driftLockRequested,
      dt
    );
    globalThis.__turnDriftLockAmount = lockCanRun ? driftLockAmount : 0;
    if (lockCanRun) {
      globalThis.__turnAnalogGas = driftThrottleForLock(driftLockAmount);
    }

    const rechargeMultiplier = resolveDriftBoostRechargeMultiplier({
      driftHeld: globalThis.__turnDriftHeld === true,
      driftLockAmount,
      lockedMultiplier: getDriftRechargeMultiplier(),
      lockCeilingMultiplier: DRIFT_LOCK_RECHARGE_MULTIPLIER
    });
    const active = boostRequested && !boostExhausted && (boostOvercharge > 0 || boostCharge > 0.001);

    if (active) {
      if (boostOvercharge > 0) {
        const overchargeState = advanceBoostOvercharge({
          amount: boostOvercharge,
          phase: boostOverchargePhase,
          dt,
          zone: driveZone,
          consuming: true
        });
        boostOvercharge = overchargeState.amount;
        boostOverchargePhase = overchargeState.phase;
      } else {
        boostCharge = Math.max(0, boostCharge - dt / getBoostDrainSeconds());
        if (boostCharge <= 0) {
          boostExhausted = true;
          safeVibrate([28, 36, 62]);
        }
      }
    } else {
      if (boostCharge < 0.999999) {
        boostCharge = Math.min(1, boostCharge + dt * rechargeMultiplier / BOOST_RECHARGE_SECONDS);
      }

      if (boostCharge >= 0.999999 || boostOvercharge > 0) {
        const runtimeState = globalThis.__turnRuntime?.state;
        const slipAngle = resolveBoostSlipAngle({
          heading: runtimeState?.heading,
          velocity: runtimeState?.velocity
        });
        const qualifyingDrift = qualifiesForBoostOvercharge({
          driftHeld: globalThis.__turnDriftHeld === true,
          speed: runtimeState?.speed,
          slipAngle
        });
        const overchargeState = advanceBoostOvercharge({
          amount: boostOvercharge,
          phase: boostOverchargePhase,
          dt,
          zone: driveZone,
          qualifyingDrift,
          rechargeMultiplier
        });
        boostOvercharge = overchargeState.amount;
        boostOverchargePhase = overchargeState.phase;
        if (overchargeState.peaked) flashOverchargePeak();
      }
    }

    const becameEmpty = previousBoostCharge > 0.001 && boostCharge <= 0.001;
    const becameFull = previousBoostCharge < 0.999 && boostCharge >= 0.999;
    previousBoostCharge = boostCharge;

    const boosting = boostRequested && !boostExhausted && (boostOvercharge > 0 || boostCharge > 0.001);
    const overchargeCaught = boostOvercharge > 0 && driveZone === 'gas' && !boosting;
    const overchargeVolatile = boostOvercharge > 0 && !overchargeCaught && !boosting;
    globalThis.__turnBoostActive = boosting;
    globalThis.__turnBoostCharge = boostCharge;
    globalThis.__turnBoostOvercharge = boostOvercharge;
    globalThis.__turnBoostOverchargeCaught = overchargeCaught;
    updateAudio(now, boosting);

    const locked = boostRequested && boostExhausted;
    const driftCharging = globalThis.__turnDriftHeld && !boosting;
    const driftLocking = driftCharging && (driftLockRequested || driftLockAmount > 0.001);
    const hasOvercharge = boostOvercharge > 0;
    const chargePercent = (boostCharge * 100).toFixed(1) + '%';
    const overchargePercent = Math.round(boostOvercharge * 100);
    const overchargeWidth = boostOverchargeVisualWidth(boostOvercharge);
    const overchargeWidthPercent = (overchargeWidth * 100).toFixed(1) + '%';
    const baseWidthPercent = (100 / (1 + overchargeWidth)).toFixed(2) + '%';
    const meterValue = Math.round(boostCharge * 100 + overchargeWidth * 100);
    const ariaPercent = Math.round(boostCharge * 100);
    let ariaValueText;
    if (hasOvercharge) {
      const overchargeStateLabel = overchargeCaught
        ? 'caught and held with GAS'
        : boosting
          ? 'being used'
          : boostOverchargePhase === BOOST_OVERCHARGE_PHASE.DECAYING
            ? 'leaking'
            : 'building';
      ariaValueText = `Full. Overcharge ${overchargePercent} percent ${overchargeStateLabel}.`;
    } else {
      ariaValueText = driftLocking
        ? `Drift lock active. ${ariaPercent} percent charged.`
        : `${ariaPercent} percent charged.`;
    }
    const controlsVisible = !controlsRoot?.hidden && !document.hidden;
    const stateChanged =
      boosting !== publishedBoosting ||
      locked !== publishedLocked ||
      driftCharging !== publishedDriftCharging ||
      driftLocking !== publishedDriftLocking ||
      hasOvercharge !== publishedOvercharge ||
      overchargeCaught !== publishedOverchargeCaught ||
      overchargeVolatile !== publishedOverchargeVolatile;
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
    if (boostVisualDirty || driftLocking !== publishedDriftLocking) {
      boostHud.classList.toggle('is-drift-locking', driftLocking);
      if (boostFill) {
        if (driftLocking) {
          // design-semantic.css intentionally owns the normal DRIFT gradient with
          // !important. LOCK is a stronger transient state, so publish its fill
          // directly at the element level with the same cascade priority.
          boostFill.style.setProperty('background', DRIFT_LOCK_BOOST_GRADIENT, 'important');
        } else {
          boostFill.style.removeProperty('background');
        }
      }
      publishedDriftLocking = driftLocking;
    }
    if (boostVisualDirty || hasOvercharge !== publishedOvercharge) {
      boostHud.classList.toggle('has-overcharge', hasOvercharge);
      publishedOvercharge = hasOvercharge;
    }
    if (boostVisualDirty || overchargeCaught !== publishedOverchargeCaught) {
      boostHud.classList.toggle('is-overcharge-caught', overchargeCaught);
      publishedOverchargeCaught = overchargeCaught;
    }
    if (boostVisualDirty || overchargeVolatile !== publishedOverchargeVolatile) {
      boostHud.classList.toggle('is-overcharge-volatile', overchargeVolatile);
      publishedOverchargeVolatile = overchargeVolatile;
    }
    if (boostVisualDirty || chargePercent !== publishedChargePercent || hasOvercharge) {
      drivePad.style.setProperty('--boost-charge', chargePercent);
      boostHud.style.setProperty('--boost-charge', chargePercent);
      boostHud.style.setProperty('--boost-overcharge-width', overchargeWidthPercent);
      boostHud.style.setProperty('--boost-base-width', baseWidthPercent);
      publishedChargePercent = chargePercent;
    }
    if (boostVisualDirty || meterValue !== publishedMeterValue) {
      boostHud.setAttribute('aria-valuenow', String(meterValue));
      publishedMeterValue = meterValue;
    }
    if (boostVisualDirty || ariaValueText !== publishedAriaValueText) {
      boostHud.setAttribute('aria-valuetext', ariaValueText);
      publishedAriaValueText = ariaValueText;
    }
    boostVisualDirty = false;
    lastBoostVisualAt = now;
  }

  setDriveZone(null, false, { announce: false });
  globalThis.__turnUpdateGameplayControls = updateBoost;
}

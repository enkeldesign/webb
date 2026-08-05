(() => {
  const INSTALL_FLAG = '__turnLiveSteeringSettingInstalled';
  const STEERING_MODE_KEY = 'turn-steering-mode-v1';
  const MOTION_MODE = 'motion';
  const MANUAL_MODE = 'manual';

  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;

  function saveSteeringMode(mode) {
    try {
      localStorage.setItem(STEERING_MODE_KEY, mode);
    } catch (_) {}
  }

  function syncRadios(dialog, mode) {
    for (const radio of dialog?.querySelectorAll?.('input[name="m8Steering"]') || []) {
      radio.checked = radio.value === mode;
    }
  }

  function setRadiosBusy(dialog, busy) {
    const motionAvailable = typeof globalThis.DeviceMotionEvent !== 'undefined';
    for (const radio of dialog?.querySelectorAll?.('input[name="m8Steering"]') || []) {
      radio.disabled = busy || (radio.value === MOTION_MODE && !motionAvailable);
    }
  }

  function resetSteeringState(state) {
    state.steering = 0;
    state.manualSteering = 0;
    state.steeringEngaged = false;
  }

  function calibrateMotionAfterSwitch(state) {
    window.setTimeout(() => {
      if (!state.sensorMode) return;
      state.neutralRoll = state.targetRoll;
      state.horizonRollReference = state.targetRoll;
      state.roll = state.targetRoll;
      state.neutralPitch = state.targetPitch;
      state.pitch = state.targetPitch;
      state.steering = 0;
    }, 220);
  }

  function publishChange(state, mode) {
    window.dispatchEvent(new CustomEvent('turn:ui-state-change', {
      detail: {
        reason: 'steering-mode-changed',
        mode: globalThis.__turnGetGameMode?.(),
        running: state.running,
        steeringMode: mode
      }
    }));
  }

  async function applySteeringModeDuringRace(input) {
    const requestedMode = input.value === MOTION_MODE ? MOTION_MODE : MANUAL_MODE;
    const state = globalThis.__turnRuntime?.state;
    const raceSession = globalThis.__turnNextRaceSession;
    const dialog = input.closest?.('.m8-settings-dialog') || input.closest?.('dialog');
    const status = dialog?.querySelector?.('.m8-settings-status');
    const manualSteer = document.querySelector('#manualSteer');

    // On Home, the stored preference is enough. The normal race-start gate will apply it.
    if (!state?.running || document.body.classList.contains('turn-home-open')) return;
    if (!raceSession) return;

    setRadiosBusy(dialog, true);

    try {
      if (requestedMode === MOTION_MODE) {
        const access = await raceSession.prepareMotionAccess();
        await Promise.resolve(access?.fullscreenPromise).catch(() => false);
        resetSteeringState(state);
        if (manualSteer) manualSteer.hidden = true;
        calibrateMotionAfterSwitch(state);
      } else {
        globalThis.__turnMotionLifecycle?.stop?.();
        raceSession.prepareManualAccess();
        resetSteeringState(state);
        if (manualSteer) manualSteer.hidden = false;
      }

      saveSteeringMode(requestedMode);
      syncRadios(dialog, requestedMode);
      publishChange(state, requestedMode);

      if (status) {
        status.textContent = requestedMode === MOTION_MODE
          ? 'Steering changed to device rotation for this race.'
          : 'Steering changed to the on-screen control for this race.';
      }
    } catch (error) {
      const activeMode = state.sensorMode ? MOTION_MODE : MANUAL_MODE;
      saveSteeringMode(activeMode);
      syncRadios(dialog, activeMode);
      if (manualSteer) manualSteer.hidden = activeMode === MOTION_MODE;
      if (status) {
        const message = error instanceof Error && error.message
          ? error.message
          : 'The steering setting could not be changed.';
        status.textContent = `${message} Steering remains ${activeMode === MOTION_MODE ? 'on device rotation' : 'on the on-screen control'}.`;
      }
    } finally {
      setRadiosBusy(dialog, false);
    }
  }

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!input?.matches?.('input[name="m8Steering"]:checked')) return;
    void applySteeringModeDuringRace(input);
  });
})();

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`TURN race session requires ${name}().`);
  }
  return value;
}

function requireElement(elements, name) {
  const element = elements?.[name];
  if (!element || typeof element !== 'object') {
    throw new TypeError(`TURN race session requires elements.${name}.`);
  }
  return element;
}

function selectedVehicle(state) {
  return {
    carId: state.vehicleId,
    color: state.vehicleColor,
    secondaryColor: state.vehicleSecondaryColor
  };
}

function motionEventType(environment, windowRef) {
  return environment.DeviceMotionEvent || windowRef?.DeviceMotionEvent;
}

function errorMessage(error) {
  return error instanceof Error && error.message
    ? error.message
    : 'Motion could not be enabled.';
}

export function createRaceSessionOrchestrator({
  state,
  elements,
  environment = globalThis,
  showRaceSetup,
  applyVehicleSelection,
  prepareRaceStartState,
  publishUiState,
  handleMotion,
  resize,
  showMessage,
  now
} = {}) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('TURN race session requires state.');
  }

  const intro = requireElement(elements, 'intro');
  const hud = requireElement(elements, 'hud');
  const controls = requireElement(elements, 'controls');
  const manualSteer = requireElement(elements, 'manualSteer');
  const status = requireElement(elements, 'status');
  const chooseSetup = requireFunction(showRaceSetup, 'showRaceSetup');
  const applySelection = requireFunction(applyVehicleSelection, 'applyVehicleSelection');
  const prepareRace = requireFunction(prepareRaceStartState, 'prepareRaceStartState');
  const publish = requireFunction(publishUiState, 'publishUiState');
  const receiveMotion = requireFunction(handleMotion, 'handleMotion');
  const resizeViewport = requireFunction(resize, 'resize');
  const announce = requireFunction(showMessage, 'showMessage');

  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef?.document;
  const screenRef = environment.screen || windowRef?.screen;
  const clock = typeof now === 'function'
    ? now
    : () => environment.performance?.now?.() ?? windowRef?.performance?.now?.() ?? Date.now();
  const setTimer = typeof windowRef?.setTimeout === 'function'
    ? windowRef.setTimeout.bind(windowRef)
    : globalThis.setTimeout.bind(globalThis);

  let phase = 'idle';

  function requestGameFullscreen() {
    const root = documentRef?.documentElement;
    const request = root?.requestFullscreen || root?.webkitRequestFullscreen;
    if (!request || documentRef?.fullscreenElement || documentRef?.webkitFullscreenElement) {
      return Promise.resolve(false);
    }
    try {
      return Promise.resolve(request.call(root)).then(() => true).catch(() => false);
    } catch (_) {
      return Promise.resolve(false);
    }
  }

  async function startGame(fullscreenPromise = Promise.resolve(false)) {
    phase = 'starting';
    state.running = true;
    state.lastFrame = clock();
    prepareRace(state);
    intro.hidden = true;
    hud.hidden = false;
    controls.hidden = false;
    manualSteer.hidden = state.sensorMode;
    publish('race-started');

    if (state.sensorMode) {
      setTimer(() => {
        state.neutralRoll = state.targetRoll;
        state.horizonRollReference = state.targetRoll;
        state.roll = state.targetRoll;
        state.neutralPitch = state.targetPitch;
        state.pitch = state.targetPitch;
      }, 220);
    }

    await fullscreenPromise;
    try {
      await screenRef?.orientation?.lock?.('landscape');
    } catch (_) {}

    resizeViewport();
    setTimer(resizeViewport, 300);
    setTimer(resizeViewport, 900);
    announce('GO!');
    phase = 'racing';
    return true;
  }

  async function chooseRaceSetupAndStart(fullscreenPromise = Promise.resolve(false)) {
    phase = 'choosing';
    intro.hidden = true;
    const selection = await chooseSetup({
      initialSelection: selectedVehicle(state)
    });

    if (!selection) {
      intro.hidden = false;
      phase = 'idle';
      return false;
    }

    await applySelection(selection);
    return startGame(fullscreenPromise);
  }

  async function requestMotion() {
    const fullscreenPromise = requestGameFullscreen();
    try {
      const MotionEvent = motionEventType(environment, windowRef);
      if (typeof MotionEvent === 'undefined') {
        throw new Error('Motion sensors are not available in this browser.');
      }
      if (typeof MotionEvent.requestPermission === 'function') {
        const permission = await MotionEvent.requestPermission();
        if (permission !== 'granted') throw new Error('Motion permission was not granted.');
      }
      if (typeof windowRef?.addEventListener !== 'function') {
        throw new Error('Motion sensors are not available in this browser.');
      }
      windowRef.addEventListener('devicemotion', receiveMotion, { passive: true });
      state.sensorMode = true;
      return await chooseRaceSetupAndStart(fullscreenPromise);
    } catch (error) {
      phase = 'idle';
      status.textContent = `${errorMessage(error)} Manual mode still works.`;
      return false;
    }
  }

  async function useManualMode() {
    const fullscreenPromise = requestGameFullscreen();
    state.sensorMode = false;
    state.roll = 0;
    state.targetRoll = 0;
    state.neutralRoll = 0;
    state.horizonRollReference = 0;
    state.pitch = 0;
    state.targetPitch = 0;
    state.neutralPitch = 0;
    return chooseRaceSetupAndStart(fullscreenPromise);
  }

  async function openLotFromRace() {
    if (!state.running || documentRef?.body?.classList?.contains?.('turn-lot-open')) return false;

    const spectateState = environment.__turnGetSpectateV3State?.();
    if (spectateState?.active) {
      environment.__turnStopSpectateV3?.();
      documentRef?.body?.classList?.remove?.('turn-spectating');
    }

    const wasRunning = state.running;
    phase = 'lot';
    state.running = false;
    state.touchGas = false;
    state.touchBrake = false;
    state.manualSteering = 0;
    environment.__turnAnalogGas = 0;
    environment.__turnBoostActive = false;
    environment.__turnDriftHeld = false;

    hud.hidden = true;
    controls.hidden = true;
    manualSteer.hidden = true;
    publish('lot-open');

    const selection = await chooseSetup({
      initialSelection: selectedVehicle(state)
    });

    if (!selection) {
      state.running = wasRunning;
      state.lastFrame = clock();
      hud.hidden = false;
      controls.hidden = false;
      manualSteer.hidden = state.sensorMode;
      resizeViewport();
      publish('lot-cancelled');
      phase = wasRunning ? 'racing' : 'idle';
      return false;
    }

    await applySelection(selection);
    return startGame();
  }

  return Object.freeze({
    route: 'session-orchestrator',
    requestGameFullscreen,
    requestMotion,
    useManualMode,
    chooseRaceSetupAndStart,
    openLotFromRace,
    startGame,
    getPhase: () => phase
  });
}

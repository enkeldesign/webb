import { IN_GAME_MENU_STATE, inGameMenuVisibilityFor } from './in-game-menu-state.js';

function waitForRuntime() {
  if (globalThis.__turnRuntime) {
    install(globalThis.__turnRuntime);
    return;
  }

  window.addEventListener('turn:runtime-ready', (event) => {
    install(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

function install(runtime) {
  if (!runtime || runtime.__inGameMenuInstalled) return;

  const utilityGroup = document.querySelector('.utility-group');
  const backToStartButton = document.querySelector('#resetButton');
  const recalibrateButton = document.querySelector('#calibrateButton');
  const backToLotButton = document.querySelector('.back-to-lot-button');
  const resetRivalsButton = document.querySelector('.reset-rivals-button');
  const spectateButton = document.querySelector('.spectate-button');
  const lapTimeChip = document.querySelector('#lapTime')?.closest('.chip');

  if (!utilityGroup || !backToStartButton || !recalibrateButton || !backToLotButton || !resetRivalsButton || !spectateButton) {
    requestAnimationFrame(() => install(runtime));
    return;
  }

  runtime.__inGameMenuInstalled = true;

  backToStartButton.textContent = 'Restart Lap';
  backToStartButton.setAttribute('aria-label', 'Restart the current lap from the start line');
  backToStartButton.classList.add('back-to-start-button');

  recalibrateButton.textContent = 'Recalibrate';
  recalibrateButton.setAttribute('aria-label', 'Recalibrate steering and tilt controls');
  recalibrateButton.classList.add('recalibrate-button');

  const buttonOrder = [
    backToLotButton,
    recalibrateButton,
    resetRivalsButton,
    spectateButton,
    backToStartButton
  ];
  for (const button of buttonOrder) utilityGroup.appendChild(button);

  let previousMenuState = null;
  let lapInvalid = false;
  let invalidPulseTimer = 0;

  function setRestartLapInvalid(nextInvalid, { pulse = false } = {}) {
    const invalid = nextInvalid === true;
    const becameInvalid = invalid && !lapInvalid;
    lapInvalid = invalid;
    backToStartButton.classList.toggle('is-lap-invalid', invalid);

    if (!invalid) {
      window.clearTimeout(invalidPulseTimer);
      invalidPulseTimer = 0;
      backToStartButton.classList.remove('is-lap-invalid-pulse');
      return;
    }

    if (!pulse || !becameInvalid) return;
    window.clearTimeout(invalidPulseTimer);
    backToStartButton.classList.remove('is-lap-invalid-pulse');
    void backToStartButton.offsetWidth;
    backToStartButton.classList.add('is-lap-invalid-pulse');
    invalidPulseTimer = window.setTimeout(() => {
      backToStartButton.classList.remove('is-lap-invalid-pulse');
      invalidPulseTimer = 0;
    }, 760);
  }

  function syncLapValidity({ pulseOnEntry = true } = {}) {
    const invalid = lapTimeChip?.classList.contains('is-invalid-lap') === true;
    setRestartLapInvalid(invalid, { pulse: pulseOnEntry });
  }

  const lapValidityObserver = lapTimeChip && typeof MutationObserver === 'function'
    ? new MutationObserver(() => syncLapValidity())
    : null;
  lapValidityObserver?.observe(lapTimeChip, { attributes: true, attributeFilter: ['class'] });

  function syncMenu() {
    const visibility = inGameMenuVisibilityFor(runtime.state.mode);
    if (visibility.menuState !== previousMenuState) {
      utilityGroup.dataset.menuState = visibility.menuState;
      utilityGroup.setAttribute(
        'aria-label',
        visibility.menuState === IN_GAME_MENU_STATE.STAGED ? 'Start actions' : 'Race actions'
      );
      backToStartButton.hidden = !visibility.backToStart;
      backToLotButton.hidden = !visibility.startActions;
      recalibrateButton.hidden = !visibility.startActions;
      resetRivalsButton.hidden = !visibility.startActions;
      previousMenuState = visibility.menuState;
    }
  }

  window.addEventListener('turn:ui-state-change', (event) => {
    syncMenu();
    if (!event.detail?.running || event.detail?.reason === 'race-reset') {
      setRestartLapInvalid(false);
    } else {
      syncLapValidity();
    }
  });

  syncMenu();
  syncLapValidity({ pulseOnEntry: false });
}

waitForRuntime();
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

function createSoundGuide() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'utility sound-guide-button';
  button.textContent = 'Sound Guide';
  button.setAttribute('aria-label', 'Open the driving sound guide');

  const dialog = document.createElement('dialog');
  dialog.className = 'sound-guide-dialog';
  dialog.setAttribute('aria-labelledby', 'soundGuideTitle');
  dialog.setAttribute('aria-describedby', 'soundGuideIntro');
  dialog.innerHTML = `
    <article class="sound-guide-card">
      <header class="sound-guide-head">
        <h2 id="soundGuideTitle">DRIVE BY SOUND</h2>
        <button class="sound-guide-close" type="button" aria-label="Close sound guide">×</button>
      </header>

      <section aria-labelledby="soundGuideHow">
        <h3 id="soundGuideHow">HOW TO DRIVE</h3>
        <p id="soundGuideIntro">Use headphones. Pace notes tell you what comes next. The Trajectory Slider combines where the car is with where its current motion will take it. Steer away from the slider sound until it settles near the centre. If you leave the track, the same Slider intensifies. Keep steering away from it.</p>
      </section>

      <section aria-labelledby="soundGuideLegend">
        <h3 id="soundGuideLegend">SOUND GUIDE</h3>
        <div class="sound-guide-list">
          <section>
            <h4>PACE NOTES</h4>
            <p>Before major corners, one to three dry beeps play in the ear on the turn side. More beeps mean a tighter turn. A delayed echo marks a long corner when one is authored. Two groups describe linked corners in order.</p>
          </section>
          <section>
            <h4>TRAJECTORY SLIDER</h4>
            <p>A continuous textured sound stays near the centre when your position and projected path are safe. It moves toward the edge the car is likely to reach and grows stronger with risk. Steer away from it to bring it back toward the centre.</p>
          </section>
          <section>
            <h4>DRIFT</h4>
            <p>Tyre sound stays centred. Stronger drift spreads wider across both ears, describing grip loss without becoming a competing steering instruction.</p>
          </section>
          <section>
            <h4>OFF ROAD</h4>
            <p>The same Slider becomes stronger and stays on the outside side. Keep steering away from the sound until the car is back on the road.</p>
          </section>
          <section>
            <h4>SOUND LAYERS</h4>
            <p>Wrong Way replaces normal navigation. Pace notes briefly clear room for route information. Engine, drift and boost automatically make space whenever guidance needs to be heard.</p>
          </section>
          <section>
            <h4>RIVAL NEAR</h4>
            <p>A short directional sound warns that another car is close and tells you which side it is on.</p>
          </section>
          <section>
            <h4>WRONG WAY</h4>
            <p>A double falling tone means the car is facing the wrong way. A final side tone points toward the correction.</p>
          </section>
        </div>
      </section>
    </article>`;
  document.body.appendChild(dialog);

  const closeButton = dialog.querySelector('.sound-guide-close');

  function openGuide() {
    void globalThis.__turnAudio?.unlock?.();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeButton?.focus();
  }

  function closeGuide() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    button.focus();
  }

  button.addEventListener('click', openGuide);
  closeButton?.addEventListener('click', closeGuide);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeGuide();
  });
  dialog.addEventListener('close', () => button.focus());

  return { button, dialog };
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
  const soundGuideButton = globalThis.__turnDriveByEarEnabled === false
    ? null
    : createSoundGuide().button;

  backToStartButton.textContent = 'Restart Lap';
  backToStartButton.setAttribute('aria-label', 'Restart the current lap from the start line');
  backToStartButton.classList.add('back-to-start-button');

  recalibrateButton.textContent = 'Recalibrate';
  recalibrateButton.setAttribute('aria-label', 'Recalibrate steering and tilt controls');
  recalibrateButton.classList.add('recalibrate-button');

  const buttonOrder = [
    backToLotButton,
    recalibrateButton,
    soundGuideButton,
    resetRivalsButton,
    spectateButton,
    backToStartButton
  ].filter(Boolean);
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
      if (soundGuideButton) soundGuideButton.hidden = !visibility.startActions;
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

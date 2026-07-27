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
        <p id="soundGuideIntro">Use headphones. Pace notes announce major corners before you reach them. Listen to the live guidance for your line, and let the tyre sound reveal your drift. If you leave the track, follow the low beacon back to the road.</p>
      </section>

      <section aria-labelledby="soundGuideLegend">
        <h3 id="soundGuideLegend">SOUND GUIDE</h3>
        <div class="sound-guide-list">
          <section>
            <h4>PACE NOTES</h4>
            <p>Before major corners, one to three dry beeps play in the ear on the turn side. More beeps mean a tighter turn. The final beep holds longer for a longer corner. Two groups describe linked corners in order.</p>
          </section>
          <section>
            <h4>TURN RIBBON · AIRPORT</h4>
            <p>A quiet road texture stays on the turn side from turn-in to corner exit, revealing the curve's timing and length.</p>
          </section>
          <section>
            <h4>TRAJECTORY · AIRPORT</h4>
            <p>The same road texture grows and moves toward the side your current path is likely to reach. Steer away from it. Trajectory danger takes priority over the turn ribbon, so the two never become separate competing sounds.</p>
          </section>
          <section>
            <h4>TURN PULSE · OTHER TRACKS</h4>
            <p>A clear high pulse plays in the ear on the side the road curves. It repeats faster as the turn gets closer or tighter.</p>
          </section>
          <section>
            <h4>ROAD EDGE · OTHER TRACKS</h4>
            <p>A rough sound grows in the ear nearest the edge of the road.</p>
          </section>
          <section>
            <h4>RECOVERY BEACON</h4>
            <p>Two low pulses point toward the road when you are off-road.</p>
          </section>
          <section>
            <h4>DRIFT</h4>
            <p>Tyre sound moves toward the direction the car is sliding.</p>
          </section>
          <section>
            <h4>CORNER FLOW · OTHER TRACKS</h4>
            <p>When the car settles into a clean turn, tyre grit softens and the engine note tightens slightly. A steadier sound means the car is flowing with the curve.</p>
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

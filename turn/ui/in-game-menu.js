import { IN_GAME_MENU_STATE, inGameMenuVisibilityFor } from './in-game-menu-state.js';
import { saveDriveByEarEnabled } from './drive-by-ear-setting.js';

function waitForRuntime() {
  if (globalThis.__turnRuntime) {
    install(globalThis.__turnRuntime);
    return;
  }

  window.addEventListener('turn:runtime-ready', (event) => {
    install(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

function createAudioPanel() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'utility audio-settings-button';
  button.textContent = 'Audio';
  button.setAttribute('aria-label', 'Open audio settings');

  const dialog = document.createElement('dialog');
  dialog.className = 'audio-settings-dialog';
  dialog.setAttribute('aria-labelledby', 'audioSettingsTitle');
  dialog.innerHTML = `
    <article class="audio-settings-card">
      <header class="audio-settings-head">
        <h2 id="audioSettingsTitle">AUDIO</h2>
        <button class="audio-settings-close" type="button" aria-label="Close audio settings">×</button>
      </header>

      <div class="audio-settings-list">
        <label class="audio-setting-row" for="turnAudioEnabled">
          <input id="turnAudioEnabled" type="checkbox">
          <span>
            <strong>Sound</strong>
            <small>Turn every TURN sound on or off.</small>
          </span>
        </label>

        <label class="audio-setting-row" for="turnDbeEnabled">
          <input id="turnDbeEnabled" type="checkbox">
          <span>
            <strong>Drive By Ear™</strong>
            <small>Spatial pace notes, predictive steering guidance, recovery cues and rival warnings.</small>
          </span>
        </label>

        <section class="audio-balance-card" aria-labelledby="audioBalanceTitle">
          <h3 id="audioBalanceTitle">Sound balance</h3>
          <p>Keep the middle position for TURN's intended mix, or favour either the driving guidance or the car and world sounds.</p>
          <input id="turnAudioBalance" type="range" min="0" max="100" step="1" value="50" aria-describedby="audioBalanceValue">
          <div class="audio-balance-labels" aria-hidden="true">
            <span>Other sounds</span>
            <span>Drive By Ear</span>
          </div>
          <output id="audioBalanceValue" for="turnAudioBalance">Balanced</output>
        </section>

        <details class="audio-guide-card">
          <summary>Drive By Ear sound guide</summary>
          <div class="audio-guide-content">
            <p class="audio-guide-intro">Drive By Ear™ turns the racing line, upcoming corners and nearby hazards into spatial sound. Pace notes tell you what comes next, while continuous guidance helps with the turn you are making now. It is designed to make the track understandable without relying on sight, while also helping any player drive more consistently. Headphones give the clearest left and right guidance.</p>

            <section class="audio-guide-section" aria-labelledby="dbeGuideBasics">
              <h3 id="dbeGuideBasics">Start here</h3>
              <ul class="audio-guide-basics">
                <li>Use headphones and begin at a comfortable speed.</li>
                <li>Steer <strong>toward</strong> the warm guiding hum.</li>
                <li>Listen to pace notes before corners: the ear tells you the direction, and more beeps mean a tighter turn.</li>
                <li>Engine, tyre and gravel sounds describe the car and surface. They are not steering instructions.</li>
              </ul>
            </section>

            <section class="audio-guide-section" aria-labelledby="dbeGuideRibbon">
              <h3 id="dbeGuideRibbon">The guiding ribbon</h3>
              <p>A warm organic hum guides your steering. On the road, it combines where the car is with where its current movement is likely to take it. The hum moves toward the side you should steer toward. As your trajectory becomes safer, it settles closer to the centre and softens. At higher speed it predicts farther ahead, so make smooth corrections rather than chasing every small movement.</p>
            </section>

            <section class="audio-guide-section" aria-labelledby="dbeGuidePaceNotes">
              <h3 id="dbeGuidePaceNotes">Pace notes</h3>
              <p>Before major corners, one to three short beeps play in the ear on the turn side. One beep means a gentler corner; three means tighter. A delayed extra beep on the same side marks a long corner. Separate groups describe linked corners in the order you will meet them.</p>
            </section>

            <section class="audio-guide-section" aria-labelledby="dbeGuideRecovery">
              <h3 id="dbeGuideRecovery">Off-road recovery</h3>
              <p>Off road, centred gravel marks the surface. The ribbon changes to recovery guidance and points toward a useful place to rejoin, rather than simply the nearest edge. Steer toward the hum until normal on-road guidance returns.</p>
            </section>

            <section class="audio-guide-section" aria-labelledby="dbeGuideDrift">
              <h3 id="dbeGuideDrift">Drift and grip</h3>
              <p>Tyre noise stays centred. As the car loses more grip, the sound spreads wider across both ears. This tells you how much the car is sliding without becoming a second steering command.</p>
            </section>

            <section class="audio-guide-section" aria-labelledby="dbeGuideRivals">
              <h3 id="dbeGuideRivals">Nearby rivals</h3>
              <p>A short cue sounds when a rival comes close. These nearby-rival warnings are directional and play from the side of the nearby car. Treat the cue as a heads-up rather than a continuous tracker.</p>
            </section>

            <section class="audio-guide-section" aria-labelledby="dbeGuideWrongWay">
              <h3 id="dbeGuideWrongWay">Wrong way</h3>
              <p>If you are on the road but facing the wrong direction, normal navigation makes room for a low warning. A repeating double falling tone confirms the problem; the warning and final side tone indicate which way to turn. Continue turning until the regular ribbon returns.</p>
            </section>

            <section class="audio-guide-section" aria-labelledby="dbeGuideMix">
              <h3 id="dbeGuideMix">Sound balance and priority</h3>
              <p>TURN automatically lowers engine, drift and boost when guidance needs room. Pace notes are deliberately prominent. Use Sound balance above to favour Drive By Ear or the car and world sounds; the middle position is TURN's intended mix.</p>
            </section>
          </div>
        </details>
      </div>

      <p class="audio-settings-status" role="status" aria-live="polite"></p>
    </article>`;
  document.body.appendChild(dialog);

  const closeButton = dialog.querySelector('.audio-settings-close');
  const soundToggle = dialog.querySelector('#turnAudioEnabled');
  const dbeToggle = dialog.querySelector('#turnDbeEnabled');
  const balanceSlider = dialog.querySelector('#turnAudioBalance');
  const balanceOutput = dialog.querySelector('#audioBalanceValue');
  const status = dialog.querySelector('.audio-settings-status');

  function preferenceApi() {
    return globalThis.__turnAudioPreferences;
  }

  function balanceLabel(value) {
    if (value < 45) return `${100 - value}% other sounds`;
    if (value > 55) return `${value}% Drive By Ear`;
    return 'Balanced';
  }

  function syncControls() {
    const settings = preferenceApi()?.getSettings?.() || {
      audioEnabled: true,
      dbeEnabled: globalThis.__turnDriveByEarEnabled !== false,
      balance: 0.5
    };
    soundToggle.checked = settings.audioEnabled !== false;
    dbeToggle.checked = settings.dbeEnabled !== false;
    const storedBalance = Number(settings.balance);
    const balancePercent = Math.round((Number.isFinite(storedBalance) ? storedBalance : 0.5) * 100);
    balanceSlider.value = String(balancePercent);
    balanceOutput.value = balanceLabel(balancePercent);
    balanceOutput.textContent = balanceOutput.value;
  }

  function openPanel() {
    syncControls();
    status.textContent = '';
    void globalThis.__turnAudio?.unlock?.();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeButton?.focus();
  }

  function closePanel() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    button.focus();
  }

  button.addEventListener('click', openPanel);
  closeButton?.addEventListener('click', closePanel);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closePanel();
  });
  dialog.addEventListener('close', () => button.focus());

  soundToggle.addEventListener('change', () => {
    const enabled = preferenceApi()?.setAudioEnabled?.(soundToggle.checked) ?? soundToggle.checked;
    soundToggle.checked = enabled;
    status.textContent = `Sound ${enabled ? 'on' : 'off'}.`;
  });

  dbeToggle.addEventListener('change', () => {
    const enabled = dbeToggle.checked;
    if (!saveDriveByEarEnabled(enabled)) {
      dbeToggle.checked = !enabled;
      status.textContent = 'Drive By Ear could not be changed because this browser blocked local storage.';
      return;
    }

    const preferences = preferenceApi();
    preferences?.setDriveByEarEnabled?.(enabled);

    if (enabled && preferences?.driveByEarGraphAvailable === false) {
      dbeToggle.disabled = true;
      status.textContent = 'Drive By Ear enabled. Reloading TURN to build its audio system.';
      requestAnimationFrame(() => globalThis.location?.reload());
      return;
    }

    status.textContent = enabled
      ? 'Drive By Ear on.'
      : 'Drive By Ear off. Its processing will also stay unloaded next time TURN starts.';
  });

  balanceSlider.addEventListener('input', () => {
    const value = Number(balanceSlider.value);
    preferenceApi()?.setBalance?.(value / 100);
    balanceOutput.value = balanceLabel(value);
    balanceOutput.textContent = balanceOutput.value;
  });
  balanceSlider.addEventListener('change', () => {
    status.textContent = `Sound balance: ${balanceLabel(Number(balanceSlider.value))}.`;
  });

  syncControls();
  return { button, dialog };
}

function simplifyResetRivalsFeedback() {
  document.querySelector('.nuke-dialog-icon')?.remove();
  document.querySelector('.nuke-effect')?.remove();

  const dialog = document.querySelector('.nuke-dialog');
  const confirmButton = dialog?.querySelector('.nuke-confirm');
  if (!dialog || !confirmButton || confirmButton.dataset.simpleResetInstalled === 'true') return;
  confirmButton.dataset.simpleResetInstalled = 'true';

  confirmButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    globalThis.__turnResetRivals?.();
  }, { capture: true });
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
  const boostHud = document.querySelector('.boost-hud');

  if (!utilityGroup || !backToStartButton || !recalibrateButton || !backToLotButton || !resetRivalsButton || !spectateButton) {
    requestAnimationFrame(() => install(runtime));
    return;
  }

  runtime.__inGameMenuInstalled = true;
  simplifyResetRivalsFeedback();
  const audioButton = createAudioPanel().button;

  backToStartButton.textContent = 'Restart Lap';
  backToStartButton.setAttribute('aria-label', 'Restart the current lap from the start line');
  backToStartButton.classList.add('back-to-start-button');

  backToLotButton.textContent = 'Leave Race';
  backToLotButton.setAttribute('aria-label', 'Leave the race and choose another track');

  recalibrateButton.textContent = 'Recalibrate';
  recalibrateButton.setAttribute('aria-label', 'Recalibrate steering and tilt controls');
  recalibrateButton.classList.add('recalibrate-button');

  const buttonOrder = [
    backToLotButton,
    recalibrateButton,
    audioButton,
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

  function syncBoostLabel(racing = runtime.state?.lapActive === true) {
    boostHud?.classList.toggle('is-racing', racing);
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
      audioButton.hidden = !visibility.startActions;
      resetRivalsButton.hidden = !visibility.startActions;
      previousMenuState = visibility.menuState;
    }
  }

  window.addEventListener('turn:ui-state-change', (event) => {
    syncMenu();
    const raceReset = event.detail?.reason === 'race-reset';
    syncBoostLabel(event.detail?.running === true && !raceReset);
    if (!event.detail?.running || raceReset) {
      setRestartLapInvalid(false);
    } else {
      syncLapValidity();
    }
  });

  syncMenu();
  syncLapValidity({ pulseOnEntry: false });
  syncBoostLabel();
}

waitForRuntime();

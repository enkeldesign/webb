const BLANKING_ACTIVATION_TIMEOUT_MS = 1800;

export function installYourTurnNonVisualIntro({
  screenBlanking,
  animation,
  audioPreferences
} = {}) {
  const blankButton = screenBlanking?.button;
  if (!blankButton || !animation || !audioPreferences) return null;

  const dialog = createDialog();
  const balanceSlider = dialog.querySelector('#yourTurnDbeBalance');
  const balanceOutput = dialog.querySelector('#yourTurnDbeBalanceValue');
  const blankAction = dialog.querySelector('[data-yourturn-blank-screen]');
  const backAction = dialog.querySelector('[data-yourturn-nonvisual-back]');
  let bypassBlankButtonIntro = false;
  let resumeAfterDialog = false;

  function balanceLabel(value) {
    if (value < 45) return `${100 - value}% other sounds`;
    if (value > 55) return `${value}% Drive By Ear`;
    return 'Balanced';
  }

  function syncBalance() {
    const settings = audioPreferences.getSettings?.() || { balance: 0.5 };
    const stored = Number(settings.balance);
    const percent = Math.round((Number.isFinite(stored) ? stored : 0.5) * 100);
    balanceSlider.value = String(percent);
    balanceOutput.value = balanceLabel(percent);
    balanceOutput.textContent = balanceOutput.value;
  }

  function openDialog() {
    syncBalance();
    resumeAfterDialog = !animation.isPaused();
    animation.pause();
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    blankAction.focus();
  }

  function closeDialog({ resume = true } = {}) {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (resume && resumeAfterDialog) animation.resume();
    resumeAfterDialog = false;
    if (!blankButton.hidden) blankButton.focus({ preventScroll: true });
  }

  async function activateBlankScreen() {
    const shouldResume = resumeAfterDialog;
    closeDialog({ resume: false });

    // Reuse TURN's tested screen-blanking state machine. The recipient-facing
    // information dialog replaces its two-tap confirmation, so advance IDLE → ARMED
    // → ACTIVE internally without showing the intermediate toast to the player.
    bypassBlankButtonIntro = true;
    try {
      blankButton.click();
      blankButton.click();
    } finally {
      bypassBlankButtonIntro = false;
    }

    await waitForBlankingAttempt(blankButton);
    if (shouldResume) animation.resume();
    resumeAfterDialog = false;
  }

  blankButton.addEventListener('click', (event) => {
    if (bypassBlankButtonIntro || blankButton.dataset.state === 'active') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDialog();
  }, { capture: true });

  balanceSlider.addEventListener('input', () => {
    const value = Number(balanceSlider.value);
    audioPreferences.setBalance?.(value / 100);
    balanceOutput.value = balanceLabel(value);
    balanceOutput.textContent = balanceOutput.value;
  });

  blankAction.addEventListener('click', () => void activateBlankScreen());
  backAction.addEventListener('click', () => closeDialog());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });

  document.body.appendChild(dialog);
  return Object.freeze({ dialog, blankButton });
}

function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'yourturn-dialog yourturn-nonvisual-dialog';
  dialog.setAttribute('aria-labelledby', 'yourTurnNonVisualTitle');
  dialog.innerHTML = `
    <article class="yourturn-card yourturn-nonvisual-card" data-view="nonvisual">
      <header class="yourturn-card-head">
        <img src="/turn/TURNicon.PNG?icon=20260803-profile-512" alt="" aria-hidden="true">
        <div>
          <span class="yourturn-kicker">BLANK SCREEN MODE</span>
          <h1 id="yourTurnNonVisualTitle">DRIVE BY EAR</h1>
        </div>
      </header>

      <div class="yourturn-nonvisual-copy">
        <p>Blank screen mode hides the visuals while the race and controls keep running. Drive By Ear turns the racing line, upcoming corners, grip, recovery and nearby cars into spatial sound.</p>
        <p>TURN supports complete non-visual gameplay and works with screen readers. Headphones give the clearest left and right guidance. The full TURN game also includes Drive By Ear 101 training if you want to learn the sound system step by step.</p>
      </div>

      <section class="yourturn-dbe-balance" aria-labelledby="yourTurnDbeBalanceTitle">
        <h2 id="yourTurnDbeBalanceTitle">SOUND BALANCE</h2>
        <p>Keep the middle for TURN's intended mix, or favour the car and world sounds or Drive By Ear guidance.</p>
        <input id="yourTurnDbeBalance" type="range" min="0" max="100" step="1" value="50" aria-describedby="yourTurnDbeBalanceValue">
        <div class="yourturn-dbe-balance-labels" aria-hidden="true">
          <span>Other sounds</span>
          <span>Drive By Ear</span>
        </div>
        <output id="yourTurnDbeBalanceValue" for="yourTurnDbeBalance">Balanced</output>
      </section>

      <div class="yourturn-actions">
        <button type="button" class="is-primary" data-yourturn-blank-screen>BLANK SCREEN</button>
        <button type="button" class="is-navigation" data-yourturn-nonvisual-back>BACK</button>
      </div>
    </article>`;
  return dialog;
}

function waitForBlankingAttempt(button) {
  if (button.dataset.state === 'active' || button.dataset.state === 'idle') {
    return Promise.resolve(button.dataset.state);
  }

  return new Promise((resolve) => {
    let timer = 0;
    const observer = new MutationObserver(() => {
      if (button.dataset.state !== 'active' && button.dataset.state !== 'idle') return;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(button.dataset.state);
    });
    observer.observe(button, { attributes: true, attributeFilter: ['data-state'] });
    timer = window.setTimeout(() => {
      observer.disconnect();
      resolve(button.dataset.state || 'unknown');
    }, BLANKING_ACTIVATION_TIMEOUT_MS);
  });
}

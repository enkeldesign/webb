import { normalizeChallengeName } from '/turn-next/challenge-codec.js?revision=r182-race-my-ghost';

const PLAYER_NAME_KEY = 'turn-challenge-player-name-v1';

export function createChallengeUi() {
  let modal = null;
  let bar = null;
  let statusTimer = 0;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('dialog');
    modal.className = 'turn-challenge-dialog';
    modal.setAttribute('aria-labelledby', 'turnChallengeTitle');
    modal.innerHTML = `
      <article class="turn-challenge-card">
        <header>
          <span class="turn-challenge-kicker">RACE MY GHOST</span>
          <h1 id="turnChallengeTitle"></h1>
        </header>
        <div class="turn-challenge-details"></div>
        <p class="turn-challenge-copy"></p>
        <label class="turn-challenge-name-field" hidden>
          <span>Your name in the reply</span>
          <input type="text" maxlength="24" autocomplete="nickname">
        </label>
        <p class="turn-challenge-dialog-status" role="status" aria-live="polite"></p>
        <div class="turn-challenge-actions"></div>
      </article>`;
    document.body.appendChild(modal);
    return modal;
  }

  function showModal({ title, details, copy, actions, requestName = false }) {
    const dialog = ensureModal();
    dialog.querySelector('h1').textContent = title;
    dialog.querySelector('.turn-challenge-details').innerHTML = details;
    dialog.querySelector('.turn-challenge-copy').innerHTML = copy;
    const nameField = dialog.querySelector('.turn-challenge-name-field');
    nameField.hidden = !requestName;
    if (requestName) nameField.querySelector('input').value = loadPlayerName();
    dialog.querySelector('.turn-challenge-dialog-status').textContent = '';

    const actionBox = dialog.querySelector('.turn-challenge-actions');
    actionBox.replaceChildren();
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      if (action.primary) button.classList.add('is-primary');
      button.addEventListener('click', action.action);
      actionBox.appendChild(button);
    }

    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    actionBox.querySelector('.is-primary, button')?.focus();
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === 'function' && modal.open) modal.close();
    else modal.removeAttribute('open');
  }

  function ensureBar({ opponent, target, onRestart, onGiveUp }) {
    if (!bar) {
      bar = document.createElement('section');
      bar.className = 'turn-challenge-bar';
      bar.hidden = true;
      bar.setAttribute('aria-label', 'Ghost challenge');
      bar.innerHTML = `
        <div>
          <span>BEAT <b class="turn-challenge-opponent"></b></span>
          <strong class="turn-challenge-target"></strong>
          <small class="turn-challenge-attempt-status" role="status" aria-live="polite"></small>
        </div>
        <button type="button" data-challenge-restart>RESTART LAP</button>
        <button type="button" data-challenge-give-up>GIVE UP</button>`;
      document.body.appendChild(bar);
      bar.querySelector('[data-challenge-restart]').addEventListener('click', onRestart);
      bar.querySelector('[data-challenge-give-up]').addEventListener('click', onGiveUp);
    }
    bar.querySelector('.turn-challenge-opponent').textContent = opponent;
    bar.querySelector('.turn-challenge-target').textContent = target;
    return bar;
  }

  function showBar() {
    if (bar) bar.hidden = false;
  }

  function hideBar() {
    if (bar) bar.hidden = true;
  }

  function setAttemptStatus(message, { persist = false } = {}) {
    if (!bar) return;
    const status = bar.querySelector('.turn-challenge-attempt-status');
    status.textContent = message;
    window.clearTimeout(statusTimer);
    if (!persist) {
      statusTimer = window.setTimeout(() => {
        if (status.textContent === message) status.textContent = '';
      }, 3000);
    }
  }

  function playerName() {
    const input = modal?.querySelector('.turn-challenge-name-field input');
    const name = normalizeChallengeName(input?.value);
    try { localStorage.setItem(PLAYER_NAME_KEY, name); } catch (_) {}
    if (input) input.value = name;
    return name;
  }

  function setDialogStatus(message) {
    const status = modal?.querySelector('.turn-challenge-dialog-status');
    if (status) status.textContent = message;
  }

  return Object.freeze({
    ensureModal,
    showModal,
    closeModal,
    ensureBar,
    showBar,
    hideBar,
    setAttemptStatus,
    playerName,
    setDialogStatus
  });
}

export function hideHomeAndRaceUi() {
  document.querySelector('#installGate')?.setAttribute('hidden', '');
  const home = document.querySelector('.m8-home');
  if (home) home.hidden = true;
  document.body.classList.remove('turn-home-open', 'turn-m8-active', 'turn-spectating');
  for (const selector of ['#hud', '#controls', '#manualSteer']) {
    document.querySelector(selector)?.setAttribute('hidden', '');
  }
}

export function showRaceUi(sensorMode) {
  document.querySelector('#hud')?.removeAttribute('hidden');
  document.querySelector('#controls')?.removeAttribute('hidden');
  if (!sensorMode) document.querySelector('#manualSteer')?.removeAttribute('hidden');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadPlayerName() {
  try { return normalizeChallengeName(localStorage.getItem(PLAYER_NAME_KEY)); } catch (_) {}
  return 'A TURN PLAYER';
}

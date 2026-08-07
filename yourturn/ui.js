import { normalizeChallengeName } from '/yourturn/protocol.js?revision=r2';

const PLAYER_NAME_KEY = 'yourturn-player-name-v1';

export function createYourTurnUi() {
  const dialog = document.querySelector('#yourTurnDialog');
  const card = dialog?.querySelector('.yourturn-card');
  const kicker = dialog?.querySelector('.yourturn-kicker');
  const title = dialog?.querySelector('#yourTurnTitle');
  const details = dialog?.querySelector('.yourturn-details');
  const copy = dialog?.querySelector('.yourturn-copy');
  const extra = dialog?.querySelector('.yourturn-extra');
  const actions = dialog?.querySelector('.yourturn-actions');
  const status = dialog?.querySelector('.yourturn-dialog-status');
  const nameField = dialog?.querySelector('.yourturn-name-field');
  const motionToggle = dialog?.querySelector('#yourTurnMotionToggle');
  const rotate = document.querySelector('#yourTurnRotate');
  const targetChip = document.querySelector('#yourTurnTargetChip');
  const targetOpponent = document.querySelector('#yourTurnTargetOpponent');
  const targetTime = document.querySelector('#yourTurnTargetTime');
  const challengeButton = document.querySelector('#yourTurnChallengeButton');

  if (!dialog || !card || !kicker || !title || !details || !copy || !extra || !actions || !status
      || !nameField || !motionToggle || !rotate || !targetChip || !targetOpponent || !targetTime || !challengeButton) {
    throw new Error('YOUR TURN could not find its complete interface.');
  }

  dialog.addEventListener('cancel', (event) => {
    if (document.body.classList.contains('yourturn-active')) event.preventDefault();
  });

  function showModal({
    kickerText = 'YOUR TURN',
    titleText,
    detailsHtml = '',
    copyHtml = '',
    extraHtml = '',
    actionList = [],
    requestName = false,
    className = '',
    motionControl = false
  }) {
    kicker.textContent = kickerText;
    title.textContent = titleText;
    details.innerHTML = detailsHtml;
    details.hidden = !detailsHtml;
    copy.innerHTML = copyHtml;
    copy.hidden = !copyHtml;
    extra.innerHTML = extraHtml;
    extra.hidden = !extraHtml;
    status.textContent = '';
    card.dataset.view = className;
    motionToggle.hidden = !motionControl;

    nameField.hidden = !requestName;
    if (requestName) nameField.querySelector('input').value = loadPlayerName();

    actions.replaceChildren();
    for (const action of actionList) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      if (action.kind) button.dataset.kind = action.kind;
      if (action.primary) button.classList.add('is-primary');
      if (action.destructive) button.classList.add('is-destructive');
      if (action.navigation) button.classList.add('is-navigation');
      button.addEventListener('click', action.action);
      actions.appendChild(button);
    }

    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    actions.querySelector('.is-primary, button')?.focus();
  }

  function closeModal() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function setStatus(message) {
    status.textContent = String(message || '');
  }

  function playerName() {
    const input = nameField.querySelector('input');
    const name = normalizeChallengeName(input?.value);
    try {
      localStorage.setItem(PLAYER_NAME_KEY, name);
    } catch (_) {}
    if (input) input.value = name;
    return name;
  }

  function setTarget({ opponent, time }) {
    targetOpponent.textContent = opponent;
    targetTime.textContent = time;
  }

  function showRaceChrome() {
    targetChip.hidden = false;
    challengeButton.hidden = false;
    document.body.classList.add('yourturn-racing');
  }

  function hideRaceChrome() {
    targetChip.hidden = true;
    challengeButton.hidden = true;
    document.body.classList.remove('yourturn-racing');
  }

  function showRotate() {
    rotate.hidden = false;
    document.body.classList.add('yourturn-awaiting-landscape');
    rotate.querySelector('strong')?.focus?.();
  }

  function hideRotate() {
    rotate.hidden = true;
    document.body.classList.remove('yourturn-awaiting-landscape');
  }

  function bindChallengeMenu(handler) {
    challengeButton.addEventListener('click', handler);
  }

  function bindMotionToggle(handler) {
    motionToggle.addEventListener('click', handler);
  }

  function setMotionPaused(paused) {
    motionToggle.textContent = paused ? '▶' : '⏸';
    motionToggle.setAttribute('aria-label', paused ? 'Play background motion' : 'Pause background motion');
    motionToggle.setAttribute('aria-pressed', String(Boolean(paused)));
    motionToggle.title = paused ? 'Play background motion' : 'Pause background motion';
  }

  return Object.freeze({
    showModal,
    closeModal,
    setStatus,
    playerName,
    setTarget,
    showRaceChrome,
    hideRaceChrome,
    showRotate,
    hideRotate,
    bindChallengeMenu,
    bindMotionToggle,
    setMotionPaused
  });
}

export function aboutTurnHtml() {
  return `
    <div class="yourturn-about-copy">
      <p><strong>TURN</strong> is a racing game built around one unusual control: rotate your phone like a steering wheel.</p>
      <p>Gas, Drift and Boost are on screen. Drive By Ear turns the racing line, upcoming corners, grip and nearby cars into spatial sound.</p>
      <p>TURN is designed for screen-reader and non-visual play as well as visual play. Headphones give the clearest left/right audio information.</p>
    </div>`;
}

export function newcomerAssistiveText(challengerName) {
  return `
    <span class="visually-hidden">
      New to TURN: ${escapeHtml(challengerName)} has sent you a racing challenge. TURN is normally steered by rotating your phone like a steering wheel. The race includes spatial audio guidance and supports screen readers. After you accept, your browser may ask for motion access, then you will be asked to rotate the phone to landscape.
    </span>`;
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
  try {
    return normalizeChallengeName(localStorage.getItem(PLAYER_NAME_KEY));
  } catch (_) {
    return 'A TURN PLAYER';
  }
}
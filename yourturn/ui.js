import { aboutTurnHtml as sharedAboutTurnHtml } from '/turn/content/about-turn.js?revision=r1';
import {
  adoptSocialRacerIdentity,
  loadSocialRacerProfile,
  saveSocialRacerName
} from '/turn/social/racer-profile.js?revision=r1';
import { formatChallengeTime, normalizeChallengeName } from '/yourturn/protocol.js?revision=r3';

const NAME_REQUIRED_MESSAGE = 'Write your name before sharing.';
const PAUSE_ICON = `
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
    <rect x="6" y="5" width="4" height="14" rx="1"></rect>
    <rect x="14" y="5" width="4" height="14" rx="1"></rect>
  </svg>`;
const PLAY_ICON = `
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
    <path d="M8 5.5v13l10-6.5z"></path>
  </svg>`;

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
  const nameInput = nameField?.querySelector('input');
  const motionToggle = dialog?.querySelector('#yourTurnMotionToggle');
  const rotate = document.querySelector('#yourTurnRotate');
  const targetChip = document.querySelector('#yourTurnTargetChip');
  const targetOpponent = document.querySelector('#yourTurnTargetOpponent');
  const targetTime = document.querySelector('#yourTurnTargetTime');
  const challengeButton = document.querySelector('#yourTurnChallengeButton');

  if (!dialog || !card || !kicker || !title || !details || !copy || !extra || !actions || !status
      || !nameField || !nameInput || !motionToggle || !rotate || !targetChip || !targetOpponent || !targetTime || !challengeButton) {
    throw new Error('YOUR TURN could not find its complete interface.');
  }

  dialog.addEventListener('cancel', (event) => {
    if (document.body.classList.contains('yourturn-active')) event.preventDefault();
  });

  nameInput.addEventListener('input', () => {
    if (!normalizeChallengeName(nameInput.value, '')) return;
    nameInput.removeAttribute('aria-invalid');
    if (status.textContent === NAME_REQUIRED_MESSAGE) status.textContent = '';
  });

  function showModal(config) {
    const {
      kickerText = 'YOUR TURN',
      titleText,
      detailsHtml = '',
      copyHtml = '',
      extraHtml = '',
      actionList = [],
      requestName = false,
      nameValue = null,
      focusName = false,
      className = '',
      motionControl = false
    } = config;

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
    nameInput.required = requestName;
    nameInput.removeAttribute('aria-invalid');
    if (requestName) {
      const rememberedName = loadSocialRacerProfile().name;
      nameInput.value = nameValue == null ? rememberedName : String(nameValue);
    }

    actions.replaceChildren();
    for (const action of actionList) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      if (action.kind) button.dataset.kind = action.kind;
      if (action.primary) button.classList.add('is-primary');
      if (action.destructive) button.classList.add('is-destructive');
      if (action.navigation) button.classList.add('is-navigation');
      if (action.share) button.classList.add('is-share');
      if (action.game) button.classList.add('is-game');
      if (action.back) button.classList.add('is-back');
      button.addEventListener('click', (event) => {
        if (requestName && action.share) {
          if (!validateRequestedName()) return;
          if (offerExistingRacerClaim({ action, event, returnConfig: config })) return;
        }
        action.action(event);
      });
      actions.appendChild(button);
    }

    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');

    if (requestName && (focusName || !nameInput.value)) {
      nameInput.focus();
    } else {
      actions.querySelector('.is-primary, .is-share, button')?.focus();
    }
  }

  function offerExistingRacerClaim({ action, event, returnConfig }) {
    const sessionState = globalThis.__yourTurnSession?.getState?.();
    const challenge = sessionState?.challenge;
    if (!sessionState || !challenge?.racers?.length) return false;

    const profile = loadSocialRacerProfile();
    if (profile.id) sessionState.racerId = profile.id;
    if (challenge.racers.some((racer) => racer.id === sessionState.racerId)) return false;

    const typedName = normalizeChallengeName(nameInput.value, '');
    const normalizedTyped = typedName.toLocaleUpperCase('en');
    const matches = challenge.racers.filter((racer) => (
      normalizeChallengeName(racer.name, '').toLocaleUpperCase('en') === normalizedTyped
    ));
    if (!matches.length) return false;

    if (matches.length > 1) {
      nameInput.setAttribute('aria-invalid', 'true');
      status.textContent = `${typedName} is already used by more than one car in this challenge. Use another name.`;
      nameInput.focus();
      return true;
    }

    const existing = matches[0];
    showModal({
      titleText: `${existing.name} IS ALREADY HERE`,
      detailsHtml: `<strong>${formatChallengeTime(existing.time)}</strong><span>Earlier ${escapeHtml(existing.name)} car</span>`,
      copyHtml: `Is that your earlier car? If it is, this share will update ${escapeHtml(existing.name)} instead of adding a duplicate player.`,
      className: 'identity-claim',
      actionList: [
        {
          label: 'YES, THAT’S ME',
          share: true,
          action: () => {
            sessionState.racerId = existing.id;
            adoptSocialRacerIdentity({ id: existing.id, name: typedName });
            nameInput.value = typedName;
            action.action(event);
          }
        },
        {
          label: 'NO, USE ANOTHER NAME',
          navigation: true,
          action: () => showModal({ ...returnConfig, nameValue: '', focusName: true })
        }
      ]
    });
    return true;
  }

  function validateRequestedName() {
    const name = normalizeChallengeName(nameInput.value, '');
    if (name) {
      nameInput.removeAttribute('aria-invalid');
      return true;
    }
    nameInput.setAttribute('aria-invalid', 'true');
    status.textContent = NAME_REQUIRED_MESSAGE;
    try {
      nameInput.focus({ preventScroll: false });
    } catch (_) {
      nameInput.focus();
    }
    return false;
  }

  function closeModal() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function setStatus(message) {
    status.textContent = String(message || '');
  }

  function playerName() {
    const name = normalizeChallengeName(nameInput.value, '');
    if (!name) return '';
    saveSocialRacerName(name);
    nameInput.value = name;
    return name;
  }

  function setPlayerNameValue(value, { focus = false } = {}) {
    nameInput.value = normalizeChallengeName(value, '');
    nameInput.removeAttribute('aria-invalid');
    if (focus) nameInput.focus();
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
    motionToggle.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
    motionToggle.setAttribute('aria-label', paused ? 'Play background motion' : 'Pause background motion');
    motionToggle.setAttribute('aria-pressed', String(Boolean(paused)));
    motionToggle.title = paused ? 'Play background motion' : 'Pause background motion';
  }

  return Object.freeze({
    showModal,
    closeModal,
    setStatus,
    playerName,
    setPlayerNameValue,
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
  return sharedAboutTurnHtml();
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

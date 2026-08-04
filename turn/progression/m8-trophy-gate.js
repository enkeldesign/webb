import {
  LOCK_ICON,
  isTrackUnlocked,
  rewardForTrack,
  showTrophyUnlockNotice
} from './trophy-road.js?revision=r155-trophy-road-polish';

const LOCKED_TRACK_ID = 'midnight-city';

export function installM8TrophyGate(homeApi = globalThis.__turnNextHome) {
  const home = document.querySelector('.m8-home');
  const card = home?.querySelector(`[data-track-id="${LOCKED_TRACK_ID}"]`);
  const continueButton = home?.querySelector('.m8-track-continue');
  const choiceMarker = card?.querySelector('.track-card-choice-marker');
  const reward = rewardForTrack(LOCKED_TRACK_ID);
  if (!home || !card || !continueButton || !reward) return null;

  const originalLabel = card.getAttribute('aria-label') || 'Midnight City, hard track';

  function locked() {
    return !isTrackUnlocked(LOCKED_TRACK_ID);
  }

  function selected() {
    return homeApi?.getSelectedTrackId?.() === LOCKED_TRACK_ID
      || card.getAttribute('aria-pressed') === 'true';
  }

  function explainLock() {
    showTrophyUnlockNotice({ reward, itemName: reward.shortTitle });
  }

  function syncChoiceLockIcon(isLocked) {
    if (!choiceMarker) return;
    let icon = choiceMarker.querySelector('.turn-track-lock-icon');
    if (isLocked && !icon) {
      icon = document.createElement('span');
      icon.className = 'turn-track-lock-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = LOCK_ICON;
      choiceMarker.appendChild(icon);
    }
    icon?.toggleAttribute('hidden', !isLocked);
  }

  function setRaceLocked(isLockedSelection) {
    continueButton.classList.toggle('is-trophy-locked', isLockedSelection);
    if (isLockedSelection) {
      continueButton.dataset.trophyLocked = 'true';
      continueButton.setAttribute('aria-disabled', 'true');
      continueButton.setAttribute(
        'aria-label',
        `Race on ${reward.shortTitle}, locked. Unlocks at ${reward.threshold} trophies.`
      );
      return;
    }

    delete continueButton.dataset.trophyLocked;
    continueButton.removeAttribute('aria-disabled');
    if (selected()) continueButton.setAttribute('aria-label', `Race on ${reward.shortTitle}`);
  }

  function sync() {
    const isLocked = locked();
    card.dataset.trophyLocked = String(isLocked);
    card.classList.toggle('is-trophy-locked', isLocked);
    card.setAttribute(
      'aria-label',
      isLocked
        ? `${reward.shortTitle}, locked. Unlocks at ${reward.threshold} trophies. Select for unlock information.`
        : originalLabel
    );
    if (choiceMarker) choiceMarker.dataset.trophyLock = String(isLocked);
    syncChoiceLockIcon(isLocked);
    setRaceLocked(isLocked && selected());
  }

  card.addEventListener('click', () => {
    if (locked()) explainLock();
    sync();
  });

  continueButton.addEventListener('click', (event) => {
    if (!selected() || !locked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    explainLock();
    card.focus();
  }, { capture: true });

  const selectionObserver = new MutationObserver(sync);
  selectionObserver.observe(card, {
    attributes: true,
    attributeFilter: ['aria-pressed']
  });

  const handleStorage = (event) => {
    if (event.key === 'turn-achievements-v1') sync();
  };
  window.addEventListener('turn:trophy-road-updated', sync);
  window.addEventListener('storage', handleStorage);
  sync();

  const api = Object.freeze({
    sync,
    card,
    reward,
    disconnect() {
      selectionObserver.disconnect();
      window.removeEventListener('turn:trophy-road-updated', sync);
      window.removeEventListener('storage', handleStorage);
    }
  });
  globalThis.__turnM8TrophyGate = api;
  return api;
}

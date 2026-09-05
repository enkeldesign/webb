import {
  LOCK_ICON,
  isTrackUnlocked,
  rewardForTrack,
  showTrophyUnlockNotice
} from './trophy-road.js?revision=r243-mountain-1300';

export function installM8TrophyGate(homeApi = globalThis.__turnNextHome) {
  const home = document.querySelector('.m8-home');
  const continueButton = home?.querySelector('.m8-track-continue');
  if (!home || !continueButton) return null;

  const entries = [...home.querySelectorAll('.track-card[data-track-id]')]
    .map((card) => {
      const trackId = card.dataset.trackId || '';
      const reward = rewardForTrack(trackId);
      if (!reward) return null;
      return {
        card,
        trackId,
        reward,
        choiceMarker: card.querySelector('.track-card-choice-marker'),
        originalLabel: card.getAttribute('aria-label') || `${reward.shortTitle} track`
      };
    })
    .filter(Boolean);
  if (!entries.length) return null;

  function entryForTrack(trackId) {
    return entries.find((entry) => entry.trackId === trackId) || null;
  }

  function selectedTrackId() {
    return homeApi?.getSelectedTrackId?.()
      || home.querySelector('.track-card[data-track-id][aria-pressed="true"]')?.dataset.trackId
      || '';
  }

  function locked(entry) {
    return Boolean(entry) && !isTrackUnlocked(entry.trackId);
  }

  function explainLock(entry) {
    if (!entry) return;
    showTrophyUnlockNotice({ reward: entry.reward, itemName: entry.reward.shortTitle });
  }

  function syncChoiceLockIcon(entry, isLocked) {
    const { choiceMarker } = entry;
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
    choiceMarker.dataset.trophyLock = String(isLocked);
  }

  function syncCard(entry) {
    const isLocked = locked(entry);
    entry.card.dataset.trophyLocked = String(isLocked);
    entry.card.classList.toggle('is-trophy-locked', isLocked);
    entry.card.setAttribute(
      'aria-label',
      isLocked
        ? `${entry.reward.shortTitle}, locked. Unlocks at ${entry.reward.threshold} trophies. Select for unlock information.`
        : entry.originalLabel
    );
    syncChoiceLockIcon(entry, isLocked);
  }

  function syncRaceButton() {
    const selectedEntry = entryForTrack(selectedTrackId());
    const isLockedSelection = locked(selectedEntry);
    continueButton.classList.toggle('is-trophy-locked', isLockedSelection);
    if (isLockedSelection) {
      continueButton.dataset.trophyLocked = 'true';
      continueButton.setAttribute('aria-disabled', 'true');
      continueButton.setAttribute(
        'aria-label',
        `Race on ${selectedEntry.reward.shortTitle}, locked. Unlocks at ${selectedEntry.reward.threshold} trophies.`
      );
      return;
    }
    delete continueButton.dataset.trophyLocked;
    continueButton.removeAttribute('aria-disabled');
  }

  function sync() {
    entries.forEach(syncCard);
    syncRaceButton();
  }

  for (const entry of entries) {
    entry.card.addEventListener('click', () => {
      if (locked(entry)) explainLock(entry);
      queueMicrotask(sync);
    });
  }

  continueButton.addEventListener('click', (event) => {
    const entry = entryForTrack(selectedTrackId());
    if (!locked(entry)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    explainLock(entry);
    entry.card.focus();
  }, { capture: true });

  const selectionObserver = new MutationObserver(syncRaceButton);
  for (const entry of entries) {
    selectionObserver.observe(entry.card, {
      attributes: true,
      attributeFilter: ['aria-pressed']
    });
  }

  const handleStorage = (event) => {
    if (event.key === 'turn-achievements-v1') sync();
  };
  window.addEventListener('turn:trophy-road-updated', sync);
  window.addEventListener('storage', handleStorage);
  sync();

  const api = Object.freeze({
    sync,
    cards: Object.freeze(entries.map((entry) => entry.card)),
    rewards: Object.freeze(entries.map((entry) => entry.reward)),
    disconnect() {
      selectionObserver.disconnect();
      window.removeEventListener('turn:trophy-road-updated', sync);
      window.removeEventListener('storage', handleStorage);
    }
  });
  globalThis.__turnM8TrophyGate = api;
  return api;
}

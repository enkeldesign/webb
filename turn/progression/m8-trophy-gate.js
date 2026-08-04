import {
  TROPHY_ICON,
  isTrackUnlocked,
  rewardForTrack
} from './trophy-road.js?revision=r153-trophy-road';

const LOCKED_TRACK_ID = 'midnight-city';

export function installM8TrophyGate(homeApi = globalThis.__turnNextHome) {
  const home = document.querySelector('.m8-home');
  const card = home?.querySelector(`[data-track-id="${LOCKED_TRACK_ID}"]`);
  const fallbackCard = home?.querySelector('[data-track-id="countryside"]');
  const continueButton = home?.querySelector('.m8-track-continue');
  const status = home?.querySelector('.m8-home-status');
  const reward = rewardForTrack(LOCKED_TRACK_ID);
  if (!home || !card || !continueButton || !reward) return null;

  const originalLabel = card.getAttribute('aria-label') || 'Midnight City, hard track';
  const lock = document.createElement('span');
  lock.className = 'track-card-trophy-lock';
  lock.innerHTML = `<span aria-hidden="true">${TROPHY_ICON}</span><strong>${reward.threshold} TROPHIES</strong>`;
  card.appendChild(lock);

  function locked() {
    return !isTrackUnlocked(LOCKED_TRACK_ID);
  }

  function explainLock() {
    if (status) {
      status.textContent = `${reward.shortTitle} unlocks at ${reward.threshold} trophies on Trophy Road.`;
    }
  }

  function sync() {
    const isLocked = locked();
    card.dataset.trophyLocked = String(isLocked);
    card.classList.toggle('is-trophy-locked', isLocked);
    card.setAttribute('aria-disabled', String(isLocked));
    card.setAttribute(
      'aria-label',
      isLocked
        ? `${reward.shortTitle}, locked. Unlocks at ${reward.threshold} trophies.`
        : originalLabel
    );
    lock.hidden = !isLocked;

    if (isLocked && card.getAttribute('aria-pressed') === 'true') {
      fallbackCard?.click();
    }
  }

  card.addEventListener('click', (event) => {
    if (!locked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    explainLock();
    card.focus();
  }, { capture: true });

  continueButton.addEventListener('click', (event) => {
    if (homeApi?.getSelectedTrackId?.() !== LOCKED_TRACK_ID || !locked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    explainLock();
    card.focus();
  }, { capture: true });

  window.addEventListener('turn:trophy-road-updated', sync);
  window.addEventListener('storage', (event) => {
    if (event.key === 'turn-achievements-v1') sync();
  });
  sync();

  const api = Object.freeze({ sync, card, reward });
  globalThis.__turnM8TrophyGate = api;
  return api;
}

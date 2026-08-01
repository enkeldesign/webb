import { TRACK_CATALOG } from '../tracks/catalog.js';
import { clearAllRivalsState } from '../race/rival-storage.js';

const RESET_VERSION = 'all-tracks-r126';

export function installHomeRivalReset(root = document) {
  const dialog = root.querySelector('.m8-settings-dialog');
  const card = dialog?.querySelector('.m8-record-setting');
  const resetButton = card?.querySelector('.m8-reset-rivals');
  const resetConfirm = card?.querySelector('.m8-reset-confirm');
  const resetTarget = card?.querySelector('.m8-reset-track');
  const resetCancel = card?.querySelector('.m8-reset-cancel');
  const resetConfirmButton = card?.querySelector('.m8-reset-confirm-button');
  const status = dialog?.querySelector('.m8-settings-status');

  if (
    !dialog
    || !card
    || !resetButton
    || !resetConfirm
    || !resetTarget
    || !resetCancel
    || !resetConfirmButton
    || !status
  ) return false;
  if (dialog.dataset.rivalResetVersion === RESET_VERSION) return true;

  const description = card.querySelector('p');
  if (description) {
    description.textContent = 'Remove every recorded personal rival from every track. To reset only one track, use Settings at that track’s start line.';
  }
  resetButton.textContent = 'RESET ALL RIVALS';
  resetButton.setAttribute('aria-label', 'Reset personal rivals on all tracks');

  resetButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    resetTarget.textContent = 'ALL TRACKS';
    resetConfirm.hidden = false;
    resetConfirmButton.focus();
  }, { capture: true });

  resetConfirmButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    resetConfirmButton.disabled = true;

    try {
      clearAllRivalsState(
        globalThis.__turnRuntime?.state || {},
        TRACK_CATALOG.map((track) => track.id)
      );
      clearTrackCardRecords(root);
      resetConfirm.hidden = true;
      status.textContent = 'Personal rivals reset on all tracks.';
      resetButton.focus();
    } finally {
      resetConfirmButton.disabled = false;
    }
  }, { capture: true });

  resetCancel.addEventListener('click', () => {
    resetTarget.textContent = 'ALL TRACKS';
  });

  dialog.dataset.rivalResetVersion = RESET_VERSION;
  document.documentElement.dataset.turnHomeRivalReset = RESET_VERSION;
  return true;
}

function clearTrackCardRecords(root) {
  for (const bestBox of root.querySelectorAll('[data-track-best]')) {
    const time = bestBox.querySelector('.track-card-best-time');
    const car = bestBox.querySelector('.track-card-best-car');
    const model = bestBox.querySelector('.track-card-best-model');

    if (time) time.textContent = 'NO TIME YET';
    if (car) {
      car.textContent = '';
      car.hidden = true;
    }
    if (model) {
      model.hidden = true;
      model.removeAttribute('src');
      delete model.dataset.previewKey;
    }
  }
}

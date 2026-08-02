import { TRACK_CATALOG, normalizeTrackId } from '../tracks/catalog.js';
import { clearAllRivalsState } from '../race/rival-storage.js';

const RESET_VERSION = 'contextual-r127';

export function installHomeRivalReset(root = document) {
  const dialog = root.querySelector('.m8-settings-dialog');
  const card = dialog?.querySelector('.m8-record-setting');
  const resetButton = card?.querySelector('.m8-reset-rivals');
  const resetConfirm = card?.querySelector('.m8-reset-confirm');
  const resetTarget = card?.querySelector('.m8-reset-track');
  const resetCancel = card?.querySelector('.m8-reset-cancel');
  const resetConfirmButton = card?.querySelector('.m8-reset-confirm-button');
  const status = dialog?.querySelector('.m8-settings-status');
  const raceResetButton = root.querySelector('.reset-rivals-button');
  const raceResetDialog = root.querySelector('.nuke-dialog');

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

  function selectedTrack() {
    const trackId = normalizeTrackId(
      globalThis.__turnGetTrackId?.()
      || globalThis.__turnRuntime?.trackId
      || globalThis.__turnRuntime?.state?.trackId
    );
    return TRACK_CATALOG.find((track) => track.id === trackId) || TRACK_CATALOG[0];
  }

  function homeIsOpen() {
    return document.body.classList.contains('turn-home-open');
  }

  function syncRaceResetCopy() {
    const track = selectedTrack();
    if (raceResetButton) {
      raceResetButton.textContent = 'RESET RIVALS';
      raceResetButton.setAttribute('aria-label', `Reset rivals on ${track.name}`);
      raceResetButton.title = `Reset rivals on ${track.name}`;
    }

    const heading = raceResetDialog?.querySelector('h2');
    const paragraph = raceResetDialog?.querySelector('p');
    const confirm = raceResetDialog?.querySelector('.nuke-confirm');
    if (heading) heading.textContent = 'RESET RIVALS?';
    if (paragraph) {
      paragraph.textContent = `Remove the saved personal rivals and lap records for ${track.name}? Rivals on other tracks will be kept.`;
    }
    if (confirm) confirm.textContent = 'RESET RIVALS';
  }

  function syncSettingsCopy() {
    const allTracks = homeIsOpen();
    const track = selectedTrack();
    const description = card.querySelector('p');

    card.dataset.resetScope = allTracks ? 'all-tracks' : 'current-track';
    resetButton.classList.toggle('is-all-tracks', allTracks);
    resetConfirmButton.classList.toggle('is-all-tracks', allTracks);

    if (allTracks) {
      if (description) {
        description.textContent = 'Remove every recorded personal rival from every track. To reset only one track, use Settings at that track’s start line.';
      }
      resetButton.textContent = 'RESET ALL RIVALS';
      resetButton.setAttribute('aria-label', 'Reset personal rivals on all tracks');
      resetTarget.textContent = 'ALL TRACKS';
    } else {
      if (description) {
        description.textContent = `Remove the recorded personal rivals for ${track.name}. Rivals on other tracks will be kept.`;
      }
      resetButton.textContent = 'RESET RIVALS';
      resetButton.setAttribute('aria-label', `Reset personal rivals on ${track.name}`);
      resetTarget.textContent = track.name.toUpperCase();
    }

    syncRaceResetCopy();
  }

  resetButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    syncSettingsCopy();
    resetConfirm.hidden = false;
    resetConfirmButton.focus();
  }, { capture: true });

  resetConfirmButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    resetConfirmButton.disabled = true;

    try {
      const allTracks = homeIsOpen();
      const track = selectedTrack();

      if (allTracks) {
        clearAllRivalsState(
          globalThis.__turnRuntime?.state || {},
          TRACK_CATALOG.map((entry) => entry.id)
        );
        clearTrackCardRecords(root);
        status.textContent = 'Personal rivals reset on all tracks.';
      } else {
        globalThis.__turnResetRivals?.();
        clearTrackCardRecord(root, track.id);
        status.textContent = `Personal rivals reset for ${track.name}.`;
      }

      resetConfirm.hidden = true;
      resetButton.focus();
    } finally {
      resetConfirmButton.disabled = false;
    }
  }, { capture: true });

  resetCancel.addEventListener('click', () => {
    requestAnimationFrame(syncSettingsCopy);
  });

  dialog.addEventListener('toggle', syncSettingsCopy);
  dialog.addEventListener('close', syncSettingsCopy);
  raceResetButton?.addEventListener('click', syncRaceResetCopy, { capture: true });
  window.addEventListener('turn:track-changed', syncSettingsCopy);
  window.addEventListener('turn:ui-state-change', syncSettingsCopy);

  syncSettingsCopy();
  dialog.dataset.rivalResetVersion = RESET_VERSION;
  document.documentElement.dataset.turnHomeRivalReset = RESET_VERSION;
  return true;
}

function clearTrackCardRecords(root) {
  for (const bestBox of root.querySelectorAll('[data-track-best]')) {
    clearBestBox(bestBox);
  }
}

function clearTrackCardRecord(root, trackId) {
  const bestBox = [...root.querySelectorAll('[data-track-best]')].find((entry) => (
    entry.dataset.trackBest === trackId
  ));
  if (bestBox) clearBestBox(bestBox);
}

function clearBestBox(bestBox) {
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

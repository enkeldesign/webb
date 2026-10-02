// PAUSE during a race (#985): the square Ⅱ beside RESTART LAP, and the PAUSED dialog.
//
// The button shows during an active lap only. The dialog opens whenever the race
// pauses (the button, back, or TURN leaving the screen) and offers RESUME, RESTART
// LAP, SETTINGS and LEAVE RACE. RESTART LAP and LEAVE RACE take their usual paths
// (the race row's own buttons); SETTINGS opens over the dialog and the race stays
// paused until RESUME. Escape and back resume, like closing any TURN dialog.
// race/race-pause.js owns the pause itself.
//
// A screen rotation mid-lap (#1080) opens the same dialog as SCREEN ROTATED: turning
// back resumes, and the primary action races on in the new orientation. Either way a
// fast 3-2-1 lets the player settle the phone, and steering centres at GO.

import { installRacePause } from '../race/race-pause.js';

const INSTALL_KEY = '__turnRacePauseMenu';

export function installRacePauseMenu({ windowRef = window, documentRef = document } = {}) {
  if (windowRef[INSTALL_KEY]) return windowRef[INSTALL_KEY];
  const group = documentRef.querySelector('.utility-group');
  const restartButton = documentRef.querySelector('#resetButton');
  if (!group || !restartButton) return null;
  const racePause = installRacePause({ windowRef, documentRef });

  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = 'utility turn-race-pause-button';
  button.hidden = true;
  button.setAttribute('aria-label', 'Pause race');
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = '<span class="turn-race-pause-icon" aria-hidden="true"><i></i><i></i></span>';
  restartButton.after(button);

  const dialog = documentRef.createElement('dialog');
  dialog.className = 'm8-dialog turn-dialog turn-dialog--compact turn-race-pause-dialog';
  dialog.setAttribute('aria-labelledby', 'turnRacePauseTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card turn-dialog__surface">
      <header class="m8-dialog-head turn-dialog__header">
        <div><span>RACE</span><h2 id="turnRacePauseTitle">PAUSED</h2></div>
      </header>
      <p class="turn-race-pause-note" hidden>Turn back to keep racing.</p>
      <div class="turn-race-pause-actions turn-dialog__actions">
        <button class="turn-race-pause-resume" type="button" data-pause-action="resume">RESUME</button>
        <button type="button" data-pause-action="restart">RESTART LAP</button>
        <button type="button" data-pause-action="settings" aria-haspopup="dialog">SETTINGS</button>
        <button class="turn-race-pause-leave" type="button" data-pause-action="leave">LEAVE RACE</button>
      </div>
    </article>`;
  documentRef.body.appendChild(dialog);
  const resumeButton = dialog.querySelector('[data-pause-action="resume"]');
  const title = dialog.querySelector('#turnRacePauseTitle');
  const note = dialog.querySelector('.turn-race-pause-note');

  const countdown = documentRef.createElement('p');
  countdown.className = 'turn-race-countdown';
  countdown.setAttribute('aria-hidden', 'true');
  countdown.hidden = true;
  documentRef.body.appendChild(countdown);
  const COUNT_STEP_MS = 400;
  let countTimer = 0;

  const status = documentRef.createElement('p');
  status.className = 'turn-sr-only turn-race-pause-status';
  status.setAttribute('aria-live', 'polite');
  documentRef.body.appendChild(status);
  function announce(message) {
    status.textContent = '';
    windowRef.setTimeout(() => {
      status.textContent = message;
    }, 50);
  }

  function syncButton() {
    button.hidden = !racePause.canPause;
  }

  const rotated = () => racePause.reason === 'rotation';
  // The orientation type changes with the rotation itself; the media query follows layout.
  const screenWord = () => {
    const type = windowRef.screen?.orientation?.type;
    const portrait = type ? type.startsWith('portrait') : windowRef.matchMedia?.('(orientation: portrait)').matches;
    return portrait ? 'PORTRAIT' : 'LANDSCAPE';
  };

  function syncDialog() {
    title.textContent = rotated() ? 'SCREEN ROTATED' : 'PAUSED';
    note.hidden = !rotated();
    resumeButton.textContent = rotated() ? `RACE IN ${screenWord()}` : 'RESUME';
  }

  function openDialog() {
    syncButton();
    syncDialog();
    if (!dialog.open) dialog.showModal();
    resumeButton.focus();
    announce(rotated() ? 'Screen rotated. Race paused. Turn back to keep racing.' : 'Race paused.');
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function stopCountdown() {
    windowRef.clearTimeout(countTimer);
    countTimer = 0;
    countdown.hidden = true;
  }

  // After a rotation: 3, 2, 1, then the race runs on and steering centres on the
  // phone as it is now held.
  function resumeAfterCountdown() {
    if (countTimer) return;
    closeDialog();
    announce('Resuming in 3, 2, 1.');
    let count = 3;
    const step = () => {
      if (count === 0) {
        stopCountdown();
        if (!racePause.resume()) return;
        documentRef.querySelector('#calibrateButton')?.click();
        syncButton();
        button.focus();
        announce('Race resumed.');
        return;
      }
      countdown.textContent = String(count);
      countdown.hidden = false;
      count -= 1;
      countTimer = windowRef.setTimeout(step, COUNT_STEP_MS);
    };
    step();
  }

  function resume() {
    if (rotated()) {
      resumeAfterCountdown();
      return;
    }
    closeDialog();
    if (!racePause.resume()) return;
    syncButton();
    button.focus();
    announce('Race resumed.');
  }

  // Escape, back, or any other close while still paused resumes. The actions lift the
  // pause themselves before the dialog's close event arrives. That event comes a task
  // later: if a new pause has opened PAUSED again by then, it is not this close's.
  dialog.addEventListener('close', () => {
    if (racePause.paused && !dialog.open && !countTimer) resume();
  });

  dialog.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-pause-action]')?.dataset.pauseAction;
    if (action === 'resume') resume();
    else if (action === 'restart') {
      racePause.resume({ ending: true });
      closeDialog();
      restartButton.click();
    } else if (action === 'leave') {
      racePause.resume({ ending: true });
      closeDialog();
      documentRef.querySelector('.back-to-lot-button')?.click();
    } else if (action === 'settings') {
      // Settings opens over PAUSED; the race stays paused until RESUME.
      documentRef.querySelector('.m8-race-settings-button')?.click();
    }
  });

  button.addEventListener('click', () => racePause.pause('player'));

  windowRef.addEventListener('turn:ui-state-change', (event) => {
    const change = event.detail?.reason;
    if (change === 'race-paused') openDialog();
    else if (change === 'race-pause-ended') {
      stopCountdown();
      closeDialog();
    } else if (change === 'race-rotation') {
      // Turned back: race on. Turned elsewhere, even mid-count: ask again.
      if (event.detail?.rotatedBack) resumeAfterCountdown();
      else {
        stopCountdown();
        openDialog();
      }
    }
    syncButton();
  });
  syncButton();

  const api = Object.freeze({ button, dialog, racePause });
  windowRef[INSTALL_KEY] = api;
  return api;
}

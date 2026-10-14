import { DRIFT_ATTACK_TUTORIAL, FLOW_TUTORIAL, TURN_TUTORIAL, TUTORIAL_STATUS } from './tutorial-progress.js';

// TURN TUTORIAL entry points (#1132): the card a new player sees on their first launch
// of TURN, and the TURN TUTORIAL entry in HOW TO PLAY. iOS grants motion steering and
// sound only from a tap, so the first launch opens this card instead of driving off.
const STYLE_ID = 'turn-tutorial-entry-styles';

// What TURN is for, said where a new player starts and at the top of HOW TO PLAY, where
// players who never saw the first-launch card find it too.
export const TURN_GOAL_TEXT = 'TURN is about the feel of the drive and getting faster. Your best laps become rivals to beat, and trophies unlock new tracks, cars and ways to play.';

// The card opens by itself for players, not in automated or local runs: the test suites
// open TURN with fresh profiles all the time. As in offline.js, a test that covers the
// first launch opts in with LAUNCH_UNDER_TEST_KEY.
export const LAUNCH_UNDER_TEST_KEY = 'turn-tutorial-launch-under-test';

export function opensTutorialOnLaunch(windowRef = globalThis) {
  const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(windowRef.location?.hostname || '');
  if (!windowRef.navigator?.webdriver && !local) return true;
  try {
    return windowRef.localStorage?.getItem(LAUNCH_UNDER_TEST_KEY) === '1';
  } catch {
    return false;
  }
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .m8-tutorial-dialog .m8-dialog-card { display: grid; gap: var(--turn-space-4); }
    .m8-tutorial-copy { margin: 0; font-size: var(--turn-type-body); line-height: var(--turn-leading-body); }
    .m8-tutorial-actions { display: grid; gap: var(--turn-space-3); }
    .m8-tutorial-actions button,
    .m8-tutorial-entry button,
    .m8-drift-attack-entry button,
    .m8-flow-tutorial-entry button {
      min-height: var(--turn-target-min);
      padding: var(--turn-space-3) var(--turn-space-4);
      border: var(--turn-border-control) solid var(--turn-outline);
      border-radius: var(--turn-radius-control);
      background: var(--turn-action-utility);
      color: var(--turn-text);
      font: inherit;
      font-size: var(--turn-type-body);
      font-weight: var(--turn-weight-display);
      cursor: pointer;
    }
    .m8-tutorial-actions [data-tutorial-start] {
      background: var(--turn-action-primary);
      color: var(--turn-ink);
    }
    .m8-tutorial-note,
    .m8-tutorial-entry p,
    .m8-drift-attack-entry p,
    .m8-flow-tutorial-entry p {
      margin: 0;
      font-size: var(--turn-type-small);
      line-height: var(--turn-leading-body);
    }
    .m8-tutorial-copy p { margin: 0; }
    .m8-tutorial-copy p + p { margin-top: var(--turn-space-2); }
    .m8-tutorial-entry .m8-tutorial-goal { font-size: var(--turn-type-body); }
    .m8-tutorial-entry,
    .m8-drift-attack-entry,
    .m8-flow-tutorial-entry {
      display: grid;
      gap: var(--turn-space-2);
      margin-bottom: var(--turn-space-4);
    }
    .m8-drift-attack-entry[hidden] { display: none; }
    .m8-flow-tutorial-entry[hidden] { display: none; }
    /* TUTORIALS (#1169): with two or more tutorials, one button stands in for them all. */
    .m8-how-dialog:not(.has-tutorials-menu) .m8-tutorials-opener,
    .m8-how-dialog.has-tutorials-menu .m8-tutorial-entry > [data-tutorial-replay],
    .m8-how-dialog.has-tutorials-menu .m8-tutorial-entry > [data-tutorial-replay] + p,
    .m8-how-dialog.has-tutorials-menu .m8-drift-attack-entry,
    .m8-how-dialog.has-tutorials-menu .m8-flow-tutorial-entry,
    .m8-how-dialog.has-tutorials-menu .turn-dbe-training-how { display: none; }
    .m8-tutorials-opener { display: grid; gap: var(--turn-space-2); }
    .m8-tutorials-opener button,
    .m8-tutorials-list button {
      min-height: var(--turn-target-min);
      padding: var(--turn-space-3) var(--turn-space-4);
      border: var(--turn-border-control) solid var(--turn-outline);
      border-radius: var(--turn-radius-control);
      background: var(--turn-action-utility);
      color: var(--turn-text);
      font: inherit;
      font-size: var(--turn-type-body);
      font-weight: var(--turn-weight-display);
      cursor: pointer;
    }
    .m8-tutorials-opener p,
    .m8-tutorials-list p {
      margin: 0;
      font-size: var(--turn-type-small);
      line-height: var(--turn-leading-body);
    }
    .m8-dialog.m8-tutorials-sheet { width: min(570px, calc(100vw - 24px)); }
    .m8-tutorials-sheet .m8-dialog-card { display: grid; gap: var(--turn-space-3); }
    .m8-tutorials-sheet .m8-dialog-head { margin-bottom: 0; }
    .m8-tutorials-list { display: grid; gap: var(--turn-space-4); margin: 0; padding: 0; list-style: none; }
    .m8-tutorials-list li { display: grid; gap: var(--turn-space-2); }
    .m8-tutorials-done {
      margin-inline-start: var(--turn-space-2);
      font-weight: var(--turn-weight-display);
      letter-spacing: 0.08em;
    }
  `;
  document.head.appendChild(style);
}

function createLaunchCard() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog m8-tutorial-dialog';
  dialog.setAttribute('aria-labelledby', 'turnTutorialTitle');
  dialog.setAttribute('aria-describedby', 'turnTutorialCopy');
  dialog.innerHTML = `
    <article class="m8-dialog-card">
      <header class="m8-dialog-head">
        <div><span>WELCOME TO TURN</span><h2 id="turnTutorialTitle">TURN TUTORIAL</h2></div>
      </header>
      <div class="m8-tutorial-copy" id="turnTutorialCopy">
        <p>${TURN_GOAL_TEXT}</p>
        <p>Start with one lap of COUNTRYSIDE in the LEARNER CAR.</p>
        <p data-tutorial-dbe-note>New to Drive By Ear’s sounds? You can learn them first.</p>
      </div>
      <div class="m8-tutorial-actions">
        <button type="button" data-tutorial-start>START TUTORIAL</button>
        <button type="button" data-tutorial-dbe>LEARN DRIVE BY EAR FIRST</button>
        <button type="button" data-tutorial-skip>SKIP TUTORIAL</button>
      </div>
      <p class="m8-tutorial-note">You can play TURN TUTORIAL any time from HOW TO PLAY.</p>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

export function installTutorialEntry({
  howDialog,
  progress,
  startTutorial,
  announce = () => {},
  opensOnLaunch = () => opensTutorialOnLaunch(),
  // DRIVE BY EAR TUTORIAL (training/drive-by-ear-training.js): onClose runs once it ends.
  driveByEar = () => globalThis.__turnDriveByEarTraining || null,
  // Like every other way into DRIVE BY EAR TUTORIAL, the menu music goes quiet
  // (m8-home-fixed-layout.js restores it when the tutorial's introduction closes).
  silenceMenuMusic = () => globalThis.__turnDbeTrainingMusicSilence?.silence?.(),
  module = TURN_TUTORIAL
}) {
  installStyles();

  // HOW TO PLAY: always available, first run or replay.
  const entry = document.createElement('section');
  entry.className = 'm8-tutorial-entry';
  entry.innerHTML = `
    <p class="m8-tutorial-goal">${TURN_GOAL_TEXT}</p>
    <button type="button" data-tutorial-replay>TURN TUTORIAL</button>
    <p>Learn TURN by playing one lap of COUNTRYSIDE.</p>`;
  howDialog?.querySelector('.m8-guide-grid')?.before(entry);
  entry.querySelector('button').addEventListener('click', () => {
    if (typeof howDialog.close === 'function' && howDialog.open) howDialog.close();
    void startTutorial();
  });

  const card = createLaunchCard();
  const close = () => {
    if (typeof card.close === 'function' && card.open) card.close();
    else card.removeAttribute('open');
  };
  card.querySelector('[data-tutorial-start]').addEventListener('click', () => {
    close();
    void startTutorial();
  });
  // Learning TURN's sounds first is a choice, never a gate (#1133): TURN TUTORIAL comes
  // back as soon as DRIVE BY EAR TUTORIAL ends.
  const driveByEarButton = card.querySelector('[data-tutorial-dbe]');
  driveByEarButton.addEventListener('click', () => {
    const training = driveByEar();
    if (!training?.open) return;
    close();
    silenceMenuMusic();
    void training.open(driveByEarButton, { onClose: () => showLaunchCard() });
  });
  card.querySelector('[data-tutorial-skip]').addEventListener('click', () => {
    progress.stop(module.id);
    close();
    announce('TURN TUTORIAL skipped. You can play it any time from HOW TO PLAY.');
  });

  // The first-launch card, shown while the tutorial still starts on launch.
  const showLaunchCard = () => {
    if (!progress.startsOnLaunch(module.id) || card.open) return false;
    // Said before the buttons, with the copy (#1170), and only when it can be done.
    driveByEarButton.hidden = !driveByEar()?.open;
    card.querySelector('[data-tutorial-dbe-note]').hidden = driveByEarButton.hidden;
    // TURN dialogs move focus to their heading; START TUTORIAL is the first control.
    if (typeof card.showModal === 'function') card.showModal();
    else card.setAttribute('open', '');
    return true;
  };
  const openOnLaunch = () => {
    if (opensOnLaunch()) showLaunchCard();
  };
  if (document.documentElement.classList.contains('turn-home-ready')) openOnLaunch();
  else document.addEventListener('turn:home-ready', openOnLaunch, { once: true });

  return Object.freeze({ card, entry, showLaunchCard });
}

// A tutorial offered in HOW TO PLAY once its feature unlocks, after the tutorials above it.
function installFeatureTutorialEntry({ howDialog, startTutorial, isUnlocked, className, attribute, label, copy }) {
  installStyles();
  const entry = document.createElement('section');
  entry.className = className;
  entry.innerHTML = `
    <button type="button" ${attribute}>${label}</button>
    <p>${copy}</p>`;
  const above = [...(howDialog?.querySelectorAll('.m8-tutorial-entry, .m8-drift-attack-entry, .m8-flow-tutorial-entry') || [])].at(-1);
  if (above) above.after(entry);
  else howDialog?.querySelector('.m8-guide-grid')?.before(entry);
  const sync = () => {
    let unlocked = false;
    try {
      unlocked = isUnlocked() === true;
    } catch {
      unlocked = false;
    }
    entry.hidden = !unlocked;
    return unlocked;
  };
  sync();
  howDialog?.addEventListener('toggle', sync);
  globalThis.addEventListener?.('turn:trophy-road-updated', sync);
  entry.querySelector('button').addEventListener('click', () => {
    if (typeof howDialog.close === 'function' && howDialog.open) howDialog.close();
    void startTutorial();
  });
  return Object.freeze({ entry, sync });
}

// DRIFT ATTACK TUTORIAL in HOW TO PLAY (#1150), below TURN TUTORIAL once DRIFT ATTACK
// (and OVERCHARGE with it) is unlocked.
export function installDriftAttackEntry({ howDialog, startTutorial, isUnlocked }) {
  return installFeatureTutorialEntry({
    howDialog,
    startTutorial,
    isUnlocked,
    className: 'm8-drift-attack-entry',
    attribute: 'data-tutorial-drift-attack',
    label: 'DRIFT ATTACK TUTORIAL',
    copy: 'Learn DRIFT scoring, linked drifts and OVERCHARGE in one lap of CLIFFSIDE.'
  });
}

// FLOW TUTORIAL (#1149), once FLOW unlocks.
export function installFlowTutorialEntry({ howDialog, startTutorial, isUnlocked }) {
  return installFeatureTutorialEntry({
    howDialog,
    startTutorial,
    isUnlocked,
    className: 'm8-flow-tutorial-entry',
    attribute: 'data-tutorial-flow',
    label: 'FLOW TUTORIAL',
    copy: 'Learn what earns FLOW and how COMBO grows in one lap of CLIFFSIDE.'
  });
}

// The tutorials, in the order a player meets them (#1170): TURN, DRIVE BY EAR, then the
// ways to play unlocked since.
const TUTORIAL_LIST = Object.freeze([
  Object.freeze({ id: TURN_TUTORIAL.id, label: 'TURN TUTORIAL', copy: 'Learn TURN by playing one lap of COUNTRYSIDE.' }),
  Object.freeze({ id: 'drive-by-ear', label: 'DRIVE BY EAR TUTORIAL', copy: 'Learn TURN’s sounds in five short guided parts.' }),
  Object.freeze({ id: DRIFT_ATTACK_TUTORIAL.id, label: 'DRIFT ATTACK TUTORIAL', copy: 'Learn DRIFT scoring, linked drifts and OVERCHARGE in one lap of CLIFFSIDE.', feature: 'drift-attack' }),
  Object.freeze({ id: FLOW_TUTORIAL.id, label: 'FLOW TUTORIAL', copy: 'Learn what earns FLOW and how COMBO grows in one lap of CLIFFSIDE.', feature: 'flow' })
]);
const DRIVE_BY_EAR_ACHIEVEMENT_ID = 'drive-by-ear';

function createTutorialsSheet() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog m8-tutorials-sheet';
  dialog.setAttribute('aria-labelledby', 'turnTutorialsTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card">
      <header class="m8-dialog-head">
        <div><span>HOW TO PLAY</span><h2 id="turnTutorialsTitle" tabindex="-1">TUTORIALS</h2></div>
        <button type="button" data-tutorials-close aria-label="Close tutorials">×</button>
      </header>
      <ul class="m8-tutorials-list"></ul>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

// TUTORIALS (#1169): once HOW TO PLAY offers two or more tutorials, one TUTORIALS button
// opens a sheet of them instead of a stack of buttons. With one, its own button stays.
export function installTutorialsMenu({
  howDialog,
  progress,
  startTutorial,
  isUnlocked = () => false,
  driveByEar = () => globalThis.__turnDriveByEarTraining || null,
  silenceMenuMusic = () => globalThis.__turnDbeTrainingMusicSilence?.silence?.(),
  isDriveByEarDone = () => globalThis.__turnAchievements?.store?.isUnlocked?.(DRIVE_BY_EAR_ACHIEVEMENT_ID) === true
}) {
  const turnEntry = howDialog?.querySelector('.m8-tutorial-entry');
  if (!turnEntry) return null;
  installStyles();
  const opener = document.createElement('div');
  opener.className = 'm8-tutorials-opener';
  opener.innerHTML = `
    <button type="button" data-tutorials-open aria-haspopup="dialog">TUTORIALS</button>
    <p>Learn by playing, one tutorial at a time.</p>`;
  turnEntry.querySelector('.m8-tutorial-goal').after(opener);
  const openButton = opener.querySelector('button');
  const sheet = createTutorialsSheet();
  const list = sheet.querySelector('.m8-tutorials-list');

  const safely = (check) => {
    try {
      return check() === true;
    } catch {
      return false;
    }
  };
  const available = () => TUTORIAL_LIST.filter((tutorial) => {
    if (tutorial.id === 'drive-by-ear') return Boolean(driveByEar()?.open);
    return !tutorial.feature || safely(() => isUnlocked(tutorial.feature));
  });
  const done = (tutorial) => (tutorial.id === 'drive-by-ear'
    ? safely(isDriveByEarDone)
    : progress?.status?.(tutorial.id) === TUTORIAL_STATUS.COMPLETED);

  const sync = () => {
    const grouped = available().length >= 2;
    howDialog.classList.toggle('has-tutorials-menu', grouped);
    return grouped;
  };

  function render() {
    list.replaceChildren(...available().map((tutorial) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tutorialPick = tutorial.id;
      button.textContent = tutorial.label;
      const copy = document.createElement('p');
      copy.id = `turnTutorialsCopy-${tutorial.id}`;
      copy.textContent = tutorial.copy;
      if (done(tutorial)) {
        const mark = document.createElement('strong');
        mark.className = 'm8-tutorials-done';
        mark.textContent = 'DONE';
        copy.append(' ', mark);
      }
      button.setAttribute('aria-describedby', copy.id);
      item.append(button, copy);
      return item;
    }));
  }

  const close = (dialog) => {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  };
  const show = (dialog) => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  // One modal at a time (design-dialogs.html): the sheet stands in for HOW TO PLAY, as
  // HISTORY does for ABOUT, and HOW TO PLAY comes back, on TUTORIALS, when it closes.
  // HOW TO PLAY's own trigger is kept for when it finally closes.
  let howReturnFocus = null;
  let reopenHow = false;
  openButton.addEventListener('click', () => {
    render();
    reopenHow = howDialog.open || howDialog.hasAttribute('open');
    if (reopenHow) {
      howReturnFocus = howDialog.__turnReturnFocus || null;
      howDialog.__turnReturnFocus = null;
      close(howDialog);
    }
    show(sheet);
    sheet.querySelector('h2').focus();
  });
  sheet.querySelector('[data-tutorials-close]').addEventListener('click', () => close(sheet));
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) close(sheet);
  });
  sheet.addEventListener('close', () => {
    if (!reopenHow) return;
    reopenHow = false;
    show(howDialog);
    howDialog.__turnReturnFocus = howReturnFocus;
    // After TURN's heading-first focus (ui/startup-screen-reader-handoff-r529.js), which
    // runs in microtasks once HOW TO PLAY opens: close returns focus to the trigger.
    globalThis.setTimeout(() => {
      if (howDialog.open) openButton.focus();
    }, 0);
  });
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tutorial-pick]');
    if (!button) return;
    const id = button.dataset.tutorialPick;
    // A tutorial starts instead: focus goes where closing HOW TO PLAY would send it.
    reopenHow = false;
    close(sheet);
    const returnTo = howReturnFocus;
    howReturnFocus = null;
    returnTo?.focus?.();
    if (id === 'drive-by-ear') {
      silenceMenuMusic();
      void driveByEar()?.open?.(returnTo || openButton);
    } else if (id === TURN_TUTORIAL.id) {
      void startTutorial();
    } else {
      void startTutorial(id);
    }
  });

  sync();
  howDialog.addEventListener('toggle', sync);
  globalThis.addEventListener?.('turn:trophy-road-updated', sync);
  return Object.freeze({ opener, sheet, sync, render });
}

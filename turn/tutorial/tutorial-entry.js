import { TURN_TUTORIAL } from './tutorial-progress.js';

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
    .m8-tutorial-actions [data-tutorial-start],
    .m8-tutorial-entry button,
    .m8-drift-attack-entry button,
    .m8-flow-tutorial-entry button {
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
    driveByEarButton.hidden = !driveByEar()?.open;
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
    copy: 'Learn DRIFT scoring and OVERCHARGE in one lap of COUNTRYSIDE.'
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
    copy: 'Learn what earns FLOW and how COMBO grows in one lap of COUNTRYSIDE.'
  });
}

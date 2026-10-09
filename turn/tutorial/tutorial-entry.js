import { TURN_TUTORIAL } from './tutorial-progress.js';

// TURN TUTORIAL entry points (#1132): the card a new player sees on their first launch
// of TURN, and the TURN TUTORIAL entry in HOW TO PLAY. iOS grants motion steering and
// sound only from a tap, so the first launch opens this card instead of driving off.
//
// Until the teaching lap is complete, only admin-unlocked profiles see the HOW TO PLAY
// entry, and the card does not open by itself at launch: admin profiles are also the
// test profiles, and the release turns the first-launch start on for everyone at once.
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const STYLE_ID = 'turn-tutorial-entry-styles';

export function tutorialEntryEnabled(storage = globalThis.localStorage) {
  try {
    return Boolean(storage?.getItem?.(ADMIN_UNLOCK_MARKER));
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
    .m8-tutorial-entry button {
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
    .m8-tutorial-entry button {
      background: var(--turn-action-primary);
      color: var(--turn-ink);
    }
    .m8-tutorial-note,
    .m8-tutorial-entry p {
      margin: 0;
      font-size: var(--turn-type-small);
      line-height: var(--turn-leading-body);
    }
    .m8-tutorial-entry {
      display: grid;
      gap: var(--turn-space-2);
      margin-bottom: var(--turn-space-4);
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
      <p class="m8-tutorial-copy" id="turnTutorialCopy">Learn TURN by playing one lap of COUNTRYSIDE in the LEARNER CAR. When you cross the line, your own lap becomes the rival to catch.</p>
      <div class="m8-tutorial-actions">
        <button type="button" data-tutorial-start>START TUTORIAL</button>
        <button type="button" data-tutorial-stop>STOP TUTORIAL</button>
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
  enabled = () => tutorialEntryEnabled(),
  opensOnLaunch = () => false,
  module = TURN_TUTORIAL
}) {
  if (!enabled()) return null;
  installStyles();

  // HOW TO PLAY: always available, first run or replay.
  const entry = document.createElement('section');
  entry.className = 'm8-tutorial-entry';
  entry.innerHTML = `
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
  card.querySelector('[data-tutorial-stop]').addEventListener('click', () => {
    progress.stop(module.id);
    close();
    announce('TURN TUTORIAL stopped. You can play it any time from HOW TO PLAY.');
  });

  // The first-launch card, shown while the tutorial still starts on launch.
  const showLaunchCard = () => {
    if (!progress.startsOnLaunch(module.id) || card.open) return false;
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

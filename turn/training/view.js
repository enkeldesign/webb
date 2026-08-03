import { BALANCE_SUGGESTION_THRESHOLD, TRAINING_STAGES } from './stages.js';

export function installTrainingView({ revision, openTraining, isTrainingActive }) {
  installStylesheet(revision);
  const dialogs = createDialogs();
  const visualHud = createVisualHud();
  const raceNavigation = createRaceNavigation();
  const entryPoints = installEntryPoints(openTraining);
  const balanceSlider = installBalanceSuggestion();
  const blankSuggestion = installBlankScreenSuggestion({ openTraining, isTrainingActive });
  return Object.freeze({
    ...dialogs,
    visualHud,
    raceNavigation,
    entryPoints,
    balanceSlider,
    blankSuggestion
  });
}

export function showTrainingDialog(dialog, focusSelector = '[data-training-primary]') {
  const card = dialog.querySelector('.m8-dialog-card');
  if (card) card.scrollTop = 0;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  dialog.querySelector(focusSelector)?.focus();
}

export function hideTrainingDialog(dialog) {
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
}

export function closeSourceDialog(trigger) {
  const source = trigger?.closest?.('dialog');
  if (!source) return;
  source.__turnReturnFocus = null;
  if (typeof source.close === 'function' && source.open) source.close();
  else source.removeAttribute('open');
}

export function updatePartDialog(dialog, nextIndex) {
  const stage = TRAINING_STAGES[nextIndex];
  const completedIndex = Math.max(0, nextIndex - 1);
  dialog.querySelector('.turn-dbe-training-part-kicker').textContent =
    `PART ${completedIndex + 1} COMPLETE · NEXT: PART ${nextIndex + 1}`;
  dialog.querySelector('#turnDbePartTitle').textContent = stage.title.toUpperCase();
  dialog.querySelector('.turn-dbe-training-part-lead').textContent = stage.lead;
  dialog.querySelector('.turn-dbe-training-visual-hint').textContent = stage.visualHint;
  const repeat = dialog.querySelector('[data-training-repeat]');
  repeat.dataset.trainingRepeat = String(completedIndex);
  repeat.textContent = `REPEAT PART ${completedIndex + 1}`;
  const next = dialog.querySelector('[data-training-next]');
  next.dataset.trainingNext = String(nextIndex);
  next.textContent = `START PART ${nextIndex + 1}`;
}

export function renderTrainingHud(hud, stage, index) {
  hud.querySelector('span').textContent = `PART ${index + 1} OF ${TRAINING_STAGES.length}`;
  hud.querySelector('strong').textContent = stage.title.toUpperCase();
  hud.hidden = false;
}

export function renderTrainingNavigation(navigation, index) {
  const previous = navigation.querySelector('[data-training-race-previous]');
  const restart = navigation.querySelector('[data-training-race-restart]');
  const next = navigation.querySelector('[data-training-race-next]');
  previous.disabled = index <= 0;
  next.disabled = index >= TRAINING_STAGES.length - 1;
  previous.dataset.trainingTarget = String(index - 1);
  next.dataset.trainingTarget = String(index + 1);
  previous.setAttribute(
    'aria-label',
    index > 0 ? `Previous: Part ${index}, ${TRAINING_STAGES[index - 1].title}` : 'No previous training part'
  );
  restart.setAttribute('aria-label', `Restart Part ${index + 1}, ${TRAINING_STAGES[index].title}`);
  next.setAttribute(
    'aria-label',
    index < TRAINING_STAGES.length - 1
      ? `Next: Part ${index + 2}, ${TRAINING_STAGES[index + 1].title}`
      : 'No next training part'
  );
  navigation.hidden = false;
}

function installStylesheet(revision) {
  if (document.querySelector('link[data-turn-dbe-training]')) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/training/drive-by-ear-training.css?build=${buildKey}-${revision}`;
  stylesheet.setAttribute('data-turn-dbe-training', '');
  document.head.appendChild(stylesheet);
}

function makeDialog({ className, labelledBy, content }) {
  const dialog = document.createElement('dialog');
  dialog.className = `m8-dialog turn-dbe-training-dialog ${className}`;
  dialog.setAttribute('aria-labelledby', labelledBy);
  dialog.innerHTML = content;
  document.body.appendChild(dialog);
  return dialog;
}

function trainingPartList() {
  return TRAINING_STAGES.map((stage, index) => `
    <li>
      <button type="button" data-training-stage="${index}">
        <span>PART ${index + 1}</span>
        <strong>${stage.title}</strong>
        <small>${stage.menuSummary}</small>
      </button>
    </li>`).join('');
}

function createDialogs() {
  const introDialog = makeDialog({
    className: 'turn-dbe-training-intro-dialog',
    labelledBy: 'turnDbeTrainingTitle',
    content: `
      <article class="m8-dialog-card turn-dbe-training-card">
        <header class="m8-dialog-head">
          <div><span>FIVE GUIDED PARTS</span><h2 id="turnDbeTrainingTitle">DRIVE BY EAR 101</h2></div>
          <button type="button" data-training-cancel aria-label="Close Drive By Ear 101">×</button>
        </header>
        <div class="turn-dbe-training-copy">
          <p data-training-intro-copy>Learn TURN's spatial guidance one layer at a time. Training temporarily uses the Training Car and puts Drive By Ear at 95% of the sound mix. Your car and audio choices return when you leave.</p>

          <section class="turn-dbe-training-sound-key" aria-labelledby="turnDbeSoundKeyTitle">
            <h3 id="turnDbeSoundKeyTitle">Know which sound is speaking</h3>
            <dl>
              <div>
                <dt>Steering guidance</dt>
                <dd>The warm continuous hum points toward the route. Steer toward it.</dd>
              </div>
              <div>
                <dt>Pace notes</dt>
                <dd>Sharp directional BIPs play before curves. The ear gives the turn side, the count gives severity, and a held final BEEP means the curve continues.</dd>
              </div>
              <div>
                <dt>Status and safety</dt>
                <dd>Engine, tyres, gravel and BOOST describe the car or surface. The short maximum-steering two-tone means you have reached the steering limit. These sounds are not corner instructions.</dd>
              </div>
            </dl>
          </section>

          <nav class="turn-dbe-training-part-picker" aria-label="Choose a training part">
            <ol>${trainingPartList()}</ol>
          </nav>

          <p class="turn-dbe-training-visual-hint" aria-hidden="true">The screen stays on while you learn. Later parts invite you to try Blank screen mode.</p>
          <div class="turn-dbe-training-actions">
            <button type="button" data-training-cancel>CANCEL</button>
            <button type="button" data-training-primary data-training-stage="0">START PART 1</button>
          </div>
        </div>
      </article>`
  });

  const partDialog = makeDialog({
    className: 'turn-dbe-training-part-dialog',
    labelledBy: 'turnDbePartTitle',
    content: `
      <article class="m8-dialog-card turn-dbe-training-card">
        <header class="m8-dialog-head">
          <div><span class="turn-dbe-training-part-kicker"></span><h2 id="turnDbePartTitle"></h2></div>
          <button type="button" data-training-leave aria-label="Leave Drive By Ear 101">×</button>
        </header>
        <div class="turn-dbe-training-copy">
          <p class="turn-dbe-training-part-lead"></p>
          <p class="turn-dbe-training-visual-hint" aria-hidden="true"></p>
          <div class="turn-dbe-training-actions">
            <button type="button" data-training-leave>LEAVE TRAINING</button>
            <button type="button" data-training-repeat></button>
            <button type="button" data-training-primary data-training-next></button>
          </div>
        </div>
      </article>`
  });

  const completeDialog = makeDialog({
    className: 'turn-dbe-training-complete-dialog',
    labelledBy: 'turnDbeCompleteTitle',
    content: `
      <article class="m8-dialog-card turn-dbe-training-card">
        <header class="m8-dialog-head">
          <div><span>TRAINING</span><h2 id="turnDbeCompleteTitle">DRIVE BY EAR</h2></div>
          <button type="button" data-training-return aria-label="Return Home">×</button>
        </header>
        <div class="turn-dbe-training-copy">
          <p>You have heard the guiding ribbon, pace notes, status sounds and off-road recovery work together. Train again whenever you want, then take the same sound language onto any TURN track.</p>
          <div class="turn-dbe-training-actions">
            <button type="button" data-training-return>RETURN HOME</button>
            <button type="button" data-training-primary data-training-again>TRAIN AGAIN</button>
          </div>
        </div>
      </article>`
  });

  return Object.freeze({ introDialog, partDialog, completeDialog });
}

function createVisualHud() {
  const hud = document.createElement('div');
  hud.className = 'turn-dbe-training-hud';
  hud.hidden = true;
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = '<span></span><strong></strong>';
  document.body.appendChild(hud);
  return hud;
}

function createRaceNavigation() {
  const navigation = document.createElement('nav');
  navigation.className = 'turn-dbe-training-race-nav';
  navigation.hidden = true;
  navigation.setAttribute('aria-label', 'Training part navigation');
  navigation.innerHTML = `
    <button type="button" data-training-race-previous>‹ PREVIOUS</button>
    <button type="button" data-training-race-restart>RESTART PART</button>
    <button type="button" data-training-race-next>NEXT ›</button>`;
  document.body.appendChild(navigation);
  return navigation;
}

function installEntryPoints(openTraining) {
  const menu = document.querySelector('.m8-home-menu');
  const howButton = menu?.querySelector('.m8-how-button');
  const howGuide = document.querySelector('.m8-how-dialog .m8-guide-wide > div');
  const howDisclosure = howGuide?.querySelector('.m8-dbe-guide');
  const settingsAudio = document.querySelector('.m8-settings-dialog #m8AudioTitle')?.closest('.m8-setting-card');
  if (!menu || !howButton || !howGuide || !howDisclosure || !settingsAudio) {
    throw new Error('TURN Drive By Ear training could not find the Home, How to Play and Settings entry points.');
  }

  const homeButton = document.createElement('button');
  homeButton.type = 'button';
  homeButton.className = 'm8-feedback-button turn-dbe-training-home';
  homeButton.textContent = 'DRIVE BY EAR 101';
  homeButton.setAttribute('aria-haspopup', 'dialog');
  howButton.after(homeButton);

  const howCallout = document.createElement('div');
  howCallout.className = 'turn-dbe-training-how';
  howCallout.innerHTML = `
    <p><strong>Learn by listening.</strong> Try five short guided parts covering the ribbon, pace notes, status sounds and off-road recovery.</p>
    <button type="button" data-turn-dbe-training-entry>START DRIVE BY EAR 101</button>`;
  howDisclosure.before(howCallout);

  const settingsCallout = document.createElement('div');
  settingsCallout.className = 'turn-dbe-training-settings';
  settingsCallout.innerHTML = `
    <p>New to these sounds?</p>
    <button type="button" data-turn-dbe-training-entry>TRY DRIVE BY EAR 101</button>`;
  settingsAudio.appendChild(settingsCallout);

  homeButton.addEventListener('click', () => openTraining(homeButton));
  for (const button of document.querySelectorAll('[data-turn-dbe-training-entry]')) {
    button.addEventListener('click', () => openTraining(button));
  }
  return Object.freeze({ homeButton, howCallout, settingsCallout });
}

function installBalanceSuggestion() {
  const slider = document.querySelector('.m8-settings-dialog #m8AudioBalance');
  const status = document.querySelector('.m8-settings-dialog .m8-settings-status');
  if (!slider || !status) return null;
  let previous = Number(slider.value) || 0;
  let mentioned = false;
  slider.addEventListener('input', () => {
    const current = Number(slider.value) || 0;
    if (!mentioned && previous < BALANCE_SUGGESTION_THRESHOLD && current >= BALANCE_SUGGESTION_THRESHOLD) {
      mentioned = true;
      status.textContent = 'Drive By Ear is prominent in the sound mix. Drive By Ear 101 can help you recognise its guidance.';
    }
    previous = current;
  });
  return slider;
}

function installBlankScreenSuggestion({ openTraining, isTrainingActive }) {
  const blankButton = document.querySelector('.turn-screen-blank-control');
  if (!blankButton || typeof MutationObserver !== 'function') return null;
  const dialog = makeDialog({
    className: 'turn-dbe-training-blank-dialog',
    labelledBy: 'turnDbeBlankSuggestionTitle',
    content: `
      <article class="m8-dialog-card turn-dbe-training-card">
        <header class="m8-dialog-head">
          <div><span>BLANK SCREEN MODE</span><h2 id="turnDbeBlankSuggestionTitle">DRIVE BY EAR</h2></div>
          <button type="button" data-blank-continue aria-label="Close training suggestion">×</button>
        </header>
        <div class="turn-dbe-training-copy">
          <p>Blank screen mode lets you drive using sound. Drive By Ear 101 introduces the ribbon, pace notes, status sounds and off-road recovery before you rely on them in a race.</p>
          <div class="turn-dbe-training-actions">
            <button type="button" data-blank-continue>CONTINUE</button>
            <button type="button" data-training-primary data-blank-training>TRY TRAINING</button>
          </div>
        </div>
      </article>`
  });
  let suggested = false;
  const continueBlanking = () => {
    hideTrainingDialog(dialog);
    blankButton.focus({ preventScroll: true });
  };
  for (const button of dialog.querySelectorAll('[data-blank-continue]')) {
    button.addEventListener('click', continueBlanking);
  }
  dialog.querySelector('[data-blank-training]').addEventListener('click', () => {
    hideTrainingDialog(dialog);
    openTraining(blankButton);
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    continueBlanking();
  });
  const observer = new MutationObserver(() => {
    if (suggested || isTrainingActive() || blankButton.dataset.state !== 'armed') return;
    suggested = true;
    showTrainingDialog(dialog, '[data-blank-training]');
  });
  observer.observe(blankButton, { attributes: true, attributeFilter: ['data-state'] });
  return Object.freeze({ dialog, observer });
}

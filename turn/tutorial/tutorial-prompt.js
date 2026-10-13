import { LEARNING_FEEDBACK_READY_EVENT } from '../achievements/learning-progress.js?revision=r1-learning-achievements';
import { KEYBOARD_DRIVE_BINDINGS } from '../input/keyboard-driving-controls.js';
import { QE_DRIVE_BINDINGS } from '../input/qe-drive-controls.js';
import { setLiveAnnouncement } from '../ui/race-announcements.js';
import { estimatedSpeechMs, holdSpeechFloor, releaseSpeechFloor, speechFloorWait } from '../ui/speech-floor.js';
import { applyCourseRescue } from './course-rescue.js';
import { STEERING_HELP_CHANGED_EVENT, loadSteeringHelp, steeringHelpTarget } from './steering-help.js';
import { createTurnTutorialCoach } from './turn-tutorial-coach.js';
import { STEERING_HELP_HINT, TURN_TUTORIAL_LESSONS, TUTORIAL_GRADUATION_WITH_HELP_MESSAGE } from './turn-tutorial-lessons.js';

// Lesson starts pause to teach through a modal TRY IT card (#1190). The same line
// remains as a silent reminder afterwards. Feedback still uses the polite live
// region, and all guidance waits for the shared speech floor.
const STYLE_ID = 'turn-tutorial-prompt-styles';
// Past the floor's end, so race speech due at that moment goes first.
const FLOOR_MARGIN_MS = 50;
const GRADUATION_SECONDS = 4;
const DRIVING_KEYS = new Set([...Object.keys(KEYBOARD_DRIVE_BINDINGS), ...Object.keys(QE_DRIVE_BINDINGS)]);
// Rescues before the prompt points to Tutorial steering help, and how long it shows.
const RESCUES_BEFORE_HINT = 2;
const HINT_SECONDS = 5;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .turn-tutorial-prompt {
      position: fixed;
      /* Set from the HUD stat row so the prompt never covers it. */
      top: var(--turn-tutorial-prompt-top, calc(env(safe-area-inset-top) + var(--turn-space-12)));
      left: 50%;
      z-index: 40;
      display: grid;
      gap: var(--turn-space-1);
      width: min(calc(100vw - 2 * var(--turn-gutter)), 30rem);
      box-sizing: border-box;
      padding: var(--turn-space-3) var(--turn-space-4);
      border: var(--turn-border-default) solid var(--turn-outline);
      border-radius: var(--turn-radius-default);
      background: var(--turn-surface-page);
      color: var(--turn-text);
      box-shadow: var(--turn-shadow-default);
      text-align: center;
      transform: translateX(-50%);
      pointer-events: none;
    }
    .turn-tutorial-prompt[hidden] { display: none; }
    .turn-tutorial-card {
      position: fixed;
      inset: var(--turn-tutorial-prompt-top, calc(env(safe-area-inset-top) + var(--turn-space-12))) auto auto 50%;
      margin: 0;
      transform: translateX(-50%);
      width: min(calc(100vw - 2 * var(--turn-gutter)), 30rem);
      max-height: calc(100dvh - var(--turn-tutorial-prompt-top, var(--turn-space-12)) - var(--turn-gutter));
      overflow: auto;
      box-sizing: border-box;
      padding: var(--turn-space-3) var(--turn-space-4);
      border: var(--turn-border-default) solid var(--turn-outline);
      border-radius: var(--turn-radius-default);
      background: var(--turn-surface-page);
      color: var(--turn-text);
      box-shadow: var(--turn-shadow-default);
      text-align: center;
    }
    .turn-tutorial-card::backdrop { background: transparent; }
    .turn-tutorial-card h2 { margin: 0; font-size: var(--turn-type-body); }
    .turn-tutorial-card p { margin: var(--turn-space-2) 0; font-size: var(--turn-type-small); line-height: var(--turn-leading-body); }
    .turn-tutorial-card button {
      min-height: var(--turn-target-min);
      padding: var(--turn-space-2) var(--turn-space-5);
      border: var(--turn-border-control) solid var(--turn-outline);
      border-radius: var(--turn-radius-control);
      background: var(--turn-action-primary);
      color: var(--turn-ink);
      font: inherit;
      font-weight: var(--turn-weight-display);
    }
    #controls .is-tutorial-target {
      outline: var(--turn-border-control) solid var(--turn-action-primary);
      outline-offset: var(--turn-space-1);
    }
    @media (forced-colors: active) {
      #controls .is-tutorial-target { outline-color: Highlight; }
    }
    .turn-tutorial-prompt strong {
      font-size: var(--turn-type-body);
      font-weight: var(--turn-weight-display);
      line-height: var(--turn-leading-title);
    }
    .turn-tutorial-prompt span {
      font-size: var(--turn-type-small);
      line-height: var(--turn-leading-body);
    }
  `;
  document.head.appendChild(style);
}

export function createTutorialPrompt(parent = document.body) {
  installStyles();
  // The box is what is seen, and found by exploring; the voice is what is said.
  const element = document.createElement('div');
  element.className = 'turn-tutorial-prompt';
  element.hidden = true;
  const title = document.createElement('strong');
  const text = document.createElement('span');
  title.id = 'turnTutorialPromptTitle';
  text.id = 'turnTutorialPromptText';
  element.append(title, text);
  const voice = document.createElement('div');
  voice.className = 'turn-sr-only turn-tutorial-voice';
  voice.setAttribute('aria-live', 'polite');
  voice.setAttribute('aria-atomic', 'true');
  const card = document.createElement('dialog');
  card.className = 'turn-tutorial-card';
  card.setAttribute('aria-labelledby', 'turnTutorialCardTitle');
  card.setAttribute('aria-describedby', 'turnTutorialCardText');
  card.innerHTML = '<h2 id="turnTutorialCardTitle"></h2><p id="turnTutorialCardText"></p><button type="button" data-turn-dialog-initial-focus>TRY IT</button>';
  const tryButton = card.querySelector('button');
  parent.append(element, voice, card);
  const acknowledged = new Set();
  let pendingCard = null;
  let guardedControls = null;
  let previousInert = false;
  const pauseOwner = () => globalThis.__turnRacePause;
  const externallyPaused = () => document.hidden || (pauseOwner()?.paused && pauseOwner().reason !== 'lesson');

  function clearTargets() {
    for (const target of document.querySelectorAll('.is-tutorial-target')) target.classList.remove('is-tutorial-target');
  }
  function guardControls() {
    if (guardedControls) return;
    guardedControls = document.querySelector('#controls');
    if (guardedControls) {
      previousInert = guardedControls.inert;
      guardedControls.inert = true;
    }
    // Input ownership also blocks keyboard driving while a staged card waits for
    // track-intro speech. No race hold or tilt recalibration is needed at the line.
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-labelledby', title.id);
    element.setAttribute('aria-describedby', text.id);
  }
  function closeCard() {
    pendingCard = null;
    if (card.open) card.close();
    element.removeAttribute('role');
    element.removeAttribute('aria-labelledby');
    element.removeAttribute('aria-describedby');
    if (guardedControls) guardedControls.inert = previousInert;
    guardedControls = null;
    clearTargets();
    pauseOwner()?.letGo?.();
  }
  tryButton.addEventListener('click', () => {
    if (externallyPaused() || !pendingCard) return;
    acknowledged.add(pendingCard);
    closeCard();
    element.hidden = false;
    place();
    // A button must not retain keyboard-driving ownership after TRY IT.
    document.activeElement?.blur?.();
  });
  card.addEventListener('cancel', (event) => {
    event.preventDefault();
    pauseOwner()?.pause('player');
  });
  card.addEventListener('close', () => {
    if (!pendingCard) return;
    pauseOwner()?.pause('player');
    sayWhenFree();
  });


  // The newest line not yet said; guidance overtaken before it could be said is not
  // said late. It waits with one timer at a time, and not at all while the race is
  // paused: RESUME picks it up again.
  let unsaid = '';
  let saidUntil = 0;
  let sayTimer = 0;
  let finishTimer = 0;
  let finishing = null;
  const paused = () => globalThis.__turnRacePause?.paused === true;
  function sayWhenFree() {
    clearTimeout(sayTimer);
    sayTimer = 0;
    if (externallyPaused() || (!pendingCard && (!unsaid || paused()))) return;
    if (card.open) return;
    const wait = speechFloorWait();
    if (wait > 0) {
      sayTimer = setTimeout(sayWhenFree, wait + FLOOR_MARGIN_MS);
      return;
    }
    if (pendingCard) {
      card.querySelector('h2').textContent = title.textContent;
      card.querySelector('p').textContent = text.textContent;
      place();
      element.hidden = true;
      card.showModal();
      tryButton.focus();
      holdSpeechFloor(estimatedSpeechMs(`${title.textContent}. ${text.textContent}`), 'tutorial');
      return;
    }
    const message = unsaid;
    unsaid = '';
    const ms = estimatedSpeechMs(message);
    holdSpeechFloor(ms, 'tutorial');
    saidUntil = performance.now() + ms;
    setLiveAnnouncement(voice, message);
    finishing?.check();
  }
  // A task later, so RESUME says its own words first (ui/race-pause-menu.js).
  const onUiState = (event) => {
    if (event.detail?.reason === 'race-pause-ended') {
      closeCard();
      return;
    }
    if (!['race-resumed', 'race-lesson-returned'].includes(event.detail?.reason)) return;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      sayWhenFree();
      finishing?.check();
    }, FLOOR_MARGIN_MS);
  };
  globalThis.addEventListener?.('turn:ui-state-change', onUiState);
  const onVisibility = () => { if (!document.hidden) sayWhenFree(); };
  document.addEventListener('visibilitychange', onVisibility);

  // Below the HUD stat row, measured again whenever the layout can change: the stat
  // chips reflow between portrait and landscape.
  function place() {
    if (element.hidden && !card.open) return;
    const stats = document.querySelector('#hud .topbar .stats') || document.querySelector('#hud .topbar');
    const below = stats?.getBoundingClientRect?.().bottom;
    if (Number.isFinite(below) && below > 0) {
      const top = `${Math.round(below) + 8}px`;
      element.style.setProperty('--turn-tutorial-prompt-top', top);
      card.style.setProperty('--turn-tutorial-prompt-top', top);
    }
  }
  let placing = 0;
  const onResize = () => {
    cancelAnimationFrame(placing);
    placing = requestAnimationFrame(place);
  };
  globalThis.addEventListener?.('resize', onResize);
  globalThis.addEventListener?.('orientationchange', onResize);

  // LOCK has no key (input/qe-drive-controls.js): a lesson's keyboardPrompt is shown to
  // players driving by keyboard, from their first driving key until they next touch the
  // race controls.
  let keyboard = false;
  let lastView = { kind: 'idle' };
  function useKeyboard(next) {
    if (keyboard === next) return;
    keyboard = next;
    if (lastView.kind === 'lesson' && lastView.keyboardPrompt) present(lastView);
  }
  const onKeyDown = (event) => {
    if (DRIVING_KEYS.has(event.code)) useKeyboard(true);
  };
  const onPointerDown = (event) => {
    if (event.target?.closest?.('#controls')) useKeyboard(false);
  };
  globalThis.addEventListener?.('keydown', onKeyDown, true);
  globalThis.addEventListener?.('pointerdown', onPointerDown, true);

  function present(view) {
    lastView = view;
    element.dataset.lesson = view.id || '';
    card.dataset.lesson = view.id || '';
    element.dataset.state = view.kind;
    if (view.kind === 'idle') {
      element.hidden = true;
      title.textContent = '';
      text.textContent = '';
      unsaid = '';
      clearTimeout(sayTimer);
      closeCard();
      return;
    }
    element.hidden = false;
    place();
    if (view.kind === 'lesson') {
      title.textContent = view.title;
      text.textContent = keyboard && view.keyboardPrompt ? view.keyboardPrompt : view.prompt;
    } else if (view.kind === 'done') {
      title.textContent = `${view.title} ✓`;
      text.textContent = view.text || 'Nice. Keep driving.';
    } else if (view.kind === 'hint') {
      title.textContent = view.title;
      text.textContent = view.text;
    } else if (view.kind === 'graduated') {
      title.textContent = 'TUTORIAL COMPLETE';
      text.textContent = view.message.replace(/^Tutorial complete\.\s*/, '');
    }
    if (view.kind === 'lesson' && view.hold !== false && !acknowledged.has(view.id)) {
      pendingCard = view.id;
      unsaid = '';
      voice.textContent = '';
      guardControls();
      pauseOwner()?.hold?.();
      clearTargets();
      for (const selector of view.targets || []) document.querySelector(selector)?.classList.add('is-tutorial-target');
      if (card.open) {
        card.querySelector('h2').textContent = title.textContent;
        card.querySelector('p').textContent = text.textContent;
        element.hidden = true;
      }
    } else {
      closeCard();
      // Returning to an acknowledged lesson (keyboard/steering-help updates) is a
      // silent reminder. Retry and completion feedback keep the existing voice.
      unsaid = view.kind === 'lesson' && view.hold !== false ? ''
        : `${title.textContent.replace(/ ✓$/, ' done')}. ${text.textContent}`;
    }
    sayWhenFree();
  }

  // The line: the box goes now, and the run ends once its last words have been said,
  // so what follows (an achievement) is not said over them.
  function finish() {
    element.hidden = true;
    return new Promise((resolve) => {
      const check = () => {
        clearTimeout(finishTimer);
        // Still to be said, or paused: saying it, or RESUME, checks again.
        if (unsaid || paused()) return;
        const left = saidUntil - performance.now();
        if (left > 0) {
          finishTimer = setTimeout(check, left);
          return;
        }
        finishing = null;
        resolve();
      };
      finishing = { check, resolve };
      check();
    });
  }

  function remove() {
    unsaid = '';
    closeCard();
    clearTimeout(sayTimer);
    clearTimeout(finishTimer);
    finishing?.resolve();
    finishing = null;
    globalThis.removeEventListener?.('turn:ui-state-change', onUiState);
    document.removeEventListener('visibilitychange', onVisibility);
    releaseSpeechFloor('tutorial');
    cancelAnimationFrame(placing);
    globalThis.removeEventListener?.('resize', onResize);
    globalThis.removeEventListener?.('orientationchange', onResize);
    globalThis.removeEventListener?.('keydown', onKeyDown, true);
    globalThis.removeEventListener?.('pointerdown', onPointerDown, true);
    element.remove();
    voice.remove();
    card.remove();
  }

  return Object.freeze({ element, voice, card, present, finish, remove, get holding() { return pendingCard !== null; } });
}

// Runs the coach once per frame for one tutorial run. Paused races do not advance it.
export function startTurnTutorialCoach({ runtime, events = globalThis }) {
  const { state } = runtime;
  const prompt = createTutorialPrompt();
  // Tutorial steering help (steering-help.js), switched in SETTINGS, also mid-lap.
  let steeringHelp = loadSteeringHelp();
  let helped = false;
  let rescuing = false;
  let rescues = 0;
  let hintLeft = 0;
  let lastView = { kind: 'idle' };

  // Lessons say what steering help changes, and the line says that it ends there.
  function forPlayer(view) {
    if (view.kind === 'lesson') {
      const lesson = TURN_TUTORIAL_LESSONS.find((candidate) => candidate.id === view.id);
      if (steeringHelp && lesson?.assistedPrompt) return { ...view, prompt: lesson.assistedPrompt };
      return lesson?.keyboardPrompt ? { ...view, keyboardPrompt: lesson.keyboardPrompt } : view;
    }
    if (view.kind === 'graduated' && helped) return { ...view, message: TUTORIAL_GRADUATION_WITH_HELP_MESSAGE };
    return view;
  }
  function present(view) {
    lastView = view;
    hintLeft = 0;
    prompt.present(forPlayer(view));
  }

  const coach = createTurnTutorialCoach({ state, maxSpeed: runtime.maxSpeed, present, isHeld: () => prompt.holding });
  coach.start();
  let frame = 0;
  let last = 0;
  let stopped = false;
  let graduated = false;
  // Seconds of race time the completion message stays up; it waits out a pause.
  let graduationLeft = 0;

  function onSteeringHelpChanged(event) {
    steeringHelp = event.detail?.enabled === true;
    if (lastView.kind === 'lesson') prompt.present(forPlayer(lastView));
  }

  const tick = (now) => {
    if (stopped) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (state.running && !prompt.holding && globalThis.__turnRacePause?.paused !== true) {
      coach.update(dt);
      // The teaching lap only: ordinary racing after the line has no rescue or help.
      if (!graduated && dt > 0 && !prompt.holding) {
        if (steeringHelp) helped = true;
        state.sessionSteeringTarget = steeringHelp ? steeringHelpTarget({ state, samples: runtime.samples }) : null;
        const rescue = applyCourseRescue({ state, samples: runtime.samples, trackWidth: runtime.trackWidth || 27, dt });
        if (rescue !== 'none' && !rescuing) rescues += 1;
        rescuing = rescue !== 'none';
        // Steering keeps going wrong: say once where the stronger help is.
        if (rescues === RESCUES_BEFORE_HINT && !rescuing && !steeringHelp) {
          rescues += 1;
          prompt.present({ kind: 'hint', id: 'steering-help', ...STEERING_HELP_HINT });
          hintLeft = HINT_SECONDS;
        }
      }
      if (hintLeft > 0) {
        hintLeft -= dt;
        if (hintLeft <= 0) prompt.present(forPlayer(lastView));
      }
      if (graduationLeft > 0) {
        graduationLeft -= dt;
        if (graduationLeft <= 0) {
          void prompt.finish().then(stop);
          return;
        }
      }
    }
    frame = requestAnimationFrame(tick);
  };

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    state.sessionSteeringTarget = null;
    events.removeEventListener?.('turn:session-graduated', onGraduated);
    events.removeEventListener?.(STEERING_HELP_CHANGED_EVENT, onSteeringHelpChanged);
    coach.stop();
    prompt.remove();
    // The TURN TUTORIAL achievement waits for the completion message (as DRIVE BY EAR
    // training's does for its dialogs); this lets it show now, at this finish.
    if (graduated) {
      events.dispatchEvent?.(new CustomEvent(LEARNING_FEEDBACK_READY_EVENT, {
        detail: Object.freeze({ source: 'turn-tutorial' })
      }));
    }
  }

  // The line: say so, then step out of the way of ordinary racing.
  function onGraduated() {
    graduated = true;
    state.sessionSteeringTarget = null;
    coach.graduate();
    graduationLeft = GRADUATION_SECONDS;
  }
  events.addEventListener?.('turn:session-graduated', onGraduated);
  events.addEventListener?.(STEERING_HELP_CHANGED_EVENT, onSteeringHelpChanged);
  frame = requestAnimationFrame(tick);

  return Object.freeze({ coach, stop });
}

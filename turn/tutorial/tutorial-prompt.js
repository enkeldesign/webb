import { LEARNING_FEEDBACK_READY_EVENT } from '../achievements/learning-progress.js?revision=r1-learning-achievements';
import { KEYBOARD_DRIVE_BINDINGS } from '../input/keyboard-driving-controls.js';
import { QE_DRIVE_BINDINGS } from '../input/qe-drive-controls.js';
import { applyCourseRescue } from './course-rescue.js';
import { STEERING_HELP_CHANGED_EVENT, loadSteeringHelp, steeringHelpTarget } from './steering-help.js';
import { createTurnTutorialCoach } from './turn-tutorial-coach.js';
import { STEERING_HELP_HINT, TURN_TUTORIAL_LESSONS, TUTORIAL_GRADUATION_WITH_HELP_MESSAGE } from './turn-tutorial-lessons.js';

// The TURN TUTORIAL prompt (#1132): one polite live region, so every lesson is both
// shown and spoken, and recoverable by reading it again. It never takes focus.
const STYLE_ID = 'turn-tutorial-prompt-styles';
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
  const element = document.createElement('div');
  element.className = 'turn-tutorial-prompt';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  element.hidden = true;
  const title = document.createElement('strong');
  const text = document.createElement('span');
  element.append(title, text);
  parent.appendChild(element);

  // Below the HUD stat row, measured again whenever the layout can change: the stat
  // chips reflow between portrait and landscape.
  function place() {
    if (element.hidden) return;
    const stats = document.querySelector('#hud .topbar .stats') || document.querySelector('#hud .topbar');
    const below = stats?.getBoundingClientRect?.().bottom;
    if (Number.isFinite(below) && below > 0) element.style.setProperty('--turn-tutorial-prompt-top', `${Math.round(below) + 8}px`);
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
    element.dataset.state = view.kind;
    if (view.kind === 'idle') {
      element.hidden = true;
      title.textContent = '';
      text.textContent = '';
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
  }

  function remove() {
    cancelAnimationFrame(placing);
    globalThis.removeEventListener?.('resize', onResize);
    globalThis.removeEventListener?.('orientationchange', onResize);
    globalThis.removeEventListener?.('keydown', onKeyDown, true);
    globalThis.removeEventListener?.('pointerdown', onPointerDown, true);
    element.remove();
  }

  return Object.freeze({ element, present, remove });
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

  const coach = createTurnTutorialCoach({ state, maxSpeed: runtime.maxSpeed, present });
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
    if (state.running && globalThis.__turnRacePause?.paused !== true) {
      coach.update(dt);
      // The teaching lap only: ordinary racing after the line has no rescue or help.
      if (!graduated && dt > 0) {
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
          stop();
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

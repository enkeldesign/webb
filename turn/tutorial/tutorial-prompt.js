import { createTurnTutorialCoach } from './turn-tutorial-coach.js';

// The TURN TUTORIAL prompt (#1132): one polite live region, so every lesson is both
// shown and spoken, and recoverable by reading it again. It never takes focus.
const STYLE_ID = 'turn-tutorial-prompt-styles';
const GRADUATION_SECONDS = 4;

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

  function present(view) {
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
      text.textContent = view.prompt;
    } else if (view.kind === 'done') {
      title.textContent = `${view.title} ✓`;
      text.textContent = view.text || 'Nice. Keep driving.';
    } else if (view.kind === 'graduated') {
      title.textContent = 'TUTORIAL COMPLETE';
      text.textContent = view.message.replace(/^Tutorial complete\.\s*/, '');
    }
  }

  function remove() {
    cancelAnimationFrame(placing);
    globalThis.removeEventListener?.('resize', onResize);
    globalThis.removeEventListener?.('orientationchange', onResize);
    element.remove();
  }

  return Object.freeze({ element, present, remove });
}

// Runs the coach once per frame for one tutorial run. Paused races do not advance it.
export function startTurnTutorialCoach({ runtime, events = globalThis }) {
  const { state } = runtime;
  const prompt = createTutorialPrompt();
  const coach = createTurnTutorialCoach({ state, maxSpeed: runtime.maxSpeed, present: prompt.present });
  let frame = 0;
  let last = 0;
  let stopped = false;
  // Seconds of race time the completion message stays up; it waits out a pause.
  let graduationLeft = 0;

  const tick = (now) => {
    if (stopped) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (state.running && globalThis.__turnRacePause?.paused !== true) {
      coach.update(dt);
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
    events.removeEventListener?.('turn:session-graduated', onGraduated);
    coach.stop();
    prompt.remove();
  }

  // The line: say so, then step out of the way of ordinary racing.
  function onGraduated() {
    coach.graduate();
    graduationLeft = GRADUATION_SECONDS;
  }
  events.addEventListener?.('turn:session-graduated', onGraduated);
  frame = requestAnimationFrame(tick);

  return Object.freeze({ coach, stop });
}

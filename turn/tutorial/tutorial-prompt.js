import { LEARNING_FEEDBACK_READY_EVENT } from '../achievements/learning-progress.js?revision=r1-learning-achievements';
import { KEYBOARD_DRIVE_BINDINGS, keyboardDriveActionForEvent } from '../input/keyboard-driving-controls.js';
import { QE_DRIVE_BINDINGS, qeDriveZoneForEvent } from '../input/qe-drive-controls.js';
import { beginTutorialRivalLead } from '../race/replay-system.js';
import { setLiveAnnouncement } from '../ui/race-announcements.js';
import { estimatedSpeechMs, holdSpeechFloor, releaseSpeechFloor, speechFloorWait } from '../ui/speech-floor.js';
import { applyCourseRescue } from './course-rescue.js';
import { STEERING_HELP_CHANGED_EVENT, loadSteeringHelp, steeringHelpTarget } from './steering-help.js';
import { createTurnTutorialCoach } from './turn-tutorial-coach.js';
import { STEERING_HELP_HINT, TURN_TUTORIAL_LESSONS, TUTORIAL_GRADUATION_WITH_HELP_MESSAGE } from './turn-tutorial-lessons.js';

// Lessons freeze immediately, then teach through the real controls (#1202). The
// card is nonmodal so VoiceOver can reach the pad. One polite voice owns guidance
// and still waits for the shared speech floor; the reminder afterwards is silent.
const STYLE_ID = 'turn-tutorial-prompt-styles';
// Past the floor's end, so race speech due at that moment goes first.
const FLOOR_MARGIN_MS = 50;
const GRADUATION_SECONDS = 4;
const PRESENTATION_OUT_MS = 120;
const CONTROL_ACTIONS = Object.freeze({
  '.drive-gas-zone': 'gas', '.drive-drift-zone': 'drift', '.drive-boost-zone': 'boost'
});
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
      z-index: 40;
      opacity: 0;
      transition: opacity 120ms ease-out;
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
    .turn-tutorial-card.is-visible { opacity: 1; animation: turn-tutorial-in 140ms ease-out; }
    @keyframes turn-tutorial-in {
      from { opacity: 0; transform: translate(-50%, calc(-1 * var(--turn-space-1))); }
      to { opacity: 1; transform: translateX(-50%); }
    }
    .turn-tutorial-dim {
      position: absolute;
      inset: 0;
      z-index: 1;
      background: var(--turn-shadow-color);
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease-out;
    }
    .turn-tutorial-dim.is-visible { opacity: .13; transition-duration: 140ms; }
    .turn-tutorial-card h2 { margin: 0; font-size: var(--turn-type-body); }
    .turn-tutorial-card p { margin: var(--turn-space-2) 0; font-size: var(--turn-type-small); line-height: var(--turn-leading-body); }
    .turn-tutorial-card button {
      min-height: var(--turn-target-min);
      padding: var(--turn-space-2) var(--turn-space-5);
      border: var(--turn-border-control) solid var(--turn-outline);
      border-radius: var(--turn-radius-control);
      background: var(--turn-action-utility);
      color: var(--turn-text);
      font: inherit;
      font-weight: var(--turn-weight-display);
    }
    #controls .turn-tutorial-control {
      outline: var(--turn-border-control) solid transparent;
      outline-offset: calc(-1 * var(--turn-border-control));
      transition: outline-color 120ms ease-out;
    }
    #controls .is-tutorial-target {
      outline-color: var(--turn-action-primary);
      animation: turn-tutorial-emphasis 620ms ease-out 80ms;
    }
    @keyframes turn-tutorial-emphasis {
      0%, 100% { outline-width: var(--turn-border-control); }
      40% { outline-width: var(--turn-space-2); }
    }
    @media (prefers-reduced-motion: reduce) {
      .turn-tutorial-card.is-visible { animation: none; }
      #controls .is-tutorial-target { animation: none; }
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
  const element = document.createElement('div');
  element.className = 'turn-tutorial-prompt';
  element.hidden = true;
  const title = document.createElement('strong');
  const text = document.createElement('span');
  element.append(title, text);
  const voice = document.createElement('div');
  voice.className = 'turn-sr-only turn-tutorial-voice';
  voice.setAttribute('aria-live', 'polite');
  voice.setAttribute('aria-atomic', 'true');
  const card = document.createElement('section');
  card.className = 'turn-tutorial-card';
  card.hidden = true;
  card.setAttribute('aria-labelledby', 'turnTutorialCardTitle');
  card.innerHTML = '<h2 id="turnTutorialCardTitle"></h2><p></p><p id="turnTutorialResumeText"></p>';
  const continueButton = document.createElement('button');
  continueButton.type = 'button';
  continueButton.textContent = 'CONTINUE';
  const resumeText = card.querySelector('#turnTutorialResumeText');
  const dim = document.createElement('div');
  dim.className = 'turn-tutorial-dim';
  dim.setAttribute('aria-hidden', 'true');
  document.querySelector('#game')?.append(dim);
  parent.append(element, voice, card);
  const acknowledged = new Set();
  const announced = new Set();
  const descriptions = new Map();
  const controls = new Set();
  let pendingCard = null;
  let firstTarget = null;
  let hideTimer = 0;
  const pauseOwner = () => globalThis.__turnRacePause;
  const externallyPaused = () => document.hidden || (pauseOwner()?.paused && pauseOwner().reason !== 'lesson');

  function clearTargets() {
    for (const target of controls) target.classList.remove('is-tutorial-target');
    for (const [target, description] of descriptions) {
      if (description === null) target.removeAttribute('aria-describedby');
      else target.setAttribute('aria-describedby', description);
    }
    descriptions.clear();
  }
  function hideCard() {
    clearTimeout(hideTimer);
    card.dataset.ready = 'false';
    card.inert = true;
    card.setAttribute('aria-hidden', 'true');
    card.classList.remove('is-visible');
    dim.classList.remove('is-visible');
    clearTargets();
    hideTimer = setTimeout(() => {
      card.hidden = true;
      for (const target of controls) target.classList.remove('turn-tutorial-control');
      if (!pendingCard && lastView.kind !== 'idle') {
        element.hidden = false;
        place();
      }
    }, PRESENTATION_OUT_MS);
  }
  function closeCard() {
    pendingCard = null;
    firstTarget = null;
    voice.textContent = '';
    hideCard();
    pauseOwner()?.letGo?.();
  }
  function acceptLesson() {
    if (externallyPaused() || !pendingCard || card.dataset.ready !== 'true') return false;
    acknowledged.add(pendingCard);
    closeCard();
    return true;
  }
  continueButton.addEventListener('click', () => {
    if (firstTarget || !acceptLesson()) return;
    document.activeElement?.blur?.();
  });

  // The newest unsaid guidance waits with one timer, never through an outer pause.
  let unsaid = '';
  let saidUntil = 0;
  let sayTimer = 0;
  let finishTimer = 0;
  let finishing = null;
  const paused = () => pauseOwner()?.paused === true;
  function showCard() {
    clearTimeout(hideTimer);
    card.querySelector('h2').textContent = title.textContent;
    card.querySelector('p').textContent = text.textContent;
    const action = CONTROL_ACTIONS[firstTarget];
    resumeText.textContent = action ? `Hold ${action.toUpperCase()} to resume.` : '';
    resumeText.hidden = !action;
    // There is no hidden continuation control for gameplay lessons.
    if (action) continueButton.remove();
    else card.append(continueButton);
    card.dataset.resumeAction = action || '';
    card.dataset.ready = 'true';
    card.hidden = false;
    card.inert = false;
    card.removeAttribute('aria-hidden');
    card.classList.add('is-visible');
    dim.classList.add('is-visible');
    element.hidden = true;
    place();
    for (const selector of lastView.targets || []) {
      const target = document.querySelector(selector);
      if (!target) continue;
      controls.add(target);
      target.classList.add('turn-tutorial-control', 'is-tutorial-target');
      if (selector === firstTarget && !descriptions.has(target)) {
        const description = target.getAttribute('aria-describedby');
        descriptions.set(target, description);
        target.setAttribute('aria-describedby', `${description || ''} turnTutorialResumeText`.trim());
      }
    }
  }
  function sayWhenFree() {
    clearTimeout(sayTimer);
    sayTimer = 0;
    if (externallyPaused() || (!pendingCard && (!unsaid || paused()))) return;
    // Returning from PAUSED restores the same visual instruction, without repeating it.
    if (pendingCard && announced.has(pendingCard)) {
      showCard();
      return;
    }
    const wait = speechFloorWait();
    if (wait > 0) {
      sayTimer = setTimeout(sayWhenFree, wait + FLOOR_MARGIN_MS);
      return;
    }
    if (pendingCard) {
      showCard();
      announced.add(pendingCard);
      unsaid = `${title.textContent}. ${text.textContent} ${resumeText.textContent}`.trim();
    }
    const message = unsaid;
    unsaid = '';
    const ms = estimatedSpeechMs(message);
    holdSpeechFloor(ms, 'tutorial');
    saidUntil = performance.now() + ms;
    setLiveAnnouncement(voice, message);
    finishing?.check();
  }
  const onUiState = (event) => {
    if (event.detail?.reason === 'race-pause-ended') {
      closeCard();
      return;
    }
    if (event.detail?.reason === 'race-paused' && externallyPaused()) {
      clearTimeout(sayTimer);
      hideCard();
      element.hidden = true;
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

  function place() {
    if (element.hidden && card.hidden) return;
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

  let keyboard = false;
  let lastView = { kind: 'idle' };
  function useKeyboard(next) {
    if (keyboard === next) return;
    keyboard = next;
    if (lastView.kind === 'lesson' && lastView.keyboardPrompt) present(lastView);
  }
  // Called inside keyboard ownership, before Q/E or GAS records a held key. The
  // original key is neither consumed nor replayed, so the first action is real.
  const onDrivingInput = (request) => {
    const event = request.detail?.event;
    useKeyboard(true);
    if (!pendingCard) return;
    const action = qeDriveZoneForEvent(event) || keyboardDriveActionForEvent(event);
    if (event.repeat || action !== CONTROL_ACTIONS[firstTarget] || !acceptLesson()) request.preventDefault();
  };
  globalThis.addEventListener?.('turn:before-driving-input', onDrivingInput);
  const onKeyDown = (event) => {
    if (DRIVING_KEYS.has(event.code)) useKeyboard(true);
    if (pendingCard && ['Enter', ' '].includes(event.key)
      && event.target?.closest?.('.drive-stack')) {
      // REVERSE has its own native key hold, outside keyboard driving ownership.
      // It must not leave a held action queued behind another control's lesson.
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (event.key === 'Escape' && pendingCard && !externallyPaused()) {
      if (pauseOwner()?.pause('player')) event.preventDefault();
    }
  };
  const onPointerDown = (event) => {
    if (!event.target?.closest?.('#controls')) return;
    if (event.pointerType !== 'keyboard') useKeyboard(false);
    if (!pendingCard || !event.target.closest('.drive-stack, #manualSteer')) return;
    if (event.button !== 0 || !firstTarget || !event.target.closest(firstTarget) || !acceptLesson()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    // Otherwise let this very pointerdown reach the live pad's existing owner,
    // including VoiceOver's double-tap-and-hold. No duplicate synthetic press.
  };
  const onClick = (event) => {
    // A synthetic activation of an unrelated bubble (e.g. SHIFT) must not queue
    // a gameplay change behind the hold. The pad's hold gesture uses pointerdown.
    if (pendingCard && event.target?.closest?.('.drive-stack, #manualSteer')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  globalThis.addEventListener?.('keydown', onKeyDown, true);
  globalThis.addEventListener?.('pointerdown', onPointerDown, true);
  globalThis.addEventListener?.('click', onClick, true);

  function present(view) {
    lastView = view;
    element.dataset.lesson = view.id || '';
    card.dataset.lesson = view.id || '';
    element.dataset.state = view.kind;
    if (view.kind === 'idle') {
      closeCard();
      element.hidden = true;
      title.textContent = '';
      text.textContent = '';
      unsaid = '';
      clearTimeout(sayTimer);
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
      title.textContent = view.message.startsWith('Tutorial complete!') ? 'TUTORIAL COMPLETE!' : 'TUTORIAL COMPLETE';
      text.textContent = view.message.replace(/^Tutorial complete[.!]\s*/, '');
    }
    if (view.kind === 'lesson' && view.hold !== false && !acknowledged.has(view.id)) {
      if (pendingCard !== view.id) {
        clearTargets();
        card.dataset.ready = 'false';
        voice.textContent = '';
      }
      pendingCard = view.id;
      firstTarget = view.targets?.[0] || null;
      unsaid = '';
      pauseOwner()?.hold?.();
      if (!externallyPaused()) dim.classList.add('is-visible');
    } else {
      closeCard();
      unsaid = view.kind === 'lesson' && view.hold !== false ? ''
        : view.kind === 'graduated' ? view.message
        : `${title.textContent.replace(/ ✓$/, ' done')}. ${text.textContent}`;
    }
    sayWhenFree();
  }

  function finish() {
    element.hidden = true;
    clearTimeout(hideTimer);
    return new Promise((resolve) => {
      const check = () => {
        clearTimeout(finishTimer);
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
    clearTimeout(hideTimer);
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
    globalThis.removeEventListener?.('click', onClick, true);
    globalThis.removeEventListener?.('turn:before-driving-input', onDrivingInput);
    for (const target of controls) target.classList.remove('turn-tutorial-control');
    element.remove();
    voice.remove();
    card.remove();
    dim.remove();
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

  const coach = createTurnTutorialCoach({ state, present, isHeld: () => prompt.holding });
  coach.start();
  let frame = 0;
  let last = 0;
  let stopped = false;
  let graduated = false;
  // Seconds of race time the completion message stays up; it waits out a pause.
  let graduationLeft = 0;

  function onSteeringHelpChanged(event) {
    steeringHelp = event.detail?.enabled === true;
    // SETTINGS can change this behind a lesson hold, before another driving tick.
    if (!steeringHelp) state.sessionSteeringTarget = null;
    if (lastView.kind === 'lesson') prompt.present(forPlayer(lastView));
  }

  const tick = (now) => {
    if (stopped) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (state.running && !prompt.holding && globalThis.__turnRacePause?.paused !== true) {
      coach.update(dt);
      // The teaching lap only: ordinary racing after the line has no rescue or help.
      // Asked again: the update above may have just begun a lesson hold.
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
    beginTutorialRivalLead(state.competitorLaps[0], state);
    coach.graduate();
    graduationLeft = GRADUATION_SECONDS;
  }
  events.addEventListener?.('turn:session-graduated', onGraduated);
  events.addEventListener?.(STEERING_HELP_CHANGED_EVENT, onSteeringHelpChanged);
  frame = requestAnimationFrame(tick);

  return Object.freeze({ coach, stop });
}
